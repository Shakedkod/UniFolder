import { generalNumber } from './utils';

const KV_RE = /^\s*([A-Za-z]+)\s*=\s*(.+?)\s*$/;
const FUNC_LINE_RE = /^\s*\w+\s*\(\s*x\s*\)\s*=\s*(.+?)\s*$/;
const RANGE_RE = /^\s*(-?[\d.]+)\s*(?:<=|<)\s*x\s*(?:<=|<)\s*(-?[\d.]+)\s*$/;
const UPPER_RE = /^\s*x\s*(?:<=|<)\s*(-?[\d.]+)\s*$/;
const LOWER_RE = /^\s*x\s*(?:>=|>)\s*(-?[\d.]+)\s*$/;

/** Parses `key=value; key2=value2` header lines into one merged record. */
function parseConfig(infoText: string): Record<string, string> {
  const config: Record<string, string> = {};
  for (const rawLine of infoText.split('\n')) {
    for (const item of rawLine.split(';')) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const match = KV_RE.exec(trimmed);
      if (match) config[match[1].toLowerCase()] = match[2];
    }
  }
  return config;
}

function num(config: Record<string, string>, key: string, fallback: number): number {
  const raw = config[key];
  if (raw === undefined) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Converts a Desmos-style domain condition (`x<0`, `x>=1`, `-2<x<3`) into a
 * `[min, max]` pair for pgfplots' `domain=`. Falls back to the full viewport.
 */
function parseDomain(condition: string, left: number, right: number): [number, number] {
  const trimmed = condition.trim();
  if (!trimmed) return [left, right];

  const range = RANGE_RE.exec(trimmed);
  if (range) return [Number.parseFloat(range[1]), Number.parseFloat(range[2])];

  const upper = UPPER_RE.exec(trimmed);
  if (upper) return [left, Number.parseFloat(upper[1])];

  const lower = LOWER_RE.exec(trimmed);
  if (lower) return [Number.parseFloat(lower[1]), right];

  return [left, right];
}

/**
 * Inserts the explicit `*` that Desmos allows to be implicit (`2x`, `3(x+1)`)
 * but pgfmath requires. More advanced Desmos syntax (fractions, absolute-value
 * bars, piecewise braces) is not converted and needs manual adjustment.
 */
function exprToPgfmath(expression: string): string {
  return expression
    .trim()
    .replace(/(\d)\s*([a-zA-Z(])/g, '$1*$2')
    .replace(/(\))\s*([a-zA-Z0-9(])/g, '$1*$2');
}

/**
 * Converts a `desmos-graph` code fence into a pgfplots axis. Expected format:
 *
 * ```
 * width=200; height=200;
 * bottom=-1; top=2
 * ---
 * f(x)=0 |x<0
 * g(x)=1 |x>1
 * ```
 *
 * A header of `key=value;` pairs (width/height/left/right/bottom/top), a `---`
 * separator, then one `name(x)=expr [|domain]` line per plotted function.
 * `left`/`right` default to `bottom`/`top` when omitted.
 *
 * Requires the `pgfplots` package — the caller enables it via the head flags.
 * Returns `''` when no function line parsed, so the caller can fall back to a
 * plain code listing instead of emitting an empty plot.
 */
export function desmosGraphToTikz(code: string): string {
  const separator = /\n?-{3,}\n?/.exec(code);
  const infoText = separator ? code.slice(0, separator.index) : code;
  const bodyText = separator ? code.slice(separator.index + separator[0].length) : '';

  const config = parseConfig(infoText);
  const bottom = num(config, 'bottom', -5);
  const top = num(config, 'top', 5);
  const left = num(config, 'left', -5);
  const right = num(config, 'right', 5);
  const widthPx = num(config, 'width', 400);
  const heightPx = num(config, 'height', 400);

  const aspect = heightPx ? widthPx / heightPx : 1;
  const plotHeightCm = 6;
  const plotWidthCm = plotHeightCm * aspect;

  const functions: [string, [number, number]][] = [];
  for (const rawLine of bodyText.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const pipe = line.indexOf('|');
    const exprPart = pipe === -1 ? line : line.slice(0, pipe);
    const domainPart = pipe === -1 ? '' : line.slice(pipe + 1);
    const match = FUNC_LINE_RE.exec(exprPart);
    if (!match) continue;
    functions.push([exprToPgfmath(match[1]), parseDomain(domainPart, left, right)]);
  }

  if (functions.length === 0) return '';

  const out = [
    '\\begin{LTR}',
    '\\begin{center}',
    '\\begin{tikzpicture}',
    `\\begin{axis}[width=${plotWidthCm.toFixed(2)}cm, height=${plotHeightCm.toFixed(2)}cm, ` +
      `xmin=${generalNumber(left)}, xmax=${generalNumber(right)}, ` +
      `ymin=${generalNumber(bottom)}, ymax=${generalNumber(top)}, ` +
      'axis lines=middle, samples=200, thick, xlabel={$x$}, ylabel={$y$}]',
  ];
  for (const [expression, [domainMin, domainMax]] of functions) {
    out.push(
      `\\addplot[domain=${generalNumber(domainMin)}:${generalNumber(domainMax)}] {${expression}};`,
    );
  }
  out.push('\\end{axis}', '\\end{tikzpicture}', '\\end{center}', '\\end{LTR}');
  return `${out.join('\n')}\n`;
}
