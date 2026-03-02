import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir, stat } from "fs/promises";
import { join } from "path";
import { smartAI } from "@/app/lib/smart-ai";

export const runtime = "nodejs";


export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const GUARDIAN_DIR = join(ENGINE_DIR, "guardian");
const STATE_FILE = join(GUARDIAN_DIR, "state.json");

// ============================================================
// GUARDIAN: All-seeing AI that watches, diagnoses, and auto-fixes
// ============================================================

interface HealthCheck {
  id: string;
  name: string;
  target: string;        // what to check
  type: "api" | "file" | "service" | "state" | "build";
  status: "healthy" | "degraded" | "broken" | "unknown";
  lastCheck: string;
  message: string;
  autoFixable: boolean;
  fixAttempts: number;
  fixHistory: Array<{ at: string; action: string; result: string }>;
}

interface GuardianState {
  status: "watching" | "idle" | "repairing";
  lastScan: string;
  totalScans: number;
  totalFixes: number;
  totalIssues: number;
  checks: HealthCheck[];
  alerts: Array<{ at: string; severity: "info" | "warning" | "critical"; message: string; resolved: boolean }>;
  aiDiagnosis: string;
  overallHealth: number; // 0-100
}

function defaultGuardianState(): GuardianState {
  return {
    status: "idle",
    lastScan: "",
    totalScans: 0,
    totalFixes: 0,
    totalIssues: 0,
    checks: [],
    alerts: [],
    aiDiagnosis: "",
    overallHealth: 0,
  };
}

async function loadGuardian(): Promise<GuardianState> {
  try {
    return { ...defaultGuardianState(), ...JSON.parse(await readFile(STATE_FILE, "utf-8")) };
  } catch { return defaultGuardianState(); }
}

async function saveGuardian(s: GuardianState): Promise<void> {
  await mkdir(GUARDIAN_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(s, null, 2), "utf-8");
}

async function fileExists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

