import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LGraph, LGraphCanvas } from "../../src/litegraph.mjs";
import "./demoSetup.js";
import { loadExample } from "./examples.js";
import { serializeGraph } from "./graphTools.js";
import {
    CLIPBOARD_KEY,
    GraphHistory,
    copySelection,
    cutSelection,
    deleteSelection,
    deselectAll,
    duplicateSelection,
    hasClipboard,
    nudgeSelection,
    pasteClipboard,
    selectAll,
    selectionCount,
    selectionOrigin,
} from "./editing.js";

let graph;
let canvas;
let element;

/** A real LGraphCanvas: these operations are thin wrappers over its methods. */
function mount(exampleId = "first-patch") {
    graph = new LGraph();
    loadExample(graph, exampleId);
    element = document.createElement("canvas");
    element.width = 800;
    element.height = 600;
    // LiteGraph reaches for canvas.parentNode when the graph changes, so the
    // element has to be in the document the way it is in the app.
    document.body.appendChild(element);
    canvas = new LGraphCanvas(element, graph);
    return canvas;
}

function nodeOfType(type) {
    return graph._nodes.find((node) => node.type === type);
}

beforeEach(() => {
    window.localStorage.removeItem(CLIPBOARD_KEY);
});

afterEach(() => {
    if (canvas) {
        canvas.stopRendering();
        canvas.unbindEvents();
        canvas = null;
    }
    if (graph) {
        graph.stop();
        graph = null;
    }
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
        element = null;
    }
});

describe("selection", () => {
    it("selects and deselects every node", () => {
        mount("signal-chain");
        expect(selectionCount(canvas)).toBe(0);

        expect(selectAll(canvas)).toBe(graph._nodes.length);
        expect(selectionCount(canvas)).toBe(graph._nodes.length);

        expect(deselectAll(canvas)).toBe(graph._nodes.length);
        expect(selectionCount(canvas)).toBe(0);
    });

    it("reports the top-left corner of the selection", () => {
        mount("first-patch");
        expect(selectionOrigin(canvas)).toBeNull();

        const constant = nodeOfType("basic/const");
        const watch = nodeOfType("basic/watch");
        canvas.selectNodes([constant, watch]);

        const origin = selectionOrigin(canvas);
        expect(origin[0]).toBe(Math.min(constant.pos[0], watch.pos[0]));
        expect(origin[1]).toBe(Math.min(constant.pos[1], watch.pos[1]));
    });

    it("nudges the selection and leaves the rest alone", () => {
        mount("first-patch");
        const constant = nodeOfType("basic/const");
        const watch = nodeOfType("basic/watch");
        const watchPos = [...watch.pos];
        const before = [...constant.pos];
        canvas.selectNodes([constant]);

        expect(nudgeSelection(canvas, 10, -5)).toBe(1);
        expect(constant.pos[0]).toBe(before[0] + 10);
        expect(constant.pos[1]).toBe(before[1] - 5);
        expect([...watch.pos]).toEqual(watchPos);
    });

    it("does nothing with an empty selection", () => {
        mount("first-patch");
        expect(nudgeSelection(canvas, 10, 10)).toBe(0);
        expect(deleteSelection(canvas)).toBe(0);
        expect(copySelection(canvas)).toBe(0);
        expect(cutSelection(canvas)).toBe(0);
        expect(duplicateSelection(canvas)).toBe(0);
    });
});

describe("delete", () => {
    it("removes the selected nodes", () => {
        mount("first-patch");
        const before = graph._nodes.length;
        canvas.selectNodes([nodeOfType("demo/note")]);

        expect(deleteSelection(canvas)).toBe(1);
        expect(graph._nodes.length).toBe(before - 1);
        expect(nodeOfType("demo/note")).toBeUndefined();
        expect(selectionCount(canvas)).toBe(0);
    });

    it("rejoins the wire through a deleted node", () => {
        mount("signal-chain");
        const scope = nodeOfType("demo/scope");
        const oscillator = nodeOfType("demo/oscillator");
        const gauge = nodeOfType("demo/gauge");
        expect(scope.getInputNode(0)).toBe(oscillator);

        canvas.selectNodes([scope]);
        deleteSelection(canvas);

        // LiteGraph reconnects the first input to the first output on delete.
        expect(gauge.getInputNode(0)).toBe(oscillator);
    });
});

