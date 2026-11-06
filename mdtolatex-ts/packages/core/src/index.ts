/**
 * @mdtolatex/core — Obsidian-flavored Markdown to LaTeX, in TypeScript.
 *
 * Pure ESM with no Node-only APIs, so the same build runs in a Next.js route or
 * client component and inside an Obsidian plugin.
 *
 * ```ts
 * import { convert } from '@mdtolatex/core';
 * const { latex } = convert(markdown, { title: 'Notes', language: 'hebrew' });
 * ```
 */

export * from './types.js';
export { parseMarkdown, removeMetadata, splitInlineText, parseWikilinkTarget } from './parser/index.js';
export type { ParseOptions } from './parser/index.js';
export { adaptBlocks } from './parser/fromMdast.js';
export {
  LatexFile,
  DEFAULT_FOOTER,
  DEFAULT_LANGUAGE,
  DEFAULT_THEME,
} from './latex/LatexFile.js';
export { astToLatex, secondPassParse } from './latex/astToLatex.js';
export { codeblock, genericCodeblock } from './latex/codeblock.js';
export * from './latex/parts.js';
export * from './latex/specialBlocks.js';
export * as constants from './latex/constants.js';
export { mermaidToTikz } from './diagrams/mermaid.js';
export { dotToTikz } from './diagrams/dot.js';
export { desmosGraphToTikz } from './diagrams/desmos.js';
export * from './util/hebrewDate.js';
export {
  buildBundle,
  createZip,
  crc32,
  missingBox,
  placeholderForAsset,
  skippedLabel,
  substituteAsset,
} from './bundle/index.js';
export type {
  AssetReader,
  Bundle,
  BundleOptions,
  CreateZipOptions,
  SkippedAsset,
  ZipEntry,
} from './bundle/index.js';

import { parseMarkdown, type ParseOptions } from './parser/index.js';
import { LatexFile } from './latex/LatexFile.js';
import type { ConvertResult, LatexFileOptions } from './types.js';

export interface ConvertOptions extends LatexFileOptions, ParseOptions {}

/**
 * One-shot conversion: markdown source in, complete `.tex` document out.
 *
 * Leading YAML front matter is stripped by default. Pass
 * `removeMetadata: false` to keep it.
 */
export function convert(markdown: string, options: ConvertOptions = {}): ConvertResult {
  const ast = parseMarkdown(markdown, options);
  const file = new LatexFile(options);
  file.mdToLatex(ast);
  return { latex: file.build(), head: file.head, warnings: file.warnings, assets: file.assets };
}
