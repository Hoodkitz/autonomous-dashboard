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

interface Capability {
  id: string;
  name: string;
  type: string;
  strengths: string[];
  speed: string;
  cost: string;
  available: boolean;
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
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [useUnified, setUseUnified] = useState(true);
  const [researchLoading, setResearchLoading] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/engine");
      if (res.ok) setState(await res.json());
    } catch { /* retry */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);

    // Fetch capabilities
    fetch("/api/orchestrator")
      .then((r) => r.json())
      .then((data) => { if (data.capabilities) setCapabilities(data.capabilities); })
      .catch(() => {});

    return () => clearInterval(interval);
  }, [fetchState]);

  const addLog = (msg: string) => {
    setLog((p) => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const sendAction = async (action: string, task?: string) => {
    setActionLoading(action);
    addLog(`Action: ${action}`);
    try {
      const res = await fetch("/api/engine/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, task }),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
      addLog(`${action} -> ${data.ok ? "OK" : data.error}`);
    } catch (err) {
      addLog(`Error: ${err}`);
    }
    setActionLoading(null);
  };

  const handleStart = async () => {
    if (!taskInput.trim()) return;
    const goal = taskInput.trim();
    setTaskInput("");

    if (useUnified) {
      await executeUnified(goal);
    } else {
      await executeLegacy(goal);
    }
  };

  const executeUnified = async (goal: string) => {
    addLog(`UNIFIED ORCHESTRATOR: ${goal.slice(0, 80)}...`);
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, prefer_free: true, auto_optimize: true }),
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
            if (evt.type === "phase") {
              addLog(`PHASE: ${evt.phase} - ${evt.message}`);
            } else if (evt.type === "plan") {
              addLog(`PLAN: ${evt.total_steps} steps - ${evt.steps.map((s: { agent: string }) => s.agent).join(" -> ")}`);
            } else if (evt.type === "step_start") {
              addLog(`STEP [${evt.agent}]: ${evt.action}`);
            } else if (evt.type === "step_result") {
              const status = evt.success ? "OK" : "FAILED";
              addLog(`RESULT [${evt.agent}]: ${status} (${evt.duration_ms}ms) - ${(evt.output || evt.error || "").slice(0, 120)}`);
            } else if (evt.type === "progress") {
              addLog(`PROGRESS: ${evt.current}/${evt.total} ${evt.success ? "passed" : "failed"}`);
            } else if (evt.type === "optimization") {
              addLog(`SELF-OPTIMIZE: ${evt.analysis?.slice(0, 200)}`);
            } else if (evt.type === "complete") {
              addLog(`COMPLETE: ${evt.summary.steps_succeeded}/${evt.summary.steps_total} succeeded, ${evt.summary.agents_used.join("+")} in ${evt.summary.total_duration_ms}ms`);
            } else if (evt.type === "error") {
              addLog(`ERROR: ${evt.data}`);
            }
          } catch { /* skip */ }
        }
      }
      fetchState();
    } catch (err) {
      addLog(`Error: ${err}`);
    }
  };

  const executeLegacy = async (task: string) => {
    addLog(`LEGACY PIPELINE: ${task.slice(0, 80)}...`);
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
            if (evt.type === "system") addLog(`${evt.agent}: ${evt.data}`);
            else if (evt.type === "done") addLog(`COMPLETE: ${evt.data}`);
            else if (evt.type === "error") addLog(`ERROR (${evt.agent}): ${evt.data}`);
            else if (evt.type === "stdout") addLog(`${evt.agent}: ${evt.data.slice(0, 150).trim()}`);
          } catch { /* skip */ }
        }
      }
      fetchState();
    } catch (err) {
      addLog(`Error: ${err}`);
    }
  };

  const runRevenueResearch = async () => {
    setResearchLoading(true);
    addLog("REVENUE RESEARCH: Starting autonomous analysis...");
    try {
      const res = await fetch("/api/revenue/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: "" }),
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
            if (evt.type === "status") addLog(`RESEARCH: ${evt.message}`);
            else if (evt.type === "result") {
              addLog(`RESEARCH: Found ${evt.total_found} opportunities, ${evt.revolutionary_ideas?.length || 0} revolutionary ideas`);
              if (evt.revolutionary_ideas?.length) {
                evt.revolutionary_ideas.forEach((idea: string) => addLog(`REVOLUTIONARY: ${idea}`));
              }
            }
            else if (evt.type === "error") addLog(`RESEARCH ERROR: ${evt.data}`);
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      addLog(`Research error: ${err}`);
    }
    setResearchLoading(false);
  };

  if (loading) return <div className="text-muted p-6">Loading engine state...</div>;
  if (!state) return <div className="text-danger p-6">Failed to load engine state</div>;

  const isRunning = state.status === "in_progress";
  const isPaused = state.status === "paused";
  const activePhaseIdx = phases.findIndex((p) => p.id === state.phase);

  const freeAgents = capabilities.filter((c) => c.cost === "free");
  const cliAgents = capabilities.filter((c) => c.type === "cli_agent");
  const apiModels = capabilities.filter((c) => c.type === "api_model");

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Symbiotic Engine</h1>
          <p className="text-sm text-muted mt-0.5">
            5-Core + {capabilities.length} Agents ({freeAgents.length} free) - Unified Orchestration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-success pulse-glow" : isPaused ? "bg-warning" : "bg-muted"}`} />
          <span className="text-sm font-medium text-foreground">{state.status.toUpperCase()}</span>
        </div>
      </div>

      {/* Engine Controls */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Engine Controls</h2>
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input type="checkbox" checked={useUnified} onChange={(e) => setUseUnified(e.target.checked)} className="rounded" />
            Unified Orchestrator (multi-agent AI planning)
          </label>
        </div>
        <div className="flex gap-2 mb-3">
          {!isRunning && !isPaused && (
            <div className="flex gap-2 flex-1">
              <input
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder="Goal for the engine (e.g. 'Build AI chatbot SaaS and deploy to Vercel')..."
                className="flex-1 bg-transparent border border-card-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder-muted"
              />
              <button
                onClick={handleStart}
                disabled={!taskInput.trim() || actionLoading !== null}
                className="px-4 py-2 bg-success text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30"
              >
                Execute
              </button>
            </div>
          )}
          {isRunning && (
            <>
              <button onClick={() => sendAction("pause")} disabled={actionLoading !== null}
                className="px-4 py-2 bg-warning text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30">Pause</button>
              <button onClick={() => sendAction("stop")} disabled={actionLoading !== null}
                className="px-4 py-2 bg-danger text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30">Stop</button>
            </>
          )}
          {isPaused && (
            <>
              <button onClick={() => sendAction("resume")} disabled={actionLoading !== null}
                className="px-4 py-2 bg-success text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30">Resume</button>
              <button onClick={() => sendAction("stop")} disabled={actionLoading !== null}
                className="px-4 py-2 bg-danger text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30">Stop</button>
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

      {/* Unified Agent Fleet */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Unified Agent Fleet ({capabilities.length} total)
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {/* CLI Agents */}
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">CLI Agents ({cliAgents.length})</h3>
            <div className="space-y-2">
              {cliAgents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${agent.available ? "bg-success" : "bg-muted"}`} />
                    <span className="text-sm text-foreground">{agent.name}</span>
                  </div>
                  <div className="flex gap-1">
                    {agent.strengths.slice(0, 3).map((s) => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-card-border text-muted">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* OpenRouter Models */}
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">OpenRouter Models ({apiModels.length})</h3>
            <div className="space-y-2">
              {apiModels.map((model) => (
                <div key={model.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${model.cost === "free" ? "bg-success" : "bg-warning"}`} />
                    <span className="text-sm text-foreground">{model.name}</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${model.cost === "free" ? "bg-success-dim text-success" : "bg-warning-dim text-warning"}`}>
                    {model.cost}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        <button onClick={() => sendAction("scan_revenue")} disabled={actionLoading !== null}
          className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-accent transition-colors group">
          <p className="text-sm font-semibold text-foreground group-hover:text-accent">Revenue Scan</p>
          <p className="text-xs text-muted mt-1">Find opportunities</p>
        </button>
        <button onClick={runRevenueResearch} disabled={researchLoading}
          className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-success transition-colors group">
          <p className="text-sm font-semibold text-foreground group-hover:text-success">
            {researchLoading ? "Researching..." : "AI Research"}
          </p>
          <p className="text-xs text-muted mt-1">Deep AI revenue analysis</p>
        </button>
        <button onClick={() => sendAction("scan_skills")} disabled={actionLoading !== null}
          className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-accent transition-colors group">
          <p className="text-sm font-semibold text-foreground group-hover:text-accent">Skill Discovery</p>
          <p className="text-xs text-muted mt-1">Find new skills</p>
        </button>
        <button onClick={() => sendAction("scan_archives")} disabled={actionLoading !== null}
          className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-accent transition-colors group">
          <p className="text-sm font-semibold text-foreground group-hover:text-accent">Archive Scan</p>
          <p className="text-xs text-muted mt-1">Find projects</p>
        </button>
      </div>

      {/* Activity Log */}
      {log.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Session Log</h2>
            <button onClick={() => setLog([])} className="text-[10px] text-muted hover:text-foreground">Clear</button>
          </div>
          <div className="font-mono text-[11px] text-muted space-y-0.5 max-h-48 overflow-y-auto">
            {log.map((l, i) => (
              <div key={i} className={l.includes("ERROR") ? "text-danger" : l.includes("COMPLETE") ? "text-success" : ""}>{l}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
