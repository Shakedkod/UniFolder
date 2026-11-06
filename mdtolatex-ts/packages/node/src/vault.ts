/**
 * Reading an Obsidian vault from disk the way Obsidian reads it.
 *
 * Obsidian wikilinks are not paths. `[[Integrals]]` is a *linkpath* resolved
 * against the entire vault by shortest-unique-name rules, so a build script that
 * naively joins it onto a folder resolves almost nothing. In the plugin the
 * metadata cache answers this; here the index below approximates the same rules
 * from the file listing, which is what makes a whole-vault build produce working
 * links and figures instead of a document full of dead references.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import type { ResolvedWikiLink, WikiLinkRequest, WikiLinkResolver } from '@mdtolatex/core';

export interface VaultIndex {
  /** Absolute path to the vault root. */
  root: string;
  /** Every file, as a vault-root-relative POSIX path. */
  files: string[];
  /** Lower-cased basename (with and without extension) to the paths that match. */
  byName: Map<string, string[]>;
}

const IGNORED = new Set(['.git', '.obsidian', '.trash', 'node_modules', '.DS_Store']);

/** Walks `root` and indexes every file for linkpath lookup. */
export async function createVaultIndex(root: string): Promise<VaultIndex> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (IGNORED.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else files.push(relative(root, full).split(sep).join(posix.sep));
    }
  }
  await walk(root);

  const byName = new Map<string, string[]>();
  for (const path of files) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    for (const key of new Set([name, name.replace(/\.[^.]+$/, '')])) {
      const lower = key.toLowerCase();
      const list = byName.get(lower) ?? [];
      list.push(path);
      byName.set(lower, list);
    }
  }

  return { root, files, byName };
}

/**
 * Finds what a linkpath points at, as a vault-root-relative path.
 *
 * Tried in Obsidian's order of preference: the literal path, the same path with
 * `.md` added, a file in the linking note's own folder, then a vault-wide name
 * match. Ambiguous names resolve to the shortest path, which is Obsidian's own
 * tie-break in practice.
 */
export function resolveLinkpath(
  index: VaultIndex,
  target: string,
  sourcePath: string,
): string | null {
  const decoded = safeDecode(target);
  const known = new Set(index.files);
  const sourceDir = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/')) : '';

  const candidates = [
    decoded,
    `${decoded}.md`,
    sourceDir ? posix.join(sourceDir, decoded) : null,
    sourceDir ? posix.join(sourceDir, `${decoded}.md`) : null,
  ].filter((path): path is string => Boolean(path));

  for (const candidate of candidates) if (known.has(candidate)) return candidate;

  const matches = index.byName.get(decoded.toLowerCase());
  if (matches?.length) {
    // Prefer one in the note's own folder, then the shortest path.
    const local = matches.filter((path) => path.startsWith(sourceDir ? `${sourceDir}/` : ''));
    return [...(local.length ? local : matches)].sort((a, b) => a.length - b.length)[0];
  }
  return null;
}

export interface VaultResolverOptions {
  /** Keep `.md` on note links. Off by default — a published vault serves clean paths. */
  keepExtension?: boolean;
  onUnresolved?: (request: WikiLinkRequest) => void;
}

/**
 * A {@link WikiLinkResolver} backed by a vault index, mirroring the Obsidian
 * plugin's behaviour so a build produces the same document the plugin does.
 */
export function createVaultResolver(
  index: VaultIndex,
  sourcePath: string,
  options: VaultResolverOptions = {},
): WikiLinkResolver {
  const { keepExtension = false, onUnresolved } = options;

  return (request: WikiLinkRequest): ResolvedWikiLink | null => {
    // A link with no target is an in-note reference (`[[#Heading]]`); the core
    // builds the self-reference itself.
    if (!request.target) return null;

    const found = resolveLinkpath(index, request.target, sourcePath);
    if (!found) {
      onUnresolved?.(request);
      // A dead link should read as text, not as a hyperlink to nothing.
      return { plain: true };
    }

    // Embeds need the real file path, extension included, because it is handed
    // to a LaTeX include command. An `.excalidraw.md` drawing is rewritten to its
    // exported `.svg` sibling by the core, after this resolver returns.
    if (request.kind === 'embed') return { href: found };

    const isNote = /\.md$/i.test(found);
    // The core prepends `vaultBaseUrl` to any non-absolute href, so a build that
    // wants plain paths simply leaves that unset.
    return { href: isNote && !keepExtension ? found.replace(/\.md$/i, '') : found };
  };
}

/**
 * Reads an asset the way an embed refers to it.
 *
 * Wikilink embeds arrive as vault-root paths while markdown `![](img/x.png)`
 * embeds are relative to the note, so both shapes are tried.
 */
export function createVaultAssetReader(
  index: VaultIndex,
  sourcePath: string,
): (path: string) => Promise<Uint8Array | null> {
  const sourceDir = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/')) : '';

  return async (path: string) => {
    const decoded = safeDecode(path);
    const candidates = [decoded, sourceDir ? posix.join(sourceDir, decoded) : null].filter(
      (candidate): candidate is string => Boolean(candidate),
    );
    // Fall back to a vault-wide name lookup, which is how Obsidian finds an
    // attachment that lives in a folder the note never mentions.
    const found = resolveLinkpath(index, decoded, sourcePath);
    if (found) candidates.push(found);

    for (const candidate of candidates) {
      const data = await readFile(join(index.root, candidate)).catch(() => null);
      if (data) return data;
    }
    return null;
  };
}

/** Every markdown note in the vault, excluding Excalidraw drawing sources. */
export function vaultNotes(index: VaultIndex): string[] {
  return index.files.filter((path) => /\.md$/i.test(path) && !/\.excalidraw\.md$/i.test(path));
}

/** Whether `path` is a directory that exists. */
export async function isDirectory(path: string): Promise<boolean> {
  return stat(path).then(
    (info) => info.isDirectory(),
    () => false,
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}
