import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DocsContent } from "@/components/docs/DocsContent";

export default function DocsPage() {
  return (
    <main>
      <Navbar />
      <DocsContent />
      <Footer />
    </main>
  );
}
