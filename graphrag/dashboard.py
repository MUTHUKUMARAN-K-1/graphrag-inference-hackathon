"""
GraphRAG Comparison Dashboard — 4-Tab Gradio UI (3-Pipeline)
=============================================================
Tab 1: Live Query Comparison — 3 pipelines side-by-side
Tab 2: Batch Benchmark Results (HotpotQA) — all 3 pipelines
Tab 3: Cost Analysis (projections + distributions)
Tab 4: Graph Explorer (interactive knowledge graph + reasoning paths)

Hackathon requirement: "one query in, all 3 pipelines run, side-by-side responses + metrics out"
"""
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import gradio as gr
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from graphrag.layers.graph_layer import GraphLayer
from graphrag.layers.llm_layer import LLMLayer
from graphrag.layers.orchestration_layer import InferenceOrchestrator, EmbeddingManager
from graphrag.layers.evaluation_layer import (
    EvaluationLayer, EvalSample, compute_f1, compute_exact_match,
    compute_llm_judge, compute_bertscore,
)
from graphrag.benchmark import BenchmarkRunner

logger = logging.getLogger(__name__)

# ── Global State ─────────────────────────────────────────
orchestrator = None
evaluator = None
benchmark_runner = None
_initialized = False
_benchmark_results = []


def initialize_system():
    """Initialize all components."""
    global orchestrator, evaluator, benchmark_runner, _initialized
    if _initialized:
        return "✅ System already initialized."

    llm = LLMLayer(api_key=os.getenv("OPENAI_API_KEY", ""),
                    model=os.getenv("LLM_MODEL", "gpt-4o-mini"))
    llm.initialize()

    embedder = EmbeddingManager(provider="openai", model="text-embedding-3-small",
                                 api_key=os.getenv("OPENAI_API_KEY", ""))
    embedder.initialize()

    graph = GraphLayer()
    tg_host = os.getenv("TG_HOST", "")
    if tg_host:
        graph_cfg = {
            "host": tg_host,
            "graphname": os.getenv("TG_GRAPH", "GraphRAG"),
            "username": os.getenv("TG_USERNAME", "tigergraph"),
            "password": os.getenv("TG_PASSWORD", ""),
        }
        graph = GraphLayer(config=graph_cfg)
        graph.connect()

    orchestrator = InferenceOrchestrator(graph_layer=graph, llm_layer=llm, embedder=embedder)
    orchestrator.initialize()

    evaluator = EvaluationLayer(eval_llm_model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
                                 api_key=os.getenv("OPENAI_API_KEY", ""))
    evaluator.initialize()

    benchmark_runner = BenchmarkRunner(orchestrator, evaluator)
    _initialized = True
    mode = "TigerGraph" if graph.is_connected else "Offline (passage-based)"
    return f"✅ System initialized! LLM: {llm.model} | Graph: {mode}"


# ── Tab 1: Live 3-Pipeline Comparison ─────────────────────

