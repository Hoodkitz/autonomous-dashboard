"use client";

import { useState, useEffect, useCallback } from "react";

interface CostEntry {
  date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
}

interface RevenueStream {
  name: string;
  type: string;
  status: "active" | "planned" | "paused";
  monthlyEstimate: number;
  url?: string;
  deployedAt?: string;
}

interface CostSource {
  name: string;
  type: string;
  monthlyCost: number;
  tier: "free" | "paid";
  note: string;
}

interface FinanceLedger {
  updatedAt: string;
  monthlyBudget: number;
  entries: CostEntry[];
  totals: {
    totalCosts: number;
    totalRevenue: number;
    netBalance: number;
    monthCosts: number;
    monthRevenue: number;
  };
  revenueStreams: RevenueStream[];
  costSources: CostSource[];
  selfFinanceGoal: {
    targetMonthly: number;
    currentMonthly: number;
    selfSustaining: boolean;
    deficit: number;
  };
}

export default function FinancePage() {
  const [ledger, setLedger] = useState<FinanceLedger | null>(null);
  const [newStreamName, setNewStreamName] = useState("");
  const [newStreamEstimate, setNewStreamEstimate] = useState("");
  const [newStreamType, setNewStreamType] = useState("saas");

  const fetchLedger = useCallback(async () => {
    try {
      const res = await fetch("/api/self-finance");
      if (res.ok) setLedger(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchLedger();
    const iv = setInterval(fetchLedger, 10000);
    return () => clearInterval(iv);
  }, [fetchLedger]);

  async function postAction(data: Record<string, unknown>) {
    const res = await fetch("/api/self-finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { ledger: updated } = await res.json();
      setLedger(updated);
    }
  }

  async function addStream() {
    if (!newStreamName.trim()) return;
    await postAction({
      action: "add_stream",
      name: newStreamName.trim(),
      type: newStreamType,
      status: "planned",
      monthlyEstimate: parseFloat(newStreamEstimate) || 0,
    });
    setNewStreamName("");
    setNewStreamEstimate("");
  }

  if (!ledger) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground">Self-Finance</h1>
        <p className="text-muted mt-2">Loading...</p>
      </div>
    );
  }

  const sf = ledger.selfFinanceGoal;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Self-Finance Module</h1>
        <p className="text-xs text-muted mt-1">
          The engine earns money to cover its own operating costs. Target: $0 net cost to user.
        </p>
      </div>

      {/* Self-Finance Status */}
      <div className={`rounded-lg p-5 border-2 ${
        sf.selfSustaining ? "border-success bg-success/5" : "border-warning bg-warning/5"
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {sf.selfSustaining ? "Self-Sustaining" : "Building Toward Self-Sustaining"}
            </h2>
            <p className="text-xs text-muted">
              {sf.selfSustaining
                ? "Engine revenue covers all operating costs"
                : `Need $${sf.deficit.toFixed(2)}/mo more revenue to cover costs`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">
              ${sf.currentMonthly.toFixed(2)}
              <span className="text-sm text-muted font-normal"> / ${sf.targetMonthly.toFixed(2)} mo</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-background rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${sf.selfSustaining ? "bg-success" : "bg-warning"}`}
            style={{ width: `${Math.min(100, sf.targetMonthly > 0 ? (sf.currentMonthly / sf.targetMonthly) * 100 : 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>Revenue: ${sf.currentMonthly.toFixed(2)}/mo</span>
          <span>Costs: ${sf.targetMonthly.toFixed(2)}/mo</span>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: ledger.totals.totalRevenue, color: "text-success" },
          { label: "Total Costs", value: ledger.totals.totalCosts, color: "text-danger" },
          { label: "Net Balance", value: ledger.totals.netBalance, color: ledger.totals.netBalance >= 0 ? "text-success" : "text-danger" },
          { label: "This Month Revenue", value: ledger.totals.monthRevenue, color: "text-accent" },
        ].map((item) => (
          <div key={item.label} className="bg-card border border-card-border rounded-lg p-3">
            <div className="text-xs text-muted">{item.label}</div>
            <div className={`text-lg font-bold ${item.color}`}>${item.value.toFixed(2)}</div>
          </div>
        ))}
      </div>

      {/* Cost Sources */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Operating Costs</h3>
        <div className="space-y-2">
          {ledger.costSources.map((source, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${source.tier === "free" ? "bg-success" : "bg-warning"}`} />
                <span className="text-foreground">{source.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  source.tier === "free" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                }`}>
                  {source.tier}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">{source.note}</span>
                <span className="font-mono text-foreground">${source.monthlyCost.toFixed(2)}/mo</span>
              </div>
            </div>
          ))}
          <div className="border-t border-card-border pt-2 flex justify-between font-medium text-sm">
            <span className="text-foreground">Total Monthly Cost</span>
            <span className="text-foreground">
              ${ledger.costSources.reduce((s, c) => s + c.monthlyCost, 0).toFixed(2)}/mo
            </span>
          </div>
        </div>
      </div>

      {/* Revenue Streams */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Revenue Streams</h3>
        <div className="space-y-2">
          {ledger.revenueStreams.map((stream, i) => (
            <div key={i} className="flex items-center justify-between text-sm bg-background rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  stream.status === "active" ? "bg-success" : stream.status === "planned" ? "bg-warning" : "bg-muted"
                }`} />
                <span className="text-foreground">{stream.name}</span>
                <span className="text-xs text-muted">{stream.type}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  stream.status === "active" ? "bg-success/10 text-success" :
                  stream.status === "planned" ? "bg-warning/10 text-warning" : "bg-muted/10 text-muted"
                }`}>
                  {stream.status}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {stream.url && <span className="text-xs text-accent">{stream.url}</span>}
                <span className="font-mono text-success">${stream.monthlyEstimate.toFixed(2)}/mo</span>
                <button
                  onClick={() => postAction({ action: "remove_stream", index: i })}
                  className="text-danger text-xs"
                >x</button>
              </div>
            </div>
          ))}
          {ledger.revenueStreams.length === 0 && (
            <p className="text-xs text-muted italic">No revenue streams yet. The engine will build them autonomously.</p>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            value={newStreamName}
            onChange={(e) => setNewStreamName(e.target.value)}
            placeholder="Stream name..."
            className="bg-background text-foreground border border-card-border rounded px-2 py-1 text-xs flex-1"
          />
          <select
            value={newStreamType}
            onChange={(e) => setNewStreamType(e.target.value)}
            className="bg-background text-foreground border border-card-border rounded px-2 py-1 text-xs"
          >
            <option value="saas">SaaS</option>
            <option value="api">API</option>
            <option value="bot">Bot</option>
            <option value="product">Product</option>
            <option value="service">Service</option>
          </select>
          <input
            value={newStreamEstimate}
            onChange={(e) => setNewStreamEstimate(e.target.value)}
            placeholder="$/mo"
            className="bg-background text-foreground border border-card-border rounded px-2 py-1 text-xs w-20"
          />
          <button onClick={addStream} className="px-3 py-1 bg-accent text-background rounded text-xs">Add</button>
        </div>
      </div>

      {/* Strategy */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Self-Finance Strategy</h3>
        <div className="space-y-2 text-xs text-muted">
          <p><strong className="text-foreground">Goal:</strong> Engine covers ALL its own costs through revenue it generates.</p>
          <p><strong className="text-foreground">Method:</strong> Build and deploy SaaS micro-products using free hosting tiers. Revenue from subscriptions pays for API costs.</p>
          <p><strong className="text-foreground">Priority:</strong> Low-cost, high-margin digital products that need minimal maintenance.</p>
          <div className="mt-3 space-y-1">
            <p className="text-foreground font-medium">Auto-Finance Pipeline:</p>
            <p>1. Engine discovers profitable niche via web research</p>
            <p>2. Engine builds MVP using existing skills (Next.js + Supabase + Vercel)</p>
            <p>3. Engine deploys to free tier hosting</p>
            <p>4. Engine adds Stripe payments (when user provides key)</p>
            <p>5. Revenue covers API costs (Anthropic, OpenRouter, etc.)</p>
            <p>6. Net positive = engine is self-sustaining</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {ledger.entries.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Transactions</h3>
          <div className="space-y-1">
            {ledger.entries.slice(-10).reverse().map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted">{entry.date}</span>
                  <span className="text-foreground">{entry.description}</span>
                  <span className="text-muted">{entry.category}</span>
                </div>
                <span className={entry.amount >= 0 ? "text-success font-mono" : "text-danger font-mono"}>
                  {entry.amount >= 0 ? "+" : ""}${entry.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
