"use client";

import { useState, useMemo, useCallback } from "react";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

const TYPE_COLORS: Record<string, string> = {
  PERSON: "#FF6B6B",
  ORGANIZATION: "#4ECDC4",
  LOCATION: "#45B7D1",
  EVENT: "#FFA07A",
  DATE: "#98D8C8",
  CONCEPT: "#AED6F1",
  WORK: "#F9E79F",
  QUERY: "#FF6B00",
};

const DEMO_NODES: GraphNode[] = [
  { id: "q", label: "Query", type: "QUERY", x: 400, y: 60 },
  { id: "sd", label: "Scott Derrickson", type: "PERSON", x: 200, y: 180 },
  { id: "ew", label: "Ed Wood", type: "PERSON", x: 600, y: 180 },
  { id: "us", label: "United States", type: "LOCATION", x: 400, y: 300 },
  { id: "denver", label: "Denver, CO", type: "LOCATION", x: 150, y: 320 },
  { id: "pough", label: "Poughkeepsie, NY", type: "LOCATION", x: 650, y: 320 },
  { id: "sinister", label: "Sinister (2012)", type: "WORK", x: 100, y: 200 },
  { id: "planNine", label: "Plan 9 from Outer Space", type: "WORK", x: 700, y: 200 },
  { id: "horror", label: "Horror Genre", type: "CONCEPT", x: 400, y: 420 },
];

const DEMO_EDGES: GraphEdge[] = [
  { source: "q", target: "sd", label: "FOUND" },
  { source: "q", target: "ew", label: "FOUND" },
  { source: "sd", target: "denver", label: "BORN_IN" },
  { source: "ew", target: "pough", label: "BORN_IN" },
  { source: "denver", target: "us", label: "LOCATED_IN" },
  { source: "pough", target: "us", label: "LOCATED_IN" },
  { source: "sd", target: "sinister", label: "DIRECTED" },
  { source: "ew", target: "planNine", label: "DIRECTED" },
  { source: "sinister", target: "horror", label: "GENRE" },
  { source: "planNine", target: "horror", label: "GENRE" },
];

