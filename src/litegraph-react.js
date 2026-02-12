import React, { useRef, useEffect } from "react";
import * as LiteGraphModule from "./litegraph.js";

// Attempt to get LiteGraph from module exports or global scope
const LiteGraph = LiteGraphModule.LiteGraph || (typeof window !== 'undefined' ? window.LiteGraph : null);
const LGraph = LiteGraphModule.LGraph || (LiteGraph ? LiteGraph.LGraph : null);
const LGraphCanvas = LiteGraphModule.LGraphCanvas || (LiteGraph ? LiteGraph.LGraphCanvas : null);

export function LiteGraphCanvas(props) {
    const canvasRef = useRef(null);
    const onLoadRef = useRef(props.onLoad);

    useEffect(() => {
        onLoadRef.current = props.onLoad;
    }, [props.onLoad]);

    useEffect(() => {
        if (!canvasRef.current) return;
        if (!LGraph || !LGraphCanvas) {
            console.error("LiteGraph not loaded");
            return;
        }

        const graph = new LGraph();
        const canvas = new LGraphCanvas(canvasRef.current, graph);

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
            if(canvas.unbindEvents) {
                canvas.unbindEvents();
            }
            if(canvas.stopRendering) {
                canvas.stopRendering();
            }
        };
    }, []);

    return React.createElement("canvas", {
        ref: canvasRef,
        width: props.width || 1024,
        height: props.height || 720,
        style: props.style || { width: "100%", height: "100%" },
        ...props.canvasProps
    });
}
