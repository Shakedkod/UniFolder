# MDtoLatex — TypeScript

A TypeScript port of the Python converter in `../src`, packaged so the same
conversion logic can be used from a Next.js website **and** from an Obsidian
plugin.

```
ts/
├── packages/
│   ├── core/             @mdtolatex/core — the converter (pure ESM, no Node APIs)
│   ├── node/             @mdtolatex/node — vault reading, SVG→PDF, xelatex
│   ├── obsidian-plugin/  Obsidian plugin, bundled with esbuild
│   └── cli/              `mdtolatex notes.md --pdf` (replaces the Python wizard)
├── apps/
│   └── nextjs-example/   Next.js demo: API route, client UI, vault build script
└── scripts/
    └── gen-constants.py  regenerates core/src/latex/constants.ts from Python
```

## Getting started

```bash
cd ts
npm install
npm run build:core   # required before the app or plugin can resolve the package
npm test             # 82 tests
npm run typecheck    # all five workspaces
```

## Use it from your website

```bash
npm run dev:web      # http://localhost:3000
```

`apps/nextjs-example` shows both halves: a route handler at
`app/api/convert/route.ts` that accepts `{ markdown, title, … }` and returns
`{ latex, warnings, head, assets }`, and a client component that edits Markdown,
shows the LaTeX and downloads a `.tex`, a `.zip` or a `.pdf`. Copy either into
your own site — the only Next-specific setup is
`transpilePackages: ['@mdtolatex/core']`.

The browser cannot read a figure off the visitor's disk on its own, so after a
conversion the page lists the images the document needs and asks for them; the
`.zip` is then assembled client-side, with no upload and no server involved.
Anything not supplied becomes a labelled placeholder box rather than a dangling
include, which would produce an unopenable PDF.

The PDF is the one thing that cannot happen in the browser — it needs a TeX
engine. `app/api/pdf/route.ts` takes the `.tex` and its figures as multipart
form data and runs `xelatex` in a temp dir. **Vercel's runtime has no TeX
install**, so the route answers `501` there and the UI hides the PDF button; to
offer PDFs in production, deploy that route somewhere you control the image
(a container, Fly, Railway) or hand the `.zip` to a LaTeX service such as
Overleaf.

## Convert a whole vault at build time

Everything above happens while someone is *looking* at the page, which is the
restrictive case: no filesystem, no subprocesses, so no SVG conversion and no
PDF. A build step has none of those limits — it is ordinary Node — so a site that
publishes a vault should convert at build time and serve static files.

```bash
cd apps/nextjs-example
npm run build:vault -- --vault ../../../my-vault --pdf --author "Your Name"
npm run build
```

That walks the vault, converts every note, and writes into `public/`:

```
public/latex/
  manifest.json              every note, with its downloads and its problems
  integrals/
    integrals.tex            compiles as-is
    integrals.zip            the same document, packed with its figures
    integrals.pdf            compiled during the build
    img/plot.png             copied, because the .tex references it
    Drawings/sketch.excalidraw.pdf   converted from the exported .svg
```

`/vault` lists them from `manifest.json`, prerendered. The deployed site runs no
converter and needs no TeX install, because the work already happened.

| Option | |
| --- | --- |
| `--vault <dir>` | the vault to convert (or `$VAULT_PATH`) |
| `--out <dir>` | where to write (default `./public`) |
| `--theme`, `--author`, `--no-toc` | as the CLI |
| `--base-url <url>` | site that `[[wikilinks]]` should point at |
| `--preamble <file>` | preamble for every note — **put your MathJax macros here** |
| `--no-zip`, `--pdf` | which downloads to produce |
| `--force` | rebuild everything, ignoring the cache |

Notes are skipped when their outputs are newer than the source, so a rebuild
after editing one note is fast even when `--pdf` is on. Anything under a folder
starting with `_`, or named `private`, is never published.

### Your own macros

`[[wikilinks]]` resolve the way Obsidian resolves them — by name, across the
whole vault — so the build reproduces what the plugin produces. What does *not*
come across is your MathJax macro set: `\parder{f}{x}` is defined in Obsidian's
own configuration, and LaTeX has never heard of it, so it compiles to
`! Undefined control sequence` and that part of the formula is dropped. Put the
definitions in one file and pass `--preamble`:

```latex
% macros.tex
\newcommand{\parder}[2]{\frac{\partial #1}{\partial #2}}
```

### Where to run it

The conversion needs `rsvg-convert` for figures and `xelatex` for PDFs, so *where*
the build runs matters more than what it runs on:

- **GitHub Actions** (or any CI you control) — `apt-get install librsvg2-bin
  texlive-xetex …` and you are done. See
  [`vault-build.example.yml`](apps/nextjs-example/vault-build.example.yml) for a
  workflow that checks out the vault as a second repository, caches the converted
  notes, and deploys the built site. This is the recommended shape: the vault can
  stay private while the generated documents are published.
