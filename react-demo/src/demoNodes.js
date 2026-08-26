// Custom nodes written for the bench.
//
// These exist to show the three things you actually have to do when you add nodes
// to your own app: declare slots and properties, bind widgets to those properties,
// and draw inside the node body. The drawing ones read their colours from the
// canvas that is painting them (`graphcanvas.theme`), never from the LiteGraph
// globals - that is what keeps a node legible when the same graph is rendered
// twice in two different skins.

import { LiteGraph } from "../../src/litegraph.mjs";

const WAVEFORMS = ["sine", "square", "saw", "triangle"];

/** Colours for in-node drawing, taken from whichever canvas is painting. */
function palette(graphcanvas) {
    const theme = (graphcanvas && graphcanvas.theme) || LiteGraph;
    return {
        bg: theme.WIDGET_BGCOLOR || "#222",
        line: theme.WIDGET_OUTLINE_COLOR || "#666",
        text: theme.WIDGET_TEXT_COLOR || "#ddd",
        dim: theme.WIDGET_SECONDARY_TEXT_COLOR || "#999",
        signal: theme.LINK_COLOR || "#9a9",
        accent: theme.EVENT_LINK_COLOR || "#a86",
    };
}

/* ----------------------------------------------------------------- oscillator */

function Oscillator() {
    this.addInput("freq", "number");
    this.addOutput("signal", "number");
    this.properties = { waveform: "sine", frequency: 0.4, amplitude: 1 };
    this.addWidget("combo", "waveform", "sine", "waveform", { values: WAVEFORMS });
    this.addWidget("number", "frequency", 0.4, "frequency", { min: 0.02, max: 4, step: 0.2 });
    this.addWidget("number", "amplitude", 1, "amplitude", { min: 0, max: 2, step: 0.2 });
    this.size = [210, 106];
}

Oscillator.title = "Oscillator";
Oscillator.desc = "Free-running waveform generator";

Oscillator.prototype.onExecute = function () {
    const driven = this.getInputData(0);
    const freq = driven == null ? this.properties.frequency : driven;

    // A driven frequency is shown on the widget but not written to the property:
    // the wire wins for this frame, the dial keeps whatever you dialled in.
    if (driven != null && this.widgets) {
        this.widgets[1].value = Number(driven.toFixed(3));
    }

    const time = this.graph ? this.graph.globaltime : 0;
    const phase = ((time * freq) % 1 + 1) % 1;
    let value;
    switch (this.properties.waveform) {
        case "square":
            value = phase < 0.5 ? 1 : -1;
            break;
        case "saw":
            value = phase * 2 - 1;
            break;
        case "triangle":
            value = 4 * Math.abs(phase - 0.5) - 1;
            break;
        default:
            value = Math.sin(phase * Math.PI * 2);
    }

    this._last = value * this.properties.amplitude;
    this.setOutputData(0, this._last);
};

/* ---------------------------------------------------------------------- scope */

const SCOPE_SAMPLES = 256;

function Scope() {
    this.addInput("signal", "number");
    this.addOutput("signal", "number");
    this.properties = { range: 1 };
    this.addWidget("number", "range", 1, "range", { min: 0.1, max: 10, step: 0.5 });
    this.size = [240, 150];
    this._samples = new Float32Array(SCOPE_SAMPLES);
    this._head = 0;
    this._filled = 0;
}

Scope.title = "Scope";
Scope.desc = "Plots the last few seconds of a signal";

Scope.prototype.onExecute = function () {
    const value = this.getInputData(0);
    if (value == null || isNaN(value)) {
        return;
    }
    this._samples[this._head] = value;
    this._head = (this._head + 1) % SCOPE_SAMPLES;
    this._filled = Math.min(this._filled + 1, SCOPE_SAMPLES);
    this.setOutputData(0, value);
};

Scope.prototype.onDrawBackground = function (ctx, graphcanvas) {
    if (this.flags.collapsed) {
        return;
    }
    const colors = palette(graphcanvas);
    const w = this.size[0] - 16;
    const h = this.size[1] - 60;
    const x = 8;
    const y = 46;
    const range = this.properties.range || 1;

    ctx.fillStyle = colors.bg;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.5);
    ctx.lineTo(x + w, y + h * 0.5);
    ctx.stroke();

    if (this._filled < 2) {
        ctx.fillStyle = colors.dim;
        ctx.font = "10px monospace";
        ctx.fillText("no signal", x + 8, y + h * 0.5 - 4);
        return;
    }

    ctx.strokeStyle = colors.signal;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < this._filled; i++) {
        const index = (this._head - this._filled + i + SCOPE_SAMPLES * 2) % SCOPE_SAMPLES;
        const value = Math.max(-range, Math.min(range, this._samples[index]));
        const px = x + (i / (this._filled - 1)) * w;
        const py = y + h * 0.5 - (value / range) * (h * 0.5 - 2);
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.stroke();

    const latest = this._samples[(this._head - 1 + SCOPE_SAMPLES) % SCOPE_SAMPLES];
    ctx.fillStyle = colors.text;
    ctx.font = "10px monospace";
    ctx.fillText(latest.toFixed(3), x + 6, y + 12);
};

/* ---------------------------------------------------------------------- gauge */

function Gauge() {
    this.addInput("value", "number");
    this.properties = { min: -1, max: 1, label: "" };
    this.size = [170, 130];
    this._value = 0;
}

Gauge.title = "Gauge";
Gauge.desc = "Dial readout for a single number";

Gauge.prototype.onExecute = function () {
    const value = this.getInputData(0);
    if (value != null && !isNaN(value)) {
        this._value = value;
    }
};

