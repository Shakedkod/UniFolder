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

export * from './types';
export { parseMarkdown, removeMetadata, splitInlineText, parseWikilinkTarget } from './parser/index';
export type { ParseOptions } from './parser/index';
export { adaptBlocks } from './parser/fromMdast';
export {
  LatexFile,
  DEFAULT_FOOTER,
  DEFAULT_LANGUAGE,
  DEFAULT_THEME,
} from './latex/LatexFile';
export { astToLatex, secondPassParse } from './latex/astToLatex';
export { codeblock, genericCodeblock } from './latex/codeblock';
export * from './latex/parts';
export * from './latex/specialBlocks';
export * as constants from './latex/constants';
export { mermaidToTikz } from './diagrams/mermaid';
export { dotToTikz } from './diagrams/dot';
export { desmosGraphToTikz } from './diagrams/desmos';
export * from './util/hebrewDate';
export {
  buildBundle,
  createZip,
  crc32,
  missingBox,
  placeholderForAsset,
  skippedLabel,
  substituteAsset,
} from './bundle/index';
export type {
  AssetReader,
  Bundle,
  BundleOptions,
  CreateZipOptions,
  SkippedAsset,
  ZipEntry,
} from './bundle/index';
export { compileToPdf, canCompilePdf, XelatexError } from './xelatex';
export type { CompileResult } from './xelatex';

import { parseMarkdown, type ParseOptions } from './parser/index';
import { LatexFile } from './latex/LatexFile';
import type { ConvertResult, LatexFileOptions } from './types';

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
