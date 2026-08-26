import { describe, it, expect, beforeAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useState } from "react";
import { act } from "react-dom/test-utils";
import { LiteGraphCanvas, LiteGraphThemeProvider } from "../../src/litegraph-react.mjs";
import { LiteGraph } from "../../src/litegraph.mjs";

// jsdom has no 2d context; hand LiteGraph a permissive stub so it can construct.
beforeAll(() => {
    const ctx = new Proxy(
        {},
        {
            get: (t, p) => {
                if (p in t) return t[p];
                if (p === "measureText") return () => ({ width: 10 });
                if (p === "createLinearGradient" || p === "createPattern")
                    return () => ({ addColorStop() {} });
                return () => {};
            },
            set: (t, p, v) => ((t[p] = v), true),
        }
    );
    HTMLCanvasElement.prototype.getContext = () => ctx;
});

function captureCanvas(ui) {
    let instance = null;
    const onLoad = (_graph, canvas) => {
        instance = canvas;
    };
    const utils = render(ui(onLoad));
    return { instance: () => instance, ...utils };
}

describe("<LiteGraphCanvas theme>", () => {
    it("renders a canvas element", () => {
        const { container } = captureCanvas((onLoad) => (
            <LiteGraphCanvas onLoad={onLoad} />
        ));
        expect(container.querySelector("canvas")).toBeTruthy();
        cleanup();
    });

    it("applies the theme prop to the underlying canvas", () => {
        const { instance } = captureCanvas((onLoad) => (
            <LiteGraphCanvas onLoad={onLoad} theme={{ NODE_DEFAULT_BGCOLOR: "#FFF" }} />
        ));
        expect(instance().theme.NODE_DEFAULT_BGCOLOR).toBe("#FFF");
        cleanup();
    });

    it("leaves the LiteGraph globals untouched", () => {
        const before = LiteGraph.NODE_DEFAULT_BGCOLOR;
        captureCanvas((onLoad) => (
            <LiteGraphCanvas onLoad={onLoad} theme={{ NODE_DEFAULT_BGCOLOR: "#FFF" }} />
        ));
        expect(LiteGraph.NODE_DEFAULT_BGCOLOR).toBe(before);
        cleanup();
    });

    it("inherits a theme from LiteGraphThemeProvider", () => {
        const { instance } = captureCanvas((onLoad) => (
            <LiteGraphThemeProvider theme={{ LINK_COLOR: "#b58900" }}>
                <LiteGraphCanvas onLoad={onLoad} />
            </LiteGraphThemeProvider>
        ));
        expect(instance().theme.LINK_COLOR).toBe("#b58900");
        cleanup();
    });

    it("lets the instance theme win over the provider", () => {
        const { instance } = captureCanvas((onLoad) => (
            <LiteGraphThemeProvider theme={{ LINK_COLOR: "#b58900" }}>
                <LiteGraphCanvas onLoad={onLoad} theme={{ LINK_COLOR: "#2a2" }} />
            </LiteGraphThemeProvider>
        ));
        expect(instance().theme.LINK_COLOR).toBe("#2a2");
        cleanup();
    });

    it("themes two mounted canvases independently", () => {
        let a = null;
        let b = null;
        render(
            <>
                <LiteGraphCanvas onLoad={(_g, c) => (a = c)} theme={{ LINK_COLOR: "#f00" }} />
                <LiteGraphCanvas onLoad={(_g, c) => (b = c)} theme={{ LINK_COLOR: "#00f" }} />
            </>
        );
        expect(a.theme.LINK_COLOR).toBe("#f00");
        expect(b.theme.LINK_COLOR).toBe("#00f");
        cleanup();
    });

    it("re-themes on prop change without rebuilding the canvas", () => {
        let instance = null;
        let setTheme;
        function Harness() {
            const [theme, set] = useState({ LINK_COLOR: "#f00" });
            setTheme = set;
            return <LiteGraphCanvas onLoad={(_g, c) => (instance = c)} theme={theme} />;
        }
        render(<Harness />);
        const first = instance;
        expect(instance.theme.LINK_COLOR).toBe("#f00");

        act(() => setTheme({ LINK_COLOR: "#00f" }));

        expect(instance.theme.LINK_COLOR).toBe("#00f");
        expect(instance).toBe(first); // same canvas instance, not remounted
        cleanup();
    });

    it("drops an override that is removed from the prop", () => {
        let instance = null;
        let setTheme;
        function Harness() {
            const [theme, set] = useState({ LINK_COLOR: "#f00" });
            setTheme = set;
            return <LiteGraphCanvas onLoad={(_g, c) => (instance = c)} theme={theme} />;
        }
        render(<Harness />);
        act(() => setTheme({}));
        expect(instance.theme.LINK_COLOR).toBe(LiteGraph.LINK_COLOR);
        cleanup();
    });
});
