"use client";

import { useState, useMemo } from "react";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  description?: string;
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

const SCENARIOS: {
  name: string;
  query: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  reasoning: string[];
}[] = [
  {
    name: "Nationality Comparison",
    query: "Were Scott Derrickson and Ed Wood of the same nationality?",
    nodes: [
      { id: "q", label: "Query", type: "QUERY", x: 450, y: 50, description: "Bridge question comparing two entities" },
      { id: "sd", label: "Scott Derrickson", type: "PERSON", x: 200, y: 190, description: "American filmmaker, director of Sinister (2012)" },
      { id: "ew", label: "Ed Wood", type: "PERSON", x: 700, y: 190, description: "American filmmaker, director of Plan 9 from Outer Space" },
      { id: "us", label: "United States", type: "LOCATION", x: 450, y: 340, description: "Country — shared nationality node" },
      { id: "denver", label: "Denver, CO", type: "LOCATION", x: 120, y: 340, description: "Birthplace of Scott Derrickson" },
      { id: "pough", label: "Poughkeepsie, NY", type: "LOCATION", x: 780, y: 340, description: "Birthplace of Ed Wood" },
      { id: "sinister", label: "Sinister (2012)", type: "WORK", x: 100, y: 200, description: "Horror film directed by Derrickson" },
      { id: "planNine", label: "Plan 9 from Outer Space", type: "WORK", x: 800, y: 200, description: "Cult classic by Ed Wood" },
      { id: "horror", label: "Horror Genre", type: "CONCEPT", x: 450, y: 460, description: "Shared genre concept" },
    ],
    edges: [
      { source: "q", target: "sd", label: "FOUND_ENTITY" },
      { source: "q", target: "ew", label: "FOUND_ENTITY" },
      { source: "sd", target: "denver", label: "BORN_IN" },
      { source: "ew", target: "pough", label: "BORN_IN" },
      { source: "denver", target: "us", label: "LOCATED_IN" },
      { source: "pough", target: "us", label: "LOCATED_IN" },
      { source: "sd", target: "sinister", label: "DIRECTED" },
      { source: "ew", target: "planNine", label: "DIRECTED" },
      { source: "sinister", target: "horror", label: "GENRE" },
      { source: "planNine", target: "horror", label: "GENRE" },
    ],
    reasoning: [
      "Entry: Query identifies two key entities — Scott Derrickson and Ed Wood",
      "Hop 1: BORN_IN relationships — Derrickson → Denver, CO; Wood → Poughkeepsie, NY",
      "Hop 2: LOCATED_IN traversal — Both cities → United States",
      "Convergence: Both paths meet at 'United States' node — same nationality confirmed",
    ],
  },
  {
    name: "Magazine Comparison",
    query: "Which magazine was started first, Arthur's Magazine or First for Women?",
    nodes: [
      { id: "q", label: "Query", type: "QUERY", x: 450, y: 50, description: "Comparison question — temporal ordering" },
      { id: "am", label: "Arthur's Magazine", type: "WORK", x: 220, y: 200, description: "American literary periodical" },
      { id: "fw", label: "First for Women", type: "WORK", x: 680, y: 200, description: "American women's magazine" },
      { id: "d1", label: "1844", type: "DATE", x: 220, y: 350, description: "Year Arthur's Magazine was founded" },
      { id: "d2", label: "1989", type: "DATE", x: 680, y: 350, description: "Year First for Women was founded" },
      { id: "pub", label: "Publishing", type: "CONCEPT", x: 450, y: 280, description: "Industry category" },
      { id: "usa", label: "United States", type: "LOCATION", x: 450, y: 420, description: "Country of publication" },
    ],
    edges: [
      { source: "q", target: "am", label: "FOUND_ENTITY" },
      { source: "q", target: "fw", label: "FOUND_ENTITY" },
      { source: "am", target: "d1", label: "FOUNDED_IN" },
      { source: "fw", target: "d2", label: "FOUNDED_IN" },
      { source: "am", target: "pub", label: "INDUSTRY" },
      { source: "fw", target: "pub", label: "INDUSTRY" },
      { source: "am", target: "usa", label: "PUBLISHED_IN" },
      { source: "fw", target: "usa", label: "PUBLISHED_IN" },
    ],
    reasoning: [
      "Entry: Two entities identified — Arthur's Magazine, First for Women",
      "Hop 1: FOUNDED_IN dates — Arthur's → 1844; First for Women → 1989",
      "Comparison: 1844 < 1989 — Arthur's Magazine predates by 145 years",
      "Answer: Arthur's Magazine was started first",
    ],
  },
];

