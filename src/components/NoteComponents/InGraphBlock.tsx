"use client";

/**
 * GraphRenderer.tsx — static renderer for in-graph blocks.
 *
 * The processor emits:
 *   <div class="in-graph-placeholder" data-graph="<base64-json>"></div>
 * This module decodes that JSON and renders a pure SVG — no editing.
 */

import { useEffect, useRef } from "react";
import katex from "katex";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Position { x: number; y: number }

interface GraphNode {
    id: string;
    label: string;
    position: Position;
    isStart?: boolean;
    isAccepting?: boolean;
    color?: string;
    radius?: number;
}

interface Waypoint {
    id: string;
    x: number; y: number;
    type: "bezier" | "linear";
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    color?: string;
    type?: "arrow" | "line";
    waypoints?: Waypoint[];
}

interface GraphGroup {
    id: string;
    label?: string;
    x: number; y: number;
    w: number; h: number;
    color?: string;
}

interface GraphViewport {
    height?: number;
    viewBox?: { x: number; y: number; w: number; h: number };
}

interface GraphTheme {
    nodeFill?: string;
    nodeStroke?: string;
    edgeStroke?: string;
    text?: string;
    acceptCircle?: string;
    startArrow?: string;
    gateFill?: string;
    gateStroke?: string;
    wireActive?: string;
    groupStroke?: string;
}

interface CircuitGate {
    id: string;
    type: GateType;
    position: Position;
    label?: string;
    value?: boolean;
}

interface CircuitWire {
    id: string;
    fromGate: string; fromPort: string;
    toGate: string; toPort: string;
    waypoints?: Waypoint[];
    isBendable?: boolean;
}

type GateType = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR" | "INPUT" | "OUTPUT";

interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    gates?: CircuitGate[];
    wires?: CircuitWire[];
    groups?: GraphGroup[];
    theme?: GraphTheme;
    viewport?: GraphViewport;
    // saved setting — stored in the JSON block by the plugin
    straightWires?: boolean;
}

// ─── Gate constants ───────────────────────────────────────────────────────────

const GATE_W = 54, GATE_H = 40;
const GATE_HW = GATE_W / 2, GATE_HH = GATE_H / 2;

const GATE_INPUT_COUNT: Record<GateType, number> = {
    AND: 2, OR: 2, NAND: 2, NOR: 2, XOR: 2, XNOR: 2,
    NOT: 1, INPUT: 0, OUTPUT: 1,
};

// ─── Gate shapes (IEEE symbols, identical to SvgEditor.getGateShape) ─────────