describe("clipboard", () => {
    it("copies without changing the graph", () => {
        mount("first-patch");
        const before = graph._nodes.length;
        canvas.selectNodes([nodeOfType("basic/const")]);

        expect(copySelection(canvas)).toBe(1);
        expect(hasClipboard()).toBe(true);
        expect(graph._nodes.length).toBe(before);
    });

    it("cuts, which is a copy plus a delete", () => {
        mount("first-patch");
        const before = graph._nodes.length;
        canvas.selectNodes([nodeOfType("basic/const")]);

        expect(cutSelection(canvas)).toBe(1);
        expect(graph._nodes.length).toBe(before - 1);
        expect(hasClipboard()).toBe(true);

        expect(pasteClipboard(canvas, [400, 400])).toBe(1);
        expect(graph._nodes.length).toBe(before);
    });

    it("pastes at the position it is given", () => {
        mount("first-patch");
        canvas.selectNodes([nodeOfType("basic/const")]);
        copySelection(canvas);

        expect(pasteClipboard(canvas, [640, 480])).toBe(1);
        const pasted = graph._nodes[graph._nodes.length - 1];
        expect(pasted.pos[0]).toBe(640);
        expect(pasted.pos[1]).toBe(480);
        // The pasted node is the new selection.
        expect(selectionCount(canvas)).toBe(1);
    });

    it("keeps the links between copied nodes", () => {
        mount("first-patch");
        canvas.selectNodes([nodeOfType("basic/const"), nodeOfType("basic/watch")]);
        copySelection(canvas);
        const linksBefore = Object.keys(graph.links).length;

        expect(pasteClipboard(canvas, [500, 500])).toBe(2);
        expect(Object.keys(graph.links).length).toBe(linksBefore + 1);
    });

    it("pastes nothing when the clipboard is empty", () => {
        mount("first-patch");
        const before = graph._nodes.length;
        expect(pasteClipboard(canvas, [10, 10])).toBe(0);
        expect(graph._nodes.length).toBe(before);
    });

    it("carries property values across a copy", () => {
        mount("signal-chain");
        const oscillator = nodeOfType("demo/oscillator");
        oscillator.setProperty("waveform", "square");
        canvas.selectNodes([oscillator]);
        copySelection(canvas);
        pasteClipboard(canvas, [900, 900]);

        const pasted = graph._nodes[graph._nodes.length - 1];
        expect(pasted.type).toBe("demo/oscillator");
        expect(pasted.properties.waveform).toBe("square");
    });
});

describe("duplicate", () => {
    it("copies the selection in place and offsets it", () => {
        mount("first-patch");
        const constant = nodeOfType("basic/const");
        const before = graph._nodes.length;
        canvas.selectNodes([constant]);

        expect(duplicateSelection(canvas, 28)).toBe(1);
        expect(graph._nodes.length).toBe(before + 1);

        const copy = graph._nodes[graph._nodes.length - 1];
        expect(copy.pos[0]).toBe(constant.pos[0] + 28);
        expect(copy.pos[1]).toBe(constant.pos[1] + 28);
    });

    it("leaves the real clipboard untouched", () => {
        mount("first-patch");
        canvas.selectNodes([nodeOfType("basic/watch")]);
        copySelection(canvas);
        const clipboard = window.localStorage.getItem(CLIPBOARD_KEY);

        canvas.selectNodes([nodeOfType("basic/const")]);
        duplicateSelection(canvas);

        expect(window.localStorage.getItem(CLIPBOARD_KEY)).toBe(clipboard);
    });
});

