import { describe, it, expect } from "vitest";
import { LiteGraph, LGraph } from "../../src/litegraph.mjs";
import "./demoSetup.js";
import { recordingContext } from "./test/recordingContext.js";
import { DEMO_NODE_TYPES } from "./demoNodes.js";

const THEME = { theme: LiteGraph };

function gauge(size, value, properties) {
    const graph = new LGraph();
    const node = LiteGraph.createNode("demo/gauge");
    graph.add(node);
    if (size) {
        node.size[0] = size[0];
        node.size[1] = size[1];
    }
    if (properties) {
        for (const key of Object.keys(properties)) {
            node.setProperty(key, properties[key]);
        }
    }
    node.getInputData = () => value;
    node.onExecute();
    return node;
}

function draw(node) {
    const ctx = recordingContext();
    node.onDrawBackground(ctx, THEME);
    return ctx;
}

/** Every size a user can drag the node to, plus the default. */
const SIZES = [
    [180, 150],
    [120, 90],
    [300, 150],
    [160, 300],
    [400, 400],
    [90, 60],
    [60, 40],
];

describe("gauge layout", () => {
    it("has a default size its own dial fits inside", () => {
        const node = gauge(null, 0.5);
        const box = draw(node).bounds();
        expect(box.bottom).toBeLessThanOrEqual(node.size[1]);
        expect(box.right).toBeLessThanOrEqual(node.size[0]);
    });

    it.each(SIZES)("stays inside the node at %ix%i", (width, height) => {
        for (const value of [-1, -0.23, 0, 0.5, 1]) {
            const node = gauge([width, height], value, { label: "level" });
            const box = draw(node).bounds();
            if (!box) {
                continue; // too small to draw anything, which is also inside
            }
            expect(box.left).toBeGreaterThanOrEqual(-0.5);
            expect(box.top).toBeGreaterThanOrEqual(-0.5);
            expect(box.right).toBeLessThanOrEqual(width + 0.5);
            expect(box.bottom).toBeLessThanOrEqual(height + 0.5);
        }
    });

    it("keeps clear of the input slot row", () => {
        const node = gauge([180, 150], 0.5);
        const box = draw(node).bounds();
        // Slot 0 is centred at 0.7 * NODE_SLOT_HEIGHT and is 20 tall.
        expect(box.top).toBeGreaterThanOrEqual(LiteGraph.NODE_SLOT_HEIGHT);
    });

    it("grows the dial with the node", () => {
        const small = gauge([140, 110], 0).layout();
        const large = gauge([320, 280], 0).layout();
        expect(large.radius).toBeGreaterThan(small.radius);
    });

    it("drops the dial rather than overflowing when squeezed", () => {
        const node = gauge([70, 44], 0.5);
        expect(node.layout().tiny).toBe(true);
        const box = draw(node).bounds();
        expect(box.bottom).toBeLessThanOrEqual(44.5);
        expect(box.top).toBeGreaterThanOrEqual(-0.5);
    });

    it("centres the dial horizontally", () => {
        const node = gauge([240, 150], 0);
        const { cx } = node.layout();
        expect(cx).toBe(120);
    });
});

describe("gauge reading", () => {
    it("holds the last number it was given", () => {
        const node = gauge([180, 150], 0.42);
        expect(node._value).toBeCloseTo(0.42, 5);
    });

    it("ignores a disconnected input instead of resetting", () => {
        const node = gauge([180, 150], 0.42);
        node.getInputData = () => null;
        node.onExecute();
        expect(node._value).toBeCloseTo(0.42, 5);
    });

    it("sweeps the arc across the range", () => {
        // The filled arc is the second arc drawn; its end angle tracks the value.
        const angles = [-1, 0, 1].map((value) => {
            const node = gauge([180, 150], value);
            const ctx = recordingContext();
            const arcs = [];
            const original = ctx.arc.bind(ctx);
            ctx.arc = (cx, cy, r, from, to) => {
                arcs.push([from, to]);
                original(cx, cy, r, from, to);
            };
            node.onDrawBackground(ctx, THEME);
            return arcs;
        });

        // At the minimum there is no filled arc at all, only the track and hub.
        const [atMin, atMid, atMax] = angles;
        expect(atMin.length).toBe(2);
        expect(atMid.length).toBe(3);
        expect(atMax[1][1]).toBeGreaterThan(atMid[1][1]);
        expect(atMid[1][1]).toBeGreaterThan(atMid[1][0]);
    });

    it("clamps a value outside the range to the ends of the arc", () => {
        const wild = gauge([180, 150], 900, { min: 0, max: 1 });
        const box = draw(wild).bounds();
        expect(box.right).toBeLessThanOrEqual(180.5);
        expect(box.bottom).toBeLessThanOrEqual(150.5);
    });

    it("survives a zero-width range", () => {
        const node = gauge([180, 150], 5, { min: 3, max: 3 });
        expect(() => draw(node)).not.toThrow();
    });

    it("draws nothing while collapsed", () => {
        const node = gauge([180, 150], 0.5);
        node.flags.collapsed = true;
        expect(draw(node).bounds()).toBeNull();
    });
});