function getGateShape(type: GateType): { body: string; lines?: string } {
    const hw = GATE_HW, hh = GATE_HH;
    switch (type) {
        case "AND": return { body: `M ${-hw} ${-hh} L 0 ${-hh} C ${hw + 4} ${-hh} ${hw + 4} ${hh} 0 ${hh} L ${-hw} ${hh} Z` };
        case "NAND": return { body: `M ${-hw} ${-hh} L 0 ${-hh} C ${hw - 1} ${-hh} ${hw - 1} ${hh} 0 ${hh} L ${-hw} ${hh} Z M ${hw} 0 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0` };
        case "OR": return { body: `M ${-hw} ${-hh} C 0 ${-hh} ${hw} ${-hh * .5} ${hw} 0 C ${hw} ${hh * .5} 0 ${hh} ${-hw} ${hh} C ${-hw * .4} ${hh * .5} ${-hw * .4} ${-hh * .5} ${-hw} ${-hh} Z` };
        case "NOR": return { body: `M ${-hw} ${-hh} C 0 ${-hh} ${hw - 6} ${-hh * .5} ${hw - 6} 0 C ${hw - 6} ${hh * .5} 0 ${hh} ${-hw} ${hh} C ${-hw * .4} ${hh * .5} ${-hw * .4} ${-hh * .5} ${-hw} ${-hh} Z M ${hw - 1} 0 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0` };
        case "XOR": return {
            body: `M ${-hw + 4} ${-hh} C 0 ${-hh} ${hw} ${-hh * .5} ${hw} 0 C ${hw} ${hh * .5} 0 ${hh} ${-hw + 4} ${hh} C ${-hw * .4 + 4} ${hh * .5} ${-hw * .4 + 4} ${-hh * .5} ${-hw + 4} ${-hh} Z`,
            lines: `M ${-hw} ${-hh} C ${-hw * .4} ${-hh * .5} ${-hw * .4} ${hh * .5} ${-hw} ${hh}`,
        };
        case "XNOR": return {
            body: `M ${-hw + 4} ${-hh} C 0 ${-hh} ${hw - 6} ${-hh * .5} ${hw - 6} 0 C ${hw - 6} ${hh * .5} 0 ${hh} ${-hw + 4} ${hh} C ${-hw * .4 + 4} ${hh * .5} ${-hw * .4 + 4} ${-hh * .5} ${-hw + 4} ${-hh} Z M ${hw - 1} 0 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0`,
            lines: `M ${-hw} ${-hh} C ${-hw * .4} ${-hh * .5} ${-hw * .4} ${hh * .5} ${-hw} ${hh}`,
        };
        case "NOT": return { body: `M ${-hw} ${-hh} L ${-hw} ${hh} L ${hw - 6} 0 Z M ${hw - 1} 0 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0` };
        case "INPUT": return { body: `M ${-hw} ${-hh * .7} L ${hw * .6} ${-hh * .7} L ${hw} 0 L ${hw * .6} ${hh * .7} L ${-hw} ${hh * .7} Z` };
        case "OUTPUT": return { body: `M ${-hw} ${-hh * .7} L ${hw * .4} ${-hh * .7} L ${hw} 0 L ${hw * .4} ${hh * .7} L ${-hw} ${hh * .7} Z` };
        default: return { body: `M ${-hw} ${-hh} L ${hw} ${-hh} L ${hw} ${hh} L ${-hw} ${hh} Z` };
    }
}

function getPortPositions(type: GateType): Record<string, Position> {
    const hw = GATE_HW, hh = GATE_HH;
    const n = GATE_INPUT_COUNT[type];
    const ports: Record<string, Position> = {};
    if (n === 1) { ports["in0"] = { x: -hw, y: 0 }; }
    else if (n === 2) { ports["in0"] = { x: -hw, y: -hh * .5 }; ports["in1"] = { x: -hw, y: hh * .5 }; }
    ports["out"] = { x: hw, y: 0 };
    return ports;
}

// ─── Lightweight circuit simulator (Kahn topological sort) ───────────────────
// Mirrors CircuitSimulator.ts — we need this to know which gates/wires are
// "active" so we can colour them correctly in the static render.

function simulateCircuit(
    gates: CircuitGate[],
    wires: CircuitWire[],
): { gateValues: Map<string, boolean>; wireValues: Map<string, boolean> } {
    const gateValues = new Map<string, boolean>();
    const portValues = new Map<string, boolean>(); // "gateId:portName" → value

    // Seed INPUT gates from their saved value
    for (const g of gates) {
        if (g.type === "INPUT") gateValues.set(g.id, g.value ?? false);
    }

    // Kahn's topological sort
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    for (const g of gates) { inDegree.set(g.id, 0); adjList.set(g.id, []); }
    for (const w of wires) {
        adjList.get(w.fromGate)?.push(w.toGate);
        inDegree.set(w.toGate, (inDegree.get(w.toGate) ?? 0) + 1);
    }
    const queue: string[] = [];
    for (const [id, deg] of inDegree) { if (deg === 0) queue.push(id); }
    const order: string[] = [];
    while (queue.length) {
        const node = queue.shift()!;
        order.push(node);
        for (const nb of (adjList.get(node) ?? [])) {
            const d = (inDegree.get(nb) ?? 1) - 1;
            inDegree.set(nb, d);
            if (d === 0) queue.push(nb);
        }
    }
    // Append any remaining (cycles)
    for (const g of gates) { if (!order.includes(g.id)) order.push(g.id); }

    // Evaluate each gate in dependency order
    for (const gateId of order) {
        const gate = gates.find(g => g.id === gateId);
        if (!gate) continue;

        if (gate.type === "INPUT") {
            portValues.set(`${gateId}:out`, gateValues.get(gateId) ?? false);
            continue;
        }

        const in0Wire = wires.find(w => w.toGate === gateId && w.toPort === "in0");
        const in1Wire = wires.find(w => w.toGate === gateId && w.toPort === "in1");
        const in0 = in0Wire ? (portValues.get(`${in0Wire.fromGate}:out`) ?? false) : false;
        const in1 = in1Wire ? (portValues.get(`${in1Wire.fromGate}:out`) ?? false) : false;

        let result = false;
        switch (gate.type) {
            case "AND": result = in0 && in1; break;
            case "OR": result = in0 || in1; break;
            case "NOT": result = !in0; break;
            case "NAND": result = !(in0 && in1); break;
            case "NOR": result = !(in0 || in1); break;
            case "XOR": result = in0 !== in1; break;
            case "XNOR": result = in0 === in1; break;
            case "OUTPUT": result = in0; break;
        }
        portValues.set(`${gateId}:out`, result);
        gateValues.set(gateId, result);
    }

    // Wire values: a wire carries the value of its source gate's output port
    const wireValues = new Map<string, boolean>();
    for (const w of wires) {
        wireValues.set(w.id, portValues.get(`${w.fromGate}:out`) ?? false);
    }

    return { gateValues, wireValues };
}

