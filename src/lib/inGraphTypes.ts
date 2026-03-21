export type GateType = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR" | "INPUT" | "OUTPUT";

export interface Position
{
    x: number;
    y: number;
}

export interface GraphNode
{
    id: string;
    position: Position;
    label: string;
    isAccepting?: boolean;
    isStart?: boolean;
    color?: string;
}

export interface GraphWaypoint
{
    id: string;
    x: number;
    y: number;
    type: "linear" | "bezier";
}

export interface GraphEdge
{
    id: string;
    source: string;
    target: string;
    label?: string;
    waypoints?: GraphWaypoint[];
    color?: string;
    type?: "arrow" | "none";
}

export interface GraphTheme
{
    background?: string;
    nodeFill?: string;
    nodeStroke?: string;
    text?: string;
    edgeStroke?: string;
    startArrow?: string;
    acceptCircle?: string;
    gateStroke?: string;
    gateFill?: string;
    wireActive?: string;
    groupFill?: string;
    groupStroke?: string;
}

export interface GraphViewport
{
    height: number;
    viewBox: { x: number; y: number; w: number; h: number };
}

export interface GraphGroup
{
    id: string;
    label?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    color?: string;
}

export interface CircuitWireWaypoint
{
    id: string;
    x: number;
    y: number;
    type: "linear" | "bezier";
}

export interface CircuitWire
{
    id: string;
    fromGate: string;
    fromPort: string;
    toGate: string;
    toPort: string;
    waypoints?: CircuitWireWaypoint[];
}

export interface CircuitGate
{
    id: string;
    type: GateType;
    position: Position;
    label?: string;
    value?: boolean;
}

export interface GraphData
{
    nodes?: GraphNode[];
    edges?: GraphEdge[];
    gates?: CircuitGate[];
    wires?: CircuitWire[];
    groups?: GraphGroup[];
    theme?: GraphTheme;
    viewport?: GraphViewport;
}