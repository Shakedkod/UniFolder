import type {
    GraphNode, GraphEdge,
    CircuitGate, CircuitWire, GateType
} from "./inGraphTypes";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

export const GATE_SIZE = {w: 54, h: 40};

export const GATE_INPUT_COUNT: Record<GateType, number> = {
    AND: 2, OR: 2, NOT: 1, NAND: 2, NOR: 2, XOR: 2, XNOR: 2,
    INPUT: 0, OUTPUT: 1
};

// ─── PORT POSITIONS ──────────────────────────────────────────────────────────

export function getPortPositions(type: GateType): Record<string, { x: number; y: number }>
{
    const {w, h} = GATE_SIZE;
    const hw = w / 2, hh = h / 2;
    const inCount = GATE_INPUT_COUNT[type];
    const ports: Record<string, { x: number; y: number }> = {};
    if (inCount === 1) ports["in0"] = {x: -hw, y: 0};
    else if (inCount === 2)
    {
        ports["in0"] = {x: -hw, y: -hh * 0.5};
        ports["in1"] = {x: -hw, y: hh * 0.5};
    }
    ports["out"] = {x: hw, y: 0};
    return ports;
}

// ─── GATE SHAPES ─────────────────────────────────────────────────────────────

export function getGateShape(type: GateType): string {
    const { w, h } = GATE_SIZE;  // w=54, h=40
    const hw = w / 2, hh = h / 2;

    switch (type) {
        case 'AND':
            return [
                `M ${-hw} ${-hh}`,
                `L ${0} ${-hh}`,
                `C ${hw + 4} ${-hh} ${hw + 4} ${hh} ${0} ${hh}`,  // control points pushed out so curve peaks at hw
                `L ${-hw} ${hh}`,
                `Z`,
            ].join(' ');
        
        case 'NAND':
            return [
                `M ${-hw} ${-hh}`,
                `L ${0} ${-hh}`,
                `C ${hw - 1} ${-hh} ${hw - 1} ${hh} ${0} ${hh}`,
                `L ${-hw} ${hh}`,
                `Z`,
                `M ${hw} 0 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0`,
            ].join(' ');

        case 'OR':
            return [
                `M ${-hw} ${-hh}`,
                `C ${0} ${-hh} ${hw} ${-hh * 0.5} ${hw} ${0}`,   // top: flat-ish top sweeping to tip
                `C ${hw} ${hh * 0.5} ${0} ${hh} ${-hw} ${hh}`,   // bottom: tip back to bottom-left
                `C ${-hw * 0.4} ${hh * 0.5} ${-hw * 0.4} ${-hh * 0.5} ${-hw} ${-hh}`,  // concave left
                `Z`,
            ].join(' ');
        
        case 'NOR':
            return [
                `M ${-hw} ${-hh}`,
                `C ${0} ${-hh} ${hw - 6} ${-hh * 0.5} ${hw - 6} ${0}`,
                `C ${hw - 6} ${hh * 0.5} ${0} ${hh} ${-hw} ${hh}`,
                `C ${-hw * 0.4} ${hh * 0.5} ${-hw * 0.4} ${-hh * 0.5} ${-hw} ${-hh}`,
                `Z`,
                `M ${hw - 1} 0 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0`,
            ].join(' ');
        
        case 'XOR':
            return [
                `M ${-hw + 4} ${-hh}`,
                `C ${0} ${-hh} ${hw} ${-hh * 0.5} ${hw} ${0}`,
                `C ${hw} ${hh * 0.5} ${0} ${hh} ${-hw + 4} ${hh}`,
                `C ${-hw * 0.4 + 4} ${hh * 0.5} ${-hw * 0.4 + 4} ${-hh * 0.5} ${-hw + 4} ${-hh}`,
                `Z`,
                // extra back line offset to the left
                `M ${-hw} ${-hh} C ${-hw * 0.4} ${-hh * 0.5} ${-hw * 0.4} ${hh * 0.5} ${-hw} ${hh}`,
            ].join(' ');
        
        case 'XNOR':
            return [
                `M ${-hw + 4} ${-hh}`,
                `C ${0} ${-hh} ${hw - 6} ${-hh * 0.5} ${hw - 6} ${0}`,
                `C ${hw - 6} ${hh * 0.5} ${0} ${hh} ${-hw + 4} ${hh}`,
                `C ${-hw * 0.4 + 4} ${hh * 0.5} ${-hw * 0.4 + 4} ${-hh * 0.5} ${-hw + 4} ${-hh}`,
                `Z`,
                `M ${-hw} ${-hh} C ${-hw * 0.4} ${-hh * 0.5} ${-hw * 0.4} ${hh * 0.5} ${-hw} ${hh}`,
                `M ${hw - 1} 0 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0`,
            ].join(' ');

        case 'NOT':
            // Triangle pointing right + bubble
            return [
                `M ${-hw} ${-hh}`,
                `L ${-hw} ${hh}`,
                `L ${hw - 6} ${0}`,
                `Z`,
                `M ${hw - 1} 0 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0`,
            ].join(' ');

        case 'INPUT':
            return `M ${-hw} ${-hh*0.7} L ${hw*0.6} ${-hh*0.7} L ${hw} 0 L ${hw*0.6} ${hh*0.7} L ${-hw} ${hh*0.7} Z`;

        case 'OUTPUT':
            return `M ${-hw} ${-hh*0.7} L ${hw*0.4} ${-hh*0.7} L ${hw} 0 L ${hw*0.4} ${hh*0.7} L ${-hw} ${hh*0.7} Z`;

        default:
            return `M ${-hw} ${-hh} L ${hw} ${-hh} L ${hw} ${hh} L ${-hw} ${hh} Z`;
    }
}

