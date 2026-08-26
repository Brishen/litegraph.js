import { describe, it, expect } from "vitest";
import {
    DOCUMENTED_GROUPS,
    SHORTCUTS,
    isTypingTarget,
    keyLabel,
    matchShortcut,
} from "./shortcuts.js";

function press(key, options = {}) {
    return {
        key,
        ctrlKey: Boolean(options.ctrl),
        metaKey: Boolean(options.meta),
        shiftKey: Boolean(options.shift),
        altKey: Boolean(options.alt),
    };
}

describe("matchShortcut", () => {
    it("resolves the plain keys", () => {
        expect(matchShortcut(press("r")).id).toBe("run");
        expect(matchShortcut(press("s")).id).toBe("step");
        expect(matchShortcut(press("f")).id).toBe("fit");
        expect(matchShortcut(press("j")).id).toBe("json");
        expect(matchShortcut(press("Delete")).id).toBe("delete");
        expect(matchShortcut(press("Backspace")).id).toBe("delete");
        expect(matchShortcut(press("Escape")).id).toBe("deselect");
    });

    it("resolves the clipboard keys under either modifier", () => {
        expect(matchShortcut(press("x", { ctrl: true })).id).toBe("cut");
        expect(matchShortcut(press("c", { ctrl: true })).id).toBe("copy");
        expect(matchShortcut(press("v", { meta: true })).id).toBe("paste");
        expect(matchShortcut(press("d", { meta: true })).id).toBe("duplicate");
        expect(matchShortcut(press("a", { ctrl: true })).id).toBe("selectAll");
    });

    it("separates undo from redo by Shift", () => {
        expect(matchShortcut(press("z", { ctrl: true })).id).toBe("undo");
        expect(matchShortcut(press("z", { ctrl: true, shift: true })).id).toBe("redo");
        expect(matchShortcut(press("y", { ctrl: true })).id).toBe("redo");
    });

    it("keeps a modified key away from its unmodified twin", () => {
        // Ctrl+S saves; it must not also step the graph.
        expect(matchShortcut(press("s", { ctrl: true })).id).toBe("save");
        expect(matchShortcut(press("s")).id).toBe("step");
        // And an unmodified C is not a copy.
        expect(matchShortcut(press("c"))).toBeNull();
    });

    it("is case insensitive, so Caps Lock still works", () => {
        expect(matchShortcut(press("R")).id).toBe("run");
        expect(matchShortcut(press("Z", { ctrl: true })).id).toBe("undo");
    });

    it("accepts ? with or without Shift", () => {
        expect(matchShortcut(press("?")).id).toBe("help");
        expect(matchShortcut(press("?", { shift: true })).id).toBe("help");
    });

    it("returns null for anything unbound", () => {
        expect(matchShortcut(press("q"))).toBeNull();
        expect(matchShortcut(press("Tab"))).toBeNull();
        expect(matchShortcut(press("b", { ctrl: true }))).toBeNull();
    });

    it("resolves each arrow to the nudge action", () => {
        for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
            expect(matchShortcut(press(key)).id).toBe("nudge");
            expect(matchShortcut(press(key, { shift: true })).id).toBe("nudge");
        }
    });
});

describe("isTypingTarget", () => {
    it("recognises the places a user types", () => {
        expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
        expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
        expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
        expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    });

    it("leaves everything else alone", () => {
        expect(isTypingTarget({ tagName: "CANVAS" })).toBe(false);
        expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
        expect(isTypingTarget(null)).toBe(false);
    });
});

describe("the documented keymap", () => {
    it("labels every binding it lists", () => {
        for (const group of DOCUMENTED_GROUPS) {
            expect(group.items.length).toBeGreaterThan(0);
            for (const item of group.items) {
                expect(keyLabel(item).length).toBeGreaterThan(0);
                expect(item.desc.length).toBeGreaterThan(0);
            }
        }
    });

    it("shows the modifier in the label", () => {
        const copy = SHORTCUTS.find((item) => item.id === "copy");
        expect(keyLabel(copy)).toMatch(/C$/);
        expect(keyLabel(copy).length).toBeGreaterThan(1);
    });

    it("documents every action the handler can dispatch", () => {
        const documented = new Set(
            DOCUMENTED_GROUPS.flatMap((group) => group.items.map((item) => item.id))
        );
        for (const item of SHORTCUTS) {
            expect(documented.has(item.id)).toBe(true);
        }
    });
});
