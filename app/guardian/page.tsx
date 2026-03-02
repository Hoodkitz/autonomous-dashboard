"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export const runtime = "nodejs";


interface HealthCheck {
  id: string;
  name: string;
  target: string;
  type: string;
  status: "healthy" | "degraded" | "broken" | "unknown";
  lastCheck: string;
  message: string;
  autoFixable: boolean;
  fixAttempts: number;
  fixHistory: Array<{ at: string; action: string; result: string }>;
}

interface Alert {
  at: string;
  severity: "info" | "warning" | "critical";
  message: string;
  resolved: boolean;
}

interface GuardianState {
  status: string;
  lastScan: string;
  totalScans: number;
  totalFixes: number;
  totalIssues: number;
  checks: HealthCheck[];
  alerts: Alert[];
  aiDiagnosis: string;
  overallHealth: number;
}

interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  healthy: { bg: "bg-success/20", text: "text-success", label: "OK" },
  degraded: { bg: "bg-warning/20", text: "text-warning", label: "WARN" },
  broken: { bg: "bg-danger/20", text: "text-danger", label: "FAIL" },
  unknown: { bg: "bg-muted/20", text: "text-muted", label: "?" },
};

const SEVERITY_STYLE: Record<string, { bg: string; text: string }> = {
  info: { bg: "bg-accent/10", text: "text-accent" },
  warning: { bg: "bg-warning/10", text: "text-warning" },
  critical: { bg: "bg-danger/10", text: "text-danger" },
};

export default function GuardianPage() {
  const [state, setState] = useState<GuardianState | null>(null);
  const [scanning, setScanning] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [autoWatch, setAutoWatch] = useState(true); // Auto-start watching
  const logRef = useRef<HTMLDivElement>(null);
  const watchInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/guardian");
      if (res.ok) setState(await res.json());
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 10000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  // Auto-watch: run scan every 60 seconds
  useEffect(() => {
    if (autoWatch) {
      runScan();
      watchInterval.current = setInterval(runScan, 60000);
    } else {
      if (watchInterval.current) clearInterval(watchInterval.current);
    }
    return () => {
      if (watchInterval.current) clearInterval(watchInterval.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWatch]);

  async function runScan() {
    setScanning(true);
    setEvents([]);

    try {
      const res = await fetch("/api/guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", baseUrl: window.location.origin }),
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

    setScanning(false);
    fetchState();
  }

  async function clearAlerts() {
    await fetch("/api/guardian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_alerts" }),
    });
    fetchState();
  }

  if (!state) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground">Guardian AI</h1>
        <p className="text-muted mt-2">Loading...</p>
      </div>
    );
  }

  const healthColor = state.overallHealth >= 80 ? "text-success" : state.overallHealth >= 50 ? "text-warning" : "text-danger";
  const healthBg = state.overallHealth >= 80 ? "bg-success" : state.overallHealth >= 50 ? "bg-warning" : "bg-danger";
  const unresolvedAlerts = state.alerts.filter((a) => !a.resolved);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Guardian AI</h1>
          <p className="text-xs text-muted mt-1">
            All-seeing watchdog — monitors, diagnoses, and auto-repairs the entire system
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={autoWatch}
              onChange={(e) => setAutoWatch(e.target.checked)}
              className="accent-accent"
            />
            <span className={autoWatch ? "text-accent" : "text-muted"}>Auto-Watch (60s)</span>
          </label>
          <button
            onClick={runScan}
            disabled={scanning}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              scanning
                ? "bg-accent/20 text-accent animate-pulse cursor-wait"
                : "bg-accent text-background hover:scale-105"
            }`}
          >
            {scanning ? "Scanning..." : "Run Full Scan"}
          </button>
        </div>
      </div>

      {/* Overall Health */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-card border border-card-border rounded-lg p-4 col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted uppercase tracking-wider">System Health</span>
            <span className={`text-3xl font-black ${healthColor}`}>{state.overallHealth}%</span>
          </div>
          <div className="w-full h-3 bg-card-border rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${healthBg}`} style={{ width: `${state.overallHealth}%` }} />
          </div>
          {state.lastScan && (
            <p className="text-[10px] text-muted mt-2">Last scan: {new Date(state.lastScan).toLocaleString()}</p>
          )}
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{state.totalScans}</div>
          <div className="text-xs text-muted">Scans</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-success">{state.totalFixes}</div>
          <div className="text-xs text-muted">Auto-Fixes</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-danger">{unresolvedAlerts.length}</div>
          <div className="text-xs text-muted">Open Alerts</div>
        </div>
      </div>

      {/* Alerts */}
      {unresolvedAlerts.length > 0 && (
        <div className="bg-card border border-danger/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-danger">Active Alerts</h3>
            <button onClick={clearAlerts} className="text-xs text-muted hover:text-foreground">Clear All</button>
          </div>
          <div className="space-y-1">
            {unresolvedAlerts.slice(-10).map((alert, i) => {
              const style = SEVERITY_STYLE[alert.severity];
              return (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${style.bg}`}>
                  <span className={`text-[9px] font-bold uppercase ${style.text}`}>{alert.severity}</span>
                  <span className="text-xs text-foreground">{alert.message}</span>
                  <span className="text-[10px] text-muted ml-auto">{new Date(alert.at).toLocaleTimeString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Health Check Grid */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Health Checks ({state.checks.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {state.checks.map((check) => {
            const style = STATUS_STYLE[check.status];
            return (
              <div key={check.id} className={`border border-card-border rounded-lg p-3 ${style.bg}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-foreground">{check.name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>{style.label}</span>
                </div>
                <p className="text-[10px] text-muted truncate">{check.message}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-muted">{check.type}</span>
                  {check.autoFixable && (
                    <span className="text-[9px] text-accent">auto-fixable</span>
                  )}
                  {check.fixAttempts > 0 && (
                    <span className="text-[9px] text-success">{check.fixAttempts} fixes</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Diagnosis */}
      {state.aiDiagnosis && (
        <div className="bg-card border border-accent/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-accent mb-3">AI Diagnosis</h3>
          <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {state.aiDiagnosis}
          </div>
        </div>
      )}

      {/* Live Scan Stream */}
      {events.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Scan Log</h3>
            <span className="text-xs text-muted">{events.length} events</span>
          </div>
          <div ref={logRef} className="bg-background rounded-lg p-3 max-h-56 overflow-y-auto font-mono text-xs space-y-1">
            {events.map((evt, i) => {
              let color = "text-muted";
              let msg = "";

              switch (evt.type) {
                case "scan_start":
                  color = "text-accent font-bold";
                  msg = `Guardian Scan #${evt.scan} started`;
                  break;
                case "phase":
                  color = evt.status === "done" ? "text-success" : "text-accent";
                  msg = `[${String(evt.phase).toUpperCase()}] ${evt.message}`;
                  break;
                case "check_result":
                  color = evt.status === "healthy" ? "text-success" : evt.status === "degraded" ? "text-warning" : "text-danger";
                  msg = `${evt.name}: ${evt.status} — ${evt.message}`;
                  break;
                case "fix_applied":
                  color = evt.result === "success" ? "text-success font-bold" : "text-danger";
                  msg = `FIX: ${evt.action} — ${evt.result}`;
                  break;
                case "diagnosis":
                  color = "text-accent";
                  msg = `DIAGNOSIS: ${String(evt.content).slice(0, 200)}`;
                  break;
                case "scan_complete":
                  color = "text-accent font-bold";
                  msg = `DONE: ${evt.health}% health — ${evt.healthy} OK, ${evt.degraded} warn, ${evt.broken} fail — ${evt.fixes} fixes`;
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
