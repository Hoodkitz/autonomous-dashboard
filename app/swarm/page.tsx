"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

interface AgentType {
  id: string;
  name: string;
  role: string;
  domain: string;
}

interface AgentInstance {
  agentId: string;
  instanceId: string;
  status: "idle" | "working" | "done" | "failed" | "spawning";
  startedAt: string;
  completedAt?: string;
  task: string;
  output?: string;
  tokensUsed?: number;
  spawnedAgents?: string[];
}

interface SwarmStatus {
  status: "idle" | "swarming" | "paused";
  cycle: number;
  activeAgents: AgentInstance[];
  completedAgents: AgentInstance[];
  totalTokens: number;
  totalProducts: number;
  discoveries: string[];
  evolution: Array<{ agent: string; mutation: string; at: string }>;
  registeredAgents: number;
  agentTypes: AgentType[];
  products: string[];
}

interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

const DOMAIN_COLORS: Record<string, string> = {
  research: "border-cyan-500 bg-cyan-500/10",
  engineering: "border-accent bg-accent/5",
  marketing: "border-purple-500 bg-purple-500/10",
  ops: "border-emerald-500 bg-emerald-500/10",
  evolution: "border-amber-500 bg-amber-500/10",
  niche: "border-rose-500 bg-rose-500/10",
  custom: "border-pink-500 bg-pink-500/10",
};

const DOMAIN_DOT: Record<string, string> = {
  research: "bg-cyan-500",
  engineering: "bg-accent",
  marketing: "bg-purple-500",
  ops: "bg-emerald-500",
  evolution: "bg-amber-500",
  niche: "bg-rose-500",
  custom: "bg-pink-500",
};

const STATUS_STYLE: Record<string, string> = {
  idle: "text-muted",
  working: "text-accent animate-pulse",
  done: "text-success",
  failed: "text-danger",
  spawning: "text-amber-400 animate-pulse",
};

