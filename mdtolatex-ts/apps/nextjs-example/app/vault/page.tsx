/**
 * The vault's converted notes, listed from the build-time manifest.
 *
 * Every download here is a static file produced before deploy, so this page does
 * no conversion and calls no API — which is the point: the server it runs on
 * needs neither a TeX installation nor an SVG converter. Run
 * `npm run build:vault` before `next build` to populate it.
 */
// Extensionless: Next's bundler resolves the TypeScript source directly.
import { readManifest, type ManifestEntry } from '../../scripts/manifest';

// The manifest is read from disk at build time, so the page is static.
export const dynamic = 'force-static';

export default async function VaultPage() {
  const { generated, notes } = await readManifest();

  if (!notes.length) {
    return (
      <main>
        <h1>Vault</h1>
        <p className="status">
          Nothing converted yet. Run <code>npm run build:vault -- --vault /path/to/vault</code> and
          rebuild.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Vault</h1>
      <p className="status">
        {notes.length} note{notes.length === 1 ? '' : 's'}
        {generated ? `, converted ${new Date(generated).toLocaleString()}` : null}
      </p>

      <ul className="vault-list">
        {notes.map((note) => (
          <li key={note.slug}>
            <div className="vault-title">
              <strong>{note.title}</strong>
              <span className="vault-source">{note.source}</span>
            </div>

            <div className="vault-links">
              <a href={note.tex} download>
                .tex
              </a>
              {note.zip ? (
                <a href={note.zip} download>
                  .zip
                </a>
              ) : null}
              {note.pdf ? (
                <a href={note.pdf} download>
                  .pdf
                </a>
              ) : null}
            </div>

            <Problems note={note} />
          </li>
        ))}
      </ul>
    </main>
  );
}

/**
 * What is wrong with a converted note.
 *
 * Surfaced rather than hidden: a missing figure is a placeholder box in the
 * output, and the only way anyone finds out is if the build says so.
 */
function Problems({ note }: { note: ManifestEntry }) {
  if (!note.skipped.length && !note.unresolved.length && !note.warnings.length) return null;

  return (
    <ul className="vault-problems">
      {note.skipped.map((asset) => (
        <li key={asset.path} className="warning">
          {asset.reason === 'remote'
            ? `"${asset.path}" is a URL — LaTeX cannot fetch it, so it is a placeholder box`
            : `"${asset.path}" was not found, so it is a placeholder box`}
        </li>
      ))}
      {note.unresolved.length ? (
        <li className="warning">Dead links: {note.unresolved.join(', ')}</li>
      ) : null}
      {note.warnings.length ? (
        <li className="warning">Unsupported blocks: {note.warnings.join(', ')}</li>
      ) : null}
    </ul>
  );
}
