import type { Node } from '../types';
import { splitInlineText } from './inline';

/** Loose mdast node shape — kept structural so mdast typings stay optional. */
interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  depth?: number;
  ordered?: boolean;
  spread?: boolean;
  checked?: boolean | null;
  start?: number | null;
  lang?: string | null;
  meta?: string | null;
  url?: string;
  title?: string | null;
  alt?: string | null;
  align?: (string | null)[];
  identifier?: string;
  label?: string;
}

/** `[!theorem|*] Optional title` on the first line of a blockquote. */
const CALLOUT_RE = /^[ \t]*\[!([\w-]+)(?:\|([^\]]*))?\][ \t]*([^\n]*)$/;

/** A paragraph that is nothing but an Obsidian block id. */
const LONE_BLOCK_ID_RE = /^\^([0-9a-zA-Z]+)$/;

/** Start of a Hebrew proof block: the bolded opener `**הוכחה:**`. */
const PROOF_OPENER = 'הוכחה:';

/** True when a paragraph opens with a bolded `הוכחה:` run. */
function isProofOpener(node: MdNode): boolean {
  const first = node.children?.[0];
  return first?.type === 'strong' && textOf(first).trim() === PROOF_OPENER;
}

/** Terminator of a proof block, optionally wrapped in inline code. */
const PROOF_END_RE = /`?\\end\{proof\}`?\s*$/;

export interface AdaptOptions {
  /** Treat single newlines inside a paragraph as `\newline` (mistune hard_wrap). */
  hardWrap?: boolean;
}

/** Concatenates the plain text of an mdast subtree (used for marker detection). */
function textOf(node: MdNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

/**
 * Converts an mdast tree (remark-parse + remark-gfm + remark-math) into the
 * mistune-shaped AST the renderer consumes, recovering the Obsidian constructs
 * that plain markdown parsers do not model: callouts, block references,
 * wikilinks/embeds and `**הוכחה:**` proof blocks.
 */
export function adaptBlocks(nodes: MdNode[], options: AdaptOptions = {}): Node[] {
  const hardWrap = options.hardWrap ?? true;
  const result: Node[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    // ---- proof block: marker paragraph .. `\end{proof}` ----------------
    if (node.type === 'paragraph' && isProofOpener(node)) {
      const collected: MdNode[] = [];
      let cursor = index;
      let closed = false;
      while (cursor < nodes.length) {
        const current = nodes[cursor];
        collected.push(current);
        if (PROOF_END_RE.test(textOf(current).trimEnd())) {
          closed = true;
          break;
        }
        cursor += 1;
      }
      if (closed) {
        const body = stripProofMarkers(collected);
        result.push({ type: 'proof', children: adaptBlocks(body, options) });
        index = cursor;
        continue;
      }
      // No terminator found: fall through and render as an ordinary paragraph.
    }

    // ---- blockquote / callout, plus a trailing `^blockid` line ---------
    if (node.type === 'blockquote') {
      const token = adaptBlockquote(node, options);
      const next = nodes[index + 1];
      if (next?.type === 'paragraph') {
        const loneId = LONE_BLOCK_ID_RE.exec(textOf(next).trim());
        if (loneId) {
          token.attrs = { ...(token.attrs ?? {}), block_id: loneId[1] };
          index += 1;
        }
      }
      result.push(token);
      continue;
    }

    const adapted = adaptBlock(node, options, hardWrap);
    if (adapted) result.push(adapted);
  }

  return result;
}

/** Removes the `**הוכחה:**` opener and the `\end{proof}` closer in place. */
function stripProofMarkers(collected: MdNode[]): MdNode[] {
  const clone = collected.map((node) => structuredCloneish(node));
  // Drop the bolded `**הוכחה:**` opener — the proof environment prints its own.
  const first = clone[0];
  if (first.children?.[0]?.type === 'strong') first.children.shift();

  // Drop the `\end{proof}` terminator, plus the soft break that precedes it.
  const last = clone[clone.length - 1];
  const children = last.children ?? [];
  const lastChild = children[children.length - 1];
  if (lastChild?.type === 'inlineCode') children.pop();
  else if (typeof lastChild?.value === 'string') {
    lastChild.value = lastChild.value.replace(PROOF_END_RE, '').trimEnd();
    if (!lastChild.value) children.pop();
  }
  while (children.length > 0 && children[children.length - 1].type === 'break') children.pop();

  return clone.filter((node) => (node.children?.length ?? 0) > 0 || node.value);
}

function structuredCloneish<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function adaptBlockquote(input: MdNode, options: AdaptOptions): Node {
  // Cloned because the marker line is stripped in place below.
  const node = structuredCloneish(input);
  const children = [...(node.children ?? [])];
  const first = children[0];

  if (first?.type === 'paragraph') {
    const leadText = first.children?.[0];
    const firstLine = (leadText?.value ?? '').split('\n')[0];
    const callout = CALLOUT_RE.exec(firstLine);
    if (callout) {
      const [, calloutType, modifier, title] = callout;

      // Drop only the marker line, keeping the rest of the paragraph's inline
      // structure intact — re-stringifying it here would lose the math, bold
      // and links that follow on the next lines.
      const newlineIndex = (leadText?.value ?? '').indexOf('\n');
      if (newlineIndex === -1) {
        first.children!.shift();
        if ((first.children?.length ?? 0) === 0) children.shift();
      } else {
        leadText!.value = leadText!.value!.slice(newlineIndex + 1);
      }

      // A hard break at the end of the marker line would render as a stray
      // `\newline` at the top of the environment.
      while (first.children?.[0]?.type === 'break') first.children.shift();

      return {
        type: 'callout',
        children: adaptBlocks(children, options),
        attrs: {
          callout_type: calloutType,
          numbered: modifier !== '*',
          title: (title ?? '').trim(),
        },
      };
    }
  }

  return { type: 'block_quote', children: adaptBlocks(children, options) };
}

function adaptBlock(node: MdNode, options: AdaptOptions, hardWrap: boolean): Node | null {
  switch (node.type) {
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: node.depth ?? 1 },
        children: adaptInline(node.children ?? [], hardWrap),
      };

    case 'paragraph':
      return { type: 'paragraph', children: adaptInline(node.children ?? [], hardWrap) };

    case 'thematicBreak':
      return { type: 'thematic_break' };

    case 'code':
      return {
        type: 'block_code',
        raw: node.value ?? '',
        attrs: { info: [node.lang, node.meta].filter(Boolean).join(' ') },
      };

    case 'math':
      return { type: 'block_math', raw: node.value ?? '' };

    case 'list':
      return {
        type: 'list',
        attrs: {
          ordered: Boolean(node.ordered),
          start: node.start ?? 1,
          tight: !node.spread,
        },
        children: (node.children ?? []).map((item) => ({
          type: 'list_item',
          attrs: item.checked === null || item.checked === undefined
            ? {}
            : { checked: item.checked },
          children: adaptBlocks(item.children ?? [], options),
        })),
      };

    case 'table':
      return adaptTable(node, hardWrap);

    case 'html':
      return adaptRawHtml(node.value ?? '');

    case 'footnoteDefinition':
      return {
        type: 'footnote_definition',
        attrs: { identifier: node.identifier ?? '' },
        children: adaptBlocks(node.children ?? [], options),
      };

    case 'definition':
      return null; // link reference definitions produce no output

    default:
      return {
        type: node.type,
        raw: node.value,
        children: node.children ? adaptBlocks(node.children, options) : undefined,
      };
  }
}

