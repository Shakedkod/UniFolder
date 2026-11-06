import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import {
  createVaultAssetReader,
  createVaultIndex,
  createVaultResolver,
  resolveLinkpath,
  vaultNotes,
} from '../src/vault.js';
import { detectLanguage } from '../src/language.js';

/** Builds a throwaway vault from a path -> contents map. */
async function vault(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mdtolatex-vault-'));
  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents, 'utf8');
  }
  return root;
}

test('a bare note name resolves from anywhere in the vault', async () => {
  const index = await createVaultIndex(
    await vault({ 'math/Integrals.md': '#', 'physics/Waves.md': '#' }),
  );

  assert.equal(resolveLinkpath(index, 'Integrals', 'physics/Waves.md'), 'math/Integrals.md');
  // Obsidian matches linkpaths case-insensitively.
  assert.equal(resolveLinkpath(index, 'integrals', 'physics/Waves.md'), 'math/Integrals.md');
});

test('a full path and a folder-relative name both resolve', async () => {
  const index = await createVaultIndex(
    await vault({ 'math/Integrals.md': '#', 'math/img/plot.png': 'x' }),
  );

  assert.equal(resolveLinkpath(index, 'math/Integrals.md', 'index.md'), 'math/Integrals.md');
  assert.equal(resolveLinkpath(index, 'math/Integrals', 'index.md'), 'math/Integrals.md');
  assert.equal(resolveLinkpath(index, 'img/plot.png', 'math/Integrals.md'), 'math/img/plot.png');
});

test('an ambiguous name prefers the linking note’s own folder', async () => {
  const index = await createVaultIndex(
    await vault({ 'a/Notes.md': '#', 'b/Notes.md': '#', 'b/Source.md': '#' }),
  );

  assert.equal(resolveLinkpath(index, 'Notes', 'b/Source.md'), 'b/Notes.md');
});

test('a link that points nowhere resolves to nothing', async () => {
  const index = await createVaultIndex(await vault({ 'One.md': '#' }));
  assert.equal(resolveLinkpath(index, 'Missing', 'One.md'), null);
});

test('the resolver renders notes, embeds and dead links differently', async () => {
  const index = await createVaultIndex(
    await vault({ 'Target.md': '#', 'img/plot.png': 'x', 'Source.md': '#' }),
  );
  const dead: string[] = [];
  const resolve = createVaultResolver(index, 'Source.md', {
    onUnresolved: (request) => dead.push(request.target),
  });

  // A note link drops `.md`, because a published vault serves clean paths.
  assert.deepEqual(resolve({ ...request('Target'), kind: 'link' }), { href: 'Target' });
  // An embed keeps the real extension: it is handed to \includegraphics.
  assert.deepEqual(resolve({ ...request('plot.png'), kind: 'embed' }), { href: 'img/plot.png' });
  // A dead link reads as text rather than pointing at a page that does not exist.
  assert.deepEqual(resolve({ ...request('Gone'), kind: 'link' }), { plain: true });
  assert.deepEqual(dead, ['Gone']);
});

test('an in-note reference is left to the core', async () => {
  const index = await createVaultIndex(await vault({ 'Source.md': '#' }));
  const resolve = createVaultResolver(index, 'Source.md');
  assert.equal(resolve({ ...request(''), heading: 'Section', kind: 'link' }), null);
});

test('assets are found by vault path, by note-relative path, and by name', async () => {
  const root = await vault({
    'math/Integrals.md': '#',
    'math/local.png': 'local',
    'top.png': 'top',
    'Attachments/loose.png': 'loose',
  });
  const index = await createVaultIndex(root);
  const read = createVaultAssetReader(index, 'math/Integrals.md');

  assert.equal(new TextDecoder().decode((await read('local.png'))!), 'local');
  assert.equal(new TextDecoder().decode((await read('top.png'))!), 'top');
  // Obsidian finds an attachment in a folder the note never mentions.
  assert.equal(new TextDecoder().decode((await read('loose.png'))!), 'loose');
  assert.equal(await read('nope.png'), null);
});

test('a percent-encoded embed path still resolves', async () => {
  const index = await createVaultIndex(await vault({ 'img/my plot.png': 'x', 'Note.md': '#' }));
  const read = createVaultAssetReader(index, 'Note.md');
  assert.equal(new TextDecoder().decode((await read('img/my%20plot.png'))!), 'x');
});

test('Excalidraw sources and private folders are not published as notes', async () => {
  const index = await createVaultIndex(
    await vault({
      'Note.md': '#',
      'Drawings/sketch.excalidraw.md': '#',
      'Drawings/sketch.excalidraw.svg': '<svg/>',
    }),
  );

  // The drawing source is a figure, not a document to convert.
  assert.deepEqual(vaultNotes(index), ['Note.md']);
});

test('Hebrew text selects the Hebrew preamble', () => {
  assert.equal(detectLanguage('שלום עולם'), 'hebrew');
  assert.equal(detectLanguage('hello world'), 'english');
});

function request(target: string) {
  return { target, heading: '', blockRef: '', alias: '', text: target, kind: 'link' as const };
}
