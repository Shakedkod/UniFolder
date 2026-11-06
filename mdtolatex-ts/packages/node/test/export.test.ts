import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { exportDocument } from '../src/export.js';
import { findSvgConverter } from '../src/svg.js';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20"/></svg>';

/** Serves a fixed set of assets, so these tests touch no filesystem. */
function reader(files: Record<string, string>) {
  return async (path: string) =>
    path in files ? new TextEncoder().encode(files[path]) : null;
}

test('an SVG becomes a PDF, and the include stops being \\includesvg', async (t) => {
  if (!(await findSvgConverter())) return t.skip('no SVG converter installed');

  const result = await exportDocument({
    markdown: '![](chart.svg)',
    options: { title: 'Doc' },
    readAsset: reader({ 'chart.svg': SVG }),
  });

  // The whole point: \includesvg needs Inkscape at compile time, so none may
  // survive an export.
  assert.equal(result.latex.includes('\\includesvg'), false);
  assert.match(result.latex, /\\includegraphics\[[^\]]*\]\{chart\.pdf\}/);
  // The converted figure exists nowhere else, so it has to come back with the
  // document or the include dangles.
  assert.ok(result.generated.has('chart.pdf'));
  assert.equal(new TextDecoder().decode(result.generated.get('chart.pdf')!.slice(0, 4)), '%PDF');
  assert.deepEqual(result.skipped, []);
});

test('--keep-svg leaves the include alone', async () => {
  const result = await exportDocument({
    markdown: '![](chart.svg)',
    options: { title: 'Doc' },
    readAsset: reader({ 'chart.svg': SVG }),
    keepSvg: true,
  });

  assert.match(result.latex, /\\includesvg/);
  assert.equal(result.generated.size, 0);
});

test('a figure that does not exist becomes a placeholder, not a dangling include', async () => {
  const result = await exportDocument({
    markdown: '![](gone.png)',
    options: { title: 'Doc' },
    readAsset: reader({}),
  });

  // A dangling \includegraphics makes xelatex emit a truncated, unopenable PDF.
  assert.equal(result.latex.includes('\\includegraphics'), false);
  assert.deepEqual(
    result.skipped.map((asset) => [asset.path, asset.reason]),
    [['gone.png', 'missing']],
  );
});

test('a remote figure is reported as a URL LaTeX cannot fetch', async () => {
  const result = await exportDocument({
    markdown: '![](https://example.com/chart.png)',
    options: { title: 'Doc' },
    readAsset: reader({}),
  });

  assert.deepEqual(
    result.skipped.map((asset) => asset.reason),
    ['remote'],
  );
});

test('an un-exported Excalidraw drawing is labelled as such', async () => {
  const result = await exportDocument({
    markdown: '![[sketch.excalidraw]]',
    options: { title: 'Doc' },
    readAsset: reader({}),
  });

  assert.deepEqual(
    result.skipped.map((asset) => asset.path),
    ['sketch.excalidraw.svg'],
  );
  assert.match(result.latex, /Excalidraw/);
});

test('the archive carries the converted figure rather than the SVG', async (t) => {
  if (!(await findSvgConverter())) return t.skip('no SVG converter installed');

  const result = await exportDocument({
    markdown: '![](chart.svg)',
    options: { title: 'Doc' },
    readAsset: reader({ 'chart.svg': SVG }),
    zip: true,
    texName: 'Doc.tex',
  });

  assert.ok(result.zip);
  const names = zipNames(result.zip!);
  assert.deepEqual(names.sort(), ['Doc.tex', 'chart.pdf']);
});

/** Reads the file names out of a zip's local headers. */
function zipNames(zip: Uint8Array): string[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const names: string[] = [];
  for (let offset = 0; offset + 30 <= zip.length; ) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const size = view.getUint32(offset + 18, true);
    names.push(new TextDecoder().decode(zip.subarray(offset + 30, offset + 30 + nameLength)));
    offset += 30 + nameLength + extraLength + size;
  }
  return names;
}
