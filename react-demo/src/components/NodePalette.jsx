import { useMemo, useState } from "react";
import { filterNodeTypes, listNodeTypes } from "../demoSetup.js";
import { categoryColor } from "../themes.js";

/**
 * The patch-point list: every registered node type, searchable, click to drop one
 * in the middle of the view or drag it exactly where you want it.
 */
export default function NodePalette({ onAdd }) {
    const [query, setQuery] = useState("");
    const groups = useMemo(() => listNodeTypes(), []);
    const visible = useMemo(() => filterNodeTypes(groups, query), [groups, query]);
    const total = useMemo(
        () => visible.reduce((sum, group) => sum + group.nodes.length, 0),
        [visible]
    );

    return (
        <aside className="rail rail--left" aria-label="Node palette">
            <header className="rail__head">
                <h2 className="eyebrow">Patch points</h2>
                <span className="rail__count">{total}</span>
            </header>

            <input
                className="search"
                type="search"
                value={query}
                placeholder="Filter nodes"
                aria-label="Filter nodes"
                onChange={(event) => setQuery(event.target.value)}
            />

            <div className="rail__body">
                {visible.length === 0 ? (
                    <p className="empty">
                        Nothing matches “{query}”. Try a category like <code>math</code>.
                    </p>
                ) : (
                    visible.map((group) => (
                        <section key={group.category} className="palette-group">
                            <h3 className="palette-group__title">
                                <span
                                    className="dot"
                                    style={{ background: categoryColor(group.category) }}
                                />
                                {group.category}
                            </h3>
                            <ul>
                                {group.nodes.map((node) => (
                                    <li key={node.type}>
                                        <button
                                            type="button"
                                            className="palette-item"
                                            title={node.desc || node.type}
                                            draggable
                                            onDragStart={(event) => {
                                                event.dataTransfer.setData(
                                                    "application/x-litegraph-node",
                                                    node.type
                                                );
                                                event.dataTransfer.effectAllowed = "copy";
                                            }}
                                            onClick={() => onAdd(node.type)}
                                        >
                                            <span className="palette-item__name">{node.name}</span>
                                            <span className="palette-item__title">{node.title}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))
                )}
            </div>

            <footer className="rail__foot">Click to place, or drag onto the canvas.</footer>
        </aside>
    );
}
