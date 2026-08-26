import { memo, useCallback, useEffect, useRef, useState } from "react";
import "./demoSetup.js";
import "../../css/litegraph.css";

import EditorCanvas from "./components/EditorCanvas.jsx";
import Inspector from "./components/Inspector.jsx";
import JsonPanel from "./components/JsonPanel.jsx";
import NodePalette from "./components/NodePalette.jsx";
import ShortcutsPanel from "./components/ShortcutsPanel.jsx";
import SignalRail from "./components/SignalRail.jsx";
import Toolbar from "./components/Toolbar.jsx";

import { DEFAULT_EXAMPLE_ID, EXAMPLES, loadExample } from "./examples.js";
import {
    DEFAULT_SPLIT_THEME_ID,
    DEFAULT_THEME_ID,
    THEMES,
    getTheme,
} from "./themes.js";
import {
    addNode,
    fitToGraph,
    readOutputValue,
    readStats,
    savePatch,
    viewportCenter,
} from "./graphTools.js";
import {
    GraphHistory,
    copySelection,
    cutSelection,
    deleteSelection,
    deselectAll,
    duplicateSelection,
    nudgeSelection,
    pasteClipboard,
    selectAll,
} from "./editing.js";
import {
    NUDGE_STEP,
    NUDGE_STEP_LARGE,
    NUDGE_VECTORS,
    isTypingTarget,
    matchShortcut,
} from "./shortcuts.js";

const MemoPalette = memo(NodePalette);
const MemoToolbar = memo(Toolbar);

const EMPTY_STATS = { nodes: 0, links: 0, iteration: 0, elapsed: 0, fps: 0, running: false };

