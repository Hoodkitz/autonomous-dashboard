"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface AvailableProject {
  name: string;
  path: string;
  source: string;
  hasPackageJson: boolean;
  hasVercelJson: boolean;
  completeness: number;
}

interface Deployment {
  id: string;
  name: string;
  source: string;
  sourcePath: string;
  platform: string;
  status: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
  revenue: number;
  visits: number;
}

interface DeployState {
  deployments: Deployment[];
  totalDeployed: number;
  totalRevenue: number;
  platforms: Record<string, { configured: boolean }>;
  autoDeployEnabled: boolean;
  lastScan: string;
  availableProjects: AvailableProject[];
}

interface RouterState {
  activeModelName: string;
  activeModel: string;
  credits: { remaining: number; lowWarning: boolean; lastChecked: string };
  totalRequests: number;
  dailyRequests: number;
  totalSwitches: number;
  neverStop: boolean;
  availableModels: Array<{ id: string; name: string; quality: number; speed: number }>;
  modelUsage: Record<string, { totalRequests: number; failures: number; blocked: boolean; requestsToday: number }>;
}

interface StreamEvent { type: string; [key: string]: unknown; }

const PLATFORM_COLORS: Record<string, string> = {
  vercel: "text-foreground",
  cloudflare: "text-amber-400",
  railway: "text-purple-400",
  "github-pages": "text-cyan-400",
  local: "text-muted",
};

const SOURCE_BADGE: Record<string, { bg: string; text: string }> = {
  "money-machine": { bg: "bg-success/20", text: "text-success" },
  swarm: { bg: "bg-amber-500/20", text: "text-amber-400" },
  dashboard: { bg: "bg-accent/20", text: "text-accent" },
};