// ─── Edge path math ───────────────────────────────────────────────────────────

function getEdgePath(
    edge: GraphEdge,
    src: GraphNode,
    tgt: GraphNode,
    allEdges: GraphEdge[],
): { path: string; lx: number; ly: number } {
    const sx = src.position.x, sy = src.position.y;
    const tx = tgt.position.x, ty = tgt.position.y;
    const srcR = src.radius ?? 25;
    const tgtR = tgt.radius ?? 25;

    const normal = (dx: number, dy: number) => {
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        return { nx: dy / d, ny: -dx / d };
    };

    // 1. Self-loop
    if (src.id === tgt.id) {
        let loopAngle = -Math.PI / 2;
        const spread = 0.4, ctrlSpread = 0.5, pushOut = 90;
        if (edge.waypoints?.length === 1) {
            const wp = edge.waypoints[0];
            loopAngle = Math.atan2(wp.y - sy, wp.x - sx);
        } else {
            let sumX = 0, sumY = 0, count = 0;
            allEdges.forEach(e => {
                const otherId =
                    (e.source === src.id && e.target !== src.id) ? e.target :
                        (e.target === src.id && e.source !== src.id) ? e.source : null;
                if (otherId) {
                    const other = allEdges
                        .flatMap(ed => [ed.source, ed.target])
                        .filter(id => id === otherId);
                    // approximate: nudge away from the "average neighbor" direction
                    sumX += 1; sumY += 0; count++;
                }
            });
            if (count > 0 && (sumX !== 0 || sumY !== 0))
                loopAngle = Math.atan2(sumY, sumX) + Math.PI;
        }
        const curvePeak = pushOut * 0.75;
        return {
            path: `M ${sx + Math.cos(loopAngle - spread) * srcR} ${sy + Math.sin(loopAngle - spread) * srcR} C ${sx + Math.cos(loopAngle - ctrlSpread) * pushOut} ${sy + Math.sin(loopAngle - ctrlSpread) * pushOut}, ${sx + Math.cos(loopAngle + ctrlSpread) * pushOut} ${sy + Math.sin(loopAngle + ctrlSpread) * pushOut}, ${sx + Math.cos(loopAngle + spread) * srcR} ${sy + Math.sin(loopAngle + spread) * srcR}`,
            lx: sx + Math.cos(loopAngle) * curvePeak + Math.cos(loopAngle) * 12,
            ly: sy + Math.sin(loopAngle) * curvePeak + Math.sin(loopAngle) * 12,
        };
    }

    // 2. Multi-waypoint path
    if (edge.waypoints?.length) {
        const wps = edge.waypoints;
        const firstWp = wps[0], lastWp = wps[wps.length - 1];
        const startAngle = Math.atan2(firstWp.y - sy, firstWp.x - sx);
        const startX = sx + Math.cos(startAngle) * srcR;
        const startY = sy + Math.sin(startAngle) * srcR;
        const endAngle = Math.atan2(ty - lastWp.y, tx - lastWp.x);
        const endX = tx - Math.cos(endAngle) * (tgtR + 2);
        const endY = ty - Math.sin(endAngle) * (tgtR + 2);

        let path = `M ${startX} ${startY}`;
        for (let i = 0; i < wps.length; i++) {
            const wp = wps[i];
            if (wp.type === "linear") {
                path += ` L ${wp.x} ${wp.y}`;
            } else {
                if (wps.length === 1) {
                    const ctrlX = 2 * wp.x - 0.5 * startX - 0.5 * endX;
                    const ctrlY = 2 * wp.y - 0.5 * startY - 0.5 * endY;
                    path += ` Q ${ctrlX} ${ctrlY} ${endX} ${endY}`;
                } else {
                    const next = wps[i + 1];
                    const targetX = next ? (next.type === "bezier" ? (wp.x + next.x) / 2 : next.x) : endX;
                    const targetY = next ? (next.type === "bezier" ? (wp.y + next.y) / 2 : next.y) : endY;
                    path += ` Q ${wp.x} ${wp.y} ${targetX} ${targetY}`;
                }
            }
        }
        if (lastWp.type !== "bezier") path += ` L ${endX} ${endY}`;

        // label position: midpoint of piecewise segments
        const allPts = [{ x: startX, y: startY }, ...wps, { x: endX, y: endY }];
        let totalDist = 0;
        const dists: number[] = [];
        for (let i = 0; i < allPts.length - 1; i++) {
            const d = Math.sqrt((allPts[i + 1].x - allPts[i].x) ** 2 + (allPts[i + 1].y - allPts[i].y) ** 2);
            dists.push(d); totalDist += d;
        }
        const half = totalDist / 2;
        let run = 0, lx = 0, ly = 0;
        for (let i = 0; i < allPts.length - 1; i++) {
            if (run + dists[i] >= half || i === allPts.length - 2) {
                const ratio = dists[i] === 0 ? 0 : (half - run) / dists[i];
                const mx = allPts[i].x + (allPts[i + 1].x - allPts[i].x) * ratio;
                const my = allPts[i].y + (allPts[i + 1].y - allPts[i].y) * ratio;
                const sdx = allPts[i + 1].x - allPts[i].x, sdy = allPts[i + 1].y - allPts[i].y;
                const sd = dists[i] || 1;
                lx = mx + (sdy / sd) * 12;
                ly = my + (-sdx / sd) * 12;
                break;
            }
            run += dists[i];
        }
        return { path, lx, ly };
    }

    const dx = tx - sx, dy = ty - sy;
    const angle = Math.atan2(dy, dx);
    const hasReverse = allEdges.some(e => e.source === tgt.id && e.target === src.id);

    // 3. Two-way curve
    if (hasReverse) {
        const startX = sx + Math.cos(angle + 0.35) * srcR;
        const startY = sy + Math.sin(angle + 0.35) * srcR;
        const endX = tx + Math.cos(angle + Math.PI - 0.35) * tgtR;
        const endY = ty + Math.sin(angle + Math.PI - 0.35) * tgtR;
        const midX = (sx + tx) / 2, midY = (sy + ty) / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const { nx, ny } = normal(dx, dy);
        const ctrlX = midX + nx * (dist * 0.2), ctrlY = midY + ny * (dist * 0.2);
        const hx = (midX + ctrlX) / 2, hy = (midY + ctrlY) / 2;
        return {
            path: `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`,
            lx: hx + nx * 12, ly: hy + ny * 12,
        };
    }

    // 4. Straight line
    const startX = sx + Math.cos(angle) * srcR, startY = sy + Math.sin(angle) * srcR;
    const endX = tx - Math.cos(angle) * tgtR, endY = ty - Math.sin(angle) * tgtR;
    const { nx, ny } = normal(dx, dy);
    const hx = (startX + endX) / 2, hy = (startY + endY) / 2;
    return {
        path: `M ${startX} ${startY} L ${endX} ${endY}`,
        lx: hx + nx * 12, ly: hy + ny * 12,
    };
}

