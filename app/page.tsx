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

interface ProactiveAction {
  type: "api_needed" | "revenue_idea" | "improvement" | "debug_suggestion";
  title: string;
  description: string;
  signup_url?: string;
  priority: "high" | "medium" | "low";
  action_required: boolean;
}

const coreInfo: Record<string, { label: string; desc: string }> = {
  autopilot: { label: "Autopilot", desc: "End-to-end execution" },
  agentic_dev: { label: "Agentic Dev", desc: "Architecture patterns" },
  ralph_loop: { label: "Ralph Loop", desc: "Persistence layer" },
  ai_agent_workflow: { label: "AI Workflow", desc: "Crash-proof durability" },
  revenue_engine: { label: "Revenue", desc: "Auto monetization" },
};

const statusColors: Record<string, string> = {
  running: "bg-success text-success",
  ready: "bg-muted text-muted",
  paused: "bg-warning text-warning",
  failed: "bg-danger text-danger",
  idle: "bg-muted text-muted",
  in_progress: "bg-success text-success",
  offline: "bg-muted text-muted",
};

const actionTypeStyles: Record<string, { color: string; bg: string; label: string }> = {
  api_needed: { color: "text-warning", bg: "bg-warning-dim", label: "API Key" },
  revenue_idea: { color: "text-success", bg: "bg-success-dim", label: "Revenue" },
  improvement: { color: "text-accent", bg: "bg-accent-dim", label: "Improve" },
  debug_suggestion: { color: "text-danger", bg: "bg-danger-dim", label: "Debug" },
};

const priorityStyles: Record<string, string> = {
  high: "text-danger",
  medium: "text-warning",
  low: "text-muted",
};

function StatusDot({ status }: { status: string }) {
  const color = statusColors[status]?.split(" ")[0] || "bg-muted";
  return <span className={`w-2 h-2 rounded-full ${color} ${status === "running" || status === "in_progress" ? "pulse-glow" : ""}`} />;
}

interface MoneyPhase {
  phase: string;
  status: string;
  data?: Record<string, unknown>;
  message?: string;
}

interface MoneyMachineState {
  active: boolean;
  phases: MoneyPhase[];
  product: Record<string, unknown> | null;
  log: string[];
  error: string | null;
}

