import { useCallback, useEffect, useRef, useState } from "react";
import {
    clearSavedPatch,
    downloadGraph,
    importGraph,
    loadSavedPatch,
    savePatch,
    serializeGraph,
} from "../graphTools.js";

/**
 * The serialisation drawer. A graph is just JSON: this shows the exact object
 * `graph.serialize()` returns, and takes it back in.
 */
export default function JsonPanel({ graph, onApplied, onClose }) {
    const [text, setText] = useState("");
    const [status, setStatus] = useState(null);
    const fileRef = useRef(null);

    const refresh = useCallback(() => {
        if (!graph) {
            return;
        }
        setText(serializeGraph(graph));
        setStatus(null);
    }, [graph]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const apply = () => {
        const result = importGraph(graph, text);
        if (result.ok) {
            setStatus({ tone: "ok", message: "Graph loaded." });
            onApplied();
        } else {
            setStatus({ tone: "error", message: result.error });
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setStatus({ tone: "ok", message: "JSON copied to the clipboard." });
        } catch (err) {
            setStatus({
                tone: "error",
                message: "The browser blocked clipboard access. Select the text and copy it.",
            });
        }
    };

    const readFile = (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setText(String(reader.result));
            const result = importGraph(graph, String(reader.result));
            if (result.ok) {
                setStatus({ tone: "ok", message: "Loaded " + file.name + "." });
                onApplied();
            } else {
                setStatus({ tone: "error", message: result.error });
            }
        };
        reader.readAsText(file);
        event.target.value = "";
    };

    const restore = () => {
        const saved = loadSavedPatch();
        if (!saved) {
            setStatus({ tone: "error", message: "Nothing saved in this browser yet." });
            return;
        }
        setText(saved);
        const result = importGraph(graph, saved);
        if (result.ok) {
            setStatus({ tone: "ok", message: "Restored the saved patch." });
            onApplied();
        } else {
            setStatus({ tone: "error", message: result.error });
        }
    };

    return (
        <section className="drawer" aria-label="Graph JSON">
            <header className="drawer__head">
                <h2 className="eyebrow">Graph JSON</h2>
                <button type="button" className="ghost" onClick={onClose} aria-label="Close JSON">
                    ✕
                </button>
            </header>

            <textarea
                className="drawer__text"
                aria-label="Serialised graph"
                spellCheck={false}
                value={text}
                onChange={(event) => setText(event.target.value)}
            />

            {status ? (
                <p className={"drawer__status drawer__status--" + status.tone} role="status">
                    {status.message}
                </p>
            ) : null}

            <div className="drawer__actions">
                <button type="button" onClick={refresh}>
                    Read graph
                </button>
                <button type="button" className="primary" onClick={apply}>
                    Load into graph
                </button>
                <button type="button" onClick={copy}>
                    Copy
                </button>
                <button type="button" onClick={() => downloadGraph(graph)}>
                    Download
                </button>
                <button type="button" onClick={() => fileRef.current.click()}>
                    Open file
                </button>
                <button
                    type="button"
                    onClick={() => {
                        savePatch(graph);
                        setStatus({ tone: "ok", message: "Saved to this browser." });
                    }}
                >
                    Save in browser
                </button>
                <button type="button" onClick={restore}>
                    Restore
                </button>
                <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                        clearSavedPatch();
                        setStatus({ tone: "ok", message: "Cleared the saved patch." });
                    }}
                >
                    Forget
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={readFile}
                />
            </div>
        </section>
    );
}