describe("undo history", () => {
    it("starts with nothing to undo", () => {
        mount("first-patch");
        const history = new GraphHistory(graph);
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(false);
        expect(history.undo()).toBe(false);
        expect(history.redo()).toBe(false);
    });

    it("undoes and redoes a delete", () => {
        mount("first-patch");
        const history = new GraphHistory(graph);
        const before = graph._nodes.length;

        canvas.selectNodes([nodeOfType("demo/note")]);
        deleteSelection(canvas);
        history.record();

        expect(history.canUndo).toBe(true);
        expect(graph._nodes.length).toBe(before - 1);

        expect(history.undo()).toBe(true);
        expect(graph._nodes.length).toBe(before);
        expect(history.canRedo).toBe(true);

        expect(history.redo()).toBe(true);
        expect(graph._nodes.length).toBe(before - 1);
    });

    it("ignores a record that changed nothing", () => {
        mount("first-patch");
        const history = new GraphHistory(graph);
        expect(history.record()).toBe(false);
        expect(history.canUndo).toBe(false);
    });

    it("restores node positions, not just their existence", () => {
        mount("first-patch");
        const history = new GraphHistory(graph);
        const constant = nodeOfType("basic/const");
        const original = [...constant.pos];

        canvas.selectNodes([constant]);
        nudgeSelection(canvas, 40, 40);
        history.record();
        history.undo();

        expect([...nodeOfType("basic/const").pos]).toEqual(original);
    });

    it("drops the redo stack once you make a new change", () => {
        mount("first-patch");
        const history = new GraphHistory(graph);

        canvas.selectNodes([nodeOfType("demo/note")]);
        deleteSelection(canvas);
        history.record();
        history.undo();
        expect(history.canRedo).toBe(true);

        canvas.selectNodes([nodeOfType("basic/const")]);
        nudgeSelection(canvas, 5, 5);
        history.record();
        expect(history.canRedo).toBe(false);
    });

    it("caps how far back it remembers", () => {
        mount("first-patch");
        const history = new GraphHistory(graph, 3);
        canvas.selectNodes([nodeOfType("basic/const")]);

        for (let i = 0; i < 6; i++) {
            nudgeSelection(canvas, 1, 0);
            history.record();
        }
        expect(history.past.length).toBe(3);
    });

    it("records one entry for one edit, however LiteGraph reports it", () => {
        mount("signal-chain");
        const history = new GraphHistory(graph);
        // Mimic App: LiteGraph's own changes route through recordSoon().
        graph.onAfterChange = () => history.recordSoon();

        // Deleting three nodes fires afterChange several times over.
        canvas.selectNodes(graph._nodes.slice(0, 3));
        deleteSelection(canvas);
        history.flush();

        expect(history.past.length).toBe(1);

        history.undo();
        expect(history.past.length).toBe(0);
        expect(history.canRedo).toBe(true);
        expect(graph._nodes.length).toBe(5);
    });

    it("does not record while it is applying an undo", () => {
        mount("first-patch");
        const history = new GraphHistory(graph);
        graph.onAfterChange = () => history.recordSoon();

        canvas.selectNodes([nodeOfType("demo/note")]);
        deleteSelection(canvas);
        history.flush();

        history.undo();
        history.flush(); // anything the undo itself queued must be a no-op
        expect(history.past.length).toBe(0);
        expect(history.canRedo).toBe(true);
    });

    it("walks back through several edits in order", () => {
        mount("first-patch");
        const history = new GraphHistory(graph);
        const snapshots = [serializeGraph(graph)];

        canvas.selectNodes([nodeOfType("basic/const")]);
        for (let i = 0; i < 3; i++) {
            nudgeSelection(canvas, 7, 0);
            history.record();
            snapshots.push(serializeGraph(graph));
        }

        for (let i = snapshots.length - 2; i >= 0; i--) {
            expect(history.undo()).toBe(true);
            expect(serializeGraph(graph)).toBe(snapshots[i]);
        }
        expect(history.canUndo).toBe(false);
    });
});
