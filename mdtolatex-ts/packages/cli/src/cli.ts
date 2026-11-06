#!/usr/bin/env node
/**
 * Command-line front-end for the converter, replacing the interactive
 * `questionary` wizard in `src/main.py` with plain flags.
 *
 *   mdtolatex notes.md --title "Calculus" --author "Shaked" --pdf
 */
import { basename, dirname, extname, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import type { ConvertOptions, Theme } from '@mdtolatex/core';
import {
  detectLanguage,
  exportDocument,
  writeExport,
  type SkippedReport,
} from '@mdtolatex/node';

const USAGE = `Usage: mdtolatex <input.md> [options]

Options:
  -o, --out <file>       Output path (default: alongside the input, .tex)
      --title <text>     Document title (default: the input file name)
      --author <text>    Document author
      --language <name>  polyglossia language, or "auto" (default: auto)
      --theme <name>     regular | fancy-academic (default: regular)
      --no-toc           Omit the table of contents
      --preamble <file>  Extra preamble appended verbatim
      --vault-url <url>  Base URL that wikilinks point to
      --zip              Bundle the .tex with every image it includes
      --assets <dir>     Where to read images from (default: the input's folder)
      --keep-svg         Bundle SVGs as-is instead of rendering them to PDF
      --pdf              Compile a PDF next to the .tex
      --stdout           Print the LaTeX instead of writing a file
  -h, --help             Show this message

With --zip the archive and the PDF are written side by side, next to the .tex.
`;

interface Flags {
  input?: string;
  out?: string;
  title?: string;
  author?: string;
  language: string;
  theme: Theme;
  toc: boolean;
  preamble?: string;
  vaultUrl?: string;
  zip: boolean;
  assets?: string;
  keepSvg: boolean;
  pdf: boolean;
  stdout: boolean;
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = {
    language: 'auto',
    theme: 'regular',
    toc: true,
    zip: false,
    keepSvg: false,
    pdf: false,
    stdout: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = (): string => {
      const value = argv[index + 1];
      if (value === undefined) fail(`Missing value for ${arg}`);
      index += 1;
      return value;
    };

    switch (arg) {
      case '-h':
      case '--help':
        process.stdout.write(USAGE);
        process.exit(0);
      // eslint-disable-next-line no-fallthrough
      case '-o':
      case '--out':
        flags.out = next();
        break;
      case '--title':
        flags.title = next();
        break;
      case '--author':
        flags.author = next();
        break;
      case '--language':
        flags.language = next();
        break;
      case '--theme': {
        const theme = next();
        if (theme !== 'regular' && theme !== 'fancy-academic') fail(`Unknown theme "${theme}"`);
        flags.theme = theme;
        break;
      }
      case '--no-toc':
        flags.toc = false;
        break;
      case '--preamble':
        flags.preamble = next();
        break;
      case '--vault-url':
        flags.vaultUrl = next();
        break;
      case '--zip':
        flags.zip = true;
        break;
      case '--assets':
        flags.assets = next();
        break;
      case '--keep-svg':
        flags.keepSvg = true;
        break;
      case '--pdf':
        flags.pdf = true;
        break;
      case '--stdout':
        flags.stdout = true;
        break;
      default:
        if (arg.startsWith('-')) fail(`Unknown option "${arg}"`);
        if (flags.input) fail('Only one input file is supported');
        flags.input = arg;
    }
  }

  if (!flags.input) fail('An input markdown file is required');
  return flags;
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  const inputPath = resolve(flags.input!);
  const markdown = await readFile(inputPath, 'utf8').catch(() =>
    fail(`could not read "${inputPath}"`),
  );

  const options: ConvertOptions = {
    title: flags.title ?? basename(inputPath, extname(inputPath)),
    author: flags.author ?? '',
    language: flags.language === 'auto' ? detectLanguage(markdown) : flags.language,
    theme: flags.theme,
    toc: flags.toc,
    vaultBaseUrl: flags.vaultUrl,
    preamble: flags.preamble ? await readFile(resolve(flags.preamble), 'utf8') : undefined,
  };

  // Images are written relative to the note, so that is where they are read from
  // unless told otherwise.
  const assetRoot = resolve(flags.assets ?? dirname(inputPath));
  const stem = basename(resolve(flags.out ?? inputPath.replace(/\.md$/i, '') + '.tex'), '.tex');

  const result = await exportDocument({
    markdown,
    options,
    assetRoot,
    keepSvg: flags.keepSvg,
    // --stdout has nowhere to put an archive or a PDF.
    zip: flags.zip && !flags.stdout,
    pdf: flags.pdf && !flags.stdout,
    texName: `${stem}.tex`,
    onWarning: (message) => process.stderr.write(`warning: ${message}\n`),
  });

  for (const warning of new Set(result.warnings)) {
    process.stderr.write(`warning: unsupported node type "${warning}" was skipped\n`);
  }
  reportSkipped(result.skipped);
  if (result.pdfErrors?.length) {
    process.stderr.write(`warning: the PDF compiled with ${result.pdfErrors.length} LaTeX error(s):\n`);
    for (const line of result.pdfErrors.slice(0, 10)) process.stderr.write(`  ${line}\n`);
    if (result.pdfErrors.length > 10) {
      process.stderr.write(`  ...and ${result.pdfErrors.length - 10} more\n`);
    }
  }

  if (flags.stdout) {
    // Nowhere to put the converted figures, so say so rather than printing
    // includes that will quietly render nothing.
    if (result.assets.some((asset) => asset.kind === 'svg' && !asset.isUrl)) {
      process.stderr.write(
        'warning: this document includes SVGs, which need Inkscape at compile time.\n' +
          '         write to a file instead of --stdout to get them converted to PDF.\n',
      );
    }
    process.stdout.write(result.latex);
    return;
  }

  const outDir = dirname(resolve(flags.out ?? inputPath.replace(/\.md$/i, '') + '.tex'));
  const written = await writeExport(result, outDir, stem);
  process.stderr.write(`wrote ${written.tex}\n`);
  if (written.figures.length) {
    const count = written.figures.length;
    process.stderr.write(`converted ${count} SVG${count === 1 ? '' : 's'} to PDF\n`);
  }
  if (written.zip) process.stderr.write(`wrote ${written.zip}\n`);
  if (written.pdf) process.stderr.write(`wrote ${written.pdf}\n`);
}

/** Explains every asset that did not make it into the document. */
function reportSkipped(skipped: SkippedReport[]): void {
  const explain: Record<string, string> = {
    missing: 'not found',
    remote: 'is a URL, and LaTeX cannot fetch images \u2014 download it and link it locally',
    unreadable: 'could not be read',
  };
  for (const asset of skipped) {
    const detail = asset.detail ? `: ${asset.detail}` : '';
    process.stderr.write(
      `warning: "${asset.path}" ${explain[asset.reason] ?? asset.reason}${detail}\n`,
    );
  }
}

function fail(message: string): never {
  process.stderr.write(`mdtolatex: ${message}\n`);
  process.exit(1);
}

await main();
