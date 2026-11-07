import {
  BASE_LATEX_DOC_END,
  BASE_LATEX_DOC_START,
  BASE_LATEX_MATH,
  BASE_LATEX_PAGE_LAYOUT,
  BASE_LATEX_TEXT,
  BASIC_LATEX_MISC,
  EXTRA_LATEX_PACKAGES_HEADER,
  LATEX_CODEBLOCK_SETUP,
  LATEX_ALGORITHM_SETUP,
  LATEX_HEBREW_TEXT,
  LATEX_IMAGES_AND_DIAGRAMS,
  LATEX_THEME_FANCY_ACADEMIC,
  LATEX_THEME_FANCY_ACADEMIC_HEBREW,
  LATEX_TABLE_OF_CONTENTS,
  LATEX_THEME_REGULAR,
  LATEX_THEME_REGULAR_HEBREW,
  LATEX_TIKZ,
  START_OF_DOCUMENT_CONTENT,
} from './constants';
import { astToLatex, secondPassParse } from './astToLatex';
import { createContext, escapeSpecials } from './parts';
import { DEFAULT_VAULT_BASE_URL } from './specialBlocks';
import {
  createHead,
  type AssetReference,
  type Head,
  type LatexFileOptions,
  type Node,
  type Theme,
  type WikiLinkResolver,
} from '../types';
import { civilHebrewDate, englishDate, traditionalHebrewDate } from '../util/hebrewDate';

export const DEFAULT_LANGUAGE = 'english';
export const DEFAULT_THEME: Theme = 'regular';
export const DEFAULT_FOOTER = '\\fancyfoot[C]{\\thepage/\\pageref{LastPage}}';

/**
 * Accumulates a LaTeX document: preamble flags, metadata and body.
 *
 * Mirrors the Python `LatexFile` class — render markdown into it with
 * {@link LatexFile.mdToLatex}, then call {@link LatexFile.build} for the `.tex`
 * source.
 */
export class LatexFile {
  preamble: string;
  language: string;
  head: Head;
  body = '';
  header = '';
  footer: string = DEFAULT_FOOTER;
  theme: Theme;
  author: string;
  title: string;
  toc: boolean;
  date: string;
  vaultBaseUrl: string;
  resolveWikiLink?: WikiLinkResolver;
  /** Node types the renderer did not recognize, for surfacing in a UI. */
  warnings: string[] = [];
  /** Images and SVGs the body includes, for bundling alongside the `.tex`. */
  assets: AssetReference[] = [];

  constructor(options: LatexFileOptions = {}) {
    this.preamble = options.preamble ?? '';
    this.language = options.language ?? DEFAULT_LANGUAGE;
    this.theme = options.theme ?? DEFAULT_THEME;
    this.author = options.author ?? '';
    this.title = options.title ?? '';
    this.toc = options.toc ?? true;
    this.vaultBaseUrl = options.vaultBaseUrl ?? DEFAULT_VAULT_BASE_URL;
    this.resolveWikiLink = options.resolveWikiLink;
    this.head = createHead();

    const docDate = options.docDate ?? '';
    if (docDate === '') {
      const today = options.today ?? new Date();
      this.date =
        this.language === 'hebrew'
          ? `${civilHebrewDate(today)} (${traditionalHebrewDate(today)})`
          : englishDate(today);
    } else {
      this.date = docDate;
    }
  }

  addToHead(content: string): void {
    this.head.other += `${content}\n`;
  }

  enableTikz(): void {
    this.head.tikz = true;
  }

  addToBody(content: string): void {
    this.body += `${content}\n`;
  }

  addPackages(packages: string[]): void {
    this.head.packages.push(...packages);
  }

  addHeader(header: string): void {
    this.header += `${header}\n`;
  }

  deleteHeader(): void {
    this.header = '';
  }

  addFooter(footer: string): void {
    this.footer += `${footer}\n`;
  }

  deleteFooter(): void {
    this.footer = '';
  }

  defaultFooter(): void {
    this.footer = DEFAULT_FOOTER;
  }

  /** Appends the traditional Hebrew date to an existing civil date string. */
  addHebrewDateToDate(date: Date): void {
    this.date += ` (${traditionalHebrewDate(date)})`;
  }

  /** Renders an AST into the document body, updating the preamble flags. */
  mdToLatex(ast: Node[]): void {
    const context = createContext(this.head, this.vaultBaseUrl, this.resolveWikiLink);
    const rendered = astToLatex(ast, context);
    this.head = context.head;
    this.warnings = [...new Set(context.warnings)];
    this.assets = context.assets;
    this.body += secondPassParse(rendered);
  }

  /** Builds just the preamble (everything before `\begin{document}`). */
  headToText(): string {
    const extraPackages = (): string => {
      let result = EXTRA_LATEX_PACKAGES_HEADER;
      for (const packageName of [...new Set(this.head.packages)]) {
        result += `\\usepackage{${packageName}}\n`;
      }
      return result;
    };

    let headText = BASE_LATEX_TEXT;
    if (this.language === 'hebrew' || this.head.extra_lang.includes('hebrew')) {
      headText += LATEX_HEBREW_TEXT;
    }

    headText += BASE_LATEX_MATH;
    if (this.footer !== DEFAULT_FOOTER || this.header !== '') {
      headText += BASE_LATEX_PAGE_LAYOUT;
      headText += `${this.header}\n${this.footer}\n`;
    }
    if (this.head.images || this.head.tikz) headText += LATEX_IMAGES_AND_DIAGRAMS;
    if (this.head.tikz) headText += LATEX_TIKZ;

    headText += BASIC_LATEX_MISC;
    headText += extraPackages();

    if (this.preamble) {
      headText += '% ---------- Custom Preamble ----------\n';
      headText += `${this.preamble}\n`;
    }

    const hebrew = this.language === 'hebrew';
    if (this.theme === 'fancy-academic') {
      headText += hebrew ? LATEX_THEME_FANCY_ACADEMIC_HEBREW : LATEX_THEME_FANCY_ACADEMIC;
    } else {
      headText += hebrew ? LATEX_THEME_REGULAR_HEBREW : LATEX_THEME_REGULAR;
    }

    if (this.head.code) headText += LATEX_CODEBLOCK_SETUP;
    if (this.head.packages.includes('algorithm') || this.head.packages.includes('algpseudocode')) {
      headText += LATEX_ALGORITHM_SETUP;
    }

    headText += this.head.other;
    headText += '% ---------- Metadata ----------\n';
    headText += `\\title{${escapeSpecials(this.title)}}\n`;
    headText += `\\author{${escapeSpecials(this.author)}}\n`;
    headText += this.head['has-date']
      ? `\\date{${escapeSpecials(this.date)}}\n`
      : '\\date{}\n';

    return headText;
  }

  /** The complete `.tex` document. */
  build(): string {
    let document = `${BASE_LATEX_DOC_START}\n`;
    document += `${this.headToText()}\n`;
    document += `${START_OF_DOCUMENT_CONTENT}\n`;
    if (this.toc) document += `${LATEX_TABLE_OF_CONTENTS}\n`;
    document += `${this.body}\n`;
    document += BASE_LATEX_DOC_END;
    return document;
  }
}
