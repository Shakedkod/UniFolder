# MDtoLatex — Obsidian plugin

Converts the active note to a LaTeX document using
[`@mdtolatex/core`](../core/README.md).

## Install (manual)

```bash
npm install
npm run build:core                                    # from ts/
npm run build --workspace @mdtolatex/obsidian-plugin
```

Copy `manifest.json` and the generated `main.js` into
`<vault>/.obsidian/plugins/mdtolatex/`, reload Obsidian and enable the plugin
under *Community plugins → Installed plugins*.

## Commands

| Command | What it does |
| --- | --- |
| Convert current note to LaTeX | Writes `<note>.tex` (output folder configurable) |
| Export current note as LaTeX bundle (.zip) | Writes `<note>.zip` with the `.tex` and its figures, plus `<note>.pdf` |
| Copy current note as LaTeX | Puts the whole document on the clipboard |
| Copy selection as LaTeX | Converts just the selected text |

**Convert to LaTeX** and **Export LaTeX bundle (.zip)** are also added to the
file explorer context menu for Markdown files.

## Settings

- **Output folder** — vault-relative; empty saves next to the note.
- **Author** — defaults to the vault name.
- **Language** — `Auto` picks Hebrew when the note contains Hebrew letters.
- **Theme** — `regular`, or `fancy-academic` for coloured headings, a title
  block and boxed theorem environments.
- **Table of contents** — toggles `\tableofcontents`.
- **Vault base URL** — what wikilinks are rewritten to point at.
- **Wikilink handling** — `Link to the published vault URL`, `Link to the
  vault-root path`, or `Plain text, no links`.
- **Keep .md on note links** — off by default; a published vault serves notes
  without the extension.
- **Extra preamble file** — a vault-relative `.sty`/`.tex` appended verbatim.
- **Copy to clipboard** — skip writing a file.
- **Also export a PDF** — compiles the bundle and writes the PDF beside the
  `.zip`. Desktop only; the settings tab says so when the device cannot.
- **LaTeX command** — the engine to run, `xelatex` by default. Use a full path
  if it is not on your `PATH` (common on macOS, where TeX lives in
  `/Library/TeX/texbin`).
- **SVG converter** — `rsvg-convert` or `inkscape`, used to turn SVGs into PDFs.
  Empty bundles them unchanged.

Existing files are overwritten in place. Unsupported blocks are reported in a
notice rather than failing the conversion.

## Why SVGs need converting at all

No LaTeX engine can read an SVG. `\includesvg` does not render anything — it
shells out to **Inkscape** at compile time to produce a PDF and includes that,
so it needs shell-escape enabled *and* Inkscape installed.
[Overleaf has neither](https://tex.stackexchange.com/questions/442077/is-it-possible-to-use-svg-images-with-overleaf),
which is why an exported note there shows
[captions with no figures](https://github.com/overleaf/overleaf/issues/952). The
document still compiles, so nothing tells you.

**Convert current note to LaTeX** therefore renders each SVG to a PDF and writes
it beside the `.tex`, keeping the relative path the document uses:

```
LaTeX/
  My note.tex
  Drawings/sketch.excalidraw.pdf
```

Two cases cannot be converted, and both say so in a notice rather than failing
quietly: **Copy as LaTeX**, which has no file to put the figures next to, and
mobile, which cannot run a converter at all.

Raster images already in your vault are *not* copied — the `.tex` points at them
by their vault path, so it compiles as-is only when the output folder is the
vault root. Use the bundle export for a `.tex` you intend to send anywhere.

## Exporting a bundle

A `.tex` on its own is not portable: its figures are still sitting in your vault
under Obsidian's paths, so anyone who opens the file elsewhere gets a document
full of missing images. The bundle export writes a `.zip` holding the `.tex` and
every figure it references, each at the path the document already uses, so the
extracted folder compiles as-is.

Two things happen automatically, because both otherwise produce a broken export:

- **SVGs — including Excalidraw exports — are rendered to PDF** and the include
  is rewritten to `\includegraphics`. LaTeX's `svg` package shells out to
  Inkscape on every build, so a bundle full of SVGs usually will not compile on
  the machine you send it to. Clear the SVG converter setting to opt out.
- **A figure Obsidian cannot find becomes a labelled box** naming the file.
  A dangling include makes the LaTeX engine emit a truncated, unopenable PDF, so
  one drawing you never exported to SVG would otherwise cost the whole export.

### Excalidraw drawings

An Excalidraw drawing is not an image file: Obsidian stores it as
`sketch.excalidraw.md`, a Markdown note with the scene JSON inside. LaTeX can do
nothing with that, so every embed of a drawing is pointed at the `.svg` the
Excalidraw plugin exports beside it — `![[sketch.excalidraw]]`,
`![[sketch.excalidraw.md]]` and `![](Drawings/sketch.excalidraw.md)` all end up
including `sketch.excalidraw.svg`, which is then converted to PDF like any other
SVG.

That file only exists if Excalidraw is set to write it, so turn on
**Excalidraw → Settings → Export → Auto-export SVG**. Without it the drawing
becomes a placeholder box reading "Excalidraw drawing not exported to SVG" and
naming the file, so it is clear which drawing to re-save rather than silently
vanishing.

On iOS and Android the `.zip` is still written; only the PDF step needs a
desktop, since there is no way to run a TeX engine on a phone.

## How links are translated

Obsidian wikilinks are not paths. `[[Integrals]]` is a *linkpath* that Obsidian
resolves against the whole vault using shortest-unique-name rules, the folder of
the note containing it, and the configured attachment folder — so the same text
can point at different files in different notes. Guessing a path from the text
is wrong often enough to matter, so the plugin asks Obsidian instead:

```ts
app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath) // -> TFile | null
```

The resulting `TFile.path` is already relative to the vault root, which is
exactly what both a published-vault URL and a LaTeX include command want. The
rules the plugin applies (`src/links.ts`):

| Case | Result |
| --- | --- |
| `[[Integrals]]` resolving to `calculus/2 - Integrals.md` | `<base>/calculus/2 - Integrals`, URL-encoded, `.md` dropped |
| `[[Integrals#Fundamental theorem]]` | the same path plus a `#Fundamental theorem` fragment |
| `[[Integrals#^a1b2c3]]` | the same path plus `#^a1b2c3` |
| `[[Integrals\|the theorem]]` | the alias becomes the link text |
| `![[diagram.svg]]` | `attachments/diagram.svg` — real path with extension, for `\includesvg` |
| `[[#Some Heading]]` | an in-document reference; no file lookup |
| `[[No Such Note]]` | plain text, plus a notice listing the unresolved targets |

The **active note's own path** is passed as the source on every conversion, so
links resolve the way they do in the editor. Because the resolution happens
through the metadata cache, a link that works in Obsidian works in the export —
including links that only resolve because of where the note lives.

Unresolved links deliberately become plain text rather than a hyperlink to a
page that does not exist, and are reported in a notice so you can fix them.

## Development

```bash
npm run dev --workspace @mdtolatex/obsidian-plugin   # esbuild watch
```

The plugin works on mobile too: the converter has no filesystem or Node
dependencies, and all I/O goes through Obsidian's vault API.
