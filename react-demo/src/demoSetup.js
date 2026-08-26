// One place to decide which node packs the bench ships with.
//
// Node packs are side-effect modules: importing one registers its types onto the
// LiteGraph registry. Only the packs that run without extra dependencies are
// included - the GL and audio packs need litegl.js / WebGL and would fail to load.

import { LiteGraph } from "../../src/litegraph.mjs";
import "../../src/nodes/base.js";
import "../../src/nodes/math.js";
import "../../src/nodes/logic.js";
import "../../src/nodes/events.js";
import "../../src/nodes/interface.js";
import "../../src/nodes/strings.js";
import { registerDemoNodes } from "./demoNodes.js";

registerDemoNodes();

/** Node types the palette hides: they need a host app the bench does not provide. */
const HIDDEN_TYPES = new Set(["graph/subgraph", "graph/input", "graph/output", "basic/script"]);

/**
 * Every registered type, grouped by category and sorted for display.
 * Reads the live registry, so anything you register yourself shows up too.
 */
export function listNodeTypes() {
    const byCategory = new Map();

    for (const type of Object.keys(LiteGraph.registered_node_types)) {
        if (HIDDEN_TYPES.has(type)) {
            continue;
        }
        const ctor = LiteGraph.registered_node_types[type];
        const slash = type.lastIndexOf("/");
        const category = slash === -1 ? "misc" : type.slice(0, slash);
        const name = slash === -1 ? type : type.slice(slash + 1);
        if (!byCategory.has(category)) {
            byCategory.set(category, []);
        }
        byCategory.get(category).push({
            type,
            name,
            category,
            title: ctor.title || name,
            desc: ctor.desc || "",
        });
    }

    return [...byCategory.entries()]
        .map(([category, nodes]) => ({
            category,
            nodes: nodes.sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => a.category.localeCompare(b.category));
}


/** Filters the grouped list by a free-text query over type, title and description. */
export function filterNodeTypes(groups, query) {
    const needle = query.trim().toLowerCase();
    if (!needle) {
        return groups;
    }
    return groups
        .map((group) => ({
            category: group.category,
            nodes: group.nodes.filter((node) =>
                (node.type + " " + node.title + " " + node.desc).toLowerCase().includes(needle)
            ),
        }))
        .filter((group) => group.nodes.length > 0);
}
