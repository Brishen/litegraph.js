import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import App from "./App.jsx";

function statValue(container, label) {
    const stat = [...container.querySelectorAll(".stat")].find(
        (node) => node.querySelector(".stat__label").textContent === label
    );
    return Number(stat.querySelector(".stat__value").textContent);
}

function stageCanvases(container) {
    return container.querySelectorAll(".stage canvas");
}

function paletteButton(name) {
    const item = screen.getAllByText(name).find((node) => node.closest(".palette-item"));
    return item.closest("button");
}

function flashText(container) {
    const node = container.querySelector(".flash");
    return node ? node.textContent : "";
}

/** Reads the live graph back through the JSON drawer. */
function readGraph() {
    return JSON.parse(screen.getByLabelText("Serialised graph").value);
}

describe("<App> the bench", () => {
    afterEach(() => cleanup());

    it("mounts one canvas and loads the default patch", async () => {
        const { container } = render(<App />);
        expect(stageCanvases(container).length).toBe(1);
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));
        expect(statValue(container, "links")).toBeGreaterThan(0);
    });

    it("starts running and pauses on demand", async () => {
        const { container } = render(<App />);
        const pause = await screen.findByRole("button", { name: "Pause" });
        expect(container.querySelector(".run-state--live")).toBeTruthy();

        fireEvent.click(pause);
        expect(screen.getByRole("button", { name: "Run" })).toBeTruthy();
        await waitFor(() => expect(container.querySelector(".run-state--live")).toBeNull());
    });

    it("steps a paused graph forward", async () => {
        const { container } = render(<App />);
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));
        fireEvent.click(screen.getByRole("button", { name: "Pause" }));

        const before = statValue(container, "steps");
        fireEvent.click(screen.getByRole("button", { name: "Step" }));
        expect(statValue(container, "steps")).toBe(before + 1);
    });

    it("adds a node from the palette", async () => {
        const { container } = render(<App />);
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));
        const before = statValue(container, "nodes");

        fireEvent.click(paletteButton("gauge"));
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before + 1));
    });

    it("filters the palette", async () => {
        render(<App />);
        const search = screen.getByLabelText("Filter nodes");
        fireEvent.change(search, { target: { value: "oscillator" } });

        const palette = screen.getByLabelText("Node palette");
        expect(within(palette).getAllByText("oscillator").length).toBe(1);
        expect(within(palette).queryByText("clamp")).toBeNull();

        fireEvent.change(search, { target: { value: "zzzz" } });
        expect(within(palette).getByText(/Nothing matches/)).toBeTruthy();
    });

    it("switches example patches", async () => {
        const { container } = render(<App />);
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));

        fireEvent.change(screen.getByLabelText("Example patch"), {
            target: { value: "first-patch" },
        });

        await waitFor(() => expect(statValue(container, "nodes")).toBe(3));
        expect(screen.getByText(/smallest useful graph/)).toBeTruthy();
    });

    it("clears the graph", async () => {
        const { container } = render(<App />);
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));

        fireEvent.click(screen.getByRole("button", { name: "Clear" }));
        await waitFor(() => expect(statValue(container, "nodes")).toBe(0));
    });

    it("shows a second view of the same graph when split", async () => {
        const { container } = render(<App />);
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));
        const nodes = statValue(container, "nodes");

        fireEvent.click(screen.getByLabelText("Split view", { selector: "input" }));
        await waitFor(() => expect(stageCanvases(container).length).toBe(2));

        // A second canvas is a second view, not a second graph: the node count is
        // unchanged and both panes are labelled with their own theme.
        expect(statValue(container, "nodes")).toBe(nodes);
        const labels = [...container.querySelectorAll(".canvas-pane__label")].map(
            (node) => node.textContent
        );
        expect(labels).toEqual(["Bench", "Daylight"]);

        fireEvent.click(screen.getByLabelText("Split view", { selector: "input" }));
        await waitFor(() => expect(stageCanvases(container).length).toBe(1));
        expect(statValue(container, "nodes")).toBe(nodes);
    });

    it("opens the JSON drawer with the live graph in it", async () => {
        const { container } = render(<App />);
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));

        fireEvent.click(screen.getByRole("button", { name: "JSON" }));
        const text = screen.getByLabelText("Serialised graph");
        const parsed = JSON.parse(text.value);
        expect(parsed.nodes.length).toBe(statValue(container, "nodes"));
        expect(container.querySelector('[data-json="open"]')).toBeTruthy();
    });

    it("loads a pasted graph back in", async () => {
        const { container } = render(<App />);
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));

        fireEvent.click(screen.getByRole("button", { name: "JSON" }));
        const text = screen.getByLabelText("Serialised graph");
        fireEvent.change(text, {
            target: {
                value: JSON.stringify({
                    nodes: [
                        {
                            id: 1,
                            type: "basic/const",
                            pos: [10, 10],
                            size: [80, 30],
                            properties: { value: 1 },
                        },
                    ],
                    links: [],
                    last_node_id: 1,
                    last_link_id: 0,
                }),
            },
        });
        fireEvent.click(screen.getByRole("button", { name: "Load into graph" }));

        const drawer = screen.getByLabelText("Graph JSON");
        expect(within(drawer).getByRole("status").textContent).toBe("Graph loaded.");
        await waitFor(() => expect(statValue(container, "nodes")).toBe(1));
    });

    it("explains a bad paste instead of losing the graph", async () => {
        const { container } = render(<App />);
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));
        const before = statValue(container, "nodes");

        fireEvent.click(screen.getByRole("button", { name: "JSON" }));
        fireEvent.change(screen.getByLabelText("Serialised graph"), {
            target: { value: "{oops" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Load into graph" }));

        const drawer = screen.getByLabelText("Graph JSON");
        expect(within(drawer).getByRole("status").textContent).toMatch(/not valid JSON/);
        expect(statValue(container, "nodes")).toBe(before);
    });

    it("inspects a node once it is selected", async () => {
        const { container } = render(<App />);
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));

        expect(screen.getByText(/Select a node/)).toBeTruthy();

        // Selection normally comes from a click on the canvas; drive the callback
        // the canvas would fire.
        const canvas = container.querySelector(".stage canvas");
        expect(canvas).toBeTruthy();

        fireEvent.click(paletteButton("gauge"));
        await waitFor(() => expect(screen.queryByText(/Select a node/)).toBeNull());

        const inspector = screen.getByLabelText("Inspector");
        expect(within(inspector).getByLabelText("Node title").value).toBe("Gauge");
        expect(within(inspector).getByText("min")).toBeTruthy();
    });

    it("edits a property from the inspector", async () => {
        render(<App />);
        fireEvent.click(paletteButton("gauge"));

        const inspector = await screen.findByLabelText("Inspector");
        const label = within(inspector)
            .getByText("label")
            .closest("label")
            .querySelector("input");
        fireEvent.change(label, { target: { value: "level" } });
        expect(label.value).toBe("level");
    });

    it("removes the selected node", async () => {
        const { container } = render(<App />);
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));
        const before = statValue(container, "nodes");

        fireEvent.click(paletteButton("gauge"));
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before + 1));

        fireEvent.click(screen.getByRole("button", { name: "Remove" }));
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before));
        expect(screen.getByText(/Select a node/)).toBeTruthy();
    });

    it("repaints the chrome when the theme changes", async () => {
        const { container } = render(<App />);
        const bench = container.querySelector(".bench");
        expect(bench.dataset.scheme).toBe("dark");

        fireEvent.change(screen.getByLabelText("Canvas theme"), {
            target: { value: "daylight" },
        });
        expect(bench.dataset.scheme).toBe("light");
        expect(bench.style.getPropertyValue("--bg")).toBe("#eceef2");
    });

    it("runs and pauses from the keyboard", async () => {
        render(<App />);
        await screen.findByRole("button", { name: "Pause" });

        fireEvent.keyDown(window, { key: "r" });
        expect(screen.getByRole("button", { name: "Run" })).toBeTruthy();

        fireEvent.keyDown(window, { key: "r" });
        expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    });

    it("ignores shortcuts while typing in a field", async () => {
        render(<App />);
        await screen.findByRole("button", { name: "Pause" });

        const search = screen.getByLabelText("Filter nodes");
        fireEvent.keyDown(search, { key: "r" });
        expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    });
});

