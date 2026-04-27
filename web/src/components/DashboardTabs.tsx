"use client";

import { useState } from "react";
import { LiveCompare } from "./tabs/LiveCompare";
import { Benchmark } from "./tabs/Benchmark";
import { CostAnalysis } from "./tabs/CostAnalysis";
import { GraphExplorer } from "./tabs/GraphExplorer";

const TABS = [
  { id: "live", label: "Live Compare", icon: "🔴", color: "#FF6B00" },
  { id: "benchmark", label: "Benchmark", icon: "📊", color: "#0072CE" },
  { id: "cost", label: "Cost Analysis", icon: "💰", color: "#cc785c" },
  { id: "graph", label: "Graph Explorer", icon: "🕸️", color: "#5db8a6" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DashboardTabs() {
  const [active, setActive] = useState<TabId>("live");

  return (
    <section className="section-sm" style={{ background: "var(--color-surface-soft)" }}>
      <div className="container">
        {/* Tab bar */}
        <div className="tab-bar mb-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={tab.id}
              className={`tab-item ${active === tab.id ? "tab-item-active" : ""}`}
              onClick={() => setActive(tab.id)}
              style={
                active === tab.id
                  ? { borderBottom: `2px solid ${tab.color}` }
                  : undefined
              }
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {active === "live" && <LiveCompare />}
          {active === "benchmark" && <Benchmark />}
          {active === "cost" && <CostAnalysis />}
          {active === "graph" && <GraphExplorer />}
        </div>
      </div>
    </section>
  );
}
