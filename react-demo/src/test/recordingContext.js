// A 2D context stand-in that remembers where a node drew.
//
// Node bodies do not clip: anything a node paints outside its own size spills
// over the canvas, which is how the gauge used to hang its scale off the bottom
// edge. Recording the extent of every primitive lets a test assert that a node
// stays inside itself at any size.

const ARC_SAMPLES = 24;

/** Pulls the pixel size out of a CSS font shorthand like "12px monospace". */
function fontSize(font) {
    const match = /(\d+(?:\.\d+)?)px/.exec(font || "");
    return match ? parseFloat(match[1]) : 10;
}

export function recordingContext() {
    const points = [];

    const record = (x, y, spread = 0) => {
        if (!isFinite(x) || !isFinite(y)) {
            throw new Error("drew at a non-finite coordinate: " + x + "," + y);
        }
        points.push([x - spread, y - spread], [x + spread, y + spread]);
    };

    const ctx = {
        font: "10px monospace",
        lineWidth: 1,
        lineCap: "butt",
        textAlign: "left",
        fillStyle: "#000",
        strokeStyle: "#000",
        globalAlpha: 1,

        beginPath() {},
        closePath() {},
        stroke() {},
        fill() {},
        save() {},
        restore() {},
        setTransform() {},
        translate() {},
        scale() {},
        clearRect() {},
        setLineDash() {},

        measureText(text) {
            // Roughly monospace at the current size, which is all the bounds
            // check needs.
            return { width: String(text).length * fontSize(ctx.font) * 0.6 };
        },

        moveTo(x, y) {
            record(x, y, ctx.lineWidth / 2);
        },
        lineTo(x, y) {
            record(x, y, ctx.lineWidth / 2);
        },
        rect(x, y, w, h) {
            record(x, y);
            record(x + w, y + h);
        },
        fillRect(x, y, w, h) {
            ctx.rect(x, y, w, h);
        },
        strokeRect(x, y, w, h) {
            ctx.rect(x, y, w, h);
        },
        arc(cx, cy, radius, from, to) {
            const spread = ctx.lineWidth / 2;
            for (let i = 0; i <= ARC_SAMPLES; i++) {
                const angle = from + ((to - from) * i) / ARC_SAMPLES;
                record(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, spread);
            }
        },
        fillText(text, x, y) {
            const size = fontSize(ctx.font);
            const width = ctx.measureText(text).width;
            const left = ctx.textAlign === "center" ? x - width / 2 : x;
            // Baseline sits at y: glyphs rise above it and descend a little below.
            record(left, y - size);
            record(left + width, y + size * 0.25);
        },
        strokeText(text, x, y) {
            ctx.fillText(text, x, y);
        },
    };

    ctx.getPoints = () => points;
    ctx.bounds = () => {
        if (!points.length) {
            return null;
        }
        return points.reduce(
            (box, [x, y]) => ({
                left: Math.min(box.left, x),
                top: Math.min(box.top, y),
                right: Math.max(box.right, x),
                bottom: Math.max(box.bottom, y),
            }),
            { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
        );
    };

    return ctx;
}
