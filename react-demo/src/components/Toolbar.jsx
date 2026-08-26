export default function Toolbar({
    examples,
    exampleId,
    onExample,
    themes,
    themeId,
    onTheme,
    splitThemeId,
    onSplitTheme,
    split,
    onToggleSplit,
    running,
    onToggleRun,
    onStep,
    onFit,
    onClear,
    jsonOpen,
    onToggleJson,
}) {
    const example = examples.find((item) => item.id === exampleId) || examples[0];

    return (
        <header className="toolbar">
            <div className="brand">
                <span className="brand__mark" aria-hidden="true" />
                <span className="brand__name">litegraph</span>
                <span className="brand__sub">bench</span>
            </div>

            <div className="toolbar__group toolbar__group--patch">
                <label className="field">
                    <span className="eyebrow eyebrow--sub">Patch</span>
                    <select
                        value={exampleId}
                        onChange={(event) => onExample(event.target.value)}
                        aria-label="Example patch"
                    >
                        {examples.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </label>
                <p className="toolbar__blurb">{example.blurb}</p>
            </div>

            <div className="toolbar__group">
                <button
                    type="button"
                    className={"transport" + (running ? " transport--live" : "")}
                    onClick={onToggleRun}
                    title="Run or pause the graph (r)"
                >
                    {running ? "Pause" : "Run"}
                </button>
                <button type="button" onClick={onStep} title="Execute a single step (s)">
                    Step
                </button>
                <button type="button" onClick={onFit} title="Fit the graph on screen (f)">
                    Fit
                </button>
                <button type="button" onClick={onClear} title="Remove every node">
                    Clear
                </button>
            </div>

            <div className="toolbar__group toolbar__group--right">
                <label className="field">
                    <span className="eyebrow eyebrow--sub">Theme</span>
                    <select
                        value={themeId}
                        onChange={(event) => onTheme(event.target.value)}
                        aria-label="Canvas theme"
                    >
                        {themes.map((theme) => (
                            <option key={theme.id} value={theme.id}>
                                {theme.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="field field--check" title="Render the same graph twice">
                    <input type="checkbox" checked={split} onChange={onToggleSplit} />
                    <span>Split view</span>
                </label>

                {split ? (
                    <label className="field">
                        <span className="eyebrow eyebrow--sub">Second skin</span>
                        <select
                            value={splitThemeId}
                            onChange={(event) => onSplitTheme(event.target.value)}
                            aria-label="Second canvas theme"
                        >
                            {themes.map((theme) => (
                                <option key={theme.id} value={theme.id}>
                                    {theme.label}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : null}

                <button
                    type="button"
                    className={jsonOpen ? "primary" : ""}
                    onClick={onToggleJson}
                    title="Open the serialisation drawer (j)"
                >
                    JSON
                </button>
            </div>
        </header>
    );
}
