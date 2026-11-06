import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { math } from 'micromark-extension-math';
import { mathFromMarkdown } from 'mdast-util-math';

import type { Node } from '../types.js';
import { adaptBlocks, type AdaptOptions } from './fromMdast.js';

export { splitInlineText, parseWikilinkTarget } from './inline.js';
export { adaptBlocks } from './fromMdast.js';

export interface ParseOptions extends AdaptOptions {
  /** Strip a leading YAML front-matter block (Obsidian properties). */
  removeMetadata?: boolean;
}

const FRONTMATTER_RE = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/** Removes a leading YAML front-matter block from the markdown source. */
export function removeMetadata(markdown: string): string {
  return markdown.replace(FRONTMATTER_RE, '');
}

/**
 * Parses Obsidian-flavored markdown into the converter's AST.
 *
 * The markdown front-end is micromark/mdast with GFM (tables, task lists,
 * strikethrough, autolinks) and `$...$` / `$$...$$` math enabled; Obsidian's own
 * syntax (wikilinks, embeds, block ids, callouts, proof blocks) is recovered in
 * the adapter layer.
 */
export function parseMarkdown(markdown: string, options: ParseOptions = {}): Node[] {
  // Normalize line endings first: with `hardWrap` every newline becomes a
  // `\newline`, so a stray CR would otherwise leak into the LaTeX output.
  const normalized = markdown.replace(/\r\n?/g, '\n');
  const source = options.removeMetadata === false ? normalized : removeMetadata(normalized);

  const tree = fromMarkdown(source, {
    extensions: [gfm(), math({ singleDollarTextMath: true })],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  }) as unknown as { children: Parameters<typeof adaptBlocks>[0] };

  return adaptBlocks(tree.children, { hardWrap: options.hardWrap ?? true });
}