// ─── EDGE PATH MATH ──────────────────────────────────────────────────────────

export function getEdgePathData(
    edge: GraphEdge,
    sourceNode: GraphNode,
    targetNode: GraphNode,
    allEdges: GraphEdge[],
    allNodes: GraphNode[]
): { path: string; lx: number; ly: number }
{
    const sx = sourceNode.position.x, sy = sourceNode.position.y;
    const tx = targetNode.position.x, ty = targetNode.position.y;
    const radius = 25;

    const getNormal = (dx: number, dy: number) =>
    {
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return {nx: dy / dist, ny: -dx / dist};
    };

    // Self-loop
    if (sourceNode.id === targetNode.id && (!edge.waypoints || edge.waypoints.length <= 1))
    {
        let loopAngle = -Math.PI / 2;
        const pushOut = 90, curvePeak = pushOut * 0.75;

        if (edge.waypoints?.length === 1)
        {
            const wp = edge.waypoints[0];
            loopAngle = Math.atan2(wp.y - sy, wp.x - sx);
        } else
        {
            let sumX = 0, sumY = 0, count = 0;
            allEdges.forEach(e =>
            {
                const otherId = (e.source === sourceNode.id && e.target !== sourceNode.id) ? e.target :
                    (e.target === sourceNode.id && e.source !== sourceNode.id) ? e.source : null;
                if (otherId)
                {
                    const other = allNodes.find(n => n.id === otherId);
                    if (other)
                    {
                        const ddx = other.position.x - sx, ddy = other.position.y - sy;
                        const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
                        sumX += ddx / dist;
                        sumY += ddy / dist;
                        count++;
                    }
                }
            });
            if (count > 0 && (sumX !== 0 || sumY !== 0)) loopAngle = Math.atan2(sumY, sumX) + Math.PI;
        }

        const spread = 0.4, ctrlSpread = 0.5;
        return {
            path: `M ${sx + Math.cos(loopAngle - spread) * radius} ${sy + Math.sin(loopAngle - spread) * radius} C ${sx + Math.cos(loopAngle - ctrlSpread) * pushOut} ${sy + Math.sin(loopAngle - ctrlSpread) * pushOut}, ${sx + Math.cos(loopAngle + ctrlSpread) * pushOut} ${sy + Math.sin(loopAngle + ctrlSpread) * pushOut}, ${sx + Math.cos(loopAngle + spread) * radius} ${sy + Math.sin(loopAngle + spread) * radius}`,
            lx: sx + Math.cos(loopAngle) * curvePeak + Math.cos(loopAngle) * 12,
            ly: sy + Math.sin(loopAngle) * curvePeak + Math.sin(loopAngle) * 12
        };
    }

    // Multi-point waypoint path
    if (edge.waypoints?.length)
    {
        const wps = edge.waypoints;
        const firstWp = wps[0], lastWp = wps[wps.length - 1];
        const startAngle = Math.atan2(firstWp.y - sy, firstWp.x - sx);
        const startX = sx + Math.cos(startAngle) * radius;
        const startY = sy + Math.sin(startAngle) * radius;
        const ddx = tx - lastWp.x, ddy = ty - lastWp.y;
        const angle = Math.atan2(ddy, ddx);
        const endX = tx - Math.cos(angle) * (radius + 2);
        const endY = ty - Math.sin(angle) * (radius + 2);

        let path = `M ${startX} ${startY}`;
        for (let i = 0; i < wps.length; i++)
        {
            const wp = wps[i];
            if (wp.type === "linear")
            {
                path += ` L ${wp.x} ${wp.y}`;
            } else
            {
                if (wps.length === 1)
                {
                    const ctrlX = 2 * wp.x - 0.5 * startX - 0.5 * endX;
                    const ctrlY = 2 * wp.y - 0.5 * startY - 0.5 * endY;
                    path += ` Q ${ctrlX} ${ctrlY} ${endX} ${endY}`;
                } else
                {
                    const next = wps[i + 1];
                    const targetX = next ? (next.type === "bezier" ? (wp.x + next.x) / 2 : next.x) : endX;
                    const targetY = next ? (next.type === "bezier" ? (wp.y + next.y) / 2 : next.y) : endY;
                    path += ` Q ${wp.x} ${wp.y} ${targetX} ${targetY}`;
                }
            }
        }
        if (lastWp.type !== "bezier") path += ` L ${endX} ${endY}`;

        const allPoints = [{x: startX, y: startY}, ...wps, {x: endX, y: endY}];
        let totalDist = 0;
        const distances: number[] = [];
        for (let i = 0; i < allPoints.length - 1; i++)
        {
            const d = Math.sqrt((allPoints[i + 1].x - allPoints[i].x) ** 2 + (allPoints[i + 1].y - allPoints[i].y) ** 2);
            distances.push(d);
            totalDist += d;
        }
        const halfDist = totalDist / 2;
        let runningDist = 0, lx = 0, ly = 0;
        for (let i = 0; i < allPoints.length - 1; i++)
        {
            if (runningDist + distances[i] >= halfDist || i === allPoints.length - 2)
            {
                const ratio = distances[i] === 0 ? 0 : (halfDist - runningDist) / distances[i];
                const midX = allPoints[i].x + (allPoints[i + 1].x - allPoints[i].x) * ratio;
                const midY = allPoints[i].y + (allPoints[i + 1].y - allPoints[i].y) * ratio;
                const segDx = allPoints[i + 1].x - allPoints[i].x;
                const segDy = allPoints[i + 1].y - allPoints[i].y;
                const dist = distances[i] || 1;
                lx = midX + (segDy / dist) * 12;
                ly = midY + (-segDx / dist) * 12;
                break;
            }
            runningDist += distances[i];
        }
        return {path, lx, ly};
    }

    const dx = tx - sx, dy = ty - sy;
    const angle = Math.atan2(dy, dx);
    const hasReverse = allEdges.some(e => e.source === targetNode.id && e.target === sourceNode.id);

    // Two-way curve
    if (hasReverse)
    {
        const startX = sx + Math.cos(angle + 0.35) * radius;
        const startY = sy + Math.sin(angle + 0.35) * radius;
        const endX = tx + Math.cos(angle + Math.PI - 0.35) * radius;
        const endY = ty + Math.sin(angle + Math.PI - 0.35) * radius;
        const midX = (sx + tx) / 2, midY = (sy + ty) / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const {nx, ny} = getNormal(dx, dy);
        const ctrlX = midX + nx * (dist * 0.2), ctrlY = midY + ny * (dist * 0.2);
        const hx = (midX + ctrlX) / 2, hy = (midY + ctrlY) / 2;
        return {
            path: `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`,
            lx: hx + nx * 12, ly: hy + ny * 12
        };
    }

    // Straight line
    const startX = sx + Math.cos(angle) * radius, startY = sy + Math.sin(angle) * radius;
    const endX = tx - Math.cos(angle) * radius, endY = ty - Math.sin(angle) * radius;
    const {nx, ny} = getNormal(dx, dy);
    const hx = (startX + endX) / 2, hy = (startY + endY) / 2;
    return {path: `M ${startX} ${startY} L ${endX} ${endY}`, lx: hx + nx * 12, ly: hy + ny * 12};
}

