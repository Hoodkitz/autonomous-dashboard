"use client";

import { useState, useEffect, useCallback } from "react";

interface Discovery {
  id: string;
  foundAt: string;
  category: "tool" | "skill" | "plugin" | "api" | "framework" | "service";
  name: string;
  description: string;
  valueScore: number;
  effort: "low" | "medium" | "high";
  cost: "free" | "freemium" | "paid";
  relevance: string;
  installCommand?: string;
  url?: string;
  status: "new" | "evaluated" | "installed" | "rejected";
  tags: string[];
}

interface ResearchState {
  updatedAt: string;
  lastScanAt: string;
  discoveries: Discovery[];
  summary: {
    total: number;
    new: number;
    highValue: number;
    free: number;
    lowEffort: number;
  };
}

const CATEGORY_ICONS: Record<string, string> = {
  tool: "T", skill: "S", plugin: "P", api: "A", framework: "F", service: "V",
};

const CATEGORY_COLORS: Record<string, string> = {
  tool: "bg-cyan-500", skill: "bg-accent", plugin: "bg-purple-500",
  api: "bg-emerald-500", framework: "bg-orange-500", service: "bg-pink-500",
};

const EFFORT_COLORS: Record<string, string> = {
  low: "text-success", medium: "text-warning", high: "text-danger",
};

export default function ResearchPage() {
  const [state, setState] = useState<ResearchState | null>(null);
  const [scanning, setScanning] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [sort, setSort] = useState<string>("value");

  const fetchState = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set("filter", filter);
      if (sort) params.set("sort", sort);
      const res = await fetch(`/api/research?${params}`);
      if (res.ok) setState(await res.json());
    } catch { /* ignore */ }
  }, [filter, sort]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  async function runScan(scanType: string) {
    setScanning(scanType);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: scanType }),
      });
      if (res.ok) {
        await fetchState();
      }
    } finally {
      setScanning(null);
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", id, status }),
    });
    await fetchState();
  }

  async function evaluate() {
    setScanning("evaluate");
    try {
      await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate" }),
      });
      await fetchState();
    } finally {
      setScanning(null);
    }
  }

  if (!state) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground">Research & Discovery</h1>
        <p className="text-muted mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Research & Discovery</h1>
          <p className="text-xs text-muted mt-1">
            AI-powered discovery of tools, skills, plugins, and APIs that add value
          </p>
        </div>
        {state.lastScanAt && (
          <span className="text-xs text-muted">
            Last scan: {new Date(state.lastScanAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Summary Cards */}
      {state.summary && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Total Found", value: state.summary.total, color: "text-foreground" },
            { label: "New", value: state.summary.new, color: "text-accent" },
            { label: "High Value (8+)", value: state.summary.highValue, color: "text-success" },
            { label: "Free", value: state.summary.free, color: "text-cyan-400" },
            { label: "Low Effort", value: state.summary.lowEffort, color: "text-emerald-400" },
          ].map((card) => (
            <div key={card.label} className="bg-card border border-card-border rounded-lg p-3 text-center">
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-muted">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Scan Buttons */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Run Discovery Scan</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { action: "scan_skills", label: "Skills", desc: "Antigravity skills to install" },
            { action: "scan_tools", label: "Tools", desc: "Developer CLIs and utilities" },
            { action: "scan_apis", label: "APIs", desc: "Free APIs for building products" },
            { action: "scan_plugins", label: "Plugins", desc: "Claude Code / MCP plugins" },
            { action: "scan_all", label: "Full Scan", desc: "Run all scans" },
          ].map((scan) => (
            <button
              key={scan.action}
              onClick={() => runScan(scan.action)}
              disabled={scanning !== null}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scanning === scan.action
                  ? "bg-accent text-background animate-pulse"
                  : "bg-card-border text-foreground hover:bg-accent hover:text-background"
              } disabled:opacity-50`}
            >
              {scanning === scan.action ? `Scanning ${scan.label}...` : scan.label}
              <span className="block text-xs opacity-60">{scan.desc}</span>
            </button>
          ))}
          <button
            onClick={evaluate}
            disabled={scanning !== null}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-warning/20 text-warning hover:bg-warning/30 disabled:opacity-50"
          >
            {scanning === "evaluate" ? "Evaluating..." : "AI Evaluate"}
            <span className="block text-xs opacity-60">Re-rank by value</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-muted">Filter:</span>
        {["", "tool", "skill", "plugin", "api", "new", "evaluated"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 rounded text-xs ${
              filter === f ? "bg-accent text-background" : "bg-card text-muted hover:text-foreground"
            }`}
          >
            {f || "All"}
          </button>
        ))}
        <span className="text-xs text-muted ml-4">Sort:</span>
        {[
          { key: "value", label: "Value" },
          { key: "date", label: "Newest" },
          { key: "effort", label: "Easiest" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`px-2 py-1 rounded text-xs ${
              sort === s.key ? "bg-accent text-background" : "bg-card text-muted hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Discoveries List */}
      <div className="space-y-2">
        {state.discoveries.map((d) => (
          <div
            key={d.id}
            className={`bg-card border rounded-lg p-4 transition-colors ${
              d.status === "rejected" ? "border-card-border opacity-40" :
              d.valueScore >= 8 ? "border-success" :
              d.status === "new" ? "border-accent" : "border-card-border"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                  CATEGORY_COLORS[d.category] || "bg-muted"
                }`}>
                  {CATEGORY_ICONS[d.category] || "?"}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{d.name}</h4>
                    <span className={`text-xs ${EFFORT_COLORS[d.effort]}`}>{d.effort} effort</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      d.cost === "free" ? "bg-success/10 text-success" :
                      d.cost === "freemium" ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
                    }`}>
                      {d.cost}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      d.status === "new" ? "bg-accent/10 text-accent" :
                      d.status === "installed" ? "bg-success/10 text-success" :
                      d.status === "rejected" ? "bg-danger/10 text-danger" : "bg-muted/10 text-muted"
                    }`}>
                      {d.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{d.description}</p>
                  {d.relevance && (
                    <p className="text-xs text-foreground/70 mt-1">Why: {d.relevance}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {d.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-background px-1.5 py-0.5 rounded text-muted">{tag}</span>
                    ))}
                    {d.installCommand && (
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded text-accent font-mono">{d.installCommand}</code>
                    )}
                    {d.url && (
                      <span className="text-xs text-accent">{d.url}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Value Score */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  d.valueScore >= 8 ? "bg-success/20 text-success" :
                  d.valueScore >= 5 ? "bg-warning/20 text-warning" : "bg-muted/20 text-muted"
                }`}>
                  {d.valueScore}
                </div>
                {/* Action buttons */}
                {d.status !== "installed" && d.status !== "rejected" && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => updateStatus(d.id, "installed")}
                      className="text-xs px-2 py-0.5 rounded bg-success/10 text-success hover:bg-success/20"
                    >
                      Install
                    </button>
                    <button
                      onClick={() => updateStatus(d.id, "rejected")}
                      className="text-xs px-2 py-0.5 rounded bg-danger/10 text-danger hover:bg-danger/20"
                    >
                      Skip
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {state.discoveries.length === 0 && (
          <div className="text-center py-12 text-muted">
            <p className="text-lg">No discoveries yet</p>
            <p className="text-sm mt-1">Run a scan above to discover valuable tools, skills, and APIs</p>
          </div>
        )}
      </div>
    </div>
  );
}
