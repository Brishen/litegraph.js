import React, { useRef, useEffect, useMemo, useContext, createContext } from "react";
import { LGraph, LGraphCanvas } from "./litegraph.mjs";

/**
 * Supplies a default theme to every <LiteGraphCanvas> below it. A canvas's own
 * `theme` prop is merged over whatever the provider supplies.
 */
const LiteGraphThemeContext = createContext(null);

export function LiteGraphThemeProvider(props) {
    return React.createElement(
        LiteGraphThemeContext.Provider,
        { value: props.theme || null },
        props.children
    );
}

export function useLiteGraphTheme() {
    return useContext(LiteGraphThemeContext);
}

export function LiteGraphCanvas(props) {
    const canvasRef = useRef(null);
    const instanceRef = useRef(null);
    const onLoadRef = useRef(props.onLoad);

    const inheritedTheme = useContext(LiteGraphThemeContext);

    // Merge provider theme with the instance theme. Keyed on content rather than
    // identity so an inline object literal does not re-apply on every render.
    const theme = useMemo(
        () => ({ ...(inheritedTheme || {}), ...(props.theme || {}) }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(inheritedTheme || {}), JSON.stringify(props.theme || {})]
    );

    // Read the first theme through a ref so mounting does not depend on `theme`,
    // which would tear down and rebuild the graph whenever the theme changed.
    const initialThemeRef = useRef(theme);

    useEffect(() => {
        onLoadRef.current = props.onLoad;
    }, [props.onLoad]);

    useEffect(() => {
        if (!canvasRef.current) return;

        const graph = new LGraph();
        const canvas = new LGraphCanvas(canvasRef.current, graph, {
            theme: initialThemeRef.current
        });
        instanceRef.current = canvas;

        if (onLoadRef.current) {
            onLoadRef.current(graph, canvas);
        }

        graph.start();

        const resize = () => {
            canvas.resize();
        };

        window.addEventListener("resize", resize);

        return () => {
            window.removeEventListener("resize", resize);
            graph.stop();
            if (canvas.unbindEvents) {
                canvas.unbindEvents();
            }
            instanceRef.current = null;
        };
    }, []);

    // Re-apply on change, without recreating the canvas. resetTheme() first so a key
    // removed from the prop falls back to the global instead of lingering.
    useEffect(() => {
        const canvas = instanceRef.current;
        if (!canvas) return;
        canvas.resetTheme();
        canvas.setTheme(theme);
    }, [theme]);

    return React.createElement("canvas", {
        ref: canvasRef,
        width: props.width || 1024,
        height: props.height || 720,
        style: props.style || { width: "100%", height: "100%" },
        ...props.canvasProps
    });
}

export default LiteGraphCanvas;
