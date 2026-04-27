"""
Tests for GraphRAG Novelties Engine
Run: python tests/test_novelties.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graphrag.layers.novelties import (
    PPRConfidenceScorer, TokenBudgetController, PathPruner,
    SpreadingActivation, PolyGRouter, IncrementalGraphUpdater,
    NoveltyEngine,
)

# ── Sample graph for testing ──────────────────────────

ADJACENCY = {
    "einstein": [("physics", 0.9), ("germany", 0.7), ("relativity", 0.95)],
    "physics": [("einstein", 0.9), ("newton", 0.8), ("relativity", 0.85)],
    "relativity": [("einstein", 0.95), ("physics", 0.85), ("spacetime", 0.9)],
    "newton": [("physics", 0.8), ("gravity", 0.9), ("england", 0.7)],
    "germany": [("einstein", 0.7), ("berlin", 0.6)],
    "gravity": [("newton", 0.9), ("spacetime", 0.7)],
    "spacetime": [("relativity", 0.9), ("gravity", 0.7)],
    "england": [("newton", 0.7)],
    "berlin": [("germany", 0.6)],
}

ENTITY_TO_CHUNKS = {
    "einstein": ["c1", "c2"],
    "relativity": ["c2", "c3"],
    "newton": ["c4"],
    "physics": ["c1", "c3", "c4"],
}

CHUNK_TEXTS = {
    "c1": "Einstein was a physicist who developed the theory of relativity.",
    "c2": "The theory of relativity was published by Einstein in 1905.",
    "c3": "Relativity changed our understanding of physics and spacetime.",
    "c4": "Newton developed classical mechanics and the law of gravity.",
}


# ── PPR Tests ─────────────────────────────────────────

def test_ppr_basic():
    scorer = PPRConfidenceScorer(damping=0.85, max_iterations=20)
    scores = scorer.compute_ppr(ADJACENCY, ["einstein"])
    assert "einstein" in scores
    assert scores["einstein"] > 0
    assert scores.get("relativity", 0) > scores.get("berlin", 0)  # closer = higher

def test_ppr_multiple_seeds():
    scorer = PPRConfidenceScorer()
    scores = scorer.compute_ppr(ADJACENCY, ["einstein", "newton"])
    assert scores.get("physics", 0) > 0  # connected to both seeds

def test_ppr_empty():
    scorer = PPRConfidenceScorer()
    assert scorer.compute_ppr({}, []) == {}

def test_ppr_context_scoring():
    scorer = PPRConfidenceScorer()
    ppr = scorer.compute_ppr(ADJACENCY, ["einstein"])
    ranked = scorer.score_contexts(ppr, ENTITY_TO_CHUNKS, CHUNK_TEXTS)
    assert len(ranked) > 0
    assert ranked[0][2] >= ranked[-1][2]  # sorted descending


# ── Token Budget Tests ────────────────────────────────

def test_budget_basic():
    ctrl = TokenBudgetController(max_tokens=50)
    items = [("Short text.", 0.9), ("A much longer text that takes more tokens.", 0.5)]
    selected, stats = ctrl.prune_context(items)
    assert stats["used_tokens"] <= 50
    assert stats["items_selected"] <= 2

def test_budget_all_fit():
    ctrl = TokenBudgetController(max_tokens=10000)
    items = [("Hello.", 0.9), ("World.", 0.8)]
    selected, stats = ctrl.prune_context(items)
    assert len(selected) == 2
    assert stats["reduction_pct"] >= 0

def test_budget_priority():
    ctrl = TokenBudgetController(max_tokens=20)
    items = [("Low priority text.", 0.1), ("High priority!", 0.9)]
    selected, stats = ctrl.prune_context(items)
    assert "High priority!" in selected[0]  # highest score first

def test_budget_stats():
    ctrl = TokenBudgetController(max_tokens=100)
    items = [("a " * 200, 0.9)]  # 400 chars ≈ 100 tokens
    _, stats = ctrl.prune_context(items)
    assert "budget_tokens" in stats
    assert "reduction_pct" in stats


# ── Path Pruner Tests ─────────────────────────────────

def test_path_find():
    adj_with_rel = {
        "A": [("B", "KNOWS", 0.9), ("C", "WORKS_AT", 0.5)],
        "B": [("D", "LOCATED_IN", 0.8)],
        "C": [("D", "PART_OF", 0.7)],
    }
    pruner = PathPruner()
    paths = pruner.find_paths(adj_with_rel, "A", "D", max_depth=3)
    assert len(paths) >= 1

def test_path_scoring():
    pruner = PathPruner()
    paths = [[("A", "KNOWS", "B"), ("B", "IN", "C")]]
    weights = {("A", "B"): 0.9, ("B", "C"): 0.8}
    scored = pruner.score_and_prune(paths, weights, threshold=0.1)
    assert len(scored) == 1
    assert scored[0][1] == 0.9 * 0.8  # product of edge weights

def test_path_serialize():
    pruner = PathPruner()
    scored = [([("Einstein", "DEVELOPED", "Relativity"), ("Relativity", "EXPLAINS", "Spacetime")], 0.72)]
    text = pruner.serialize_paths(scored)
    assert "Einstein" in text
    assert "confidence: 0.720" in text


# ── Spreading Activation Tests ────────────────────────

def test_activation_basic():
    sa = SpreadingActivation(decay_factor=0.7, max_steps=2)
    acts = sa.activate(ADJACENCY, {"einstein": 1.0})
    assert acts["einstein"] == 1.0
    assert acts.get("relativity", 0) > 0  # directly connected
    assert acts.get("berlin", 0) < acts.get("physics", 0)  # further away

def test_activation_ranking():
    sa = SpreadingActivation()
    acts = sa.activate(ADJACENCY, {"einstein": 1.0})
    ranked = sa.rank_contexts(acts, ENTITY_TO_CHUNKS, CHUNK_TEXTS)
    assert len(ranked) > 0
    assert ranked[0][2] >= ranked[-1][2]

def test_activation_decay():
    sa = SpreadingActivation(decay_factor=0.5, max_steps=3)
    acts = sa.activate(ADJACENCY, {"einstein": 1.0})
    # Further nodes should have lower activation
    assert acts.get("einstein", 0) >= acts.get("berlin", 0)


# ── PolyG Router Tests ────────────────────────────────

def test_router_entity_centric():
    router = PolyGRouter()
    result = router.classify_query("What is quantum physics?")
    assert result["query_type"] == "entity_centric"
    assert result["use_graph"] is True

def test_router_multi_hop():
    router = PolyGRouter()
    result = router.classify_query("Were Einstein and Newton of the same nationality?")
    assert result["query_type"] == "multi_hop"
    assert result["strategy"] == "graph_traversal"

def test_router_comparison():
    router = PolyGRouter()
    result = router.classify_query("Compare the theories of Einstein and Hawking")
    assert "multi_hop" in result["query_type"] or "comparison" in str(result["scores"])

def test_router_summarization():
    router = PolyGRouter()
    result = router.classify_query("Summarize the main themes of quantum physics")
    assert result["strategy"] == "community_summary"

def test_router_has_fields():
    router = PolyGRouter()
    result = router.classify_query("test query")
    assert "strategy" in result
    assert "confidence" in result
    assert "reasoning" in result


# ── Incremental Updater Tests ─────────────────────────

def test_updater_scope():
    updater = IncrementalGraphUpdater()
    adj = {"A": ["B", "C"], "B": ["D"], "C": ["E"]}
    affected = updater.compute_affected_scope({"A"}, adj, scope_hops=2)
    assert "A" in affected
    assert "B" in affected
    assert "D" in affected  # 2 hops from A

def test_updater_plan():
    updater = IncrementalGraphUpdater()
    plan = updater.plan_update(
        new_entities=[{"name": "X"}],
        new_relations=[{"source": "X", "target": "Y"}],
        existing_entity_count=100,
    )
    assert plan["new_entities"] == 1
    assert plan["vs_full_rebuild_savings_pct"] > 90


# ── NoveltyEngine Integration Test ───────────────────

def test_novelty_engine():
    engine = NoveltyEngine(token_budget=500)
    result = engine.enhanced_retrieve(
        query="What did Einstein discover?",
        adjacency=ADJACENCY,
        seed_entities=["einstein"],
        entity_to_chunks=ENTITY_TO_CHUNKS,
        chunk_texts=CHUNK_TEXTS,
    )
    assert "contexts" in result
    assert "routing" in result
    assert "budget_stats" in result
    assert "technique_chain" in result
    assert len(result["technique_chain"]) == 5
    assert result["budget_stats"]["used_tokens"] <= 500


if __name__ == "__main__":
    import traceback
    tests = [(k, v) for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    passed = failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  ✅ {name}")
            passed += 1
        except Exception as e:
            print(f"  ❌ {name}: {e}")
            traceback.print_exc()
            failed += 1
    print(f"\n{'='*50}")
    print(f"Novelty Tests: {passed} passed, {failed} failed, {passed+failed} total")
    if failed == 0:
        print("🎉 ALL NOVELTY TESTS PASSED!")