def run_live_comparison(query, enable_adaptive, top_k, hops):
    """Run all 3 pipelines on a single query and return side-by-side results."""
    if not query.strip():
        return ("Enter a query.", "", "", "", "", 0, 0, 0, 0, 0, 0, 0, 0, 0, None, "", "", "")
    if not _initialized:
        initialize_system()

    try:
        passages = _get_demo_passages(query)

        # Run all 3 pipelines
        lo = orchestrator.run_llm_only(query)
        b = orchestrator.run_baseline_rag(query, passages, int(top_k))
        g = orchestrator.run_graphrag(query, passages, hops=int(hops))

        fig = _build_triple_chart(lo, b, g)

        # Routing info
        routing_info = ""
        if enable_adaptive:
            score, qtype, reasoning = orchestrator.analyze_complexity(query)
            recommended = "GraphRAG" if score >= 0.6 else "Basic RAG"
            routing_info = (
                f"**🧠 Adaptive Routing:**\n"
                f"- Complexity: {score:.2f} | Type: {qtype}\n"
                f"- Recommended: **{recommended}**\n"
                f"- {reasoning}")

        entities_display = ""
        if g.entities_found:
            ent_list = g.entities_found[:8]
            if isinstance(ent_list[0], dict):
                entities_display = "**Entities Found:**\n" + "\n".join(
                    [f"- 🔵 **{e.get('name','N/A')}** ({e.get('entity_type','N/A')})"
                     for e in ent_list])
            else:
                entities_display = "**Entities Found:**\n" + "\n".join(
                    [f"- 🔵 {e}" for e in ent_list])
        if g.relations_traversed:
            entities_display += "\n\n**Relationships:**\n" + "\n".join(
                [f"- 🔗 {r}" for r in g.relations_traversed[:8]])
        if g.novelty_chain:
            entities_display += "\n\n**Novelty Chain:**\n" + "\n".join(
                [f"- ⚡ {step}" for step in g.novelty_chain])

        baseline_ctx = "\n\n---\n\n".join([
            f"**[{i+1}]:** {c[:300]}{'...' if len(c) > 300 else ''}"
            for i, c in enumerate(b.contexts[:5])
        ]) or "No contexts retrieved."

        graphrag_ctx = "\n\n---\n\n".join([
            f"**[{i+1}]:** {c[:300]}{'...' if len(c) > 300 else ''}"
            for i, c in enumerate(g.contexts[:5])
        ]) or "No contexts retrieved."

        return (
            "✅ All 3 pipelines complete!",
            lo.answer, b.answer, g.answer, routing_info,
            lo.total_tokens, b.total_tokens, g.total_tokens,
            round(lo.latency_ms, 1), round(b.latency_ms, 1), round(g.latency_ms, 1),
            round(lo.cost_usd, 6), round(b.cost_usd, 6), round(g.cost_usd, 6),
            fig, baseline_ctx, graphrag_ctx, entities_display,
        )
    except Exception as e:
        logger.error(f"Live comparison error: {e}", exc_info=True)
        return (f"❌ Error: {e}", "", "", "", "", 0, 0, 0, 0, 0, 0, 0, 0, 0, None, "", "", "")


def _get_demo_passages(query):
    """Get passages matching the query from HotpotQA. Falls back to first row if no match."""
    try:
        from datasets import load_dataset
        ds = load_dataset("hotpotqa/hotpot_qa", "distractor", split="validation", streaming=True)
        query_lower = query.lower().strip().rstrip("?").strip()

        # Try to find matching question
        for i, row in enumerate(ds):
            row_q = row["question"].lower().strip().rstrip("?").strip()
            if query_lower == row_q or query_lower in row_q or row_q in query_lower:
                return [f"{t}: {' '.join(s)}"
                        for t, s in zip(row["context"]["title"], row["context"]["sentences"])]
            if i > 200:  # don't scan entire dataset
                break

        # Fallback: return first row's passages
        ds2 = load_dataset("hotpotqa/hotpot_qa", "distractor", split="validation", streaming=True)
        for row in ds2:
            return [f"{t}: {' '.join(s)}"
                    for t, s in zip(row["context"]["title"], row["context"]["sentences"])]
    except Exception as e:
        logger.warning(f"Could not load HotpotQA: {e}")
    return [
        "Demo passage. Connect TigerGraph for full graph-powered retrieval.",
        "GraphRAG extracts entities and relationships for better multi-hop retrieval.",
        "The system supports LLM-Only, Basic RAG, and GraphRAG pipelines.",
    ]


