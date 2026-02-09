import { NextRequest } from "next/server";
import {
  FREE_MODELS,
  loadRouter,
  saveRouter,
  checkCredits,
  smartRouterChat,
} from "@/app/lib/smart-router-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    try {
      const messages = body.messages as Array<{ role: string; content: string }>;
      const maxTokens = body.max_tokens;
      const temperature = body.temperature;

      const result = await smartRouterChat(messages, { maxTokens, temperature });
      return Response.json(result);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
    }
  }

  return Response.json({ error: "Unknown action. Use: chat, switch, check_credits, reset, toggle_never_stop, set_threshold" }, { status: 400 });
}
