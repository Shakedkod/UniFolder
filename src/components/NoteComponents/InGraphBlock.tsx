'use client';

import React, { useId, useMemo, useRef } from 'react';
import type { GraphData, GraphNode, GraphEdge, CircuitGate, CircuitWire, GraphGroup } from '@/lib/inGraphTypes';
import {
    getEdgePathData, getGateShape, getPortPositions,
    getWirePath, getWireActive, simulateCircuit,
    GATE_SIZE,
} from '@/lib/inGraphMath';
import katex from 'katex';

function createHtmlLabel(label: string): string
{
    // Parse and render math blocks: $$...$$ (display) and $...$ (inline)
    const parts: Array<string | { html: string }> = [];
    let lastIndex = 0;
    
    // Regex to match display math ($$...$$) and inline math ($...$)
    const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]*?\$)/g;
    let match;

    while ((match = mathRegex.exec(label)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        
        // Add text before the math
        if (start > lastIndex) {
            parts.push(label.substring(lastIndex, start));
        }

        // Render math with KaTeX
        const mathContent = match[0];
        const isDisplay = mathContent.startsWith('$$');
        const mathText = isDisplay 
            ? mathContent.slice(2, -2) 
            : mathContent.slice(1, -1);

        try {
            const html = katex.renderToString(mathText, {
                displayMode: isDisplay,
                throwOnError: false,
            });
            parts.push({ html });
        } catch {
            // If KaTeX fails, show the original text
            parts.push(mathContent);
        }

        lastIndex = end;
    }

    // Add remaining text
    if (lastIndex < label.length) {
        parts.push(label.substring(lastIndex));
    }

    // Build final HTML, escaping text but preserving rendered math
    return parts.map(part => {
        if (typeof part === 'string') {
            return part.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
        } else {
            return part.html;
        }
    }).join('');
}

// ─── EDGES + WIRES SVG OVERLAY ───────────────────────────────────────────────

function EdgesOverlay({ nodes, edges, gates, wires, gateStates, vb, markerId }: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    gates: CircuitGate[];
    wires: CircuitWire[];
    gateStates: Map<string, boolean>;
    vb: { x: number; y: number; w: number; h: number };
    markerId: string;
}) {
    const uid = markerId;

    return (
        <svg
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-full h-full overflow-visible"
            style={{ pointerEvents: 'none' }}
            aria-hidden="true"
        >
            <defs>
                <marker id={markerId} viewBox="0 0 10 10" refX={10} refY={5} markerWidth={5} markerHeight={5} orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current text-foreground" />
                </marker>
                <style>{`
                    @keyframes wf_${uid} { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -24; } }
                    .wa_${uid} { stroke-dasharray: 10 6; animation: wf_${uid} 0.4s linear infinite; }
                    @media (prefers-reduced-motion: reduce) { .wa_${uid} { animation: none; } }
                `}</style>
            </defs>

            {/* Automaton edges */}
            {edges.map(edge => {
                const src = nodes.find(n => n.id === edge.source);
                const tgt = nodes.find(n => n.id === edge.target);
                if (!src || !tgt) return null;
                const { path, lx, ly } = getEdgePathData(edge, src, tgt, edges, nodes);
                const stroke = edge.color || 'var(--foreground, black)';
                return (
                    <g key={edge.id}>
                        <path
                            d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="butt"
                            markerEnd={edge.type === 'arrow' ? `url(#${markerId})` : undefined}
                        />
                        {edge.label && (() => {
                            const displayLabel = createHtmlLabel(edge.label);
                            return (
                                <foreignObject x={lx} y={ly} width={1} height={1} overflow="visible">
                                    <div
                                        // @ts-ignore
                                        xmlns="http://www.w3.org/1999/xhtml"
                                        className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-xs text-foreground font-sans select-none pointer-events-none px-1"
                                        dangerouslySetInnerHTML={{ __html: displayLabel }}
                                    />
                                </foreignObject>
                            );
                        })()}
                    </g>
                );
            })}

            {/* Circuit wires */}
            {wires.map(wire => {
                const fg = gates.find(g => g.id === wire.fromGate);
                const tg = gates.find(g => g.id === wire.toGate);
                if (!fg || !tg) return null;
                const fp = getPortPositions(fg.type)[wire.fromPort];
                const tp = getPortPositions(tg.type)[wire.toPort];
                if (!fp || !tp) return null;
                const x1 = fg.position.x + fp.x, y1 = fg.position.y + fp.y;
                const x2 = tg.position.x + tp.x, y2 = tg.position.y + tp.y;
                const active = getWireActive(wire, gateStates);
                return (
                    <path
                        key={wire.id}
                        d={getWirePath(wire, x1, y1, x2, y2)}
                        fill="none"
                        stroke={active ? "var(--highlight)" : 'var(--foreground, black)'}
                        strokeWidth={active ? 2.5 : 2}
                        strokeLinecap="round"
                        className={active ? 'wire-active' : ''}
                    />
                );
            })}

            {/* Gate port dots */}
            {gates.map(gate => {
                const active = gateStates.get(gate.id) ?? false;
                return (
                    <g key={`ports-${gate.id}`}>
                        {Object.entries(getPortPositions(gate.type)).map(([name, pos]) => (
                            <circle
                                key={name}
                                cx={gate.position.x + pos.x}
                                cy={gate.position.y + pos.y}
                                r={4}
                                fill={active ? 'var(--highlight)' : 'transparent'}
                                stroke={active ? 'var(--highlight)' : 'var(--foreground, black)'}
                                strokeWidth={1.5}
                            />
                        ))}
                    </g>
                );
            })}

            {/* Start arrows */}
            {nodes.filter(n => n.isStart).map(node => (
                <path
                    key={`start-${node.id}`}
                    d={`M ${node.position.x - 45} ${node.position.y} L ${node.position.x - 25} ${node.position.y} M ${node.position.x - 30} ${node.position.y - 5} L ${node.position.x - 25} ${node.position.y} L ${node.position.x - 30} ${node.position.y + 5}`}
                    fill="none"
                    stroke={"var(--highlight)"}
                    strokeWidth={2}
                    strokeLinecap="round"
                />
            ))}
        </svg>
    );
}