// ─── Wire path ────────────────────────────────────────────────────────────────
// Supports both the default cubic-bezier and straightWires (Manhattan) routing,
// exactly matching SvgEditor.updateGatePositions wire logic.

function getWirePath(
    wire: CircuitWire,
    fromGate: CircuitGate,
    toGate: CircuitGate,
    straightWires: boolean,
): string {
    const fp = getPortPositions(fromGate.type)[wire.fromPort];
    const tp = getPortPositions(toGate.type)[wire.toPort];
    if (!fp || !tp) return "";
    const x1 = fromGate.position.x + fp.x, y1 = fromGate.position.y + fp.y;
    const x2 = toGate.position.x + tp.x, y2 = toGate.position.y + tp.y;

    // Explicit waypoints always take precedence (same logic as plugin)
    if (wire.waypoints && wire.waypoints.length > 0) {
        const wps = wire.waypoints;
        let p = `M ${x1} ${y1}`;
        if (wps.length === 1) {
            const cp = wps[0];
            if (cp.type === "linear") {
                p += ` L ${cp.x} ${cp.y} L ${x2} ${y2}`;
            } else {
                const cx = 2 * cp.x - 0.5 * x1 - 0.5 * x2;
                const cy = 2 * cp.y - 0.5 * y1 - 0.5 * y2;
                p += ` Q ${cx} ${cy} ${x2} ${y2}`;
            }
        } else {
            wps.forEach((wp, i) => {
                if (wp.type === "linear") {
                    p += ` L ${wp.x} ${wp.y}`;
                } else {
                    const next = wps[i + 1];
                    const tx_ = next ? (next.type === "bezier" ? (wp.x + next.x) / 2 : next.x) : x2;
                    const ty_ = next ? (next.type === "bezier" ? (wp.y + next.y) / 2 : next.y) : y2;
                    p += ` Q ${wp.x} ${wp.y} ${tx_} ${ty_}`;
                }
            });
            if (wps[wps.length - 1].type !== "bezier") p += ` L ${x2} ${y2}`;
        }
        return p;
    }

    // No waypoints: use straightWires (Manhattan) or default bezier
    if (straightWires) {
        const midX = (x1 + x2) / 2;
        return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    }
    return `M ${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`;
}

