#!/usr/bin/env node
/**
 * Converts a whole Obsidian vault to LaTeX at build time.
 *
 * Point it at a vault checkout — a git submodule, a `git clone` in CI, a local
 * folder — and it writes a `.tex` (plus optional `.zip` and `.pdf`) per note into
 * `public/`, with a `manifest.json` the site can import to list them. Everything
 * is then a static file, so the deployed site needs no converter, no TeX
 * installation and no serverless function.
 *
 * This is the same pipeline the CLI runs, from `@mdtolatex/node`. The browser
 * build cannot do this — it has no filesystem and no subprocesses — which is why
 * the runtime UI asks you to attach figures by hand and cannot render SVGs. At
 * build time none of that applies: it is ordinary Node.
 *
 *   npm run build:vault -- --vault ../../../vault --pdf
 *   npm run build:vault -- --vault ./vault --base-url https://notes.example.com
 */
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import process from 'node:process';
import {
  createVaultAssetReader,
  createVaultIndex,
  createVaultResolver,
  detectLanguage,
  exportDocument,
  findSvgConverter,
  vaultNotes,
  writeExport,
} from '@mdtolatex/node';
import type { ConvertOptions, Theme } from '@mdtolatex/core';
import { MANIFEST_PATH, type ManifestEntry, type SkippedFigure } from './manifest.js';

interface Options {
  vault: string;
  out: string;
  theme: Theme;
  zip: boolean;
  pdf: boolean;
  toc: boolean;
  author: string;
  baseUrl?: string;
  preamble?: string;
  force: boolean;
}

const PUBLIC_PREFIX = 'latex';

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const vault = resolve(options.vault);
  const outRoot = resolve(options.out);

  const index = await createVaultIndex(vault).catch(() => null);
  if (!index) fail(`could not read the vault at "${vault}"`);

  const notes = vaultNotes(index).filter((path) => !isPrivate(path));
  if (!notes.length) fail(`no markdown notes found under "${vault}"`);

  // Looked up once and reused: probing for rsvg-convert per note would spawn a
  // process per file for no reason.
  const converter = await findSvgConverter();
  if (!converter) {
    warn(
      'no SVG converter found. Install librsvg2-bin (rsvg-convert) or inkscape, or ' +
        'every SVG figure will be missing from the output.',
    );
  }

  const preamble = options.preamble
    ? await readFile(resolve(options.preamble), 'utf8').catch(() =>
        fail(`could not read the preamble at "${options.preamble}"`),
      )
    : undefined;

  const manifest: ManifestEntry[] = [];
  const slugs = new Map<string, string>();
  let built = 0;
  let reused = 0;

  for (const note of notes) {
    const title = basename(note, '.md');
    const slug = uniqueSlug(title, note, slugs);
    const outDir = join(outRoot, PUBLIC_PREFIX, slug);
    const stem = slug;

    const entry: ManifestEntry = {
      source: note,
      title,
      slug,
      language: 'english',
      tex: `/${PUBLIC_PREFIX}/${slug}/${stem}.tex`,
      skipped: [],
      unresolved: [],
      warnings: [],
    };

    // A vault of any size makes compiling every note on every build painful, and
    // a static export is a pure function of the note, so unchanged notes are left
    // alone. Wikilinks can reach other notes, but only for their *names*, which a
    // rebuild of the changed note picks up anyway.
    const cached = await readFile(join(outDir, 'entry.json'), 'utf8').catch(() => null);
    if (!options.force && cached && (await isFresh(vault, note, outDir))) {
      manifest.push(JSON.parse(cached) as ManifestEntry);
      reused += 1;
      continue;
    }

    const markdown = await readFile(join(vault, note), 'utf8');
    const unresolved: string[] = [];
    const readAsset = createVaultAssetReader(index, note);

    const convertOptions: ConvertOptions = {
      title,
      author: options.author,
      language: detectLanguage(markdown),
      theme: options.theme,
      toc: options.toc,
      preamble,
      // Links to other notes become URLs on the published site when a base is
      // given, and root-relative paths otherwise.
      vaultBaseUrl: options.baseUrl,
      resolveWikiLink: createVaultResolver(index, note, {
        onUnresolved: (request) => unresolved.push(request.target),
      }),
    };

    const messages: string[] = [];
    const result = await exportDocument({
      markdown,
      options: convertOptions,
      readAsset,
      zip: options.zip,
      pdf: options.pdf,
      texName: `${stem}.tex`,
      converter,
      onWarning: (message) => messages.push(message),
    });

    // Rewritten from scratch: a figure deleted from the vault should disappear
    // from the output too, not linger from an earlier build.
    await rm(outDir, { recursive: true, force: true });
    const written = await writeExport(result, outDir, stem);

    // The `.tex` is offered as its own download, so every figure it includes has
    // to sit beside it at the path it names — otherwise whoever downloads it gets
    // a document with holes, which is the failure this whole pipeline exists to
    // avoid. `writeExport` only emits figures the export *generated*; the ones
    // that already exist in the vault are copied here.
    for (const asset of result.assets) {
      if (asset.isUrl || result.generated.has(asset.path)) continue;
      const data = await readAsset(asset.path);
      if (!data) continue;
      const target = join(outDir, asset.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    }

    entry.language = convertOptions.language ?? 'english';
    entry.skipped = result.skipped;
    entry.unresolved = [...new Set(unresolved)];
    entry.warnings = [...new Set(result.warnings)];
    if (written.zip) entry.zip = `/${PUBLIC_PREFIX}/${slug}/${stem}.zip`;
    if (written.pdf) entry.pdf = `/${PUBLIC_PREFIX}/${slug}/${stem}.pdf`;

    await writeFile(join(outDir, 'entry.json'), JSON.stringify(entry, null, 2), 'utf8');
    manifest.push(entry);
    built += 1;

    for (const message of messages) warn(`${note}: ${message}`);
    for (const asset of result.skipped) {
      warn(`${note}: "${asset.path}" ${asset.reason === 'remote' ? 'is a URL' : 'was not found'}`);
    }
  }

  manifest.sort((a, b) => a.title.localeCompare(b.title));
  await mkdir(join(outRoot, PUBLIC_PREFIX), { recursive: true });
  await writeFile(
    join(outRoot, MANIFEST_PATH),
    JSON.stringify({ generated: new Date().toISOString(), notes: manifest }, null, 2),
    'utf8',
  );

  const missing = manifest.reduce((total, entry) => total + entry.skipped.length, 0);
  const dead = manifest.reduce((total, entry) => total + entry.unresolved.length, 0);
  process.stderr.write(
    `mdtolatex: ${built} note(s) converted, ${reused} unchanged, ` +
      `${missing} missing figure(s), ${dead} dead link(s)\n`,
  );
}

