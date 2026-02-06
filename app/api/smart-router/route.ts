import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const ROUTER_FILE = join(ENGINE_DIR, "smart-router", "state.json");
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

// ============================================================
// FREE MODELS ranked by quality (best first)
// ============================================================
const FREE_MODELS = [
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", provider: "Google", quality: 9, speed: 9, context: 32000 },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google", quality: 9, speed: 8, context: 131000 },
  { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "Google", quality: 7, speed: 10, context: 131000 },
  { id: "deepseek/deepseek-v3.2-20251201", name: "DeepSeek V3.2", provider: "DeepSeek", quality: 8, speed: 7, context: 64000 },
  { id: "moonshotai/kimi-k2.5-0127", name: "Kimi K2.5", provider: "Moonshot", quality: 8, speed: 7, context: 131000 },
  { id: "x-ai/grok-4.1-fast", name: "Grok 4.1 Fast", provider: "xAI", quality: 8, speed: 8, context: 131000 },
  { id: "qwen/qwen3-235b", name: "Qwen3 235B", provider: "Qwen", quality: 8, speed: 6, context: 40000 },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", provider: "OpenAI", quality: 7, speed: 7, context: 32000 },
  { id: "arcee-ai/trinity-large-preview", name: "Trinity Large", provider: "Arcee", quality: 7, speed: 7, context: 131000 },
  { id: "minimax/minimax-m2.1", name: "MiniMax M2.1", provider: "MiniMax", quality: 7, speed: 8, context: 64000 },
  { id: "liquid/lfm2-8b-a1b", name: "LFM2 8B", provider: "Liquid", quality: 5, speed: 10, context: 32000 },
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
}

interface RouterState {
  activeModel: string;
  activeModelName: string;
  credits: { total: number; used: number; remaining: number; lastChecked: string };
  modelUsage: Record<string, ModelUsage>;
  totalRequests: number;
  totalTokens: number;
  totalSwitches: number;
  switchLog: Array<{ from: string; to: string; reason: string; at: string }>;
  lastHealthCheck: string;
  dailyRequests: number;
  dailyReset: string;
}

function defaultRouterState(): RouterState {
  return {
    activeModel: FREE_MODELS[0].id,
    activeModelName: FREE_MODELS[0].name,
    credits: { total: 0, used: 0, remaining: 0, lastChecked: "" },
    modelUsage: {},
    totalRequests: 0,
    totalTokens: 0,
    totalSwitches: 0,
    switchLog: [],
    lastHealthCheck: "",
    dailyRequests: 0,
    dailyReset: new Date().toISOString().split("T")[0],
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
  const today = new Date().toISOString().split("T")[0];

  // Reset daily counter if new day
  if (state.dailyReset !== today) {
    state.dailyRequests = 0;
    state.dailyReset = today;
    // Unblock all models on new day
    for (const usage of Object.values(state.modelUsage)) {
      if (usage.blocked && usage.blockedUntil <= new Date().toISOString()) {
        usage.blocked = false;
        usage.consecutiveFailures = 0;
      }
    }
  }

  for (const model of FREE_MODELS) {
    const usage = state.modelUsage[model.id];

    // Skip blocked models
    if (usage?.blocked && usage.blockedUntil > new Date().toISOString()) {
      continue;
    }

    // Skip models with too many consecutive failures (3+)
    if (usage?.consecutiveFailures >= 3) {
      continue;
    }

    return { id: model.id, name: model.name, reason: "best-available" };
  }

  // All models failed — force reset and use first
  for (const usage of Object.values(state.modelUsage)) {
    usage.blocked = false;
    usage.consecutiveFailures = 0;
  }
  return { id: FREE_MODELS[0].id, name: FREE_MODELS[0].name, reason: "force-reset" };
}

// ============================================================
// GET: Router state + current model + credits
// ============================================================
export async function GET() {
  const state = await loadRouter();

  // Auto-check credits every 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
  if (!state.credits.lastChecked || state.credits.lastChecked < fiveMinAgo) {
    const credits = await checkCredits();
    state.credits = { ...credits, lastChecked: new Date().toISOString() };
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
    await saveRouter(state);
    return Response.json({ ok: true, model: model.id });
  }

  // Force credit check
  if (action === "check_credits") {
    const state = await loadRouter();
    const credits = await checkCredits();
    state.credits = { ...credits, lastChecked: new Date().toISOString() };
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

  // ========================================
  // SMART CHAT: Auto-selects best model, retries on failure
  // ========================================
  if (action === "chat") {
    const state = await loadRouter();
    const messages = body.messages as Array<{ role: string; content: string }>;
    const maxTokens = body.max_tokens || 4000;
    const temperature = body.temperature ?? 0.7;

    if (!messages?.length) return Response.json({ error: "messages required" }, { status: 400 });
    if (!OPENROUTER_KEY) return Response.json({ error: "No API key" }, { status: 500 });

    let lastError = "";
    const maxRetries = 3;

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
      if (!state.modelUsage[modelId]) {
        state.modelUsage[modelId] = {
          modelId, totalRequests: 0, totalTokens: 0, failures: 0,
          lastUsed: "", lastError: "", consecutiveFailures: 0, blocked: false, blockedUntil: "",
        };
      }

      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: modelId, messages, max_tokens: maxTokens, temperature }),
        });

        if (res.ok) {
          const data = await res.json();
          const tokens = data.usage?.total_tokens || 0;

          // Update tracking
          state.modelUsage[modelId].totalRequests += 1;
          state.modelUsage[modelId].totalTokens += tokens;
          state.modelUsage[modelId].lastUsed = new Date().toISOString();
          state.modelUsage[modelId].consecutiveFailures = 0;
          state.totalRequests += 1;
          state.totalTokens += tokens;
          state.dailyRequests += 1;

          await saveRouter(state);

          return Response.json({
            content: data.choices?.[0]?.message?.content || "",
            model: modelId,
            modelName,
            tokens,
            attempt: attempt + 1,
            dailyRequests: state.dailyRequests,
          });
        }

        // Model failed - mark and try next
        const errorText = await res.text().catch(() => "");
        lastError = `${res.status}: ${errorText.slice(0, 200)}`;
        state.modelUsage[modelId].failures += 1;
        state.modelUsage[modelId].consecutiveFailures += 1;
        state.modelUsage[modelId].lastError = lastError;

        // Block model for increasing duration based on failures
        if (state.modelUsage[modelId].consecutiveFailures >= 3) {
          state.modelUsage[modelId].blocked = true;
          const blockMinutes = Math.min(60, state.modelUsage[modelId].consecutiveFailures * 5);
          state.modelUsage[modelId].blockedUntil = new Date(Date.now() + blockMinutes * 60000).toISOString();
        }

      } catch (err) {
        lastError = err instanceof Error ? err.message : "Network error";
        state.modelUsage[modelId].failures += 1;
        state.modelUsage[modelId].consecutiveFailures += 1;
        state.modelUsage[modelId].lastError = lastError;
      }
    }

    await saveRouter(state);
    return Response.json({ error: `All models failed after ${maxRetries} attempts. Last: ${lastError}` }, { status: 502 });
  }

  return Response.json({ error: "Unknown action. Use: chat, switch, check_credits, reset" }, { status: 400 });
}