// ─── WIRE PATH MATH ──────────────────────────────────────────────────────────

export function getWirePath(wire: CircuitWire, x1: number, y1: number, x2: number, y2: number): string
{
    if (wire.waypoints && wire.waypoints.length > 0)
    {
        const wps = wire.waypoints;
        let p = `M ${x1} ${y1}`;
        if (wps.length === 1)
        {
            const cp = wps[0];
            const cx = 2 * cp.x - 0.5 * x1 - 0.5 * x2;
            const cy = 2 * cp.y - 0.5 * y1 - 0.5 * y2;
            p += ` Q ${cx} ${cy} ${x2} ${y2}`;
        } else
        {
            wps.forEach((wp, i) =>
            {
                if (wp.type === "linear")
                {
                    p += ` L ${wp.x} ${wp.y}`;
                } else
                {
                    const next = wps[i + 1];
                    const tx = next ? (next.type === "bezier" ? (wp.x + next.x) / 2 : next.x) : x2;
                    const ty = next ? (next.type === "bezier" ? (wp.y + next.y) / 2 : next.y) : y2;
                    p += ` Q ${wp.x} ${wp.y} ${tx} ${ty}`;
                }
            });
            if (wps[wps.length - 1].type !== "bezier") p += ` L ${x2} ${y2}`;
        }
        return p;
    }
    return `M ${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`;
}

