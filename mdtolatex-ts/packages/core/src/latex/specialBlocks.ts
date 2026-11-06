/** LaTeX emitters for Obsidian callouts, quotes and cross-references. */

export const DEFAULT_VAULT_BASE_URL = 'https://uni-folder.vercel.app/';

/** An in-document reference (`\hyperref`). */
export function selfRef(link: string, title: string): string {
  return `\\hyperref[${link}]{${title}}`;
}

const ABSOLUTE_URL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** True for `https://…`, `mailto:…`, `obsidian://…` and protocol-relative URLs. */
export function isAbsoluteUrl(target: string): boolean {
  return ABSOLUTE_URL_RE.test(target);
}

/** Percent-encodes each path segment while keeping the `/` separators readable. */
export function encodeVaultPath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Builds the fragment for a link into a note.
 *
 * Obsidian Publish addresses headings as `#Heading` and block ids as
 * `#^blockid`; an empty ref must produce no fragment at all, because a bare
 * trailing `#` breaks `\part`/`\section` (the `#` is written to the .toc file,
 * where it is read as a macro parameter).
 */
export function vaultFragment(heading: string, blockRef: string): string {
  if (blockRef) return `#^${encodeURIComponent(blockRef.replace(/^\^+/, ''))}`;
  if (heading) return `#${encodeURIComponent(heading)}`;
  return '';
}

/** Joins a vault base URL and a note path into an absolute URL. */
export function buildVaultUrl(
  target: string,
  heading = '',
  blockRef = '',
  baseUrl: string = DEFAULT_VAULT_BASE_URL,
): string {
  const fragment = vaultFragment(heading, blockRef);
  if (isAbsoluteUrl(target)) return `${target}${fragment}`;
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${encodeVaultPath(target.replace(/^\/+/, ''))}${fragment}`;
}

/**
 * Escapes a URL for use inside `\href`.
 *
 * hyperref un-escapes `\#` and `\%` itself, and escaping them keeps the link
 * usable inside moving arguments such as section titles.
 */
export function latexUrl(url: string): string {
  return url.replace(/([#%])/g, '\\$1');
}

/** An external link to the published vault. */
export function obsidianLink(
  title: string,
  url: string,
  blockRef: string,
  baseUrl: string = DEFAULT_VAULT_BASE_URL,
): string {
  return href(buildVaultUrl(url, '', blockRef, baseUrl), title);
}

/** A hyperlink to an already-resolved destination. */
export function href(url: string, title: string): string {
  return `\\href{${latexUrl(url)}}{${title}}`;
}

export function quote(text: string, type: string, ref = ''): string {
  if (ref) return `\\begin{${type}}\n\\label{${ref}}\n${text}\n\\end{${type}}\n`;
  return `\\begin{${type}}\n${text}\n\\end{${type}}\n`;
}

export function titledQuote(text: string, title: string, type: string, ref = ''): string {
  if (ref) return `\\begin{${type}}[${title}]\n\\label{${ref}}\n${text}\n\\end{${type}}\n`;
  return `\\begin{${type}}[${title}]\n${text}\n\\end{${type}}\n`;
}

/**
 * Obsidian callout type -> LaTeX theorem-like environment. Every environment
 * listed here is declared by the theme preamble in `constants.ts`.
 */
export const CALLOUT_ENVIRONMENTS = [
  'definition',
  'theorem',
  'lemma',
  'proposition',
  'corollary',
  'claim',
  'conjecture',
  'axiom',
  'assumption',
  'example',
  'exercise',
  'hypothesis',
  'remark',
  'hw',
  'proof',
] as const;

export type CalloutEnvironment = (typeof CALLOUT_ENVIRONMENTS)[number];

const ENVIRONMENT_SET = new Set<string>(CALLOUT_ENVIRONMENTS);

/** Emits a theorem-like environment, with an optional bracketed title. */
export function environment(type: string, text: string, title = '', ref = ''): string {
  return title ? titledQuote(text, title, type, ref) : quote(text, type, ref);
}

export interface CalloutAttrs {
  callout_type?: string;
  title?: string;
  block_id?: string;
  numbered?: boolean;
}

/** A trailing `\end{proof}` marker, with or without the `\texttt` code wrapper. */
const RENDERED_PROOF_MARKER =
  /(?:\\newline\{\}\s*)?(?:\\texttt\{\\textbackslash\{\}end\\\{proof\\\}\}|\\end\{proof\})\s*$/;

function stripProofMarker(text: string): string {
  return text.replace(RENDERED_PROOF_MARKER, '').trimEnd();
}

/** Renders a callout, falling back to a plain `quote` for unknown types. */
export function callout(text: string, attrs: CalloutAttrs = {}): string {
  const title = attrs.title ?? '';
  const ref = attrs.block_id ?? '';
  const type = (attrs.callout_type ?? '').toLowerCase();

  if (type === 'proof') {
    // A `[!proof]` callout may still carry the explicit `\end{proof}` marker the
    // Hebrew flow uses; the environment supplies its own terminator and QED.
    return environment('proof', stripProofMarker(text), title, ref);
  }
  if (ENVIRONMENT_SET.has(type)) return environment(type, text, title, ref);
  return quote(text, 'quote', ref);
}
