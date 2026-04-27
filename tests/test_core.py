"""
Unit Tests — GraphRAG Inference Hackathon
==========================================
Tests for core utility functions across all layers.
Run: python -m pytest tests/ -v
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Layer 1: Graph Layer Tests ─────────────────────────

def test_cosine_similarity_identical():
    from graphrag.layers.graph_layer import cosine_similarity
    assert cosine_similarity([1, 0, 0], [1, 0, 0]) == 1.0

def test_cosine_similarity_orthogonal():
    from graphrag.layers.graph_layer import cosine_similarity
    assert cosine_similarity([1, 0, 0], [0, 1, 0]) == 0.0

def test_cosine_similarity_opposite():
    from graphrag.layers.graph_layer import cosine_similarity
    assert abs(cosine_similarity([1, 0], [-1, 0]) - (-1.0)) < 1e-9

def test_cosine_similarity_zero_vector():
    from graphrag.layers.graph_layer import cosine_similarity
    assert cosine_similarity([0, 0, 0], [1, 2, 3]) == 0.0

def test_cosine_similarity_mismatched_lengths():
    from graphrag.layers.graph_layer import cosine_similarity
    assert cosine_similarity([1, 2], [1, 2, 3]) == 0.0

def test_chunk_text_basic():
    from graphrag.layers.graph_layer import chunk_text
    text = "Hello world. " * 100
    chunks = chunk_text(text, chunk_size=200, overlap=20)
    assert len(chunks) > 1
    assert all(len(c) <= 220 for c in chunks)  # allow slight overshoot for sentence boundary

def test_chunk_text_empty():
    from graphrag.layers.graph_layer import chunk_text
    assert chunk_text("") == []
    assert chunk_text(None) == []

def test_chunk_text_short():
    from graphrag.layers.graph_layer import chunk_text
    result = chunk_text("Short text.", chunk_size=1000)
    assert len(result) == 1
    assert result[0] == "Short text."

def test_chunk_text_overlap():
    from graphrag.layers.graph_layer import chunk_text
    text = "A" * 500 + " " + "B" * 500
    chunks = chunk_text(text, chunk_size=300, overlap=50)
    assert len(chunks) >= 3

def test_generate_entity_id_deterministic():
    from graphrag.layers.graph_layer import generate_entity_id
    id1 = generate_entity_id("Albert Einstein", "PERSON")
    id2 = generate_entity_id("Albert Einstein", "PERSON")
    assert id1 == id2

def test_generate_entity_id_case_insensitive():
    from graphrag.layers.graph_layer import generate_entity_id
    id1 = generate_entity_id("Albert Einstein", "PERSON")
    id2 = generate_entity_id("albert einstein", "person")
    assert id1 == id2

def test_generate_entity_id_different_types():
    from graphrag.layers.graph_layer import generate_entity_id
    id1 = generate_entity_id("Apple", "ORGANIZATION")
    id2 = generate_entity_id("Apple", "PRODUCT")
    assert id1 != id2

def test_generate_chunk_id():
    from graphrag.layers.graph_layer import generate_chunk_id
    assert generate_chunk_id("doc1", 0) == "doc1_chunk_0000"
    assert generate_chunk_id("doc1", 42) == "doc1_chunk_0042"


# ── Layer 4: Evaluation Tests ─────────────────────────

def test_normalize_answer():
    from graphrag.layers.evaluation_layer import normalize_answer
    assert normalize_answer("The Answer") == "answer"
    assert normalize_answer("  a  big   space  ") == "big space"
    assert normalize_answer("Hello, World!") == "hello world"

def test_compute_f1_perfect():
    from graphrag.layers.evaluation_layer import compute_f1
    assert compute_f1("the cat sat", "the cat sat") == 1.0

def test_compute_f1_partial():
    from graphrag.layers.evaluation_layer import compute_f1
    score = compute_f1("the cat sat on the mat", "the cat sat")
    assert 0.5 < score < 1.0

def test_compute_f1_no_overlap():
    from graphrag.layers.evaluation_layer import compute_f1
    assert compute_f1("dogs run fast", "cats sit quietly") == 0.0

def test_compute_f1_empty():
    from graphrag.layers.evaluation_layer import compute_f1
    assert compute_f1("", "") == 1.0
    assert compute_f1("something", "") == 0.0
    assert compute_f1("", "something") == 0.0

def test_compute_exact_match():
    from graphrag.layers.evaluation_layer import compute_exact_match
    assert compute_exact_match("Yes", "yes") == 1.0
    assert compute_exact_match("The answer", "the answer") == 1.0
    assert compute_exact_match("Yes", "No") == 0.0

def test_compute_context_hit_rate():
    from graphrag.layers.evaluation_layer import compute_context_hit_rate
    contexts = ["Einstein was born in Germany.", "He developed relativity."]
    facts = ["Einstein was born in Germany.", "He won Nobel Prize."]
    rate = compute_context_hit_rate(contexts, facts)
    assert rate == 0.5

def test_compute_context_hit_rate_empty():
    from graphrag.layers.evaluation_layer import compute_context_hit_rate
    assert compute_context_hit_rate([], []) == 0.0
    assert compute_context_hit_rate(["something"], []) == 0.0

def test_compute_token_efficiency():
    from graphrag.layers.evaluation_layer import compute_token_efficiency
    assert compute_token_efficiency(100, 250) == 2.5
    assert compute_token_efficiency(100, 50) == 0.5
    assert compute_token_efficiency(0, 100) == 0.0


# ── Universal LLM Tests ──────────────────────────────

def test_provider_registry_completeness():
    from graphrag.layers.universal_llm import PROVIDERS
    expected = {"openai", "anthropic", "gemini", "mistral", "cohere",
                "ollama", "openrouter", "groq", "xai", "together",
                "huggingface", "deepseek"}
    assert set(PROVIDERS.keys()) == expected

def test_provider_has_required_fields():
    from graphrag.layers.universal_llm import PROVIDERS
    for pid, cfg in PROVIDERS.items():
        assert "name" in cfg, f"{pid} missing name"
        assert "default_model" in cfg, f"{pid} missing default_model"
        assert "litellm_prefix" in cfg, f"{pid} missing litellm_prefix"
        assert "cost_input" in cfg, f"{pid} missing cost_input"
        assert "cost_output" in cfg, f"{pid} missing cost_output"

def test_ollama_is_free():
    from graphrag.layers.universal_llm import PROVIDERS
    ollama = PROVIDERS["ollama"]
    assert ollama["cost_input"] == 0
    assert ollama["cost_output"] == 0
    assert ollama.get("is_local") is True

def test_get_available_providers_includes_ollama():
    from graphrag.layers.universal_llm import get_available_providers
    available = get_available_providers()
    assert "ollama" in available  # always included as local


# ── Evaluation Layer Aggregate Tests ──────────────────

def test_evaluation_layer_aggregate():
    from graphrag.layers.evaluation_layer import EvaluationLayer, EvalSample
    evl = EvaluationLayer()
    sample = EvalSample(
        query="test?", reference_answer="yes",
        baseline_answer="yes", graphrag_answer="yes indeed",
        question_type="factoid", difficulty="easy",
    )
    evl.evaluate_sample(sample, baseline_tokens=100, graphrag_tokens=200,
                        baseline_cost=0.001, graphrag_cost=0.002)
    agg = evl.compute_aggregate_metrics()
    assert agg["num_samples"] == 1
    assert agg["baseline"]["avg_f1"] > 0
    assert agg["graphrag"]["avg_f1"] > 0

def test_evaluation_layer_report():
    from graphrag.layers.evaluation_layer import EvaluationLayer, EvalSample
    evl = EvaluationLayer()
    for i in range(3):
        sample = EvalSample(query=f"q{i}?", reference_answer="answer",
                            baseline_answer="answer", graphrag_answer="answer",
                            question_type="bridge" if i % 2 == 0 else "comparison")
        evl.evaluate_sample(sample, baseline_tokens=100+i*10, graphrag_tokens=200+i*20)
    report = evl.generate_report()
    assert "BENCHMARK REPORT" in report
    assert "bridge" in report or "comparison" in report


if __name__ == "__main__":
    # Run all tests
    import traceback
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    passed = failed = 0
    for test_fn in tests:
        try:
            test_fn()
            print(f"  ✅ {test_fn.__name__}")
            passed += 1
        except Exception as e:
            print(f"  ❌ {test_fn.__name__}: {e}")
            traceback.print_exc()
            failed += 1
    print(f"\n{'='*50}")
    print(f"Results: {passed} passed, {failed} failed, {passed+failed} total")
    if failed == 0:
        print("🎉 ALL TESTS PASSED!")
    else:
        print(f"⚠️  {failed} tests failed")
