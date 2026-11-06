import type {
  AssetKind,
  AssetReference,
  Head,
  Node,
  ResolvedWikiLink,
  WikiLinkRequest,
  WikiLinkResolver,
} from '../types.js';
import {
  buildVaultUrl,
  DEFAULT_VAULT_BASE_URL,
  href as hrefLink,
  isAbsoluteUrl,
  selfRef,
} from './specialBlocks.js';

export interface RenderContext {
  head: Head;
  /** Base URL for wikilinks that point outside the document. */
  vaultBaseUrl: string;
  /** Host-supplied translation of Obsidian link targets, if any. */
  resolveWikiLink?: WikiLinkResolver;
  /** Unhandled node types collected during the render. */
  warnings: string[];
  /** Every image/SVG the document includes, in first-appearance order. */
  assets: AssetReference[];
}

export function createContext(
  head: Head,
  vaultBaseUrl = DEFAULT_VAULT_BASE_URL,
  resolveWikiLink?: WikiLinkResolver,
): RenderContext {
  return { head, vaultBaseUrl, resolveWikiLink, warnings: [], assets: [] };
}

/**
 * Notes a file the document depends on, so a host can ship it with the `.tex`.
 *
 * The same drawing is often embedded more than once; recording it once keeps the
 * bundle from carrying duplicate copies.
 */
function recordAsset(context: RenderContext, path: string, kind: AssetKind): void {
  if (!path) return;
  if (context.assets.some((asset) => asset.path === path)) return;
  context.assets.push({ path, kind, isUrl: isAbsoluteUrl(path) });
}

/** Runs the host resolver, swallowing its errors so one bad link cannot fail a document. */
function resolve(
  request: WikiLinkRequest,
  context: RenderContext,
): ResolvedWikiLink | undefined {
  if (!context.resolveWikiLink) return undefined;
  try {
    return context.resolveWikiLink(request) ?? undefined;
  } catch (error) {
    context.warnings.push(
      `resolveWikiLink threw for "${request.target}": ${(error as Error).message}`,
    );
    return undefined;
  }
}

/** Extensions LaTeX includes with `\includegraphics` rather than `\includesvg`. */
const RASTER_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|pdf|eps)$/i;

/**
 * Obsidian keeps an Excalidraw drawing as a Markdown file — `sketch.excalidraw.md`
 * — with the scene JSON inside it. That file is not an image and LaTeX can do
 * nothing with it; what compiles is the `.svg` the Excalidraw plugin exports
 * beside it (Settings → "Auto-export SVG").
 */
const EXCALIDRAW_SOURCE = /\.excalidraw\.md$/i;

/** Points an Excalidraw embed at the exported SVG instead of the drawing file. */
export function excalidrawSvg(path: string): string {
  return path.replace(EXCALIDRAW_SOURCE, '.excalidraw.svg');
}

/** Classifies a `![[embed]]` target by what its name says it is. */
function embedKind(link: string): 'svg' | 'raster' | 'drawing' {
  if (/\.svg$/i.test(link) || EXCALIDRAW_SOURCE.test(link)) return 'svg';
  if (RASTER_EXTENSIONS.test(link)) return 'raster';
  return 'drawing';
}

function linkRequest(child: Node, kind: 'link' | 'embed'): WikiLinkRequest {
  const target = String(child.attrs?.link ?? '');
  const heading = String(child.attrs?.heading ?? '');
  const blockRef = String(child.attrs?.block_ref ?? '');
  const alias = child.attrs?.alias == null ? '' : String(child.attrs.alias);
  // Prefer the alias, then the note name; the raw `note#^id` form makes poor
  // link text, so the anchor is only used when there is nothing else.
  const text = alias || target || heading || blockRef;
  return { target, heading, blockRef, alias, text, kind };
}

// ---------------------------------------------------------------- headings

export const h1 = (title: string): string => `\\part{${title}}\n`;
export const h2 = (title: string): string => `\\section{${title}}\n`;
export const h3 = (title: string): string => `\\subsection{${title}}\n`;
export const h4 = (title: string): string => `\\subsubsection{${title}}\n`;
export const h5 = (title: string): string => `\\paragraph{${title}}\n`;
export const h6 = (title: string): string => `\\subparagraph{${title}}\n`;

const HEADING_LEVELS = [h1, h2, h3, h4, h5, h6];

