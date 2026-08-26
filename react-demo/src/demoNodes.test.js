import { describe, it, expect, beforeAll } from "vitest";
import { LiteGraph, LGraph } from "../../src/litegraph.mjs";
import "./demoSetup.js";
import { DEMO_NODE_TYPES } from "./demoNodes.js";

function node(graph, type) {
    const created = LiteGraph.createNode(type);
    graph.add(created);
    return created;
}

describe("demo nodes", () => {
    beforeAll(() => {
        // demoSetup registers on import; assert it actually took.
        for (const [type] of DEMO_NODE_TYPES) {
            expect(LiteGraph.registered_node_types[type]).toBeTruthy();
        }
    });

    it("registers every demo type exactly once", () => {
        const types = DEMO_NODE_TYPES.map(([type]) => type);
        expect(new Set(types).size).toBe(types.length);
    });

    it("oscillator produces the waveform its property asks for", () => {
        const graph = new LGraph();
        const osc = node(graph, "demo/oscillator");
        osc.setProperty("waveform", "saw");
        osc.setProperty("frequency", 1);

        graph.globaltime = 0.25;
        osc.onExecute();
        expect(osc.getOutputData(0)).toBeCloseTo(-0.5, 5);

        graph.globaltime = 0.75;
        osc.onExecute();
        expect(osc.getOutputData(0)).toBeCloseTo(0.5, 5);

        osc.setProperty("waveform", "square");
        graph.globaltime = 0.1;
        osc.onExecute();
        expect(osc.getOutputData(0)).toBe(1);
        graph.globaltime = 0.6;
        osc.onExecute();
        expect(osc.getOutputData(0)).toBe(-1);
    });

    it("oscillator scales by amplitude and follows a wired frequency", () => {
        const graph = new LGraph();
        const osc = node(graph, "demo/oscillator");
        osc.setProperty("waveform", "saw");
        osc.setProperty("frequency", 1);
        osc.setProperty("amplitude", 0.5);
        graph.globaltime = 0.75;
        osc.onExecute();
        expect(osc.getOutputData(0)).toBeCloseTo(0.25, 5);

        // A wired frequency wins for the frame but must not overwrite the property.
        osc.getInputData = () => 2;
        graph.globaltime = 0.125;
        osc.onExecute();
        expect(osc.getOutputData(0)).toBeCloseTo(-0.25, 5);
        expect(osc.properties.frequency).toBe(1);
    });

    it("scope records the signal flowing through it and passes it on", () => {
        const graph = new LGraph();
        const constant = node(graph, "basic/const");
        constant.setValue(0.7);
        const scope = node(graph, "demo/scope");
        constant.connect(0, scope, 0);

        graph.runStep(1);

        expect(scope._filled).toBe(1);
        expect(scope.getOutputData(0)).toBeCloseTo(0.7, 5);

        graph.runStep(3);
        expect(scope._filled).toBe(4);
    });

    it("swatch mixes three channels into a hex string", () => {
        const graph = new LGraph();
        const swatch = node(graph, "demo/swatch");
        swatch.setProperty("r", 1);
        swatch.setProperty("g", 0);
        swatch.setProperty("b", 0.5);
        swatch.onExecute();
        expect(swatch.getOutputData(0)).toBe("#ff0080");
    });

    it("swatch clamps out-of-range channels", () => {
        const graph = new LGraph();
        const swatch = node(graph, "demo/swatch");
        swatch.setProperty("r", 4);
        swatch.setProperty("g", -3);
        swatch.setProperty("b", 0);
        swatch.onExecute();
        expect(swatch.getOutputData(0)).toBe("#ff0000");
    });

    it("metronome fires once per interval", () => {
        const graph = new LGraph();
        const metronome = node(graph, "demo/metronome");
        const counter = node(graph, "events/counter");
        metronome.setProperty("interval", 1);
        metronome.connect(0, counter, 0);

        // runStep derives globaltime from starttime, so move the clock by moving
        // the start. LiteGraph defers actions by one step, hence the pairs.
        graph.starttime = LiteGraph.getTime();
        graph.runStep(1);
        graph.runStep(1);
        expect(counter.num).toBe(1);

        graph.runStep(2);
        expect(counter.num).toBe(1); // still inside the first interval

        graph.starttime = LiteGraph.getTime() - 1200;
        graph.runStep(1);
        graph.runStep(1);
        expect(counter.num).toBe(2);
    });

    it("gauge holds the last numeric value it saw", () => {
        const graph = new LGraph();
        const gauge = node(graph, "demo/gauge");
        gauge.getInputData = () => 0.42;
        gauge.onExecute();
        expect(gauge._value).toBeCloseTo(0.42, 5);

        gauge.getInputData = () => null;
        gauge.onExecute();
        expect(gauge._value).toBeCloseTo(0.42, 5);
    });

    it("draws without a real canvas context", () => {
        const graph = new LGraph();
        const ctx = document.createElement("canvas").getContext("2d");
        const graphcanvas = { theme: LiteGraph };
        for (const [type] of DEMO_NODE_TYPES) {
            const created = node(graph, type);
            if (created.onExecute) {
                created.onExecute();
            }
            if (created.onDrawBackground) {
                expect(() => created.onDrawBackground(ctx, graphcanvas)).not.toThrow();
            }
        }
    });
});
