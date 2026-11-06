/**
 * The parts of exporting that need a real operating system.
 *
 * Obsidian runs on Electron on the desktop and in a plain WebView on phones and
 * tablets, so Node is there sometimes and absent other times. Everything in this
 * module therefore loads Node lazily and reports "not available" instead of
 * throwing, which keeps the plugin loading on mobile where compiling a PDF is
 * impossible anyway.
 */

/** A compiled document, or the reason there isn't one. */
export type PdfResult =
  | { ok: true; pdf: Uint8Array; errors: string[] }
  | { ok: false; reason: string };

/** Files to place in the build directory, keyed by path relative to it. */
export type BuildFiles = Map<string, Uint8Array>;

export interface CompileOptions {
  files: BuildFiles;
  /** The `.tex` to compile, as a key of `files`. */
  texName: string;
  /** The LaTeX command, e.g. `xelatex`. */
  command: string;
}

/** Node modules, or `null` on mobile. */
interface NodeApi {
  fs: typeof import('node:fs');
  path: typeof import('node:path');
  os: typeof import('node:os');
  childProcess: typeof import('node:child_process');
}

/**
 * Loads Node, if this platform has it.
 *
 * `require` is reached indirectly: bundlers rewrite a literal `require('fs')` into
 * something that breaks in the browser build, and Obsidian ships one bundle for
 * every platform.
 */
function loadNode(): NodeApi | null {
  try {
    const nodeRequire = (globalThis as { require?: (id: string) => unknown }).require;
    if (typeof nodeRequire !== 'function') return null;
    return {
      fs: nodeRequire('fs') as NodeApi['fs'],
      path: nodeRequire('path') as NodeApi['path'],
      os: nodeRequire('os') as NodeApi['os'],
      childProcess: nodeRequire('child_process') as NodeApi['childProcess'],
    };
  } catch {
    return null;
  }
}

/** Whether this device can compile a PDF at all. */
export function canCompilePdf(): boolean {
  return loadNode() !== null;
}

/**
 * Writes the bundle to a scratch directory and compiles it there.
 *
 * Building outside the vault keeps xelatex's `.aux`/`.log`/`.out` droppings from
 * appearing in the user's notes and from being picked up by sync.
 */
export async function compilePdf(options: CompileOptions): Promise<PdfResult> {
  const node = loadNode();
  if (!node) {
    return { ok: false, reason: 'compiling a PDF needs the desktop app' };
  }

  const { fs, path, os } = node;
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdtolatex-'));
  try {
    for (const [name, data] of options.files) {
      const target = path.join(workDir, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
    }

    let log = '';
    // Twice, so the table of contents and cross-references settle.
    for (let pass = 0; pass < 2; pass += 1) {
      const result = await run(
        node,
        options.command,
        ['-interaction=nonstopmode', options.texName],
        workDir,
      );
      if (result.failedToStart) {
        return {
          ok: false,
          reason: `could not run "${options.command}" — install TeX Live or MacTeX, or correct the command in settings`,
        };
      }
      log = result.output;
    }

    const pdfPath = path.join(workDir, options.texName.replace(/\.tex$/i, '.pdf'));
    if (!fs.existsSync(pdfPath)) {
      const errors = texErrors(log);
      return {
        ok: false,
        reason: errors.length ? `LaTeX failed: ${errors[0]}` : 'LaTeX produced no PDF',
      };
    }

    return { ok: true, pdf: new Uint8Array(fs.readFileSync(pdfPath)), errors: texErrors(log) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * Renders one SVG to PDF, or returns `null` if that is not possible here.
 *
 * LaTeX's `svg` package shells out to Inkscape on every build, which most
 * machines do not have — including CI and any phone. A PDF rendering embeds with
 * plain `\includegraphics`, keeps vector quality, and needs nothing installed at
 * compile time.
 */
export async function convertSvgToPdf(
  svg: Uint8Array,
  command: string,
): Promise<Uint8Array | null> {
  const node = loadNode();
  if (!node) return null;

  const { fs, path, os } = node;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdtolatex-svg-'));
  try {
    const source = path.join(dir, 'in.svg');
    const output = path.join(dir, 'out.pdf');
    fs.writeFileSync(source, svg);
    const result = await run(node, command, buildSvgArgs(command, source, output), dir);
    if (result.failedToStart || !fs.existsSync(output)) return null;
    return new Uint8Array(fs.readFileSync(output));
  } catch {
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** The two common converters take their arguments differently. */
function buildSvgArgs(command: string, source: string, output: string): string[] {
  if (/inkscape/i.test(command)) {
    return [source, '--export-type=pdf', `--export-filename=${output}`];
  }
  return ['-f', 'pdf', '-o', output, source];
}

interface RunResult {
  output: string;
  /** `true` when the executable itself is missing. */
  failedToStart: boolean;
}

function run(node: NodeApi, command: string, args: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = node.childProcess.spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout?.on('data', (chunk: unknown) => {
      output += String(chunk);
    });
    child.stderr?.on('data', (chunk: unknown) => {
      output += String(chunk);
    });
    child.on('error', () => resolve({ output, failedToStart: true }));
    child.on('close', () => resolve({ output, failedToStart: false }));
  });
}

/** Pulls the `! ...` complaint lines out of a TeX log, deduplicated. */
function texErrors(log: string): string[] {
  return [...new Set(log.split(/\r?\n/).filter((line) => line.startsWith('! ')))];
}