export function getHeader(header: Node, context: RenderContext): string {
  const level = Number((header.attrs?.level as number | undefined) ?? 1);
  const title = getText(header.children ?? [], context);
  const emit = HEADING_LEVELS[Math.min(Math.max(level, 1), 6) - 1];
  return emit(title);
}

// ------------------------------------------------------------ inline marks

export const bold = (text: string): string => `\\textbf{${text}}`;
export const emph = (text: string): string => `\\emph{${text}}`;
export const underline = (text: string): string => `\\underline{${text}}`;
export const strikethrough = (text: string): string => `\\sout{${text}}`;
export const codespan = (text: string): string => `\\texttt{${escapeLatex(text)}}`;
export const newline = (): string => '\\newline{}\n';
export const thematicBreak = (): string => '\\hrulefill\n';

/** Kept as a no-op to match the original renderer's spacing behavior. */
export const blankLine = (): string => '';

export const link = (text: string, url: string): string => `\\href{${url}}{${text}}`;

/**
 * Normalizes Obsidian embed sizes (e.g. `|200`, `|400x300`, or raw LaTeX dimensions)
 * into a safe LaTeX graphicx option string that caps both width and height to prevent giant images.
 */
export function formatImageOptions(rawSize?: string | null): string {
  if (!rawSize) {
    return 'width=0.75\\textwidth,height=0.4\\textheight,keepaspectratio';
  }
  const trimmed = rawSize.trim();
  // Obsidian single pixel dimension: |300
  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch) {
    const w = parseInt(numMatch[1], 10);
    // 700px roughly corresponds to textwidth in standard Obsidian reading mode
    const frac = Math.min(Math.max(w / 700, 0.15), 1.0).toFixed(3);
    return `width=${frac}\\textwidth,height=0.45\\textheight,keepaspectratio`;
  }
  // Obsidian double pixel dimension: |400x300
  const dimMatch = trimmed.match(/^(\d+)\s*x\s*(\d+)$/i);
  if (dimMatch) {
    const w = parseInt(dimMatch[1], 10);
    const h = parseInt(dimMatch[2], 10);
    const wFrac = Math.min(Math.max(w / 700, 0.15), 1.0).toFixed(3);
    const hFrac = Math.min(Math.max(h / 900, 0.15), 0.5).toFixed(3);
    return `width=${wFrac}\\textwidth,height=${hFrac}\\textheight,keepaspectratio`;
  }
  // Explicit LaTeX options
  if (trimmed.startsWith('width=') || trimmed.startsWith('height=')) {
    return trimmed.includes('keepaspectratio') ? trimmed : `${trimmed},keepaspectratio`;
  }
  if (trimmed.includes('\\') || trimmed.endsWith('cm') || trimmed.endsWith('mm') || trimmed.endsWith('in')) {
    return `width=${trimmed},height=0.45\\textheight,keepaspectratio`;
  }
  return 'width=0.75\\textwidth,height=0.4\\textheight,keepaspectratio';
}

export const image = (path: string, options = 'width=0.75\\textwidth,height=0.4\\textheight,keepaspectratio'): string => {
  const opts = formatImageOptions(options);
  return `\\begin{figure}[h!]\n\\centering\n\\includegraphics[${opts}]{${path}}\n\\end{figure}\n`;
};

export const svg = (path: string, options = 'width=0.75\\textwidth,height=0.4\\textheight,keepaspectratio'): string => {
  const opts = formatImageOptions(options);
  return `\\begin{figure}[h!]\n\\centering\n\\includesvg[${opts}]{${path}}\n\\end{figure}\n`;
};

const LATEX_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

/** Escapes LaTeX specials in text that is not meant to be LaTeX source. */
export function escapeLatex(text: string): string {
  if (!text) return '';
  return Array.from(text)
    .map((char) => LATEX_ESCAPES[char] ?? char)
    .join('');
}

/**
 * Escapes the characters that always break `\title` / `\author` / `\date`
 * without touching the ones people legitimately use there.
 *
 * A note called `sample_en` must not become a subscript, but a title like
 * `$L^2$ spaces` or `\textsc{Notes}` should still work — so `$`, `\`, `^` and
 * braces are deliberately left alone.
 */
