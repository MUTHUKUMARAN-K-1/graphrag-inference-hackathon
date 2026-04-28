import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ExplorerContent } from "@/components/explorer/ExplorerContent";

export default function ExplorerPage() {
  return (
    <main>
      <Navbar />
      <div className="page-header">
        <div className="container">
          <div className="badge" style={{ background: "#e8f8f5", color: "#5db8a6", fontSize: "0.75rem" }}>🕸️ Knowledge Graph</div>
          <h1 className="display-xl mb-3 mt-4">Graph Explorer</h1>
          <p className="body-lg mx-auto" style={{ maxWidth: "560px", color: "var(--color-muted)" }}>
            Visualize how GraphRAG traverses the knowledge graph to find answers.
            Click nodes to inspect entities and trace reasoning paths.
          </p>
        </div>
      </div>
      <section style={{ background: "var(--color-surface-soft)", padding: "0 0 96px" }}>
        <div className="container-wide">
          <ExplorerContent />
        </div>
      </section>
      <Footer />
    </main>
  );
}
