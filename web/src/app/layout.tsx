import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GraphRAG Inference Dashboard — TigerGraph × Claude",
  description:
    "Dual-pipeline GraphRAG system proving graphs make LLM inference faster, cheaper, and smarter. Built with TigerGraph + Claude.",
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