export function escapeSpecials(text: string): string {
  if (!text) return '';
  return text.replace(/(?<!\\)([_&%#])/g, '\\$1').replace(/(?<!\\)~/g, '\\textasciitilde{}');
}

/** @deprecated Use {@link escapeSpecials}. */
export const escapeMetadata = escapeSpecials;

// -------------------------------------------------------------------- math

/** Normalizes Obsidian/KaTeX-isms that plain LaTeX does not accept. */
export function mathText(text: string): string {
  return text
    .replace(/\\R/g, '')
    .replace(/\\begin\{align\*?\}/g, '\\begin{aligned}')
    .replace(/\\end\{align\*?\}/g, '\\end{aligned}')
    .replace(/\\Large/g, '\\Big');
}

// The extra braces match the Python implementation: they keep declarations such
// as `\displaystyle` or a size modifier scoped to the formula they appear in.
export const mathInline = (text: string): string => `\\({${mathText(text)}}\\)`;
export const mathBlock = (text: string): string => `\\[\n{${mathText(text)}}\n\\]\n`;

// ------------------------------------------------------------------- text

/** Recursively renders a list of inline nodes to LaTeX. */
export function getText(children: Node[], context: RenderContext): string {
  let text = '';

  for (const child of children) {
    switch (child.type) {
      case 'text':
        // Only the characters that always abort the LaTeX run are escaped, so
        // hand-written LaTeX in a note (\newpage, \begin{...}) still passes through.
        text += escapeSpecials(child.raw ?? '');
        break;
      case 'strong':
        text += bold(getText(child.children ?? [], context));
        break;
      case 'emphasis':
        text += emph(getText(child.children ?? [], context));
        break;
      case 'underline':
        text += underline(getText(child.children ?? [], context));
        break;
      case 'strikethrough':
        // \sout comes from ulem, which is only loaded when actually needed.
        if (!context.head.packages.includes('ulem')) context.head.packages.push('ulem');
        text += strikethrough(getText(child.children ?? [], context));
        break;
      case 'codespan':
        text += codespan(child.raw ?? '');
        break;
      case 'thematic_break':
        text += thematicBreak();
        break;

      case 'inline_math':
        text += mathInline(child.raw ?? '');
        break;

      case 'link':
        text += link(
          getText(child.children ?? [], context),
          String(child.attrs?.href ?? ''),
        );
        break;

      case 'wiki_link':
        text += renderWikiLink(child, context);
        break;

      case 'linebreak':
        text += newline();
        break;

      case 'block_id':
        text += `\\label{${child.raw ?? ''}}`;
        break;

      case 'list':
        text += parseList(child, context);
        break;

      case 'image': {
        context.head.images = true;
        const src = String(child.attrs?.src ?? '');
        const sizeAttr = child.attrs?.size ?? child.attrs?.alias;
        text += image(
          resolveEmbedPath({ ...child, attrs: { link: src } }, context, src, 'image'),
          sizeAttr ? String(sizeAttr) : undefined,
        );
        break;
      }

      case 'svg': {
        context.head.images = true;
        const src = String(child.attrs?.src ?? '');
        const sizeAttr = child.attrs?.size ?? child.attrs?.alias;
        text += svg(
          resolveEmbedPath({ ...child, attrs: { link: src } }, context, src, 'svg'),
          sizeAttr ? String(sizeAttr) : undefined,
        );
        break;
      }

      case 'wiki_embed': {
        context.head.images = true;
        const link = String(child.attrs?.link ?? '');
        const sizeAttr = child.attrs?.size ?? child.attrs?.alias;
        const size = formatImageOptions(sizeAttr ? String(sizeAttr) : undefined);
        const kind = embedKind(link);
        // A drawing (`![[sketch.excalidraw]]`, or a bare note name) is exported
        // alongside the note as `<name>.svg`; a file that already names an image
        // format is embedded as-is, or `![[chart.svg]]` would look for
        // `chart.svg.svg`.
        // `.md` is dropped first so an embed written out in full,
        // `![[sketch.excalidraw.md]]`, does not ask for `sketch.excalidraw.md.svg`.
        const fallback = kind === 'drawing' ? `${link.replace(/\.md$/i, '')}.svg` : link;
        const assetKind = kind === 'raster' ? 'image' : 'svg';
        const path = resolveEmbedPath(child, context, fallback, assetKind);
        text += assetKind === 'image' ? image(path, size) : svg(path, size);
        break;
      }

      case 'footnote_ref':
        text += `\\footnotemark[${String(child.attrs?.identifier ?? '')}]`;
        break;

      case 'inline_html':
        break; // raw HTML has no LaTeX equivalent; drop it silently

      default:
        if (child.children) {
          // Unknown wrapper node: render its children rather than losing them.
          text += getText(child.children, context);
        } else if (child.raw) {
          text += escapeSpecials(child.raw);
        }
    }
  }

  return text;
}

function renderWikiLink(child: Node, context: RenderContext): string {
  const request = linkRequest(child, 'link');
  const resolved = resolve(request, context);
  const label = escapeSpecials(resolved?.text ?? request.text);

  if (resolved?.plain) return label;
  if (resolved?.label) return selfRef(resolved.label, label);

  // An empty target means the link points inside the current document:
  // `[[#heading]]`, `[[^blockid]]` or `[[#heading^blockid]]`.
  if (!request.target && !resolved?.href) {
    const ref = request.blockRef || request.heading;
    return selfRef(ref, escapeSpecials(request.alias || ref || (child.raw ?? '')));
  }

  const url = resolved?.href
    ? buildVaultUrl(resolved.href, request.heading, request.blockRef, context.vaultBaseUrl)
    : buildVaultUrl(request.target, request.heading, request.blockRef, context.vaultBaseUrl);

  return hrefLink(url, label);
}

/**
 * Resolves the path of an embedded asset. Obsidian stores attachments wherever
 * the vault is configured to, so `![[diagram.excalidraw]]` says nothing about
 * where the file actually lives — only the resolver knows.
 */
export function resolveEmbedPath(
  child: Node,
  context: RenderContext,
  fallback: string,
  kind: AssetKind = 'image',
): string {
  const resolved = resolve(linkRequest(child, 'embed'), context);
  // A resolver looking up `sketch.excalidraw.md` finds the drawing itself, so
  // rewrite here as well as in the fallback — this is the one path both take.
  const path = excalidrawSvg(resolved?.href || fallback);
  // Every embed funnels through here, which makes it the one place that can see
  // the document's full file dependencies.
  recordAsset(context, path, kind);
  return path;
}

// ------------------------------------------------------------------ tables

const ALIGN_SPEC: Record<string, string> = { center: 'c|', right: 'r|', left: 'l|' };

/** Renders a GFM table as a bordered `tabular` inside a floating `table`. */
export function table(tableContent: Node, context: RenderContext): string {
  const sections = tableContent.children ?? [];
  const headRow = sections
    .flatMap((section) => section.children ?? [])
    .find((row) => row.type === 'table_row');

  let result = '\\begin{table}[h]\n\\centering\n\\begin{tabular}{|';
  for (const cell of headRow?.children ?? []) {
    const align = String(cell.attrs?.align ?? 'left');
    result += ALIGN_SPEC[align] ?? 'l|';
  }
  result += '}\n';

  const renderRows = (section: Node): string => {
    let out = '';
    for (const row of section.children ?? []) {
      if (row.type !== 'table_row') continue;
      const cells = (row.children ?? []).map((cell) =>
        getText(cell.children ?? [], context).trim(),
      );
      out += `${cells.join(' & ')} \\\\\n\\hline\n`;
    }
    return out;
  };

  for (const section of sections) {
    if (section.type === 'table_head') result += `${renderRows(section)}\\hline\n`;
  }
  for (const section of sections) {
    if (section.type === 'table_body') result += renderRows(section);
  }

  result += '\\end{tabular}\n\\end{table}\n';
  return result;
}

// ------------------------------------------------------------------- lists

/**
 * Renders list items. Item content is rendered block-aware so that nested
 * lists, paragraphs and math inside an item all survive.
 */
function listItems(items: Node[], context: RenderContext, renderBlocks: BlockRenderer): string {
  let result = '';
  for (const item of items) {
    if (item.type !== 'list_item') continue;
    const checked = item.attrs?.checked;
    const marker =
      checked === undefined ? '' : checked ? '[$\\boxtimes$] ' : '[$\\square$] ';
    const body = renderBlocks(item.children ?? [], context).trim();
    result += `\\item ${marker}${body}\n`;
  }
  return result;
}

/** Renders a block-level node list; injected to avoid a circular import. */
export type BlockRenderer = (nodes: Node[], context: RenderContext) => string;

let blockRenderer: BlockRenderer = (nodes, context) => getText(nodes, context);

/** Wires the block renderer used for list-item bodies. */
export function setBlockRenderer(renderer: BlockRenderer): void {
  blockRenderer = renderer;
}

export function parseList(list: Node, context: RenderContext): string {
  const ordered = Boolean(list.attrs?.ordered);
  const env = ordered ? 'enumerate' : 'itemize';
  const body = listItems(list.children ?? [], context, blockRenderer);
  return `\\begin{${env}}\n${body}\\end{${env}}\n`;
}