/**
 * Whether the outputs are newer than the note and every figure it could use.
 *
 * Only the note's own mtime is checked, plus the vault's newest attachment: a
 * cheap approximation that errs toward rebuilding, which is the safe direction.
 */
async function isFresh(vault: string, note: string, outDir: string): Promise<boolean> {
  const [source, output] = await Promise.all([
    stat(join(vault, note)).catch(() => null),
    stat(join(outDir, 'entry.json')).catch(() => null),
  ]);
  if (!source || !output) return false;
  return output.mtimeMs > source.mtimeMs;
}

/**
 * Notes a vault should not publish.
 *
 * Anything under a folder starting with `_` or named `private`, which is the
 * convention most vaults already use for drafts and personal material. Better to
 * skip a note the author wanted than to publish one they did not.
 */
function isPrivate(path: string): boolean {
  return path.split('/').some((part) => part.startsWith('_') || part.toLowerCase() === 'private');
}

/** A URL-safe folder name, kept unique across notes that share a basename. */
function uniqueSlug(title: string, note: string, taken: Map<string, string>): string {
  const base =
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'note';

  let slug = base;
  let counter = 2;
  while (taken.has(slug) && taken.get(slug) !== note) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  taken.set(slug, note);
  return slug;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    vault: process.env.VAULT_PATH ?? './vault',
    out: './public',
    theme: 'fancy-academic',
    zip: true,
    pdf: false,
    toc: true,
    author: process.env.VAULT_AUTHOR ?? '',
    baseUrl: process.env.VAULT_BASE_URL,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = (): string => {
      const value = argv[index + 1];
      if (value === undefined) fail(`missing value for ${arg}`);
      index += 1;
      return value;
    };

    switch (arg) {
      case '--vault':
        options.vault = next();
        break;
      case '--out':
        options.out = next();
        break;
      case '--theme': {
        const theme = next();
        if (theme !== 'regular' && theme !== 'fancy-academic') fail(`unknown theme "${theme}"`);
        options.theme = theme;
        break;
      }
      case '--author':
        options.author = next();
        break;
      case '--base-url':
        options.baseUrl = next();
        break;
      case '--preamble':
        options.preamble = next();
        break;
      case '--no-zip':
        options.zip = false;
        break;
      case '--pdf':
        options.pdf = true;
        break;
      case '--no-toc':
        options.toc = false;
        break;
      case '--force':
        options.force = true;
        break;
      case '-h':
      case '--help':
        process.stdout.write(USAGE);
        process.exit(0);
      // eslint-disable-next-line no-fallthrough
      default:
        fail(`unknown option "${arg}"`);
    }
  }
  return options;
}

const USAGE = `Usage: build-vault [options]

  --vault <dir>      Vault to convert (default: ./vault, or $VAULT_PATH)
  --out <dir>        Where to write (default: ./public)
  --theme <name>     regular | fancy-academic (default: fancy-academic)
  --author <text>    Document author
  --base-url <url>   Site that wikilinks should point at
  --preamble <file>  Extra preamble for every note — put your MathJax macros here
  --no-zip           Skip the .zip per note
  --pdf              Also compile a PDF per note (needs xelatex)
  --no-toc           Omit the table of contents
  --force            Rebuild every note, ignoring the cache
`;

function warn(message: string): void {
  process.stderr.write(`mdtolatex: warning: ${message}\n`);
}

function fail(message: string): never {
  process.stderr.write(`mdtolatex: ${message}\n`);
  process.exit(1);
}

// Not top-level await: this app is CommonJS, and tsx refuses to transform one.
main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