export default function DeployPage() {
  const [state, setState] = useState<DeployState | null>(null);
  const [router, setRouter] = useState<RouterState | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [advice, setAdvice] = useState<string>("");
  const [advising, setAdvising] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const fetchState = useCallback(async () => {
    try {
      const [dRes, rRes] = await Promise.all([
        fetch("/api/deploy"),
        fetch("/api/smart-router"),
      ]);
      if (dRes.ok) setState(await dRes.json());
      if (rRes.ok) setRouter(await rRes.json());
    } catch { /* */ }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchState();
    const interval = setInterval(fetchState, 10000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  async function scanProjects() {
    setScanning(true);
    await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan" }),
    });
    await fetchState();
    setScanning(false);
  }

  async function prepareProject(projectName: string, platform: string = "vercel") {
    setPreparing(true);
    setEvents([]);
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", project: projectName, platform }),
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
    setPreparing(false);
    fetchState();
  }

  async function getAdvice() {
    setAdvising(true);
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advise" }),
      });
      const data = await res.json();
      setAdvice(data.advice || "No advice available");
    } catch { setAdvice("Failed to get advice"); }
    setAdvising(false);
  }

  async function toggleNeverStop() {
    await fetch("/api/smart-router", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_never_stop" }),
    });
    fetchState();
  }

  async function resetModels() {
    await fetch("/api/smart-router", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    fetchState();
  }

  if (!state) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground">Self-Deployment</h1>
        <p className="text-muted mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Self-Deployment Hub</h1>
          <p className="text-xs text-muted mt-1">
            Build, deploy, and manage products — LLM auto-switches to never stop
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={scanProjects} disabled={scanning}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card-border text-foreground hover:bg-accent hover:text-background disabled:opacity-50">
            {scanning ? "Scanning..." : "Scan Projects"}
          </button>
          <button onClick={getAdvice} disabled={advising}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/20 text-accent hover:bg-accent hover:text-background disabled:opacity-50">
            {advising ? "Thinking..." : "AI Deploy Advisor"}
          </button>
        </div>
      </div>

      {/* Never-Stop Model Router Status */}
      {router && (
        <div className={`border rounded-xl p-4 ${
          router.credits.lowWarning ? "border-warning bg-warning/5" : "border-accent/30 bg-card"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-foreground">Never-Stop LLM Router</h3>
              <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                router.neverStop ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
              }`}>
                {router.neverStop ? "NEVER STOPS" : "CAN STOP"}
              </span>
              {router.credits.lowWarning && (
                <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-warning/20 text-warning animate-pulse">
                  LOW CREDITS
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={toggleNeverStop}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  router.neverStop ? "bg-success/20 text-success" : "bg-card-border text-muted"
                }`}>
                {router.neverStop ? "Never-Stop: ON" : "Never-Stop: OFF"}
              </button>
              <button onClick={resetModels}
                className="px-3 py-1 rounded text-xs font-medium bg-card-border text-muted hover:text-foreground">
                Reset Blocks
              </button>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-3 text-center text-xs">
            <div>
              <div className="text-sm font-bold text-accent">{router.activeModelName}</div>
              <div className="text-[10px] text-muted">Active Model</div>
            </div>
            <div>
              <div className="text-sm font-bold text-success">${router.credits.remaining.toFixed(4)}</div>
              <div className="text-[10px] text-muted">Credits</div>
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">{router.totalRequests.toLocaleString()}</div>
              <div className="text-[10px] text-muted">Total Req</div>
            </div>
            <div>
              <div className="text-sm font-bold text-cyan-400">{router.dailyRequests}</div>
              <div className="text-[10px] text-muted">Today</div>
            </div>
            <div>
              <div className="text-sm font-bold text-warning">{router.totalSwitches}</div>
              <div className="text-[10px] text-muted">Switches</div>
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">{router.availableModels?.length || 0}</div>
              <div className="text-[10px] text-muted">Models</div>
            </div>
          </div>

          {/* Model health bar */}
          <div className="mt-3 flex gap-1">
            {router.availableModels?.map((m) => {
              const usage = router.modelUsage?.[m.id];
              const isActive = m.id === router.activeModel;
              const isBlocked = usage?.blocked;
              const hasFailures = (usage?.failures || 0) > 0;
              return (
                <div
                  key={m.id}
                  className={`h-2 flex-1 rounded-full transition-all ${
                    isActive ? "bg-accent" :
                    isBlocked ? "bg-danger" :
                    hasFailures ? "bg-warning" : "bg-success/40"
                  }`}
                  title={`${m.name}: ${isActive ? "ACTIVE" : isBlocked ? "BLOCKED" : "OK"} (${usage?.totalRequests || 0} req, ${usage?.failures || 0} fail)`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[8px] text-muted">Best quality</span>
            <span className="text-[8px] text-muted">Fastest</span>
          </div>
        </div>
      )}

      {/* AI Advice */}
      {advice && (
        <div className="bg-card border border-accent/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-accent mb-2">AI Deploy Advisor</h3>
          <div className="text-xs text-foreground/80 whitespace-pre-wrap">{advice}</div>
        </div>
      )}

      {/* Available Projects */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Available Projects ({state.availableProjects.length})</h3>
          {state.lastScan && <span className="text-[10px] text-muted">Last scan: {new Date(state.lastScan).toLocaleString()}</span>}
        </div>

        {state.availableProjects.length > 0 ? (
          <div className="space-y-2">
            {state.availableProjects.map((project) => {
              const badge = SOURCE_BADGE[project.source] || { bg: "bg-muted/20", text: "text-muted" };
              const deployed = state.deployments.find((d) => d.name === project.name);
              return (
                <div key={project.name} className="flex items-center gap-3 p-3 rounded-lg border border-card-border hover:border-accent/30 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{project.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${badge.bg} ${badge.text}`}>
                        {project.source}
                      </span>
                      {deployed && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          deployed.status === "live" ? "bg-success/20 text-success" : "bg-card-border text-muted"
                        }`}>
                          {deployed.status}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <div className="w-20 h-1.5 bg-card-border rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${project.completeness >= 80 ? "bg-success" : project.completeness >= 40 ? "bg-warning" : "bg-danger"}`}
                            style={{ width: `${project.completeness}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted">{project.completeness}%</span>
                      </div>
                      <span className="text-[10px] text-muted">
                        {project.hasPackageJson ? "pkg" : ""} {project.hasVercelJson ? "vercel" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => prepareProject(project.name, "vercel")}
                      disabled={preparing}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-background hover:opacity-90 disabled:opacity-50"
                    >
                      {preparing ? "..." : "Prepare"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted">
            <p className="text-sm">No projects found</p>
            <p className="text-xs mt-1">Run the Money Machine or Swarm to generate products, then scan.</p>
          </div>
        )}
      </div>

      {/* Active Deployments */}
      {state.deployments.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Deployments ({state.deployments.length})</h3>
          <div className="space-y-2">
            {state.deployments.map((dep) => (
              <div key={dep.id} className="flex items-center gap-3 p-3 rounded-lg border border-card-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{dep.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      dep.status === "live" ? "bg-success/20 text-success" :
                      dep.status === "failed" ? "bg-danger/20 text-danger" :
                      dep.status === "building" || dep.status === "deploying" ? "bg-accent/20 text-accent animate-pulse" :
                      "bg-card-border text-muted"
                    }`}>
                      {dep.status}
                    </span>
                    <span className={`text-[10px] ${PLATFORM_COLORS[dep.platform] || "text-muted"}`}>
                      {dep.platform}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted">
                    <span>{dep.source}</span>
                    <span>{new Date(dep.updatedAt).toLocaleString()}</span>
                    {dep.url && (
                      <a href={dep.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        {dep.url}
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-success">${dep.revenue.toFixed(2)}</div>
                  <div className="text-[10px] text-muted">{dep.visits} visits</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platforms */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Hosting Platforms</h3>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(state.platforms).map(([name, config]) => (
            <div key={name} className={`border rounded-lg p-3 text-center ${
              config.configured ? "border-success/30 bg-success/5" : "border-card-border"
            }`}>
              <div className={`text-sm font-bold ${PLATFORM_COLORS[name] || "text-foreground"}`}>
                {name}
              </div>
              <div className="text-[10px] text-muted mt-1">
                {config.configured ? "Configured" : "Not set up"}
              </div>
              <div className="text-[9px] text-muted mt-0.5">Free tier</div>
            </div>
          ))}
        </div>
      </div>

      {/* Deploy Stream Log */}
      {events.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Deployment Log</h3>
          <div ref={logRef} className="bg-background rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
            {events.map((evt, i) => {
              let color = "text-muted";
              let msg = "";
              switch (evt.type) {
                case "start": color = "text-accent font-bold"; msg = `Preparing ${evt.project} for ${evt.platform}`; break;
                case "phase": color = evt.status === "done" ? "text-success" : "text-accent"; msg = `[${String(evt.phase).toUpperCase()}] ${evt.message}`; break;
                case "file_created": color = "text-cyan-400"; msg = `Created: ${evt.path}`; break;
                case "complete": color = "text-success font-bold"; msg = String(evt.message); break;
                case "error": color = "text-danger"; msg = String(evt.message); break;
                default: msg = JSON.stringify(evt).slice(0, 120);
              }
              return <div key={i} className={color}>{msg}</div>;
            })}
          </div>
        </div>
      )}

      {/* Deploy Instructions */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Deploy Commands</h3>
        <div className="space-y-2 text-xs">
          <div>
            <span className="text-muted">Vercel (free):</span>
            <code className="text-accent ml-2">cd [project-dir] &amp;&amp; npm i &amp;&amp; npx vercel</code>
          </div>
          <div>
            <span className="text-muted">Cloudflare Pages:</span>
            <code className="text-accent ml-2">npx wrangler pages deploy out/</code>
          </div>
          <div>
            <span className="text-muted">Railway:</span>
            <code className="text-accent ml-2">railway up</code>
          </div>
          <div>
            <span className="text-muted">Dashboard itself:</span>
            <code className="text-accent ml-2">cd ~/autonomous-dashboard &amp;&amp; npx vercel</code>
          </div>
        </div>
      </div>
    </div>
  );
}