export function GraphExplorer() {
  const [query, setQuery] = useState("Were Scott Derrickson and Ed Wood of the same nationality?");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hops, setHops] = useState(2);
  const [nodes] = useState(DEMO_NODES);
  const [edges] = useState(DEMO_EDGES);

  const nodeMap = useMemo(() => {
    const map: Record<string, GraphNode> = {};
    nodes.forEach((n) => { map[n.id] = n; });
    return map;
  }, [nodes]);

  const selectedInfo = selectedNode ? nodeMap[selectedNode] : null;

  return (
    <div>
      {/* Controls */}
      <div className="card mb-6">
        <div className="display-sm mb-4">Knowledge Graph Explorer</div>
        <p className="body-sm mb-4" style={{ color: "#6c6a64" }}>
          Visualize how GraphRAG traverses the knowledge graph to find answers.
          Click on nodes to inspect entity details.
        </p>
        <div className="flex flex-col md:flex-row gap-4">
          <input
            className="input flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a question to explore…"
          />
          <div className="flex items-center gap-3">
            <label className="caption whitespace-nowrap">
              Hops: <strong>{hops}</strong>
              <input type="range" min={1} max={4} step={1} value={hops}
                onChange={(e) => setHops(+e.target.value)}
                className="ml-2 w-20 accent-[#FF6B00]" />
            </label>
            <button className="btn btn-primary">🔍 Explore</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph Visualization */}
        <div className="card lg:col-span-2" style={{ padding: "16px", minHeight: "500px" }}>
          <svg
            viewBox="0 0 800 480"
            style={{ width: "100%", height: "100%", minHeight: "460px" }}
          >
            {/* Edges */}
            {edges.map((edge, i) => {
              const s = nodeMap[edge.source];
              const t = nodeMap[edge.target];
              if (!s || !t) return null;
              const mx = (s.x + t.x) / 2;
              const my = (s.y + t.y) / 2;
              return (
                <g key={`edge-${i}`}>
                  <line
                    x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    stroke="#e6dfd8"
                    strokeWidth={selectedNode && (edge.source === selectedNode || edge.target === selectedNode) ? 2.5 : 1.5}
                    strokeOpacity={selectedNode && edge.source !== selectedNode && edge.target !== selectedNode ? 0.3 : 0.8}
                  />
                  <text x={mx} y={my - 6} textAnchor="middle" fontSize="9" fill="#8e8b82"
                    fontFamily="var(--font-mono)">
                    {edge.label}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const color = TYPE_COLORS[node.type] || "#AED6F1";
              const isSelected = selectedNode === node.id;
              const r = isSelected ? 24 : 18;
              return (
                <g
                  key={node.id}
                  className="graph-node cursor-pointer"
                  onClick={() => setSelectedNode(isSelected ? null : node.id)}
                >
                  {/* Glow on select */}
                  {isSelected && (
                    <circle cx={node.x} cy={node.y} r={r + 8} fill={color} opacity={0.15} />
                  )}
                  <circle
                    cx={node.x} cy={node.y} r={r}
                    fill={color}
                    stroke="white" strokeWidth="2.5"
                    opacity={selectedNode && !isSelected ? 0.5 : 1}
                  />
                  <text
                    x={node.x} y={node.y + r + 14}
                    textAnchor="middle"
                    fontSize={isSelected ? "12" : "10"}
                    fontWeight={isSelected ? "600" : "400"}
                    fill="#141413"
                    fontFamily="var(--font-sans)"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Info Panel */}
        <div className="flex flex-col gap-4">
          {/* Node Details */}
          <div className="card-dark">
            <div className="caption-uppercase" style={{ color: "#a09d96" }}>Node Details</div>
            {selectedInfo ? (
              <div className="mt-3">
                <div className="title-md" style={{ color: "#faf9f5" }}>{selectedInfo.label}</div>
                <span className="badge mt-2" style={{
                  background: TYPE_COLORS[selectedInfo.type] || "#AED6F1",
                  color: "white",
                  fontSize: "0.6875rem",
                }}>
                  {selectedInfo.type}
                </span>
                <div className="body-sm mt-3" style={{ color: "#a09d96" }}>
                  Connected to {edges.filter(
                    (e) => e.source === selectedInfo.id || e.target === selectedInfo.id
                  ).length} other nodes
                </div>
                <div className="mt-3">
                  <div className="caption" style={{ color: "#a09d96" }}>Connections:</div>
                  {edges
                    .filter((e) => e.source === selectedInfo.id || e.target === selectedInfo.id)
                    .map((e, i) => {
                      const other = e.source === selectedInfo.id ? e.target : e.source;
                      return (
                        <div key={i} className="body-sm mt-1" style={{ color: "#faf9f5", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                          🔗 {e.label} → {nodeMap[other]?.label || other}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <p className="body-sm mt-3" style={{ color: "#a09d96" }}>
                Click a node on the graph to see its details.
              </p>
            )}
          </div>

          {/* Graph Stats */}
          <div className="card-cream">
            <div className="caption-uppercase mb-3">Graph Statistics</div>
            {[
              { label: "Nodes", value: nodes.length },
              { label: "Edges", value: edges.length },
              { label: "Avg Degree", value: (edges.length * 2 / nodes.length).toFixed(1) },
              { label: "Entity Types", value: new Set(nodes.map((n) => n.type)).size },
              { label: "Hops Traversed", value: hops },
            ].map((s, i) => (
              <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: i < 4 ? "1px solid var(--color-hairline-soft)" : "none" }}>
                <span className="body-sm">{s.label}</span>
                <span className="title-sm" style={{ fontFamily: "var(--font-mono)" }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="card" style={{ padding: "16px" }}>
            <div className="caption-uppercase mb-2">Entity Types</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                  <span className="body-sm">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reasoning Explanation */}
      <div className="card-cream mt-6">
        <div className="title-md mb-3">🧠 Graph Reasoning Path</div>
        <div className="prose">
          <p>
            <strong>1. Entry Points:</strong> The query identified two key entities —{" "}
            <code>Scott Derrickson</code> and <code>Ed Wood</code>.
          </p>
          <p>
            <strong>2. Traversal:</strong> Following BORN_IN relationships:
            Scott Derrickson → Denver, CO → United States;
            Ed Wood → Poughkeepsie, NY → United States.
          </p>
          <p>
            <strong>3. Evidence:</strong> Both paths converge at <code>United States</code>,
            confirming shared nationality through 2-hop graph traversal.
          </p>
          <p>
            <strong>4. Conclusion:</strong> Yes — both directors are American.
            The graph reasoning path provides explicit, traceable evidence for the answer.
          </p>
        </div>
      </div>
    </div>
  );
}