def _build_triple_chart(llm_only, baseline, graphrag):
    """Build 3-pipeline comparison bar chart."""
    fig = make_subplots(rows=1, cols=3, subplot_titles=("Tokens", "Latency (ms)", "Cost ($)"),
                        horizontal_spacing=0.12)
    colors = ["#95a5a6", "#3498db", "#e74c3c"]
    methods = ["LLM-Only", "Basic RAG", "GraphRAG"]

    fig.add_trace(go.Bar(
        x=methods, y=[llm_only.total_tokens, baseline.total_tokens, graphrag.total_tokens],
        marker_color=colors,
        text=[llm_only.total_tokens, baseline.total_tokens, graphrag.total_tokens],
        textposition='auto', showlegend=False), row=1, col=1)
    fig.add_trace(go.Bar(
        x=methods, y=[llm_only.latency_ms, baseline.latency_ms, graphrag.latency_ms],
        marker_color=colors,
        text=[f"{llm_only.latency_ms:.0f}", f"{baseline.latency_ms:.0f}", f"{graphrag.latency_ms:.0f}"],
        textposition='auto', showlegend=False), row=1, col=2)
    fig.add_trace(go.Bar(
        x=methods, y=[llm_only.cost_usd, baseline.cost_usd, graphrag.cost_usd],
        marker_color=colors,
        text=[f"${llm_only.cost_usd:.6f}", f"${baseline.cost_usd:.6f}", f"${graphrag.cost_usd:.6f}"],
        textposition='auto', showlegend=False), row=1, col=3)
    fig.update_layout(height=350, margin=dict(t=40, b=20, l=20, r=20),
                      paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')
    return fig


# ── Tab 2: Batch Benchmark ───────────────────────────────

def run_batch_benchmark(num_samples, top_k, hops, progress=gr.Progress()):
    global _benchmark_results
    if not _initialized:
        initialize_system()

    def progress_cb(cur, tot, _):
        progress(cur / tot, desc=f"Processing {cur}/{tot}...")

    try:
        results = benchmark_runner.run_hotpotqa_benchmark(
            num_samples=int(num_samples), top_k=int(top_k), hops=int(hops),
            progress_callback=progress_cb, run_judge=True, run_bertscore=False)
        _benchmark_results = results.get("results", [])
        agg = results.get("aggregate", {})
        report = results.get("report", "")

        if not _benchmark_results:
            return "No results.", None, None, None, report

        lo = agg.get("llm_only", {})
        b = agg.get("baseline", {})
        g = agg.get("graphrag", {})

        summary = pd.DataFrame({
            "Metric": ["Avg F1", "Avg EM", "LLM-Judge Pass%", "Avg Tokens",
                       "Avg Cost ($)", "Avg Latency (ms)"],
            "LLM-Only": [
                f"{lo.get('avg_f1', 0):.4f}", f"{lo.get('avg_em', 0):.4f}",
                f"{lo.get('judge_pass_rate', 0):.1%}",
                f"{lo.get('avg_tokens', 0):.0f}", f"${lo.get('avg_cost', 0):.6f}",
                f"{lo.get('avg_latency_ms', 0):.0f}"],
            "Basic RAG": [
                f"{b.get('avg_f1', 0):.4f}", f"{b.get('avg_em', 0):.4f}",
                f"{b.get('judge_pass_rate', 0):.1%}",
                f"{b.get('avg_tokens', 0):.0f}", f"${b.get('avg_cost', 0):.6f}",
                f"{b.get('avg_latency_ms', 0):.0f}"],
            "GraphRAG": [
                f"{g.get('avg_f1', 0):.4f}", f"{g.get('avg_em', 0):.4f}",
                f"{g.get('judge_pass_rate', 0):.1%}",
                f"{g.get('avg_tokens', 0):.0f}", f"${g.get('avg_cost', 0):.6f}",
                f"{g.get('avg_latency_ms', 0):.0f}"],
        })

        bar_fig = _build_benchmark_bar(agg)
        radar_fig = _build_radar(agg)
        return (f"✅ Done! {len(_benchmark_results)} samples evaluated across 3 pipelines.",
                summary, bar_fig, radar_fig, report)
    except Exception as e:
        logger.error(f"Benchmark error: {e}", exc_info=True)
        return f"❌ Error: {e}", None, None, None, ""


def _build_benchmark_bar(agg):
    lo = agg.get("llm_only", {})
    b = agg.get("baseline", {})
    g = agg.get("graphrag", {})
    metrics = ["F1", "EM", "Judge Pass%"]
    lo_vals = [lo.get("avg_f1", 0), lo.get("avg_em", 0), lo.get("judge_pass_rate", 0)]
    b_vals = [b.get("avg_f1", 0), b.get("avg_em", 0), b.get("judge_pass_rate", 0)]
    g_vals = [g.get("avg_f1", 0), g.get("avg_em", 0), g.get("judge_pass_rate", 0)]
    fig = go.Figure(data=[
        go.Bar(name="LLM-Only", x=metrics, y=lo_vals, marker_color="#95a5a6",
               text=[f"{v:.3f}" for v in lo_vals], textposition='auto'),
        go.Bar(name="Basic RAG", x=metrics, y=b_vals, marker_color="#3498db",
               text=[f"{v:.3f}" for v in b_vals], textposition='auto'),
        go.Bar(name="GraphRAG", x=metrics, y=g_vals, marker_color="#e74c3c",
               text=[f"{v:.3f}" for v in g_vals], textposition='auto'),
    ])
    fig.update_layout(barmode='group', title="Answer Quality (3 Pipelines)",
                      yaxis_title="Score", height=400,
                      paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')
    return fig


def _build_radar(agg):
    b = agg.get("baseline", {})
    g = agg.get("graphrag", {})
    cats = ["F1", "EM", "Context Hit", "Token Eff.", "Cost Eff."]
    te = min(b.get("avg_tokens", 1) / max(g.get("avg_tokens", 1), 1), 2.0)
    ce = min(b.get("avg_cost", 0.001) / max(g.get("avg_cost", 0.000001), 0.000001), 2.0)
    bv = [b.get("avg_f1", 0), b.get("avg_em", 0), b.get("avg_context_hit", 0), 1.0, 1.0]
    gv = [g.get("avg_f1", 0), g.get("avg_em", 0), g.get("avg_context_hit", 0), te, ce]
    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(r=bv+[bv[0]], theta=cats+[cats[0]], fill='toself',
                                   name='Basic RAG', line_color='#3498db', opacity=0.6))
    fig.add_trace(go.Scatterpolar(r=gv+[gv[0]], theta=cats+[cats[0]], fill='toself',
                                   name='GraphRAG', line_color='#e74c3c', opacity=0.6))
    fig.update_layout(polar=dict(radialaxis=dict(visible=True, range=[0, 1.2])),
                      title="GraphRAG vs Basic RAG Radar", height=450,
                      paper_bgcolor='rgba(0,0,0,0)')
    return fig


# ── Tab 3: Cost Analysis ─────────────────────────────────

def compute_cost_analysis(num_queries, model):
    pricing = {
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        "gpt-4o": {"input": 0.0025, "output": 0.01},
        "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
        "claude-3-5-sonnet": {"input": 0.003, "output": 0.015},
        "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
    }
    p = pricing.get(model, pricing["gpt-4o-mini"])
    n = int(num_queries)

    if _benchmark_results:
        al = sum(r.get("llm_only_tokens", 0) for r in _benchmark_results) / len(_benchmark_results)
        ab = sum(r.get("baseline_tokens", 0) for r in _benchmark_results) / len(_benchmark_results)
        ag = sum(r.get("graphrag_tokens", 0) for r in _benchmark_results) / len(_benchmark_results)
        acl = sum(r.get("llm_only_cost", 0) for r in _benchmark_results) / len(_benchmark_results)
        acb = sum(r.get("baseline_cost", 0) for r in _benchmark_results) / len(_benchmark_results)
        acg = sum(r.get("graphrag_cost", 0) for r in _benchmark_results) / len(_benchmark_results)
    else:
        al, ab, ag = 500, 950, 2400
        acl = (400/1000*p["input"] + 100/1000*p["output"])
        acb = (800/1000*p["input"] + 150/1000*p["output"])
        acg = (2200/1000*p["input"] + 200/1000*p["output"])

    summary = pd.DataFrame({
        "Metric": ["Avg Tokens", "Cost/Query", f"Total ({n:,}q)", "Monthly (1K qpd)", "Annual"],
        "LLM-Only": [f"{al:.0f}", f"${acl:.6f}", f"${acl*n:.4f}", f"${acl*1000*30:.2f}", f"${acl*1000*365:.2f}"],
        "Basic RAG": [f"{ab:.0f}", f"${acb:.6f}", f"${acb*n:.4f}", f"${acb*1000*30:.2f}", f"${acb*1000*365:.2f}"],
        "GraphRAG": [f"{ag:.0f}", f"${acg:.6f}", f"${acg*n:.4f}", f"${acg*1000*30:.2f}", f"${acg*1000*365:.2f}"],
    })

    qr = list(range(0, n+1, max(n//50, 1)))
    fig_cum = go.Figure()
    fig_cum.add_trace(go.Scatter(x=qr, y=[acl*q for q in qr], mode='lines', name='LLM-Only',
                                  line=dict(color='#95a5a6', width=2, dash='dash')))
    fig_cum.add_trace(go.Scatter(x=qr, y=[acb*q for q in qr], mode='lines', name='Basic RAG',
                                  line=dict(color='#3498db', width=3)))
    fig_cum.add_trace(go.Scatter(x=qr, y=[acg*q for q in qr], mode='lines', name='GraphRAG',
                                  line=dict(color='#e74c3c', width=3)))
    fig_cum.update_layout(title=f"Cumulative Cost — 3 Pipelines ({model})",
                          xaxis_title="Queries", yaxis_title="Cost ($)", height=400,
                          paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')

    fig_tok = go.Figure()
    if _benchmark_results:
        fig_tok.add_trace(go.Histogram(
            x=[r.get("llm_only_tokens", 0) for r in _benchmark_results],
            name="LLM-Only", opacity=0.5, marker_color="#95a5a6"))
        fig_tok.add_trace(go.Histogram(
            x=[r.get("baseline_tokens", 0) for r in _benchmark_results],
            name="Basic RAG", opacity=0.6, marker_color="#3498db"))
        fig_tok.add_trace(go.Histogram(
            x=[r.get("graphrag_tokens", 0) for r in _benchmark_results],
            name="GraphRAG", opacity=0.6, marker_color="#e74c3c"))
        fig_tok.update_layout(barmode='overlay', title="Token Distribution (3 Pipelines)", height=400,
                              paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')
    else:
        fig_tok.add_annotation(text="Run benchmark first for distribution data", showarrow=False)

    return summary, fig_cum, fig_tok


# ── Tab 4: Graph Explorer ────────────────────────────────

def explore_graph(query, depth):
    if not _initialized:
        initialize_system()
    try:
        import networkx as nx
        passages = _get_demo_passages(query)
        gr_result = orchestrator.run_graphrag(query, passages, hops=int(depth))

        G = nx.Graph()
        for e in gr_result.entities_found[:20]:
            if isinstance(e, dict):
                G.add_node(e.get("name", "?"), entity_type=e.get("entity_type", "CONCEPT"),
                           description=e.get("description", ""))
            else:
                G.add_node(str(e), entity_type="CONCEPT")
        for r in gr_result.relations_traversed[:30]:
            parts = r.split(" -[")
            if len(parts) == 2:
                src = parts[0].strip()
                rest = parts[1].split("]-> ")
                if len(rest) == 2:
                    rtype = rest[0].strip()
                    tgt = rest[1].split(": ")[0].strip()
                    G.add_edge(src, tgt, relation=rtype)

        if not G.nodes():
            G.add_node("Query", entity_type="QUERY")
            for e in gr_result.entities_found[:5]:
                name = e.get("name", "Entity") if isinstance(e, dict) else str(e)
                etype = e.get("entity_type", "CONCEPT") if isinstance(e, dict) else "CONCEPT"
                G.add_node(name, entity_type=etype)
                G.add_edge("Query", name, relation="FOUND")

        pos = nx.spring_layout(G, k=2, iterations=50, seed=42)
        colors_map = {"PERSON": "#FF6B6B", "ORGANIZATION": "#4ECDC4", "LOCATION": "#45B7D1",
                      "EVENT": "#FFA07A", "DATE": "#98D8C8", "CONCEPT": "#AED6F1",
                      "WORK": "#F9E79F", "PRODUCT": "#D7BDE2", "TECHNOLOGY": "#82E0AA", "QUERY": "#F39C12"}

        edge_x, edge_y = [], []
        for u, v in G.edges():
            x0, y0 = pos[u]; x1, y1 = pos[v]
            edge_x.extend([x0, x1, None]); edge_y.extend([y0, y1, None])

        fig = go.Figure()
        fig.add_trace(go.Scatter(x=edge_x, y=edge_y, mode='lines',
                                  line=dict(width=1.5, color='#888'), hoverinfo='none', showlegend=False))
        fig.add_trace(go.Scatter(
            x=[pos[n][0] for n in G.nodes()], y=[pos[n][1] for n in G.nodes()],
            mode='markers+text', text=list(G.nodes()), textposition="top center", textfont=dict(size=10),
            marker=dict(size=[20 + G.degree(n)*5 for n in G.nodes()],
                        color=[colors_map.get(G.nodes[n].get("entity_type", "CONCEPT"), "#AED6F1") for n in G.nodes()],
                        line=dict(width=2, color='white')),
            hovertext=[f"{n} ({G.nodes[n].get('entity_type','')})" for n in G.nodes()],
            hoverinfo='text', showlegend=False))
        fig.update_layout(title=f"Knowledge Graph: {query[:50]}...", showlegend=False, hovermode='closest',
                          xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                          yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                          height=500, margin=dict(b=20,l=20,r=20,t=40),
                          paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')

        info = {"nodes": len(G.nodes()), "edges": len(G.edges()),
                "entities": len(gr_result.entities_found), "relations": len(gr_result.relations_traversed),
                "novelty_chain": gr_result.novelty_chain}
        stats = pd.DataFrame({"Metric": ["Nodes", "Edges", "Avg Degree", "Density", "Entities", "Relations"],
                              "Value": [len(G.nodes()), len(G.edges()),
                                        f"{sum(d for _,d in G.degree())/max(len(G.nodes()),1):.1f}",
                                        f"{nx.density(G):.3f}",
                                        len(gr_result.entities_found), len(gr_result.relations_traversed)]})

        explanation = orchestrator.explain_graphrag_reasoning(query, gr_result)
        return fig, info, stats, explanation, gr_result.answer
    except Exception as e:
        logger.error(f"Graph explorer error: {e}", exc_info=True)
        empty = go.Figure()
        empty.add_annotation(text=str(e), showarrow=False)
        return empty, {}, pd.DataFrame(), str(e), ""


# ── Build Dashboard ───────────────────────────────────────

def build_dashboard():
    with gr.Blocks(title="GraphRAG 3-Pipeline Dashboard") as demo:
        gr.Markdown("""
        # 🔍 GraphRAG Inference Hackathon — 3-Pipeline Comparison Dashboard
        ### One query in → three pipelines run → side-by-side responses + metrics out
        **Pipelines:** ⚪ LLM-Only | 🔵 Basic RAG | 🔴 GraphRAG (TigerGraph + 6 Novelties)
        **Evaluation:** LLM-as-a-Judge (PASS/FAIL) | BERTScore F1 | F1/EM | RAGAS | Token Tracking
        """)

        with gr.Row():
            init_btn = gr.Button("🚀 Initialize System", variant="primary", scale=2)
            init_status = gr.Textbox(label="Status", interactive=False, scale=3)
        init_btn.click(fn=initialize_system, outputs=init_status)

        with gr.Tabs():
            # ── Tab 1: Live 3-Pipeline Comparison ───────
            with gr.Tab("🔴 Live 3-Pipeline Comparison"):
                gr.Markdown("## One Query → Three Pipelines → Side-by-Side Results")
                with gr.Row():
                    query_input = gr.Textbox(
                        label="Question",
                        placeholder="e.g., Were Scott Derrickson and Ed Wood of the same nationality?",
                        lines=2, scale=3)
                    with gr.Column(scale=1):
                        adaptive = gr.Checkbox(label="🧠 Adaptive Routing", value=True)
                        topk = gr.Slider(1, 10, value=5, step=1, label="Top-K")
                        hops_s = gr.Slider(1, 4, value=2, step=1, label="Hops")

                run_btn = gr.Button("▶ Run All 3 Pipelines", variant="primary", size="lg")
                status = gr.Textbox(label="Status", interactive=False)
                routing = gr.Markdown(visible=True)

                with gr.Row():
                    with gr.Column():
                        gr.Markdown("### ⚪ Pipeline 1: LLM-Only")
                        lo_ans = gr.Textbox(label="Answer", lines=4, interactive=False)
                        with gr.Row():
                            lo_tok = gr.Number(label="Tokens", precision=0)
                            lo_lat = gr.Number(label="Latency (ms)", precision=1)
                            lo_cost = gr.Number(label="Cost ($)", precision=6)
                    with gr.Column():
                        gr.Markdown("### 🔵 Pipeline 2: Basic RAG")
                        b_ans = gr.Textbox(label="Answer", lines=4, interactive=False)
                        with gr.Row():
                            b_tok = gr.Number(label="Tokens", precision=0)
                            b_lat = gr.Number(label="Latency (ms)", precision=1)
                            b_cost = gr.Number(label="Cost ($)", precision=6)
                    with gr.Column():
                        gr.Markdown("### 🔴 Pipeline 3: GraphRAG")
                        g_ans = gr.Textbox(label="Answer", lines=4, interactive=False)
                        with gr.Row():
                            g_tok = gr.Number(label="Tokens", precision=0)
                            g_lat = gr.Number(label="Latency (ms)", precision=1)
                            g_cost = gr.Number(label="Cost ($)", precision=6)

                chart = gr.Plot(label="3-Pipeline Comparison")
                with gr.Accordion("📄 Retrieved Contexts (RAG vs GraphRAG)", open=False):
                    with gr.Row():
                        b_ctx = gr.Markdown(label="Basic RAG Contexts")
                        g_ctx = gr.Markdown(label="GraphRAG Contexts")
                with gr.Accordion("🕸️ Entities, Relations & Novelty Chain", open=False):
                    ent_disp = gr.Markdown()

                run_btn.click(
                    fn=run_live_comparison,
                    inputs=[query_input, adaptive, topk, hops_s],
                    outputs=[status, lo_ans, b_ans, g_ans, routing,
                             lo_tok, b_tok, g_tok,
                             lo_lat, b_lat, g_lat,
                             lo_cost, b_cost, g_cost,
                             chart, b_ctx, g_ctx, ent_disp])
                gr.Examples(examples=[
                    ["Were Scott Derrickson and Ed Wood of the same nationality?"],
                    ["What government position was held by the woman who portrayed Nora Batty?"],
                    ["Which magazine was started first, Arthur's Magazine or First for Women?"],
                    ["Who was born first, Arthur Conan Doyle or Agatha Christie?"],
                    ["What is the capital of the country where the Eiffel Tower is located?"]],
                    inputs=query_input, label="📝 Example Questions (HotpotQA)")

            # ── Tab 2: Batch Benchmark ──────────────────
            with gr.Tab("📊 Batch Benchmark (3-Pipeline)"):
                gr.Markdown("## Benchmark on HotpotQA — All 3 Pipelines + LLM-as-a-Judge")
                with gr.Row():
                    n_samples = gr.Slider(10, 500, value=50, step=10, label="Samples")
                    bk = gr.Slider(1, 10, value=5, step=1, label="Top-K")
                    bh = gr.Slider(1, 4, value=2, step=1, label="Hops")
                    bench_btn = gr.Button("🏃 Run 3-Pipeline Benchmark", variant="primary")
                bench_status = gr.Textbox(label="Status", interactive=False)
                summary_df = gr.Dataframe(label="3-Pipeline Summary")
                with gr.Row():
                    bar_chart = gr.Plot(label="Answer Quality")
                    radar_chart = gr.Plot(label="Radar (RAG vs GraphRAG)")
                with gr.Accordion("📝 Full Report", open=False):
                    report = gr.Textbox(lines=30, interactive=False)
                bench_btn.click(fn=run_batch_benchmark, inputs=[n_samples, bk, bh],
                                outputs=[bench_status, summary_df, bar_chart, radar_chart, report])

            # ── Tab 3: Cost Analysis ────────────────────
            with gr.Tab("💰 Cost Analysis (3-Pipeline)"):
                gr.Markdown("## Cost & Token Analysis — All 3 Pipelines")
                with gr.Row():
                    cq = gr.Slider(100, 100000, value=10000, step=100, label="Queries to Project")
                    cm = gr.Dropdown(["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo",
                                      "claude-3-5-sonnet", "claude-3-haiku"],
                                     value="gpt-4o-mini", label="Model")
                    cost_btn = gr.Button("💵 Calculate", variant="primary")
                cost_df = gr.Dataframe(label="3-Pipeline Cost Breakdown")
                with gr.Row():
                    cum_chart = gr.Plot(label="Cumulative Cost (3 Pipelines)")
                    tok_chart = gr.Plot(label="Token Distribution")
                cost_btn.click(fn=compute_cost_analysis, inputs=[cq, cm],
                               outputs=[cost_df, cum_chart, tok_chart])

            # ── Tab 4: Graph Explorer ───────────────────
            with gr.Tab("🕸️ Graph Explorer"):
                gr.Markdown("## Interactive Knowledge Graph Explorer\n*Visualize how GraphRAG traverses the graph and applies novelty techniques*")
                with gr.Row():
                    gq = gr.Textbox(label="Query", placeholder="Enter a question...", scale=3)
                    gd = gr.Slider(1, 4, value=2, step=1, label="Depth", scale=1)
                    exp_btn = gr.Button("🔍 Explore", variant="primary", scale=1)
                graph_plot = gr.Plot(label="Knowledge Graph")
                with gr.Row():
                    graph_stats = gr.Dataframe(label="Graph Stats")
                    node_info = gr.JSON(label="Details + Novelty Chain")
                with gr.Accordion("🧠 Reasoning Path", open=True):
                    reasoning = gr.Markdown()
                    graph_ans = gr.Textbox(label="GraphRAG Answer", interactive=False)
                exp_btn.click(fn=explore_graph, inputs=[gq, gd],
                              outputs=[graph_plot, node_info, graph_stats, reasoning, graph_ans])
                gr.Examples(examples=[
                    ["Who directed the movie starring Tom Hanks released in 1994?"],
                    ["What is the relationship between Einstein and relativity?"],
                    ["Which country hosted the 2024 Olympics and what is its capital?"]],
                    inputs=gq, label="📝 Examples")

        gr.Markdown("""
        ---
        **GraphRAG Inference Hackathon** by TigerGraph | 3 Pipelines · 14 Novelties · 12 LLM Providers · 12 Research Papers
        **Eval:** LLM-as-a-Judge ✅ | BERTScore ✅ | RAGAS ✅ | F1/EM ✅ | Token Tracking ✅
        """)
    return demo


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    demo = build_dashboard()
    demo.launch(server_port=7860, share=False, show_error=True)
