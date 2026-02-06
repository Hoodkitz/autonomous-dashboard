"use client";

import { useState, useEffect, useCallback } from "react";

interface EngineState {
  status: string;
  phase: string | null;
  currentStep: number;
  totalSteps: number;
  lastCheckpoint: string;
  taskDescription: string | null;
  executorTier: string | null;
  engineVersion: string;
  cores: Record<string, string>;
  completedStories: string[];
  failedAttempts: number;
}

const phases = [
  { id: "understand", label: "Understand", desc: "Expand idea + Architecture", cores: ["autopilot", "agentic_dev"] },
  { id: "plan", label: "Plan", desc: "Stories + Tool schemas", cores: ["autopilot", "agentic_dev", "ralph_loop"] },
  { id: "execute", label: "Execute", desc: "Parallel agents + Persistence", cores: ["autopilot", "agentic_dev", "ralph_loop", "ai_agent_workflow"] },
  { id: "validate", label: "Validate", desc: "Multi-reviewer quality gate", cores: ["autopilot", "agentic_dev"] },
  { id: "continuous", label: "Continuous", desc: "Loop until all pass", cores: ["ralph_loop", "ai_agent_workflow"] },
];

const coreLabels: Record<string, { name: string; role: string }> = {
  autopilot: { name: "Autopilot", role: "End-to-end execution pipeline" },
  agentic_dev: { name: "Agentic Dev", role: "Architectural intelligence" },
  ralph_loop: { name: "Ralph Loop", role: "Acceptance criteria persistence" },
  ai_agent_workflow: { name: "AI Workflow", role: "Durability + crash recovery" },
  revenue_engine: { name: "Revenue", role: "Discovery + monetization" },
};

const agentFleet = [
  { id: "claude", name: "Claude CLI", role: "Architect + Primary Coder", color: "accent" },
  { id: "gemini", name: "Gemini CLI", role: "Reviewer + Researcher", color: "cyan" },
  { id: "openclaw", name: "OpenClaw", role: "Multi-platform Gateway", color: "purple" },
];

const statusColors: Record<string, string> = {
  running: "bg-success",
  ready: "bg-muted",
  paused: "bg-warning",
  failed: "bg-danger",
  idle: "bg-muted",
  in_progress: "bg-success",
};

