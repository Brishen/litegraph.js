import { useEffect, useRef } from "react";

const SAMPLES = 160;

function prefersReducedMotion() {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

/**
 * The bench meter. It plots whatever number the selected node is putting out, so
 * the chrome around the canvas is showing real data from the patch rather than
 * decoration. Falls silent - literally a flat line - when nothing numeric is
 * selected.
 */
function Meter({ read, label }) {
    const canvasRef = useRef(null);
    const bufferRef = useRef(new Float32Array(SAMPLES));
    const headRef = useRef(0);
    const readRef = useRef(read);
    readRef.current = read;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return undefined;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return undefined;
        }

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth || 180;
        const height = canvas.clientHeight || 26;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        const styles = getComputedStyle(canvas);
        const trace = styles.getPropertyValue("--signal").trim() || "#ffb03a";
        const rule = styles.getPropertyValue("--rail").trim() || "#333";

        let frame = 0;
        let timer = 0;
        let alive = true;

        const sample = () => {
            const value = readRef.current();
            const buffer = bufferRef.current;
            buffer[headRef.current] = typeof value === "number" && isFinite(value) ? value : 0;
            headRef.current = (headRef.current + 1) % SAMPLES;

            let peak = 0.001;
            for (let i = 0; i < SAMPLES; i++) {
                peak = Math.max(peak, Math.abs(buffer[i]));
            }

            ctx.clearRect(0, 0, width, height);
            ctx.strokeStyle = rule;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();

            ctx.strokeStyle = trace;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < SAMPLES; i++) {
                const index = (headRef.current + i) % SAMPLES;
                const x = (i / (SAMPLES - 1)) * width;
                const y = height / 2 - (buffer[index] / peak) * (height / 2 - 2);
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        };

        if (prefersReducedMotion()) {
            timer = window.setInterval(sample, 500);
            sample();
            return () => window.clearInterval(timer);
        }

        const loop = () => {
            if (!alive) {
                return;
            }
            sample();
            frame = window.requestAnimationFrame(loop);
        };
        loop();

        return () => {
            alive = false;
            window.cancelAnimationFrame(frame);
        };
    }, []);

    return (
        <div className="meter">
            <canvas ref={canvasRef} className="meter__canvas" aria-hidden="true" />
            <span className="meter__label">{label}</span>
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <span className="stat">
            <span className="stat__value">{value}</span>
            <span className="stat__label">{label}</span>
        </span>
    );
}

export default function SignalRail({ stats, meterLabel, readSignal, flash }) {
    return (
        <footer className="signal-rail">
            <span className={"run-state" + (stats.running ? " run-state--live" : "")}>
                <span className="run-state__dot" />
                {stats.running ? "running" : "paused"}
            </span>

            <Meter read={readSignal} label={meterLabel} />

            {/* Keyboard edits change the graph with nothing under the cursor to
                show for it, so the last one is announced here. */}
            <span className="flash" role="status" aria-live="polite">
                {flash || ""}
            </span>

            <div className="stats">
                <Stat label="nodes" value={stats.nodes} />
                <Stat label="links" value={stats.links} />
                <Stat label="steps" value={stats.iteration} />
                <Stat label="fps" value={Math.round(stats.fps)} />
                <Stat label="uptime" value={stats.elapsed.toFixed(1) + "s"} />
            </div>
        </footer>
    );
}
