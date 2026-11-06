'use client';

import { useMemo, useState, useTransition } from 'react';
import { buildBundle, missingBox, skippedLabel, type AssetReference } from '@mdtolatex/core';

const SAMPLE = `> [!theorem] Pythagoras
> For a right triangle, $a^2 + b^2 = c^2$.

**הוכחה:** ברור.
\`\\end{proof}\`

See [[Linear Algebra|LA]] for details.

\`\`\`mermaid
graph TB
A[Start] --> B{Choice}
B --> C[Done]
\`\`\`
`;

interface ConvertResponse {
  latex?: string;
  warnings?: string[];
  assets?: AssetReference[];
  error?: string;
}

/** Strips any folders from a path, which is all a file picker gives us. */
const fileKey = (path: string): string => path.split('/').pop()!.toLowerCase();

export default function Converter() {
  const [markdown, setMarkdown] = useState(SAMPLE);
  const [title, setTitle] = useState('My notes');
  const [latex, setLatex] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [assets, setAssets] = useState<AssetReference[]>([]);
  const [figures, setFigures] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pending, startTransition] = useTransition();

  /**
   * The figures still needed.
   *
   * A browser only ever learns a file's name, never the folder it came from, so
   * attachments are matched to the document's paths by filename alone.
   */
  const needed = useMemo(() => {
    const have = new Set(figures.map((file) => file.name.toLowerCase()));
    return assets.filter((asset) => !asset.isUrl && !have.has(fileKey(asset.path)));
  }, [assets, figures]);

  function handleConvert() {
    startTransition(async () => {
      setError('');
      setWarnings([]);
      try {
        const response = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ markdown, title }),
        });
        const data = (await response.json()) as ConvertResponse;
        if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);
        setLatex(data.latex ?? '');
        setWarnings(data.warnings ?? []);
        setAssets(data.assets ?? []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Conversion failed.');
        setLatex('');
      }
    });
  }

  /**
   * Assembles the `.tex` and every attached figure into one archive, in the
   * browser — the server never sees the images, and a bare `.tex` full of missing
   * figures is not much use to anyone.
   */
  async function buildArchive() {
    const byName = new Map(figures.map((file) => [file.name.toLowerCase(), file]));
    return buildBundle({
      latex,
      assets,
      texName: `${title || 'document'}.tex`,
      readAsset: async (path) => {
        const file = byName.get(fileKey(path));
        return file ? new Uint8Array(await file.arrayBuffer()) : null;
      },
      // Without this, a figure that was never attached makes the LaTeX engine
      // emit a truncated, unopenable PDF.
      onSkipped: (asset, reason) => missingBox(asset, skippedLabel(asset, reason)),
    });
  }

  function handleDownloadZip() {
    startTransition(async () => {
      setError('');
      setStatus('');
      try {
        const bundle = await buildArchive();
        // Copied into a plain ArrayBuffer: a Uint8Array view is not a BlobPart.
        download(new Blob([toBuffer(bundle.zip)], { type: 'application/zip' }), `${title || 'document'}.zip`);
        setStatus(`Archived the .tex and ${bundle.included.length} figure(s).`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not build the archive.');
      }
    });
  }

  function handleDownloadPdf() {
    startTransition(async () => {
      setError('');
      setStatus('');
      try {
        const bundle = await buildArchive();
        const form = new FormData();
        form.append('tex', new Blob([bundle.latex], { type: 'application/x-tex' }), 'document.tex');
        const byName = new Map(figures.map((file) => [file.name.toLowerCase(), file]));
        for (const path of bundle.included) {
          const file = byName.get(fileKey(path));
          if (file) form.append(path, file, path);
        }

        const response = await fetch('/api/pdf', { method: 'POST', body: form });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? `HTTP ${response.status}`);
        }
        download(await response.blob(), `${title || 'document'}.pdf`);
        setStatus('Compiled the PDF.');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not compile a PDF.');
      }
    });
  }

  /**
   * The SVGs the document still includes.
   *
   * The CLI and the Obsidian plugin render these to PDF before writing the
   * `.tex`, but a browser has no converter to call, so the best it can do is
   * explain why the figure will not show up.
   */
  const svgAssets = useMemo(
    () => assets.filter((asset) => asset.kind === 'svg' && !asset.isUrl),
    [assets],
  );

  function handleDownload() {
    const blob = new Blob([latex], { type: 'application/x-tex' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title || 'document'}.tex`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="converter">
      <label className="field">
        <span>Document title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <div className="panes">
        <label className="field">
          <span>Markdown</span>
          <textarea
            value={markdown}
            spellCheck={false}
            onChange={(event) => setMarkdown(event.target.value)}
          />
        </label>

        <label className="field">
          <span>LaTeX</span>
          <textarea value={latex} readOnly spellCheck={false} placeholder="Output appears here" />
        </label>
      </div>

      <div className="actions">
        <button type="button" onClick={handleConvert} disabled={pending}>
          {pending ? 'Converting…' : 'Convert'}
        </button>
        <button type="button" onClick={handleDownload} disabled={!latex}>
          Download .tex
        </button>
        <button type="button" onClick={handleDownloadZip} disabled={!latex || pending}>
          Download .zip
        </button>
        <button type="button" onClick={handleDownloadPdf} disabled={!latex || pending}>
          Download .pdf
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(latex)}
          disabled={!latex}
        >
          Copy
        </button>
      </div>

      {assets.length > 0 ? (
        <div className="field">
          <span>Figures ({figures.length} attached)</span>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.svg"
            onChange={(event) => setFigures([...(event.target.files ?? [])])}
          />
          {svgAssets.length > 0 ? (
            <p className="warning">
              This document includes {svgAssets.length} SVG
              {svgAssets.length === 1 ? '' : 's'}. No LaTeX engine can read an SVG —{' '}
              <code>\includesvg</code> shells out to Inkscape at compile time, which Overleaf
              does not have, so the figure silently fails to appear. Attach a PDF or PNG version
              instead, or compile the <code>.zip</code> somewhere Inkscape is installed.
            </p>
          ) : null}
          {needed.length > 0 ? (
            <p className="warning">
              Still missing: {needed.map((asset) => asset.path).join(', ')}
            </p>
          ) : (
            <p className="status">Every figure the document needs is attached.</p>
          )}
        </div>
      ) : null}

      {status ? <p className="status">{status}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}
      {warnings.length > 0 ? (
        <p className="warning">Skipped unsupported blocks: {[...new Set(warnings)].join(', ')}</p>
      ) : null}
    </section>
  );
}

/** Copies bytes into a standalone ArrayBuffer, which is what `Blob` accepts. */
function toBuffer(data: Uint8Array): ArrayBuffer {
  return data.slice().buffer as ArrayBuffer;
}

/** Saves a blob to the user's downloads. */
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
