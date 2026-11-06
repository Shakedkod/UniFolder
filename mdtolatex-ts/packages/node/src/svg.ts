/**
 * Rendering SVGs to PDF, because LaTeX cannot read an SVG.
 *
 * `\includesvg` does not draw anything itself: it shells out to **Inkscape** at
 * compile time to produce a PDF and includes that. So it needs shell-escape
 * enabled *and* Inkscape installed, and when either is missing the document
 * still compiles — the figure is simply absent. Converting up front and emitting
 * plain `\includegraphics` keeps vector quality and needs nothing at compile
 * time, so the output works on Overleaf and on any CI image.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AssetReference } from '@mdtolatex/core';

/** An SVG replaced by a PDF rendering of itself. */
export interface RenderedSvg {
  original: AssetReference;
  replacement: AssetReference;
  data: Uint8Array;
}

export interface SvgConverter {
  command: string;
  args: (source: string, output: string) => string[];
}

/** Converters to try, cheapest first. */
export function svgConverters(): SvgConverter[] {
  return [
    { command: 'rsvg-convert', args: (source, out) => ['-f', 'pdf', '-o', out, source] },
    {
      command: 'inkscape',
      args: (source, out) => [source, '--export-type=pdf', `--export-filename=${out}`],
    },
  ];
}

/** The first installed converter, or `null` when the machine has none. */
export async function findSvgConverter(): Promise<SvgConverter | null> {
  for (const converter of svgConverters()) {
    try {
      await run(converter.command, ['--version']);
      return converter;
    } catch {
      // Not installed; try the next one.
    }
  }
  return null;
}

/**
 * Renders every local SVG in `assets` to PDF.
 *
 * `readAsset` supplies the bytes, so this works against a folder, a vault, or
 * anything else. Returns the empty list when no converter is installed; the
 * caller decides whether that is a warning or a hard failure.
 */
export async function renderSvgAssets(
  assets: AssetReference[],
  readAsset: (path: string) => Promise<Uint8Array | null>,
  options: { converter?: SvgConverter | null; onWarning?: (message: string) => void } = {},
): Promise<RenderedSvg[]> {
  const svgs = assets.filter((asset) => asset.kind === 'svg' && !asset.isUrl);
  if (!svgs.length) return [];

  const converter = options.converter === undefined ? await findSvgConverter() : options.converter;
  if (!converter) {
    options.onWarning?.(
      `${svgs.length} SVG file(s) are left as \\includesvg, which needs Inkscape at compile ` +
        'time. Install rsvg-convert or inkscape to embed them as PDF instead.',
    );
    return [];
  }

  // Renderings go to a scratch directory: the source folder belongs to the user
  // and should not collect generated files.
  const scratch = await mkdtemp(join(tmpdir(), 'mdtolatex-svg-'));
  const rendered: RenderedSvg[] = [];
  try {
    for (const [index, asset] of svgs.entries()) {
      const source = await readAsset(asset.path);
      // A file that is simply absent is reported by the caller's unavailable
      // pass; warning here too would double up on every un-exported drawing.
      if (!source) continue;

      const input = join(scratch, `${index}.svg`);
      const output = join(scratch, `${index}.pdf`);
      await writeBytes(input, source);
      try {
        await run(converter.command, converter.args(input, output));
        rendered.push({
          original: asset,
          replacement: { path: `${asset.path.replace(/\.svg$/i, '')}.pdf`, kind: 'image', isUrl: false },
          data: await readFile(output),
        });
      } catch (error) {
        // A malformed or empty SVG: leave the original include in place rather
        // than losing the figure silently.
        options.onWarning?.(
          `could not render "${asset.path}" to PDF: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  return rendered;
}

async function writeBytes(path: string, data: Uint8Array): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path, data);
}

/** Runs a command, rejecting with its stderr so failures explain themselves. */
export function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(stderr.trim() || `${command} exited with ${code}`)),
    );
  });
}
