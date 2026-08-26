import * as React from "react";
import { LGraph, LGraphCanvas } from "./litegraph";

export interface LiteGraphCanvasProps {
    /** Called once, after the graph and canvas are constructed and before `graph.start()`. */
    onLoad?: (graph: LGraph, canvas: LGraphCanvas) => void;
    /** Canvas backing-store width in pixels. Defaults to 1024. */
    width?: number;
    /** Canvas backing-store height in pixels. Defaults to 720. */
    height?: number;
    /** Inline style for the canvas element. Defaults to `{ width: "100%", height: "100%" }`. */
    style?: React.CSSProperties;
    /** Extra props spread onto the underlying `<canvas>` element. */
    canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
}

export declare function LiteGraphCanvas(
    props: LiteGraphCanvasProps
): React.ReactElement;

export default LiteGraphCanvas;
