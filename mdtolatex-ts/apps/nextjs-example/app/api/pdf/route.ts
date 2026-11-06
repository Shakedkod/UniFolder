import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * POST /api/pdf
 *
 * Body: multipart form data — a `tex` file plus any number of asset files whose
 * field names are the paths the document references.
 * Returns: the compiled PDF, or `{ error }` with a status.
 *
 * Compiling needs a TeX distribution on the server. Vercel's runtime has none, so
 * this answers 501 there rather than failing obscurely; it works as-is on a
 * self-hosted box or in a container with TeX Live installed.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 25_000_000;

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Send multipart form data.' }, 400);
  }

  const tex = form.get('tex');
  if (!(tex instanceof File)) return json({ error: 'A "tex" file part is required.' }, 400);

  const workDir = await mkdtemp(join(tmpdir(), 'mdtolatex-web-'));
  try {
    let total = 0;
    for (const [name, value] of form.entries()) {
      if (!(value instanceof File)) continue;
      total += value.size;
      if (total > MAX_BYTES) return json({ error: 'Upload is too large.' }, 413);

      // Field names are document-relative paths; anything climbing out of the
      // build directory is refused rather than written.
      const relative = name === 'tex' ? 'document.tex' : name.replace(/\\/g, '/');
      if (relative.startsWith('/') || relative.split('/').includes('..')) {
        return json({ error: `Rejected path "${name}".` }, 400);
      }
      const target = join(workDir, relative);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, new Uint8Array(await value.arrayBuffer()));
    }

    let log = '';
    for (let pass = 0; pass < 2; pass += 1) {
      const result = await run('xelatex', ['-interaction=nonstopmode', 'document.tex'], workDir);
      if (result.failedToStart) {
        return json(
          { error: 'This server has no TeX installation, so it cannot compile PDFs.' },
          501,
        );
      }
      log = result.output;
    }

    const pdf = await readFile(join(workDir, 'document.pdf')).catch(() => null);
    if (!pdf) {
      const errors = log.split(/\r?\n/).filter((line) => line.startsWith('! '));
      return json({ error: errors[0] ?? 'LaTeX produced no PDF.' }, 422);
    }

    return new Response(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="document.pdf"',
      },
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ output: string; failedToStart: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout?.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      output += String(chunk);
    });
    child.on('error', () => resolve({ output, failedToStart: true }));
    child.on('close', () => resolve({ output, failedToStart: false }));
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
