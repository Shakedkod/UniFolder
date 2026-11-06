/** Compiling a gathered document with xelatex. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { run } from './svg.js';

export class XelatexError extends Error {
  constructor(
    message: string,
    /** The `! ...` complaint lines from the TeX log, deduplicated. */
    readonly errors: string[] = [],
  ) {
    super(message);
    this.name = 'XelatexError';
  }
}

export interface CompileResult {
  pdf: Uint8Array;
  /** LaTeX errors the run survived. A document can compile despite these. */
  errors: string[];
}

/**
 * Compiles `files` to a PDF in a scratch directory.
 *
 * Compiling from the gathered files rather than in place means the PDF provably
 * matches what the archive holds, and the caller's output folder never collects
 * xelatex's `.aux` / `.log` / `.toc` litter.
 *
 * Runs twice so the table of contents and references settle, and does not halt
 * on the first error: a note that links a figure it never exported still yields
 * a perfectly usable PDF with one blank spot, and losing the whole export over
 * that is worse than reporting it. Only a missing PDF counts as failure.
 */
export async function compileToPdf(
  files: Map<string, Uint8Array | string>,
  texName: string,
): Promise<CompileResult> {
  const workDir = await mkdtemp(join(tmpdir(), 'mdtolatex-pdf-'));
  try {
    for (const [path, data] of files) {
      const target = join(workDir, path);
      await mkdir(dirname(target), { recursive: true });
      if (typeof data === 'string') await writeFile(target, data, 'utf8');
      else await writeFile(target, data);
    }

    let log = '';
    const mainTexData = typeof files.get(texName) === 'string' ? (files.get(texName) as string) : '';
    const needsSecondPass = mainTexData.includes('\\tableofcontents') || mainTexData.includes('\\pageref{') || mainTexData.includes('\\ref{');
    const passes = needsSecondPass ? 2 : 1;

    for (let pass = 1; pass <= passes; pass += 1) {
      log = await capture('xelatex', ['-interaction=nonstopmode', '-synctex=0', texName], workDir).catch(
        (error: unknown) => {
          throw new XelatexError(
            `could not run xelatex: ${error instanceof Error ? error.message : String(error)}. ` +
              'Install a TeX distribution (TeX Live or MacTeX) to export PDFs.',
          );
        },
      );
    }

    const pdfPath = join(workDir, texName.replace(/\.tex$/i, '.pdf'));
    const pdf = await readFile(pdfPath).catch(() => null);
    if (!pdf) throw new XelatexError('xelatex produced no PDF', texErrors(log));
    return { pdf, errors: texErrors(log) };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** Pulls the `! ...` complaint lines out of a TeX log, deduplicated. */
export function texErrors(log: string): string[] {
  return [...new Set(log.split(/\r?\n/).filter((line) => line.startsWith('! ')))];
}

/** Whether a PDF can be compiled here at all. */
export async function canCompilePdf(): Promise<boolean> {
  return run('xelatex', ['-version']).then(
    () => true,
    () => false,
  );
}

function capture(command: string, args: string[], cwd: string): Promise<string> {
  return import('node:child_process').then(
    ({ spawn }) =>
      new Promise<string>((resolvePromise, reject) => {
        const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        child.stdout?.on('data', (chunk) => {
          output += String(chunk);
        });
        child.stderr?.on('data', (chunk) => {
          output += String(chunk);
        });
        child.on('error', reject);
        child.on('close', () => resolvePromise(output));
      }),
  );
}
