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
        // The node's own body colour, for painting over something already drawn.
        body: theme.NODE_DEFAULT_BGCOLOR || "#353535",
        bg: theme.WIDGET_BGCOLOR || "#222",
        line: theme.WIDGET_OUTLINE_COLOR || "#666",
        text: theme.WIDGET_TEXT_COLOR || "#ddd",
        dim: theme.WIDGET_SECONDARY_TEXT_COLOR || "#999",
        signal: theme.LINK_COLOR || "#9a9",
        accent: theme.EVENT_LINK_COLOR || "#a86",
    };
}

/**
 * Where a node body is free to draw: below its slot rows. Anything painted above
 * this lands on top of a slot's dot and name, which is what the swatch used to do
 * with its hex readout.
 */
function contentTop() {
    const rows = Math.max(
        this.inputs ? this.inputs.length : 0,
        this.outputs ? this.outputs.length : 0
    );
    return rows * LiteGraph.NODE_SLOT_HEIGHT + 8;
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
    if (w < 16 || h < 12) {
        // Squeezed below the slot and widget rows: a plot here would draw
        // upwards, outside the node.
        return;
    }
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

// The dial is an arc open at the bottom: it starts below the horizontal on the
// left, sweeps over the top, and ends the same distance below on the right.
const GAUGE_START = Math.PI * 0.85;
const GAUGE_END = Math.PI * 2.15;
// How far past the centre the open ends reach, as a fraction of the radius. The
// arc is therefore (1 + FOOT) radii tall, not 2 - the layout below needs this to
// size a dial that actually fits inside the node.
const GAUGE_FOOT = Math.sin(GAUGE_START);
// Plus a little more for the readout tucked into the opening.
const GAUGE_HEIGHT = 1 + GAUGE_FOOT + 0.14;
const GAUGE_PAD = 10;
const GAUGE_TRACK_MAX = 8;

function Gauge() {
    this.addInput("value", "number");
    this.properties = { min: -1, max: 1, label: "" };
    this.size = [180, 150];
    this._value = 0;
}

Gauge.title = "Gauge";
Gauge.desc = "Dial readout for a single number";

Gauge.prototype.contentTop = contentTop;

/**
 * Dial geometry for the node's current size. Kept separate from the drawing so a
 * test can check that nothing lands outside the node at any size.
 */
Gauge.prototype.layout = function () {
    const top = this.contentTop();
    const availableWidth = this.size[0] - GAUGE_PAD * 2;
    const availableHeight = this.size[1] - top - GAUGE_PAD;
    // The stroked track straddles the radius, so leave room for its outer half.
    const outer = Math.max(0, Math.min(availableWidth / 2, availableHeight / GAUGE_HEIGHT));
    const radius = Math.max(0, outer - GAUGE_TRACK_MAX / 2);
    return {
        top,
        radius,
        cx: this.size[0] / 2,
        cy: top + outer,
        // Too small to be a dial: draw a bare readout instead.
        tiny: radius < 24,
    };
};

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
    const { cx, cy, radius, top, tiny } = this.layout();
    const min = this.properties.min;
    const max = this.properties.max;
    const span = max - min || 1;
    const ratio = Math.max(0, Math.min(1, (this._value - min) / span));
    const angle = GAUGE_START + (GAUGE_END - GAUGE_START) * ratio;
    const reading = this._value.toFixed(2);

    ctx.textAlign = "center";

    if (tiny) {
        // Not enough room for a dial once the node is squeezed; keep the number,
        // shrunk to whatever is left, and drop even that if there is no room.
        const available = this.size[1] - top - 4;
        if (available >= 9) {
            const size = Math.max(7, Math.min(13, available * 0.75));
            ctx.fillStyle = colors.text;
            ctx.font = Math.round(size) + "px monospace";
            ctx.fillText(reading, this.size[0] / 2, top + available / 2 + size * 0.35);
        }
        ctx.textAlign = "left";
        return;
    }

    const track = Math.max(4, Math.min(GAUGE_TRACK_MAX, radius * 0.14));
    ctx.lineWidth = track;
    ctx.lineCap = "round";

    ctx.strokeStyle = colors.line;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, GAUGE_START, GAUGE_END);
    ctx.stroke();

    if (ratio > 0) {
        ctx.strokeStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, GAUGE_START, angle);
        ctx.stroke();
    }
    ctx.lineCap = "butt";

    // Needle, from the edge of its hub so the pivot stays readable.
    const hub = Math.max(2.5, radius * 0.07);
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = Math.max(1.5, radius * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * hub, cy + Math.sin(angle) * hub);
    ctx.lineTo(
        cx + Math.cos(angle) * (radius - track),
        cy + Math.sin(angle) * (radius - track)
    );
    ctx.stroke();

    ctx.fillStyle = colors.text;
    ctx.beginPath();
    ctx.arc(cx, cy, hub, 0, Math.PI * 2);
    ctx.fill();

    // The ends of the scale, so the reading has something to mean. Below this
    // radius they crowd the reading, and a cramped dial is worse than a bare one.
    if (radius >= 52) {
        // Just past each end of the arc: on the arc's own rays they would sit
        // directly under the needle whenever the value is at that end.
        const tick = radius * 0.94;
        const spread = 0.14;
        ctx.fillStyle = colors.dim;
        ctx.font = Math.round(Math.max(8, radius * 0.15)) + "px monospace";
        ctx.fillText(
            String(min),
            cx + Math.cos(GAUGE_START - spread) * tick,
            cy + Math.sin(GAUGE_START - spread) * tick
        );
        ctx.fillText(
            String(max),
            cx + Math.cos(GAUGE_END + spread) * tick,
            cy + Math.sin(GAUGE_END + spread) * tick
        );
    }

    // Near either end of the scale the needle sweeps down through the readout, so
    // the number sits on a chip of the node's own colour and stays legible.
    const readingSize = Math.round(Math.max(10, Math.min(15, radius * 0.26)));
    const readingY = cy + radius * 0.34;
    ctx.font = readingSize + "px monospace";
    const readingWidth = ctx.measureText(reading).width;
    ctx.fillStyle = colors.body;
    ctx.fillRect(
        cx - readingWidth / 2 - 4,
        readingY - readingSize,
        readingWidth + 8,
        readingSize + 5
    );

    ctx.fillStyle = colors.text;
    ctx.fillText(reading, cx, readingY);

    if (this.properties.label) {
        ctx.fillStyle = colors.dim;
        ctx.font = Math.round(Math.max(8, radius * 0.16)) + "px monospace";
        ctx.fillText(this.properties.label.toUpperCase(), cx, cy + radius * 0.56);
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
    this.size = [170, 130];
    this._hex = "#000000";
    this._channels = [0, 0, 0];
}

