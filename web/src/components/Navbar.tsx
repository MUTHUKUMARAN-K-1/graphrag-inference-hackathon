"use client";

import { useState } from "react";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="navbar">
      {/* Logo */}
      <div className="flex items-center gap-3">
        {/* Tiger spike mark */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" stroke="#FF6B00" strokeWidth="2" />
          <path d="M14 4L14 24M4 14L24 14M7 7L21 21M21 7L7 21" stroke="#FF6B00" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="title-lg" style={{ color: "#002B49" }}>
          Graph<span style={{ color: "#FF6B00" }}>RAG</span>
        </span>
        <span className="badge-outline text-xs hidden sm:inline-flex">Hackathon</span>
      </div>

      {/* Desktop Nav */}
      <div className="hidden md:flex items-center gap-6">
        <a href="#live" className="body-sm hover:text-tiger-orange transition-colors" style={{ color: "#6c6a64" }}>Live Compare</a>
        <a href="#benchmark" className="body-sm hover:text-tiger-orange transition-colors" style={{ color: "#6c6a64" }}>Benchmark</a>
        <a href="#cost" className="body-sm hover:text-tiger-orange transition-colors" style={{ color: "#6c6a64" }}>Cost Analysis</a>
        <a href="#graph" className="body-sm hover:text-tiger-orange transition-colors" style={{ color: "#6c6a64" }}>Graph Explorer</a>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-3">
        <span className="caption hidden lg:block" style={{ color: "#6c6a64" }}>
          Powered by TigerGraph + Claude
        </span>
        <button className="btn btn-primary btn-sm">
          Try Demo
        </button>
      </div>

      {/* Mobile hamburger */}
      <button
        className="btn-ghost md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          {mobileOpen ? (
            <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
          ) : (
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          )}
        </svg>
      </button>
    </nav>
  );
}
