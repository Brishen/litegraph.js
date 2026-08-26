import * as React from "react";
import { LGraph, LGraphCanvas } from "./litegraph";

/**
 * Per-canvas appearance overrides. Every key is optional; an omitted key falls back
 * to the matching `LiteGraph.*` global, so existing global theming keeps working.
 *
 * Layout constants (NODE_TITLE_HEIGHT, NODE_SLOT_HEIGHT, ...) are intentionally not
 * themeable: they feed node geometry shared by every canvas rendering that graph.
 */
export interface LiteGraphTheme {
    NODE_TITLE_COLOR?: string;
    NODE_SELECTED_TITLE_COLOR?: string;
    NODE_TEXT_COLOR?: string;
    NODE_DEFAULT_COLOR?: string;
    NODE_DEFAULT_BGCOLOR?: string;
    NODE_DEFAULT_BOXCOLOR?: string;
    NODE_BOX_OUTLINE_COLOR?: string;
    DEFAULT_SHADOW_COLOR?: string;
    WIDGET_BGCOLOR?: string;
    WIDGET_OUTLINE_COLOR?: string;
    WIDGET_TEXT_COLOR?: string;
    WIDGET_SECONDARY_TEXT_COLOR?: string;
    LINK_COLOR?: string;
    EVENT_LINK_COLOR?: string;
    CONNECTING_LINK_COLOR?: string;
    CANVAS_BACKGROUND_COLOR?: string;
    NODE_TEXT_SIZE?: number;
    NODE_SUBTEXT_SIZE?: number;
    DEFAULT_GROUP_FONT?: number;
}

export interface LiteGraphCanvasProps {
    /** Called once, after the graph and canvas are constructed and before `graph.start()`. */
    onLoad?: (graph: LGraph, canvas: LGraphCanvas) => void;
    /** Appearance overrides for this canvas only, merged over any provider theme. */
    theme?: LiteGraphTheme;
    /** Canvas backing-store width in pixels. Defaults to 1024. */
    width?: number;
    /** Canvas backing-store height in pixels. Defaults to 720. */
    height?: number;
    /** Inline style for the canvas element. Defaults to `{ width: "100%", height: "100%" }`. */
    style?: React.CSSProperties;
    /** Extra props spread onto the underlying `<canvas>` element. */
    canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
}

export interface LiteGraphThemeProviderProps {
    theme?: LiteGraphTheme;
    children?: React.ReactNode;
}

/** Supplies a default theme to every LiteGraphCanvas rendered beneath it. */
export declare function LiteGraphThemeProvider(
    props: LiteGraphThemeProviderProps
): React.ReactElement;

/** Returns the theme supplied by the nearest LiteGraphThemeProvider, or null. */
export declare function useLiteGraphTheme(): LiteGraphTheme | null;

export declare function LiteGraphCanvas(
    props: LiteGraphCanvasProps
): React.ReactElement;

export default LiteGraphCanvas;
