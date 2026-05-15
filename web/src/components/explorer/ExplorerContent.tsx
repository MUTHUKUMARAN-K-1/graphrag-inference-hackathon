"use client";

import { useState, useMemo, useCallback } from "react";

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

interface Scenario {
  name: string;
  query: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  reasoning: string[];
}

const TYPE_COLORS: Record<string, string> = {
  PERSON:       "#FF6B6B",
  ORGANIZATION: "#4ECDC4",
  LOCATION:     "#45B7D1",
  MOLECULE:     "#A29BFE",
  ORGANELLE:    "#55EFC4",
  CONCEPT:      "#AED6F1",
  PROCESS:      "#F9CA24",
  CONSTANT:     "#FD79A8",
  ELEMENT:      "#74B9FF",
  QUERY:        "#FF6B00",
};

// ── 4 Science Scenarios ────────────────────────────────────────────────────
const SCENARIOS: Scenario[] = [
  {
    name: "General Relativity",
    query: "How does General Relativity predict gravitational waves?",
    nodes: [
      { id: "q",          label: "Query",              type: "QUERY",        x: 450, y: 260, description: "Entry point — identify key entities and traverse the graph" },
      { id: "einstein",   label: "Albert Einstein",    type: "PERSON",       x: 200, y: 120, description: "Theoretical physicist; developed General Relativity (1915)" },
      { id: "gr",         label: "General Relativity", type: "CONCEPT",      x: 680, y: 120, description: "Geometric theory of gravitation; gravity = spacetime curvature" },
      { id: "spacetime",  label: "Spacetime Curvature",type: "CONCEPT",      x: 450, y: 90,  description: "4D manifold warped by mass and energy — the mechanism of gravity" },
      { id: "grav_waves", label: "Gravitational Waves",type: "CONCEPT",      x: 790, y: 270, description: "Ripples in spacetime produced by accelerating masses; predicted 1916" },
      { id: "black_holes",label: "Black Holes",        type: "CONCEPT",      x: 700, y: 420, description: "Regions where spacetime curvature prevents light escape; GR prediction" },
      { id: "ligo",       label: "LIGO Detector",      type: "ORGANIZATION", x: 450, y: 440, description: "Detected gravitational waves 14 Sep 2015 — confirmed GR's prediction" },
      { id: "eddington",  label: "Eddington (1919)",   type: "PERSON",       x: 160, y: 320, description: "Observed light bending around the Sun during 1919 eclipse — first GR proof" },
      { id: "gps",        label: "GPS Satellites",     type: "CONCEPT",      x: 160, y: 430, description: "Require GR time-dilation corrections; practical proof of the theory" },
    ],
    edges: [
      { source: "q",          target: "einstein",   label: "FOUND_ENTITY" },
      { source: "q",          target: "gr",         label: "FOUND_ENTITY" },
      { source: "einstein",   target: "gr",         label: "DEVELOPED_1915" },
      { source: "einstein",   target: "spacetime",  label: "PROPOSED" },
      { source: "gr",         target: "spacetime",  label: "DESCRIBES" },
      { source: "gr",         target: "grav_waves", label: "PREDICTS" },
      { source: "gr",         target: "black_holes",label: "PREDICTS" },
      { source: "grav_waves", target: "ligo",       label: "DETECTED_BY" },
      { source: "eddington",  target: "gr",         label: "CONFIRMED_1919" },
      { source: "gr",         target: "gps",        label: "CORRECTION_REQUIRED_BY" },
    ],
    reasoning: [
      "Entry: Query identifies Einstein and General Relativity as key entities",
      "Hop 1: DEVELOPED_1915 → Einstein proposed spacetime curvature as gravity",
      "Hop 2: PREDICTS edges → GR implies gravitational waves and black holes",
      "Hop 3: DETECTED_BY → LIGO confirmed waves 100 years after prediction",
    ],
  },
  {
    name: "DNA → Protein",
    query: "How does DNA encode and produce proteins?",
    nodes: [
      { id: "q",            label: "Query",           type: "QUERY",    x: 450, y: 260, description: "Multi-hop biology question — trace the central dogma pathway" },
      { id: "dna",          label: "DNA",             type: "MOLECULE", x: 200, y: 130, description: "Double-helix polymer; stores genetic instructions via A-T-G-C base pairs" },
      { id: "rna",          label: "mRNA",            type: "MOLECULE", x: 700, y: 130, description: "Messenger RNA; transcribed copy of a gene, carries code to ribosome" },
      { id: "protein",      label: "Protein",         type: "MOLECULE", x: 450, y: 420, description: "Amino-acid chain folded into functional shape; performs cellular work" },
      { id: "watson_crick", label: "Watson & Crick",  type: "PERSON",   x: 80,  y: 200, description: "Determined DNA double-helix structure (1953) using Franklin's X-ray data" },
      { id: "helicase",     label: "Helicase",        type: "MOLECULE", x: 200, y: 370, description: "Enzyme that unwinds the DNA double helix during replication/transcription" },
      { id: "ribosome",     label: "Ribosome",        type: "ORGANELLE",x: 700, y: 370, description: "Molecular machine that reads mRNA codons and assembles amino acids into protein" },
      { id: "nucleus",      label: "Cell Nucleus",    type: "ORGANELLE",x: 200, y: 260, description: "DNA is stored here; transcription (DNA→mRNA) occurs inside" },
      { id: "central_dogma",label: "Central Dogma",   type: "CONCEPT",  x: 450, y: 110, description: "Information flow: DNA → RNA → Protein (Crick, 1958)" },
    ],
    edges: [
      { source: "q",            target: "dna",           label: "FOUND_ENTITY" },
      { source: "q",            target: "protein",       label: "FOUND_ENTITY" },
      { source: "watson_crick", target: "dna",           label: "DISCOVERED_1953" },
      { source: "dna",          target: "central_dogma", label: "DESCRIBED_BY" },
      { source: "dna",          target: "nucleus",       label: "LOCATED_IN" },
      { source: "helicase",     target: "dna",           label: "UNWINDS" },
      { source: "dna",          target: "rna",           label: "TRANSCRIBED_TO" },
      { source: "rna",          target: "ribosome",      label: "READ_BY" },
      { source: "ribosome",     target: "protein",       label: "PRODUCES" },
      { source: "central_dogma",target: "rna",           label: "INCLUDES" },
    ],
    reasoning: [
      "Entry: Two key entities — DNA (information store) and Protein (output)",
      "Hop 1: TRANSCRIBED_TO — DNA → mRNA; helicase unwinds the double helix",
      "Hop 2: READ_BY — mRNA travels to ribosome in the cytoplasm",
      "Hop 3: PRODUCES — Ribosome assembles amino acids into the final protein",
    ],
  },
  {
    name: "Photosynthesis",
    query: "What converts sunlight to glucose in plants?",
    nodes: [
      { id: "q",            label: "Query",           type: "QUERY",   x: 450, y: 260, description: "Factoid + multi-hop: identify the process and trace its pathway" },
      { id: "photosynthesis",label:"Photosynthesis",  type: "PROCESS", x: 450, y: 110, description: "Converts light energy + CO₂ + H₂O → glucose + O₂; primary energy source for life" },
      { id: "chlorophyll",  label: "Chlorophyll",     type: "MOLECULE",x: 200, y: 140, description: "Green pigment in chloroplasts; absorbs red (~680 nm) and blue (~430 nm) light" },
      { id: "light",        label: "Light Energy",    type: "CONCEPT", x: 80,  y: 260, description: "Solar radiation — the energy input that drives the entire process" },
      { id: "calvin_cycle", label: "Calvin Cycle",    type: "PROCESS", x: 720, y: 190, description: "Light-independent reactions in stroma; uses ATP + NADPH to fix CO₂ into glucose" },
      { id: "glucose",      label: "Glucose (C₆H₁₂O₆)",type:"MOLECULE",x:720, y: 370, description: "6-carbon sugar; stores chemical energy for the plant and food chain" },
      { id: "co2",          label: "CO₂",             type: "MOLECULE",x: 450, y: 430, description: "Carbon dioxide; fixed by RuBisCO enzyme in the Calvin Cycle" },
      { id: "water",        label: "H₂O",             type: "MOLECULE",x: 200, y: 370, description: "Split by photolysis in thylakoids; provides electrons and releases O₂" },
      { id: "oxygen",       label: "O₂ (byproduct)",  type: "MOLECULE",x: 80,  y: 400, description: "Released during photolysis of water — the origin of Earth's atmospheric oxygen" },
      { id: "thylakoid",    label: "Thylakoid",       type: "ORGANELLE",x:350, y: 370, description: "Membrane system inside chloroplast; site of light-dependent reactions" },
    ],
    edges: [
      { source: "q",             target: "photosynthesis",label: "FOUND_ENTITY" },
      { source: "q",             target: "chlorophyll",   label: "FOUND_ENTITY" },
      { source: "light",         target: "chlorophyll",   label: "ABSORBED_BY" },
      { source: "chlorophyll",   target: "photosynthesis",label: "DRIVES" },
      { source: "water",         target: "photosynthesis",label: "INPUT" },
      { source: "water",         target: "oxygen",        label: "PHOTOLYSIS_PRODUCES" },
      { source: "co2",           target: "calvin_cycle",  label: "FIXED_BY" },
      { source: "photosynthesis",target: "calvin_cycle",  label: "INCLUDES" },
      { source: "calvin_cycle",  target: "glucose",       label: "PRODUCES" },
      { source: "thylakoid",     target: "photosynthesis",label: "LOCATION_OF" },
    ],
    reasoning: [
      "Entry: Photosynthesis and Chlorophyll identified as primary entities",
      "Hop 1: ABSORBED_BY — light energy absorbed by chlorophyll in thylakoids",
      "Hop 2: INCLUDES — photosynthesis triggers Calvin Cycle with CO₂ as input",
      "Hop 3: PRODUCES — Calvin Cycle outputs glucose; water photolysis releases O₂",
    ],
  },
  {
    name: "Quantum Mechanics Founders",
    query: "Which physicists developed quantum mechanics and what did each contribute?",
    nodes: [
      { id: "q",           label: "Query",                type: "QUERY",   x: 450, y: 260, description: "Multi-hop comparison — identify multiple entities and their relationships" },
      { id: "qm",          label: "Quantum Mechanics",    type: "CONCEPT", x: 450, y: 110, description: "Physics of matter at atomic/subatomic scales; emerged from failures of classical physics" },
      { id: "bohr",        label: "Niels Bohr",           type: "PERSON",  x: 180, y: 150, description: "Proposed quantized electron orbits (1913 Bohr model); founded Copenhagen interpretation" },
      { id: "heisenberg",  label: "Heisenberg",           type: "PERSON",  x: 720, y: 150, description: "Formulated matrix mechanics (1925) and the uncertainty principle (1927)" },
      { id: "schrodinger", label: "Schrödinger",          type: "PERSON",  x: 180, y: 380, description: "Developed wave mechanics (1926); wave function ψ describes quantum state" },
      { id: "planck",      label: "Max Planck",           type: "PERSON",  x: 720, y: 380, description: "Introduced energy quanta E=hf (1900) to explain blackbody radiation — started QM" },
      { id: "uncertainty", label: "Uncertainty Principle",type: "CONCEPT", x: 820, y: 260, description: "ΔxΔp ≥ ℏ/2 — position and momentum cannot both be precisely known simultaneously" },
      { id: "wave_fn",     label: "Wave Function ψ",      type: "CONCEPT", x: 80,  y: 260, description: "Mathematical description of quantum state; |ψ|² gives probability density" },
      { id: "atom_model",  label: "Bohr Atom Model",      type: "CONCEPT", x: 80,  y: 110, description: "Quantized electron energy levels; explained hydrogen emission spectrum (1913)" },
      { id: "photoelectric",label:"Photoelectric Effect", type: "CONCEPT", x: 820, y: 110, description: "Light ejects electrons from metal — explained by Einstein (1905), uses Planck's quanta" },
    ],
    edges: [
      { source: "q",           target: "qm",           label: "FOUND_ENTITY" },
      { source: "q",           target: "bohr",         label: "FOUND_ENTITY" },
      { source: "planck",      target: "qm",           label: "FOUNDED_1900" },
      { source: "bohr",        target: "qm",           label: "DEVELOPED" },
      { source: "heisenberg",  target: "qm",           label: "DEVELOPED" },
      { source: "schrodinger", target: "qm",           label: "DEVELOPED" },
      { source: "heisenberg",  target: "uncertainty",  label: "FORMULATED_1927" },
      { source: "schrodinger", target: "wave_fn",      label: "PROPOSED_1926" },
      { source: "bohr",        target: "atom_model",   label: "PROPOSED_1913" },
      { source: "planck",      target: "photoelectric", label: "QUANTA_EXPLAIN" },
    ],
    reasoning: [
      "Entry: Quantum Mechanics identified; four physicist entities extracted",
      "Hop 1: FOUNDED/DEVELOPED edges — Planck, Bohr, Heisenberg, Schrödinger each contributed",
      "Hop 2: Specific contributions — Uncertainty Principle, Wave Function, Bohr Atom",
      "Convergence: All four paths meet at Quantum Mechanics — multi-founder answer confirmed",
    ],
  },
];