export default function SymbiosisPage() {
  const [state, setState] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/engine");
      if (res.ok) setState(await res.json());
    } catch { /* retry next interval */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const sendAction = async (action: string, task?: string) => {
    setActionLoading(action);
    setLog((p) => [...p, `[${new Date().toLocaleTimeString()}] Action: ${action}`]);
    try {
      const res = await fetch("/api/engine/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, task }),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
      setLog((p) => [...p, `[${new Date().toLocaleTimeString()}] ${action} -> ${data.ok ? "OK" : data.error}`]);
    } catch (err) {
      setLog((p) => [...p, `[${new Date().toLocaleTimeString()}] Error: ${err}`]);
    }
    setActionLoading(null);
  };

  const handleStart = () => {
    if (!taskInput.trim()) return;
    const task = taskInput.trim();
    setTaskInput("");
    // Trigger real execution pipeline
    executeEngine(task);
  };

  const executeEngine = async (task: string) => {
    setLog((p) => [...p, `[${new Date().toLocaleTimeString()}] Starting full 5-phase pipeline: ${task.slice(0, 60)}...`]);
    try {
      const res = await fetch("/api/engine/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
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
            const evt = JSON.parse(line);
            const time = new Date().toLocaleTimeString();
            if (evt.type === "system") {
              setLog((p) => [...p, `[${time}] ${evt.agent}: ${evt.data}`]);
            } else if (evt.type === "done") {
              setLog((p) => [...p, `[${time}] COMPLETE: ${evt.data}`]);
            } else if (evt.type === "error") {
              setLog((p) => [...p, `[${time}] ERROR (${evt.agent}): ${evt.data}`]);
            } else if (evt.type === "stdout") {
              setLog((p) => [...p, `[${time}] ${evt.agent} output: ${evt.data.slice(0, 150).trim()}...`]);
            }
          } catch { /* skip */ }
        }
      }
      // Refresh state after pipeline completes
      fetchState();
    } catch (err) {
      setLog((p) => [...p, `[${new Date().toLocaleTimeString()}] Error: ${err}`]);
    }
  };

  if (loading) return <div className="text-muted p-6">Loading engine state...</div>;
  if (!state) return <div className="text-danger p-6">Failed to load engine state</div>;

  const isRunning = state.status === "in_progress";
  const isPaused = state.status === "paused";
  const activePhaseIdx = phases.findIndex((p) => p.id === state.phase);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Symbiotic Engine</h1>
          <p className="text-sm text-muted mt-0.5">5-Core Architecture + 3-Agent Fleet</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-success pulse-glow" : isPaused ? "bg-warning" : "bg-muted"}`} />
          <span className="text-sm font-medium text-foreground">{state.status.toUpperCase()}</span>
        </div>
      </div>

      {/* Engine Controls */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Engine Controls</h2>
        <div className="flex gap-2 mb-3">
          {!isRunning && !isPaused && (
            <div className="flex gap-2 flex-1">
              <input
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder="Task for the engine (e.g. 'Build an AI chatbot SaaS')..."
                className="flex-1 bg-transparent border border-card-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder-muted"
              />
              <button
                onClick={handleStart}
                disabled={!taskInput.trim() || actionLoading !== null}
                className="px-4 py-2 bg-success text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30"
              >
                {actionLoading === "start" ? "..." : "Start Engine"}
              </button>
            </div>
          )}
          {isRunning && (
            <>
              <button onClick={() => sendAction("pause")} disabled={actionLoading !== null}
                className="px-4 py-2 bg-warning text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30">
                {actionLoading === "pause" ? "..." : "Pause"}
              </button>
              <button onClick={() => sendAction("stop")} disabled={actionLoading !== null}
                className="px-4 py-2 bg-danger text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30">
                {actionLoading === "stop" ? "..." : "Stop"}
              </button>
            </>
          )}
          {isPaused && (
            <>
              <button onClick={() => sendAction("resume")} disabled={actionLoading !== null}
                className="px-4 py-2 bg-success text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30">
                {actionLoading === "resume" ? "..." : "Resume"}
              </button>
              <button onClick={() => sendAction("stop")} disabled={actionLoading !== null}
                className="px-4 py-2 bg-danger text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30">
                {actionLoading === "stop" ? "..." : "Stop"}
              </button>
            </>
          )}
        </div>
        {state.taskDescription && (
          <p className="text-xs text-muted">Active: <span className="text-foreground">{state.taskDescription}</span></p>
        )}
      </div>

      {/* 5-Phase Pipeline */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">5-Phase Symbiotic Pipeline</h2>
        <div className="flex items-center gap-1">
          {phases.map((phase, idx) => {
            const isActive = phase.id === state.phase;
            const isDone = activePhaseIdx > idx;
            return (
              <div key={phase.id} className="flex items-center flex-1">
                <div className={`flex-1 rounded-lg p-3 border transition-all ${
                  isActive ? "border-accent bg-accent-dim pulse-glow" :
                  isDone ? "border-success bg-success-dim" :
                  "border-card-border"
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive ? "bg-accent text-background" :
                      isDone ? "bg-success text-background" :
                      "bg-card-border text-muted"
                    }`}>{idx + 1}</span>
                    <span className={`text-xs font-semibold ${isActive ? "text-accent" : isDone ? "text-success" : "text-muted"}`}>
                      {phase.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted">{phase.desc}</p>
                  <div className="flex gap-0.5 mt-1.5">
                    {phase.cores.map((c) => (
                      <span key={c} className={`text-[8px] px-1 py-0.5 rounded ${
                        isActive ? "bg-accent-dim text-accent" : "bg-card-border text-muted"
                      }`}>{coreLabels[c]?.name || c}</span>
                    ))}
                  </div>
                </div>
                {idx < phases.length - 1 && (
                  <span className={`mx-0.5 text-xs ${isDone ? "text-success" : "text-card-border"}`}>-</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5 Cores Grid */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">5 Symbiotic Cores</h2>
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(state.cores ?? {}).map(([key, status]) => {
            const info = coreLabels[key];
            return (
              <div key={key} className={`bg-card border border-card-border rounded-xl p-3.5 ${status === "running" ? "pulse-glow" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-2 h-2 rounded-full ${statusColors[status] || "bg-muted"}`} />
                  <span className="text-[10px] font-medium text-muted uppercase">{status}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{info?.name || key}</p>
                <p className="text-[10px] text-muted mt-0.5">{info?.role || ""}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent Fleet */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Multi-Agent Fleet</h2>
        <div className="grid grid-cols-3 gap-3">
          {agentFleet.map((agent) => (
            <div key={agent.id} className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-success" : "bg-muted"}`} />
                <span className="text-sm font-semibold text-foreground">{agent.name}</span>
              </div>
              <p className="text-xs text-muted">{agent.role}</p>
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => sendAction("start", `${agent.name}: Run diagnostics`)}
                  className="text-[10px] px-2 py-1 rounded bg-card-border text-muted hover:text-foreground transition-colors"
                >
                  Ping
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Scans */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => sendAction("scan_revenue")} disabled={actionLoading !== null}
          className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-accent transition-colors group">
          <p className="text-sm font-semibold text-foreground group-hover:text-accent">Revenue Scan</p>
          <p className="text-xs text-muted mt-1">Discover money-making opportunities</p>
        </button>
        <button onClick={() => sendAction("scan_skills")} disabled={actionLoading !== null}
          className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-accent transition-colors group">
          <p className="text-sm font-semibold text-foreground group-hover:text-accent">Skill Discovery</p>
          <p className="text-xs text-muted mt-1">Find and install new agent skills</p>
        </button>
        <button onClick={() => sendAction("scan_archives")} disabled={actionLoading !== null}
          className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-accent transition-colors group">
          <p className="text-sm font-semibold text-foreground group-hover:text-accent">Archive Scan</p>
          <p className="text-xs text-muted mt-1">Find incomplete projects to finish</p>
        </button>
      </div>

      {/* Activity Log */}
      {log.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Session Log</h2>
          <div className="font-mono text-[11px] text-muted space-y-0.5 max-h-32 overflow-y-auto">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