export default function EnginePage() {
  const [state, setState] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [proactiveActions, setProactiveActions] = useState<ProactiveAction[]>([]);
  const [proactiveLoading, setProactiveLoading] = useState(false);
  const [proactiveTimestamp, setProactiveTimestamp] = useState<string | null>(null);
  const [usageInfo, setUsageInfo] = useState<{ usage: number; limit: number | null } | null>(null);
  const [resumeBanner, setResumeBanner] = useState<{
    needs_attention: string[];
    pipeline_goal?: string;
    pipeline_phase?: string;
    engine_task?: string;
  } | null>(null);
  const [moneyMachine, setMoneyMachine] = useState<MoneyMachineState>({
    active: false, phases: [], product: null, log: [], error: null,
  });

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

    // Auto-resume check on startup
    fetch("/api/engine/auto-resume", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.actions?.length > 0) {
          // Fetch full resume status
          fetch("/api/engine/auto-resume")
            .then((r) => r.json())
            .then((status) => {
              if (status.needs_attention?.length > 0) {
                setResumeBanner(status);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    // Load cached proactive actions
    fetch("/api/engine/proactive")
      .then((r) => r.json())
      .then((data) => {
        if (data.actions?.length) {
          setProactiveActions(data.actions);
          setProactiveTimestamp(data.timestamp);
        }
      })
      .catch(() => {});

    // Load OpenRouter usage
    fetch("/api/openrouter/usage")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setUsageInfo(data);
      })
      .catch(() => {});

    return () => clearInterval(interval);
  }, [fetchState]);

  const sendAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await fetch("/api/engine/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
    } catch { /* handled by periodic refresh */ }
    setActionLoading(null);
  };

  const runProactiveScan = async () => {
    setProactiveLoading(true);
    try {
      const res = await fetch("/api/engine/proactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: "Full system analysis requested by user" }),
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
            if (evt.type === "result") {
              setProactiveActions(evt.actions || []);
              setProactiveTimestamp(evt.timestamp);
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* error */ }
    setProactiveLoading(false);
  };

  const launchMoneyMachine = async () => {
    setMoneyMachine({ active: true, phases: [], product: null, log: ["Igniting Ultra Autonomous Money Machine..."], error: null });

    try {
      const res = await fetch("/api/money-machine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });

      if (res.status === 409) {
        setMoneyMachine((prev) => ({ ...prev, log: [...prev.log, "Already running. Check status."] }));
        return;
      }

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

            if (evt.type === "start") {
              setMoneyMachine((prev) => ({ ...prev, log: [...prev.log, `Run #${evt.runCount} started`] }));
            } else if (evt.type === "phase") {
              setMoneyMachine((prev) => {
                const phases = [...prev.phases];
                const idx = phases.findIndex((p) => p.phase === evt.phase);
                if (idx >= 0) {
                  phases[idx] = { ...phases[idx], ...evt };
                } else {
                  phases.push(evt);
                }
                return {
                  ...prev,
                  phases,
                  log: [...prev.log, `[${evt.phase}] ${evt.message || evt.status}`],
                };
              });
            } else if (evt.type === "complete") {
              setMoneyMachine((prev) => ({
                ...prev,
                active: false,
                product: evt.product,
                log: [...prev.log, `COMPLETE: ${evt.product?.name} - ${evt.product?.tagline}`],
              }));
            } else if (evt.type === "error") {
              setMoneyMachine((prev) => ({
                ...prev,
                active: false,
                error: evt.error,
                log: [...prev.log, `ERROR: ${evt.error}`],
              }));
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setMoneyMachine((prev) => ({
        ...prev,
        active: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  };

  if (loading) return <div className="text-muted p-6">Loading...</div>;
  if (!state) return <div className="text-danger p-6">Failed to load engine state</div>;

  const isRunning = state.status === "in_progress";
  const isPaused = state.status === "paused";
  const checkpoint = new Date(state.lastCheckpoint).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Engine Control</h1>
          <p className="text-sm text-muted mt-0.5">v{state.engineVersion} Symbiotic + OpenRouter</p>
        </div>
        <div className="flex items-center gap-4">
          {usageInfo && (
            <div className="text-right">
              <p className="text-xs text-muted">OpenRouter</p>
              <p className="text-sm font-semibold text-foreground">${usageInfo.usage.toFixed(4)}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <StatusDot status={state.status} />
            <span className="text-sm font-semibold text-foreground">{state.status.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Auto-Resume Banner */}
      {resumeBanner && resumeBanner.needs_attention.length > 0 && (
        <div className="bg-warning-dim border border-warning rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-warning">Interrupted Work Detected</p>
              <p className="text-xs text-muted mt-1">
                {resumeBanner.pipeline_goal && `Pipeline: "${resumeBanner.pipeline_goal}" (${resumeBanner.pipeline_phase})`}
                {resumeBanner.engine_task && `Engine: "${resumeBanner.engine_task}"`}
              </p>
              <div className="flex gap-1 mt-1.5">
                {resumeBanner.needs_attention.map((item, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-warning text-background font-medium">{item}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <a href="/symbiosis" className="px-3 py-1.5 bg-success text-background text-xs font-medium rounded-lg hover:opacity-90">
                Resume
              </a>
              <button
                onClick={() => setResumeBanner(null)}
                className="px-3 py-1.5 bg-card-border text-muted text-xs font-medium rounded-lg hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-card-border rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wider">Status</p>
          <p className="text-lg font-bold text-foreground mt-1">{state.status.toUpperCase()}</p>
          <p className="text-xs text-muted mt-1">{checkpoint}</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wider">Phase</p>
          <p className="text-lg font-bold text-accent mt-1">{state.phase || "None"}</p>
          <p className="text-xs text-muted mt-1">Step {state.currentStep}/{state.totalSteps}</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wider">Stories</p>
          <p className="text-lg font-bold text-success mt-1">{state.completedStories.length}</p>
          <p className="text-xs text-muted mt-1">{state.failedAttempts} failures</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wider">Executor</p>
          <p className="text-lg font-bold text-warning mt-1">{state.executorTier || "None"}</p>
          <p className="text-xs text-muted mt-1">{state.taskDescription ? "Task active" : "Idle"}</p>
        </div>
      </div>

      {state.taskDescription && (
        <div className="bg-card border border-accent-dim rounded-xl p-5">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Active Task</h2>
          <p className="text-foreground">{state.taskDescription}</p>
          {state.totalSteps > 0 && (
            <div className="mt-3 w-full bg-card-border rounded-full h-1.5">
              <div className="bg-accent rounded-full h-1.5 transition-all" style={{ width: `${Math.round((state.currentStep / state.totalSteps) * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Proactive Intelligence Panel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Proactive Intelligence</h2>
          <div className="flex items-center gap-2">
            {proactiveTimestamp && (
              <span className="text-[10px] text-muted">
                Last scan: {new Date(proactiveTimestamp).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={runProactiveScan}
              disabled={proactiveLoading}
              className="px-3 py-1.5 text-xs font-medium bg-accent-dim text-accent rounded-lg hover:bg-accent hover:text-background transition-colors disabled:opacity-50"
            >
              {proactiveLoading ? "Analyzing..." : "Run Analysis"}
            </button>
          </div>
        </div>

        {proactiveActions.length > 0 ? (
          <div className="space-y-2">
            {proactiveActions.map((action, i) => {
              const style = actionTypeStyles[action.type] || actionTypeStyles.improvement;
              return (
                <div key={i} className={`bg-card border border-card-border rounded-xl p-4 ${action.action_required ? "border-l-2 border-l-warning" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.color}`}>
                          {style.label}
                        </span>
                        <span className={`text-[10px] font-bold ${priorityStyles[action.priority]}`}>
                          {action.priority.toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{action.title}</span>
                      </div>
                      <p className="text-xs text-muted">{action.description}</p>
                    </div>
                    {action.signup_url && (
                      <a
                        href={action.signup_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-3 py-1.5 text-xs font-medium bg-accent text-background rounded-lg hover:opacity-90 transition-opacity"
                      >
                        Get Key
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl p-5 text-center">
            <p className="text-sm text-muted">
              Click &quot;Run Analysis&quot; to let the engine proactively find what APIs you need, revenue opportunities, and improvements.
            </p>
          </div>
        )}
      </div>

      {/* ULTRA AUTONOMOUS MONEY MACHINE */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-accent bg-gradient-to-br from-card via-card to-accent/5 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Ultra Autonomous Evolve &amp; Earn
              </h2>
              <p className="text-xs text-muted mt-1">
                AI researches market, builds product, deploys, monetizes &mdash; fully autonomous
              </p>
            </div>
            <button
              onClick={launchMoneyMachine}
              disabled={moneyMachine.active}
              className={`relative px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                moneyMachine.active
                  ? "bg-accent/20 text-accent animate-pulse cursor-wait"
                  : "bg-accent text-background hover:scale-105 hover:shadow-lg hover:shadow-accent/25 active:scale-95"
              }`}
            >
              {moneyMachine.active ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                  Running...
                </span>
              ) : (
                "LAUNCH"
              )}
            </button>
          </div>

          {/* Pipeline phases */}
          {moneyMachine.phases.length > 0 && (
            <div className="grid grid-cols-6 gap-1 mb-4">
              {["research", "validate", "plan", "build", "deploy", "monetize"].map((phase) => {
                const p = moneyMachine.phases.find((x) => x.phase === phase);
                const status = p?.status || "pending";
                return (
                  <div
                    key={phase}
                    className={`text-center py-2 rounded-lg text-xs font-medium transition-all ${
                      status === "done" ? "bg-success/20 text-success" :
                      status === "running" ? "bg-accent/20 text-accent animate-pulse" :
                      status === "failed" ? "bg-danger/20 text-danger" :
                      "bg-card-border/50 text-muted"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider">{phase}</div>
                    <div className="text-[9px] mt-0.5">
                      {status === "done" ? "done" : status === "running" ? "..." : status === "failed" ? "fail" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Live log */}
          {moneyMachine.log.length > 0 && (
            <div className="bg-background/50 rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-xs space-y-0.5">
              {moneyMachine.log.map((line, i) => (
                <div key={i} className={`${
                  line.startsWith("ERROR") ? "text-danger" :
                  line.startsWith("COMPLETE") ? "text-success font-bold" :
                  line.startsWith("[") ? "text-accent" : "text-muted"
                }`}>
                  {line}
                </div>
              ))}
            </div>
          )}

          {/* Product result */}
          {moneyMachine.product && (
            <div className="mt-4 bg-success/5 border border-success/30 rounded-xl p-4">
              <h3 className="text-sm font-bold text-success mb-2">Product Generated</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted">Name:</span>
                  <span className="text-foreground ml-1 font-semibold">{String(moneyMachine.product.name)}</span>
                </div>
                <div>
                  <span className="text-muted">Revenue est:</span>
                  <span className="text-success ml-1 font-semibold">${String(moneyMachine.product.estimatedMonthlyRevenue)}/mo</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted">Tagline:</span>
                  <span className="text-foreground ml-1">{String(moneyMachine.product.tagline)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted">Pricing:</span>
                  <span className="text-foreground ml-1">
                    Free: {String((moneyMachine.product.pricing as Record<string, unknown>)?.free)} |
                    Pro: ${String((moneyMachine.product.pricing as Record<string, unknown>)?.proPrice)}/mo
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted mt-2">
                Code saved. Deploy with: <code className="text-accent">cd ~/.autonomous-engine/money-machine/products/product-*/deploy &amp;&amp; npm i &amp;&amp; npx vercel</code>
              </p>
            </div>
          )}

          {moneyMachine.error && (
            <div className="mt-3 text-xs text-danger bg-danger/5 rounded-lg p-3">
              {moneyMachine.error}
            </div>
          )}

          {/* What it does */}
          {moneyMachine.phases.length === 0 && !moneyMachine.product && (
            <div className="grid grid-cols-6 gap-1">
              {[
                { label: "Research", desc: "AI finds profitable niche" },
                { label: "Validate", desc: "Scores demand + feasibility" },
                { label: "Plan", desc: "Full architecture + DB" },
                { label: "Build", desc: "Generates complete code" },
                { label: "Deploy", desc: "Vercel-ready package" },
                { label: "Monetize", desc: "Pricing + finance tracking" },
              ].map((step) => (
                <div key={step.label} className="text-center py-2 rounded-lg bg-card-border/30">
                  <div className="text-[10px] uppercase tracking-wider text-muted">{step.label}</div>
                  <div className="text-[9px] text-muted/60 mt-0.5">{step.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agent Swarm Quick Launch */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-card via-card to-amber-500/5 p-5">
        <div className="absolute top-0 left-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              Agent Swarm &amp; Niche Hunter
            </h2>
            <p className="text-xs text-muted mt-1">
              Self-evolving agent hive — discovers AI gaps, builds solutions, monetizes autonomously
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/swarm"
              className="px-4 py-2 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              Open Swarm
            </a>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {!isRunning && !isPaused && (
            <button onClick={() => sendAction("start")} disabled={actionLoading !== null}
              className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-success transition-colors group">
              <p className="text-sm font-semibold text-foreground group-hover:text-success">
                {actionLoading === "start" ? "Starting..." : "Start Engine"}
              </p>
              <p className="text-xs text-muted mt-1">Activate all 5 cores</p>
            </button>
          )}
          {isRunning && (
            <button onClick={() => sendAction("pause")} disabled={actionLoading !== null}
              className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-warning transition-colors group">
              <p className="text-sm font-semibold text-foreground group-hover:text-warning">Pause Engine</p>
              <p className="text-xs text-muted mt-1">Pause all cores</p>
            </button>
          )}
          {isPaused && (
            <button onClick={() => sendAction("resume")} disabled={actionLoading !== null}
              className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-success transition-colors group">
              <p className="text-sm font-semibold text-foreground group-hover:text-success">Resume Engine</p>
              <p className="text-xs text-muted mt-1">Continue from checkpoint</p>
            </button>
          )}
          {(isRunning || isPaused) && (
            <button onClick={() => sendAction("stop")} disabled={actionLoading !== null}
              className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-danger transition-colors group">
              <p className="text-sm font-semibold text-foreground group-hover:text-danger">Stop Engine</p>
              <p className="text-xs text-muted mt-1">Stop all cores</p>
            </button>
          )}
          <button onClick={() => sendAction("scan_revenue")} disabled={actionLoading !== null}
            className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-accent transition-colors group">
            <p className="text-sm font-semibold text-foreground group-hover:text-accent">
              {actionLoading === "scan_revenue" ? "Scanning..." : "Revenue Scan"}
            </p>
            <p className="text-xs text-muted mt-1">Find money opportunities</p>
          </button>
          <button onClick={() => sendAction("scan_skills")} disabled={actionLoading !== null}
            className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-accent transition-colors group">
            <p className="text-sm font-semibold text-foreground group-hover:text-accent">
              {actionLoading === "scan_skills" ? "Scanning..." : "Skill Discovery"}
            </p>
            <p className="text-xs text-muted mt-1">Find new agent skills</p>
          </button>
          <button onClick={() => sendAction("scan_archives")} disabled={actionLoading !== null}
            className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-accent transition-colors group">
            <p className="text-sm font-semibold text-foreground group-hover:text-accent">
              {actionLoading === "scan_archives" ? "Scanning..." : "Archive Scan"}
            </p>
            <p className="text-xs text-muted mt-1">Find projects to complete</p>
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Engine Cores</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(state.cores ?? {}).map(([key, status]) => (
            <div key={key} className={`bg-card border border-card-border rounded-xl p-3.5 ${status === "running" ? "pulse-glow" : ""}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted uppercase">{coreInfo[key]?.label || key}</span>
                <StatusDot status={status} />
              </div>
              <p className="text-xs text-muted">{coreInfo[key]?.desc || ""}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Multi-Agent Fleet</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-card-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="text-sm font-medium text-foreground">Claude CLI</span>
            </div>
            <p className="text-xs text-muted">Primary architect + coder</p>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="text-sm font-medium text-foreground">Gemini CLI</span>
            </div>
            <p className="text-xs text-muted">Reviewer + researcher</p>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="text-sm font-medium text-foreground">OpenClaw</span>
            </div>
            <p className="text-xs text-muted">Multi-platform gateway</p>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              <span className="text-sm font-medium text-foreground">OpenRouter</span>
            </div>
            <p className="text-xs text-muted">300+ AI models gateway</p>
          </div>
        </div>
      </div>
    </div>
  );
}
