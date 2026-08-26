import { describe, it, expect, beforeEach } from "vitest";
import { LGraph } from "../../src/litegraph.mjs";
import "./demoSetup.js";
import { filterNodeTypes, listNodeTypes } from "./demoSetup.js";
import { loadExample } from "./examples.js";
import {
    addNode,
    clearSavedPatch,
    fitToGraph,
    graphBounds,
    importGraph,
    loadSavedPatch,
    readOutputValue,
    readStats,
    savePatch,
    serializeGraph,
    toGraphPos,
    viewportCenter,
} from "./graphTools.js";

/** A stand-in for LGraphCanvas with just the fields the view helpers touch. */
function fakeCanvas(graph, width = 800, height = 600) {
    return {
        graph,
        canvas: {
            width,
            height,
            getBoundingClientRect: () => ({ left: 20, top: 10, width, height }),
        },
        ds: { scale: 1, offset: [0, 0] },
        dirty: 0,
        setDirty() {
            this.dirty++;
        },
        selectNodes() {},
    };
}

describe("view helpers", () => {
    it("converts screen coordinates into graph coordinates", () => {
        const canvas = fakeCanvas(new LGraph());
        canvas.ds.scale = 2;
        canvas.ds.offset = [10, 5];
        expect(toGraphPos(canvas, 120, 110)).toEqual([40, 45]);
    });

    it("reports the middle of the viewport", () => {
        const canvas = fakeCanvas(new LGraph());
        expect(viewportCenter(canvas)).toEqual([400, 300]);
    });

    it("measures the graph including groups", () => {
        const graph = new LGraph();
        loadExample(graph, "workbench");
        const bounds = graphBounds(graph);
        expect(bounds).not.toBeNull();
        expect(bounds[2]).toBeGreaterThan(0);
        expect(bounds[3]).toBeGreaterThan(0);
    });

    it("has no bounds for an empty graph and refuses to fit it", () => {
        const graph = new LGraph();
        expect(graphBounds(graph)).toBeNull();
        expect(fitToGraph(fakeCanvas(graph))).toBe(false);
    });

    it("fits the graph inside the viewport", () => {
        const graph = new LGraph();
        loadExample(graph, "workbench");
        const canvas = fakeCanvas(graph);

        expect(fitToGraph(canvas)).toBe(true);
        expect(canvas.ds.scale).toBeGreaterThan(0.15);
        expect(canvas.ds.scale).toBeLessThanOrEqual(1.4);
        expect(canvas.dirty).toBeGreaterThan(0);

        // Everything must land inside the visible area once the fit is applied.
        const [x, y, w, h] = graphBounds(graph);
        const scale = canvas.ds.scale;
        const left = (x + canvas.ds.offset[0]) * scale;
        const top = (y + canvas.ds.offset[1]) * scale;
        expect(left).toBeGreaterThanOrEqual(0);
        expect(top).toBeGreaterThanOrEqual(0);
        expect(left + w * scale).toBeLessThanOrEqual(canvas.canvas.width + 0.5);
        expect(top + h * scale).toBeLessThanOrEqual(canvas.canvas.height + 0.5);
    });
});

describe("graph editing helpers", () => {
    it("adds a known node at a position", () => {
        const graph = new LGraph();
        const canvas = fakeCanvas(graph);
        const node = addNode(graph, canvas, "demo/gauge", [12.4, 30.6]);
        expect(node).toBeTruthy();
        expect(node.pos[0]).toBe(12);
        expect(node.pos[1]).toBe(31);
        expect(graph._nodes.length).toBe(1);
    });

    it("returns null for an unknown type instead of throwing", () => {
        const graph = new LGraph();
        expect(addNode(graph, fakeCanvas(graph), "nope/missing", [0, 0])).toBeNull();
        expect(graph._nodes.length).toBe(0);
    });

    it("reads the value on an output slot", () => {
        const graph = new LGraph();
        loadExample(graph, "signal-chain");
        graph.runStep(1);
        const osc = graph._nodes.find((node) => node.type === "demo/oscillator");
        expect(typeof readOutputValue(osc, 0)).toBe("number");
        expect(readOutputValue(osc, 9)).toBeUndefined();
        expect(readOutputValue(null, 0)).toBeUndefined();
    });

    it("summarises the graph for the status rail", () => {
        const graph = new LGraph();
        loadExample(graph, "math-pipeline");
        const stats = readStats(graph, { fps: 42 });
        expect(stats.nodes).toBe(graph._nodes.length);
        expect(stats.links).toBe(Object.keys(graph.links).length);
        expect(stats.fps).toBe(42);
        expect(stats.running).toBe(false);
    });
});

describe("serialisation", () => {
    it("imports what it exports", () => {
        const source = new LGraph();
        loadExample(source, "event-flow");
        const target = new LGraph();

        const result = importGraph(target, serializeGraph(source));
        expect(result.ok).toBe(true);
        expect(target._nodes.length).toBe(source._nodes.length);
    });

    it("reports bad JSON without throwing", () => {
        const graph = new LGraph();
        loadExample(graph, "first-patch");
        const result = importGraph(graph, "{not json");
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/not valid JSON/);
        // The existing graph must survive a failed import.
        expect(graph._nodes.length).toBe(3);
    });

    it("rejects JSON that is not a graph object", () => {
        const graph = new LGraph();
        const result = importGraph(graph, "42");
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/serialised graph/);
    });
});

describe("browser storage", () => {
    beforeEach(() => clearSavedPatch());

    it("saves and restores a patch", () => {
        const graph = new LGraph();
        loadExample(graph, "color-mixer");
        expect(savePatch(graph)).toBe(true);

        const restored = new LGraph();
        expect(importGraph(restored, loadSavedPatch()).ok).toBe(true);
        expect(restored._nodes.length).toBe(graph._nodes.length);
    });

    it("has nothing to restore once cleared", () => {
        const graph = new LGraph();
        loadExample(graph, "first-patch");
        savePatch(graph);
        clearSavedPatch();
        expect(loadSavedPatch()).toBeNull();
    });
});

describe("node registry listing", () => {
    it("groups every registered type by category", () => {
        const groups = listNodeTypes();
        const categories = groups.map((group) => group.category);
        expect(categories).toContain("demo");
        expect(categories).toContain("math");
        expect(categories).toContain("events");
        // The packs that need a host app are hidden.
        const types = groups.flatMap((group) => group.nodes.map((node) => node.type));
        expect(types).not.toContain("graph/subgraph");
        expect(types).toContain("demo/oscillator");
    });

    it("sorts categories and the nodes inside them", () => {
        const groups = listNodeTypes();
        const categories = groups.map((group) => group.category);
        expect([...categories].sort()).toEqual(categories);
        for (const group of groups) {
            const names = group.nodes.map((node) => node.name);
            expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
        }
    });

    it("filters on type, title and description", () => {
        const groups = listNodeTypes();
        const matches = filterNodeTypes(groups, "oscill");
        expect(matches.length).toBe(1);
        expect(matches[0].nodes[0].type).toBe("demo/oscillator");

        expect(filterNodeTypes(groups, "   ")).toBe(groups);
        expect(filterNodeTypes(groups, "zzzzz")).toEqual([]);
    });
});
