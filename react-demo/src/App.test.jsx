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

        expect(screen.getByRole("status").textContent).toBe("Graph loaded.");
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

        expect(screen.getByRole("status").textContent).toMatch(/not valid JSON/);
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
