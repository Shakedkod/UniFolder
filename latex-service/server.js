const express = require('express');
const cors = require('cors');
const { spawn } = require('node:child_process');
const { mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { dirname, join, normalize, resolve } = require('node:path');

const app = express();
const PORT = process.env.PORT || 8080;
const SECRET = process.env.LATEX_SERVICE_SECRET || '';
const TIMEOUT_MS = parseInt(process.env.LATEX_TIMEOUT_MS || '90000', 10); // 90 seconds default

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Optional Bearer token authentication
app.use((req, res, next) => {
  if (!SECRET) return next();
  const authHeader = req.headers.authorization || '';
  const tokenHeader = req.headers['x-latex-token'] || '';
  const provided = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : tokenHeader;

  if (provided !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing compilation token' });
  }
  next();
});

// Health check endpoint
app.get(['/', '/health'], async (_req, res) => {
  try {
    const versionOutput = await runCommand('xelatex', ['-version'], process.cwd(), 5000);
    const firstLine = versionOutput.split(/\r?\n/)[0] || 'XeLaTeX installed';
    res.json({
      status: 'ok',
      service: 'uni-latex-compiler',
      xelatex: true,
      engine: firstLine,
    });
  } catch (err) {
    res.status(500).json({
      status: 'degraded',
      service: 'uni-latex-compiler',
      xelatex: false,
      error: err.message,
    });
  }
});

// Compilation endpoint
app.post('/compile', async (req, res) => {
  const { texName = 'document.tex', files = [] } = req.body || {};

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'Missing or empty "files" array in request body' });
  }

  let workDir;
  try {
    workDir = await mkdtemp(join(tmpdir(), 'latex-service-'));

    // Write all incoming files safely into workDir
    for (const file of files) {
      if (!file.name) continue;

      // Prevent directory traversal attacks
      const target = resolve(workDir, normalize(file.name));
      if (!target.startsWith(resolve(workDir))) {
        return res.status(400).json({ error: `Illegal path in file name: "${file.name}"` });
      }

      await mkdir(dirname(target), { recursive: true });

      if (file.encoding === 'base64') {
        await writeFile(target, Buffer.from(file.content, 'base64'));
      } else if (typeof file.content === 'string') {
        await writeFile(target, file.content, 'utf8');
      } else {
        await writeFile(target, Buffer.from(file.content || ''));
      }
    }

    const mainTexFile = files.find((f) => f.name === texName);
    const mainTexData = mainTexFile ? (mainTexFile.content || '').toString() : '';
    const needsSecondPass =
      mainTexData.includes('\\tableofcontents') ||
      mainTexData.includes('\\pageref{') ||
      mainTexData.includes('\\ref{');
    const passes = needsSecondPass ? 2 : 1;

    let log = '';
    for (let pass = 1; pass <= passes; pass += 1) {
      log = await runCommand(
        'xelatex',
        ['-interaction=nonstopmode', '-synctex=0', texName],
        workDir,
        TIMEOUT_MS,
      );
    }

    const pdfName = texName.replace(/\.tex$/i, '.pdf');
    const pdfPath = join(workDir, pdfName);
    const pdf = await readFile(pdfPath).catch(() => null);

    const errors = texErrors(log);

    if (!pdf) {
      const failureSummary = errors.length > 0
        ? errors.join('\n')
        : (log.split(/\r?\n/).filter(l => l.startsWith('!') || l.includes('Fatal error') || l.includes('Error:')).slice(-5).join('\n') || 'xelatex produced no PDF');

      console.error(`[latex-service] Compilation of "${texName}" produced no PDF. Errors:\n`, failureSummary);
      console.error('[latex-service] Log tail:\n', log.slice(-2000));

      return res.status(422).json({
        error: failureSummary,
        errors,
        logExcerpt: log.slice(-3000),
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('X-Latex-Errors', encodeURIComponent(JSON.stringify(errors)));
    return res.send(pdf);
  } catch (err) {
    console.error('[latex-service] Compilation error:', err);
    return res.status(500).json({
      error: err.message || 'Internal error during LaTeX compilation',
    });
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

function texErrors(log) {
  return [...new Set(log.split(/\r?\n/).filter((line) => line.startsWith('! ')))];
}

function runCommand(command, args, cwd, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      output += String(chunk);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', () => {
      clearTimeout(timer);
      resolvePromise(output);
    });
  });
}

app.listen(PORT, () => {
  console.log(`[latex-service] Compiler microservice listening on port ${PORT}`);
});
