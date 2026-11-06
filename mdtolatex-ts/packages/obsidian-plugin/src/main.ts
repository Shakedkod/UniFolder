import {
  Notice,
  Plugin,
  TFile,
  TFolder,
  normalizePath,
  type MarkdownFileInfo,
  type MarkdownView,
  type Editor,
} from 'obsidian';
import {
  buildBundle,
  convert,
  missingBox,
  placeholderForAsset,
  skippedLabel,
  substituteAsset,
  type AssetReference,
  type ConvertOptions,
  type SkippedAsset,
} from '@mdtolatex/core';
import { DEFAULT_SETTINGS, MdToLatexSettingTab, type MdToLatexSettings } from './settings.js';
import { createObsidianLinkResolver } from './links.js';
import { canCompilePdf, compilePdf, convertSvgToPdf, type BuildFiles } from './desktop.js';

const HEBREW_RE = /[\u0590-\u05FF]/;

export default class MdToLatexPlugin extends Plugin {
  override settings: MdToLatexSettings = { ...DEFAULT_SETTINGS };

  override async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new MdToLatexSettingTab(this.app, this));

    this.addCommand({
      id: 'convert-note-to-latex',
      name: 'Convert current note to LaTeX',
      editorCallback: (_editor: Editor, context: MarkdownView | MarkdownFileInfo) => {
        const file = context.file;
        if (file) void this.convertFile(file);
      },
    });

    this.addCommand({
      id: 'export-note-as-latex-bundle',
      name: 'Export current note as LaTeX bundle (.zip)',
      editorCallback: (_editor: Editor, context: MarkdownView | MarkdownFileInfo) => {
        const file = context.file;
        if (file) void this.exportBundle(file);
      },
    });

    this.addCommand({
      id: 'copy-note-as-latex',
      name: 'Copy current note as LaTeX',
      editorCallback: (_editor: Editor, context: MarkdownView | MarkdownFileInfo) => {
        const file = context.file;
        if (file) void this.convertFile(file, { forceClipboard: true });
      },
    });

    this.addCommand({
      id: 'copy-selection-as-latex',
      name: 'Copy selection as LaTeX',
      editorCheckCallback: (checking: boolean, editor: Editor) => {
        const selection = editor.getSelection();
        if (!selection.trim()) return false;
        if (!checking) void this.copySelection(selection);
        return true;
      },
    });

    // Right-click a note in the file explorer.
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        menu.addItem((item) =>
          item
            .setTitle('Convert to LaTeX')
            .setIcon('file-code')
            .onClick(() => void this.convertFile(file)),
        );
        menu.addItem((item) =>
          item
            .setTitle('Export LaTeX bundle (.zip)')
            .setIcon('file-archive')
            .onClick(() => void this.exportBundle(file)),
        );
      }),
    );
  }

  // ------------------------------------------------------------------ core

  /**
   * Builds the converter options for a given note.
   *
   * `sourcePath` is the note the markdown came from. Obsidian resolves the same
   * `[[link]]` differently depending on which note contains it, so this has to
   * be threaded through to the link resolver.
   */
  private async buildOptions(
    markdown: string,
    title: string,
    sourcePath: string,
    /** Collects the targets of links Obsidian could not resolve. */
    unresolved: string[] = [],
  ): Promise<ConvertOptions> {
    const { language, author, theme, toc, vaultBaseUrl, linkMode, keepNoteExtension, preamblePath } =
      this.settings;
    return {
      title,
      author: author || this.app.vault.getName(),
      language: language === 'auto' ? (HEBREW_RE.test(markdown) ? 'hebrew' : 'english') : language,
      theme,
      toc,
      // In `path` mode the base collapses to `/`, leaving a root-relative link.
      vaultBaseUrl: linkMode === 'path' ? '/' : vaultBaseUrl || undefined,
      resolveWikiLink: createObsidianLinkResolver(this.app, sourcePath, {
        mode: linkMode,
        keepExtension: keepNoteExtension,
        onUnresolved: (request) => unresolved.push(request.target),
      }),
      preamble: await this.readPreamble(preamblePath),
    };
  }

  private async readPreamble(path: string): Promise<string | undefined> {
    if (!path) return undefined;
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) {
      new Notice(`MDtoLatex: preamble file not found at "${path}"`);
      return undefined;
    }
    return this.app.vault.cachedRead(file);
  }

  private async convertFile(file: TFile, options: { forceClipboard?: boolean } = {}): Promise<void> {
    try {
      const markdown = await this.app.vault.cachedRead(file);
      const unresolved: string[] = [];
      const { latex, warnings, assets } = convert(
        markdown,
        await this.buildOptions(markdown, file.basename, file.path, unresolved),
      );

      const clipboard = options.forceClipboard || this.settings.copyToClipboard;

      // No LaTeX engine can read an SVG — `\includesvg` shells out to Inkscape at
      // compile time, which Overleaf does not have, and the figure then silently
      // fails to appear while the document still compiles. So the SVGs are turned
      // into PDFs and the includes rewritten here too, not only for the archive.
      const loaded = await this.loadAssets(assets, file.path);
      const prepared = await this.renderSvgAssets(latex, assets, loaded);
      const converted = new Map(
        [...prepared.files].filter(([path]) => !loaded.has(path) && path !== file.path),
      );

      let docLatex = prepared.latex;
      const skipped: { path: string; reason: SkippedAsset['reason'] }[] = [];
      for (const asset of prepared.assets) {
        if (prepared.files.has(asset.path)) continue;
        // A dangling include makes the engine emit a truncated, unopenable PDF,
        // so what cannot be supplied becomes a labelled box.
        const reason = asset.isUrl ? 'remote' : 'missing';
        docLatex = placeholderForAsset(docLatex, asset, skippedLabel(asset, reason));
        skipped.push({ path: asset.path, reason });
      }

      if (clipboard) {
        await navigator.clipboard.writeText(docLatex);
        new Notice(`MDtoLatex: "${file.basename}" copied as LaTeX`);
        if (converted.size) {
          // The clipboard cannot carry the figure files the text now points at.
          new Notice(
            `MDtoLatex: ${converted.size} converted figure(s) were not saved — ` +
              'write to a file, or use the bundle export, to get them',
            8000,
          );
        }
      } else {
        const target = await this.writeOutput(file, docLatex);
        // The rewritten includes point at these, so they have to sit beside the
        // .tex for it to compile.
        const folder = this.outputFolder(file);
        for (const [path, data] of converted) await this.writeBinary(folder, path, data);
        const extra = converted.size ? ` (+${converted.size} converted figure(s))` : '';
        new Notice(`MDtoLatex: wrote ${target}${extra}`);
      }

      // On mobile, or with the SVG converter setting cleared, nothing can be
      // converted — so say why the figures will be missing rather than letting
      // the document quietly compile without them.
      const unconverted = prepared.assets.filter(
        (asset) => asset.kind === 'svg' && !asset.isUrl && prepared.files.has(asset.path),
      );
      if (unconverted.length) {
        new Notice(
          `MDtoLatex: ${unconverted.length} SVG(s) kept as \\includesvg, which needs Inkscape ` +
            'at compile time and will not render on Overleaf',
          8000,
        );
      }

      this.reportSkipped(skipped);

      if (warnings.length > 0) {
        new Notice(`MDtoLatex: unsupported blocks skipped — ${unique(warnings).join(', ')}`, 8000);
      }

      if (unresolved.length > 0) {
        // These are links Obsidian itself cannot follow, so they were written as
        // plain text rather than pointed at a page that does not exist.
        new Notice(
          `MDtoLatex: ${unique(unresolved).length} unresolved link(s) kept as plain text — ${unique(unresolved).slice(0, 5).join(', ')}`,
          8000,
        );
      }
    } catch (error) {
      console.error('MDtoLatex conversion failed', error);
      new Notice(`MDtoLatex failed: ${describe(error)}`, 8000);
    }
  }

  private async copySelection(selection: string): Promise<void> {
    try {
      // A selection has no file of its own, so its links resolve against the
      // note it was copied from.
      const sourcePath = this.app.workspace.getActiveFile()?.path ?? '';
      const { latex } = convert(
        selection,
        await this.buildOptions(selection, 'Selection', sourcePath),
      );
      await navigator.clipboard.writeText(latex);
      new Notice('MDtoLatex: selection copied as LaTeX');
    } catch (error) {
      console.error('MDtoLatex conversion failed', error);
      new Notice(`MDtoLatex failed: ${describe(error)}`, 8000);
    }
  }

  // ---------------------------------------------------------------- bundle

  /**
   * Writes a `.zip` holding the `.tex` and every figure it needs, plus a PDF
   * beside it when this device can compile one.
   *
   * A bare `.tex` is not much use on its own: the figures live in the vault under
   * Obsidian's own paths, so anyone opening the file elsewhere gets a document
   * full of missing images.
   */
  private async exportBundle(file: TFile): Promise<void> {
    try {
      const markdown = await this.app.vault.cachedRead(file);
      const unresolved: string[] = [];
      const { latex, assets } = convert(
        markdown,
        await this.buildOptions(markdown, file.basename, file.path, unresolved),
      );

      const texName = `${file.basename}.tex`;
      const loaded = await this.loadAssets(assets, file.path);
      const prepared = await this.renderSvgAssets(latex, assets, loaded);

      const bundle = await buildBundle({
        latex: prepared.latex,
        assets: prepared.assets,
        texName,
        readAsset: (path) => prepared.files.get(path) ?? null,
        // A figure the archive cannot supply makes the LaTeX engine emit a
        // truncated, unopenable PDF, so the include becomes a labelled box.
        onSkipped: (asset, reason) => missingBox(asset, skippedLabel(asset, reason)),
      });

      const folder = this.outputFolder(file);
      const zipPath = await this.writeBinary(folder, `${file.basename}.zip`, bundle.zip);
      const parts = [`${bundle.included.length} asset(s)`];

      if (this.settings.exportPdf) {
        const files: BuildFiles = new Map([
          [texName, new TextEncoder().encode(bundle.latex)],
          ...bundle.included.map(
            (path) => [path, prepared.files.get(path)!] as [string, Uint8Array],
          ),
        ]);
        const result = await compilePdf({
          files,
          texName,
          command: this.settings.latexCommand,
        });
        if (result.ok) {
          await this.writeBinary(folder, `${file.basename}.pdf`, result.pdf);
          parts.push('PDF');
        } else {
          new Notice(`MDtoLatex: no PDF — ${result.reason}`, 8000);
        }
      }

      new Notice(`MDtoLatex: wrote ${zipPath} (${parts.join(', ')})`);
      this.reportSkipped(bundle.skipped);
    } catch (error) {
      console.error('MDtoLatex bundle export failed', error);
      new Notice(`MDtoLatex failed: ${describe(error)}`, 8000);
    }
  }

  /**
   * Reads every asset the document needs out of the vault.
   *
   * Paths arrive in two shapes: wikilink embeds come back as vault-root paths from
   * the link resolver, while a markdown `![](img/x.png)` is relative to the note.
   * Obsidian's own lookup handles the second, so both are tried.
   */
  private async loadAssets(
    assets: AssetReference[],
    sourcePath: string,
  ): Promise<Map<string, Uint8Array>> {
    const files = new Map<string, Uint8Array>();
    for (const asset of assets) {
      if (asset.isUrl) continue;
      const path = normalizePath(asset.path);
      const direct = this.app.vault.getAbstractFileByPath(path);
      const target =
        direct instanceof TFile
          ? direct
          : this.app.metadataCache.getFirstLinkpathDest(decodeURI(path), sourcePath);
      if (!(target instanceof TFile)) continue;
      files.set(asset.path, new Uint8Array(await this.app.vault.readBinary(target)));
    }
    return files;
  }

  /**
   * Swaps SVGs for PDF renderings where possible.
   *
   * `\includesvg` runs Inkscape at compile time, which most machines lack, so a
   * bundle full of SVGs often will not build on the machine it is sent to.
   */
  private async renderSvgAssets(
    latex: string,
    assets: AssetReference[],
    files: Map<string, Uint8Array>,
  ): Promise<{ latex: string; assets: AssetReference[]; files: Map<string, Uint8Array> }> {
    const command = this.settings.svgCommand;
    if (!command || !canCompilePdf()) return { latex, assets, files };

    let result = latex;
    const nextAssets = [...assets];
    const nextFiles = new Map(files);

    for (const [index, asset] of assets.entries()) {
      if (asset.kind !== 'svg' || asset.isUrl) continue;
      const data = files.get(asset.path);
      if (!data) continue;
      const pdf = await convertSvgToPdf(data, command);
      if (!pdf) continue;

      const replacement: AssetReference = {
        path: `${asset.path.replace(/\.svg$/i, '')}.pdf`,
        kind: 'image',
        isUrl: false,
      };
      result = substituteAsset(result, asset, replacement);
      nextAssets[index] = replacement;
      nextFiles.set(replacement.path, pdf);
    }

    return { latex: result, assets: nextAssets, files: nextFiles };
  }

  private reportSkipped(skipped: { path: string; reason: string }[]): void {
    if (!skipped.length) return;
    const missing = skipped.filter((asset) => asset.reason !== 'remote');
    if (!missing.length) return;
    new Notice(
      `MDtoLatex: ${missing.length} figure(s) could not be bundled — ` +
        `${missing.slice(0, 5).map((asset) => asset.path).join(', ')}`,
      8000,
    );
  }

  private outputFolder(source: TFile): string {
    return this.settings.outputFolder
      ? normalizePath(this.settings.outputFolder)
      : (source.parent?.path ?? '');
  }

  /** Writes (or overwrites) a binary file in the vault and returns its path. */
  private async writeBinary(folder: string, name: string, data: Uint8Array): Promise<string> {
    const path = normalizePath(folder ? `${folder}/${name}` : name);
    // `name` can carry subfolders of its own — a converted figure keeps the
    // relative path the document references, e.g. `Drawings/sketch.pdf`.
    await this.ensureFolder(path.slice(0, path.lastIndexOf('/') + 1).replace(/\/$/, ''));
    const existing = this.app.vault.getAbstractFileByPath(path);
    const buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
    if (existing instanceof TFile) await this.app.vault.modifyBinary(existing, buffer);
    else await this.app.vault.createBinary(path, buffer);
    return path;
  }

  /** Writes (or overwrites) the `.tex` file and returns its vault path. */
  private async writeOutput(source: TFile, latex: string): Promise<string> {
    const folder = this.outputFolder(source);
    await this.ensureFolder(folder);

    const path = normalizePath(folder ? `${folder}/${source.basename}.tex` : `${source.basename}.tex`);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) await this.app.vault.modify(existing, latex);
    else await this.app.vault.create(path, latex);
    return path;
  }

  private async ensureFolder(path: string): Promise<void> {
    if (!path || path === '/' || path === '.') return;
    if (this.app.vault.getAbstractFileByPath(path) instanceof TFolder) return;
    await this.app.vault.createFolder(path).catch(() => undefined);
  }

  // -------------------------------------------------------------- settings

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<MdToLatexSettings>) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

const unique = (values: string[]): string[] => [...new Set(values)];

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
