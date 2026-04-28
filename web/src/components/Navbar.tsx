"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/playground", label: "Playground" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/explorer", label: "Graph Explorer" },
  { href: "/architecture", label: "Architecture" },
  { href: "/docs", label: "Docs" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="navbar">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 no-underline">
          <div className="relative">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="#FF6B00" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="5" fill="#FF6B00" />
              <path d="M16 2L16 30M2 16L30 16M5.5 5.5L26.5 26.5M26.5 5.5L5.5 26.5" stroke="#FF6B00" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
            </svg>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success" style={{ boxShadow: '0 0 6px rgba(93,184,114,0.6)' }} />
          </div>
          <div>
            <span className="title-lg" style={{ color: "#002B49", letterSpacing: "-0.5px" }}>
              Graph<span style={{ color: "#FF6B00" }}>RAG</span>
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${isActive ? "nav-link-active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/MUTHUKUMARAN-K-1/graphrag-inference-hackathon"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm hidden md:inline-flex"
            style={{ gap: "6px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
          <Link href="/playground" className="btn btn-primary btn-sm">
            Try Demo →
          </Link>

          {/* Mobile hamburger */}
          <button
            className="btn-ghost lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? (
                <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              ) : (
                <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-canvas" style={{ top: "60px" }}>
          <div className="flex flex-col p-6 gap-2">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`nav-link text-lg py-3 ${isActive ? "nav-link-active" : ""}`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline)" }}>
              <a
                href="https://github.com/MUTHUKUMARAN-K-1/graphrag-inference-hackathon"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary w-full"
              >
                ⭐ GitHub
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