// ─── ViewBox ──────────────────────────────────────────────────────────────────

function computeViewBox(data: GraphData): { x: number; y: number; w: number; h: number } {
    if (data.viewport?.viewBox) return data.viewport.viewBox;
    const xs: number[] = [], ys: number[] = [];
    const pad = 60;
    data.nodes.forEach(n => { xs.push(n.position.x - 35, n.position.x + 35); ys.push(n.position.y - 35, n.position.y + 35); });
    (data.gates ?? []).forEach(g => { xs.push(g.position.x - 35, g.position.x + 35); ys.push(g.position.y - 30, g.position.y + 40); });
    (data.groups ?? []).forEach(g => { xs.push(g.x, g.x + g.w); ys.push(g.y - 14, g.y + g.h); });
    if (xs.length === 0) return { x: 0, y: 0, w: 800, h: 300 };
    return {
        x: Math.min(...xs) - pad, y: Math.min(...ys) - pad,
        w: Math.max(...xs) - Math.min(...xs) + pad * 2,
        h: Math.max(...ys) - Math.min(...ys) + pad * 2,
    };
}

// ─── Label renderer: splits on $...$ and renders math with KaTeX ─────────────

function renderLabel(
    text: string,
    color: string,
    opts: { fontSize?: number; fontWeight?: number | string; bg?: string } = {},
): string {
    const { fontSize = 14, fontWeight = 700, bg = "transparent" } = opts;
    const parts = text.split(/((?<!\\)\$.*?(?<!\\)\$)/g);
    const inner = parts.map(part => {
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
            try {
                return katex.renderToString(part.slice(1, -1), {
                    throwOnError: false,
                    displayMode: false,
                    output: "html",
                });
            } catch {
                return `<span style="font-family:var(--font-mono,monospace);font-size:0.9em;">${part}</span>`;
            }
        }
        return part.length ? `<span class="in-graph-label-text">${part}</span>` : "";
    }).join("");

    return `<div xmlns="http://www.w3.org/1999/xhtml" class="in-graph-label" style="position:absolute;transform:translate(-50%,-50%);white-space:nowrap;display:inline-flex;align-items:center;gap:1px;font-size:${fontSize}px;font-weight:${fontWeight};color:${color};background:${bg};padding:1px 5px;border-radius:4px;">${inner}</div>`;
}

