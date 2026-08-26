const { LiteGraph, LGraph, LGraphCanvas } = require("./litegraph.js");
require("./nodes/base.js");

//---------------------------------------------------------------- headless stubs

function stubCanvasElement() {
    const ctx = new Proxy(
        {},
        { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }
    );
    return {
        width: 800,
        height: 600,
        style: {},
        parentNode: null,
        localName: "canvas",
        ownerDocument: { defaultView: null },
        getContext: () => ctx,
        addEventListener() {},
        removeEventListener() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
    };
}

/** A 2d context that records every colour assigned to it. */
function recordingContext() {
    const seen = [];
    const target = { canvas: { width: 800, height: 600 }, globalAlpha: 1 };
    const ctx = new Proxy(target, {
        get: (t, p) => {
            if (p in t) return t[p];
            if (p === "measureText") return () => ({ width: 10 });
            if (p === "createLinearGradient" || p === "createPattern")
                return () => ({ addColorStop() {} });
            return () => {};
        },
        set: (t, p, v) => {
            if (p === "fillStyle" || p === "strokeStyle" || p === "shadowColor") {
                seen.push(String(v));
            }
            t[p] = v;
            return true;
        }
    });
    return { ctx, seen };
}

function makeCanvas(theme) {
    const graph = new LGraph();
    const canvas = new LGraphCanvas(stubCanvasElement(), graph, {
        skip_render: true,
        skip_events: true,
        theme
    });
    return { graph, canvas };
}

beforeAll(() => {
    global.document = {
        createElement: () => stubCanvasElement(),
        addEventListener() {},
        removeEventListener() {},
        getElementsByTagName: () => [],
        body: {
            style: {},
            appendChild() {},
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
        }
    };
});

// The globals are shared state; snapshot and restore so tests cannot leak into
// each other (or into the rest of the suite).
let globalSnapshot;
beforeEach(() => {
    globalSnapshot = {};
    LiteGraph.THEME_KEYS.forEach((k) => (globalSnapshot[k] = LiteGraph[k]));
});
afterEach(() => {
    LiteGraph.THEME_KEYS.forEach((k) => (LiteGraph[k] = globalSnapshot[k]));
});

//---------------------------------------------------------------- theme object

