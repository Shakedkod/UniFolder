import { desmosGraphToTikz } from '../diagrams/desmos.js';
import { dotToTikz } from '../diagrams/dot.js';
import { mermaidToTikz } from '../diagrams/mermaid.js';
import type { Node } from '../types.js';
import type { RenderContext } from './parts.js';

/** Normalizes language identifiers for the LaTeX listings package. */
export function normalizeListingLanguage(lang: string): string {
  const l = (lang || '').trim().toLowerCase();
  switch (l) {
    case 'cpp':
    case 'c++':
      return 'C++';
    case 'c':
      return 'C';
    case 'py':
    case 'python':
      return 'Python';
    case 'java':
      return 'Java';
    case 'sh':
    case 'bash':
    case 'shell':
    case 'zsh':
      return 'bash';
    case 'sql':
      return 'SQL';
    case 'matlab':
      return 'Matlab';
    case 'html':
      return 'HTML';
    case 'xml':
      return 'XML';
    case 'r':
      return 'R';
    case 'assembly':
    case 'assembler':
    case 'asm':
    case 'riscv':
      return l;
    default:
      // Unknown or unsupported language in listings — render as plain formatted code
      return '';
  }
}

/** Wraps code in a left-to-right English `lstlisting`, so it reads correctly in RTL documents without character mirroring. */
export function genericCodeblock(code: string, language: string): string {
  const normLang = normalizeListingLanguage(language);
  const langOpt = normLang ? `[language=${normLang}]` : '';
  return `\\begin{english}\\begin{LTR}\\begin{lstlisting}${langOpt}\n${code}\n\\end{lstlisting}\\end{LTR}\\end{english}`;
}

/**
 * Renders a fenced code block. `mermaid`, `dot` and `desmos-graph` fences are
 * converted to TikZ/pgfplots; every other language becomes a `listings` block.
 * A diagram that cannot be parsed degrades to a plain listing.
 */
export function codeblock(block: Node, context: RenderContext): string {
  context.head.code = true;
  const raw = block.raw ?? '';
  const info = String(block.attrs?.info ?? '').trim();
  const language = info.split(/\s+/)[0] ?? '';

  switch (language) {
    case 'mermaid': {
      context.head.tikz = true;
      return mermaidToTikz(raw) || genericCodeblock(raw, 'text');
    }
    case 'dot':
    case 'graphviz': {
      context.head.tikz = true;
      return dotToTikz(raw) || genericCodeblock(raw, 'text');
    }
    case 'pseudo':
    case 'pseudocode':
    case 'algorithm': {
      if (!context.head.packages.includes('algorithm')) {
        context.head.packages.push('algorithm', 'algpseudocode');
      }
      const trimmed = raw.trim();
      return `\\begin{english}\\begin{LTR}\n${trimmed}\n\\end{LTR}\\end{english}`;
    }
    case 'tikz': {
      context.head.tikz = true;
      return raw;
    }
    case 'desmos-graph': {
      context.head.tikz = true;
      if (!context.head.packages.includes('pgfplots')) context.head.packages.push('pgfplots');
      return desmosGraphToTikz(raw) || genericCodeblock(raw, 'text');
    }
    default:
      return genericCodeblock(raw, language);
  }
}