async function checkEndpoint(url: string, timeout = 5000): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const body = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
  } catch (err) {
    return { ok: false, status: 0, body: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function aiCall(systemPrompt: string, userPrompt: string): Promise<string> {
  const result = await smartAI(systemPrompt, userPrompt, { maxTokens: 3000, temperature: 0.3 });
  return result.content;
}

// ============================================================
// Comprehensive health checks
// ============================================================

async function runAllChecks(baseUrl: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const now = new Date().toISOString();

  // 1. Core API endpoints
  const apiChecks = [
    { id: "api-engine", name: "Engine API", target: "/api/engine" },
    { id: "api-swarm", name: "Swarm API", target: "/api/swarm" },
    { id: "api-arena", name: "Arena API", target: "/api/arena" },
    { id: "api-money-machine", name: "Money Machine API", target: "/api/money-machine" },
    { id: "api-noticeboard", name: "Notice Board API", target: "/api/noticeboard" },
    { id: "api-research", name: "Research API", target: "/api/research" },
    { id: "api-self-finance", name: "Self-Finance API", target: "/api/self-finance" },
    { id: "api-vault", name: "Vault API", target: "/api/vault" },
    { id: "api-skills", name: "Skills API", target: "/api/skills/manage" },
    { id: "api-openrouter", name: "OpenRouter API", target: "/api/openrouter/usage" },
    { id: "api-niche-hunter", name: "Niche Hunter API", target: "/api/swarm/niche-hunter" },
    { id: "api-guardian", name: "Guardian API (self)", target: "/api/guardian" },
    { id: "api-deploy", name: "Deploy API", target: "/api/deploy" },
    { id: "api-smart-router", name: "Smart Router API", target: "/api/smart-router" },
    { id: "api-telegram", name: "Telegram API", target: "/api/telegram" },
  ];

  const apiResults = await Promise.allSettled(
    apiChecks.map(async (check) => {
      const result = await checkEndpoint(`${baseUrl}${check.target}`);
      return {
        id: check.id,
        name: check.name,
        target: check.target,
        type: "api" as const,
        status: result.ok ? "healthy" as const : result.status === 500 ? "broken" as const : "degraded" as const,
        lastCheck: now,
        message: result.ok ? `OK (${result.status})` : `Failed: ${result.status} — ${result.body.slice(0, 100)}`,
        autoFixable: false,
        fixAttempts: 0,
        fixHistory: [],
      };
    })
  );

  for (const r of apiResults) {
    if (r.status === "fulfilled") checks.push(r.value);
  }

  // 2. Critical state files
  const stateFiles = [
    { id: "file-engine-state", name: "Engine State", target: join(ENGINE_DIR, "state.json") },
    { id: "file-noticeboard", name: "Notice Board", target: join(ENGINE_DIR, "noticeboard.json") },
    { id: "file-vault", name: "API Vault", target: join(ENGINE_DIR, "vault", "keys.json") },
    { id: "file-finance", name: "Finance Ledger", target: join(ENGINE_DIR, "finance", "ledger.json") },
    { id: "file-swarm-state", name: "Swarm State", target: join(ENGINE_DIR, "swarm", "state.json") },
    { id: "file-arena-state", name: "Arena State", target: join(ENGINE_DIR, "arena", "state.json") },
    { id: "file-niche-hunts", name: "Niche Hunts", target: join(ENGINE_DIR, "niche-hunter", "hunts.json") },
  ];

  for (const sf of stateFiles) {
    const exists = await fileExists(sf.target);
    let valid = false;
    let message = "";

    if (exists) {
      try {
        const content = await readFile(sf.target, "utf-8");
        JSON.parse(content);
        valid = true;
        message = `OK (${content.length} bytes)`;
      } catch (err) {
        message = `Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`;
      }
    } else {
      message = "File does not exist";
    }

    checks.push({
      id: sf.id,
      name: sf.name,
      target: sf.target,
      type: "file",
      status: valid ? "healthy" : exists ? "degraded" : "broken",
      lastCheck: now,
      message,
      autoFixable: true,
      fixAttempts: 0,
      fixHistory: [],
    });
  }

  // 3. External services
  const extResult = await checkEndpoint("https://openrouter.ai/api/v1/models", 8000);
  checks.push({
    id: "ext-openrouter",
    name: "OpenRouter Service",
    target: "https://openrouter.ai",
    type: "service",
    status: extResult.ok ? "healthy" : "broken",
    lastCheck: now,
    message: extResult.ok ? "Reachable" : `Unreachable: ${extResult.body.slice(0, 100)}`,
    autoFixable: false,
    fixAttempts: 0,
    fixHistory: [],
  });

  // 4. API key check
  checks.push({
    id: "key-openrouter",
    name: "OpenRouter API Key",
    target: "env:OPENROUTER_API_KEY",
    type: "state",
    status: OPENROUTER_KEY ? "healthy" : "broken",
    lastCheck: now,
    message: OPENROUTER_KEY ? `Key set (${OPENROUTER_KEY.slice(0, 8)}...)` : "Missing API key",
    autoFixable: false,
    fixAttempts: 0,
    fixHistory: [],
  });

  return checks;
}

// ============================================================
// Auto-fix broken things
// ============================================================

async function autoFix(checks: HealthCheck[]): Promise<Array<{ checkId: string; action: string; result: string }>> {
  const fixes: Array<{ checkId: string; action: string; result: string }> = [];

  for (const check of checks) {
    if (check.status !== "broken" && check.status !== "degraded") continue;
    if (!check.autoFixable) continue;

    // Fix missing/broken state files by creating defaults
    if (check.type === "file" && check.status === "broken") {
      try {
        const dir = check.target.substring(0, check.target.lastIndexOf("\\") === -1 ? check.target.lastIndexOf("/") : check.target.lastIndexOf("\\"));
        await mkdir(dir, { recursive: true });

        const defaults: Record<string, object> = {
          "state.json": { status: "idle", phase: null, currentStep: 0, totalSteps: 0, lastCheckpoint: new Date().toISOString() },
          "noticeboard.json": { phase: "idle", status: "Guardian auto-created", activeWork: "", nextSteps: [], completed: [], context: {}, blockers: [], projectNotes: "", recentFiles: [], git: {}, pins: [{ from: "guardian", message: "Noticeboard restored by Guardian AI", at: new Date().toISOString() }] },
          "keys.json": {},
          "ledger.json": { entries: [], totals: { totalRevenue: 0, totalCosts: 0, netProfit: 0 }, revenueStreams: [], costSources: [] },
          "hunts.json": { lastHuntAt: "", totalHunts: 0, opportunities: [], revolutions: [], aiGaps: [] },
        };

        const filename = check.target.split(/[/\\]/).pop() || "";
        const defaultContent = defaults[filename] || {};
        await writeFile(check.target, JSON.stringify(defaultContent, null, 2), "utf-8");
        check.status = "healthy";
        check.message = "Auto-fixed: recreated with defaults";
        check.fixAttempts += 1;
        check.fixHistory.push({ at: new Date().toISOString(), action: "Recreated default file", result: "success" });
        fixes.push({ checkId: check.id, action: `Recreated ${filename}`, result: "success" });
      } catch (err) {
        fixes.push({ checkId: check.id, action: "Attempted file recreation", result: `failed: ${err instanceof Error ? err.message : "unknown"}` });
      }
    }

    // Fix corrupted JSON files
    if (check.type === "file" && check.status === "degraded") {
      try {
        // Try to read and fix corrupted JSON
        const content = await readFile(check.target, "utf-8");
        // Attempt basic fix: remove trailing garbage
        const trimmed = content.trim();
        let fixed = false;

        // Try parsing from start to find valid JSON
        for (let end = trimmed.length; end > 0; end--) {
          try {
            JSON.parse(trimmed.slice(0, end));
            await writeFile(check.target, trimmed.slice(0, end), "utf-8");
            fixed = true;
            break;
          } catch { /* try shorter */ }
        }

        if (fixed) {
          check.status = "healthy";
          check.message = "Auto-fixed: repaired JSON";
          check.fixAttempts += 1;
          check.fixHistory.push({ at: new Date().toISOString(), action: "Repaired corrupted JSON", result: "success" });
          fixes.push({ checkId: check.id, action: "Repaired JSON", result: "success" });
        }
      } catch { /* */ }
    }
  }

  return fixes;
}

// ============================================================
// GET: Guardian status
// ============================================================
export async function GET() {
  const state = await loadGuardian();
  return Response.json(state);
}

// ============================================================
// POST: Run guardian scan or specific action
// ============================================================
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string || "scan";
  const baseUrl = body.baseUrl as string || `http://localhost:${process.env.PORT || 3000}`;

  if (action === "clear_alerts") {
    const state = await loadGuardian();
    state.alerts = state.alerts.map((a) => ({ ...a, resolved: true }));
    await saveGuardian(state);
    return Response.json({ ok: true });
  }

  // ========================================
  // FULL GUARDIAN SCAN
  // ========================================
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: Record<string, unknown>) {
        try { controller.enqueue(encoder.encode(JSON.stringify(data) + "\n")); } catch { /* */ }
      }

      const state = await loadGuardian();
      state.status = "watching";
      state.totalScans += 1;
      state.lastScan = new Date().toISOString();

      emit({ type: "scan_start", scan: state.totalScans });

      // PHASE 1: Health checks
      emit({ type: "phase", phase: "health_check", status: "running", message: "Running comprehensive health checks..." });

      const checks = await runAllChecks(baseUrl);
      state.checks = checks;

      const healthy = checks.filter((c) => c.status === "healthy").length;
      const degraded = checks.filter((c) => c.status === "degraded").length;
      const broken = checks.filter((c) => c.status === "broken").length;
      state.overallHealth = Math.round((healthy / checks.length) * 100);

      for (const check of checks) {
        emit({
          type: "check_result",
          id: check.id,
          name: check.name,
          status: check.status,
          message: check.message,
        });
      }

      emit({
        type: "phase",
        phase: "health_check",
        status: "done",
        message: `${healthy} healthy, ${degraded} degraded, ${broken} broken — ${state.overallHealth}% health`,
      });

      // PHASE 2: Auto-fix broken things
      if (broken > 0 || degraded > 0) {
        emit({ type: "phase", phase: "auto_fix", status: "running", message: `Attempting to auto-fix ${broken + degraded} issues...` });
        state.status = "repairing";

        const fixes = await autoFix(checks);
        state.totalFixes += fixes.filter((f) => f.result === "success").length;

        for (const fix of fixes) {
          emit({ type: "fix_applied", ...fix });
          state.alerts.push({
            at: new Date().toISOString(),
            severity: fix.result === "success" ? "info" : "warning",
            message: `${fix.action}: ${fix.result}`,
            resolved: fix.result === "success",
          });
        }

        // Recount after fixes
        const postFixHealthy = checks.filter((c) => c.status === "healthy").length;
        state.overallHealth = Math.round((postFixHealthy / checks.length) * 100);

        emit({
          type: "phase",
          phase: "auto_fix",
          status: "done",
          message: `${fixes.filter((f) => f.result === "success").length}/${fixes.length} fixes successful. Health: ${state.overallHealth}%`,
        });
      }

      // PHASE 3: AI Diagnosis
      emit({ type: "phase", phase: "ai_diagnosis", status: "running", message: "AI analyzing system health..." });

      const diagnosisInput = checks.map((c) => `${c.name}: ${c.status} — ${c.message}`).join("\n");
      const diagnosis = await aiCall(
        `You are the Guardian AI — the all-seeing overseer of the Autonomous Symbiotic Engine dashboard. Your job: analyze system health, identify risks, and recommend improvements.

Be concise, direct, and actionable. Focus on:
1. Critical issues that need immediate attention
2. Performance risks
3. Missing capabilities
4. Security concerns
5. Revenue optimization opportunities

Format: Start with a 1-line overall assessment, then bullet points for each finding.`,
        `System Health Report (Scan #${state.totalScans}):

${diagnosisInput}

Overall Health: ${state.overallHealth}%
Total previous fixes: ${state.totalFixes}
Total previous issues: ${state.totalIssues}

Analyze this system. What needs attention? What should be improved? What's working well?`
      );

      state.aiDiagnosis = diagnosis;

      emit({ type: "diagnosis", content: diagnosis.slice(0, 1000) });
      emit({ type: "phase", phase: "ai_diagnosis", status: "done", message: "Diagnosis complete" });

      // Create alerts for broken items
      for (const check of checks) {
        if (check.status === "broken") {
          state.totalIssues += 1;
          state.alerts.push({
            at: new Date().toISOString(),
            severity: "critical",
            message: `${check.name} is broken: ${check.message}`,
            resolved: false,
          });
        }
      }

      // Keep only latest 50 alerts
      if (state.alerts.length > 50) {
        state.alerts = state.alerts.slice(-50);
      }

      state.status = "idle";
      await saveGuardian(state);

      // Update noticeboard
      try {
        const boardRaw = await readFile(join(ENGINE_DIR, "noticeboard.json"), "utf-8");
        const board = JSON.parse(boardRaw);
        board.pins = board.pins || [];
        board.pins.push({
          from: "guardian",
          message: `Guardian Scan #${state.totalScans}: ${state.overallHealth}% health. ${broken} broken, ${state.totalFixes} auto-fixed.`,
          at: new Date().toISOString(),
        });
        board.updatedBy = "guardian";
        board.updatedAt = new Date().toISOString();
        await writeFile(join(ENGINE_DIR, "noticeboard.json"), JSON.stringify(board, null, 2), "utf-8");
      } catch { /* */ }

      emit({
        type: "scan_complete",
        scan: state.totalScans,
        health: state.overallHealth,
        healthy,
        degraded,
        broken,
        fixes: state.totalFixes,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
