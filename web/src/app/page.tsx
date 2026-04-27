import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { DashboardTabs } from "@/components/DashboardTabs";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <DashboardTabs />
      <Footer />
    </main>
  );
}
