import { useState, useCallback } from 'react'
import { LiteGraphCanvas } from '../../src/litegraph-react.js'
import * as LiteGraphModule from '../../src/litegraph.js'
import '../../src/nodes/base.js'
import '../../css/litegraph.css'

function App() {
  const [count, setCount] = useState(0)

  const onLoad = useCallback((graph, canvas) => {
    // Attempt to get LiteGraph from module exports or global scope
    const LiteGraph = LiteGraphModule.LiteGraph || window.LiteGraph;

    // This function is called when the graph is loaded
    console.log("Graph loaded", graph, canvas);

    if(!LiteGraph) {
        console.error("LiteGraph not found");
        return;
    }

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

  return (
    <>
      <h1>LiteGraph + React</h1>
      <div className="card">
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
