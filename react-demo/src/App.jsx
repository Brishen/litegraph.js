import { memo, useCallback, useEffect, useRef, useState } from "react";
import "./demoSetup.js";
import "../../css/litegraph.css";

import EditorCanvas from "./components/EditorCanvas.jsx";
import Inspector from "./components/Inspector.jsx";
import JsonPanel from "./components/JsonPanel.jsx";
import NodePalette from "./components/NodePalette.jsx";
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

    const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
    const [splitThemeId, setSplitThemeId] = useState(DEFAULT_SPLIT_THEME_ID);
    const [split, setSplit] = useState(false);
    const [exampleId, setExampleId] = useState(DEFAULT_EXAMPLE_ID);
    const [selected, setSelected] = useState(null);
    const [running, setRunning] = useState(true);
    const [jsonOpen, setJsonOpen] = useState(false);
    const [, setTick] = useState(0);

    const theme = getTheme(themeId);
    const splitTheme = getTheme(splitThemeId);

    selectedRef.current = selected;
    runningRef.current = running;
    exampleRef.current = exampleId;

    const refresh = useCallback(() => setTick((value) => value + 1), []);

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
            refresh();
        },
        [fit, refresh]
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
        refresh();
    }, [refresh]);

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
            refresh();
        },
        [refresh]
    );

    const dropFromPalette = useCallback(
        (type, pos) => {
            const graph = graphRef.current;
            if (!graph) {
                return;
            }
            addNode(graph, canvasRef.current, type, pos);
            refresh();
        },
        [refresh]
    );

    const removeSelected = useCallback(() => {
        const graph = graphRef.current;
        if (!graph || !selectedRef.current) {
            return;
        }
        graph.remove(selectedRef.current);
        setSelected(null);
        refresh();
    }, [refresh]);

    const centerSelected = useCallback(() => {
        if (canvasRef.current && selectedRef.current) {
            canvasRef.current.centerOnNode(selectedRef.current);
        }
    }, []);

    const inspectorChanged = useCallback(() => {
        if (graphRef.current) {
            graphRef.current.setDirtyCanvas(true, true);
        }
        refresh();
    }, [refresh]);

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
        refresh();
    }, [fit, refresh]);

    /* ------------------------------------------------------------- shortcuts */

    useEffect(() => {
        const onKey = (event) => {
            const target = event.target;
            const typing =
                target &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.isContentEditable);
            if (typing || event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }
            if (event.key === "r") {
                toggleRun();
            } else if (event.key === "s") {
                step();
            } else if (event.key === "f") {
                fit();
            } else if (event.key === "j") {
                setJsonOpen((open) => !open);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [fit, step, toggleRun]);

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
            />

            <main className="bench__body" data-json={jsonOpen ? "open" : "closed"}>
                <MemoPalette onAdd={addFromPalette} />

                <div className={"stage" + (split ? " stage--split" : "")}>
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

            <SignalRail stats={stats} meterLabel={meterLabel} readSignal={readSignal} />
        </div>
    );
}