describe("LiteGraph.createTheme", () => {
    it("falls back to the LiteGraph global when no override is set", () => {
        const theme = LiteGraph.createTheme();
        expect(theme.NODE_DEFAULT_BGCOLOR).toBe(LiteGraph.NODE_DEFAULT_BGCOLOR);
    });

    it("prefers an instance override over the global", () => {
        const theme = LiteGraph.createTheme({ NODE_DEFAULT_BGCOLOR: "#FFF" });
        expect(theme.NODE_DEFAULT_BGCOLOR).toBe("#FFF");
        expect(LiteGraph.NODE_DEFAULT_BGCOLOR).not.toBe("#FFF");
    });

    it("tracks later changes to the global when not overridden", () => {
        const theme = LiteGraph.createTheme();
        LiteGraph.NODE_DEFAULT_BGCOLOR = "#123456";
        expect(theme.NODE_DEFAULT_BGCOLOR).toBe("#123456");
    });

    it("keeps an override pinned when the global changes underneath it", () => {
        const theme = LiteGraph.createTheme({ NODE_DEFAULT_BGCOLOR: "#FFF" });
        LiteGraph.NODE_DEFAULT_BGCOLOR = "#123456";
        expect(theme.NODE_DEFAULT_BGCOLOR).toBe("#FFF");
    });

    it("reset() drops overrides and returns to the global", () => {
        const theme = LiteGraph.createTheme({ NODE_DEFAULT_BGCOLOR: "#FFF" });
        theme.reset();
        expect(theme.NODE_DEFAULT_BGCOLOR).toBe(LiteGraph.NODE_DEFAULT_BGCOLOR);
    });

    it("exposes only the explicit overrides", () => {
        const theme = LiteGraph.createTheme({ LINK_COLOR: "#2a2" });
        expect(theme.overrides).toEqual({ LINK_COLOR: "#2a2" });
    });

    it("warns on an unknown key instead of silently storing it", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        LiteGraph.createTheme({ NOT_A_THEME_KEY: 1 });
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it("keeps two themes independent", () => {
        const a = LiteGraph.createTheme({ LINK_COLOR: "#f00" });
        const b = LiteGraph.createTheme({ LINK_COLOR: "#00f" });
        expect(a.LINK_COLOR).toBe("#f00");
        expect(b.LINK_COLOR).toBe("#00f");
    });
});

//---------------------------------------------------------------- canvas wiring

describe("LGraphCanvas theming", () => {
    it("gives each canvas its own theme", () => {
        const light = makeCanvas({ NODE_DEFAULT_BGCOLOR: "#FFF" });
        const dark = makeCanvas();
        expect(light.canvas.theme.NODE_DEFAULT_BGCOLOR).toBe("#FFF");
        expect(dark.canvas.theme.NODE_DEFAULT_BGCOLOR).toBe(
            LiteGraph.NODE_DEFAULT_BGCOLOR
        );
    });

    it("routes legacy colour fields through the theme", () => {
        const { canvas } = makeCanvas({
            LINK_COLOR: "#2a2",
            NODE_TITLE_COLOR: "#000",
            CANVAS_BACKGROUND_COLOR: "#EAEAEA"
        });
        expect(canvas.default_link_color).toBe("#2a2");
        expect(canvas.node_title_color).toBe("#000");
        expect(canvas.clear_background_color).toBe("#EAEAEA");
    });

    it("still honours direct assignment to those legacy fields", () => {
        const { canvas } = makeCanvas({ LINK_COLOR: "#2a2" });
        canvas.default_link_color = "#999";
        expect(canvas.default_link_color).toBe("#999");
    });

    it("keeps following the globals when the canvas has no overrides", () => {
        const { canvas } = makeCanvas();
        LiteGraph.NODE_DEFAULT_BGCOLOR = "#abcdef";
        expect(canvas.theme.NODE_DEFAULT_BGCOLOR).toBe("#abcdef");
    });

    it("setTheme applies overrides and marks the canvas dirty", () => {
        const { canvas } = makeCanvas();
        canvas.dirty_canvas = false;
        canvas.dirty_bgcanvas = false;
        canvas.setTheme({ LINK_COLOR: "#2a2" });
        expect(canvas.theme.LINK_COLOR).toBe("#2a2");
        expect(canvas.dirty_canvas).toBe(true);
        expect(canvas.dirty_bgcanvas).toBe(true);
    });

    it("resetTheme returns the canvas to the globals", () => {
        const { canvas } = makeCanvas({ LINK_COLOR: "#2a2" });
        canvas.resetTheme();
        expect(canvas.theme.LINK_COLOR).toBe(LiteGraph.LINK_COLOR);
    });

    it("derives the title font from the theme text size", () => {
        const { canvas } = makeCanvas({ NODE_TEXT_SIZE: 20 });
        expect(canvas.title_text_font).toBe("20px Arial");
    });

    it("gives each canvas its own link_type_colors that still inherits new entries", () => {
        const a = makeCanvas();
        const b = makeCanvas();
        a.canvas.link_type_colors["number"] = "#f0f";
        expect(a.canvas.link_type_colors["number"]).toBe("#f0f");
        expect(b.canvas.link_type_colors["number"]).toBe("#AAA");

        // a pack registering a colour after construction still reaches both canvases
        LGraphCanvas.link_type_colors["LateType"] = "#0ff";
        expect(a.canvas.link_type_colors["LateType"]).toBe("#0ff");
        expect(b.canvas.link_type_colors["LateType"]).toBe("#0ff");
        delete LGraphCanvas.link_type_colors["LateType"];
    });
});

//---------------------------------------------------------------- paint output

describe("theme reaches paint time", () => {
    function paintColours(theme) {
        const { graph, canvas } = makeCanvas(theme);
        const node = LiteGraph.createNode("basic/const");
        node.pos = [100, 100];
        graph.add(node);
        const { ctx, seen } = recordingContext();
        canvas.drawNode(node, ctx);
        return seen;
    }

    it("paints two canvases differently without touching any global", () => {
        const before = LiteGraph.NODE_DEFAULT_BGCOLOR;
        const dark = paintColours();
        const light = paintColours({
            NODE_DEFAULT_BGCOLOR: "#FFFFFF",
            NODE_TEXT_COLOR: "#111111"
        });

        expect(dark).toContain(before);
        expect(dark).not.toContain("#FFFFFF");

        expect(light).toContain("#FFFFFF");
        expect(light).toContain("#111111");
        expect(light).not.toContain(before);

        // the whole point: no global was mutated to achieve this
        expect(LiteGraph.NODE_DEFAULT_BGCOLOR).toBe(before);
    });

    it("still respects a mutated global for a canvas without overrides", () => {
        LiteGraph.NODE_DEFAULT_BGCOLOR = "#0a0a0a";
        expect(paintColours()).toContain("#0a0a0a");
    });
});
