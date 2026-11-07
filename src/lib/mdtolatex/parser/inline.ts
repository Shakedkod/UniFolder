import type { Node } from '../types';

/** `[[target]]`, `[[target|alias]]`, `![[target]]`, `![[target|alias]]`. */
const WIKILINK_RE = /(!)?\[\[([^[\]]+)\]\]/g;

/** A trailing Obsidian block id, e.g. `^abc123` at the end of a line. */
const BLOCK_ID_RE = /(?:^|(?<=\s))\^([0-9a-zA-Z]+)[ \t]*$/;

export interface WikilinkTarget {
  link: string;
  heading: string | null;
  block_ref: string | null;
  alias: string | null;
}

/** Splits `note#heading^blockid|alias` into its parts. */
export function parseWikilinkTarget(inner: string): WikilinkTarget {
  let target = inner;
  let alias: string | null = null;
  const pipe = inner.indexOf('|');
  if (pipe !== -1) {
    target = inner.slice(0, pipe);
    alias = inner.slice(pipe + 1);
  }

  let link = target;
  let heading: string | null = null;
  let blockRef: string | null = null;

  const hash = link.indexOf('#');
  if (hash !== -1) {
    const rest = link.slice(hash + 1);
    link = link.slice(0, hash);
    const caret = rest.indexOf('^');
    if (caret !== -1) {
      heading = rest.slice(0, caret);
      blockRef = rest.slice(caret + 1);
    } else {
      heading = rest;
    }
  } else {
    const caret = link.indexOf('^');
    if (caret !== -1) {
      blockRef = link.slice(caret + 1);
      link = link.slice(0, caret);
    }
  }

  return { link, heading, block_ref: blockRef, alias };
}

/**
 * Turns a raw markdown text run into inline tokens, extracting the
 * Obsidian-specific syntax that standard markdown parsers leave as plain text:
 * wikilinks, embeds and trailing block ids. With `hardWrap`, single newlines
 * become explicit `linebreak` tokens (matching the original `hard_wrap=True`).
 */
export function splitInlineText(value: string, hardWrap = true): Node[] {
  const tokens: Node[] = [];

  const pushText = (text: string): void => {
    if (!text) return;
    if (!hardWrap) {
      tokens.push({ type: 'text', raw: text });
      return;
    }
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (index > 0) tokens.push({ type: 'linebreak' });
      const blockId = BLOCK_ID_RE.exec(line);
      if (blockId) {
        const before = line.slice(0, blockId.index);
        if (before) tokens.push({ type: 'text', raw: before });
        tokens.push({ type: 'block_id', raw: blockId[1] });
        return;
      }
      if (line) tokens.push({ type: 'text', raw: line });
    });
  };

  let lastIndex = 0;
  WIKILINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_RE.exec(value)) !== null) {
    pushText(value.slice(lastIndex, match.index));
    const [, bang, inner] = match;
    const attrs = parseWikilinkTarget(inner);
    tokens.push({
      type: bang ? 'wiki_embed' : 'wiki_link',
      raw: attrs.alias ?? inner,
      attrs: { ...attrs },
    });
    lastIndex = match.index + match[0].length;
  }
  pushText(value.slice(lastIndex));

  return tokens;
}
