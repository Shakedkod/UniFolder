# 🎓 uni-folder

> A high-performance, modern web platform and reader for university academic notes, lecture summaries, problem sets, and formula sheets — powered by Next.js, KaTeX, and a tailored Markdown-to-LaTeX pipeline.

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-blue?style=flat-square&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

---

## ✨ Features

### 📚 Academic Markdown & Math Rendering
- **Full KaTeX Math Engine**: Lightning-fast inline and display math formula rendering, enriched with custom LaTeX macros loaded directly from `preamble.sty`.
- **Obsidian Vault Compatible**: Automatic resolution of Obsidian `[[wikilinks]]`, image embeds (`![[image.png]]`), callouts, and frontmatter.
- **Theorems, Definitions & Callouts**: Specialized styling for definitions, theorems, lemmas, proofs, claims, and remarks with RTL Hebrew typography support.
- **Diagrams & Code**: Syntax highlighting via `highlight.js`, with support for pseudocode, D2 diagrams, Mermaid graphs, and Graphviz (Viz.js).

### 🔍 Lightning-Fast Search
- **Client-Side Indexing**: Powered by `MiniSearch` indexing thousands of items across courses, notes, definitions, theorems, and lemmas.
- **Fuzzy & Prefix Matching**: Instantly locate formulas and academic topics with keyboard navigation (`Ctrl + K`).

### 📑 Hybrid PDF Viewer
- **Native Typography Engine**: Leverages the browser's native C++ PDFium engine for 100% pixel-perfect Hebrew text, Culmus fonts (`DavidCLM`), and vector math.
- **Custom Site Overlay**: Clean custom toolbar and collapsible sidebar on top of the native viewer:
  - Table of Contents (Outline) and page thumbnail grid navigation.
  - Page jumper and zoom controls (Fit-to-Width, reset, zoom in/out).
  - **Pinch-to-Zoom**: Two-finger touchscreen pinch, trackpad/mousepad pinch, and `Ctrl + Wheel` zooming.
  - **Direct PDF Printing**: Prints the actual raw PDF buffer directly without printing the webpage wrapper.
  - **Single-Click Switcher**: Option to switch between the native browser view and the custom PDF.js canvas viewer.

### 📦 Full Course Export (LaTeX & PDF)
- **One-Click Multi-Lecture Export**: Export an entire course folder as a standalone compiled PDF (via XeLaTeX) or as a `.zip` LaTeX bundle.
- **Smart Heading Normalization**: Automatically shifts headings down one level (`#` $\rightarrow$ `##`) while converting note filenames into top-level chapter headings.

### 🎨 Modern Themes & Design
- **Tailwind CSS v4 Engine**: Fluid typography, responsive layout, and dark/light modes.
- **Dynamic Theme Palette**: Multiple curated academic color themes switchable live via the UI.

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| **UI Library** | [React 19](https://react.dev/), [Lucide React](https://lucide.dev/), [React Icons](https://react-icons.github.io/react-icons/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Search** | [MiniSearch](https://github.com/lucaong/minisearch) |
| **Markdown / AST** | `unified`, `remark-math`, `remark-gfm`, `rehype-katex`, `rehype-highlight` |
| **LaTeX Engine** | In-house `@/lib/mdtolatex` converter + local `xelatex` or remote microservice |
| **PDF Processing** | `pdfjs-dist`, `pdf-parse`, Browser PDFium integration |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- *(Optional, for local LaTeX-to-PDF compilation)*: TeX Live / MacTeX with `xelatex` in your system `PATH`.
- *(Optional, for cloud/Vercel PDF export)*: Deploy the included [`latex-service`](file:///C:/Dev/uni-folder/latex-service) to Railway/Render and set `LATEX_COMPILER_URL`.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ShakedKod/uni-folder.git
   cd uni-folder
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables** *(Optional)*:
   Create a `.env.local` file in the root directory:
   ```env
   # Set if syncing from a remote private GitHub vault
   GITHUB_PAT=your_github_personal_access_token
   VAULT_REPO=username/vault-repo
   ```
   > If `GITHUB_PAT` is not set, the sync script automatically defaults to your local vault directory.

---

## 💻 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Launches the Next.js development server on `http://localhost:3000` |
| `npm run sync` | Parses the Obsidian vault, compiles KaTeX macros, builds the search index, and updates public assets |
| `npm run build` | Runs vault synchronization (`sync`) and compiles an optimized production build |
| `npm start` | Starts the production server |
| `npm run lint` | Runs ESLint checks across the codebase |

---

## 📂 Project Structure

```text
uni-folder/
├── public/
│   ├── cmaps/               # PDF Character Maps for Hebrew & CID fonts
│   ├── standard_fonts/      # PDF standard font fallbacks
│   ├── vault/               # Generated static note files & PDFs
│   ├── vault-images/        # Synced images and figures
│   └── search-index.json    # Pre-indexed search database
├── src/
│   ├── app/                 # Next.js App Router pages and API routes
│   │   ├── [...slug]/       # Dynamic note and directory pages
│   │   ├── api/             # API endpoints (course-export, latex, pdf, search)
│   │   ├── globals.css      # Core styles, themes, and textLayer definitions
│   │   └── page.tsx         # Academic homepage with courses categorized by year
│   ├── components/
│   │   ├── Home/            # Homepage sections and search bar
│   │   ├── Note/            # Markdown reader, PDF viewer, Folder view, Exporters
│   │   │   └── pdf/         # Hybrid PDF viewer (PdfViewer.tsx)
│   │   ├── SearchModal/     # Fast overlay search modal
│   │   └── ThemeMenu/       # Palette selector dropdown & buttons
│   ├── lib/
│   │   ├── mdtolatex/       # Markdown-to-LaTeX converter and XeLaTeX compiler
│   │   ├── processor.ts     # Markdown AST pipeline (Unified / Remark / Rehype)
│   │   ├── katex-macros.ts  # LaTeX preamble parser (.sty -> JSON)
│   │   ├── latex-helper.ts  # Heading normalization and multi-lecture bundle helper
│   │   └── vault.ts         # Vault traversal and path resolution utilities
│   └── scripts/
│       └── sync-vault.ts    # Two-pass vault sync and search indexing CLI
└── package.json
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
