/**
 * Turns a conversion result into a self-contained `.zip`.
 *
 * Reading files is the one thing this cannot do itself — the CLI reads from
 * disk, the plugin from Obsidian's vault API, a web app from an upload — so the
 * caller supplies a reader and everything else is shared.
 */
import type { AssetKind, AssetReference } from '../types.js';
import { createZip, type ZipEntry } from './zip.js';

export { createZip, crc32 } from './zip.js';
export type { ZipEntry, CreateZipOptions } from './zip.js';

/** Reads one asset. Return `null` when the file does not exist. */
export type AssetReader = (path: string) => Promise<Uint8Array | null> | Uint8Array | null;

export interface BundleOptions {
  /** The `.tex` source. */
  latex: string;
  /** `result.assets` from `convert()`. */
  assets: AssetReference[];
  /** File name for the `.tex` inside the archive, e.g. `Calculus.tex`. */
  texName: string;
  /** Supplies the bytes for each asset path. */
  readAsset: AssetReader;
  /** Timestamp for every entry. Fix it for byte-reproducible archives. */
  date?: Date;
  /**
   * Called for each asset that cannot be bundled. Return replacement LaTeX for
   * its include, or `null`/`undefined` to leave the include untouched.
   *
   * Leaving it in place means the document references a file the archive does not
   * contain, which makes xelatex's PDF driver fail, so supplying
   * {@link placeholderForAsset} here is usually what you want.
   */
  onSkipped?: (asset: AssetReference, reason: SkippedAsset['reason']) => string | null | undefined;
}

/** An asset that could not be included, and why. */
export interface SkippedAsset {
  path: string;
  reason: 'missing' | 'remote' | 'unreadable';
  /** The underlying error message, when reading threw. */
  detail?: string;
}

export interface Bundle {
  /** The finished archive. */
  zip: Uint8Array;
  /** Asset paths written into the archive, as they appear inside it. */
  included: string[];
  skipped: SkippedAsset[];
  /**
   * The `.tex` actually placed in the archive. Identical to the input unless an
   * asset had to be relocated, which also rewrites its include path.
   */
  latex: string;
}

/**
 * Points an include at a different file, switching the command when the format
 * changes.
 *
 * The main use is replacing an SVG with a PDF rendering of it: `\includesvg`
 * needs Inkscape installed at compile time, which neither a Vercel build nor
 * Obsidian on a phone has, while `\includegraphics` of a PDF needs nothing.
 */
export function substituteAsset(
  latex: string,
  from: AssetReference,
  to: { path: string; kind: AssetKind },
): string {
  const fromCommand = from.kind === 'svg' ? 'includesvg' : 'includegraphics';
  const toCommand = to.kind === 'svg' ? 'includesvg' : 'includegraphics';
  // Matches `\includesvg[width=...]{path}` for this exact path, keeping the
  // options untouched so the figure keeps its size.
  const pattern = new RegExp(
    `\\\\${fromCommand}(\\[[^\\]]*\\])?\\{${escapeRegExp(from.path)}\\}`,
    'g',
  );
  return latex.replace(
    pattern,
    (_match, options: string | undefined) => `\\${toCommand}${options ?? ''}{${to.path}}`,
  );
}

/**
 * Swaps an include for a visible "missing file" box.
 *
 * A figure the document references but cannot supply makes xelatex's PDF driver
 * fail outright and emit a truncated, unopenable file — so one un-exported
 * drawing would otherwise cost the whole export. A placeholder keeps the export
 * working and says on the page exactly which file to add.
 */
export function placeholderForAsset(latex: string, asset: AssetReference, label: string): string {
  return replaceInclude(latex, asset, missingBox(asset, label));
}

/**
 * Wording for the placeholder left in place of a figure that could not be
 * bundled — shared so every host says the same thing.
 *
 * An Excalidraw drawing gets its own line, because its absence almost always
 * means one specific, fixable thing: the vault has the `.excalidraw.md` scene
 * but the plugin was never told to export an SVG beside it.
 */
export function skippedLabel(asset: AssetReference, reason: SkippedAsset['reason']): string {
  if (reason === 'remote') return 'Remote figure not bundled';
  if (/\.excalidraw\.svg$/i.test(asset.path)) return 'Excalidraw drawing not exported to SVG';
  return reason === 'unreadable' ? 'Figure could not be read' : 'Missing figure';
}

