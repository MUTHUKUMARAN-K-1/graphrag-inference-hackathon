import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GraphRAG — Graphs Make LLM Inference Faster, Cheaper, Smarter",
  description:
    "Dual-pipeline GraphRAG system proving graphs make LLM inference faster, cheaper, and smarter. Built with TigerGraph + Claude for the GraphRAG Inference Hackathon.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-body antialiased">
        {children}
      </body>
    </html>
  );
}
