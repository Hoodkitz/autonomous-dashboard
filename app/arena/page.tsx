"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface GladiatorProject {
  name: string;
  tagline: string;
  niche: string;
  strategy: string;
  monetization: string;
  pricing: { free: string; pro: string; proPrice: number };
  status: string;
  progress: number;
  landingPageCode?: string;
}

interface Advice {
  from: string;
  to: string;
  advice: string;
  at: string;
}

interface Gladiator {
  id: string;
  name: string;
  persona: string;
  avatar: string;
  color: string;
  strategy: string;
  project: GladiatorProject | null;
  revenue: number;
  costs: number;
  profit: number;
  payouts: number;
  rounds: number;
  wins: number;
  adviceGiven: Advice[];
  adviceReceived: Advice[];
  log: string[];
  status: string;
  lastActive: string;
}

interface ArenaState {
  status: string;
  round: number;
  totalRounds: number;
  gladiators: Gladiator[];
  leaderboard: Array<{ id: string; name: string; profit: number; rank: number }>;
  totalPayout: number;
  pendingPayout: number;
  history: Array<{ round: number; winner: string; profit: number; at: string }>;
}

interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; dot: string; ring: string }> = {
  cyan: { border: "border-cyan-500", bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-500", ring: "ring-cyan-500/30" },
  purple: { border: "border-purple-500", bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-500", ring: "ring-purple-500/30" },
  emerald: { border: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500", ring: "ring-emerald-500/30" },
  amber: { border: "border-amber-500", bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-500", ring: "ring-amber-500/30" },
  pink: { border: "border-pink-500", bg: "bg-pink-500/10", text: "text-pink-400", dot: "bg-pink-500", ring: "ring-pink-500/30" },
  rose: { border: "border-rose-500", bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-500", ring: "ring-rose-500/30" },
};

const RANK_BADGES = ["text-amber-400", "text-gray-300", "text-amber-700", "text-muted"];

export default function ArenaPage() {
  const [arena, setArena] = useState<ArenaState | null>(null);
  const [battling, setBattling] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [selectedGladiator, setSelectedGladiator] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGladiator, setNewGladiator] = useState({ name: "", persona: "", strategy: "", avatar: "X", color: "pink" });
  const logRef = useRef<HTMLDivElement>(null);

  const fetchArena = useCallback(async () => {
    try {
      const res = await fetch("/api/arena");
      if (res.ok) setArena(await res.json());
    } catch { /* */ }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchArena();
    const interval = setInterval(fetchArena, 5000);
    return () => clearInterval(interval);
  }, [fetchArena]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  async function startBattle() {
    setBattling(true);
    setEvents([]);

    try {
      const res = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "battle" }),
      });

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try { setEvents((prev) => [...prev, JSON.parse(line)]); } catch { /* */ }
        }
      }
    } catch { /* */ }

    setBattling(false);
    fetchArena();
  }

  async function stopBattle() {
    await fetch("/api/arena", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    fetchArena();
  }

  async function collectPayout() {
    setPayoutLoading(true);
    try {
      const res = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payout" }),
      });
      await res.json();
      fetchArena();
    } catch { /* */ }
    setPayoutLoading(false);
  }

  async function addGladiator() {
    if (!newGladiator.name || !newGladiator.strategy) return;
    await fetch("/api/arena", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_gladiator", ...newGladiator }),
    });
    setShowAddForm(false);
    setNewGladiator({ name: "", persona: "", strategy: "", avatar: "X", color: "pink" });
    fetchArena();
  }

  if (!arena) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground">Arena</h1>
        <p className="text-muted mt-2">Loading...</p>
      </div>
    );
  }

  const selected = selectedGladiator ? arena.gladiators.find((g) => g.id === selectedGladiator) : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Arena</h1>
          <p className="text-xs text-muted mt-1">
            {arena.gladiators.length} gladiators compete — Round #{arena.round}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {arena.pendingPayout > 0 && (
            <button
              onClick={collectPayout}
              disabled={payoutLoading}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-success text-background hover:scale-105 transition-all disabled:opacity-50"
            >
              {payoutLoading ? "Collecting..." : `Collect $${arena.pendingPayout.toFixed(2)}`}
            </button>
          )}
          <button
            onClick={startBattle}
            disabled={battling}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              battling
                ? "bg-danger/20 text-danger animate-pulse cursor-wait"
                : "bg-danger text-background hover:scale-105 hover:shadow-lg hover:shadow-danger/25"
            }`}
          >
            {battling ? "Battle in Progress..." : "Start Battle"}
          </button>
          {battling && (
            <button onClick={stopBattle} className="px-3 py-2 rounded-lg text-xs bg-card-border text-muted hover:text-foreground">
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Payout & Stats Banner */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card border border-card-border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-success">${arena.gladiators.reduce((s, g) => s + g.revenue, 0).toFixed(2)}</div>
          <div className="text-xs text-muted">Total Revenue</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-foreground">${arena.gladiators.reduce((s, g) => s + g.profit, 0).toFixed(2)}</div>
          <div className="text-xs text-muted">Total Profit</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent">{arena.round}</div>
          <div className="text-xs text-muted">Rounds Fought</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-warning">${arena.totalPayout.toFixed(2)}</div>
          <div className="text-xs text-muted">Total Collected</div>
        </div>
      </div>

      {/* Leaderboard */}
      {arena.leaderboard.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Leaderboard</h3>
          <div className="space-y-2">
            {arena.leaderboard.map((entry) => {
              const g = arena.gladiators.find((gl) => gl.id === entry.id);
              const colors = COLOR_MAP[g?.color || "cyan"];
              const isLeading = entry.rank === 1 && entry.profit > 0;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:scale-[1.01] ${
                    isLeading ? `${colors.border} ${colors.bg} ring-2 ${colors.ring}` : "border-card-border bg-background/50"
                  } ${selectedGladiator === entry.id ? "ring-2 ring-accent" : ""}`}
                  onClick={() => setSelectedGladiator(entry.id === selectedGladiator ? null : entry.id)}
                >
                  <span className={`text-xl font-black w-8 text-center ${RANK_BADGES[entry.rank - 1] || "text-muted"}`}>
                    #{entry.rank}
                  </span>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black ${colors.bg} ${colors.text}`}>
                    {g?.avatar || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{g?.name}</span>
                      <span className="text-xs text-muted">{g?.persona}</span>
                      {g?.wins ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">{g.wins}W</span> : null}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted">{g?.project?.name || "No project"}</span>
                      {g?.project && (
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-1.5 bg-card-border rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${colors.dot}`} style={{ width: `${g.project.progress}%` }} />
                          </div>
                          <span className="text-[9px] text-muted">{g.project.progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${entry.profit >= 0 ? "text-success" : "text-danger"}`}>
                      ${entry.profit.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-muted">profit</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gladiator Cards - Detail Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {arena.gladiators.map((g) => {
          const colors = COLOR_MAP[g.color] || COLOR_MAP.cyan;
          const rank = arena.leaderboard.find((l) => l.id === g.id)?.rank;
          return (
            <div
              key={g.id}
              className={`border rounded-xl p-4 transition-all ${colors.border} ${colors.bg} ${
                selectedGladiator === g.id ? `ring-2 ${colors.ring}` : ""
              }`}
              onClick={() => setSelectedGladiator(g.id === selectedGladiator ? null : g.id)}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${colors.bg} ${colors.text}`}>
                    {g.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{g.name}</span>
                      {rank && <span className={`text-xs font-bold ${RANK_BADGES[rank - 1] || "text-muted"}`}>#{rank}</span>}
                    </div>
                    <span className="text-[10px] text-muted">{g.persona} — {g.strategy}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${g.profit >= 0 ? "text-success" : "text-danger"}`}>
                    ${g.profit.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-muted">{g.wins}W / {g.rounds}R</div>
                </div>
              </div>

              {/* Project */}
              {g.project ? (
                <div className="bg-background/40 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground">{g.project.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      g.project.status === "earning" ? "bg-success/20 text-success" :
                      g.project.status === "building" ? "bg-accent/20 text-accent" :
                      g.project.status === "optimizing" ? "bg-amber-500/20 text-amber-400" :
                      "bg-card-border text-muted"
                    }`}>
                      {g.project.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted mb-2">{g.project.tagline}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-2 bg-card-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${colors.dot}`} style={{ width: `${g.project.progress}%` }} />
                    </div>
                    <span className="text-[10px] text-muted font-mono">{g.project.progress}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <span className="text-muted">Niche:</span>
                      <span className="text-foreground ml-1">{g.project.niche}</span>
                    </div>
                    <div>
                      <span className="text-muted">Model:</span>
                      <span className="text-foreground ml-1">{g.project.monetization}</span>
                    </div>
                    <div>
                      <span className="text-muted">Pro:</span>
                      <span className="text-success ml-1">${g.project.pricing.proPrice}/mo</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-background/40 rounded-lg p-3 mb-3 text-center">
                  <span className="text-xs text-muted">No project yet — waiting for first battle</span>
                </div>
              )}

              {/* Revenue bar */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div>
                  <div className="text-success font-bold">${g.revenue.toFixed(2)}</div>
                  <div className="text-muted">Revenue</div>
                </div>
                <div>
                  <div className="text-danger font-bold">${g.costs.toFixed(4)}</div>
                  <div className="text-muted">Costs</div>
                </div>
                <div>
                  <div className="text-warning font-bold">${(g.profit - g.payouts).toFixed(2)}</div>
                  <div className="text-muted">Available</div>
                </div>
              </div>

              {/* Recent advice */}
              {g.adviceReceived.length > 0 && (
                <div className="mt-3 border-t border-card-border pt-2">
                  <span className="text-[9px] text-muted uppercase tracking-wider">Latest Advice Received</span>
                  <p className="text-[10px] text-foreground/70 mt-1 italic">
                    &ldquo;{g.adviceReceived[g.adviceReceived.length - 1].advice.slice(0, 150)}&rdquo;
                  </p>
                  <span className="text-[9px] text-muted">
                    — from {arena.gladiators.find((x) => x.id === g.adviceReceived[g.adviceReceived.length - 1].from)?.name || "Unknown"}
                  </span>
                </div>
              )}

              {/* Log */}
              {g.log.length > 0 && (
                <div className="mt-2 border-t border-card-border pt-2">
                  <span className="text-[9px] text-muted uppercase tracking-wider">Activity Log</span>
                  <div className="mt-1 space-y-0.5 max-h-20 overflow-y-auto">
                    {g.log.slice(-5).map((entry, i) => (
                      <div key={i} className="text-[10px] text-muted">{entry}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Gladiator Button/Form */}
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="border-2 border-dashed border-card-border rounded-xl p-8 flex flex-col items-center justify-center hover:border-accent transition-colors group"
          >
            <span className="text-3xl text-muted group-hover:text-accent mb-2">+</span>
            <span className="text-sm text-muted group-hover:text-foreground">Add Gladiator</span>
            <span className="text-[10px] text-muted mt-1">Create a custom competitor</span>
          </button>
        ) : (
          <div className="border border-card-border rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">New Gladiator</h3>
            <input
              type="text"
              placeholder="Name (e.g. Epsilon)"
              value={newGladiator.name}
              onChange={(e) => setNewGladiator({ ...newGladiator, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted"
            />
            <input
              type="text"
              placeholder="Persona (e.g. The Growth Hacker)"
              value={newGladiator.persona}
              onChange={(e) => setNewGladiator({ ...newGladiator, persona: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted"
            />
            <input
              type="text"
              placeholder="Strategy (e.g. viral-tools)"
              value={newGladiator.strategy}
              onChange={(e) => setNewGladiator({ ...newGladiator, strategy: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted"
            />
            <div className="flex gap-2">
              <select
                value={newGladiator.color}
                onChange={(e) => setNewGladiator({ ...newGladiator, color: e.target.value })}
                className="px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground"
              >
                {Object.keys(COLOR_MAP).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Avatar (1 letter)"
                value={newGladiator.avatar}
                onChange={(e) => setNewGladiator({ ...newGladiator, avatar: e.target.value.slice(0, 1).toUpperCase() })}
                className="w-16 px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground text-center"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={addGladiator}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-background hover:opacity-90"
              >
                Create
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-lg text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Gladiator Detail */}
      {selected && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">{selected.name} — Full Details</h3>

          {/* Advice History */}
          {(selected.adviceGiven.length > 0 || selected.adviceReceived.length > 0) && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h4 className="text-xs font-semibold text-muted mb-2">Advice Given</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selected.adviceGiven.slice(-5).map((a, i) => (
                    <div key={i} className="text-[10px] bg-background rounded p-2">
                      <span className="text-accent">To {arena.gladiators.find((g) => g.id === a.to)?.name}:</span>
                      <span className="text-muted ml-1">{a.advice.slice(0, 200)}</span>
                    </div>
                  ))}
                  {selected.adviceGiven.length === 0 && <p className="text-[10px] text-muted">None yet</p>}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted mb-2">Advice Received</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selected.adviceReceived.slice(-5).map((a, i) => (
                    <div key={i} className="text-[10px] bg-background rounded p-2">
                      <span className="text-success">From {arena.gladiators.find((g) => g.id === a.from)?.name}:</span>
                      <span className="text-muted ml-1">{a.advice.slice(0, 200)}</span>
                    </div>
                  ))}
                  {selected.adviceReceived.length === 0 && <p className="text-[10px] text-muted">None yet</p>}
                </div>
              </div>
            </div>
          )}

          {/* Full Log */}
          <div>
            <h4 className="text-xs font-semibold text-muted mb-2">Complete Log</h4>
            <div className="bg-background rounded-lg p-3 max-h-32 overflow-y-auto font-mono text-[10px] space-y-0.5">
              {selected.log.length > 0
                ? selected.log.map((entry, i) => <div key={i} className="text-muted">{entry}</div>)
                : <div className="text-muted">No activity yet</div>
              }
            </div>
          </div>
        </div>
      )}

      {/* Battle History */}
      {arena.history.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Battle History</h3>
          <div className="space-y-1">
            {arena.history.slice(-10).reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="text-muted font-mono">R{h.round}</span>
                <span className="text-amber-400 font-bold">{h.winner}</span>
                <span className="text-success">${h.profit.toFixed(2)}</span>
                <span className="text-muted">{new Date(h.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Stream */}
      {events.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Battle Feed</h3>
            <span className="text-xs text-muted">{events.length} events</span>
          </div>
          <div ref={logRef} className="bg-background rounded-lg p-3 max-h-56 overflow-y-auto font-mono text-xs space-y-1">
            {events.map((evt, i) => {
              let color = "text-muted";
              let msg = "";

              switch (evt.type) {
                case "battle_start":
                  color = "text-danger font-bold";
                  msg = `BATTLE Round #${evt.round} — ${(evt.gladiators as string[])?.join(" vs ")}`;
                  break;
                case "phase":
                  color = evt.status === "done" ? "text-success" : "text-accent";
                  msg = `[${String(evt.phase).toUpperCase()}] ${evt.message}`;
                  break;
                case "gladiator_action":
                  color = "text-foreground";
                  msg = `${evt.name}: ${evt.action}...`;
                  break;
                case "gladiator_result":
                  color = "text-cyan-400";
                  msg = `${evt.name}: ${evt.project || "researching"} (${evt.progress || 0}%) — ${evt.tokens} tokens`;
                  break;
                case "advice_exchange":
                  color = "text-purple-400";
                  msg = `${evt.from} advises ${evt.to}`;
                  break;
                case "advice_given":
                  color = "text-purple-300";
                  msg = `${evt.from} -> ${evt.to}: "${evt.advice}"`;
                  break;
                case "standing":
                  color = evt.rank === 1 ? "text-amber-400 font-bold" : "text-foreground";
                  msg = `#${evt.rank} ${evt.name}: $${Number(evt.profit).toFixed(2)} profit (${evt.project || "no project"})`;
                  break;
                case "battle_complete":
                  color = "text-danger font-bold";
                  msg = `BATTLE OVER — Winner: ${evt.winner} ($${Number(evt.winnerProfit).toFixed(2)})`;
                  break;
                case "error":
                  color = "text-danger";
                  msg = String(evt.message);
                  break;
                default:
                  msg = JSON.stringify(evt).slice(0, 120);
              }

              return <div key={i} className={color}>{msg}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
