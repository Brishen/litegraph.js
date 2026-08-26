import { LiteGraph } from "../../../src/litegraph.mjs";
import { readOutputValue } from "../graphTools.js";

const MODES = ["Always", "On Event", "Never", "On Trigger"];

function formatValue(value) {
    if (value === undefined || value === null) {
        return "—";
    }
    if (typeof value === "number") {
        return Number.isInteger(value) ? String(value) : value.toFixed(3);
    }
    if (typeof value === "string") {
        return value.length > 24 ? value.slice(0, 24) + "…" : value;
    }
    if (typeof value === "boolean") {
        return value ? "true" : "false";
    }
    try {
        return JSON.stringify(value).slice(0, 32);
    } catch (err) {
        return String(value);
    }
}

function slotTypeName(type) {
    if (type === LiteGraph.EVENT || type === LiteGraph.ACTION || type === -1) {
        return "event";
    }
    return type === 0 || type === undefined || type === "" ? "any" : String(type);
}

function PropertyRow({ node, name, value, onChange }) {
    const widget = (node.widgets || []).find(
        (candidate) => candidate.options && candidate.options.property === name
    );
    const commit = (next) => {
        node.setProperty(name, next);
        onChange();
    };

    let control;
    if (widget && widget.type === "combo" && widget.options.values) {
        const values = Array.isArray(widget.options.values)
            ? widget.options.values
            : Object.keys(widget.options.values);
        control = (
            <select value={String(value)} onChange={(event) => commit(event.target.value)}>
                {values.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        );
    } else if (typeof value === "boolean") {
        control = (
            <input
                type="checkbox"
                checked={value}
                onChange={(event) => commit(event.target.checked)}
            />
        );
    } else if (typeof value === "number") {
        control = (
            <input
                type="number"
                step="any"
                value={value}
                onChange={(event) => {
                    const next = parseFloat(event.target.value);
                    commit(Number.isNaN(next) ? 0 : next);
                }}
            />
        );
    } else if (typeof value === "string") {
        control = (
            <input type="text" value={value} onChange={(event) => commit(event.target.value)} />
        );
    } else {
        control = <code className="readonly">{formatValue(value)}</code>;
    }

    return (
        <label className="prop">
            <span className="prop__name">{name}</span>
            <span className="prop__control">{control}</span>
        </label>
    );
}

/**
 * Everything about the selected node: what it is, what you can change, and what is
 * flowing through it right now. Re-rendered on a timer by App so the live column
 * keeps up with the graph without a re-render per frame.
 */
export default function Inspector({ node, onChange, onRemove, onCenter }) {
    if (!node) {
        return (
            <aside className="rail rail--right" aria-label="Inspector">
                <header className="rail__head">
                    <h2 className="eyebrow">Inspect</h2>
                </header>
                <p className="empty">
                    Select a node to read its properties and watch its values change.
                </p>
            </aside>
        );
    }

    const properties = node.properties ? Object.keys(node.properties) : [];

    return (
        <aside className="rail rail--right" aria-label="Inspector">
            <header className="rail__head">
                <h2 className="eyebrow">Inspect</h2>
                <span className="rail__count">#{node.id}</span>
            </header>

            <div className="rail__body">
                <div className="inspect-title">
                    <input
                        type="text"
                        aria-label="Node title"
                        value={node.title}
                        onChange={(event) => {
                            node.title = event.target.value;
                            onChange();
                        }}
                    />
                    <code>{node.type}</code>
                </div>

                <section className="inspect-section">
                    <h3 className="eyebrow eyebrow--sub">Mode</h3>
                    <select
                        aria-label="Execution mode"
                        value={node.mode || 0}
                        onChange={(event) => {
                            node.mode = Number(event.target.value);
                            onChange();
                        }}
                    >
                        {MODES.map((label, index) => (
                            <option key={label} value={index}>
                                {label}
                            </option>
                        ))}
                    </select>
                </section>

                {properties.length > 0 ? (
                    <section className="inspect-section">
                        <h3 className="eyebrow eyebrow--sub">Properties</h3>
                        {properties.map((name) => (
                            <PropertyRow
                                key={name}
                                node={node}
                                name={name}
                                value={node.properties[name]}
                                onChange={onChange}
                            />
                        ))}
                    </section>
                ) : null}

                <section className="inspect-section">
                    <h3 className="eyebrow eyebrow--sub">Live values</h3>
                    <table className="io">
                        <tbody>
                            {(node.inputs || []).map((input, index) => (
                                <tr key={"in" + index}>
                                    <td className="io__dir io__dir--in">in</td>
                                    <td className="io__name">
                                        {input.name || index}
                                        <em>{slotTypeName(input.type)}</em>
                                    </td>
                                    <td className="io__value">
                                        {input.link == null
                                            ? "—"
                                            : formatValue(node.getInputData(index))}
                                    </td>
                                </tr>
                            ))}
                            {(node.outputs || []).map((output, index) => (
                                <tr key={"out" + index}>
                                    <td className="io__dir io__dir--out">out</td>
                                    <td className="io__name">
                                        {output.name || index}
                                        <em>{slotTypeName(output.type)}</em>
                                    </td>
                                    <td className="io__value">
                                        {formatValue(readOutputValue(node, index))}
                                    </td>
                                </tr>
                            ))}
                            {!node.inputs?.length && !node.outputs?.length ? (
                                <tr>
                                    <td colSpan={3} className="io__value">
                                        This node has no slots.
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </section>
            </div>

            <footer className="rail__foot rail__foot--actions">
                <button type="button" onClick={onCenter}>
                    Center
                </button>
                <button type="button" className="danger" onClick={onRemove}>
                    Remove
                </button>
            </footer>
        </aside>
    );
}
