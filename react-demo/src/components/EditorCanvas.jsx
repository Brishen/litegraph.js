import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { LiteGraphCanvas } from "../../../src/litegraph-react.mjs";
import { toGraphPos } from "../graphTools.js";

/**
 * Hosts one <LiteGraphCanvas> and keeps it the size of its container.
 *
 * The width/height props are frozen at mount on purpose. LiteGraph keeps a second
 * offscreen canvas for the background layer, and only `canvas.resize()` resizes
 * both - letting React rewrite the width attribute on its own would leave the
 * background at the old size and break hit-testing, which reads CSS pixels.
 */
export default function EditorCanvas({ theme, label, onReady, onDropType }) {
    const wrapperRef = useRef(null);
    const instanceRef = useRef(null);
    const [size, setSize] = useState(null);

    useLayoutEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) {
            return undefined;
        }

        const measure = () => ({
            width: Math.max(1, wrapper.clientWidth),
            height: Math.max(1, wrapper.clientHeight),
        });

        setSize(measure());

        const apply = () => {
            const next = measure();
            if (instanceRef.current) {
                instanceRef.current.resize(next.width, next.height);
                // resize() only marks the canvas dirty; paint now so a drag of the
                // window edge does not leave a band of unpainted background.
                instanceRef.current.draw(true, true);
            } else {
                // Still pre-mount: fold the measurement into the size the canvas
                // will be created with. Same value in means no extra render.
                setSize((prev) =>
                    prev && prev.width === next.width && prev.height === next.height
                        ? prev
                        : next
                );
            }
        };

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(apply);
            observer.observe(wrapper);
            return () => observer.disconnect();
        }

        window.addEventListener("resize", apply);
        return () => window.removeEventListener("resize", apply);
    }, []);

    const handleLoad = useCallback(
        (graph, canvas) => {
            instanceRef.current = canvas;
            // The size handed to the element was measured before the canvas
            // existed, and the observer's first callback fires while this ref is
            // still null. Re-sync against the container now that both are here,
            // or the background layer keeps the stale size and paints short.
            const wrapper = wrapperRef.current;
            if (wrapper) {
                canvas.resize(
                    Math.max(1, wrapper.clientWidth),
                    Math.max(1, wrapper.clientHeight)
                );
            }
            if (onReady) {
                onReady(graph, canvas);
            }
        },
        [onReady]
    );

    const handleDragOver = useCallback(
        (event) => {
            if (!onDropType) {
                return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        },
        [onDropType]
    );

    // Capture phase: LiteGraph binds its own drop handler on the canvas for files,
    // and this needs to run first so a palette drag never reaches it.
    const handleDrop = useCallback(
        (event) => {
            const type = event.dataTransfer.getData("application/x-litegraph-node");
            if (!type || !onDropType || !instanceRef.current) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            onDropType(type, toGraphPos(instanceRef.current, event.clientX, event.clientY));
        },
        [onDropType]
    );

    return (
        <div
            className="canvas-pane"
            ref={wrapperRef}
            onDragOver={handleDragOver}
            onDropCapture={handleDrop}
        >
            {label ? <span className="canvas-pane__label">{label}</span> : null}
            {size ? (
                <LiteGraphCanvas
                    onLoad={handleLoad}
                    theme={theme}
                    width={size.width}
                    height={size.height}
                    style={{ width: "100%", height: "100%", display: "block" }}
                />
            ) : null}
        </div>
    );
}
