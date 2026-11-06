import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildBundle,
  convert,
  createZip,
  crc32,
  missingBox,
  substituteAsset,
} from '../src/index.js';

const FIXED_DATE = new Date('2026-01-02T03:04:06Z');
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

// --------------------------------------------------------------- asset list

test('convert() reports the images and SVGs the document needs', () => {
  const { assets } = convert('![](img/plot.png)\n\n![[diagram.excalidraw]]\n');
  assert.deepEqual(assets, [
    { path: 'img/plot.png', kind: 'image', isUrl: false },
    // An Excalidraw embed compiles from its exported SVG, not the drawing file.
    { path: 'diagram.excalidraw.svg', kind: 'svg', isUrl: false },
  ]);
});

test('a repeated embed is reported once', () => {
  const { assets } = convert('![](a.png)\n\n![](a.png)\n\n![](b.png)\n');
  assert.deepEqual(
    assets.map((asset) => asset.path),
    ['a.png', 'b.png'],
  );
});

test('an embed that already names its format is not given a second extension', () => {
  // `![[chart.svg]]` used to look for `chart.svg.svg`, because the Excalidraw
  // convention of appending `.svg` was applied to every embed.
  const { assets, latex } = convert('![[chart.svg]]\n\n![[photo.png]]\n\n![[sketch.excalidraw]]\n');
  assert.deepEqual(assets, [
    { path: 'chart.svg', kind: 'svg', isUrl: false },
    { path: 'photo.png', kind: 'image', isUrl: false },
    { path: 'sketch.excalidraw.svg', kind: 'svg', isUrl: false },
  ]);
  // A raster embed also has to use \includegraphics, not \includesvg.
  assert.match(latex, /includegraphics\[[^\]]*\]\{photo\.png\}/);
  assert.match(latex, /includesvg\[[^\]]*\]\{chart\.svg\}/);
});

test('a remote image is flagged rather than treated as a local file', () => {
  const { assets } = convert('![](https://example.com/plot.png)\n');
  assert.equal(assets[0]?.isUrl, true);
});

test('asset paths follow the wikilink resolver', () => {
  const { assets } = convert('![[diagram.svg]]\n', {
    resolveWikiLink: () => ({ href: 'attachments/nested/diagram.svg' }),
  });
  assert.deepEqual(
    assets.map((asset) => asset.path),
    ['attachments/nested/diagram.svg'],
  );
});

// ---------------------------------------------------------------- zip format

test('crc32 matches the known check value', () => {
  // The standard CRC-32 test vector: "123456789" -> 0xCBF43926.
  assert.equal(crc32(bytes('123456789')), 0xcbf43926);
});

test('the archive is readable by the system unzip', () => {
  const zip = createZip(
    [
      { path: 'doc.tex', data: bytes('\\documentclass{article}\n') },
      { path: 'figures/שרטוט.svg', data: bytes('<svg/>') },
    ],
    { date: FIXED_DATE },
  );

  const dir = mkdtempSync(join(tmpdir(), 'mdtolatex-zip-'));
  const archive = join(dir, 'out.zip');
  writeFileSync(archive, zip);

  // `unzip -t` verifies every CRC, which is the real check that the headers are
  // correct rather than merely self-consistent.
  const test = execFileSync('unzip', ['-t', archive], { encoding: 'utf8' });
  assert.match(test, /No errors detected/);

  execFileSync('unzip', ['-q', '-o', archive, '-d', dir]);
  assert.equal(readFileSync(join(dir, 'doc.tex'), 'utf8'), '\\documentclass{article}\n');
  // A UTF-8 filename has to survive the round trip; most of this project's
  // attachments have Hebrew names.
  assert.equal(readFileSync(join(dir, 'figures/שרטוט.svg'), 'utf8'), '<svg/>');
});

test('createZip is byte-reproducible for a fixed date', () => {
  const entries = [{ path: 'a.txt', data: bytes('hello') }];
  assert.deepEqual(
    createZip(entries, { date: FIXED_DATE }),
    createZip(entries, { date: FIXED_DATE }),
  );
});

test('createZip rejects duplicate and escaping paths', () => {
  const entry = { path: 'a.txt', data: bytes('x') };
  assert.throws(() => createZip([entry, entry]), /duplicate/);
  assert.throws(() => createZip([{ path: '../a.txt', data: bytes('x') }]), /\.\./);
});

// -------------------------------------------------------------- full bundle

test('buildBundle puts the .tex and its assets in one archive', async () => {
  const { latex, assets } = convert('![](img/plot.png)\n\n![[chart.svg]]\n');
  const bundle = await buildBundle({
    latex,
    assets,
    texName: 'Notes.tex',
    readAsset: (path) => bytes(`bytes of ${path}`),
    date: FIXED_DATE,
  });

  assert.deepEqual(bundle.included, ['img/plot.png', 'chart.svg']);
  assert.deepEqual(bundle.skipped, []);

  const dir = mkdtempSync(join(tmpdir(), 'mdtolatex-bundle-'));
  const archive = join(dir, 'bundle.zip');
  writeFileSync(archive, bundle.zip);
  execFileSync('unzip', ['-q', archive, '-d', dir]);

  // The asset keeps the exact relative path the document references, so the
  // extracted folder compiles with no \graphicspath and no edits.
  assert.match(readFileSync(join(dir, 'Notes.tex'), 'utf8'), /includegraphics.*img\/plot\.png/);
  assert.equal(readFileSync(join(dir, 'img/plot.png'), 'utf8'), 'bytes of img/plot.png');
});

