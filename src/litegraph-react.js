import React, { useRef, useEffect } from "react";
import { LiteGraph, LGraph, LGraphCanvas } from "./litegraph.js";

export function LiteGraphCanvas(props) {
    const canvasRef = useRef(null);
    const onLoadRef = useRef(props.onLoad);

    useEffect(() => {
        onLoadRef.current = props.onLoad;
    }, [props.onLoad]);

    useEffect(() => {
        if (!canvasRef.current) return;

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
            // LGraphCanvas binds events to the canvas element on creation.
            // We must unbind them to prevent leaks if the component re-mounts.
            if(canvas.unbindEvents) {
                canvas.unbindEvents();
            }
        };
    }, []); // Run only once on mount

    return React.createElement("canvas", {
        ref: canvasRef,
        width: props.width || 1024,
        height: props.height || 720,
        style: props.style || { width: "100%", height: "100%" },
        ...props.canvasProps
    });
}
