import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PlaygroundContent } from "@/components/playground/PlaygroundContent";

export default function PlaygroundPage() {
  return (
    <main>
      <Navbar />
      <div className="page-header">
        <div className="container">
          <div className="badge-glow mb-4" style={{ fontSize: "0.75rem" }}>⚡ Live Demo</div>
          <h1 className="display-xl mb-3">Playground</h1>
          <p className="body-lg mx-auto" style={{ maxWidth: "560px", color: "var(--color-muted)" }}>
            Ask any question and watch Baseline RAG race against GraphRAG in real-time.
            Compare answers, tokens, latency, and cost side-by-side.
          </p>
        </div>
      </div>
      <section style={{ background: "var(--color-surface-soft)", padding: "0 0 96px" }}>
        <div className="container">
          <PlaygroundContent />
        </div>
      </section>
      <Footer />
    </main>
  );
}
