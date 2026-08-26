// Theme presets for the bench.
//
// Each preset carries two halves that are deliberately kept apart:
//
//   canvas - a LiteGraph theme object, handed to <LiteGraphCanvas theme={...}>.
//            Purely per-instance; nothing here touches the LiteGraph globals, which
//            is what lets the split view render one graph in two skins at once.
//   chrome - CSS custom properties for the React UI around the canvas, so the
//            panels move with the canvas instead of fighting it.

const BENCH = {
    id: "bench",
    label: "Bench",
    blurb: "Slate console, amber signal",
    scheme: "dark",
    chrome: {
        "--bg": "#0c0f15",
        "--panel": "#141822",
        "--panel-2": "#1a1f2c",
        "--rail": "#232a3a",
        "--ink": "#e8eaf2",
        "--dim": "#828ba3",
        "--signal": "#ffb03a",
        "--signal-ink": "#1a1205",
        "--patch": "#5ad1e6",
    },
    canvas: {
        NODE_DEFAULT_BGCOLOR: "#1c2130",
        NODE_DEFAULT_COLOR: "#141822",
        NODE_TITLE_COLOR: "#c9cfe2",
        NODE_SELECTED_TITLE_COLOR: "#ffb03a",
        NODE_TEXT_COLOR: "#aab2c8",
        NODE_BOX_OUTLINE_COLOR: "#ffb03a",
        DEFAULT_SHADOW_COLOR: "rgba(0,0,0,0.55)",
        WIDGET_BGCOLOR: "#10141d",
        WIDGET_OUTLINE_COLOR: "#39415a",
        WIDGET_TEXT_COLOR: "#dfe4f0",
        WIDGET_SECONDARY_TEXT_COLOR: "#828ba3",
        LINK_COLOR: "#5ad1e6",
        EVENT_LINK_COLOR: "#ffb03a",
        CONNECTING_LINK_COLOR: "#ffe0a8",
        CANVAS_BACKGROUND_COLOR: "#0c0f15",
    },
};

const DAYLIGHT = {
    id: "daylight",
    label: "Daylight",
    blurb: "Paper white, ink wires",
    scheme: "light",
    chrome: {
        "--bg": "#eceef2",
        "--panel": "#ffffff",
        "--panel-2": "#f4f6f9",
        "--rail": "#d7dce5",
        "--ink": "#1b2130",
        "--dim": "#606a80",
        "--signal": "#b4661a",
        "--signal-ink": "#fff6e8",
        "--patch": "#1d7f96",
    },
    canvas: {
        NODE_DEFAULT_BGCOLOR: "#ffffff",
        NODE_DEFAULT_COLOR: "#e6e9ef",
        NODE_TITLE_COLOR: "#1b2130",
        NODE_SELECTED_TITLE_COLOR: "#b4661a",
        NODE_TEXT_COLOR: "#3d465c",
        NODE_BOX_OUTLINE_COLOR: "#b4661a",
        DEFAULT_SHADOW_COLOR: "rgba(27,33,48,0.18)",
        WIDGET_BGCOLOR: "#eef1f6",
        WIDGET_OUTLINE_COLOR: "#b9c1cf",
        WIDGET_TEXT_COLOR: "#1b2130",
        WIDGET_SECONDARY_TEXT_COLOR: "#606a80",
        LINK_COLOR: "#1d7f96",
        EVENT_LINK_COLOR: "#b4661a",
        CONNECTING_LINK_COLOR: "#d79a4f",
        CANVAS_BACKGROUND_COLOR: "#e2e6ec",
    },
};

const BLUEPRINT = {
    id: "blueprint",
    label: "Blueprint",
    blurb: "Drafting navy, chalk wires",
    scheme: "dark",
    chrome: {
        "--bg": "#081a2f",
        "--panel": "#0e2647",
        "--panel-2": "#123050",
        "--rail": "#1d4270",
        "--ink": "#dbe8ff",
        "--dim": "#7d9cc4",
        "--signal": "#ffd166",
        "--signal-ink": "#10233d",
        "--patch": "#9fd8ff",
    },
    canvas: {
        NODE_DEFAULT_BGCOLOR: "#123a68",
        NODE_DEFAULT_COLOR: "#0d2c50",
        NODE_TITLE_COLOR: "#dbe8ff",
        NODE_SELECTED_TITLE_COLOR: "#ffd166",
        NODE_TEXT_COLOR: "#b9d3f2",
        NODE_BOX_OUTLINE_COLOR: "#ffd166",
        DEFAULT_SHADOW_COLOR: "rgba(0,0,0,0.4)",
        WIDGET_BGCOLOR: "#0b2242",
        WIDGET_OUTLINE_COLOR: "#2f5c92",
        WIDGET_TEXT_COLOR: "#dbe8ff",
        WIDGET_SECONDARY_TEXT_COLOR: "#7d9cc4",
        LINK_COLOR: "#9fd8ff",
        EVENT_LINK_COLOR: "#ffd166",
        CONNECTING_LINK_COLOR: "#ffffff",
        CANVAS_BACKGROUND_COLOR: "#081a2f",
    },
};

const SOLARIZED = {
    id: "solarized",
    label: "Solarized",
    blurb: "Base03, yellow wires",
    scheme: "dark",
    chrome: {
        "--bg": "#002b36",
        "--panel": "#073642",
        "--panel-2": "#05303c",
        "--rail": "#0f4a5a",
        "--ink": "#eee8d5",
        "--dim": "#93a1a1",
        "--signal": "#b58900",
        "--signal-ink": "#002b36",
        "--patch": "#2aa198",
    },
    canvas: {
        NODE_DEFAULT_BGCOLOR: "#073642",
        NODE_DEFAULT_COLOR: "#002b36",
        NODE_TITLE_COLOR: "#93a1a1",
        NODE_SELECTED_TITLE_COLOR: "#b58900",
        NODE_TEXT_COLOR: "#eee8d5",
        NODE_BOX_OUTLINE_COLOR: "#b58900",
        DEFAULT_SHADOW_COLOR: "rgba(0,0,0,0.35)",
        WIDGET_BGCOLOR: "#002b36",
        WIDGET_OUTLINE_COLOR: "#0f4a5a",
        WIDGET_TEXT_COLOR: "#eee8d5",
        WIDGET_SECONDARY_TEXT_COLOR: "#93a1a1",
        LINK_COLOR: "#b58900",
        EVENT_LINK_COLOR: "#cb4b16",
        CONNECTING_LINK_COLOR: "#eee8d5",
        CANVAS_BACKGROUND_COLOR: "#002b36",
    },
};

export const THEMES = [BENCH, DAYLIGHT, BLUEPRINT, SOLARIZED];

export const DEFAULT_THEME_ID = BENCH.id;
export const DEFAULT_SPLIT_THEME_ID = DAYLIGHT.id;

export function getTheme(id) {
    return THEMES.find((t) => t.id === id) || BENCH;
}

/**
 * Patch-point colours, one per node category. Deliberately constant across themes:
 * they are a legend, so they have to mean the same thing in every skin.
 */
export const CATEGORY_COLORS = {
    demo: "#ff8f5e",
    basic: "#5ad1e6",
    math: "#a78bfa",
    math3d: "#8b7bf0",
    logic: "#f472b6",
    events: "#ffb03a",
    widget: "#34d399",
    graph: "#94a3b8",
    string: "#facc15",
    input: "#60a5fa",
};

export function categoryColor(category) {
    return CATEGORY_COLORS[category] || "#94a3b8";
}
