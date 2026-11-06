import { App, PluginSettingTab, Setting } from 'obsidian';
import type { Theme } from '@mdtolatex/core';
import type MdToLatexPlugin from './main.js';
import type { LinkMode } from './links.js';
import { canCompilePdf } from './desktop.js';

export interface MdToLatexSettings {
  /** Folder inside the vault where `.tex` files are written. Empty = next to the note. */
  outputFolder: string;
  /** Author printed on the title page. Empty = the vault name. */
  author: string;
  /** `'auto'` picks Hebrew when the note contains Hebrew letters. */
  language: 'auto' | 'english' | 'hebrew';
  theme: Theme;
  /** Emit `\tableofcontents`. */
  toc: boolean;
  /** Base URL that Obsidian wikilinks are rewritten to. */
  vaultBaseUrl: string;
  /** How resolved wikilinks are rendered. See `LinkMode`. */
  linkMode: LinkMode;
  /** Keep `.md` on note links (off suits a published vault). */
  keepNoteExtension: boolean;
  /** Vault-relative path to a `.sty`/`.tex` file appended to the preamble. */
  preamblePath: string;
  /** Copy the result to the clipboard instead of writing a file. */
  copyToClipboard: boolean;
  /** Also compile a PDF when exporting a bundle. Desktop only. */
  exportPdf: boolean;
  /** The LaTeX engine to run, e.g. `xelatex` or `lualatex`. */
  latexCommand: string;
  /** Converter used to turn SVGs into PDFs so Inkscape isn't needed to compile. */
  svgCommand: string;
}

export const DEFAULT_SETTINGS: MdToLatexSettings = {
  outputFolder: '',
  author: '',
  language: 'auto',
  theme: 'regular',
  toc: true,
  vaultBaseUrl: 'https://uni-folder.vercel.app/',
  linkMode: 'url',
  keepNoteExtension: false,
  preamblePath: '',
  copyToClipboard: false,
  exportPdf: true,
  latexCommand: 'xelatex',
  svgCommand: 'rsvg-convert',
};

export class MdToLatexSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: MdToLatexPlugin,
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Output folder')
      .setDesc('Vault-relative folder for generated .tex files. Leave empty to save next to the note.')
      .addText((text) =>
        text
          .setPlaceholder('latex')
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Author')
      .setDesc('Printed on the title page. Leave empty to use the vault name.')
      .addText((text) =>
        text.setValue(this.plugin.settings.author).onChange(async (value) => {
          this.plugin.settings.author = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Language')
      .setDesc('Auto detects Hebrew notes and switches the document direction.')
      .addDropdown((drop) =>
        drop
          .addOptions({ auto: 'Auto', english: 'English', hebrew: 'Hebrew' })
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value as MdToLatexSettings['language'];
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Theme')
      .addDropdown((drop) =>
        drop
          .addOptions({ regular: 'Regular', 'fancy-academic': 'Fancy academic' })
          .setValue(this.plugin.settings.theme)
          .onChange(async (value) => {
            this.plugin.settings.theme = value as Theme;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Table of contents')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.toc).onChange(async (value) => {
          this.plugin.settings.toc = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Vault base URL')
      .setDesc('Wikilinks become hyperlinks under this URL.')
      .addText((text) =>
        text.setValue(this.plugin.settings.vaultBaseUrl).onChange(async (value) => {
          this.plugin.settings.vaultBaseUrl = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Wikilink handling')
      .setDesc(
        'Obsidian resolves [[links]] through its own index, so the plugin asks the vault where each link points and rewrites it to a path from the vault root. Links Obsidian cannot resolve always fall back to plain text.',
      )
      .addDropdown((drop) =>
        drop
          .addOptions({
            url: 'Link to the published vault URL',
            path: 'Link to the vault-root path',
            plain: 'Plain text, no links',
          })
          .setValue(this.plugin.settings.linkMode)
          .onChange(async (value) => {
            this.plugin.settings.linkMode = value as LinkMode;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (this.plugin.settings.linkMode !== 'plain') {
      new Setting(containerEl)
        .setName('Keep .md on note links')
        .setDesc('Leave off for a published vault, which serves notes without the extension.')
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.keepNoteExtension).onChange(async (value) => {
            this.plugin.settings.keepNoteExtension = value;
            await this.plugin.saveSettings();
          }),
        );
    }

    new Setting(containerEl)
      .setName('Extra preamble file')
      .setDesc('Vault-relative path to a .sty or .tex file appended to the preamble.')
      .addText((text) =>
        text
          .setPlaceholder('latex/preamble.sty')
          .setValue(this.plugin.settings.preamblePath)
          .onChange(async (value) => {
            this.plugin.settings.preamblePath = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Copy to clipboard')
      .setDesc('Copy the LaTeX instead of writing a file into the vault.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.copyToClipboard).onChange(async (value) => {
          this.plugin.settings.copyToClipboard = value;
          await this.plugin.saveSettings();
        }),
      );

    containerEl.createEl('h3', { text: 'Bundle export' });

    if (!canCompilePdf()) {
      // Mobile has no way to run a TeX engine, so the settings below would be
      // misleading without saying so.
      containerEl.createEl('p', {
        text: 'This device cannot compile PDFs — the zip export still works.',
        cls: 'setting-item-description',
      });
    }

    new Setting(containerEl)
      .setName('Also export a PDF')
      .setDesc('Compiles the bundle and writes the PDF beside the .zip. Requires a TeX install.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.exportPdf).onChange(async (value) => {
          this.plugin.settings.exportPdf = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('LaTeX command')
      .setDesc('The engine used to compile. Use a full path if it is not on your PATH.')
      .addText((text) =>
        text
          .setPlaceholder('xelatex')
          .setValue(this.plugin.settings.latexCommand)
          .onChange(async (value) => {
            this.plugin.settings.latexCommand = value.trim() || 'xelatex';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('SVG converter')
      .setDesc(
        'Renders SVGs to PDF so they embed without Inkscape. rsvg-convert or inkscape; ' +
          'leave empty to bundle SVGs unchanged.',
      )
      .addText((text) =>
        text
          .setPlaceholder('rsvg-convert')
          .setValue(this.plugin.settings.svgCommand)
          .onChange(async (value) => {
            this.plugin.settings.svgCommand = value.trim();
            await this.plugin.saveSettings();
          }),
      );
  }
}