- **Vercel's build step** can install packages — set `installCommand` to
  `dnf install -y librsvg2-tools && npm ci`
  ([build image](https://vercel.com/docs/builds/build-image)). Worth knowing this
  is only true at *build* time; the serverless runtime cannot, which is why
  `app/api/pdf/route.ts` answers `501` in production. A full TeX install is a
  poor fit for a build container either way — compile the PDFs in CI.
- **Your own machine**, committing `public/latex/` — fine for a vault that
  changes rarely, and the only option with no CI at all.

## Use it from Obsidian

```bash
npm run build --workspace @mdtolatex/obsidian-plugin
```

Copy `manifest.json` and `main.js` from `packages/obsidian-plugin/` into
`<vault>/.obsidian/plugins/mdtolatex/` and enable the plugin. It adds three
commands — convert the current note to a `.tex` file, copy the current note as
LaTeX, copy the selection as LaTeX — plus a "Convert to LaTeX" item in the file
explorer context menu, and a settings tab for output folder, author, language,
theme, table of contents, wikilink handling, vault URL and an extra preamble
file.

Obsidian wikilinks are resolved through Obsidian itself
(`metadataCache.getFirstLinkpathDest`) rather than guessed from their text, so
`[[Integrals]]` becomes the note's real path from the vault root and embeds keep
the exact attachment path a LaTeX include command needs. Links Obsidian cannot
resolve are written as plain text and reported in a notice. See
`packages/obsidian-plugin/README.md` for the full translation table.

During development, `npm run dev --workspace @mdtolatex/obsidian-plugin`
rebuilds `main.js` on change; point it at a real vault by symlinking the folder.

## Use it from the terminal

```bash
npm run cli -- ../test/sample_he.md --author Shaked --zip --pdf
```

Flags replace the interactive `questionary` prompts of `src/main.py`:
`--out`, `--title`, `--author`, `--language`, `--theme`, `--no-toc`,
`--preamble`, `--vault-url`, `--zip`, `--assets`, `--keep-svg`, `--pdf`,
`--stdout`.

### Why SVGs need converting at all

No LaTeX engine can read an SVG. `\includesvg` does not render anything — it
shells out to **Inkscape** at compile time to make a PDF, then includes that. So
it needs shell-escape enabled *and* Inkscape installed, and
[Overleaf has neither](https://tex.stackexchange.com/questions/442077/is-it-possible-to-use-svg-images-with-overleaf).
When it fails the document still compiles; the figure is just absent, with
nothing but a buried log warning to say so.

So every export converts SVGs to PDF up front and emits `\includegraphics`. A
plain `.tex` export writes the converted figures beside it:

```
out/
  Report.tex
  img/chart.pdf     converted from img/chart.svg, because the .tex references it
```

`--keep-svg` opts out and emits `\includesvg`, if you know the machine that
compiles it has Inkscape. `--stdout` cannot write the figures, so it warns
instead.

Raster images are *not* copied by a plain export — they stay in place, so the
`.tex` resolves them only when it sits where the note did. Use `--zip` for a
`.tex` that travels.

### Exporting a bundle

A bare `.tex` is not portable: its figures still live wherever the note kept
them. `--zip` writes an archive containing the `.tex` plus every image it
includes, each at the same relative path the document references, so the
extracted folder compiles as-is. `--pdf` compiles that same set of files and
puts the PDF beside the archive:

```
out/
  Report.tex     the document, with converted figures beside it
  img/chart.pdf  what Report.tex now includes instead of img/chart.svg
  Report.zip     the document + img/plot.png + img/chart.pdf
  Report.pdf     compiled from exactly what the archive holds
```

Images are read from the note's own folder; point `--assets <dir>` elsewhere if
your attachments live apart from your notes.

Two things happen automatically, because both otherwise produce a broken export:

- **SVGs are rendered to PDF** (via `rsvg-convert` or `inkscape`, whichever is
  installed) and the include is rewritten to `\includegraphics`. LaTeX's `svg`
  package shells out to Inkscape on every build, so an archive full of SVGs
  usually will not compile on the machine you send it to. `--keep-svg` opts out.
- **A figure that cannot be found becomes a labelled box** naming the missing
  file. Left as-is, a dangling `\includegraphics` makes xelatex emit a
  truncated, unopenable PDF — one un-exported drawing would cost you the whole
  export.

## Notes on the port

- The split between `core` and `node` is what keeps one build working in three
  places. `core` touches no Node API, so it runs in the browser and on Obsidian
  mobile; everything needing a filesystem or a subprocess lives in `node`, shared
  by the CLI and the vault build. That sharing is not tidiness: the plain `.tex`
  export once diverged from the archive export and quietly stopped converting
  SVGs, which is exactly the bug one pipeline in one place cannot have.
- `packages/core/src/latex/constants.ts` is **generated** from
  `../src/logic/latex_constants.py`. Change the Python file, then run
  `npm run gen:constants`.
- The internal AST deliberately keeps the `mistune` token shape
  (`type` / `raw` / `children` / `attrs`) so the renderer is a line-by-line port
  and AST dumps stay comparable between the two implementations. The Markdown
  front-end is micromark/mdast; Obsidian syntax is recovered in the adapter.
- Output was diffed against the Python `.tex` fixtures in `../test`. It matches,
  except where the port fixes real bugs: inline code and code blocks inside list
  items used to be dropped, and CRLF notes used to leak stray carriage returns.
- `fancy-academic`, an empty `pass` in the Python original, is now a real theme:
  coloured section rules, a title block, and boxed theorem environments that
  reuse the same `amsthm` names, so the renderer is unchanged. English boxes use
  `tcolorbox`; Hebrew uses `mdframed`, because `tcolorbox` collapses under
  `bidi`.
- Every theme/language combination is verified by actually compiling with
  XeLaTeX, not just by string assertions.
- `pyluach` and `hebrew_numbers` are replaced by a self-contained Hebrew
  calendar implementation, verified against known dates (1 Tishrei 5784 =
  16 Sep 2023, 15 Nisan 5785 = 13 Apr 2025).

See `packages/core/README.md` for the full API, option list and limitations.