export default function App() {
    const graphRef = useRef(null);
    const canvasRef = useRef(null);
    const secondaryRef = useRef(null);
    const selectedRef = useRef(null);
    const runningRef = useRef(true);
    const exampleRef = useRef(DEFAULT_EXAMPLE_ID);
    const historyRef = useRef(null);
    const flashTimerRef = useRef(0);
    const pointerOverStageRef = useRef(false);

    const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
    const [splitThemeId, setSplitThemeId] = useState(DEFAULT_SPLIT_THEME_ID);
    const [split, setSplit] = useState(false);
    const [exampleId, setExampleId] = useState(DEFAULT_EXAMPLE_ID);
    const [selected, setSelected] = useState(null);
    const [running, setRunning] = useState(true);
    const [jsonOpen, setJsonOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [flash, setFlash] = useState(null);
    const [, setTick] = useState(0);

    const theme = getTheme(themeId);
    const splitTheme = getTheme(splitThemeId);

    selectedRef.current = selected;
    runningRef.current = running;
    exampleRef.current = exampleId;

    const refresh = useCallback(() => setTick((value) => value + 1), []);

    // Keyboard edits have no visible target, so say what happened.
    const announce = useCallback((message) => {
        setFlash(message);
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = window.setTimeout(() => setFlash(null), 1800);
    }, []);

    // For edits this app makes itself. LiteGraph's own edits - dragging a node,
    // wiring two slots - come back through graph.onAfterChange instead.
    const commit = useCallback(() => {
        if (historyRef.current) {
            historyRef.current.record();
        }
        refresh();
    }, [refresh]);

    useEffect(() => () => window.clearTimeout(flashTimerRef.current), []);

    /* ------------------------------------------------------------- lifecycle */

    const handleReady = useCallback(
        (graph, canvas) => {
            graphRef.current = graph;
            canvasRef.current = canvas;
            // The status rail below reports all of this, and better.
            canvas.show_info = false;

            canvas.onSelectionChange = (nodes) => {
                const list = nodes ? Object.values(nodes) : [];
                setSelected(list.length ? list[0] : null);
            };

            loadExample(graph, exampleRef.current);

            historyRef.current = new GraphHistory(graph);
            // Everything LiteGraph changes on its own - a dragged node, a new
            // wire, a delete from its context menu - lands here, which is what
            // makes those edits undoable without wrapping any of them.
            graph.onAfterChange = () => {
                if (!historyRef.current) {
                    return;
                }
                historyRef.current.recordSoon();
                refresh();
            };

            // The wrapper starts the graph right after this callback returns, so
            // there is nothing to start here - just line the view up on the patch.
            requestAnimationFrame(() => fitToGraph(canvas));
            refresh();
        },
        [refresh]
    );

    // The second pane is another view of the same graph, not another graph. The
    // wrapper hands every canvas a fresh LGraph; this one gets pointed at the
    // primary graph instead, and its own empty graph is stopped once it starts.
    const handleSecondaryReady = useCallback((ownGraph, canvas) => {
        const primary = graphRef.current;
        if (!primary) {
            return;
        }
        secondaryRef.current = canvas;
        canvas.show_info = false;
        canvas.onSelectionChange = (nodes) => {
            const list = nodes ? Object.values(nodes) : [];
            setSelected(list.length ? list[0] : null);
        };
        canvas.setGraph(primary);
        queueMicrotask(() => ownGraph.stop());
        requestAnimationFrame(() => fitToGraph(canvas));
    }, []);

    // Closing the split pane unmounts its canvas, but the graph still holds a
    // reference to it. Detach so it stops being drawn into.
    useEffect(() => {
        if (split) {
            return;
        }
        const canvas = secondaryRef.current;
        if (canvas) {
            if (canvas.stopRendering) {
                canvas.stopRendering();
            }
            if (graphRef.current) {
                graphRef.current.detachCanvas(canvas);
            }
            secondaryRef.current = null;
        }
    }, [split]);

    useEffect(() => {
        const save = () => {
            if (graphRef.current) {
                savePatch(graphRef.current);
            }
        };
        window.addEventListener("beforeunload", save);
        return () => window.removeEventListener("beforeunload", save);
    }, []);

    // One heartbeat drives every live readout in the chrome. The canvas draws on
    // its own rAF loop; this only paces React.
    useEffect(() => {
        const id = window.setInterval(refresh, 200);
        return () => window.clearInterval(id);
    }, [refresh]);

    /* --------------------------------------------------------------- actions */

    const toggleRun = useCallback(() => {
        const graph = graphRef.current;
        if (!graph) {
            return;
        }
        if (runningRef.current) {
            graph.stop();
            setRunning(false);
        } else {
            graph.start();
            setRunning(true);
        }
    }, []);

    const step = useCallback(() => {
        const graph = graphRef.current;
        if (!graph) {
            return;
        }
        if (runningRef.current) {
            graph.stop();
            setRunning(false);
        }
        graph.runStep(1);
        graph.setDirtyCanvas(true, true);
        refresh();
    }, [refresh]);

    const fit = useCallback(() => {
        fitToGraph(canvasRef.current);
        if (secondaryRef.current) {
            fitToGraph(secondaryRef.current);
        }
    }, []);

    const applyExample = useCallback(
        (id) => {
            const graph = graphRef.current;
            if (!graph) {
                return;
            }
            setExampleId(id);
            exampleRef.current = id;
            loadExample(graph, id);
            setSelected(null);
            if (runningRef.current) {
                graph.start();
            }
            fit();
            commit();
        },
        [commit, fit]
    );

    const clearGraph = useCallback(() => {
        const graph = graphRef.current;
        if (!graph) {
            return;
        }
        graph.clear();
        setSelected(null);
        if (runningRef.current) {
            graph.start();
        }
        commit();
    }, [commit]);

    const addFromPalette = useCallback(
        (type) => {
            const graph = graphRef.current;
            const canvas = canvasRef.current;
            if (!graph || !canvas) {
                return;
            }
            const center = viewportCenter(canvas);
            // Stagger repeat clicks so nodes do not stack in one spot.
            const drift = (graph._nodes.length % 6) * 24;
            addNode(graph, canvas, type, [center[0] - 90 + drift, center[1] - 40 + drift]);
            commit();
        },
        [commit]
    );

    const dropFromPalette = useCallback(
        (type, pos) => {
            const graph = graphRef.current;
            if (!graph) {
                return;
            }
            addNode(graph, canvasRef.current, type, pos);
            commit();
        },
        [commit]
    );

    const removeSelected = useCallback(() => {
        const graph = graphRef.current;
        if (!graph || !selectedRef.current) {
            return;
        }
        graph.remove(selectedRef.current);
        setSelected(null);
        commit();
    }, [commit]);

    const centerSelected = useCallback(() => {
        if (canvasRef.current && selectedRef.current) {
            canvasRef.current.centerOnNode(selectedRef.current);
        }
    }, []);

    const inspectorChanged = useCallback(() => {
        if (graphRef.current) {
            graphRef.current.setDirtyCanvas(true, true);
        }
        commit();
    }, [commit]);

    const afterImport = useCallback(() => {
        const graph = graphRef.current;
        if (!graph) {
            return;
        }
        setSelected(null);
        if (runningRef.current) {
            graph.start();
        }
        fit();
        commit();
    }, [commit, fit]);

    /* ----------------------------------------------------------- edit actions */

    const countLabel = (verb, count) =>
        verb + " " + count + (count === 1 ? " node" : " nodes");

    const doDelete = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const count = deleteSelection(canvas);
        if (!count) {
            announce("Nothing selected");
            return;
        }
        // deleteSelectedNodes empties the selection without telling anyone.
        setSelected(null);
        announce(countLabel("Deleted", count));
        commit();
    }, [announce, commit]);

    const doCopy = useCallback(() => {
        const count = copySelection(canvasRef.current);
        announce(count ? countLabel("Copied", count) : "Nothing selected");
    }, [announce]);

    const doCut = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const count = cutSelection(canvas);
        if (!count) {
            announce("Nothing selected");
            return;
        }
        setSelected(null);
        announce(countLabel("Cut", count));
        commit();
    }, [announce, commit]);

    const doPaste = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        // Paste under the pointer when it is over the canvas, which is what
        // graph_mouse already holds; otherwise drop it in the middle of the view.
        const pos = pointerOverStageRef.current ? null : viewportCenter(canvas);
        const count = pasteClipboard(canvas, pos);
        announce(count ? countLabel("Pasted", count) : "Clipboard is empty");
        if (count) {
            commit();
        }
    }, [announce, commit]);

    const doDuplicate = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const count = duplicateSelection(canvas);
        announce(count ? countLabel("Duplicated", count) : "Nothing selected");
        if (count) {
            commit();
        }
    }, [announce, commit]);

    const doSelectAll = useCallback(() => {
        const count = selectAll(canvasRef.current);
        announce(count ? countLabel("Selected", count) : "Nothing to select");
        refresh();
    }, [announce, refresh]);

    const doDeselect = useCallback(() => {
        deselectAll(canvasRef.current);
        setSelected(null);
        refresh();
    }, [refresh]);

    const doNudge = useCallback(
        (key, large) => {
            const vector = NUDGE_VECTORS[key];
            if (!vector) {
                return;
            }
            const distance = large ? NUDGE_STEP_LARGE : NUDGE_STEP;
            if (nudgeSelection(canvasRef.current, vector[0] * distance, vector[1] * distance)) {
                commit();
            }
        },
        [commit]
    );

    // Undo and redo replace the graph contents wholesale, so the current
    // selection points at nodes that no longer exist.
    const afterTimeTravel = useCallback(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.deselectAllNodes();
        }
        setSelected(null);
        if (runningRef.current && graphRef.current) {
            graphRef.current.start();
        }
        refresh();
    }, [refresh]);

    const doUndo = useCallback(() => {
        const history = historyRef.current;
        if (!history || !history.undo()) {
            announce("Nothing to undo");
            return;
        }
        afterTimeTravel();
        announce("Undo");
    }, [afterTimeTravel, announce]);

    const doRedo = useCallback(() => {
        const history = historyRef.current;
        if (!history || !history.redo()) {
            announce("Nothing to redo");
            return;
        }
        afterTimeTravel();
        announce("Redo");
    }, [afterTimeTravel, announce]);

    const doSave = useCallback(() => {
        if (!graphRef.current) {
            return;
        }
        announce(savePatch(graphRef.current) ? "Saved in this browser" : "Could not save");
    }, [announce]);

    /* ------------------------------------------------------------- shortcuts */

    const actions = useRef({});
    actions.current = {
        delete: doDelete,
        cut: doCut,
        copy: doCopy,
        paste: doPaste,
        duplicate: doDuplicate,
        undo: doUndo,
        redo: doRedo,
        selectAll: doSelectAll,
        deselect: () => {
            if (helpOpen) {
                setHelpOpen(false);
                return;
            }
            doDeselect();
        },
        run: toggleRun,
        step,
        fit,
        save: doSave,
        json: () => setJsonOpen((open) => !open),
        help: () => setHelpOpen((open) => !open),
    };

    useEffect(() => {
        // Capture phase, on the window: LiteGraph binds its own keydown handler to
        // the canvas element and implements some of these itself. Getting there
        // first and stopping the event keeps every shortcut on one implementation
        // instead of two that fire together.
        const onKey = (event) => {
            if (isTypingTarget(event.target) || event.altKey) {
                return;
            }
            const shortcut = matchShortcut(event);
            if (!shortcut) {
                return;
            }
            if (shortcut.id === "nudge") {
                doNudge(event.key, event.shiftKey);
            } else {
                const action = actions.current[shortcut.id];
                if (!action) {
                    return;
                }
                action();
            }
            event.preventDefault();
            event.stopPropagation();
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [doNudge]);

    /* ---------------------------------------------------------------- render */

    const stats = graphRef.current
        ? readStats(graphRef.current, canvasRef.current)
        : EMPTY_STATS;

    const readSignal = useCallback(() => {
        const node = selectedRef.current;
        if (!node) {
            return 0;
        }
        const value = readOutputValue(node, 0);
        return typeof value === "number" ? value : 0;
    }, []);

    const meterLabel = selected
        ? selected.title + " · out 0"
        : "select a node to meter it";

    return (
        <div className="bench" style={theme.chrome} data-scheme={theme.scheme}>
            <MemoToolbar
                examples={EXAMPLES}
                exampleId={exampleId}
                onExample={applyExample}
                themes={THEMES}
                themeId={themeId}
                onTheme={setThemeId}
                splitThemeId={splitThemeId}
                onSplitTheme={setSplitThemeId}
                split={split}
                onToggleSplit={() => setSplit((value) => !value)}
                running={running}
                onToggleRun={toggleRun}
                onStep={step}
                onFit={fit}
                onClear={clearGraph}
                jsonOpen={jsonOpen}
                onToggleJson={() => setJsonOpen((open) => !open)}
                onUndo={doUndo}
                onRedo={doRedo}
                canUndo={Boolean(historyRef.current && historyRef.current.canUndo)}
                canRedo={Boolean(historyRef.current && historyRef.current.canRedo)}
                onHelp={() => setHelpOpen(true)}
            />

            <main className="bench__body" data-json={jsonOpen ? "open" : "closed"}>
                <MemoPalette onAdd={addFromPalette} />

                <div
                    className={"stage" + (split ? " stage--split" : "")}
                    onMouseEnter={() => {
                        pointerOverStageRef.current = true;
                    }}
                    onMouseLeave={() => {
                        pointerOverStageRef.current = false;
                    }}
                >
                    <EditorCanvas
                        theme={theme.canvas}
                        label={split ? theme.label : null}
                        onReady={handleReady}
                        onDropType={dropFromPalette}
                    />
                    {split ? (
                        <EditorCanvas
                            theme={splitTheme.canvas}
                            label={splitTheme.label}
                            onReady={handleSecondaryReady}
                            onDropType={dropFromPalette}
                        />
                    ) : null}
                </div>

                {jsonOpen ? (
                    <JsonPanel
                        graph={graphRef.current}
                        onApplied={afterImport}
                        onClose={() => setJsonOpen(false)}
                    />
                ) : (
                    <Inspector
                        node={selected}
                        onChange={inspectorChanged}
                        onRemove={removeSelected}
                        onCenter={centerSelected}
                    />
                )}
            </main>

            <SignalRail
                stats={stats}
                meterLabel={meterLabel}
                readSignal={readSignal}
                flash={flash}
            />

            {helpOpen ? <ShortcutsPanel onClose={() => setHelpOpen(false)} /> : null}
        </div>
    );
}
