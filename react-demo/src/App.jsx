import { useState, useCallback, useRef, useEffect } from 'react'
import { LiteGraphCanvas } from '../../src/litegraph-react.mjs'
import { LiteGraph } from '../../src/litegraph.mjs'
import '../../src/nodes/base.js'
import '../../css/litegraph.css'

function App() {
  const [count, setCount] = useState(0)
  const [theme, setTheme] = useState('dark')
  const canvasRef = useRef(null)

  const onLoad = useCallback((graph, canvas) => {
    canvasRef.current = canvas;

    // This function is called when the graph is loaded
    console.log("Graph loaded", graph, canvas);

    // Create a node
    var node_const = LiteGraph.createNode("basic/const");
    node_const.pos = [200, 200];
    graph.add(node_const);
    node_const.setValue(4.5);

    var node_watch = LiteGraph.createNode("basic/watch");
    node_watch.pos = [700, 200];
    graph.add(node_watch);

    node_const.connect(0, node_watch, 0);

    // Auto-arrange or just let it start
    graph.start();
  }, []);

  useEffect(() => {
    if (theme === 'light') {
        LiteGraph.NODE_DEFAULT_BGCOLOR = "#FFF";
        LiteGraph.NODE_DEFAULT_COLOR = "#EEE";
        LiteGraph.NODE_TITLE_COLOR = "#000";
        LiteGraph.NODE_SELECTED_TITLE_COLOR = "#000";
        LiteGraph.NODE_TEXT_COLOR = "#333";
        LiteGraph.NODE_BOX_OUTLINE_COLOR = "#000";
        LiteGraph.DEFAULT_SHADOW_COLOR = "rgba(0,0,0,0.2)";
        LiteGraph.WIDGET_BGCOLOR = "#EAEAEA";
        LiteGraph.WIDGET_OUTLINE_COLOR = "#AAA";
        LiteGraph.WIDGET_TEXT_COLOR = "#333";
        LiteGraph.LINK_COLOR = "#2a2";
        LiteGraph.EVENT_LINK_COLOR = "#A86";
        document.body.style.backgroundColor = "#FFF";
        document.body.style.color = "#333";
        if (canvasRef.current) {
            canvasRef.current.clear_background_color = "#EAEAEA";
        }
    } else {
        LiteGraph.NODE_DEFAULT_BGCOLOR = "#353535";
        LiteGraph.NODE_DEFAULT_COLOR = "#333";
        LiteGraph.NODE_TITLE_COLOR = "#999";
        LiteGraph.NODE_SELECTED_TITLE_COLOR = "#FFF";
        LiteGraph.NODE_TEXT_COLOR = "#AAA";
        LiteGraph.NODE_BOX_OUTLINE_COLOR = "#FFF";
        LiteGraph.DEFAULT_SHADOW_COLOR = "rgba(0,0,0,0.5)";
        LiteGraph.WIDGET_BGCOLOR = "#222";
        LiteGraph.WIDGET_OUTLINE_COLOR = "#666";
        LiteGraph.WIDGET_TEXT_COLOR = "#DDD";
        LiteGraph.LINK_COLOR = "#9A9";
        LiteGraph.EVENT_LINK_COLOR = "#A86";
        document.body.style.backgroundColor = "#222";
        document.body.style.color = "#DDD";
        if (canvasRef.current) {
            canvasRef.current.clear_background_color = "#222";
        }
    }

    if (canvasRef.current) {
        canvasRef.current.draw(true, true);
    }
  }, [theme]);

  return (
    <>
      <h1>LiteGraph + React</h1>
      <div className="card">
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            Toggle Theme ({theme})
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR.
        </p>
      </div>
      <div style={{ width: '800px', height: '600px', border: '1px solid #ccc', margin: 'auto' }}>
        <LiteGraphCanvas
            onLoad={onLoad}
            width={800}
            height={600}
        />
      </div>
    </>
  )
}

export default App
