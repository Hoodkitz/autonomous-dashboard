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

interface PipelineStatus {
  active: boolean;
  state?: {
    id: string;
    phase: string;
    goal: string;
    iteration: number;
    cost: { total_usd: number; breakdown: Record<string, number>; api_calls: number };
    plan: Array<{ step: string; agent: string; status: string }>;
    errors: string[];
    research_findings: string[];
    artifacts: Record<string, string>;
    created_at: string;
    updated_at: string;
  };
  message?: string;
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
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [pipelineGoal, setPipelineGoal] = useState("");
  const [pipelineRunning, setPipelineRunning] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/engine");
      if (res.ok) setState(await res.json());
    } catch { /* retry */ }
    setLoading(false);
  }, []);

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline");
      if (res.ok) setPipeline(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchState();
    fetchPipeline();
    const interval = setInterval(() => { fetchState(); fetchPipeline(); }, 3000);

    // Fetch capabilities
    fetch("/api/orchestrator")
      .then((r) => r.json())
      .then((data) => { if (data.capabilities) setCapabilities(data.capabilities); })
      .catch(() => {});

    return () => clearInterval(interval);
  }, [fetchState, fetchPipeline]);

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

  const startPipeline = async (goal: string) => {
    if (!goal.trim()) return;
    setPipelineRunning(true);
    addLog(`PIPELINE: Starting autonomous pipeline for "${goal.slice(0, 80)}..."`);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", goal }),
      });

      if (res.status === 409) {
        const data = await res.json();
        addLog(`PIPELINE: Already active (${data.phase}). Stop it first.`);
        setPipelineRunning(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setPipelineRunning(false); return; }

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
            if (evt.type === "pipeline_start") addLog(`PIPELINE: Started (${evt.id}) - Budget: ${evt.budget}`);
            else if (evt.type === "phase") addLog(`PIPELINE [${evt.phase}]: ${evt.message}`);
            else if (evt.type === "research") addLog(`PIPELINE: Found opportunity: ${evt.opportunity?.name || "unknown"}`);
            else if (evt.type === "plan") addLog(`PIPELINE: Plan with ${evt.steps} steps created`);
            else if (evt.type === "step") addLog(`PIPELINE: Step ${evt.index + 1}/${evt.total} [${evt.agent}]: ${evt.step?.slice(0, 100)}`);
            else if (evt.type === "step_done") addLog(`PIPELINE: Step ${evt.index + 1} ${evt.success ? "DONE" : "FAILED"}`);
            else if (evt.type === "step_retry") addLog(`PIPELINE: Retrying step ${evt.index + 1}...`);
            else if (evt.type === "review") addLog(`PIPELINE: Review: ${evt.content?.slice(0, 200)}`);
            else if (evt.type === "checkpoint") addLog(`PIPELINE: AWAITING GO - Cost: ${evt.cost_so_far}`);
            else if (evt.type === "optimization") addLog(`PIPELINE: Optimization: ${evt.insights?.slice(0, 200)}`);
            else if (evt.type === "pipeline_complete") addLog(`PIPELINE: Complete! Phase: ${evt.phase}, Cost: $${evt.cost?.total_usd?.toFixed(4)}`);
            else if (evt.type === "error") addLog(`PIPELINE ERROR: ${evt.message}`);
            else if (evt.type === "budget") addLog(`PIPELINE: ${evt.message}`);
          } catch { /* skip */ }
        }
      }
      await fetchPipeline();
    } catch (err) {
      addLog(`PIPELINE ERROR: ${err}`);
    }
    setPipelineRunning(false);
  };

  const pipelineAction = async (action: "go" | "stop") => {
    setPipelineRunning(true);
    addLog(`PIPELINE: Sending ${action.toUpperCase()}...`);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const reader = res.body?.getReader();
      if (!reader) { setPipelineRunning(false); return; }

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
            addLog(`PIPELINE: ${evt.type} - ${evt.message || JSON.stringify(evt).slice(0, 120)}`);
          } catch { /* skip */ }
        }
      }
      await fetchPipeline();
    } catch (err) {
      addLog(`PIPELINE ERROR: ${err}`);
    }
    setPipelineRunning(false);
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

      {/* Autonomous Pipeline */}
      <div className="bg-card border border-accent rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-semibold text-accent uppercase tracking-wider">Autonomous Pipeline</h2>
            <p className="text-[10px] text-muted mt-0.5">Plan-and-Execute + ReAct loop with budget controls</p>
          </div>
          {pipeline?.active && pipeline.state && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted">
                Cost: ${pipeline.state.cost.total_usd.toFixed(4)} | Iter: {pipeline.state.iteration}
              </span>
              <span className="w-2 h-2 rounded-full bg-success pulse-glow" />
              <span className="text-[10px] font-medium text-success uppercase">{pipeline.state.phase}</span>
            </div>
          )}
        </div>

        {/* Pipeline input - only when not running */}
        {!pipeline?.active && !pipelineRunning && (
          <div className="flex gap-2 mb-3">
            <input
              value={pipelineGoal}
              onChange={(e) => setPipelineGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startPipeline(pipelineGoal)}
              placeholder="Revenue goal (e.g. 'Build AI chatbot SaaS that earns $500/mo')..."
              className="flex-1 bg-transparent border border-card-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder-muted focus:border-accent"
            />
            <button
              onClick={() => startPipeline(pipelineGoal)}
              disabled={!pipelineGoal.trim() || pipelineRunning}
              className="px-4 py-2 bg-accent text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30"
            >
              Launch Pipeline
            </button>
          </div>
        )}

        {/* Pipeline status */}
        {pipeline?.state && (
          <div className="space-y-3">
            {/* Goal */}
            <p className="text-xs text-muted">Goal: <span className="text-foreground">{pipeline.state.goal}</span></p>

            {/* Plan steps */}
            {pipeline.state.plan.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted uppercase">Build Plan</p>
                {pipeline.state.plan.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                      step.status === "done" ? "bg-success text-background" :
                      step.status === "running" ? "bg-accent text-background pulse-glow" :
                      step.status === "failed" ? "bg-danger text-background" :
                      "bg-card-border text-muted"
                    }`}>{i + 1}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      step.agent === "claude" ? "bg-accent-dim text-accent" :
                      step.agent === "gemini" ? "bg-success-dim text-success" :
                      "bg-warning-dim text-warning"
                    }`}>{step.agent}</span>
                    <span className="text-muted flex-1 truncate">{step.step}</span>
                    <span className={`text-[9px] font-medium ${
                      step.status === "done" ? "text-success" :
                      step.status === "running" ? "text-accent" :
                      step.status === "failed" ? "text-danger" :
                      "text-muted"
                    }`}>{step.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Awaiting go */}
            {pipeline.state.phase === "awaiting_go" && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => pipelineAction("go")}
                  disabled={pipelineRunning}
                  className="px-4 py-2 bg-success text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30"
                >
                  GO - Deploy
                </button>
                <button
                  onClick={() => pipelineAction("stop")}
                  disabled={pipelineRunning}
                  className="px-4 py-2 bg-danger text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30"
                >
                  Stop
                </button>
              </div>
            )}

            {/* Errors */}
            {pipeline.state.errors.length > 0 && (
              <div className="text-[10px] text-danger space-y-0.5">
                {pipeline.state.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        )}

        {/* No pipeline */}
        {!pipeline?.state && !pipelineRunning && (
          <p className="text-[11px] text-muted">No pipeline running. Enter a revenue goal above to start the autonomous build pipeline.</p>
        )}

        {pipelineRunning && !pipeline?.active && (
          <div className="flex items-center gap-2 text-[11px] text-accent">
            <span className="w-2 h-2 rounded-full bg-accent pulse-glow" />
            Pipeline executing...
          </div>
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
