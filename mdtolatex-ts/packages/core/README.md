# @mdtolatex/core

Obsidian-flavored Markdown → LaTeX, in TypeScript. This is a port of the Python
converter in `src/` at the repository root.

The package is **pure ESM with no Node-only APIs** — no `fs`, no `path`, no
`process` — so the exact same build runs in a Next.js route handler, in a browser
client component, and inside an Obsidian plugin.

## Install

Inside this repository it is a workspace package:

```jsonc
// package.json
{ "dependencies": { "@mdtolatex/core": "*" } }
```

Then build it once so consumers can resolve `dist/`:

```bash
npm run build:core
```

## Quick start

```ts
import { convert } from '@mdtolatex/core';

const { latex, warnings, head, assets } = convert(markdown, {
  title: 'Calculus 1',
  author: 'Shaked',
  language: 'hebrew',      // any polyglossia language name
  theme: 'regular',        // 'regular' | 'fancy-academic'
  toc: true,
  vaultBaseUrl: 'https://uni-folder.vercel.app/',
  preamble: extraLatex,    // injected verbatim into the preamble
});
```

`convert` is synchronous and pure. `latex` is a complete `.tex` document,
`head` reports which preamble features were switched on, `warnings` lists
node types the renderer did not know how to handle, and `assets` lists every
image and SVG the document includes — deduplicated, in first-appearance order —
so a host can ship those files alongside the `.tex`.

Need the intermediate steps instead?

```ts
import { parseMarkdown, LatexFile } from '@mdtolatex/core';

const ast = parseMarkdown(markdown);         // internal AST (mistune-shaped)
const file = new LatexFile({ title: 'Notes' });
file.mdToLatex(ast);
const latex = file.build();
```

## Options

| Option         | Default              | Notes                                                        |
| -------------- | -------------------- | ------------------------------------------------------------ |
| `title`        | `''`                 | Title page heading.                                          |
| `author`       | `''`                 | Empty hides the author line.                                 |
| `language`     | `'english'`          | `'hebrew'` switches the document to RTL.                     |
| `theme`        | `'regular'`          | `'fancy-academic'` adds coloured headings, a title block and boxed environments. |
| `toc`          | `true`               | Emits `\tableofcontents` + `\newpage`.                       |
| `docDate`      | today                | Hebrew documents get a Hebrew-calendar date.                 |
| `vaultBaseUrl` | `uni-folder.vercel.app` | Base URL wikilinks are rewritten to.                      |
| `resolveWikiLink` | — | Hook that decides where each `[[link]]` and `![[embed]]` points. |
| `preamble`     | `''`                 | Raw LaTeX appended to the preamble.                          |
| `today`        | `new Date()`         | Overridable for deterministic tests.                         |
| `removeMetadata` | `true`             | Strips leading YAML front matter.                            |

## What is supported

- **CommonMark + GFM** — headings, emphasis, lists (nested, ordered, task),
  tables, blockquotes, code, links, images, strikethrough, footnotes.
- **Math** — `$inline$` and `$$block$$`, with `align` rewritten to `aligned`
  and a second pass that catches `$…$` surviving inside table cells.
- **Obsidian callouts** — `> [!theorem] Title` maps onto 14 theorem-like
  environments (definition, theorem, lemma, proof, remark, example, …), with the
  `|*` / `|-` modifiers respected.
- **Hebrew proof blocks** — `**הוכחה:**` … `` `\end{proof}` `` becomes a
  `proof` environment.
- **Wikilinks and embeds** — `[[Note|Alias]]`, `[[Note#Heading]]`,
  `[[#^block-id]]`; external targets become `\href`, same-document targets
  become `\hyperref`.
- **Block ids** — a trailing `^abc123` becomes a `\label`.
- **Diagrams** — `mermaid`, `dot`/`graphviz` and `desmos-graph` fences are converted
  to TikZ / pgfplots. Mermaid flowcharts are laid out by longest-path layering,
  and skip edges are bent so their labels clear intermediate nodes.
- **Hebrew dates** — a self-contained Dershowitz–Reingold conversion with
  gematria formatting (`ז׳ בתשרי ה׳תשפ״ז`), replacing `pyluach` and
  `hebrew_numbers`.
- **RTL/LTR** — code blocks and diagrams are wrapped in `LTR` inside Hebrew
  documents.

## Known limitations

