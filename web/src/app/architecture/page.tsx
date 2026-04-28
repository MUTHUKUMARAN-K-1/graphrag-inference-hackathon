import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ArchitectureContent } from "@/components/architecture/ArchitectureContent";

export default function ArchitecturePage() {
  return (
    <main>
      <Navbar />
      <ArchitectureContent />
      <Footer />
    </main>
  );
}