function getNodeRadius(node: { id: string; label?: string; radius?: number }): number {
    const text = node.label ?? node.id;
    if (!text) return 25;

    // 2. We can only measure DOM elements in the browser (skip during Next.js SSR)
    if (typeof document === "undefined") {
        return 25; 
    }

    // 3. Create an invisible, temporary DOM element
    const measureDiv = document.createElement("div");
    measureDiv.style.position = "absolute";
    measureDiv.style.visibility = "hidden";
    measureDiv.style.whiteSpace = "nowrap";
    measureDiv.style.fontSize = "14px"; // MUST match your .node-label-wrapper CSS
    measureDiv.style.fontWeight = "600";

    // 4. Render the exact KaTeX HTML into our temporary div
    let htmlContent = "";
    const parts = text.split(/((?<!\\)\$.*?(?<!\\)\$)/g);
    
    parts.forEach((part) => {
        if (part.startsWith("$") && part.endsWith("$")) {
            const math = part.slice(1, -1);
            try {
                htmlContent += katex.renderToString(math, { throwOnError: false, displayMode: true });
            } catch (e) {
                htmlContent += part;
            }
        } else {
            htmlContent += `<span>${part.replace(/\\\$/g, "$")}</span>`;
        }
    });

    measureDiv.innerHTML = htmlContent;
    document.body.appendChild(measureDiv);

    // 5. Measure the true physical pixels of the rendered math!
    const width = measureDiv.scrollWidth;
    const height = measureDiv.scrollHeight;

    // Clean up our temporary div
    document.body.removeChild(measureDiv);

    // 6. Apply your plugin's exact Pythagorean theorem + padding logic
    const calculatedRadius = Math.ceil(Math.sqrt((width / 2) ** 2 + (height / 2) ** 2)) - 5;

    return Math.max(25, calculatedRadius);
}

// ─── Main SVG renderer ────────────────────────────────────────────────────────

