import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const ROUTER_FILE = join(ENGINE_DIR, "smart-router", "state.json");
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

// ============================================================
// FREE MODELS ranked by quality (best first) — never stops
// ============================================================
const FREE_MODELS = [
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", provider: "Google", quality: 9, speed: 9, context: 32000, rpmLimit: 20 },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google", quality: 9, speed: 8, context: 131000, rpmLimit: 20 },
  { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "Google", quality: 7, speed: 10, context: 131000, rpmLimit: 20 },
  { id: "deepseek/deepseek-v3.2-20251201", name: "DeepSeek V3.2", provider: "DeepSeek", quality: 8, speed: 7, context: 64000, rpmLimit: 20 },
  { id: "moonshotai/kimi-k2.5-0127", name: "Kimi K2.5", provider: "Moonshot", quality: 8, speed: 7, context: 131000, rpmLimit: 20 },
  { id: "x-ai/grok-4.1-fast", name: "Grok 4.1 Fast", provider: "xAI", quality: 8, speed: 8, context: 131000, rpmLimit: 20 },
  { id: "qwen/qwen3-235b", name: "Qwen3 235B", provider: "Qwen", quality: 8, speed: 6, context: 40000, rpmLimit: 20 },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", provider: "OpenAI", quality: 7, speed: 7, context: 32000, rpmLimit: 20 },
  { id: "arcee-ai/trinity-large-preview", name: "Trinity Large", provider: "Arcee", quality: 7, speed: 7, context: 131000, rpmLimit: 20 },
  { id: "minimax/minimax-m2.1", name: "MiniMax M2.1", provider: "MiniMax", quality: 7, speed: 8, context: 64000, rpmLimit: 20 },
  { id: "liquid/lfm2-8b-a1b", name: "LFM2 8B", provider: "Liquid", quality: 5, speed: 10, context: 32000, rpmLimit: 20 },
];

interface ModelUsage {
  modelId: string;
  totalRequests: number;
  totalTokens: number;
  failures: number;
  lastUsed: string;
  lastError: string;
  consecutiveFailures: number;
  blocked: boolean;
  blockedUntil: string;
  requestsThisMinute: number;
  minuteStart: string;
  requestsToday: number;
}

interface RouterState {
  activeModel: string;
  activeModelName: string;
  credits: { total: number; used: number; remaining: number; lastChecked: string; lowWarning: boolean };
  modelUsage: Record<string, ModelUsage>;
  totalRequests: number;
  totalTokens: number;
  totalSwitches: number;
  switchLog: Array<{ from: string; to: string; reason: string; at: string }>;
  lastHealthCheck: string;
  dailyRequests: number;
  dailyReset: string;
  neverStop: boolean;        // never-stop mode: always find a working model
  proactiveCheck: boolean;   // check credits before they run out
  creditThreshold: number;   // warn at this credit level
  rateLimitCooldown: number; // seconds to wait after rate limit
}

function defaultRouterState(): RouterState {
  return {
    activeModel: FREE_MODELS[0].id,
    activeModelName: FREE_MODELS[0].name,
    credits: { total: 0, used: 0, remaining: 0, lastChecked: "", lowWarning: false },
    modelUsage: {},
    totalRequests: 0,
    totalTokens: 0,
    totalSwitches: 0,
    switchLog: [],
    lastHealthCheck: "",
    dailyRequests: 0,
    dailyReset: new Date().toISOString().split("T")[0],
    neverStop: true,
    proactiveCheck: true,
    creditThreshold: 0.01,
    rateLimitCooldown: 3,
  };
}

async function loadRouter(): Promise<RouterState> {
  try {
    return { ...defaultRouterState(), ...JSON.parse(await readFile(ROUTER_FILE, "utf-8")) };
  } catch { return defaultRouterState(); }
}

async function saveRouter(s: RouterState): Promise<void> {
  await mkdir(join(ENGINE_DIR, "smart-router"), { recursive: true });
  await writeFile(ROUTER_FILE, JSON.stringify(s, null, 2), "utf-8");
}

