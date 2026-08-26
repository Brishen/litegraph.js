import { useState, useCallback, useEffect } from 'react'
import { LiteGraphCanvas, LiteGraphThemeProvider } from '../../src/litegraph-react.mjs'
import { LiteGraph } from '../../src/litegraph.mjs'
import '../../src/nodes/base.js'
import '../../css/litegraph.css'

// Themes are plain objects handed to a canvas as a prop. Nothing here mutates the
// LiteGraph globals, so two canvases can be themed differently at the same time.
const DARK = {
  NODE_DEFAULT_BGCOLOR: '#353535',
  NODE_DEFAULT_COLOR: '#333',
  NODE_TITLE_COLOR: '#999',
  NODE_SELECTED_TITLE_COLOR: '#FFF',
  NODE_TEXT_COLOR: '#AAA',
  NODE_BOX_OUTLINE_COLOR: '#FFF',
  DEFAULT_SHADOW_COLOR: 'rgba(0,0,0,0.5)',
  WIDGET_BGCOLOR: '#222',
  WIDGET_OUTLINE_COLOR: '#666',
  WIDGET_TEXT_COLOR: '#DDD',
  LINK_COLOR: '#9A9',
  EVENT_LINK_COLOR: '#A86',
  CANVAS_BACKGROUND_COLOR: '#222',
}

const LIGHT = {
  NODE_DEFAULT_BGCOLOR: '#FFF',
  NODE_DEFAULT_COLOR: '#EEE',
  NODE_TITLE_COLOR: '#000',
  NODE_SELECTED_TITLE_COLOR: '#000',
  NODE_TEXT_COLOR: '#333',
  NODE_BOX_OUTLINE_COLOR: '#000',
  DEFAULT_SHADOW_COLOR: 'rgba(0,0,0,0.2)',
  WIDGET_BGCOLOR: '#EAEAEA',
  WIDGET_OUTLINE_COLOR: '#AAA',
  WIDGET_TEXT_COLOR: '#333',
  LINK_COLOR: '#2a2',
  EVENT_LINK_COLOR: '#A86',
  CANVAS_BACKGROUND_COLOR: '#EAEAEA',
}

const SOLARIZED = {
  NODE_DEFAULT_BGCOLOR: '#073642',
  NODE_DEFAULT_COLOR: '#002b36',
  NODE_TITLE_COLOR: '#93a1a1',
  NODE_TEXT_COLOR: '#eee8d5',
  WIDGET_BGCOLOR: '#002b36',
  WIDGET_TEXT_COLOR: '#eee8d5',
  LINK_COLOR: '#b58900',
  CANVAS_BACKGROUND_COLOR: '#002b36',
}

function buildSampleGraph(graph) {
  const node_const = LiteGraph.createNode('basic/const')
  node_const.pos = [80, 100]
  graph.add(node_const)
  node_const.setValue(4.5)

  const node_watch = LiteGraph.createNode('basic/watch')
  node_watch.pos = [340, 100]
  graph.add(node_watch)

  node_const.connect(0, node_watch, 0)
}

function App() {
  const [theme, setTheme] = useState('dark')
  const activeTheme = theme === 'dark' ? DARK : LIGHT

  const onLoad = useCallback((graph) => {
    buildSampleGraph(graph)
    graph.start()
  }, [])

  // Page chrome only - the graph itself is themed through the prop above.
  useEffect(() => {
    document.body.style.backgroundColor = theme === 'dark' ? '#222' : '#FFF'
    document.body.style.color = theme === 'dark' ? '#DDD' : '#333'
  }, [theme])

  return (
    <>
      <h1>LiteGraph + React</h1>
      <div className="card">
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          Toggle theme ({theme})
        </button>
        <p>
          Both canvases are mounted at once. Toggling only re-themes the left one -
          proof that theming is per-instance and no longer a global mutation.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <figure style={{ margin: 0 }}>
          <figcaption>theme prop: {theme}</figcaption>
          <div style={{ width: '520px', height: '380px', border: '1px solid #888' }}>
            <LiteGraphCanvas onLoad={onLoad} theme={activeTheme} width={520} height={380} />
          </div>
        </figure>

        <figure style={{ margin: 0 }}>
          <figcaption>theme from provider: solarized (fixed)</figcaption>
          <LiteGraphThemeProvider theme={SOLARIZED}>
            <div style={{ width: '520px', height: '380px', border: '1px solid #888' }}>
              <LiteGraphCanvas onLoad={onLoad} width={520} height={380} />
            </div>
          </LiteGraphThemeProvider>
        </figure>
      </div>
    </>
  )
}

export default App
