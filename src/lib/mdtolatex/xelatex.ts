/** Compiling a gathered document with xelatex (locally or via remote microservice). */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

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
 * Compiles `files` to a PDF via an external microservice if configured,
 * or locally in a scratch directory using local xelatex.
 */
export async function compileToPdf(
  files: Map<string, Uint8Array | string>,
  texName: string,
): Promise<CompileResult> {
  const serviceUrl = process.env.LATEX_COMPILER_URL || process.env.LATEX_SERVICE_URL;
  if (serviceUrl) {
    const serviceSecret = process.env.LATEX_COMPILER_SECRET || process.env.LATEX_SERVICE_SECRET;
    return compileViaRemoteService(files, texName, serviceUrl, serviceSecret);
  }

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
              'Install a TeX distribution (TeX Live or MacTeX) locally, or set the LATEX_COMPILER_URL environment variable to use an external compilation microservice.',
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

/**
 * Offloads PDF compilation to an external microservice over HTTP.
 */
async function compileViaRemoteService(
  files: Map<string, Uint8Array | string>,
  texName: string,
  serviceUrl: string,
  serviceSecret?: string,
): Promise<CompileResult> {
  const endpoint = serviceUrl.endsWith('/compile')
    ? serviceUrl
    : `${serviceUrl.replace(/\/+$/, '')}/compile`;

  const payloadFiles: Array<{ name: string; content: string; encoding: 'base64' | 'utf8' }> = [];
  for (const [path, data] of files) {
    if (typeof data === 'string') {
      payloadFiles.push({ name: path, content: data, encoding: 'utf8' });
    } else {
      payloadFiles.push({
        name: path,
        content: Buffer.from(data).toString('base64'),
        encoding: 'base64',
      });
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (serviceSecret) {
    headers['Authorization'] = `Bearer ${serviceSecret}`;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ texName, files: payloadFiles }),
    });
  } catch (error: unknown) {
    throw new XelatexError(
      `Could not connect to external LaTeX microservice at ${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    let errMessage = `LaTeX microservice returned HTTP ${response.status}`;
    let errors: string[] = [];
    try {
      const errData = await response.json();
      if (errData.error) errMessage = errData.error;
      if (Array.isArray(errData.errors)) errors = errData.errors;
    } catch {
      const text = await response.text().catch(() => '');
      if (text) errMessage = text;
    }
    throw new XelatexError(errMessage, errors);
  }

  const pdfBuffer = await response.arrayBuffer();
  const pdf = new Uint8Array(pdfBuffer);

  let errors: string[] = [];
  const errorsHeader = response.headers.get('x-latex-errors');
  if (errorsHeader) {
    try {
      errors = JSON.parse(decodeURIComponent(errorsHeader));
    } catch {}
  }

  return { pdf, errors };
}

/** Pulls the `! ...` complaint lines out of a TeX log, deduplicated. */
export function texErrors(log: string): string[] {
  return [...new Set(log.split(/\r?\n/).filter((line) => line.startsWith('! ')))];
}

/** Whether a PDF can be compiled here at all (locally or via remote microservice). */
export async function canCompilePdf(): Promise<boolean> {
  if (process.env.LATEX_COMPILER_URL || process.env.LATEX_SERVICE_URL) {
    return true;
  }
  return capture('xelatex', ['-version'], process.cwd()).then(
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
