/**
 * Node-side export pipeline for MDtoLatex.
 *
 * `@mdtolatex/core` is deliberately free of Node APIs so one build serves the
 * browser and Obsidian mobile. Everything that genuinely needs a filesystem or a
 * subprocess — reading a vault, rendering SVGs, running xelatex — lives here, and
 * is shared by the CLI and by build-time scripts so the two cannot drift apart.
 */
export { exportDocument, writeExport, texFileName } from './export.js';
export type { ExportRequest, ExportResult, SkippedReport } from './export.js';
export { findSvgConverter, renderSvgAssets, svgConverters, run } from './svg.js';
export type { RenderedSvg, SvgConverter } from './svg.js';
export { canCompilePdf, compileToPdf, texErrors, XelatexError } from './xelatex.js';
export type { CompileResult } from './xelatex.js';
export {
  createVaultAssetReader,
  createVaultIndex,
  createVaultResolver,
  isDirectory,
  resolveLinkpath,
  vaultNotes,
} from './vault.js';
export type { VaultIndex, VaultResolverOptions } from './vault.js';
export { detectLanguage } from './language.js';
