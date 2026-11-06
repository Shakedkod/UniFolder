/**
 * The index a vault build leaves behind.
 *
 * Shared by the build script that writes it and the page that reads it, so a
 * field can never be renamed on one side only.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Why a figure is a placeholder box instead of an image. */
export interface SkippedFigure {
  path: string;
  reason: 'missing' | 'remote' | 'unreadable';
  detail?: string;
}

/** One converted note. */
export interface ManifestEntry {
  /** Vault-root path of the source note. */
  source: string;
  title: string;
  /** URL-safe id, and the folder the outputs live in. */
  slug: string;
  language: string;
  /** Public URLs, ready to use in an `<a href>`. */
  tex: string;
  zip?: string;
  pdf?: string;
  /** Figures that could not be supplied, and are placeholder boxes in the output. */
  skipped: SkippedFigure[];
  /** Wikilinks that point at nothing in the vault. */
  unresolved: string[];
  /** Markdown the converter could not render. */
  warnings: string[];
}

export interface VaultManifest {
  generated: string;
  notes: ManifestEntry[];
}

export const MANIFEST_PATH = 'latex/manifest.json';

/**
 * Reads the manifest from `public/`, or returns an empty one.
 *
 * A site that has never run the vault build should still render, so a missing
 * manifest is not an error — the page says there is nothing yet.
 */
export async function readManifest(publicDir = 'public'): Promise<VaultManifest> {
  const raw = await readFile(join(process.cwd(), publicDir, MANIFEST_PATH), 'utf8').catch(
    () => null,
  );
  if (!raw) return { generated: '', notes: [] };
  return JSON.parse(raw) as VaultManifest;
}