function renderGraphSVG(data: GraphData): string {
    const nodeStroke = "var(--graph-node-stroke)";
    const nodeFill = "var(--graph-node-fill)";
    const edgeStroke = "var(--graph-edge-stroke)";
    const textColor = "var(--graph-text)";
    const acceptCol = "var(--graph-node-accept-stroke)";
    const startCol = "var(--graph-node-start-arrow)";
    const gateFill = "var(--graph-gate-fill)";
    const gateStroke = nodeStroke;
    const activeColor = "var(--graph-active)";
    const straightWires = true;

    const vb = computeViewBox(data);
    const nodes = data.nodes ?? [];
    const edges = data.edges ?? [];
    const gates = data.gates ?? [];
    const wires = data.wires ?? [];
    const groups = data.groups ?? [];
    const markerId = "ig-arrow";

    // Run the circuit simulator so we can colour active gates/wires
    const { gateValues, wireValues } = simulateCircuit(gates, wires);

    // ── Defs ──
    const defs = `<defs>
      <marker id="${markerId}" viewBox="0 0 10 10" refX="10" refY="5"
              markerWidth="5" markerHeight="5" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${edgeStroke}"/>
      </marker>
    </defs>`;

    // ── Groups ──
    const groupsSvg = groups.map(g => {
        const col = g.color ?? "var(--graph-group-stroke)";
        const fill = g.color ? g.color + "18" : "var(--graph-group-fill)";
        const labelW = Math.max(60, ((g.label ?? "Frame").length * 8 + 16));
        return `<g class="in-graph-group">
          <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="6" fill="${fill}" stroke="${col}" stroke-width="2"/>
          <rect x="${g.x}" y="${g.y - 24}" width="${labelW}" height="22" rx="4" fill="${col}"/>
          <text x="${g.x + 8}" y="${g.y - 13}" font-size="12" font-weight="600" dominant-baseline="central"
                font-family="var(--font-sans,ui-sans-serif,sans-serif)"
                fill="var(--graph-group-label)">${g.label ?? "Frame"}</text>
        </g>`;
    }).join("\n");

    // ── Edges ──
    const edgesSvg = edges.map(edge => {
        const src = nodes.find(n => n.id === edge.source);
        const tgt = nodes.find(n => n.id === edge.target);
        if (!src || !tgt) return "";
        const col = edge.color ?? edgeStroke;
        const markerEnd = edge.type !== "line" ? `marker-end="url(#${markerId})"` : "";
        const { path, lx, ly } = getEdgePath(edge, src, tgt, edges);
        const label = edge.label ?? "";
        return `<g class="in-graph-edge">
          <path d="${path}" stroke="${col}" stroke-width="2" fill="none" stroke-linecap="butt" ${markerEnd}/>
          ${label ? `<foreignObject x="${lx}" y="${ly}" width="1" height="1" style="overflow:visible">
            ${renderLabel(label, textColor, { fontSize: 13, fontWeight: 600, bg: "var(--graph-label-bg)" })}
          </foreignObject>` : ""}
        </g>`;
    }).join("\n");

    // ── Nodes ──
    const nodesSvg = nodes.map(node => {
        const col = node.color ?? (node.isAccepting ? acceptCol : nodeStroke);
        const r = getNodeRadius(node);

        // Inner double-circle for accepting states
        const acceptRing = node.isAccepting
            ? `<circle r="${Math.max(r - 5, r * 0.8)}" fill="none" stroke="${acceptCol}" stroke-width="2"/>`
            : "";

        // Double-arrow (⇒) start indicator
        // Two parallel rails + a short left bar + filled arrowhead triangle
        let startArrowSvg = "";
        if (node.isStart) {
            const tip = -r;          // touches the node circle's left edge
            const shaft = tip - 18;    // how far left the arrow extends
            const gap = 2.25;         // half-distance between the two rails
            const head = 7;           // half-height of the arrowhead
            startArrowSvg = `<g fill="${startCol}" stroke="${startCol}" stroke-linecap="round" stroke-linejoin="round">
              <line x1="${shaft}" y1="${-gap}" x2="${tip - head + 1}" y2="${-gap}" stroke-width="1.8"/>
              <line x1="${shaft}" y1="${gap}"  x2="${tip - head + 1}" y2="${gap}"  stroke-width="1.8"/>
              <polygon points="${tip},0 ${tip - head},${-head} ${tip - head},${head}" stroke="none"/>
            </g>`;
        }

        const label = node.label ?? node.id;
        return `<g transform="translate(${node.position.x},${node.position.y})" class="in-graph-node">
          ${startArrowSvg}
          <circle r="${r}" stroke="${col}" fill="${nodeFill}" stroke-width="2"/>
          ${acceptRing}
          <foreignObject x="0" y="0" width="1" height="1" style="overflow:visible">
            ${renderLabel(label, textColor, { fontSize: 14, fontWeight: 700 })}
          </foreignObject>
        </g>`;
    }).join("\n");

    // ── Circuit wires ──
    const wiresSvg = wires.map(wire => {
        const fromGate = gates.find(g => g.id === wire.fromGate);
        const toGate = gates.find(g => g.id === wire.toGate);
        if (!fromGate || !toGate) return "";
        const active = wireValues.get(wire.id) ?? false;
        const stroke = active ? activeColor : edgeStroke;
        const width = active ? 2.5 : 2;
        const dash = active ? 'stroke-dasharray="10 6" class="in-graph-wire-active"' : "";
        const p = getWirePath(wire, fromGate, toGate, straightWires);
        return `<path d="${p}" stroke="${stroke}" stroke-width="${width}" fill="none"
                     stroke-linecap="round" ${dash}/>`;
    }).join("\n");

    // ── Circuit gates ──
    const gatesSvg = gates.map(gate => {
        const shape = getGateShape(gate.type);
        const isIO = gate.type === "INPUT" || gate.type === "OUTPUT";
        const active = gateValues.get(gate.id) ?? false;

        // IO gates light up with the active colour when their value is 1
        const gFill = (isIO && active) ? activeColor : gateFill;
        const gStroke = (isIO && active) ? activeColor : gateStroke;
        // Text on an active IO gate flips to the "on-accent" colour for legibility
        const gText = (isIO && active) ? "var(--graph-active-text)" : textColor;

        const extraLines = shape.lines
            ? `<path d="${shape.lines}" stroke="${gStroke}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
            : "";

        // Port dots: coloured by whether that port's signal is active
        const ports = getPortPositions(gate.type);
        const portDots = Object.entries(ports).map(([portName, pos]) => {
            // For output port: use the gate's own value; for input ports use edge
            const portActive = portName === "out"
                ? active
                : !!(wires.find(w => w.toGate === gate.id && w.toPort === portName)
                    && wireValues.get(wires.find(w => w.toGate === gate.id && w.toPort === portName)!.id));
            const pFill = portActive ? activeColor : gateFill;
            const pStroke = portActive ? activeColor : gateStroke;
            return `<circle cx="${pos.x}" cy="${pos.y}" r="4.5" fill="${pFill}" stroke="${pStroke}" stroke-width="1.5"/>`;
        }).join("");

        const typeText = isIO ? (active ? "1" : "0") : gate.type;

        const userLabel = gate.label
            ? `<foreignObject x="0" y="${GATE_HH + 6}" width="1" height="1" style="overflow:visible">
                 ${renderLabel(gate.label, textColor, { fontSize: 10, fontWeight: 500 })}
               </foreignObject>`
            : "";

        return `<g transform="translate(${gate.position.x},${gate.position.y})" class="in-graph-gate">
          <path d="${shape.body}" fill="${gFill}" stroke="${gStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          ${extraLines}
          ${portDots}
          <text x="0" y="0" text-anchor="middle" dominant-baseline="central"
                font-size="9" font-weight="600"
                font-family="var(--font-mono,ui-monospace,monospace)"
                fill="${gText}" pointer-events="none">${typeText}</text>
          ${userLabel}
        </g>`;
    }).join("\n");

    const h = data.viewport?.height ?? Math.max(200, vb.h);

    return `<svg viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"
  xmlns="http://www.w3.org/2000/svg"
  class="in-graph-static-svg"
  style="width:100%;height:${h}px;display:block;"
  aria-label="Graph diagram" role="img">
  ${defs}
  ${groupsSvg}
  ${edgesSvg}
  ${wiresSvg}
  ${nodesSvg}
  ${gatesSvg}
</svg>`;
}

// ─── DOM injection ────────────────────────────────────────────────────────────

export function renderInGraphPlaceholders(root: HTMLElement | null) {
    if (!root) return;
    root.querySelectorAll<HTMLDivElement>(".in-graph-placeholder").forEach(el => {
        if (el.dataset.rendered === "true") return;
        el.dataset.rendered = "true";
        const encoded = el.dataset.graph;
        if (!encoded) return;
        try {
            const json = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
            const wrapper = document.createElement("div");
            wrapper.className = "in-graph-static-wrapper";
            const hasGates = (json.gates ?? []).length > 0;
            wrapper.dataset.graphType = hasGates ? "Circuit" : "Automaton";
            wrapper.innerHTML = renderGraphSVG(json as GraphData);
            el.replaceWith(wrapper);
        } catch {
            el.innerHTML = `<div class="in-graph-error">Graph render error</div>`;
        }
    });
}

// ─── React component ──────────────────────────────────────────────────────────

export function InGraphStatic({ data, className = "" }: { data: GraphData; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        ref.current.innerHTML = renderGraphSVG(data);
    }, [data]);
    return <div ref={ref} className={`in-graph-static-wrapper ${className}`} />;
}

export function GraphArticleInjector({ articleEl }: { articleEl: HTMLElement | null }) {
    useEffect(() => { renderInGraphPlaceholders(articleEl); }, [articleEl]);
    return null;
}