// ─── CIRCUIT SIMULATION ──────────────────────────────────────────────────────

export function simulateCircuit(
    gates: CircuitGate[],
    wires: CircuitWire[]
): Map<string, boolean>
{
    const states = new Map<string, boolean>();

    // Restore persisted INPUT values
    for (const g of gates)
    {
        if (g.type === "INPUT") states.set(g.id, g.value ?? false);
    }

    // Topological sort (Kahn's)
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    for (const g of gates)
    {
        inDegree.set(g.id, 0);
        adjList.set(g.id, []);
    }
    for (const w of wires)
    {
        adjList.get(w.fromGate)?.push(w.toGate);
        inDegree.set(w.toGate, (inDegree.get(w.toGate) ?? 0) + 1);
    }
    const queue: string[] = [];
    for (const [id, deg] of inDegree)
    {
        if (deg === 0) queue.push(id);
    }
    const order: string[] = [];
    while (queue.length > 0)
    {
        const node = queue.shift() as string;
        order.push(node);
        for (const neighbor of (adjList.get(node) ?? []))
        {
            const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
            inDegree.set(neighbor, newDeg);
            if (newDeg === 0) queue.push(neighbor);
        }
    }
    for (const g of gates)
    {
        if (!order.includes(g.id)) order.push(g.id);
    }

    const portValues = new Map<string, boolean>();

    for (const gateId of order)
    {
        const gate = gates.find(g => g.id === gateId);
        if (!gate) continue;
        if (gate.type === "INPUT")
        {
            portValues.set(`${gateId}:out`, states.get(gateId) ?? false);
            continue;
        }
        const in0Wire = wires.find(w => w.toGate === gateId && w.toPort === "in0");
        const in1Wire = wires.find(w => w.toGate === gateId && w.toPort === "in1");
        const in0 = in0Wire ? (portValues.get(`${in0Wire.fromGate}:out`) ?? false) : false;
        const in1 = in1Wire ? (portValues.get(`${in1Wire.fromGate}:out`) ?? false) : false;

        let result = false;
        switch (gate.type)
        {
            case "AND":
                result = in0 && in1;
                break;
            case "OR":
                result = in0 || in1;
                break;
            case "NOT":
                result = !in0;
                break;
            case "NAND":
                result = !(in0 && in1);
                break;
            case "NOR":
                result = !(in0 || in1);
                break;
            case "XOR":
                result = in0 !== in1;
                break;
            case "XNOR":
                result = in0 === in1;
                break;
            case "OUTPUT":
                result = in0;
                break;
        }
        portValues.set(`${gateId}:out`, result);
        states.set(gateId, result);
    }

    return states;
}

export function getWireActive(wire: CircuitWire, states: Map<string, boolean>): boolean
{
    return states.get(wire.fromGate) ?? false;
}