- Wikilink extraction is a text-level pass, so a link *reference definition*
  written as `[target]: …` on its own line could in theory be mistaken for one.
- A callout title is taken from the first text node after the `[!type]` marker,
  so inline math or bold in the title line flows into the body instead. Keep
  callout titles plain.
- `tcolorbox` is unusable under `bidi`: its boxes lose their frames and pile up
  at the page edge. The Hebrew `fancy-academic` theme therefore frames with
  `mdframed`, and the Hebrew `proof` environment is redefined without
  `amsthm`'s `trivlist` so a nested box inside a proof does not break.
- Mermaid support covers flowcharts (`graph`/`flowchart` with `TB/BT/LR/RL`),
  not sequence, class, state or Gantt diagrams. Unknown fences fall through to
  a plain `lstlisting`.
- The generated document expects the packages the preamble declares; compile
  with **XeLaTeX** (required for `fontspec`/`polyglossia`).
- `latex/constants.ts` is generated from `src/logic/latex_constants.py` by
  `scripts/gen-constants.py`. Edit the Python file and re-run
  `npm run gen:constants`, don't hand-edit the TypeScript.

## Resolving wikilinks

`[[Integrals]]` is not a path. Obsidian resolves it against the whole vault
using shortest-unique-name rules, the containing note's folder and the
attachment folder — so the same text can mean different files in different
notes. The core cannot know the answer, so it asks:

```ts
const { latex } = convert(markdown, {
  resolveWikiLink: (request) => {
    // request: { target, heading, blockRef, alias, text, kind }
    if (request.target === 'Integrals') return { href: 'calculus/2 - Integrals' };
    return { plain: true }; // unresolved -> render as text, not a dead link
  },
});
```

A resolver returns any of:

| Field   | Effect                                                                  |
| ------- | ----------------------------------------------------------------------- |
| `href`  | Destination. Absolute URLs pass through; anything else is appended to `vaultBaseUrl`. For `kind: 'embed'` it is the file path handed to `\includegraphics`/`\includesvg`. |
| `label` | Render an in-document `\hyperref` instead. Takes precedence over `href`. |
| `text`  | Override the display text.                                              |
| `plain` | Render as text with no link at all.                                     |

Returning `null`/`undefined` falls back to the default behaviour: append the
target to `vaultBaseUrl`. Heading and block fragments (`#Heading`, `#^blockid`)
are appended by the core, so a resolver only has to answer with the file. A
resolver that throws is downgraded to a warning rather than failing the
conversion. `packages/obsidian-plugin/src/links.ts` is a working implementation
backed by Obsidian's metadata cache.

## Using it from Next.js

Because the package is untranspiled workspace ESM, add it to
`transpilePackages`:

```js
// next.config.mjs
export default { transpilePackages: ['@mdtolatex/core'] };
```

Server-side (recommended — keeps the ~100 kB parser off the client):

```ts
// app/api/convert/route.ts
import { convert } from '@mdtolatex/core';

export async function POST(request: Request) {
  const { markdown, title } = await request.json();
  const { latex } = convert(markdown, { title });
  return Response.json({ latex });
}
```

It also works in a client component (`'use client'`) if you want conversion
without a round trip. A complete example lives in `apps/nextjs-example`.

## Using it from Obsidian

The plugin in `packages/obsidian-plugin` bundles the core with esbuild into a
single CommonJS `main.js`, which is what Obsidian loads:

```ts
import { convert } from '@mdtolatex/core';

const markdown = await this.app.vault.cachedRead(file);
const { latex } = convert(markdown, { title: file.basename });
await this.app.vault.create(`${file.basename}.tex`, latex);
```

Nothing needs polyfilling — the converter never touches the filesystem itself.

## Bundling a document with its figures

A `.tex` on its own will not compile anywhere but the machine it came from: its
figures are still at whatever paths the note used. `buildBundle` packs the
document and its files into one `.zip`.

Reading files is the only part that differs per host — disk, an Obsidian vault,
a browser file picker — so you supply a reader and the rest is shared:

```ts
import { buildBundle, convert, missingBox } from '@mdtolatex/core';

const { latex, assets } = convert(markdown);

const bundle = await buildBundle({
  latex,
  assets,
  texName: 'Notes.tex',
  readAsset: (path) => readFileOrNull(path),   // Uint8Array | null
  // A dangling \includegraphics makes xelatex emit a truncated, unopenable
  // PDF, so replace the include of anything you cannot supply.
  onSkipped: (asset, reason) =>
    missingBox(asset, reason === 'remote' ? 'Remote figure' : 'Missing figure'),
});

await write('Notes.zip', bundle.zip);
```