Gauge.prototype.onDrawBackground = function (ctx, graphcanvas) {
    if (this.flags.collapsed) {
        return;
    }
    const colors = palette(graphcanvas);
    const cx = this.size[0] * 0.5;
    const cy = this.size[1] - 24;
    const radius = Math.min(this.size[0] * 0.38, this.size[1] * 0.55);
    const min = this.properties.min;
    const max = this.properties.max;
    const span = max - min || 1;
    const ratio = Math.max(0, Math.min(1, (this._value - min) / span));
    const start = Math.PI * 0.85;
    const end = Math.PI * 2.15;

    ctx.lineWidth = 6;
    ctx.strokeStyle = colors.line;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end);
    ctx.stroke();

    ctx.strokeStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + (end - start) * ratio);
    ctx.stroke();

    const angle = start + (end - start) * ratio;
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (radius - 6), cy + Math.sin(angle) * (radius - 6));
    ctx.stroke();

    ctx.fillStyle = colors.text;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(this._value.toFixed(2), cx, cy + 16);
    if (this.properties.label) {
        ctx.fillStyle = colors.dim;
        ctx.font = "9px monospace";
        ctx.fillText(this.properties.label.toUpperCase(), cx, cy + 28);
    }
    ctx.textAlign = "left";
};

/* --------------------------------------------------------------------- swatch */

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

function Swatch() {
    this.addInput("r", "number");
    this.addInput("g", "number");
    this.addInput("b", "number");
    this.addOutput("hex", "string");
    this.properties = { r: 0.9, g: 0.5, b: 0.2 };
    this.size = [160, 110];
    this._hex = "#000000";
}

Swatch.title = "Swatch";
Swatch.desc = "Mixes three channels into a colour";

Swatch.prototype.onExecute = function () {
    const channels = ["r", "g", "b"].map((key, index) => {
        const wired = this.getInputData(index);
        return clamp01(wired == null ? this.properties[key] : wired);
    });
    this._hex =
        "#" +
        channels
            .map((c) => Math.round(c * 255).toString(16).padStart(2, "0"))
            .join("");
    this.setOutputData(0, this._hex);
};

Swatch.prototype.onDrawBackground = function (ctx, graphcanvas) {
    if (this.flags.collapsed) {
        return;
    }
    const colors = palette(graphcanvas);
    const x = 8;
    const y = 62;
    const w = this.size[0] - 16;
    const h = this.size[1] - y - 8;
    ctx.fillStyle = this._hex;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = colors.text;
    ctx.font = "11px monospace";
    ctx.fillText(this._hex.toUpperCase(), x + 4, y - 4);
};

/* ------------------------------------------------------------------ metronome */

function Metronome() {
    this.addOutput("tick", LiteGraph.EVENT);
    this.addOutput("beat", "number");
    this.properties = { interval: 1 };
    this.addWidget("number", "interval", 1, "interval", { min: 0.1, max: 10, step: 0.5 });
    this.size = [180, 60];
    this._next = 0;
    this._beat = 0;
}

Metronome.title = "Metronome";
Metronome.desc = "Fires an event on a fixed interval";

Metronome.prototype.onStart = function () {
    this._next = 0;
    this._beat = 0;
};

Metronome.prototype.onExecute = function () {
    const time = this.graph ? this.graph.globaltime : 0;
    const interval = Math.max(0.05, this.properties.interval);
    if (time >= this._next) {
        this._next = time + interval;
        this._beat++;
        this.boxcolor = "#fff";
        this.triggerSlot(0, this._beat);
    } else if (this.boxcolor) {
        // Fade the indicator back down over the first tenth of the interval.
        const since = interval - (this._next - time);
        if (since > interval * 0.1) {
            this.boxcolor = null;
        }
    }
    this.setOutputData(1, this._beat);
};

/* ----------------------------------------------------------------------- note */

function Note() {
    this.properties = { text: "Double-click a wire to add a reroute point." };
    this.size = [240, 110];
}

Note.title = "Note";
Note.desc = "A comment pinned to the graph";

// No widget for the text: a LiteGraph text widget is a single clipped line, which
// is the wrong shape for a paragraph. The body below wraps it instead, and the
// inspector edits the property.

Note.prototype.onDrawBackground = function (ctx, graphcanvas) {
    if (this.flags.collapsed) {
        return;
    }
    const colors = palette(graphcanvas);
    const words = String(this.properties.text || "").split(/\s+/);
    const maxWidth = this.size[0] - 20;
    ctx.font = "12px sans-serif";
    ctx.fillStyle = colors.text;

    let line = "";
    let y = 24;
    for (const word of words) {
        const candidate = line ? line + " " + word : word;
        if (ctx.measureText(candidate).width > maxWidth && line) {
            ctx.fillText(line, 10, y);
            line = word;
            y += 16;
        } else {
            line = candidate;
        }
    }
    if (line) {
        ctx.fillText(line, 10, y);
    }
};

/* ------------------------------------------------------------------- registry */

export const DEMO_NODE_TYPES = [
    ["demo/oscillator", Oscillator],
    ["demo/scope", Scope],
    ["demo/gauge", Gauge],
    ["demo/swatch", Swatch],
    ["demo/metronome", Metronome],
    ["demo/note", Note],
];

/** Registers the bench nodes. Safe to call more than once. */
export function registerDemoNodes() {
    for (const [type, ctor] of DEMO_NODE_TYPES) {
        if (!LiteGraph.registered_node_types[type]) {
            LiteGraph.registerNodeType(type, ctor);
        }
    }
    return DEMO_NODE_TYPES.map(([type]) => type);
}

export { WAVEFORMS };
