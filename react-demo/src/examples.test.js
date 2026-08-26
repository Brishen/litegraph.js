import { describe, it, expect } from "vitest";
import { LGraph } from "../../src/litegraph.mjs";
import "./demoSetup.js";
import { EXAMPLES, getExample, loadExample } from "./examples.js";

describe("example patches", () => {
    it("every example has a unique id, a name and a blurb", () => {
        const ids = EXAMPLES.map((example) => example.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const example of EXAMPLES) {
            expect(example.name.length).toBeGreaterThan(0);
            expect(example.blurb.length).toBeGreaterThan(0);
        }
    });

    it.each(EXAMPLES.map((example) => [example.id]))("%s builds wired nodes", (id) => {
        const graph = new LGraph();
        loadExample(graph, id);
        expect(graph._nodes.length).toBeGreaterThan(1);
        expect(Object.keys(graph.links).length).toBeGreaterThan(0);
    });

    it.each(EXAMPLES.map((example) => [example.id]))("%s executes without errors", (id) => {
        const graph = new LGraph();
        loadExample(graph, id);
        // do_not_catch_errors: a throwing node fails the test instead of being
        // swallowed by LiteGraph's error handling.
        graph.runStep(1, true);
        graph.runStep(1, true);
        graph.runStep(1, true);
        expect(graph.iteration).toBe(3);
        expect(graph.errors_in_execution).toBeFalsy();
    });

    it.each(EXAMPLES.map((example) => [example.id]))("%s survives a JSON round trip", (id) => {
        const source = new LGraph();
        loadExample(source, id);
        const serialized = JSON.parse(JSON.stringify(source.serialize()));

        const restored = new LGraph();
        restored.configure(serialized);

        expect(restored._nodes.length).toBe(source._nodes.length);
        expect(Object.keys(restored.links).length).toBe(Object.keys(source.links).length);
        expect(restored._groups.length).toBe(source._groups.length);
    });

    it("loading a second example replaces the first", () => {
        const graph = new LGraph();
        loadExample(graph, "workbench");
        const big = graph._nodes.length;
        loadExample(graph, "first-patch");
        expect(graph._nodes.length).toBeLessThan(big);
        expect(graph._nodes.length).toBe(3);
    });

    it("feeds the oscillator the value the slider was built with", () => {
        const graph = new LGraph();
        loadExample(graph, "signal-chain");
        graph.runStep(1);

        const slider = graph._nodes.find((node) => node.type === "widget/hslider");
        expect(slider.getOutputData(0)).toBeCloseTo(0.35, 5);

        // The oscillator shows a wired frequency on its widget without adopting it.
        const osc = graph._nodes.find((node) => node.type === "demo/oscillator");
        expect(osc.widgets[1].value).toBeCloseTo(0.35, 3);
        expect(osc.properties.frequency).toBe(0.4);
    });

    it("falls back to the first example for an unknown id", () => {
        expect(getExample("nope").id).toBe(EXAMPLES[0].id);
    });

    it("keeps property edits through a round trip", () => {
        const graph = new LGraph();
        loadExample(graph, "signal-chain");
        const osc = graph._nodes.find((node) => node.type === "demo/oscillator");
        osc.setProperty("waveform", "square");

        const restored = new LGraph();
        restored.configure(JSON.parse(JSON.stringify(graph.serialize())));
        const restoredOsc = restored._nodes.find((node) => node.type === "demo/oscillator");
        expect(restoredOsc.properties.waveform).toBe("square");
        // The widget bound to that property has to come back in sync too.
        expect(restoredOsc.widgets[0].value).toBe("square");
    });
});
