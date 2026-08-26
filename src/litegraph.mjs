// ESM entry point for litegraph.js
//
// `src/litegraph.js` is a classic-script IIFE that publishes its classes onto the
// global object so that `<script>` tags and the concatenated `build/` bundles keep
// working. That file therefore cannot carry `export` statements itself.
//
// This module imports it for its side effects and then re-exports the classes as
// real, statically-analysable ESM named exports, so bundlers (Vite/Rollup/webpack)
// resolve `import { LGraph } from "litegraph.js"` at build time instead of silently
// falling back to `window.LiteGraph` at runtime.

import "./litegraph.js";

const _scope =
    typeof globalThis !== "undefined"
        ? globalThis
        : typeof window !== "undefined"
        ? window
        : typeof global !== "undefined"
        ? global
        : self;

if (!_scope.LiteGraph) {
    throw new Error(
        "litegraph.js failed to initialise: the core module did not publish LiteGraph onto the global scope."
    );
}

// The core attaches LGraph/LGraphNode/LGraphGroup/LGraphCanvas to both the global
// object and the LiteGraph namespace, but LLink/DragAndScale/ContextMenu only ever
// land on the namespace. Read the namespace first so every class resolves.
const _ns = _scope.LiteGraph;
const _pick = (name) => (_ns[name] !== undefined ? _ns[name] : _scope[name]);

export const LiteGraph = _ns;
export const LGraph = _pick("LGraph");
export const LLink = _pick("LLink");
export const LGraphNode = _pick("LGraphNode");
export const LGraphGroup = _pick("LGraphGroup");
export const DragAndScale = _pick("DragAndScale");
export const LGraphCanvas = _pick("LGraphCanvas");
export const ContextMenu = _pick("ContextMenu");

export default LiteGraph;
