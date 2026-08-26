// Editing operations behind the keyboard shortcuts.
//
// LiteGraph already implements the hard parts - copyToClipboard preserves the
// links between copied nodes, deleteSelectedNodes reconnects a deleted node's
// pass-through wire - so this module is mostly about calling them consistently
// and reporting what happened, which is what the keymap and the tests need.

import { serializeGraph, importGraph } from "./graphTools.js";

const CLIPBOARD_KEY = "litegrapheditor_clipboard";

export function selectedNodes(canvas) {
    if (!canvas || !canvas.selected_nodes) {
        return [];
    }
    return Object.values(canvas.selected_nodes);
}

export function selectionCount(canvas) {
    return selectedNodes(canvas).length;
}

export function hasClipboard() {
    try {
        return Boolean(window.localStorage.getItem(CLIPBOARD_KEY));
    } catch (err) {
        return false;
    }
}

function readClipboard() {
    try {
        return window.localStorage.getItem(CLIPBOARD_KEY);
    } catch (err) {
        return null;
    }
}

function writeClipboard(value) {
    try {
        if (value == null) {
            window.localStorage.removeItem(CLIPBOARD_KEY);
        } else {
            window.localStorage.setItem(CLIPBOARD_KEY, value);
        }
    } catch (err) {
        /* storage unavailable - the clipboard just does not persist */
    }
}

/** Top-left corner of the current selection, in graph coordinates. */
export function selectionOrigin(canvas) {
    const nodes = selectedNodes(canvas);
    if (!nodes.length) {
        return null;
    }
    return nodes.reduce(
        (min, node) => [Math.min(min[0], node.pos[0]), Math.min(min[1], node.pos[1])],
        [Infinity, Infinity]
    );
}

export function selectAll(canvas) {
    if (!canvas || !canvas.graph) {
        return 0;
    }
    canvas.selectNodes();
    return selectionCount(canvas);
}

export function deselectAll(canvas) {
    if (!canvas) {
        return 0;
    }
    const count = selectionCount(canvas);
    canvas.deselectAllNodes();
    return count;
}

/**
 * Removes the selected nodes. deleteSelectedNodes empties selected_nodes without
 * firing onSelectionChange, so callers have to clear their own selection state.
 */
export function deleteSelection(canvas) {
    const count = selectionCount(canvas);
    if (!count) {
        return 0;
    }
    canvas.deleteSelectedNodes();
    return count;
}

export function copySelection(canvas) {
    const count = selectionCount(canvas);
    if (!count) {
        return 0;
    }
    canvas.copyToClipboard();
    return count;
}

export function cutSelection(canvas) {
    const count = copySelection(canvas);
    if (!count) {
        return 0;
    }
    canvas.deleteSelectedNodes();
    return count;
}

/**
 * Pastes the clipboard. LiteGraph drops the nodes at `graph_mouse`, so pass a
 * position when the pointer is not over the canvas - otherwise a paste triggered
 * from the keyboard lands wherever the mouse last happened to be.
 */
export function pasteClipboard(canvas, pos) {
    if (!canvas || !canvas.graph || !hasClipboard()) {
        return 0;
    }
    if (pos) {
        canvas.graph_mouse[0] = pos[0];
        canvas.graph_mouse[1] = pos[1];
    }
    const before = canvas.graph._nodes.length;
    canvas.pasteFromClipboard(false);
    return canvas.graph._nodes.length - before;
}

/**
 * Copies the selection and pastes it back slightly offset, leaving whatever the
 * user had on the clipboard untouched.
 */
export function duplicateSelection(canvas, offset = 28) {
    if (!selectionCount(canvas)) {
        return 0;
    }
    const saved = readClipboard();
    const origin = selectionOrigin(canvas);
    canvas.copyToClipboard();
    const added = pasteClipboard(canvas, [origin[0] + offset, origin[1] + offset]);
    writeClipboard(saved);
    return added;
}

/** Moves the selection by a whole number of graph units. */
export function nudgeSelection(canvas, dx, dy) {
    const nodes = selectedNodes(canvas);
    if (!nodes.length) {
        return 0;
    }
    for (const node of nodes) {
        node.pos[0] += dx;
        node.pos[1] += dy;
    }
    canvas.setDirty(true, true);
    return nodes.length;
}

/* ------------------------------------------------------------------ history */

const HISTORY_LIMIT = 64;

/**
 * Undo/redo over whole-graph snapshots.
 *
 * A node editor changes shape in too many ways to track individually, and a
 * serialised graph of this size is a few kilobytes, so each entry is simply the
 * output of graph.serialize(). `current` is always the live state; a change
 * pushes the previous `current` onto the past.
 *
 * Hook `record` to graph.onAfterChange and LiteGraph's own edits - dragging a
 * node, wiring two slots, deleting from its context menu - become undoable for
 * free.
 */
export class GraphHistory {
    constructor(graph, limit = HISTORY_LIMIT) {
        this.limit = limit;
        this.applying = false;
        this.pending = false;
        this.past = [];
        this.future = [];
        this.attach(graph);
    }

    attach(graph) {
        this.graph = graph;
        this.current = graph ? serializeGraph(graph) : null;
        this.past.length = 0;
        this.future.length = 0;
    }

    /** Call after a change. Returns true when it actually recorded something. */
    record() {
        if (!this.graph || this.applying) {
            return false;
        }
        const next = serializeGraph(this.graph);
        if (next === this.current) {
            return false;
        }
        this.past.push(this.current);
        if (this.past.length > this.limit) {
            this.past.shift();
        }
        this.current = next;
        this.future.length = 0;
        return true;
    }

    /**
     * Records once for the current batch of changes.
     *
     * LiteGraph fires afterChange several times for one logical edit - removing
     * three nodes fires it per node and again for the operation as a whole - so
     * recording each one would cost three undo presses to take back one delete.
     * Waiting for the end of the task collapses them into a single entry.
     */
    recordSoon() {
        if (this.pending || this.applying) {
            return;
        }
        this.pending = true;
        queueMicrotask(() => this.flush());
    }

    /** Runs a pending recordSoon() now. */
    flush() {
        this.pending = false;
        return this.record();
    }

    /** Forgets the history, e.g. after loading a different patch from scratch. */
    reset() {
        this.attach(this.graph);
    }

    get canUndo() {
        return this.past.length > 0;
    }

    get canRedo() {
        return this.future.length > 0;
    }

    apply(snapshot) {
        this.applying = true;
        try {
            return importGraph(this.graph, snapshot).ok;
        } finally {
            this.applying = false;
        }
    }

    undo() {
        if (!this.canUndo) {
            return false;
        }
        const snapshot = this.past.pop();
        this.future.push(this.current);
        this.current = snapshot;
        return this.apply(snapshot);
    }

    redo() {
        if (!this.canRedo) {
            return false;
        }
        const snapshot = this.future.pop();
        this.past.push(this.current);
        this.current = snapshot;
        return this.apply(snapshot);
    }
}

export { CLIPBOARD_KEY };