// ─── AUTOMATON NODE ──────────────────────────────────────────────────────────

function AutomatonNode({ node, vb }: {
    node: GraphNode;
    vb: { x: number; y: number; w: number; h: number };
}) {
    const r = 25;
    const borderColor = 'var(--foreground, black)';
    const acceptColor = 'hsl(var(--primary, 142 71% 45%))';

    const left = ((node.position.x - r - vb.x) / vb.w) * 100;
    const top = ((node.position.y - r - vb.y) / vb.h) * 100;
    const size = (r * 2 / vb.w) * 100;

    return (
        <div
            className="absolute select-none"
            style={{ left: `${left}%`, top: `${top}%`, width: `${size}%`, aspectRatio: '1 / 1' }}
        >
            {/* Use SVG for the circle so stroke scales with the element */}
            <svg viewBox="-1 -1 2 2" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
                <circle cx={0} cy={0} r={1}
                    fill="var(--background, white)"
                    stroke={node.isAccepting ? acceptColor : borderColor}
                    strokeWidth={0.08}
                />
                {node.isAccepting && (
                    <circle cx={0} cy={0} r={0.78}
                        fill="none"
                        stroke={acceptColor}
                        strokeWidth={0.08}
                    />
                )}
            </svg>
            {/* Label on top */}
            <div
                className="absolute inset-0 flex items-center justify-center text-[clamp(8px,1.4vw,13px)] leading-none font-medium z-10"
                style={{ color: 'var(--foreground, black)' }}
            >
                {node.label}
            </div>
        </div>
    );
}

// ─── GATE ────────────────────────────────────────────────────────────────────