/**
 * The LaTeX for a "this file is absent" box.
 *
 * `\detokenize` prints the path verbatim, so underscores or percent signs in a
 * filename cannot break the document.
 */
export function missingBox(asset: AssetReference, label: string): string {
  return (
    `\\fbox{\\parbox{0.8\\textwidth}{\\centering\\small ${label}\\\\` +
    `\\texttt{\\detokenize{${asset.path}}}}}`
  );
}

/** Replaces an asset's include command, options and all, with arbitrary LaTeX. */
function replaceInclude(latex: string, asset: AssetReference, replacement: string): string {
  const command = asset.kind === 'svg' ? 'includesvg' : 'includegraphics';
  const pattern = new RegExp(
    `\\\\${command}(\\[[^\\]]*\\])?\\{${escapeRegExp(asset.path)}\\}`,
    'g',
  );
  return latex.replace(pattern, () => replacement);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A path is usable inside the archive only if it stays underneath the root.
 * `../shared/x.png` and `/home/me/x.png` both point outside it.
 */
function isContainedPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return false;
  return !normalized.split('/').includes('..');
}

const basename = (path: string): string => path.replace(/\\/g, '/').split('/').pop() || 'asset';

/**
 * Builds the archive: the `.tex` at the root, with every asset kept at the same
 * relative path the document references, so `\includegraphics` resolves with no
 * extra `\graphicspath` and no edits.
 */
export async function buildBundle(options: BundleOptions): Promise<Bundle> {
  const { assets, texName, readAsset, date } = options;
  let latex = options.latex;

  const entries: ZipEntry[] = [];
  const included: string[] = [];
  const skipped: SkippedAsset[] = [];
  const taken = new Set<string>([texName]);

  /** Records a skip and lets the caller patch the now-dangling include. */
  const skip = (asset: AssetReference, reason: SkippedAsset['reason'], detail?: string): void => {
    skipped.push(detail ? { path: asset.path, reason, detail } : { path: asset.path, reason });
    const replacement = options.onSkipped?.(asset, reason);
    if (replacement) latex = replaceInclude(latex, asset, replacement);
  };

  for (const asset of assets) {
    if (asset.isUrl) {
      // A remote figure is fetched by whoever compiles the document, not by us;
      // bundling it would mean making network requests from the converter.
      skip(asset, 'remote');
      continue;
    }

    let data: Uint8Array | null;
    try {
      data = await readAsset(asset.path);
    } catch (error) {
      skip(asset, 'unreadable', error instanceof Error ? error.message : String(error));
      continue;
    }

    if (!data) {
      // Usually an Excalidraw drawing that was never exported to SVG, or an
      // attachment that has been renamed since the note last linked it.
      skip(asset, 'missing');
      continue;
    }

    let entryPath = asset.path.replace(/\\/g, '/');
    if (!isContainedPath(entryPath)) {
      // The file lives outside the bundle root, so it has to move — and the
      // document has to be told where it went.
      entryPath = uniquePath(`figures/${basename(entryPath)}`, taken);
      latex = replaceIncludePath(latex, asset.path, entryPath);
    }

    if (taken.has(entryPath)) continue; // already bundled under this name
    taken.add(entryPath);
    entries.push({ path: entryPath, data, date });
    included.push(entryPath);
  }

  const zip = createZip(
    [{ path: texName, data: new TextEncoder().encode(latex), date }, ...entries],
    { date },
  );

  return { zip, included, skipped, latex };
}

function uniquePath(path: string, taken: Set<string>): string {
  if (!taken.has(path)) return path;
  const dot = path.lastIndexOf('.');
  const stem = dot > 0 ? path.slice(0, dot) : path;
  const extension = dot > 0 ? path.slice(dot) : '';
  for (let index = 2; ; index += 1) {
    const candidate = `${stem}-${index}${extension}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Repoints an include at a relocated file.
 *
 * Only the exact `{<path>}` argument is replaced, so a path that also happens to
 * appear in prose or a listing is left alone.
 */
function replaceIncludePath(latex: string, from: string, to: string): string {
  return latex.split(`{${from}}`).join(`{${to}}`);
}