async function checkCredits(): Promise<{ total: number; used: number; remaining: number }> {
  if (!OPENROUTER_KEY) return { total: 0, used: 0, remaining: 0 };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${OPENROUTER_KEY}` },
    });
    if (res.ok) {
      const data = await res.json();
      const total = Number(data.data?.total_credits || data.total_credits || 0);
      const used = Number(data.data?.total_usage || data.usage || 0);
      return { total, used, remaining: total - used };
    }
  } catch { /* */ }
  return { total: 0, used: 0, remaining: 0 };
}

function pickBestModel(state: RouterState): { id: string; name: string; reason: string } {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const nowISO = now.toISOString();
  const oneMinuteAgo = new Date(now.getTime() - 60000).toISOString();

  // Reset daily counters on new day
  if (state.dailyReset !== today) {
    state.dailyRequests = 0;
    state.dailyReset = today;
    for (const usage of Object.values(state.modelUsage)) {
      usage.requestsToday = 0;
      if (usage.blocked && usage.blockedUntil <= nowISO) {
        usage.blocked = false;
        usage.consecutiveFailures = 0;
      }
    }
  }

  // Unblock expired blocks
  for (const usage of Object.values(state.modelUsage)) {
    if (usage.blocked && usage.blockedUntil <= nowISO) {
      usage.blocked = false;
      usage.consecutiveFailures = 0;
    }
  }

  for (const model of FREE_MODELS) {
    const usage = state.modelUsage[model.id];

    // Skip blocked models
    if (usage?.blocked) continue;

    // Skip models with too many consecutive failures
    if (usage?.consecutiveFailures >= 3) continue;

    // Rate limit check: skip if hit 20 rpm
    if (usage?.minuteStart && usage.minuteStart > oneMinuteAgo && usage.requestsThisMinute >= model.rpmLimit) {
      continue; // Rate limited this minute, try next
    }

    // Daily limit check (50/day for free, 1000 with credits)
    const dailyLimit = state.credits.remaining > 0 ? 1000 : 50;
    if (usage?.requestsToday >= dailyLimit) continue;

    return { id: model.id, name: model.name, reason: "best-available" };
  }

  // NEVER-STOP MODE: force reset everything and use first model
  if (state.neverStop) {
    for (const usage of Object.values(state.modelUsage)) {
      usage.blocked = false;
      usage.consecutiveFailures = 0;
      usage.requestsThisMinute = 0;
    }
    return { id: FREE_MODELS[0].id, name: FREE_MODELS[0].name, reason: "never-stop-reset" };
  }

  return { id: FREE_MODELS[0].id, name: FREE_MODELS[0].name, reason: "force-fallback" };
}

function initUsage(modelId: string): ModelUsage {
  return {
    modelId, totalRequests: 0, totalTokens: 0, failures: 0,
    lastUsed: "", lastError: "", consecutiveFailures: 0,
    blocked: false, blockedUntil: "",
    requestsThisMinute: 0, minuteStart: "", requestsToday: 0,
  };
}

// ============================================================
// GET: Router state + current model + credits
// ============================================================
export async function GET() {
  const state = await loadRouter();

  // Auto-check credits every 2 minutes
  const twoMinAgo = new Date(Date.now() - 2 * 60000).toISOString();
  if (!state.credits.lastChecked || state.credits.lastChecked < twoMinAgo) {
    const credits = await checkCredits();
    state.credits = {
      ...credits,
      lastChecked: new Date().toISOString(),
      lowWarning: credits.remaining > 0 && credits.remaining < state.creditThreshold,
    };
    await saveRouter(state);
  }

  return Response.json({
    ...state,
    availableModels: FREE_MODELS,
    currentModel: {
      id: state.activeModel,
      name: state.activeModelName,
      info: FREE_MODELS.find((m) => m.id === state.activeModel),
    },
  });
}

// ============================================================
// POST: Chat via smart router OR control actions
// ============================================================
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  // Manual model switch
  if (action === "switch") {
    const state = await loadRouter();
    const model = FREE_MODELS.find((m) => m.id === body.modelId);
    if (!model) return Response.json({ error: "Unknown model" }, { status: 400 });
    const oldModel = state.activeModel;
    state.activeModel = model.id;
    state.activeModelName = model.name;
    state.totalSwitches += 1;
    state.switchLog.push({ from: oldModel, to: model.id, reason: "manual", at: new Date().toISOString() });
    if (state.switchLog.length > 200) state.switchLog = state.switchLog.slice(-200);
    await saveRouter(state);
    return Response.json({ ok: true, model: model.id });
  }

  // Force credit check
  if (action === "check_credits") {
    const state = await loadRouter();
    const credits = await checkCredits();
    state.credits = {
      ...credits,
      lastChecked: new Date().toISOString(),
      lowWarning: credits.remaining > 0 && credits.remaining < state.creditThreshold,
    };
    await saveRouter(state);
    return Response.json({ ok: true, credits: state.credits });
  }

  // Reset all model blocks
  if (action === "reset") {
    const state = await loadRouter();
    state.modelUsage = {};
    state.activeModel = FREE_MODELS[0].id;
    state.activeModelName = FREE_MODELS[0].name;
    await saveRouter(state);
    return Response.json({ ok: true });
  }

  // Toggle never-stop mode
  if (action === "toggle_never_stop") {
    const state = await loadRouter();
    state.neverStop = !state.neverStop;
    await saveRouter(state);
    return Response.json({ ok: true, neverStop: state.neverStop });
  }

  // Set credit threshold
  if (action === "set_threshold") {
    const state = await loadRouter();
    state.creditThreshold = Number(body.threshold) || 0.01;
    await saveRouter(state);
    return Response.json({ ok: true, threshold: state.creditThreshold });
  }

  // ========================================
  // SMART CHAT: Auto-selects best model, retries all 11 models
  // ========================================
  if (action === "chat") {
    const state = await loadRouter();
    const messages = body.messages as Array<{ role: string; content: string }>;
    const maxTokens = body.max_tokens || 4000;
    const temperature = body.temperature ?? 0.7;

    if (!messages?.length) return Response.json({ error: "messages required" }, { status: 400 });
    if (!OPENROUTER_KEY) return Response.json({ error: "No API key" }, { status: 500 });

    // Proactive credit check before request
    if (state.proactiveCheck) {
      const sinceCheck = Date.now() - new Date(state.credits.lastChecked || 0).getTime();
      if (sinceCheck > 120000) { // Check every 2 min
        const credits = await checkCredits();
        state.credits = {
          ...credits,
          lastChecked: new Date().toISOString(),
          lowWarning: credits.remaining > 0 && credits.remaining < state.creditThreshold,
        };
      }
    }

    let lastError = "";
    // Try up to ALL 11 models — development NEVER stops
    const maxRetries = state.neverStop ? FREE_MODELS.length : 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { id: modelId, name: modelName, reason } = pickBestModel(state);

      // Switch model if needed
      if (modelId !== state.activeModel) {
        state.switchLog.push({ from: state.activeModel, to: modelId, reason, at: new Date().toISOString() });
        state.activeModel = modelId;
        state.activeModelName = modelName;
        state.totalSwitches += 1;
      }

      // Init usage tracking
      if (!state.modelUsage[modelId]) state.modelUsage[modelId] = initUsage(modelId);
      const usage = state.modelUsage[modelId];

      // Per-minute rate tracking
      const oneMinAgo = new Date(Date.now() - 60000).toISOString();
      if (!usage.minuteStart || usage.minuteStart < oneMinAgo) {
        usage.requestsThisMinute = 0;
        usage.minuteStart = new Date().toISOString();
      }

      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://autonomous-engine.local",
            "X-Title": "Autonomous Symbiotic Engine",
          },
          body: JSON.stringify({ model: modelId, messages, max_tokens: maxTokens, temperature }),
        });

        // Rate limited — wait and try next model
        if (res.status === 429) {
          lastError = "Rate limited";
          usage.requestsThisMinute = 999; // Mark as rate limited
          usage.lastError = "429 Rate Limited";
          continue; // Try next model immediately
        }

        // Credit exhausted
        if (res.status === 402) {
          lastError = "Credits exhausted";
          state.credits.remaining = 0;
          state.credits.lowWarning = true;
          // Continue to next model — free models don't need credits
          continue;
        }

        if (res.ok) {
          const data = await res.json();
          const tokens = data.usage?.total_tokens || 0;

          // Update tracking
          usage.totalRequests += 1;
          usage.totalTokens += tokens;
          usage.lastUsed = new Date().toISOString();
          usage.consecutiveFailures = 0;
          usage.requestsThisMinute += 1;
          usage.requestsToday = (usage.requestsToday || 0) + 1;
          state.totalRequests += 1;
          state.totalTokens += tokens;
          state.dailyRequests += 1;

          if (state.switchLog.length > 200) state.switchLog = state.switchLog.slice(-200);
          await saveRouter(state);

          return Response.json({
            content: data.choices?.[0]?.message?.content || "",
            model: modelId,
            modelName,
            tokens,
            attempt: attempt + 1,
            dailyRequests: state.dailyRequests,
            creditsRemaining: state.credits.remaining,
          });
        }

        // Other error
        const errorText = await res.text().catch(() => "");
        lastError = `${res.status}: ${errorText.slice(0, 200)}`;
        usage.failures += 1;
        usage.consecutiveFailures += 1;
        usage.lastError = lastError;

        if (usage.consecutiveFailures >= 3) {
          usage.blocked = true;
          const blockMinutes = Math.min(60, usage.consecutiveFailures * 5);
          usage.blockedUntil = new Date(Date.now() + blockMinutes * 60000).toISOString();
        }

      } catch (err) {
        lastError = err instanceof Error ? err.message : "Network error";
        usage.failures += 1;
        usage.consecutiveFailures += 1;
        usage.lastError = lastError;
      }
    }

    // NEVER-STOP: last resort — wait 3 seconds and try first model raw
    if (state.neverStop) {
      await new Promise((r) => setTimeout(r, state.rateLimitCooldown * 1000));
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: FREE_MODELS[0].id, messages, max_tokens: maxTokens, temperature }),
        });
        if (res.ok) {
          const data = await res.json();
          state.totalRequests += 1;
          state.dailyRequests += 1;
          await saveRouter(state);
          return Response.json({
            content: data.choices?.[0]?.message?.content || "",
            model: FREE_MODELS[0].id,
            modelName: FREE_MODELS[0].name,
            tokens: data.usage?.total_tokens || 0,
            attempt: maxRetries + 1,
            dailyRequests: state.dailyRequests,
            lastResort: true,
          });
        }
      } catch { /* truly exhausted */ }
    }

    await saveRouter(state);
    return Response.json({ error: `All ${maxRetries} models tried. Last: ${lastError}` }, { status: 502 });
  }

  return Response.json({ error: "Unknown action. Use: chat, switch, check_credits, reset, toggle_never_stop, set_threshold" }, { status: 400 });
}