export function ExplorerContent() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hops, setHops] = useState(2);

  const scenario = SCENARIOS[scenarioIdx];
  const { nodes, edges, reasoning } = scenario;

  const nodeMap = useMemo(() => {
    const map: Record<string, GraphNode> = {};
    nodes.forEach((n) => { map[n.id] = n; });
    return map;
  }, [nodes]);

  const selectedInfo = selectedNode ? nodeMap[selectedNode] : null;

  const connectedEdges = selectedNode
    ? edges.filter(e => e.source === selectedNode || e.target === selectedNode)
    : [];

  return (
    <div>
      {/* Scenario Selector */}
      <div className="card mb-6 animate-fade-in-up">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
          <div className="flex-1">
            <div className="caption-uppercase mb-2" style={{ color: "var(--color-tiger-orange)" }}>Scenario</div>
            <div className="flex gap-3">
              {SCENARIOS.map((s, i) => (
                <button
                  key={i}
                  className={`btn ${i === scenarioIdx ? "btn-primary" : "btn-secondary"} btn-sm`}
                  onClick={() => { setScenarioIdx(i); setSelectedNode(null); }}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <div className="body-md mt-3" style={{ fontStyle: "italic", color: "var(--color-muted)" }}>
              &ldquo;{scenario.query}&rdquo;
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="caption whitespace-nowrap flex items-center gap-2">
              Hops: <strong style={{ color: "var(--color-tiger-orange)", fontFamily: "var(--font-mono)" }}>{hops}</strong>
              <input type="range" min={1} max={4} step={1} value={hops}
                onChange={(e) => setHops(+e.target.value)}
                className="w-24 accent-[#FF6B00]" />
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Graph Visualization — 3 cols */}
        <div className="xl:col-span-3">
          <div className="card animate-scale-in" style={{ padding: "16px" }}>
            <svg viewBox="0 0 900 520" style={{ width: "100%", height: "100%", minHeight: "480px" }}>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#e6dfd8" />
                </marker>
              </defs>

              {/* Edges */}
              {edges.map((edge, i) => {
                const s = nodeMap[edge.source];
                const t = nodeMap[edge.target];
                if (!s || !t) return null;
                const isConnected = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
                const isHighlighted = !selectedNode || isConnected;
                const mx = (s.x + t.x) / 2;
                const my = (s.y + t.y) / 2 - 8;
                return (
                  <g key={`edge-${i}`}>
                    <line
                      x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                      stroke={isConnected ? "#FF6B00" : "#e6dfd8"}
                      strokeWidth={isConnected ? 3 : 1.5}
                      strokeOpacity={isHighlighted ? 0.85 : 0.2}
                      markerEnd={isConnected ? undefined : "url(#arrowhead)"}
                    />
                    {isHighlighted && (
                      <text x={mx} y={my} textAnchor="middle" fontSize="9" fill={isConnected ? "#FF6B00" : "#8e8b82"}
                        fontFamily="var(--font-mono)" fontWeight={isConnected ? 600 : 400}>
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const color = TYPE_COLORS[node.type] || "#AED6F1";
                const isSelected = selectedNode === node.id;
                const isConnected = connectedEdges.some(e => e.source === node.id || e.target === node.id);
                const r = isSelected ? 26 : 20;
                const dimmed = selectedNode && !isSelected && !isConnected;
                return (
                  <g
                    key={node.id}
                    className="graph-node cursor-pointer"
                    onClick={() => setSelectedNode(isSelected ? null : node.id)}
                    opacity={dimmed ? 0.3 : 1}
                  >
                    {isSelected && (
                      <>
                        <circle cx={node.x} cy={node.y} r={r + 12} fill={color} opacity={0.12} />
                        <circle cx={node.x} cy={node.y} r={r + 6} fill={color} opacity={0.08}
                          filter="url(#glow)" />
                      </>
                    )}
                    <circle
                      cx={node.x} cy={node.y} r={r}
                      fill={color}
                      stroke="white" strokeWidth="3"
                    />
                    {node.type === "QUERY" && (
                      <text x={node.x} y={node.y + 4} textAnchor="middle"
                        fontSize="14" fill="white" fontWeight="bold">?</text>
                    )}
                    <text
                      x={node.x} y={node.y + r + 16}
                      textAnchor="middle"
                      fontSize={isSelected ? "12" : "10.5"}
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
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Node Details */}
          <div className="card-dark animate-fade-in-up delay-100">
            <div className="caption-uppercase mb-3" style={{ color: "#a09d96" }}>
              {selectedInfo ? "Node Details" : "Select a Node"}
            </div>
            {selectedInfo ? (
              <div>
                <div className="title-lg" style={{ color: "#faf9f5" }}>{selectedInfo.label}</div>
                <span className="badge mt-3 inline-block" style={{
                  background: TYPE_COLORS[selectedInfo.type] || "#AED6F1",
                  color: "white", fontSize: "0.6875rem",
                }}>
                  {selectedInfo.type}
                </span>
                {selectedInfo.description && (
                  <p className="body-sm mt-3" style={{ color: "#a09d96", lineHeight: 1.6 }}>
                    {selectedInfo.description}
                  </p>
                )}
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="caption mb-2" style={{ color: "#a09d96" }}>
                    {connectedEdges.length} Connection{connectedEdges.length !== 1 ? "s" : ""}
                  </div>
                  {connectedEdges.map((e, i) => {
                    const other = e.source === selectedInfo.id ? e.target : e.source;
                    const otherNode = nodeMap[other];
                    return (
                      <div key={i} className="flex items-center gap-2 mb-2 cursor-pointer"
                        onClick={() => setSelectedNode(other)}
                        style={{ padding: "6px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.04)" }}>
                        <div className="w-2.5 h-2.5 rounded-full" style={{
                          background: TYPE_COLORS[otherNode?.type ?? ""] || "#AED6F1",
                        }} />
                        <span style={{ color: "#faf9f5", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                          {e.label}
                        </span>
                        <span style={{ color: "#a09d96", fontSize: "0.75rem" }}>→</span>
                        <span style={{ color: "#faf9f5", fontSize: "0.8125rem" }}>
                          {otherNode?.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="body-sm" style={{ color: "#a09d96" }}>
                Click any node on the graph to see its details, connections, and type information.
              </p>
            )}
          </div>

          {/* Graph Stats */}
          <div className="card-cream animate-fade-in-up delay-200">
            <div className="caption-uppercase mb-3">Graph Statistics</div>
            {[
              { label: "Nodes", value: nodes.length, color: "#FF6B00" },
              { label: "Edges", value: edges.length, color: "#0072CE" },
              { label: "Avg Degree", value: (edges.length * 2 / nodes.length).toFixed(1), color: "#5db8a6" },
              { label: "Entity Types", value: new Set(nodes.map(n => n.type)).size, color: "#cc785c" },
              { label: "Hops", value: hops, color: "#002B49" },
            ].map((s, i) => (
              <div key={i} className="flex justify-between items-center py-2.5"
                style={{ borderBottom: i < 4 ? "1px solid var(--color-hairline-soft)" : "none" }}>
                <span className="body-sm">{s.label}</span>
                <span className="title-sm" style={{ fontFamily: "var(--font-mono)", color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="card animate-fade-in-up delay-300" style={{ padding: "20px" }}>
            <div className="caption-uppercase mb-3">Entity Types</div>
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

      {/* Reasoning Steps */}
      <div className="card mt-8 animate-fade-in-up delay-400">
        <div className="title-lg mb-6">🧠 Graph Reasoning Path</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reasoning.map((step, i) => (
            <div key={i} className="card-cream" style={{ padding: "20px", position: "relative" }}>
              <div style={{
                position: "absolute", top: "12px", right: "12px",
                fontFamily: "var(--font-mono)", fontSize: "0.6875rem",
                color: "var(--color-tiger-orange)", fontWeight: 600,
              }}>
                Step {i + 1}
              </div>
              <p className="body-sm" style={{ color: "var(--color-body)", lineHeight: 1.6 }}>
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