describe("<App> editing shortcuts", () => {
    afterEach(() => cleanup());

    async function ready(container) {
        await waitFor(() => expect(statValue(container, "nodes")).toBeGreaterThan(1));
    }

    /** Adds a node from the palette, which leaves it selected. */
    function addGauge() {
        fireEvent.click(paletteButton("gauge"));
    }

    it("deletes the selection with Delete", async () => {
        const { container } = render(<App />);
        await ready(container);
        const before = statValue(container, "nodes");

        addGauge();
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before + 1));

        fireEvent.keyDown(window, { key: "Delete" });
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before));
        expect(flashText(container)).toBe("Deleted 1 node");
        expect(screen.getByText(/Select a node/)).toBeTruthy();
    });

    it("deletes with Backspace too", async () => {
        const { container } = render(<App />);
        await ready(container);
        const before = statValue(container, "nodes");

        addGauge();
        fireEvent.keyDown(window, { key: "Backspace" });
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before));
    });

    it("says so when there is nothing to delete", async () => {
        const { container } = render(<App />);
        await ready(container);
        const before = statValue(container, "nodes");

        fireEvent.keyDown(window, { key: "Delete" });
        expect(flashText(container)).toBe("Nothing selected");
        expect(statValue(container, "nodes")).toBe(before);
    });

    it("copies and pastes", async () => {
        const { container } = render(<App />);
        await ready(container);
        addGauge();
        const before = statValue(container, "nodes");

        fireEvent.keyDown(window, { key: "c", ctrlKey: true });
        expect(flashText(container)).toBe("Copied 1 node");
        expect(statValue(container, "nodes")).toBe(before);

        fireEvent.keyDown(window, { key: "v", ctrlKey: true });
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before + 1));
        expect(flashText(container)).toBe("Pasted 1 node");
    });

    it("cuts, then pastes back", async () => {
        const { container } = render(<App />);
        await ready(container);
        addGauge();
        const before = statValue(container, "nodes");

        fireEvent.keyDown(window, { key: "x", ctrlKey: true });
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before - 1));
        expect(flashText(container)).toBe("Cut 1 node");

        fireEvent.keyDown(window, { key: "v", ctrlKey: true });
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before));
    });

    it("duplicates the selection", async () => {
        const { container } = render(<App />);
        await ready(container);
        addGauge();
        const before = statValue(container, "nodes");

        fireEvent.keyDown(window, { key: "d", ctrlKey: true });
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before + 1));
        expect(flashText(container)).toBe("Duplicated 1 node");
    });

    it("works with Cmd as well as Ctrl", async () => {
        const { container } = render(<App />);
        await ready(container);
        addGauge();
        const before = statValue(container, "nodes");

        fireEvent.keyDown(window, { key: "c", metaKey: true });
        fireEvent.keyDown(window, { key: "v", metaKey: true });
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before + 1));
    });

    it("selects everything and deselects again", async () => {
        const { container } = render(<App />);
        await ready(container);
        const total = statValue(container, "nodes");

        fireEvent.keyDown(window, { key: "a", ctrlKey: true });
        expect(flashText(container)).toBe("Selected " + total + " nodes");

        fireEvent.keyDown(window, { key: "Escape" });
        await waitFor(() => expect(screen.getByText(/Select a node/)).toBeTruthy());
    });

    it("nudges the selection with the arrow keys", async () => {
        const { container } = render(<App />);
        await ready(container);
        addGauge();

        fireEvent.click(screen.getByRole("button", { name: "JSON" }));
        // The default patch already has a gauge; the one just added is the last.
        const lastGauge = (graph) =>
            graph.nodes.filter((node) => node.type === "demo/gauge").pop();
        const gaugeBefore = lastGauge(readGraph());

        fireEvent.keyDown(window, { key: "ArrowRight" });
        fireEvent.keyDown(window, { key: "ArrowDown", shiftKey: true });
        fireEvent.click(screen.getByRole("button", { name: "Read graph" }));

        const gaugeAfter = lastGauge(readGraph());
        expect(gaugeAfter.pos[0]).toBe(gaugeBefore.pos[0] + 1);
        expect(gaugeAfter.pos[1]).toBe(gaugeBefore.pos[1] + 10);
    });

    it("undoes and redoes an edit", async () => {
        const { container } = render(<App />);
        await ready(container);
        const before = statValue(container, "nodes");

        addGauge();
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before + 1));

        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before));
        expect(flashText(container)).toBe("Undo");

        fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before + 1));
        expect(flashText(container)).toBe("Redo");
    });

    it("undoes a delete, restoring the node", async () => {
        const { container } = render(<App />);
        await ready(container);
        const before = statValue(container, "nodes");

        fireEvent.keyDown(window, { key: "a", ctrlKey: true });
        fireEvent.keyDown(window, { key: "Delete" });
        await waitFor(() => expect(statValue(container, "nodes")).toBe(0));

        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before));
        expect(statValue(container, "links")).toBeGreaterThan(0);
    });

    it("has nothing to undo on a fresh patch", async () => {
        const { container } = render(<App />);
        await ready(container);

        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        expect(flashText(container)).toBe("Nothing to undo");
    });

    it("enables the toolbar undo button once there is history", async () => {
        const { container } = render(<App />);
        await ready(container);
        expect(screen.getByRole("button", { name: "Undo" }).disabled).toBe(true);

        addGauge();
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Undo" }).disabled).toBe(false)
        );

        fireEvent.click(screen.getByRole("button", { name: "Undo" }));
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Redo" }).disabled).toBe(false)
        );
    });

    it("saves to the browser with the save key, without the browser dialog", async () => {
        const { container } = render(<App />);
        await ready(container);

        const event = new KeyboardEvent("keydown", {
            key: "s",
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        });
        window.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        // dispatchEvent bypasses fireEvent's act() wrapper, so wait for the render.
        await waitFor(() => expect(flashText(container)).toBe("Saved in this browser"));
        expect(window.localStorage.getItem("litegraph-bench.patch")).toBeTruthy();
    });

    it("opens and closes the shortcuts sheet", async () => {
        const { container } = render(<App />);
        await ready(container);
        expect(screen.queryByRole("dialog")).toBeNull();

        fireEvent.keyDown(window, { key: "?" });
        const sheet = screen.getByRole("dialog");
        expect(within(sheet).getByText("Delete the selected nodes")).toBeTruthy();

        fireEvent.keyDown(window, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("opens the shortcuts sheet from the toolbar", async () => {
        const { container } = render(<App />);
        await ready(container);

        fireEvent.click(screen.getByRole("button", { name: "Keys" }));
        expect(screen.getByRole("dialog")).toBeTruthy();

        fireEvent.click(screen.getByLabelText("Close shortcuts"));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("leaves editing keys alone while typing in a field", async () => {
        const { container } = render(<App />);
        await ready(container);
        const before = statValue(container, "nodes");
        addGauge();
        await waitFor(() => expect(statValue(container, "nodes")).toBe(before + 1));

        const search = screen.getByLabelText("Filter nodes");
        fireEvent.keyDown(search, { key: "Delete" });
        fireEvent.keyDown(search, { key: "a", ctrlKey: true });
        fireEvent.keyDown(search, { key: "?" });

        expect(statValue(container, "nodes")).toBe(before + 1);
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
