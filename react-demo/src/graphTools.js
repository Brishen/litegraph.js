// Small helpers that sit between React state and the LiteGraph instance.

import { LiteGraph, LGraph } from "../../src/litegraph.mjs";

const STORAGE_KEY = "litegraph-bench.patch";

/** Screen position -> graph coordinates for a given canvas. */
export function toGraphPos(canvas, clientX, clientY) {
    const rect = canvas.canvas.getBoundingClientRect();
    const scale = canvas.ds.scale || 1;
    return [
        (clientX - rect.left) / scale - canvas.ds.offset[0],
        (clientY - rect.top) / scale - canvas.ds.offset[1],
    ];
}

/** Graph coordinates of the middle of the viewport. */
export function viewportCenter(canvas) {
    const scale = canvas.ds.scale || 1;
    return [
        canvas.canvas.width / 2 / scale - canvas.ds.offset[0],
        canvas.canvas.height / 2 / scale - canvas.ds.offset[1],
    ];
}

/**
 * Adds a node of `type` at graph position `pos`, selects it and returns it.
 * Returns null for an unknown type rather than throwing: the palette is driven by
 * the live registry, but a stale drag payload should not take the app down.
 */
export function addNode(graph, canvas, type, pos) {
    const node = LiteGraph.createNode(type);
    if (!node) {
        return null;
    }
    node.pos = [Math.round(pos[0]), Math.round(pos[1])];
    graph.add(node);
    if (canvas) {
        canvas.selectNodes([node]);
        canvas.setDirty(true, true);
    }
    return node;
}

/** Bounding box of every node and group in the graph, or null when it is empty. */
export function graphBounds(graph) {
    const boxes = [];
    for (const node of graph._nodes || []) {
        const height = node.flags && node.flags.collapsed ? 0 : node.size[1];
        boxes.push([
            node.pos[0],
            node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT,
            node.size[0],
            height + LiteGraph.NODE_TITLE_HEIGHT,
        ]);
    }
    for (const group of graph._groups || []) {
        boxes.push([group.pos[0], group.pos[1], group.size[0], group.size[1]]);
    }
    if (!boxes.length) {
        return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y, w, h] of boxes) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    }
    return [minX, minY, maxX - minX, maxY - minY];
}

/** Zooms and pans so the whole graph is on screen with a little breathing room. */
export function fitToGraph(canvas, padding = 40) {
    if (!canvas || !canvas.graph) {
        return false;
    }
    const bounds = graphBounds(canvas.graph);
    if (!bounds) {
        return false;
    }
    const viewWidth = canvas.canvas.width - padding * 2;
    const viewHeight = canvas.canvas.height - padding * 2;
    if (viewWidth <= 0 || viewHeight <= 0) {
        return false;
    }

    const scale = Math.max(
        0.15,
        Math.min(1.4, Math.min(viewWidth / bounds[2], viewHeight / bounds[3]))
    );
    canvas.ds.scale = scale;
    canvas.ds.offset[0] = canvas.canvas.width / 2 / scale - (bounds[0] + bounds[2] / 2);
    canvas.ds.offset[1] = canvas.canvas.height / 2 / scale - (bounds[1] + bounds[3] / 2);
    canvas.setDirty(true, true);
    return true;
}

/** A snapshot of what the status rail reports. */
export function readStats(graph, canvas) {
    const linkCount = graph && graph.links ? Object.keys(graph.links).length : 0;
    return {
        nodes: graph && graph._nodes ? graph._nodes.length : 0,
        links: linkCount,
        iteration: graph ? graph.iteration : 0,
        elapsed: graph ? graph.globaltime || 0 : 0,
        fps: canvas ? canvas.fps || 0 : 0,
        running: graph ? graph.status === LGraph.STATUS_RUNNING : false,
    };
}

/** The value currently on a node's first output, if it has one. */
export function readOutputValue(node, slot = 0) {
    if (!node || !node.outputs || !node.outputs[slot]) {
        return undefined;
    }
    return node.getOutputData ? node.getOutputData(slot) : node.outputs[slot]._data;
}

export function serializeGraph(graph) {
    return JSON.stringify(graph.serialize(), null, 2);
}

/**
 * Replaces the graph contents from JSON text.
 * Returns `{ ok: true }` or `{ ok: false, error }` - never throws, because this is
 * wired straight to a textarea the user is typing into.
 */
export function importGraph(graph, text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        return { ok: false, error: "That is not valid JSON: " + err.message };
    }
    if (!data || typeof data !== "object") {
        return { ok: false, error: "Expected a serialised graph object." };
    }
    try {
        graph.clear();
        graph.configure(data);
    } catch (err) {
        return { ok: false, error: "LiteGraph could not load that graph: " + err.message };
    }
    return { ok: true };
}

export function downloadGraph(graph, filename = "patch.json") {
    const blob = new Blob([serializeGraph(graph)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/* --------------------------------------------------------------- browser store */

export function savePatch(graph) {
    try {
        window.localStorage.setItem(STORAGE_KEY, serializeGraph(graph));
        return true;
    } catch (err) {
        return false;
    }
}

export function loadSavedPatch() {
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
        return null;
    }
}

export function clearSavedPatch() {
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
        /* storage unavailable - nothing to clear */
    }
}

export { STORAGE_KEY };