test('a missing asset is reported instead of failing the bundle', async () => {
  const { latex, assets } = convert('![](img/there.png)\n\n![](img/gone.png)\n');
  const bundle = await buildBundle({
    latex,
    assets,
    texName: 'Notes.tex',
    readAsset: (path) => (path.includes('gone') ? null : bytes('data')),
  });

  assert.deepEqual(bundle.included, ['img/there.png']);
  assert.deepEqual(bundle.skipped, [{ path: 'img/gone.png', reason: 'missing' }]);
});

test('a remote image is skipped as remote and never read', async () => {
  const { latex, assets } = convert('![](https://example.com/plot.png)\n');
  let reads = 0;
  const bundle = await buildBundle({
    latex,
    assets,
    texName: 'Notes.tex',
    readAsset: () => {
      reads += 1;
      return null;
    },
  });

  assert.equal(reads, 0);
  assert.deepEqual(bundle.skipped, [{ path: 'https://example.com/plot.png', reason: 'remote' }]);
});

test('a reader that throws is reported as unreadable', async () => {
  const { latex, assets } = convert('![](img/locked.png)\n');
  const bundle = await buildBundle({
    latex,
    assets,
    texName: 'Notes.tex',
    readAsset: () => {
      throw new Error('EACCES');
    },
  });

  assert.equal(bundle.skipped[0]?.reason, 'unreadable');
  assert.equal(bundle.skipped[0]?.detail, 'EACCES');
});

test('an asset outside the bundle root is relocated and the .tex repointed', async () => {
  const { latex, assets } = convert('![](../shared/logo.png)\n');
  const bundle = await buildBundle({
    latex,
    assets,
    texName: 'Notes.tex',
    readAsset: () => bytes('png'),
  });

  // `../shared/logo.png` cannot exist inside an archive, so it moves and the
  // include is rewritten to match — otherwise the bundle would not compile.
  assert.deepEqual(bundle.included, ['figures/logo.png']);
  assert.match(bundle.latex, /\{figures\/logo\.png\}/);
  assert.doesNotMatch(bundle.latex, /\{\.\.\/shared\/logo\.png\}/);
});

// ------------------------------------------------- dangling include handling

test('substituteAsset repoints an include and switches the command', () => {
  const { latex, assets } = convert('![[chart.svg]]\n');
  const swapped = substituteAsset(latex, assets[0]!, { path: 'chart.pdf', kind: 'image' });
  // An SVG rendered to PDF has to move from \includesvg to \includegraphics, or
  // the document still needs Inkscape at compile time.
  assert.match(swapped, /\\includegraphics\[width=0\.8\\textwidth\]\{chart\.pdf\}/);
  assert.doesNotMatch(swapped, /includesvg/);
});

test('onSkipped replaces the include of an asset that cannot be bundled', async () => {
  const { latex, assets } = convert('![](img/gone.png)\n');
  const bundle = await buildBundle({
    latex,
    assets,
    texName: 'Notes.tex',
    readAsset: () => null,
    onSkipped: (asset, reason) => missingBox(asset, `absent (${reason})`),
  });

  // Leaving the include in place is what makes xelatex emit a truncated PDF, so
  // the dangling reference must be gone.
  assert.doesNotMatch(bundle.latex, /includegraphics.*img\/gone\.png/);
  assert.match(bundle.latex, /absent \(missing\)/);
  assert.match(bundle.latex, /\\detokenize\{img\/gone\.png\}/);
});

test('an include is left untouched when onSkipped returns nothing', async () => {
  const { latex, assets } = convert('![](img/gone.png)\n');
  const bundle = await buildBundle({
    latex,
    assets,
    texName: 'Notes.tex',
    readAsset: () => null,
    onSkipped: () => null,
  });
  assert.match(bundle.latex, /includegraphics.*img\/gone\.png/);
});

test('consecutive paragraphs are separated by a blank line', () => {
  // Without a blank line TeX stays in horizontal mode, so the paragraphs ran
  // together as one: "First.Second."
  const { latex } = convert('First.\n\nSecond.\n');
  assert.match(latex, /First\.\n\nSecond\./);
});

test('an Excalidraw drawing embeds its exported SVG, not the .md scene file', () => {
  // Obsidian stores the drawing as `<name>.excalidraw.md`; LaTeX can do nothing
  // with that, so every spelling has to land on the exported `.svg`.
  const { assets, latex } = convert(
    '![[a.excalidraw]]\n\n![[b.excalidraw.md]]\n\n![](dir/c.excalidraw.md)\n',
  );

  assert.deepEqual(
    assets.map((asset) => asset.path),
    ['a.excalidraw.svg', 'b.excalidraw.svg', 'dir/c.excalidraw.svg'],
  );
  assert.equal(assets.every((asset) => asset.kind === 'svg'), true);
  assert.equal(/\.excalidraw\.md/.test(latex), false);
  assert.equal((latex.match(/\\includesvg/g) ?? []).length, 3);
});

test('a resolver that answers with the drawing file is redirected to the SVG', () => {
  // The vault lookup finds the real file — the `.md` one — so the rewrite has to
  // happen after the resolver, not only on the unresolved fallback.
  const { assets } = convert('![[sketch.excalidraw.md]]\n', {
    resolveWikiLink: () => ({ href: 'Drawings/sketch.excalidraw.md' }),
  });

  assert.deepEqual(assets.map((asset) => asset.path), ['Drawings/sketch.excalidraw.svg']);
});