function GateEl({ gate, active, vb }: {
    gate: CircuitGate;
    active: boolean;
    vb: { x: number; y: number; w: number; h: number };
}) {
    const { w, h } = GATE_SIZE;
    const left = ((gate.position.x - w / 2 - vb.x) / vb.w) * 100;
    const top = ((gate.position.y - h / 2 - vb.y) / vb.h) * 100;
    const widthPct = (w / vb.w) * 100;
    const isIo = gate.type === 'INPUT' || gate.type === 'OUTPUT';
    const stroke = active && isIo ? "transparent" : "var(--foreground, black)";
    const fill = active && isIo ? 'var(--highlight)' : "var(--background)";
    const textColor = "var(--foreground, black)";
    const responsiveFontSize = (vb.w / 500) * (isIo ? 11 : 9);

    return (
        <div className="absolute" style={{ left: `${left}%`, top: `${top}%`, width: `${widthPct}%` }}>
            {/* Gate body — inline SVG just for the IEEE shape */}
            <svg
                viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
                width="100%"
                style={{ overflow: 'visible', display: 'block' }}
            >
                <path
                    d={getGateShape(gate.type)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <text
                    textAnchor="middle" dominantBaseline="central"
                    x={0} y={0}
                    fontSize={responsiveFontSize}
                    fontWeight={600}
                    fill={textColor}
                    style={{ fontFamily: 'var(--font-mono, monospace)', userSelect: 'none' }}
                >
                    {isIo ? (active ? '1' : '0') : gate.type}
                </text>
            </svg>
            {/* User label — plain HTML below the gate */}
            {gate.label && (
                <p
                    className="text-center mt-0.5 whitespace-nowrap select-none"
                    style={{ color: textColor, fontSize: responsiveFontSize * 0.9 }}
                    dangerouslySetInnerHTML={{ __html: createHtmlLabel(gate.label) }}
                />
            )}
        </div>
    );
}

// ─── GROUP FRAME ─────────────────────────────────────────────────────────────

function GroupFrameEl({ group, vb }: {
    group: GraphGroup;
    vb: { x: number; y: number; w: number; h: number };
}) {
    const left = ((group.x - vb.x) / vb.w) * 100;
    const top = ((group.y - vb.y) / vb.h) * 100;
    const width = (group.w / vb.w) * 100;
    const height = (group.h / vb.h) * 100;

    return (
        <div
            className="absolute rounded-lg border-2 border-dashed border-foreground/50 pointer-events-none"
            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
        >
            {group.label && (
                <div
                    className="absolute -top-3 left-2.5 px-2 md:px-4 py-0.5 md:py-1 text-[0.5rem] md:text-xs font-semibold leading-tight select-none bg-accent-background text-highlight rounded-2xl"
                    dangerouslySetInnerHTML={{ __html: createHtmlLabel(group.label) }}
                />
            )}
        </div>
    );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

interface GraphRendererProps {
    data: GraphData;
    className?: string;
}

export default function GraphRenderer({ data, className }: GraphRendererProps) {
    const uid = useId().replace(/:/g, '');
    const markerId = `arrow-${uid}`;

    const nodes = data.nodes ?? [];
    const edges = data.edges ?? [];
    const gates = data.gates ?? [];
    const wires = data.wires ?? [];
    const groups = data.groups ?? [];
    const vp = data.viewport;

    const gateStates = useMemo(() => simulateCircuit(gates, wires), [gates, wires]);

    const vb = vp?.viewBox
        ? { x: vp.viewBox.x, y: vp.viewBox.y, w: vp.viewBox.w, h: vp.viewBox.h }
        : { x: 0, y: 0, w: 800, h: 400 };

    // Read the actual background color from the DOM so gate fills match the page
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="w-full flex flex-row items-center justify-center">
            <div className="w-1/2">
                <div
                    ref={containerRef}
                    className={`relative w-full ${className ?? ''}`}
                    style={{ paddingBottom: `${(vb.h / vb.w) * 100}%` }}
                >
                    <div className="absolute inset-0">

                        {/* Groups behind everything */}
                        {groups.map(g => (
                            <GroupFrameEl key={g.id} group={g} vb={vb} />
                        ))}

                        {/* SVG overlay: edges, wires, ports, start arrows */}
                        <EdgesOverlay
                            nodes={nodes} edges={edges} gates={gates} wires={wires}
                            gateStates={gateStates} vb={vb} markerId={markerId}
                        />

                        {/* HTML nodes */}
                        {nodes.map(n => (
                            <AutomatonNode key={n.id} node={n} vb={vb} />
                        ))}

                        {/* HTML gates */}
                        {gates.map(g => (
                            <GateEl key={g.id} gate={g} active={gateStates.get(g.id) ?? false} vb={vb} />
                        ))}

                    </div>
                </div>
            </div>
        </div>
    );
}