// ── BFS hop reachability ───────────────────────────────────────────────────
function computeReachability(
  nodes: GraphNode[],
  edges: GraphEdge[],
  maxHops: number,
): Map<string, number> {
  const queryNode = nodes.find(n => n.type === "QUERY");
  if (!queryNode) return new Map(nodes.map(n => [n.id, 0]));

  const depths = new Map<string, number>();
  const queue: { id: string; depth: number }[] = [{ id: queryNode.id, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depths.has(id)) continue;
    depths.set(id, depth);
    if (depth < maxHops) {
      for (const e of edges) {
        if (e.source === id && !depths.has(e.target)) queue.push({ id: e.target, depth: depth + 1 });
        if (e.target === id && !depths.has(e.source)) queue.push({ id: e.source, depth: depth + 1 });
      }
    }
  }
  return depths;
}

// ── Live query state ───────────────────────────────────────────────────────
interface LiveNode { id: string; label: string; x: number; y: number; hop: number }
interface LiveEdge { source: string; target: string }

function buildLiveGraph(entities: string[], query: string): { nodes: LiveNode[]; edges: LiveEdge[] } {
  const cx = 450, cy = 240;
  const nodes: LiveNode[] = [{ id: "q", label: query.slice(0, 32) + "…", x: cx, y: cy, hop: 0 }];
  const edges: LiveEdge[] = [];
  const r = 170;

  entities.slice(0, 8).forEach((e, i) => {
    const angle = (2 * Math.PI * i) / Math.min(entities.length, 8) - Math.PI / 2;
    // Extract name only (before ": ") from "EntityName: description" format
    const label = e.includes(": ") ? e.split(": ")[0].trim() : e.slice(0, 28);
    nodes.push({
      id: `e${i}`,
      label,
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
      hop: 1,
    });
    edges.push({ source: "q", target: `e${i}` });
  });
  return { nodes, edges };
}