describe("the other drawing nodes stay inside themselves", () => {
    function node(type, size, prepare) {
        const graph = new LGraph();
        const created = LiteGraph.createNode(type);
        graph.add(created);
        created.size[0] = size[0];
        created.size[1] = size[1];
        if (prepare) {
            prepare(created);
        }
        return created;
    }

    const feed = (value) => (created) => {
        created.getInputData = () => value;
        if (!created.onExecute) {
            return;
        }
        for (let i = 0; i < 4; i++) {
            created.onExecute();
        }
    };

    it.each([
        ["demo/scope", [240, 150]],
        ["demo/scope", [120, 80]],
        ["demo/scope", [400, 320]],
        ["demo/swatch", [160, 110]],
        ["demo/swatch", [110, 70]],
        ["demo/note", [240, 110]],
        ["demo/note", [140, 60]],
    ])("%s at %s", (type, size) => {
        const created = node(type, size, feed(0.5));
        const ctx = recordingContext();
        created.onDrawBackground(ctx, THEME);
        const box = ctx.bounds();
        if (!box) {
            return;
        }
        expect(box.left).toBeGreaterThanOrEqual(-0.5);
        expect(box.top).toBeGreaterThanOrEqual(-0.5);
        expect(box.right).toBeLessThanOrEqual(size[0] + 0.5);
        expect(box.bottom).toBeLessThanOrEqual(size[1] + 0.5);
    });
});

describe("default sizes fit what the node contains", () => {
    // LiteGraph puts widgets directly under the last slot regardless of the
    // node's height, so a default size that is a row short pushes the widget
    // through the slot above it and off the bottom edge.
    it.each(DEMO_NODE_TYPES.map(([type]) => [type]))(
        "%s is at least the size its slots and widgets need",
        (type) => {
            const node = LiteGraph.createNode(type);
            const required = node.computeSize();
            expect(node.size[0]).toBeGreaterThanOrEqual(required[0]);
            expect(node.size[1]).toBeGreaterThanOrEqual(required[1]);
        }
    );

    it("leaves room below the widgets on a node that has them", () => {
        const metronome = LiteGraph.createNode("demo/metronome");
        const slotRows = metronome.outputs.length * LiteGraph.NODE_SLOT_HEIGHT;
        const widgets = metronome.widgets.length * (LiteGraph.NODE_WIDGET_HEIGHT + 4);
        expect(metronome.size[1]).toBeGreaterThanOrEqual(slotRows + widgets);
    });
});

describe("nothing draws over a slot row", () => {
    /** The vertical band a node's slot dots and labels occupy. */
    function slotRows(node) {
        const rows = Math.max(
            node.inputs ? node.inputs.length : 0,
            node.outputs ? node.outputs.length : 0
        );
        return rows * LiteGraph.NODE_SLOT_HEIGHT;
    }

    function build(type, size, prepare) {
        const graph = new LGraph();
        const created = LiteGraph.createNode(type);
        graph.add(created);
        if (size) {
            created.size[0] = size[0];
            created.size[1] = size[1];
        }
        if (prepare) {
            prepare(created);
        }
        return created;
    }

    const white = (node) => {
        node.setProperty("r", 1);
        node.setProperty("g", 1);
        node.setProperty("b", 1);
        node.onExecute();
    };

    it("the swatch keeps its hex below the r/g/b inputs", () => {
        const swatch = build("demo/swatch", null, white);
        const ctx = recordingContext();
        swatch.onDrawBackground(ctx, THEME);
        const box = ctx.bounds();

        expect(box.top).toBeGreaterThanOrEqual(slotRows(swatch));
        expect(box.bottom).toBeLessThanOrEqual(swatch.size[1] + 0.5);
    });

    it("the swatch writes its hex in ink that survives the colour", () => {
        const light = build("demo/swatch", null, white);
        const dark = build("demo/swatch", null, (node) => {
            node.setProperty("r", 0);
            node.setProperty("g", 0);
            node.setProperty("b", 0);
            node.onExecute();
        });
        expect(light.inkColor()).toBe("#101010");
        expect(dark.inkColor()).toBe("#f4f4f4");
    });

    it("the swatch drops the hex rather than spilling out of a small chip", () => {
        const swatch = build("demo/swatch", [90, 80], (node) => node.onExecute());
        const ctx = recordingContext();
        swatch.onDrawBackground(ctx, THEME);
        const box = ctx.bounds();
        if (box) {
            expect(box.bottom).toBeLessThanOrEqual(80.5);
        }
    });

    it("the slider bar stops before its output slot", () => {
        const slider = build("widget/hslider", null, (node) => {
            node.value = 1; // full travel, the worst case
        });
        const ctx = recordingContext();
        slider.onDrawForeground(ctx, THEME);
        const box = ctx.bounds();

        // The slot dot is centred half a slot height in from the right edge.
        const dotLeft = slider.size[0] - LiteGraph.NODE_SLOT_HEIGHT * 0.5 - 4;
        expect(box.right).toBeLessThan(dotLeft);
    });

    it("the button box stops before its output slots", () => {
        const button = build("widget/button", null, null);
        const ctx = recordingContext();
        button.onDrawForeground(ctx, THEME);
        const box = ctx.bounds();

        const dotLeft = button.size[0] - LiteGraph.NODE_SLOT_HEIGHT * 0.5 - 4;
        expect(box.right).toBeLessThan(dotLeft);
    });

    it("the progress bar starts after its input slot", () => {
        const progress = build("widget/progress", null, (node) => {
            node.setProperty("value", 1);
        });
        const ctx = recordingContext();
        progress.onDrawForeground(ctx, THEME);
        const box = ctx.bounds();

        const dotRight = LiteGraph.NODE_SLOT_HEIGHT * 0.5 + 4;
        expect(box.left).toBeGreaterThan(dotRight);
    });

    it("a full slider still fills most of its node", () => {
        const slider = build("widget/hslider", null, (node) => {
            node.value = 1;
        });
        const track = slider.getTrack();
        expect(track.width).toBeGreaterThan(slider.size[0] * 0.6);
        expect(track.x + track.width).toBeLessThanOrEqual(slider.size[0]);
    });
});
