import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BenchmarkContent } from "@/components/benchmarks/BenchmarkContent";

export default function BenchmarksPage() {
  return (
    <main>
      <Navbar />
      <div className="page-header">
        <div className="container">
          <div className="badge-blue mb-4" style={{ fontSize: "0.75rem" }}>📊 Performance</div>
          <h1 className="display-xl mb-3">Benchmarks</h1>
          <p className="body-lg mx-auto" style={{ maxWidth: "560px", color: "var(--color-muted)" }}>
            Run batch evaluations on 10 science questions from the ingested Wikipedia corpus.
            Compare token usage, F1 score, and cost across all 3 pipelines.
          </p>
        </div>
      </div>
      <section style={{ background: "var(--color-surface-soft)", padding: "0 0 96px" }}>
        <div className="container">
          <BenchmarkContent />
        </div>
      </section>
      <Footer />
    </main>
  );
}