Swatch.title = "Swatch";
Swatch.desc = "Mixes three channels into a colour";

Swatch.prototype.contentTop = contentTop;

/** Black or white, whichever will read against the mixed colour. */
Swatch.prototype.inkColor = function () {
    const [r, g, b] = this._channels;
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? "#101010" : "#f4f4f4";
};

Swatch.prototype.onExecute = function () {
    const channels = ["r", "g", "b"].map((key, index) => {
        const wired = this.getInputData(index);
        return clamp01(wired == null ? this.properties[key] : wired);
    });
    this._channels = channels;
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
    // Below the three input rows: the hex used to be written above the chip,
    // straight through the "b" slot's label.
    const y = this.contentTop();
    const w = this.size[0] - 16;
    const h = this.size[1] - y - 8;
    if (w < 12 || h < 6) {
        return;
    }

    ctx.fillStyle = this._hex;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // The reading goes inside the chip, in whichever ink survives the colour.
    if (h >= 18 && w >= 60) {
        ctx.fillStyle = this.inkColor();
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(this._hex.toUpperCase(), x + w / 2, y + h / 2 + 4);
        ctx.textAlign = "left";
    }
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
    const lineHeight = 16;
    // Stop before the text walks off the bottom of the node; a note is resizable
    // and its text is user-supplied, so it will not always fit.
    const lastBaseline = this.size[1] - 6;
    ctx.font = "12px sans-serif";
    ctx.fillStyle = colors.text;

    const lines = [];
    let line = "";
    for (const word of words) {
        const candidate = line ? line + " " + word : word;
        if (ctx.measureText(candidate).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) {
        lines.push(line);
    }

    let y = 24;
    for (let i = 0; i < lines.length; i++) {
        if (y > lastBaseline) {
            return;
        }
        const isLastThatFits = y + lineHeight > lastBaseline && i < lines.length - 1;
        ctx.fillText(isLastThatFits ? lines[i] + " …" : lines[i], 10, y);
        y += lineHeight;
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