export default function SwarmPage() {
  const [status, setStatus] = useState<SwarmStatus | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [activeGroup, setActiveGroup] = useState<string[]>([]);
  const [nicheHunting, setNicheHunting] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/swarm");
      if (res.ok) setStatus(await res.json());
    } catch { /* retry */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  async function launchSwarm() {
    setStreaming(true);
    setEvents([]);
    setActiveGroup([]);

    try {
      const res = await fetch("/api/swarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "swarm" }),
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
          try {
            const evt: StreamEvent = JSON.parse(line);
            setEvents((prev) => [...prev, evt]);

            if (evt.type === "priority_group") {
              setActiveGroup(evt.agents as string[]);
            } else if (evt.type === "agent_done" || evt.type === "agent_evolved") {
              setActiveGroup((prev) => prev.filter((a) => a !== (evt.agentId as string)));
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* error */ }

    setStreaming(false);
    setActiveGroup([]);
    fetchStatus();
  }

  async function stopSwarm() {
    await fetch("/api/swarm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    fetchStatus();
  }

  async function runAgent(agentId: string) {
    setStreaming(true);
    setEvents([]);

    try {
      const res = await fetch("/api/swarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_agent", agentId }),
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

    setStreaming(false);
    fetchStatus();
  }

  async function triggerEvolve() {
    setStreaming(true);
    setEvents([]);

    try {
      const res = await fetch("/api/swarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evolve" }),
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

    setStreaming(false);
    fetchStatus();
  }

  async function launchNicheHunter() {
    setNicheHunting(true);
    setEvents([]);

    try {
      const res = await fetch("/api/swarm/niche-hunter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hunt" }),
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

    setNicheHunting(false);
    fetchStatus();
  }

  if (!status) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground">Agent Swarm</h1>
        <p className="text-muted mt-2">Loading...</p>
      </div>
    );
  }

  // Memoize agentsByDomain to prevent building the Map on every streaming render
  const agentsByDomain = useMemo(() => {
    const map = new Map<string, AgentType[]>();
    for (const a of status.agentTypes) {
      const group = map.get(a.domain) || [];
      group.push(a);
      map.set(a.domain, group);
    }
    return map;
  }, [status.agentTypes]);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Agent Swarm</h1>
          <p className="text-xs text-muted mt-1">
            Self-evolving multi-agent system — {status.registeredAgents} agents registered
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded font-medium ${
            status.status === "swarming" ? "bg-accent/20 text-accent animate-pulse" :
            status.status === "paused" ? "bg-warning/20 text-warning" : "bg-card-border text-muted"
          }`}>
            {status.status.toUpperCase()}
          </span>
          <span className="text-xs text-muted">Cycle #{status.cycle}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Agents", value: status.registeredAgents, color: "text-foreground" },
          { label: "Cycles", value: status.cycle, color: "text-accent" },
          { label: "Tokens", value: status.totalTokens.toLocaleString(), color: "text-cyan-400" },
          { label: "Products", value: status.totalProducts, color: "text-success" },
          { label: "Evolutions", value: status.evolution.length, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-card-border rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Swarm Controls</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={launchSwarm}
            disabled={streaming}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              streaming
                ? "bg-accent/20 text-accent animate-pulse cursor-wait"
                : "bg-accent text-background hover:scale-105 hover:shadow-lg hover:shadow-accent/25"
            }`}
          >
            {streaming && status.status === "swarming" ? "Swarming..." : "Launch Full Swarm"}
          </button>
          <button
            onClick={triggerEvolve}
            disabled={streaming}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
          >
            Trigger Evolution
          </button>
          <button
            onClick={launchNicheHunter}
            disabled={nicheHunting || streaming}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              nicheHunting
                ? "bg-rose-500/20 text-rose-400 animate-pulse cursor-wait"
                : "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
            } disabled:opacity-50`}
          >
            {nicheHunting ? "Hunting Niches..." : "Niche & AI Gap Hunter"}
          </button>
          {status.status === "swarming" && (
            <button
              onClick={stopSwarm}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-danger/20 text-danger hover:bg-danger/30"
            >
              Stop Swarm
            </button>
          )}
        </div>
      </div>

      {/* Agent Hive - Visual Grid by Domain */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Agent Hive</h3>
        <div className="space-y-4">
          {[...agentsByDomain.entries()].map(([domain, agents]) => (
            <div key={domain}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${DOMAIN_DOT[domain] || "bg-muted"}`} />
                <span className="text-xs font-medium text-muted uppercase tracking-wider">{domain}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {agents.map((agent) => {
                  const isActive = activeGroup.includes(agent.id);
                  const completed = status.completedAgents.find((a) => a.agentId === agent.id);
                  const agentStatus = isActive ? "working" : completed?.status || "idle";

                  return (
                    <button
                      key={agent.id}
                      onClick={() => !streaming && runAgent(agent.id)}
                      disabled={streaming}
                      className={`border rounded-lg p-3 text-left transition-all hover:scale-[1.02] disabled:hover:scale-100 ${
                        DOMAIN_COLORS[domain] || "border-card-border bg-card"
                      } ${isActive ? "ring-1 ring-accent animate-pulse" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase text-muted">{agent.id}</span>
                        <span className={`text-[9px] font-bold ${STATUS_STYLE[agentStatus] || "text-muted"}`}>
                          {agentStatus === "working" ? "ACTIVE" : agentStatus === "done" ? "DONE" : agentStatus === "failed" ? "FAIL" : ""}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground truncate">{agent.name}</p>
                      <p className="text-[10px] text-muted truncate">{agent.role}</p>
                      {completed?.tokensUsed && (
                        <p className="text-[9px] text-muted mt-1">{completed.tokensUsed.toLocaleString()} tokens</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stream Log */}
      {events.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Live Feed</h3>
            <span className="text-xs text-muted">{events.length} events</span>
          </div>
          <div ref={logRef} className="bg-background rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
            {events.map((evt, i) => {
              let color = "text-muted";
              let prefix = "";

              switch (evt.type) {
                case "swarm_start": color = "text-accent font-bold"; prefix = "SWARM"; break;
                case "priority_group": color = "text-cyan-400"; prefix = `P${evt.priority}`; break;
                case "agent_start": color = "text-foreground"; prefix = String(evt.agentId).toUpperCase(); break;
                case "agent_done":
                  color = evt.status === "done" ? "text-success" : "text-danger";
                  prefix = String(evt.agentId).toUpperCase();
                  break;
                case "agent_evolved": color = "text-amber-400 font-bold"; prefix = "EVOLVE"; break;
                case "product_created": color = "text-success font-bold"; prefix = "PRODUCT"; break;
                case "swarm_complete": color = "text-accent font-bold"; prefix = "DONE"; break;
                case "niche_found": color = "text-rose-400"; prefix = "NICHE"; break;
                case "gap_found": color = "text-purple-400"; prefix = "GAP"; break;
                case "hunt_complete": color = "text-success font-bold"; prefix = "HUNT"; break;
                case "error": color = "text-danger"; prefix = "ERROR"; break;
                default: color = "text-muted"; prefix = evt.type?.toString().toUpperCase() || "?";
              }

              const message = evt.message || evt.name || evt.preview || evt.product ||
                (evt.type === "swarm_start" ? `Cycle #${evt.cycle} — ${evt.agents} agents` : "") ||
                (evt.type === "priority_group" ? `Running: ${(evt.agents as string[])?.join(", ")}` : "") ||
                (evt.type === "agent_start" ? `${evt.name} (${evt.role})` : "") ||
                (evt.type === "agent_done" ? `${evt.name} — ${evt.tokens} tokens` : "") ||
                (evt.type === "swarm_complete" ? `${evt.agentsRan} agents, ${evt.totalTokens} tokens, ${evt.products} products` : "") ||
                JSON.stringify(evt).slice(0, 120);

              return (
                <div key={i} className={color}>
                  <span className="opacity-50">[{prefix}]</span> {String(message)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evolutions */}
      {status.evolution.length > 0 && (
        <div className="bg-card border border-amber-500/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-3">Evolution Log</h3>
          <div className="space-y-2">
            {status.evolution.map((evo, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-foreground font-medium">{evo.mutation}</span>
                <span className="text-muted">{new Date(evo.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products Created */}
      {status.products.length > 0 && (
        <div className="bg-card border border-success/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-success mb-3">Products Created</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {status.products.map((p) => (
              <div key={p} className="border border-card-border rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-foreground">{p}</p>
                <p className="text-[10px] text-muted mt-0.5">~/.autonomous-engine/money-machine/products/{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
