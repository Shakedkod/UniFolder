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
} from './utils.js';

const ATTR_RE = /(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|[^,\]]+)/g;
const HEADER_RE = /(?:^|\n)\s*(?:strict\s+)?(?:digraph|graph)\s+[A-Za-z0-9_"]*\s*\{/i;
const NODE_RE = /^"?([A-Za-z0-9_]+)"?\s*(?:\[([\s\S]*)\])?$/;
const EDGE_RE = /^"?([A-Za-z0-9_]+)"?\s*(->|--)\s*"?([A-Za-z0-9_]+)"?\s*(?:\[([\s\S]*)\])?$/;
const RANKDIR_RE = /^rankdir\s*=\s*"?(\w+)"?$/i;
const DEFAULTS_RE = /^(?:node|edge|graph)\s*\[/i;

const SHAPE_TIKZ_STYLE: Record<string, string> = {
  box: 'draw, rectangle',
  rect: 'draw, rectangle',
  rectangle: 'draw, rectangle',
  circle: 'draw, circle',
  ellipse: 'draw, ellipse',
  oval: 'draw, ellipse',
  diamond: 'draw, diamond, aspect=2',
};

function parseAttrs(attrString: string | undefined): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!attrString) return attrs;
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(attrString)) !== null) {
    const key = match[1].trim().toLowerCase();
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    attrs[key] = value;
  }
  return attrs;
}

/**
 * Best-effort removal of (non-nested) subgraph blocks so their internal
 * rank/style statements are not misread as top-level nodes or edges.
 */
function stripSubgraphs(body: string): string {
  return body.replace(/subgraph\s*[A-Za-z0-9_"]*\s*\{[^{}]*\}/gi, '');
}

/**
 * Best-effort conversion of a Graphviz `graph`/`digraph` block into a TikZ
 * picture. Supports node/edge statements with `label` and `shape` attributes and
 * the `rankdir` graph attribute.
 *
 * Layout is a generic layered auto-layout rather than Graphviz's engine, and
 * nested subgraphs/clusters are stripped rather than rendered. Unrecognized
 * statements are skipped. Returns `''` when no node or edge could be parsed, so
 * the caller can fall back to a plain code listing.
 */
export function dotToTikz(code: string): string {
  const header = HEADER_RE.exec(code);
  let body = header ? code.slice(header.index + header[0].length) : code;
  body = body.trimEnd();
  if (body.endsWith('}')) body = body.slice(0, -1);
  body = stripSubgraphs(body);

  let direction: Direction = 'TB';
  const nodes = new Map<string, [string, string]>();
  const edges: [string, string, string, string][] = [];

  for (const rawStatement of body.split(';')) {
    const statement = rawStatement.replace(/\/\/.*/g, '').trim();
    if (!statement) continue;

    const rankdir = RANKDIR_RE.exec(statement);
    if (rankdir) {
      direction = rankdir[1].toUpperCase() as Direction;
      continue;
    }
    if (DEFAULTS_RE.test(statement)) continue; // default-attribute blocks aren't modeled

    const edge = EDGE_RE.exec(statement);
    if (edge) {
      const [, source, operator, target, attrString] = edge;
      const attrs = parseAttrs(attrString);
      if (!nodes.has(source)) nodes.set(source, ['rectangle', source]);
      if (!nodes.has(target)) nodes.set(target, ['rectangle', target]);
      edges.push([source, target, attrs.label ?? '', operator]);
      continue;
    }

    const node = NODE_RE.exec(statement);
    if (node) {
      const [, nodeId, attrString] = node;
      const attrs = parseAttrs(attrString);
      nodes.set(nodeId, [(attrs.shape ?? 'rectangle').toLowerCase(), attrs.label ?? nodeId]);
      continue;
    }
    // Unrecognized statement — skipped rather than failing the build.
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
  for (const [source, target, label, operator] of edges) {
    const arrow = operator === '->' ? '->' : '-';
    const labelPart = label
      ? ` node[midway, fill=white, font=\\scriptsize] {${escapeLatex(label)}}`
      : '';
    const bend = edgeBend(source, target, layer, direction);
    const connector = bend ? `to[${bend}]` : '--';
    out.push(
      `  \\draw[${arrow}] (${sanitizeId(source)}) ${connector}${labelPart} (${sanitizeId(target)});`,
    );
  }
  out.push(...TIKZ_CLOSING_LINES);
  return `${out.join('\n')}\n`;
}
