import type { Node } from '../types.js';
import { codeblock } from './codeblock.js';
import {
  blankLine,
  getHeader,
  getText,
  mathBlock,
  parseList,
  setBlockRenderer,
  table,
  thematicBreak,
  type RenderContext,
} from './parts.js';
import { callout, quote, type CalloutAttrs } from './specialBlocks.js';
import { splitInlineText } from '../parser/inline.js';

/**
 * Renders a callout title, which arrives as raw markdown text.
 *
 * Titles routinely contain wikilinks (`[!remark] see [[Integrals|the theorem]]`)
 * and inline math, and they land in an optional argument — so the brackets of an
 * unrendered wikilink would terminate the argument early.
 */
function renderCalloutTitle(title: string, context: RenderContext): string {
  if (!title) return '';
  const rendered = getText(splitInlineText(title, false), context).trim();
  return /[[\]]/.test(rendered) ? `{${rendered}}` : rendered;
}

/** Renders a list of block-level AST nodes to LaTeX. */
export function astToLatex(ast: Node[], context: RenderContext): string {
  let result = '';

  for (const node of ast) {
    // A paragraph does not end with a newline, so whatever follows it would still
    // be in horizontal mode — which `\part`/`\section` reject outright, and which
    // runs two consecutive paragraphs into one. Only a blank line (i.e. `\par`)
    // ends a paragraph; a single newline is just whitespace to TeX.
    if (result && !result.endsWith('\n')) result += '\n\n';

    switch (node.type) {
      case 'heading':
        result += getHeader(node, context);
        break;

      case 'paragraph':
        result += getText(node.children ?? [], context) + blankLine();
        break;

      case 'table':
        result += table(node, context) + blankLine();
        break;

      case 'list':
        result += parseList(node, context) + blankLine();
        break;

      case 'blank_line':
        result += blankLine();
        break;

      case 'thematic_break':
        result += thematicBreak();
        break;

      case 'block_code':
        result += codeblock(node, context);
        break;

      case 'block_quote':
        result += quote(
          astToLatex(node.children ?? [], context),
          'quote',
          String(node.attrs?.block_id ?? ''),
        );
        break;

      case 'callout': {
        const attrs = { ...((node.attrs ?? {}) as CalloutAttrs) };
        attrs.title = renderCalloutTitle(attrs.title ?? '', context);
        result += callout(astToLatex(node.children ?? [], context), attrs);
        break;
      }

      case 'proof': {
        // Trim the whitespace and stray `\newline`s left by the markers, so the
        // proof body starts on the same line the environment opens.
        const body = trimBreaks(astToLatex(node.children ?? [], context));
        result += `\\begin{proof}\n${body}\n\\end{proof}\n`;
        break;
      }

      case 'block_math':
        result += mathBlock(node.raw ?? '') + blankLine();
        break;

      case 'footnote_definition':
        result += `\\footnotetext[${String(node.attrs?.identifier ?? '')}]{${astToLatex(
          node.children ?? [],
          context,
        ).trim()}}\n`;
        break;

      case 'block_html':
        break; // raw HTML blocks have no LaTeX equivalent

      case 'image':
      case 'svg':
      case 'wiki_embed':
        result += getText([node], context);
        break;

      default:
        context.warnings.push(node.type);
        if (node.children) result += astToLatex(node.children, context);
    }
  }

  return result;
}

// List items can contain any block content, so `parts.ts` renders their bodies
// through this module. Wiring it here keeps the two files free of a cycle.
setBlockRenderer(astToLatex);

const EDGE_BREAKS_RE = /^(?:\s|\\newline\{\})+|(?:\s|\\newline\{\})+$/g;

/** Strips leading/trailing whitespace and `\newline{}` runs from a body. */
export function trimBreaks(text: string): string {
  return text.replace(EDGE_BREAKS_RE, '');
}

/**
 * Second pass over generated LaTeX, converting any `$...$` / `$$...$$` that
 * survived the markdown parser (for example inside a table cell) into
 * `\(...\)` / `\[...\]`.
 */
export function secondPassParse(latexContent: string): string {
  let content = latexContent.replace(/\$\$\n([\s\S]*?)\n\$\$/g, '\\[$1\\]');
  content = content.replace(/\$([\s\S]*?)\$/g, '\\($1\\)');
  return content;
}