export function ExplorerContent() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hops, setHops] = useState(3);

  // Live query state
  const [liveQuery, setLiveQuery] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveGraph, setLiveGraph] = useState<{ nodes: LiveNode[]; edges: LiveEdge[] } | null>(null);
  const [liveError, setLiveError] = useState("");

  const scenario = SCENARIOS[scenarioIdx];
  const { nodes, edges, reasoning } = scenario;

  // BFS hop filter — what actually changes when the slider moves
  const reachabilityMap = useMemo(
    () => computeReachability(nodes, edges, hops),
    [nodes, edges, hops],
  );
  const visibleNodes = useMemo(() => nodes.filter(n => reachabilityMap.has(n.id)), [nodes, reachabilityMap]);
  const visibleEdges = useMemo(
    () => edges.filter(e => reachabilityMap.has(e.source) && reachabilityMap.has(e.target)),
    [edges, reachabilityMap],
  );

  const nodeMap = useMemo(() => {
    const m: Record<string, GraphNode> = {};
    nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [nodes]);

  const selectedInfo = selectedNode ? nodeMap[selectedNode] : null;
  const selectedDepth = selectedNode ? reachabilityMap.get(selectedNode) : undefined;
  const connectedEdges = selectedNode
    ? visibleEdges.filter(e => e.source === selectedNode || e.target === selectedNode)
    : [];

  const [liveAnswer, setLiveAnswer] = useState<string | null>(null);

  const runLiveQuery = useCallback(async () => {
    if (!liveQuery.trim()) return;
    setLiveLoading(true);
    setLiveError("");
    setLiveGraph(null);
    setLiveAnswer(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: liveQuery, provider: "openai", topK: 8 }),
      });
      const data = await res.json();
      const entities: string[] = data.graphrag?.entities ?? [];
      const answer: string = data.graphrag?.answer ?? "";
      if (entities.length === 0) {
        setLiveAnswer(answer || null);
        setLiveError(
          "No graph entities found for this query — the Wikipedia science corpus covers physics, biology, " +
          "chemistry, and astronomy. Try one of the example questions below."
        );
      } else {
        setLiveGraph(buildLiveGraph(entities, liveQuery));
      }
    } catch {
      setLiveError("Request failed — check that the dev server is running and OPENAI_API_KEY is set in web/.env.");
    }
    setLiveLoading(false);
  }, [liveQuery]);

  return (
    <div>
      {/* Scenario Selector */}
      <div className="card mb-6 animate-fade-in-up">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
          <div className="flex-1">
            <div className="caption-uppercase mb-2" style={{ color: "var(--color-tiger-orange)" }}>Scenario</div>
            <div className="flex flex-wrap gap-2">
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
              Hops:
              <strong style={{ color: "var(--color-tiger-orange)", fontFamily: "var(--font-mono)", minWidth: "1ch" }}>{hops}</strong>
              <input
                type="range" min={1} max={4} step={1} value={hops}
                onChange={e => { setHops(+e.target.value); setSelectedNode(null); }}
                className="w-24 accent-[#FF6B00]"
              />
            </label>
            <span className="badge-outline" style={{ fontSize: "0.6875rem" }}>
              {visibleNodes.length}/{nodes.length} nodes · {visibleEdges.length}/{edges.length} edges
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Graph SVG — 3 cols */}
        <div className="xl:col-span-3">
          <div className="card animate-scale-in" style={{ padding: "16px" }}>
            <svg viewBox="0 0 900 520" style={{ width: "100%", minHeight: "480px" }}>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#c8c3bb" />
                </marker>
                <marker id="arrow-hot" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#FF6B00" />
                </marker>
              </defs>

              {/* Dimmed nodes that are hidden by hop filter */}
              {nodes.filter(n => !reachabilityMap.has(n.id)).map(node => (
                <circle key={`dim-${node.id}`} cx={node.x} cy={node.y} r={18}
                  fill={TYPE_COLORS[node.type] || "#AED6F1"} opacity={0.08} />
              ))}

              {/* Edges */}
              {visibleEdges.map((edge, i) => {
                const s = nodeMap[edge.source];
                const t = nodeMap[edge.target];
                if (!s || !t) return null;
                const isConnected = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
                const dimmed = selectedNode && !isConnected;
                const mx = (s.x + t.x) / 2;
                const my = (s.y + t.y) / 2 - 10;
                const dx = t.x - s.x, dy = t.y - s.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const sR = s.type === "QUERY" ? 26 : 20;
                const tR = t.type === "QUERY" ? 26 : 20;
                const x1e = s.x + (dx / dist) * sR;
                const y1e = s.y + (dy / dist) * sR;
                const x2e = t.x - (dx / dist) * (tR + 5);
                const y2e = t.y - (dy / dist) * (tR + 5);
                return (
                  <g key={`edge-${i}`} opacity={dimmed ? 0.12 : 1}>
                    <line
                      x1={x1e} y1={y1e} x2={x2e} y2={y2e}
                      stroke={isConnected ? "#FF6B00" : "#d1cdc5"}
                      strokeWidth={isConnected ? 2.5 : 1.5}
                      markerEnd={isConnected ? "url(#arrow-hot)" : "url(#arrow)"}
                    />
                    <text x={mx} y={my} textAnchor="middle" fontSize="8.5"
                      fill={isConnected ? "#FF6B00" : "#9e9990"}
                      fontFamily="var(--font-mono)" fontWeight={isConnected ? 600 : 400}>
                      {edge.label}
                    </text>
                  </g>
                );
              })}

              {/* Nodes */}
              {visibleNodes.map(node => {
                const color = TYPE_COLORS[node.type] || "#AED6F1";
                const isSelected = selectedNode === node.id;
                const isConnected = connectedEdges.some(e => e.source === node.id || e.target === node.id);
                const dimmed = selectedNode && !isSelected && !isConnected;
                const depth = reachabilityMap.get(node.id) ?? 0;
                const r = node.type === "QUERY" ? 26 : isSelected ? 24 : 20;

                return (
                  <g
                    key={node.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedNode(isSelected ? null : node.id)}
                    opacity={dimmed ? 0.18 : 1}
                  >
                    {/* Glow rings for selected */}
                    {isSelected && (
                      <>
                        <circle cx={node.x} cy={node.y} r={r + 14} fill={color} opacity={0.10} />
                        <circle cx={node.x} cy={node.y} r={r + 7}  fill={color} opacity={0.15} filter="url(#glow)" />
                      </>
                    )}
                    <circle
                      cx={node.x} cy={node.y} r={r}
                      fill={color}
                      stroke={isSelected ? "white" : "rgba(255,255,255,0.7)"}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    {/* Hop depth badge (small dot in top-right of node) */}
                    {depth > 0 && (
                      <text x={node.x + r - 2} y={node.y - r + 6}
                        textAnchor="middle" fontSize="8" fill="white"
                        fontFamily="var(--font-mono)" fontWeight="700">
                        {depth}
                      </text>
                    )}
                    {node.type === "QUERY" && (
                      <text x={node.x} y={node.y + 5} textAnchor="middle"
                        fontSize="15" fill="white" fontWeight="bold">?</text>
                    )}
                    <text
                      x={node.x} y={node.y + r + 15}
                      textAnchor="middle"
                      fontSize={isSelected ? "11.5" : "10"}
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
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="badge" style={{
                    background: TYPE_COLORS[selectedInfo.type] || "#AED6F1",
                    color: "white", fontSize: "0.6875rem",
                  }}>
                    {selectedInfo.type}
                  </span>
                  {selectedDepth !== undefined && (
                    <span className="badge-outline" style={{ fontSize: "0.6875rem" }}>
                      Hop {selectedDepth} from query
                    </span>
                  )}
                </div>
                {selectedInfo.description && (
                  <p className="body-sm mt-3" style={{ color: "#a09d96", lineHeight: 1.6 }}>
                    {selectedInfo.description}
                  </p>
                )}
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="caption mb-2" style={{ color: "#a09d96" }}>
                    {connectedEdges.length} visible connection{connectedEdges.length !== 1 ? "s" : ""}
                  </div>
                  {connectedEdges.map((e, i) => {
                    const otherId = e.source === selectedInfo.id ? e.target : e.source;
                    const otherNode = nodeMap[otherId];
                    const dir = e.source === selectedInfo.id ? "→" : "←";
                    return (
                      <div key={i} className="flex items-center gap-2 mb-2"
                        style={{
                          padding: "6px 10px", borderRadius: "8px",
                          background: "rgba(255,255,255,0.04)", cursor: "pointer",
                        }}
                        onClick={() => setSelectedNode(otherId)}>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{
                          background: TYPE_COLORS[otherNode?.type ?? ""] || "#AED6F1",
                        }} />
                        <span style={{ color: "#FF6B00", fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
                          {dir} {e.label}
                        </span>
                        <span style={{ color: "#faf9f5", fontSize: "0.8rem" }}>
                          {otherNode?.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="body-sm" style={{ color: "#a09d96" }}>
                Click any visible node to inspect its entity type, hop distance from the query, and connections.
                Use the hops slider to see the graph expand step by step.
              </p>
            )}
          </div>

          {/* Graph Stats */}
          <div className="card-cream animate-fade-in-up delay-200">
            <div className="caption-uppercase mb-3">Graph Statistics</div>
            {[
              { label: "Visible Nodes", value: `${visibleNodes.length} / ${nodes.length}`, color: "#FF6B00" },
              { label: "Visible Edges", value: `${visibleEdges.length} / ${edges.length}`, color: "#0072CE" },
              { label: "Max Hops", value: hops, color: "#5db8a6" },
              { label: "Avg Degree", value: visibleNodes.length > 0 ? (visibleEdges.length * 2 / visibleNodes.length).toFixed(1) : "0", color: "#cc785c" },
              { label: "Entity Types", value: new Set(visibleNodes.map(n => n.type)).size, color: "#002B49" },
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
            <p className="body-sm mt-3" style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>
              Small number on each node = hop distance from query node.
            </p>
          </div>
        </div>
      </div>

      {/* Reasoning Steps */}
      <div className="card mt-8 animate-fade-in-up delay-400">
        <div className="title-lg mb-6">🧠 Graph Reasoning Path</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reasoning.map((step, i) => {
            const active = i < hops;
            return (
              <div key={i} className={active ? "card" : "card"} style={{
                padding: "20px", position: "relative",
                opacity: active ? 1 : 0.38,
                borderLeft: active ? `3px solid var(--color-tiger-orange)` : undefined,
                transition: "opacity 0.25s ease",
              }}>
                <div style={{
                  position: "absolute", top: "12px", right: "12px",
                  fontFamily: "var(--font-mono)", fontSize: "0.6875rem",
                  color: active ? "var(--color-tiger-orange)" : "var(--color-muted)", fontWeight: 600,
                }}>
                  Step {i + 1}
                </div>
                <p className="body-sm" style={{ color: "var(--color-body)", lineHeight: 1.6 }}>
                  {step}
                </p>
              </div>
            );
          })}
        </div>
        <p className="body-sm mt-4" style={{ color: "var(--color-muted)", fontStyle: "italic" }}>
          Steps highlight based on the current hop depth. Drag the slider above to walk through the reasoning.
        </p>
      </div>

      {/* Live Query Section */}
      <div className="card mt-8 animate-fade-in-up">
        <div className="title-lg mb-2">🔴 Live Entity Query</div>
        <p className="body-sm mb-4" style={{ color: "var(--color-muted)" }}>
          Ask a <strong>science</strong> question — GraphRAG retrieves entities from TigerGraph and renders them
          as a live graph. Corpus covers physics, biology, chemistry, and astronomy.
        </p>

        {/* Example chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            "How do black holes form?",
            "What is CRISPR and how does it edit DNA?",
            "How does photosynthesis produce oxygen?",
            "What causes quantum entanglement?",
            "How does the immune system fight viruses?",
          ].map(q => (
            <button
              key={q}
              onClick={() => setLiveQuery(q)}
              className="badge-outline"
              style={{ cursor: "pointer", fontSize: "0.75rem", border: "none" }}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex gap-3 mb-5">
          <input
            className="input flex-1"
            placeholder="e.g. How does DNA encode proteins?"
            value={liveQuery}
            onChange={e => setLiveQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") runLiveQuery(); }}
          />
          <button className="btn btn-primary" onClick={runLiveQuery}
            disabled={liveLoading || !liveQuery.trim()}>
            {liveLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Querying…
              </span>
            ) : "Run Live"}
          </button>
        </div>

        {liveError && (
          <div className="card-cream mb-4" style={{ padding: "12px 16px", borderLeft: "3px solid #e17055" }}>
            <span className="body-sm" style={{ color: "#d63031" }}>{liveError}</span>
          </div>
        )}

        {liveAnswer && !liveGraph && (
          <div className="card-cream mb-4" style={{ padding: "16px", borderLeft: "3px solid #0072CE" }}>
            <div className="caption-uppercase mb-2" style={{ color: "#0072CE" }}>GraphRAG Answer</div>
            <p className="body-sm" style={{ lineHeight: 1.65, color: "var(--color-body)" }}>{liveAnswer}</p>
          </div>
        )}

        {liveGraph && (
          <div>
            <div className="caption mb-3" style={{ color: "var(--color-muted)" }}>
              {liveGraph.nodes.length - 1} entities retrieved from TigerGraph — star topology (query → entities, hop 1)
            </div>
            <div className="card" style={{ padding: "16px" }}>
              <svg viewBox="0 0 900 500" style={{ width: "100%", minHeight: "400px" }}>
                <defs>
                  <marker id="arrow-live" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#FF6B00" />
                  </marker>
                </defs>
                {liveGraph.edges.map((e, i) => {
                  const s = liveGraph.nodes.find(n => n.id === e.source);
                  const t = liveGraph.nodes.find(n => n.id === e.target);
                  if (!s || !t) return null;
                  const ldx = t.x - s.x, ldy = t.y - s.y;
                  const ldist = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
                  const lsR = s.id === "q" ? 26 : 20;
                  const ltR = t.id === "q" ? 26 : 20;
                  return (
                    <line key={i}
                      x1={s.x + (ldx / ldist) * lsR} y1={s.y + (ldy / ldist) * lsR}
                      x2={t.x - (ldx / ldist) * (ltR + 5)} y2={t.y - (ldy / ldist) * (ltR + 5)}
                      stroke="#FF6B00" strokeWidth="1.5" strokeOpacity={0.5}
                      markerEnd="url(#arrow-live)" />
                  );
                })}
                {liveGraph.nodes.map((node, i) => {
                  const isQuery = node.id === "q";
                  const color = isQuery ? "#FF6B00" : "#AED6F1";
                  const r = isQuery ? 26 : 20;
                  return (
                    <g key={i}>
                      <circle cx={node.x} cy={node.y} r={r} fill={color}
                        stroke="white" strokeWidth="2.5" />
                      {isQuery && (
                        <text x={node.x} y={node.y + 5} textAnchor="middle"
                          fontSize="14" fill="white" fontWeight="bold">?</text>
                      )}
                      <foreignObject x={node.x - 60} y={node.y + r + 6} width="120" height="40">
                        <div style={{
                          fontSize: "9.5px", textAlign: "center", color: "#141413",
                          lineHeight: 1.35, wordBreak: "break-word",
                          fontFamily: "var(--font-sans)",
                        }}>
                          {node.label}
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