`bundle.zip` is a `Uint8Array`; `included` lists what went in, `skipped`
explains what did not (`missing`, `remote` or `unreadable`), and `latex` is the
`.tex` actually placed in the archive.

Every asset keeps the relative path the document already references, so the
extracted folder needs no `\graphicspath` and the `.tex` needs no editing.
A file that sits outside the archive root (`../shared/logo.png`) cannot be
represented in a zip, so it is moved under `figures/` and its include is
repointed to match.

### Replacing an SVG with a PDF

`\includesvg` runs Inkscape at compile time, which most machines — and every
phone and CI runner — do not have. If you can render the SVG yourself, swap it:

```ts
import { substituteAsset } from '@mdtolatex/core';

const latex = substituteAsset(original, svgAsset, {
  path: 'figures/chart.pdf',
  kind: 'image',
});
```

This keeps the figure's `width=` option and moves it to `\includegraphics`, so
the document compiles with nothing installed.

### Excalidraw drawings

Obsidian stores an Excalidraw drawing as `sketch.excalidraw.md` — a Markdown
note holding the scene JSON — so a vault lookup for an embed resolves to that
file, not to a picture. Every spelling of the embed is rewritten to the `.svg`
the Excalidraw plugin exports next to it, and `excalidrawSvg(path)` is exported
if a host needs the same mapping:

| In the note | Included |
| --- | --- |
| `![[sketch.excalidraw]]` | `sketch.excalidraw.svg` |
| `![[sketch.excalidraw.md]]` | `sketch.excalidraw.svg` |
| `![](Drawings/sketch.excalidraw.md)` | `Drawings/sketch.excalidraw.svg` |

The rewrite happens after the resolver, so it applies to whatever path the vault
reports. `skippedLabel()` gives an un-exported drawing its own wording, since a
missing `.excalidraw.svg` almost always means auto-export is off rather than a
lost file.

### The zip writer

`createZip(entries, { date })` is available on its own. It is dependency-free
and synchronous, so it runs in Node, a browser and Obsidian on mobile alike:

```ts
import { createZip } from '@mdtolatex/core';

const zip = createZip([{ path: 'a.tex', data: bytes }], { date: fixed });
```

Entries are **stored, not deflated** — compressing would need either
`CompressionStream` or a bundled DEFLATE, and the payload is mostly
already-compressed image data. Filenames are flagged UTF-8, so Hebrew
attachment names survive. There is no ZIP64 support: an entry over 4 GB throws.
Passing a fixed `date` makes the output byte-reproducible.

## On Node: `@mdtolatex/node`

This package deliberately contains no Node API, so one build serves the browser
and Obsidian mobile. That also means it cannot do the things a real export needs:
read a vault, render an SVG, run xelatex. Those live in `@mdtolatex/node`, which
the CLI and the vault build script both use.

```ts
import { createVaultAssetReader, createVaultIndex, createVaultResolver, exportDocument, writeExport } from '@mdtolatex/node';

const index = await createVaultIndex('/path/to/vault');
const result = await exportDocument({
  markdown,
  options: { title: 'Integrals', resolveWikiLink: createVaultResolver(index, 'math/Integrals.md') },
  readAsset: createVaultAssetReader(index, 'math/Integrals.md'),
  zip: true,
  pdf: true,
});
await writeExport(result, 'out', 'integrals');
```

`exportDocument` is `convert()` plus the three things that are easy to forget and
fail silently: SVGs rendered to PDF (no LaTeX engine can read an SVG), figures it
cannot supply turned into labelled boxes (a dangling `\includegraphics` makes
xelatex emit a truncated, unopenable PDF), and the generated figures returned so
they can be written where the document references them.

`createVaultResolver` reproduces Obsidian's name-based link resolution from a
file listing, so a build outside Obsidian resolves `[[Integrals]]` the same way
the plugin does.

## Development

```bash
npm run build:core     # tsc -> packages/core/dist
npm test               # 26 tests, node:test
npm run typecheck      # every workspace
npm run gen:constants  # regenerate latex/constants.ts from the Python source
```
