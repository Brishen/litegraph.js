// Prebuilt patches. Each one is a plain builder function over a fresh LGraph, so
// the same code works in the app, in a test, and in your own project.

import { LiteGraph, LGraphGroup } from "../../src/litegraph.mjs";

/** Creates and positions a node, failing loudly if the type is not registered. */
function place(graph, type, pos, properties) {
    const node = LiteGraph.createNode(type);
    if (!node) {
        throw new Error(
            "unknown node type '" + type + "' - is its node pack imported in demoSetup.js?"
        );
    }
    node.pos = pos;
    graph.add(node);
    if (properties) {
        for (const key of Object.keys(properties)) {
            node.setProperty(key, properties[key]);
        }
    }
    return node;
}

function group(graph, title, pos, size, color) {
    const g = new LGraphGroup(title);
    g.pos = pos;
    g.size = size;
    if (color) {
        g.color = color;
    }
    graph.add(g);
    return g;
}

const firstPatch = {
    id: "first-patch",
    name: "First patch",
    blurb: "A constant feeding a watcher - the smallest useful graph.",
    build(graph) {
        const constant = place(graph, "basic/const", [180, 180]);
        constant.setValue(4.5);
        const watch = place(graph, "basic/watch", [460, 190]);
        constant.connect(0, watch, 0);

        place(graph, "demo/note", [170, 300], {
            text: "Drag from a slot to wire nodes. Right-click the canvas for the full node menu.",
        });
    },
};

const signalChain = {
    id: "signal-chain",
    name: "Signal chain",
    blurb: "A slider drives an oscillator into a scope and a dial.",
    build(graph) {
        const slider = place(graph, "widget/hslider", [120, 160], {
            min: 0.05,
            max: 2,
            value: 0.35,
        });
        const osc = place(graph, "demo/oscillator", [340, 130]);
        const scope = place(graph, "demo/scope", [620, 130]);
        const gauge = place(graph, "demo/gauge", [620, 330], { label: "level" });

        slider.connect(0, osc, 0);
        osc.connect(0, scope, 0);
        scope.connect(0, gauge, 0);

        place(graph, "demo/note", [110, 330], {
            text: "The scope and the dial read their colours from the canvas painting them - split the view and watch both skins stay legible.",
        });
    },
};

const mathPipeline = {
    id: "math-pipeline",
    name: "Math pipeline",
    blurb: "Two constants through an operation, clamped, then watched.",
    build(graph) {
        const a = place(graph, "basic/const", [140, 140]);
        a.setValue(3);
        const b = place(graph, "basic/const", [140, 240]);
        b.setValue(0.5);

        const op = place(graph, "math/operation", [380, 170], { OP: "*" });
        const clamp = place(graph, "math/clamp", [580, 175], { min: 0, max: 1 });
        const watch = place(graph, "basic/watch", [760, 180]);

        a.connect(0, op, 0);
        b.connect(0, op, 1);
        op.connect(0, clamp, 0);
        clamp.connect(0, watch, 0);

        const rand = place(graph, "math/rand", [380, 340], { min: -1, max: 1 });
        const smooth = place(graph, "math/average", [560, 340], { samples: 20 });
        const scope = place(graph, "demo/scope", [740, 300]);
        rand.connect(0, smooth, 0);
        smooth.connect(0, scope, 0);
    },
};

const eventFlow = {
    id: "event-flow",
    name: "Event flow",
    blurb: "A button and a metronome both drive one counter.",
    build(graph) {
        const button = place(graph, "widget/button", [140, 150]);
        const metronome = place(graph, "demo/metronome", [140, 280], { interval: 1 });
        const counter = place(graph, "events/counter", [420, 190]);
        const watch = place(graph, "basic/watch", [660, 200]);
        const gauge = place(graph, "demo/gauge", [660, 290], { min: 0, max: 20, label: "beats" });

        button.connect(0, counter, 0);
        metronome.connect(0, counter, 0);
        counter.connect(1, watch, 0);
        counter.connect(1, gauge, 0);

        place(graph, "demo/note", [130, 400], {
            text: "Amber wires carry events, not values. They fire on their own schedule instead of once per frame.",
        });
    },
};

const colorMixer = {
    id: "color-mixer",
    name: "Colour mixer",
    blurb: "Three sliders mixed into a hex colour.",
    build(graph) {
        const channels = ["r", "g", "b"];
        const defaults = [0.9, 0.45, 0.2];
        const swatch = place(graph, "demo/swatch", [520, 180]);

        channels.forEach((channel, index) => {
            const slider = place(graph, "widget/hslider", [180, 120 + index * 110], {
                min: 0,
                max: 1,
                value: defaults[index],
            });
            slider.title = channel.toUpperCase();
            slider.connect(0, swatch, index);
        });

        const watch = place(graph, "basic/watch", [740, 190]);
        swatch.connect(0, watch, 0);
    },
};

const workbench = {
    id: "workbench",
    name: "Workbench",
    blurb: "Groups, widgets, events and custom drawing in one patch.",
    build(graph) {
        group(graph, "SIGNAL", [80, 80], [700, 300], "#3f5159");
        const slider = place(graph, "widget/hslider", [110, 150], {
            min: 0.05,
            max: 2,
            value: 0.6,
        });
        const osc = place(graph, "demo/oscillator", [320, 130], { waveform: "triangle" });
        const scope = place(graph, "demo/scope", [560, 140]);
        slider.connect(0, osc, 0);
        osc.connect(0, scope, 0);

        group(graph, "TIMING", [80, 420], [700, 280], "#59503f");
        const metronome = place(graph, "demo/metronome", [110, 480], { interval: 0.75 });
        const counter = place(graph, "events/counter", [340, 470]);
        const gauge = place(graph, "demo/gauge", [560, 470], {
            min: 0,
            max: 30,
            label: "beats",
        });
        metronome.connect(0, counter, 0);
        counter.connect(1, gauge, 0);

        group(graph, "READOUT", [820, 80], [420, 620], "#3f4759");
        const trig = place(graph, "math/trigonometry", [860, 150]);
        osc.connect(0, trig, 0);
        const swatch = place(graph, "demo/swatch", [860, 300]);
        trig.connect(0, swatch, 0);
        trig.connect(1, swatch, 1);
        const watch = place(graph, "basic/watch", [860, 470]);
        swatch.connect(0, watch, 0);

        place(graph, "demo/note", [860, 560], {
            text: "Everything here serialises: export the JSON, reload the page, import it back.",
        });
    },
};

export const EXAMPLES = [
    firstPatch,
    signalChain,
    mathPipeline,
    eventFlow,
    colorMixer,
    workbench,
];

export const DEFAULT_EXAMPLE_ID = signalChain.id;

export function getExample(id) {
    return EXAMPLES.find((example) => example.id === id) || EXAMPLES[0];
}

/** Clears the graph and rebuilds it from an example. */
export function loadExample(graph, id) {
    const example = getExample(id);
    graph.clear();
    example.build(graph);
    return example;
}
