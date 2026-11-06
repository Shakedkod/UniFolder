import assert from 'node:assert/strict';
import test from 'node:test';
import type { App, TFile } from 'obsidian';
import { convert } from '@mdtolatex/core';
import { createObsidianLinkResolver } from '../src/links.js';

/**
 * A stand-in for Obsidian's metadata cache.
 *
 * The real `getFirstLinkpathDest` resolves a linkpath against the whole vault
 * using shortest-unique-name rules and the source note's folder. The stub keeps
 * the same contract — linkpath in, `TFile | null` out — so the resolver's own
 * logic is what gets tested.
 */
function stubApp(vault: Record<string, string>): App {
  return {
    metadataCache: {
      getFirstLinkpathDest(linkpath: string): TFile | null {
        const path = vault[linkpath];
        if (!path) return null;
        const extension = path.includes('.') ? path.split('.').pop()! : '';
        return { path, extension } as TFile;
      },
    },
  } as unknown as App;
}

const VAULT = {
  Integrals: 'calculus/2 - Integrals.md',
  'diagram.svg': 'attachments/diagram.svg',
};

test('a wikilink becomes a vault-root path under the base URL', () => {
  const resolve = createObsidianLinkResolver(stubApp(VAULT), 'index.md');
  const { latex } = convert('See [[Integrals]].\n', {
    vaultBaseUrl: 'https://example.com/',
    resolveWikiLink: resolve,
  });
  // The shorthand `Integrals` expands to its real path, and `.md` is dropped
  // because a published vault serves the note without it. Spaces are
  // percent-encoded, then `%` is escaped for hyperref.
  assert.match(latex, /href\{https:\/\/example\.com\/calculus\/2\\%20-\\%20Integrals\}/);
  assert.doesNotMatch(latex, /\.md/);
});

test('a heading reference survives the rewrite', () => {
  const resolve = createObsidianLinkResolver(stubApp(VAULT), 'index.md');
  const { latex } = convert('See [[Integrals#Fundamental theorem|the theorem]].\n', {
    vaultBaseUrl: 'https://example.com/',
    resolveWikiLink: resolve,
  });
  assert.match(latex, /Integrals\\#Fundamental/);
  assert.match(latex, /\{the theorem\}/);
});

test('an embed keeps its real path and extension', () => {
  const resolve = createObsidianLinkResolver(stubApp(VAULT), 'notes/deep/note.md');
  const { latex } = convert('![[diagram.svg]]\n', { resolveWikiLink: resolve });
  // An include command needs the file itself, not a URL.
  assert.match(latex, /includesvg.*attachments\/diagram\.svg/);
});

test('an unresolved link is written as plain text and reported', () => {
  const unresolved: string[] = [];
  const resolve = createObsidianLinkResolver(stubApp(VAULT), 'index.md', {
    onUnresolved: (request) => unresolved.push(request.target),
  });
  const { latex } = convert('See [[No Such Note]].\n', {
    vaultBaseUrl: 'https://example.com/',
    resolveWikiLink: resolve,
  });
  assert.doesNotMatch(latex, /href/);
  assert.match(latex, /No Such Note/);
  assert.deepEqual(unresolved, ['No Such Note']);
});

test('keepExtension leaves .md on note links', () => {
  const resolve = createObsidianLinkResolver(stubApp(VAULT), 'index.md', { keepExtension: true });
  const { latex } = convert('[[Integrals]]\n', {
    vaultBaseUrl: 'https://example.com/',
    resolveWikiLink: resolve,
  });
  assert.match(latex, /Integrals\.md/);
});

test('plain mode drops links but keeps embeds', () => {
  const resolve = createObsidianLinkResolver(stubApp(VAULT), 'index.md', { mode: 'plain' });
  const { latex } = convert('[[Integrals]]\n\n![[diagram.svg]]\n', { resolveWikiLink: resolve });
  assert.doesNotMatch(latex, /href/);
  // An embed still has to point somewhere, or the figure disappears.
  assert.match(latex, /attachments\/diagram\.svg/);
});

test('an in-note reference is left to the core', () => {
  const resolve = createObsidianLinkResolver(stubApp(VAULT), 'index.md');
  const { latex } = convert('[[#Some Heading]]\n', { resolveWikiLink: resolve });
  // No file to resolve, so the core builds its own self-reference.
  assert.match(latex, /Some Heading/);
});

test('an Excalidraw embed resolves the drawing file but includes its SVG', () => {
  // Obsidian resolves `![[sketch.excalidraw]]` to the scene file,
  // `sketch.excalidraw.md`, since that is the file that actually exists. LaTeX
  // needs the SVG the Excalidraw plugin exports beside it instead.
  const resolve = createObsidianLinkResolver(
    stubApp({ 'sketch.excalidraw': 'Drawings/sketch.excalidraw.md' }),
    'index.md',
  );
  const { latex, assets } = convert('![[sketch.excalidraw]]\n', { resolveWikiLink: resolve });

  assert.deepEqual(assets.map((asset) => asset.path), ['Drawings/sketch.excalidraw.svg']);
  assert.match(latex, /\\includesvg\[width=0\.8\\textwidth\]\{Drawings\/sketch\.excalidraw\.svg\}/);
});
