/** Shared layout/escaping helpers for the diagram-to-TikZ converters. */

import { escapeLatex } from '../latex/parts.js';

export { escapeLatex };

/** Turns an arbitrary diagram node id into a valid TikZ node name. */
export function sanitizeId(nodeId: string): string {
  let safe = nodeId.replace(/[^A-Za-z0-9]/g, '_');
  if (!safe || /^[0-9]/.test(safe)) safe = `n${safe}`;
  return safe;
}

export type Edge = [string, string];
export type Direction = 'TB' | 'TD' | 'BT' | 'LR' | 'RL';

/**
 * Assigns each node a 0-based layer using longest-path-from-root layering.
 * Nodes reachable only through a cycle are placed one layer after everything
 * that could be ordered, so layout always terminates on non-DAG graphs.
 */
export function computeLayers(nodeIds: string[], edges: Edge[]): Map<string, number> {
  const nodeSet = new Set(nodeIds);
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));

  for (const [source, target] of edges) {
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue;
    const list = outgoing.get(source) ?? [];
    list.push(target);
    outgoing.set(source, list);
    indegree.set(target, (indegree.get(target) ?? 0) + 1);
  }

  const layer = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const queue = nodeIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  const visited = new Set(queue);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor];
    for (const next of outgoing.get(node) ?? []) {
      layer.set(next, Math.max(layer.get(next) ?? 0, (layer.get(node) ?? 0) + 1));
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if ((indegree.get(next) ?? 0) === 0 && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  const leftover = nodeIds.filter((id) => !visited.has(id));
  if (leftover.length > 0) {
    const nextLayer = Math.max(...layer.values(), -1) + 1;
    for (const id of leftover) layer.set(id, nextLayer);
  }

  return layer;
}

export interface Layout {
  positions: Map<string, [number, number]>;
  layer: Map<string, number>;
}

/**
 * A generic layered auto-layout producing centimetre coordinates. This is not a
 * reimplementation of mermaid's or Graphviz's engine — it only guarantees a
 * legible, non-overlapping result.
 */
export function layoutPositions(
  nodeIds: string[],
  edges: Edge[],
  direction: Direction = 'TB',
  layerGap = 3.8,
  nodeGap = 2.4,
): Layout {
  const layer = computeLayers(nodeIds, edges);
  const layers = new Map<number, string[]>();
  for (const id of nodeIds) {
    const level = layer.get(id) ?? 0;
    const bucket = layers.get(level) ?? [];
    bucket.push(id);
    layers.set(level, bucket);
  }

  const positions = new Map<string, [number, number]>();
  for (const [level, nodesInLayer] of layers) {
    const offset = (nodesInLayer.length - 1) / 2;
    nodesInLayer.forEach((id, index) => {
      const cross = (index - offset) * nodeGap;
      const along = level * layerGap;
      if (direction === 'LR') positions.set(id, [along, -cross]);
      else if (direction === 'RL') positions.set(id, [-along, -cross]);
      else if (direction === 'BT') positions.set(id, [cross, along]);
      else positions.set(id, [cross, -along]); // TB / TD
    });
  }

  return { positions, layer };
}

const BEND_ANGLES: Record<string, [string, string]> = {
  TB: ['-60', '60'],
  BT: ['60', '-60'],
  LR: ['-150', '-30'],
  RL: ['-30', '-150'],
};

/**
 * Returns TikZ `out=/in=` options for edges that skip more than one layer, so a
 * skip-edge curves clear of the straight-line column instead of drawing its
 * label on top of an intermediate node. Adjacent-layer edges return `''`.
 */
export function edgeBend(
  source: string,
  target: string,
  layer: Map<string, number>,
  direction: Direction = 'TB',
): string {
  const distance = Math.abs((layer.get(target) ?? 0) - (layer.get(source) ?? 0));
  if (distance > 1) {
    const [out, into] = BEND_ANGLES[direction] ?? BEND_ANGLES.TB;
    return `out=${out}, in=${into}`;
  }
  return '';
}

/** The common opening lines shared by the mermaid and DOT TikZ output. */
export const TIKZ_PREAMBLE_LINES = [
  '\\begin{LTR}',
  '\\begin{center}',
  '\\begin{tikzpicture}[',
  '  every node/.style={draw, align=center, inner sep=4pt, minimum width=1.6cm, minimum height=0.9cm, font=\\small},',
  '  >={Stealth[length=3mm]}',
  ']',
];

export const TIKZ_CLOSING_LINES = ['\\end{tikzpicture}', '\\end{center}', '\\end{LTR}'];

/** Formats a number with two decimals, matching the Python `:.2f` output. */
export const fixed2 = (value: number): string => value.toFixed(2);

/** Formats a number like Python's `:g` (shortest round-trip, no trailing zeros). */
export function generalNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(6)));
}
