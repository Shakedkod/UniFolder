/**
 * The internal AST used by the converter.
 *
 * It intentionally mirrors the token shape that `mistune` produced in the
 * original Python implementation (`type` / `raw` / `children` / `attrs`), so the
 * renderer logic is a direct port and the JSON dumps from both implementations
 * stay comparable. The markdown front-end (remark/mdast) is adapted into this
 * shape in `parser/fromMdast.ts`.
 */
export interface Node {
  type: string;
  raw?: string;
  children?: Node[];
  attrs?: Record<string, unknown>;
}

/** Mutable state collected while rendering, controlling the document preamble. */
export interface Head {
  /** Extra `\usepackage{...}` names requested by the body. */
  packages: string[];
  /** Body used TikZ, so the TikZ preamble is required. */
  tikz: boolean;
  /** Body contained a code block, so `listings` setup is required. */
  code: boolean;
  /** Body contained an image/SVG, so `graphicx`/`svg` are required. */
  images: boolean;
  /** Arbitrary extra preamble lines. */
  other: string;
  'has-date': boolean;
  'has-author': boolean;
  /** Additional languages detected in the body, e.g. `['hebrew']`. */
  extra_lang: string[];
}

export function createHead(overrides: Partial<Head> = {}): Head {
  return {
    packages: [],
    tikz: false,
    code: false,
    images: false,
    other: '',
    'has-date': true,
    'has-author': true,
    extra_lang: [],
    ...overrides,
  };
}

export type Theme = 'regular' | 'fancy-academic';

export interface LatexFileOptions {
  /** Raw LaTeX injected into the preamble verbatim. */
  preamble?: string;
  theme?: Theme;
  /** `'english'`, `'hebrew'`, or any polyglossia language name. */
  language?: string;
  author?: string;
  title?: string;
  /** Explicit date string; when empty, today's date is formatted for the language. */
  docDate?: string;
  /** Emit `\tableofcontents`. */
  toc?: boolean;
  /** Base URL used when turning Obsidian wikilinks into external hyperlinks. */
  vaultBaseUrl?: string;
  /**
   * Hook that turns an Obsidian link target into a destination.
   *
   * Obsidian resolves short links like `[[Integrals]]` through its own metadata
   * cache, so only the host app knows which file they point at. Supply this from
   * the plugin to translate them into vault-root-relative paths; leave it unset
   * and links are built from {@link vaultBaseUrl} plus the literal target.
   */
  resolveWikiLink?: WikiLinkResolver;
  /** Overrides "today" — useful for deterministic tests. */
  today?: Date;
}

/** A wikilink or embed the renderer needs a destination for. */
export interface WikiLinkRequest {
  /** Target exactly as written in the note: `Integrals`, `math/Integrals`, `img.png`. */
  target: string;
  /** Heading fragment after `#`, if any. */
  heading: string;
  /** Block id after `^`, if any (without the caret). */
  blockRef: string;
  /** Alias after `|`, if any. */
  alias: string;
  /** Display text the renderer would use if the resolver returns nothing. */
  text: string;
  /** `'link'` for `[[x]]`, `'embed'` for `![[x]]` and markdown images. */
  kind: 'link' | 'embed';
}

/** What a link target resolved to. Every field is optional. */
export interface ResolvedWikiLink {
  /**
   * Destination. For `kind: 'link'` an absolute URL, or a path that is appended
   * to `vaultBaseUrl`. For `kind: 'embed'` the file path handed to
   * `\includegraphics` / `\includesvg`.
   */
  href?: string;
  /** In-document `\hyperref` label. Takes precedence over `href`. */
  label?: string;
  /** Overrides the display text. */
  text?: string;
  /** Render as plain text with no link at all (e.g. an unresolved wikilink). */
  plain?: boolean;
}

export type WikiLinkResolver = (
  request: WikiLinkRequest,
) => ResolvedWikiLink | null | undefined;

/** How an embedded file is included in the document. */
export type AssetKind = 'image' | 'svg';

/** A file the generated document needs alongside the `.tex` to compile. */
export interface AssetReference {
  /**
   * The path exactly as it appears in the `\includegraphics`/`\includesvg`
   * argument. Relative paths are relative to the `.tex` file, which is what
   * makes a bundle that mirrors them work unchanged.
   */
  path: string;
  kind: AssetKind;
  /** `true` for `http(s)` sources, which cannot be bundled from disk. */
  isUrl: boolean;
}

/** Result of a full markdown -> LaTeX conversion. */
export interface ConvertResult {
  /** The complete `.tex` document. */
  latex: string;
  /** The preamble flags that ended up being used. */
  head: Head;
  /** Node types encountered but not handled by the renderer. */
  warnings: string[];
  /**
   * Every image and SVG the document includes, deduplicated and in the order
   * they first appear. This is the list a host needs to read and ship next to
   * the `.tex` for the document to compile.
   */
  assets: AssetReference[];
}
