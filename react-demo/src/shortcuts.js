// The keymap, in one place: the handler in App and the help overlay both read
// this list, so a binding can never be documented differently from how it works.

export const IS_MAC =
    typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform || "");

/** "mod" is Cmd on a Mac and Ctrl everywhere else. */
export const MOD_LABEL = IS_MAC ? "⌘" : "Ctrl";

function binding(id, key, options = {}) {
    return {
        id,
        key,
        mod: Boolean(options.mod),
        shift: Boolean(options.shift),
        // "?" needs Shift on most layouts but not all, so its binding ignores it.
        anyShift: Boolean(options.anyShift),
        label: options.label || null,
        desc: options.desc || "",
        // Bindings that only make sense with something selected are still matched;
        // the handler decides what to do when the selection is empty.
        needsSelection: Boolean(options.needsSelection),
    };
}

export const SHORTCUT_GROUPS = [
    {
        title: "Edit",
        items: [
            binding("delete", "Delete", {
                label: "Del",
                desc: "Delete the selected nodes",
                needsSelection: true,
            }),
            binding("delete", "Backspace", { label: "Backspace", desc: "Delete, same thing" }),
            binding("cut", "x", { mod: true, desc: "Cut to the clipboard", needsSelection: true }),
            binding("copy", "c", { mod: true, desc: "Copy to the clipboard", needsSelection: true }),
            binding("paste", "v", { mod: true, desc: "Paste at the pointer" }),
            binding("duplicate", "d", {
                mod: true,
                desc: "Duplicate in place",
                needsSelection: true,
            }),
            binding("undo", "z", { mod: true, desc: "Undo" }),
            binding("redo", "z", { mod: true, shift: true, desc: "Redo" }),
            binding("redo", "y", { mod: true, desc: "Redo, alternate binding" }),
        ],
    },
    {
        title: "Select & move",
        items: [
            binding("selectAll", "a", { mod: true, desc: "Select every node" }),
            binding("deselect", "Escape", { label: "Esc", desc: "Deselect" }),
            binding("nudge", "ArrowUp", { label: "Arrows", desc: "Nudge the selection by 1" }),
            binding("nudge", "ArrowDown"),
            binding("nudge", "ArrowLeft"),
            binding("nudge", "ArrowRight"),
            binding("nudge", "ArrowUp", {
                shift: true,
                label: "Shift + Arrows",
                desc: "Nudge by 10",
            }),
            binding("nudge", "ArrowDown", { shift: true }),
            binding("nudge", "ArrowLeft", { shift: true }),
            binding("nudge", "ArrowRight", { shift: true }),
        ],
    },
    {
        title: "Patch",
        items: [
            binding("run", "r", { desc: "Run or pause the graph" }),
            binding("step", "s", { desc: "Execute a single step" }),
            binding("fit", "f", { desc: "Fit the graph on screen" }),
            binding("json", "j", { desc: "Open the JSON drawer" }),
            binding("save", "s", { mod: true, desc: "Save the patch in this browser" }),
            binding("help", "?", { anyShift: true, desc: "Show this list" }),
        ],
    },
];

/** Every binding, flattened. */
export const SHORTCUTS = SHORTCUT_GROUPS.flatMap((group) => group.items);

/** Only the bindings that carry their own label, i.e. the ones worth listing. */
export const DOCUMENTED_GROUPS = SHORTCUT_GROUPS.map((group) => ({
    title: group.title,
    items: group.items.filter((item) => item.desc),
}));

/** Renders a binding the way a menu would: "⌘X", "Shift + Arrows", "Del". */
export function keyLabel(item) {
    if (item.label && /\s/.test(item.label)) {
        return item.label;
    }
    const key = item.label || (item.key.length === 1 ? item.key.toUpperCase() : item.key);
    const parts = [];
    if (item.mod) {
        parts.push(MOD_LABEL);
    }
    if (item.shift) {
        parts.push("Shift");
    }
    parts.push(key);
    return IS_MAC ? parts.join("") : parts.join(" + ");
}

/** True when the event target is somewhere the user is typing. */
export function isTypingTarget(target) {
    if (!target) {
        return false;
    }
    const tag = target.tagName;
    return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable === true
    );
}

/**
 * Resolves a keydown to a binding, or null. Modifier state has to match exactly,
 * so Ctrl+S never reaches plain S and Ctrl+Shift+Z never reaches undo.
 */
export function matchShortcut(event) {
    const mod = event.ctrlKey || event.metaKey;
    for (const item of SHORTCUTS) {
        if (item.mod !== mod) {
            continue;
        }
        if (!item.anyShift && item.shift !== event.shiftKey) {
            continue;
        }
        if (item.key.length === 1) {
            if (event.key.toLowerCase() === item.key) {
                return item;
            }
        } else if (event.key === item.key) {
            return item;
        }
    }
    return null;
}

export const NUDGE_STEP = 1;
export const NUDGE_STEP_LARGE = 10;

export const NUDGE_VECTORS = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
};