/** Recognizes a bare `<img>`/`<svg>` block; anything else is passed through. */
function adaptRawHtml(value: string): Node {
  const img = /<img[^>]*src=["']([^"']+)["']/i.exec(value);
  if (img) return { type: 'image', attrs: { src: img[1] } };
  const svg = /<(?:embed|object|img)[^>]*(?:src|data)=["']([^"']+\.svg)["']/i.exec(value);
  if (svg) return { type: 'svg', attrs: { src: svg[1] } };
  return { type: 'block_html', raw: value };
}

function adaptTable(node: MdNode, hardWrap: boolean): Node {
  const align = (node.align ?? []).map((value) => value ?? 'left');
  const rows = node.children ?? [];

  const buildRow = (row: MdNode): Node => ({
    type: 'table_row',
    children: (row.children ?? []).map((cell, columnIndex) => ({
      type: 'table_cell',
      attrs: { align: align[columnIndex] ?? 'left' },
      children: adaptInline(cell.children ?? [], hardWrap),
    })),
  });

  const children: Node[] = [];
  if (rows.length > 0) {
    children.push({ type: 'table_head', children: [buildRow(rows[0])] });
  }
  if (rows.length > 1) {
    children.push({ type: 'table_body', children: rows.slice(1).map(buildRow) });
  }
  return { type: 'table', children };
}

function adaptInline(nodes: MdNode[], hardWrap: boolean): Node[] {
  const result: Node[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        result.push(...splitInlineText(node.value ?? '', hardWrap));
        break;

      case 'strong':
        result.push({ type: 'strong', children: adaptInline(node.children ?? [], hardWrap) });
        break;

      case 'emphasis':
        result.push({ type: 'emphasis', children: adaptInline(node.children ?? [], hardWrap) });
        break;

      case 'delete':
        result.push({ type: 'strikethrough', children: adaptInline(node.children ?? [], hardWrap) });
        break;

      case 'inlineCode':
        result.push({ type: 'codespan', raw: node.value ?? '' });
        break;

      case 'inlineMath':
        result.push({ type: 'inline_math', raw: node.value ?? '' });
        break;

      case 'break':
        result.push({ type: 'linebreak' });
        break;

      case 'link':
      case 'linkReference':
        result.push({
          type: 'link',
          attrs: { href: node.url ?? '', title: node.title ?? null },
          children: adaptInline(node.children ?? [], hardWrap),
        });
        break;

      case 'image':
        result.push({
          // An Excalidraw drawing is a `.md` file, but it compiles from the SVG
          // exported beside it — so it renders through the SVG path too.
          type: /\.(svg|excalidraw\.md)$/i.test(node.url ?? '') ? 'svg' : 'image',
          raw: node.alt ?? '',
          attrs: { src: node.url ?? '', alt: node.alt ?? '' },
        });
        break;

      case 'footnoteReference':
        result.push({ type: 'footnote_ref', attrs: { identifier: node.identifier ?? '' } });
        break;

      case 'html':
        result.push({ type: 'inline_html', raw: node.value ?? '' });
        break;

      default:
        result.push({
          type: node.type,
          raw: node.value,
          children: node.children ? adaptInline(node.children, hardWrap) : undefined,
        });
    }
  }

  return result;
}
