import type { App, TFile } from 'obsidian';
import type { ResolvedWikiLink, WikiLinkRequest, WikiLinkResolver } from '@mdtolatex/core';

/**
 * How a wikilink that Obsidian *can* resolve should be rendered.
 *
 * - `url` — `<vaultBaseUrl>/<vault-root path>` hyperlink (a published vault).
 * - `path` — a root-relative `/<vault-root path>` link. The plugin pairs this
 *   with `vaultBaseUrl: '/'`, which is what makes the base drop away.
 * - `plain` — no link at all, just the display text.
 */
export type LinkMode = 'url' | 'path' | 'plain';

export interface ObsidianLinkResolverOptions {
  /** What to do with links Obsidian resolves to a real note. */
  mode?: LinkMode;
  /**
   * Keep the `.md` extension on note paths. Off by default: a published vault
   * serves `math/Integrals`, not `math/Integrals.md`.
   */
  keepExtension?: boolean;
  /** Called for every link Obsidian could not resolve. */
  onUnresolved?: (request: WikiLinkRequest) => void;
}

/**
 * Bridges Obsidian's link system to the converter.
 *
 * Obsidian wikilinks are *not* paths. `[[Integrals]]` is a "linkpath" that
 * Obsidian resolves against the whole vault using shortest-unique-name rules,
 * the note's own folder, and the configured attachment folder — so the same
 * text can mean different files in different notes. Only the metadata cache
 * knows the answer, so ask it rather than guessing, and always pass the
 * *source note's* path so relative and ambiguous links resolve the way they do
 * in the editor.
 *
 * Every resolved target is returned as a path relative to the vault root, which
 * is what both a published vault URL and a LaTeX `\includegraphics` root expect.
 */
export function createObsidianLinkResolver(
  app: App,
  sourcePath: string,
  options: ObsidianLinkResolverOptions = {},
): WikiLinkResolver {
  const { mode = 'url', keepExtension = false, onUnresolved } = options;

  return (request: WikiLinkRequest): ResolvedWikiLink | null => {
    // A link with no target is an in-note reference (`[[#Heading]]`,
    // `[[#^block]]`). There is no file to resolve; the core builds the
    // self-reference itself.
    if (!request.target) return null;

    const dest: TFile | null = app.metadataCache.getFirstLinkpathDest(request.target, sourcePath);

    if (!dest) {
      onUnresolved?.(request);
      // Nothing to point at. A dead link should read as text, not as a
      // hyperlink to a page that does not exist.
      return { plain: true };
    }

    // Embeds (images, SVGs, PDFs, `![[note]]`) need the real file path,
    // extension included, because it is handed to a LaTeX include command.
    if (request.kind === 'embed') return { href: dest.path };

    const isNote = dest.extension === 'md';
    const href = isNote && !keepExtension ? stripExtension(dest.path) : dest.path;

    if (mode === 'plain') return { plain: true };
    // The core prepends `vaultBaseUrl` to any non-absolute href, so `'url'` and
    // `'path'` differ only in the base the plugin configured.
    return { href };
  };
}

const stripExtension = (path: string): string => path.replace(/\.md$/, '');
