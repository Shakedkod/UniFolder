/**
 * The whole Node-side export, in one function.
 *
 * Converting a note to a `.tex` that actually compiles is more than calling
 * `convert()`: the SVGs have to become PDFs, the figures it cannot supply have
 * to become placeholder boxes, and the files have to end up where the document
 * references them. Getting one of those wrong is silent — the document still
 * compiles, just without the figure — which is exactly why this lives in one
 * place instead of being written out again per front-end.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  buildBundle,
  convert,
  missingBox,
  placeholderForAsset,
  skippedLabel,
  substituteAsset,
  type AssetReference,
  type ConvertOptions,
} from '@mdtolatex/core';
import { renderSvgAssets, type SvgConverter } from './svg.js';
import { compileToPdf, XelatexError } from './xelatex.js';

export interface SkippedReport {
  path: string;
  reason: 'missing' | 'remote' | 'unreadable';
  detail?: string;
}

export interface ExportRequest {
  /** The note's markdown. */
  markdown: string;
  /** Title, author, language, theme, toc — passed straight to the converter. */
  options: ConvertOptions;
  /**
   * Supplies the bytes for an asset path, or `null` when it does not exist.
   * Defaults to reading from `assetRoot`.
   */
  readAsset?: (path: string) => Promise<Uint8Array | null>;
  /** Folder to read assets from, when `readAsset` is not given. */
  assetRoot?: string;
  /** Emit `\includesvg` instead of converting. Only for machines with Inkscape. */
  keepSvg?: boolean;
  /** Also produce a `.zip` of the document and its figures. */
  zip?: boolean;
  /** Also compile a PDF. */
  pdf?: boolean;
  /** Name for the `.tex` inside the archive. Defaults to the title. */
  texName?: string;
  /** A converter to reuse across many notes; looked up per call when omitted. */
  converter?: SvgConverter | null;
  onWarning?: (message: string) => void;
}

export interface ExportResult {
  /** The document, with SVG includes rewritten and gaps filled. */
  latex: string;
  /** The assets it references, after SVG substitution. */
  assets: AssetReference[];
  /** Markdown node types the converter could not render. */
  warnings: string[];
  /** Figures that could not be supplied, and are now placeholder boxes. */
  skipped: SkippedReport[];
  /**
   * Figures generated during the export, keyed by the path the document
   * references them by. These exist nowhere else, so they must be written
   * alongside the `.tex`.
   */
  generated: Map<string, Uint8Array>;
  zip?: Uint8Array;
  pdf?: Uint8Array;
  /** LaTeX errors the PDF compiled despite. */
  pdfErrors?: string[];
}

/**
 * Converts one note and returns everything needed to write it out.
 *
 * Writes nothing itself — see {@link writeExport}. That split is what lets a
 * static-site build pipe the results into `public/` while the CLI writes them
 * next to the note.
 */
export async function exportDocument(request: ExportRequest): Promise<ExportResult> {
  const readAsset =
    request.readAsset ??
    (async (path: string) => {
      if (!request.assetRoot) return null;
      return readFile(join(request.assetRoot, path)).catch(() => null);
    });

  const { latex, warnings, assets } = convert(request.markdown, request.options);

  let docLatex = latex;
  let docAssets = assets;
  const generated = new Map<string, Uint8Array>();

  if (!request.keepSvg) {
    const rendered = await renderSvgAssets(assets, readAsset, {
      converter: request.converter,
      onWarning: request.onWarning,
    });
    for (const { original, replacement, data } of rendered) {
      docLatex = substituteAsset(docLatex, original, replacement);
      generated.set(replacement.path, data);
    }
    if (rendered.length) {
      docAssets = assets.map(
        (asset) => rendered.find((item) => item.original.path === asset.path)?.replacement ?? asset,
      );
    }
  }

  // A dangling \includegraphics does not just leave a gap: xelatex's PDF driver
  // fails and emits a truncated, unopenable file, so one un-exported drawing
  // costs the whole document. Anything that cannot be supplied becomes a
  // labelled box instead.
  const skipped: SkippedReport[] = [];
  for (const asset of docAssets) {
    if (generated.has(asset.path)) continue;
    const reason = asset.isUrl ? 'remote' : (await readAsset(asset.path)) ? null : 'missing';
    if (!reason) continue;
    docLatex = placeholderForAsset(docLatex, asset, skippedLabel(asset, reason));
    skipped.push({ path: asset.path, reason });
  }

  const result: ExportResult = { latex: docLatex, assets: docAssets, warnings, skipped, generated };
  if (!request.zip && !request.pdf) return result;

  const texName = request.texName ?? texFileName(request.options.title);
  const bundle = await buildBundle({
    latex: docLatex,
    assets: docAssets,
    texName,
    readAsset: async (path) => generated.get(path) ?? (await readAsset(path)),
    onSkipped: (asset, reason) => missingBox(asset, skippedLabel(asset, reason)),
  });

  const reported = new Set(skipped.map((asset) => asset.path));
  for (const asset of bundle.skipped) {
    if (!reported.has(asset.path)) skipped.push(asset as SkippedReport);
  }

  if (request.zip) result.zip = bundle.zip;

  if (request.pdf) {
    const files = new Map<string, Uint8Array | string>([[texName, bundle.latex]]);
    for (const path of bundle.included) {
      const data = generated.get(path) ?? (await readAsset(path));
      if (data) files.set(path, data);
    }
    try {
      const compiled = await compileToPdf(files, texName);
      result.pdf = compiled.pdf;
      result.pdfErrors = compiled.errors;
    } catch (error) {
      // One note failing to compile should not take a whole vault build down,
      // so this is reported and the .tex is still returned.
      if (!(error instanceof XelatexError)) throw error;
      request.onWarning?.([error.message, ...error.errors].join('\n  '));
    }
  }

  return result;
}

/**
 * Writes an export to `outDir` as `<stem>.tex` plus its generated figures, and
 * the `.zip` / `.pdf` when they were produced.
 *
 * The generated figures keep the relative path the document references, so the
 * `.tex` compiles where it lands.
 */
export async function writeExport(
  result: ExportResult,
  outDir: string,
  stem: string,
): Promise<{ tex: string; zip?: string; pdf?: string; figures: string[] }> {
  await mkdir(outDir, { recursive: true });
  const tex = join(outDir, `${stem}.tex`);
  await writeFile(tex, result.latex, 'utf8');

  const figures: string[] = [];
  for (const [path, data] of result.generated) {
    const target = join(outDir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    figures.push(target);
  }

  const written: { tex: string; zip?: string; pdf?: string; figures: string[] } = { tex, figures };
  if (result.zip) {
    written.zip = join(outDir, `${stem}.zip`);
    await writeFile(written.zip, result.zip);
  }
  if (result.pdf) {
    written.pdf = join(outDir, `${stem}.pdf`);
    await writeFile(written.pdf, result.pdf);
  }
  return written;
}

/** A safe `.tex` name for a document title. */
export function texFileName(title: string | undefined): string {
  const stem = (title ?? 'document').replace(/[\\/:*?"<>|]/g, '-').trim() || 'document';
  return `${stem}.tex`;
}
