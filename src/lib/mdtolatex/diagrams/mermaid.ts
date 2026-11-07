import {
  TIKZ_CLOSING_LINES,
  TIKZ_PREAMBLE_LINES,
  edgeBend,
  escapeLatex,
  fixed2,
  layoutPositions,
  sanitizeId,
  type Direction,
  type Edge,
} from './utils';

const DIRECTION_RE = /^\s*(?:graph|flowchart)\s+(TB|TD|BT|RL|LR)\b/i;

const SHAPE_PATTERNS: [RegExp, string][] = [
  [/^\[\[([\s\S]*)\]\]$/, 'subroutine'],
  [/^\[\(([\s\S]*)\)\]$/, 'cylinder'],
  [/^\(\(([\s\S]*)\)\)$/, 'circle'],
  [/^\{([\s\S]*)\}$/, 'diamond'],
  [/^\(([\s\S]*)\)$/, 'rounded'],
  [/^\[([\s\S]*)\]$/, 'rectangle'],
  [/^>([\s\S]*)\]$/, 'flag'],
];

const SHAPE_TIKZ_STYLE: Record<string, string> = {
  rectangle: 'draw, rectangle',
  rounded: 'draw, rectangle, rounded corners',
  circle: 'draw, circle',
  diamond: 'draw, diamond, aspect=2',
  subroutine: 'draw, rectangle, double',
  cylinder: 'draw, cylinder, shape border rotate=90',
  flag: 'draw, rectangle',
};

// A node id may contain dashes internally but never end with one, otherwise a
// greedy match swallows the first dash of an arrow (`A-->B` reading as `A-`).
const NODE_TOKEN = '[A-Za-z0-9_.](?:[A-Za-z0-9_.-]*[A-Za-z0-9_.])?';
const SHAPE_TOKEN =
  '(?:\\[\\[[\\s\\S]*?\\]\\]|\\[\\([\\s\\S]*?\\)\\]|\\(\\([\\s\\S]*?\\)\\)|\\{[\\s\\S]*?\\}|\\([\\s\\S]*?\\)|\\[[\\s\\S]*?\\]|>[^\\]]*\\])';
const ARROW_TOKEN = '(?:-\\.{1,2}->|={1,3}>|-{1,3}>|-\\.{1,2}-|={2,3}|-{2,3})';

const EDGE_RE = new RegExp(
  `^\\s*(${NODE_TOKEN})\\s*(${SHAPE_TOKEN})?\\s*(${ARROW_TOKEN})\\s*(?:\\|([^|]*)\\|)?\\s*(${NODE_TOKEN})\\s*(${SHAPE_TOKEN})?\\s*$`,
);
const NODE_ONLY_RE = new RegExp(`^\\s*(${NODE_TOKEN})\\s*(${SHAPE_TOKEN})?\\s*$`);

const SKIP_PREFIXES = [
  'subgraph',
  'end',
  'classDef',
  'class ',
  'click ',
  'style ',
  'linkStyle',
  '%%',
];

/** Returns `[shapeName, label]` for a raw mermaid shape token like `[Text]`. */
function parseShape(shapeToken: string, nodeId: string): [string, string] {
  if (!shapeToken) return ['rectangle', nodeId];
  for (const [pattern, shapeName] of SHAPE_PATTERNS) {
    const match = pattern.exec(shapeToken);
    if (match) return [shapeName, match[1].trim()];
  }
  return ['rectangle', shapeToken.replace(/^[[\](){}]+|[[\](){}]+$/g, '')];
}

/**
 * Best-effort conversion of a mermaid flowchart/graph block into a TikZ picture.
 * Supports the common node shapes (`[]`, `()`, `(())`, `{}`, `[[]]`, `[()]`),
 * edge styles (`-->`, `---`, `-.->`, `-.-`, `==>`, `===`) and `|label|` text.
 *
 * Layout is a generic layered auto-layout, so it will not match mermaid's own
 * rendering pixel-for-pixel. Unrecognized lines (chained edges like
 * `A --> B --> C`, subgraphs, styling directives) are skipped rather than
 * throwing. Returns `''` when nothing could be parsed, so the caller can fall
 * back to a plain code listing.
 */
export function mermaidToTikz(code: string): string {
  const lines = code.split('\n');
  let direction: Direction = 'TB';
  let bodyLines = lines;

  if (lines.length > 0) {
    const match = DIRECTION_RE.exec(lines[0]);
    if (match) {
      const found = match[1].toUpperCase();
      direction = (found === 'TD' ? 'TB' : found) as Direction;
      bodyLines = lines.slice(1);
    }
  }

  const nodes = new Map<string, [string, string]>();
  const edges: [string, string, string][] = [];

  const register = (nodeId: string, shapeToken = ''): void => {
    if (!nodes.has(nodeId) || shapeToken) nodes.set(nodeId, parseShape(shapeToken, nodeId));
  };

  for (const rawLine of bodyLines) {
    const line = rawLine.split('%%')[0].trim();
    if (!line || line === '{' || line === '}') continue;
    if (SKIP_PREFIXES.some((prefix) => line.startsWith(prefix))) continue;

    const edge = EDGE_RE.exec(line);
    if (edge) {
      const [, source, sourceShape, , label, target, targetShape] = edge;
      register(source, sourceShape ?? '');
      register(target, targetShape ?? '');
      edges.push([source, target, (label ?? '').trim()]);
      continue;
    }

    const nodeOnly = NODE_ONLY_RE.exec(line);
    if (nodeOnly) {
      register(nodeOnly[1], nodeOnly[2] ?? '');
      continue;
    }
    // Unrecognized line — skipped so an unusual diagram degrades gracefully.
  }

  if (nodes.size === 0) return '';

  const nodeIds = [...nodes.keys()];
  const graphEdges: Edge[] = edges.map(([source, target]) => [source, target]);
  const { positions, layer } = layoutPositions(nodeIds, graphEdges, direction);

  const out = [...TIKZ_PREAMBLE_LINES];
  for (const [nodeId, [shape, label]] of nodes) {
    const [x, y] = positions.get(nodeId) ?? [0, 0];
    const style = SHAPE_TIKZ_STYLE[shape] ?? 'draw, rectangle';
    out.push(
      `  \\node[${style}] (${sanitizeId(nodeId)}) at (${fixed2(x)},${fixed2(y)}) {${escapeLatex(label)}};`,
    );
  }
  for (const [source, target, label] of edges) {
    const labelPart = label
      ? ` node[midway, fill=white, font=\\scriptsize] {${escapeLatex(label)}}`
      : '';
    const bend = edgeBend(source, target, layer, direction);
    const connector = bend ? `to[${bend}]` : '--';
    out.push(
      `  \\draw[->] (${sanitizeId(source)}) ${connector}${labelPart} (${sanitizeId(target)});`,
    );
  }
  out.push(...TIKZ_CLOSING_LINES);
  return `${out.join('\n')}\n`;
}
