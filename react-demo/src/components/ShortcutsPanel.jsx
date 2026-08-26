import { useEffect, useRef } from "react";
import { DOCUMENTED_GROUPS, keyLabel } from "../shortcuts.js";

/**
 * The keymap, rendered from the same list the handler dispatches on. Opens on "?"
 * and closes on Escape, a click outside, or the button.
 */
export default function ShortcutsPanel({ onClose }) {
    const closeRef = useRef(null);

    useEffect(() => {
        if (closeRef.current) {
            closeRef.current.focus();
        }
    }, []);

    return (
        <div className="scrim" onClick={onClose}>
            <section
                className="sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Keyboard shortcuts"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="sheet__head">
                    <h2 className="eyebrow">Keyboard</h2>
                    <button
                        type="button"
                        className="ghost"
                        ref={closeRef}
                        onClick={onClose}
                        aria-label="Close shortcuts"
                    >
                        ✕
                    </button>
                </header>

                <div className="sheet__body">
                    {DOCUMENTED_GROUPS.map((group) => (
                        <section key={group.title} className="keymap">
                            <h3 className="eyebrow eyebrow--sub">{group.title}</h3>
                            <dl>
                                {group.items.map((item) => (
                                    <div key={item.id + item.key + item.shift} className="keymap__row">
                                        <dt>
                                            <kbd>{keyLabel(item)}</kbd>
                                        </dt>
                                        <dd>{item.desc}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ))}
                </div>

                <footer className="sheet__foot">
                    Shortcuts are ignored while you are typing in a field. The canvas keeps its
                    own bindings too: hold space to pan, right-click for the node menu.
                </footer>
            </section>
        </div>
    );
}
