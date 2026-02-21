import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const TELEGRAM_DIR = join(ENGINE_DIR, "telegram");
const CONFIG_FILE = join(TELEGRAM_DIR, "config.json");
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

// ============================================================
// TELEGRAM CONFIG
// ============================================================

interface TelegramConfig {
  botToken: string;
  chatId: string;
  webhookUrl: string;
  active: boolean;
  pollingActive: boolean;
  lastMessage: string;
  totalMessages: number;
  lastUpdateId: number;
  commandLog: Array<{ at: string; command: string; response: string }>;
}

function defaultConfig(): TelegramConfig {
  return {
    botToken: "", chatId: "", webhookUrl: "", active: false, pollingActive: false,
    lastMessage: "", totalMessages: 0, lastUpdateId: 0, commandLog: [],
  };
}

async function loadConfig(): Promise<TelegramConfig> {
  try {
    return { ...defaultConfig(), ...JSON.parse(await readFile(CONFIG_FILE, "utf-8")) };
  } catch {
    return defaultConfig();
  }
}

async function saveConfig(c: TelegramConfig): Promise<void> {
  await mkdir(TELEGRAM_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(c, null, 2), "utf-8");
}

async function sendTelegram(token: string, chatId: string, text: string, parseMode = "HTML"): Promise<boolean> {
  if (!token || !chatId) return false;
  try {
    // Split long messages into chunks of 4000 chars
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
      chunks.push(remaining.slice(0, 4000));
      remaining = remaining.slice(4000);
    }
    for (const chunk of chunks) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: parseMode }),
      });
      if (!res.ok) {
        // Retry without parse_mode in case HTML is malformed
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: chunk }),
        });
      }
    }
    return true;
  } catch { return false; }
}

async function smartChat(messages: Array<{ role: string; content: string }>): Promise<string> {
  try {
    const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/smart-router`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chat", messages, max_tokens: 2000, temperature: 0.5 }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.content || "No response";
    }
  } catch { /* fallback below */ }

  if (!OPENROUTER_KEY) return "No API key configured. Set OPENROUTER_API_KEY.";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages,
        max_tokens: 2000,
        temperature: 0.5,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "No response";
    }
  } catch { /* */ }
  return "All AI models unreachable";
}

// ============================================================
// COMMAND HANDLERS
// ============================================================

async function handleCommand(command: string, args: string, baseUrl: string): Promise<string> {
  const cmd = command.toLowerCase().replace("/", "");

  switch (cmd) {
    case "start":
    case "help":
      return `<b>Autonomous Engine - Telegram Control</b>

<b>System:</b>
/status - Engine & model status
/health - Guardian health check
/credits - OpenRouter credits
/model - Current AI model
/switch [model] - Switch model

<b>Revenue:</b>
/launch - Money Machine
/arena - Start battle
/payout - Collect profits
/swarm - Agent swarm
/hunt - Niche hunter

<b>Research:</b>
/scan - Full research scan
/opportunities - Top niches

<b>Dashboard:</b>
/board - Notice board
/finance - Finance overview
/guardian - Guardian scan

Send any text without / to chat with the AI.`;

    case "status": {
      const [engineRes, routerRes] = await Promise.allSettled([
        fetch(`${baseUrl}/api/engine`).then((r) => r.json()),
        fetch(`${baseUrl}/api/smart-router`).then((r) => r.json()),
      ]);
      const engine = engineRes.status === "fulfilled" ? engineRes.value : null;
      const router = routerRes.status === "fulfilled" ? routerRes.value : null;

      return `<b>Engine Status</b>
Status: ${engine?.status || "unknown"}
Phase: ${engine?.phase || "idle"}
Step: ${engine?.currentStep || 0}/${engine?.totalSteps || 0}

<b>Smart Router</b>
Model: ${router?.activeModelName || "unknown"}
Credits: $${router?.credits?.remaining?.toFixed(4) || "?"}
Today: ${router?.dailyRequests || 0} requests
Switches: ${router?.totalSwitches || 0}`;
    }

    case "health": {
      try {
        const res = await fetch(`${baseUrl}/api/guardian`);
        const data = await res.json();
        const broken = data.checks?.filter((c: { status: string }) => c.status === "broken").length || 0;
        const healthy = data.checks?.filter((c: { status: string }) => c.status === "healthy").length || 0;
        return `<b>Health: ${data.overallHealth || 0}%</b>
Healthy: ${healthy} | Broken: ${broken}
Fixes: ${data.totalFixes || 0}
Last: ${data.lastScan ? new Date(data.lastScan).toLocaleString() : "never"}`;
      } catch { return "Guardian unreachable"; }
    }

    case "credits": {
      try {
        const res = await fetch(`${baseUrl}/api/smart-router`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_credits" }),
        });
        const data = await res.json();
        return `<b>Credits</b>
Total: $${data.credits?.total?.toFixed(4) || "0"}
Used: $${data.credits?.used?.toFixed(4) || "0"}
Left: $${data.credits?.remaining?.toFixed(4) || "0"}`;
      } catch { return "Could not check credits"; }
    }

    case "model": {
      try {
        const res = await fetch(`${baseUrl}/api/smart-router`);
        const data = await res.json();
        return `<b>Model: ${data.activeModelName || "?"}</b>
ID: <code>${data.activeModel || "?"}</code>
Requests: ${data.totalRequests}
Tokens: ${data.totalTokens?.toLocaleString()}
Switches: ${data.totalSwitches}`;
      } catch { return "Router unreachable"; }
    }

    case "switch": {
      if (!args) {
        try {
          const res = await fetch(`${baseUrl}/api/smart-router`);
          const data = await res.json();
          const models = data.availableModels?.map((m: { id: string; name: string; quality: number }) =>
            `${m.name} (Q:${m.quality})`
          ).join("\n") || "No models";
          return `<b>Models:</b>\n${models}\n\nUsage: /switch model-id`;
        } catch { return "Router unreachable"; }
      }
      try {
        const res = await fetch(`${baseUrl}/api/smart-router`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "switch", modelId: args.trim() }),
        });
        const data = await res.json();
        return data.ok ? `Switched to: ${args.trim()}` : `Error: ${data.error}`;
      } catch { return "Switch failed"; }
    }

    case "launch": {
      try {
        fetch(`${baseUrl}/api/money-machine`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
        return "Money Machine launched! Check dashboard.";
      } catch { return "Launch failed"; }
    }

    case "arena": {
      try {
        fetch(`${baseUrl}/api/arena`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "battle" }),
        });
        return "Arena battle started!";
      } catch { return "Battle failed"; }
    }

    case "payout": {
      try {
        const res = await fetch(`${baseUrl}/api/arena`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "payout" }),
        });
        const data = await res.json();
        return data.ok
          ? `Collected: $${data.collected?.toFixed(2)}\nTotal: $${data.totalPayout?.toFixed(2)}`
          : "No payout available";
      } catch { return "Payout failed"; }
    }

    case "swarm": {
      try {
        fetch(`${baseUrl}/api/swarm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "swarm" }),
        });
        return "Agent swarm launched!";
      } catch { return "Swarm failed"; }
    }

    case "hunt": {
      try {
        fetch(`${baseUrl}/api/swarm/niche-hunter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "hunt" }),
        });
        return "Niche Hunter searching for AI gaps & revolutions...";
      } catch { return "Hunt failed"; }
    }

    case "scan": {
      try {
        fetch(`${baseUrl}/api/research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "scan_all" }),
        });
        return "Full research scan started.";
      } catch { return "Scan failed"; }
    }

    case "opportunities": {
      try {
        const res = await fetch(`${baseUrl}/api/swarm/niche-hunter`);
        const data = await res.json();
        const top5 = data.opportunities?.slice(-5).reverse() || [];
        if (!top5.length) return "No opportunities yet. Run /hunt first.";
        return `<b>Top Opportunities:</b>\n\n` + top5.map((o: { name: string; category: string; potential: number; estimatedMRR: string }, i: number) =>
          `${i + 1}. <b>${o.name}</b> (${o.category})\n   Potential: ${o.potential}/10 | MRR: ${o.estimatedMRR}`
        ).join("\n\n");
      } catch { return "Could not load opportunities"; }
    }

    case "board": {
      try {
        const res = await fetch(`${baseUrl}/api/noticeboard`);
        const data = await res.json();
        const pins = data.pins?.slice(-3) || [];
        return `<b>Board</b>
Phase: ${data.phase || "idle"}
Status: ${data.status || "unknown"}

<b>Pins:</b>
${pins.map((p: { from: string; message: string }) => `[${p.from}] ${p.message}`).join("\n") || "None"}`;
      } catch { return "Board unreachable"; }
    }

    case "finance": {
      try {
        const res = await fetch(`${baseUrl}/api/self-finance`);
        const data = await res.json();
        return `<b>Finance</b>
Revenue: $${data.totals?.totalRevenue?.toFixed(2) || "0"}
Costs: $${data.totals?.totalCosts?.toFixed(2) || "0"}
Profit: $${data.totals?.netProfit?.toFixed(2) || "0"}
Streams: ${data.revenueStreams?.length || 0}`;
      } catch { return "Finance unreachable"; }
    }

    case "guardian": {
      try {
        fetch(`${baseUrl}/api/guardian`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "scan", baseUrl }),
        });
        return "Guardian scan triggered.";
      } catch { return "Guardian scan failed"; }
    }

    default:
      return `Unknown: /${cmd}\nSend /help for commands.`;
  }
}

// ============================================================
// SHARED: Process a single incoming message
// ============================================================

async function processMessage(config: TelegramConfig, chatId: string, text: string, baseUrl: string): Promise<string> {
  if (text.startsWith("/")) {
    const parts = text.split(/\s+/);
    return handleCommand(parts[0], parts.slice(1).join(" "), baseUrl);
  }

  // AI Chat mode
  return smartChat([
    {
      role: "system",
      content: `You are the Autonomous Symbiotic Engine AI, responding via Telegram. Be concise (under 300 words).
The user controls: Money Machine, Agent Swarm, Arena, Guardian, Niche Hunter, Smart Router, Revenue tracking.
Suggest actions when appropriate. Use /command syntax when suggesting commands.`,
    },
    { role: "user", content: text },
  ]);
}

// ============================================================
// GET: Bot config and status
// ============================================================
export async function GET() {
  const config = await loadConfig();
  return Response.json({
    active: config.active,
    pollingActive: config.pollingActive,
    chatId: config.chatId ? `${config.chatId.slice(0, 4)}...` : "",
    webhookUrl: config.webhookUrl,
    totalMessages: config.totalMessages,
    lastMessage: config.lastMessage,
    hasBotToken: !!config.botToken,
    recentCommands: config.commandLog.slice(-15),
  });
}

// ============================================================
// POST: Actions + Webhook + Polling
// ============================================================
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // ---- SETUP: Save token, chatId, webhook ----
  if (body.action === "setup") {
    const config = await loadConfig();

    if (body.botToken) config.botToken = body.botToken;
    if (body.chatId) config.chatId = body.chatId;

    // Set webhook if provided
    if (body.webhookUrl && config.botToken) {
      config.webhookUrl = body.webhookUrl;
      try {
        // First remove any existing webhook
        await fetch(`https://api.telegram.org/bot${config.botToken}/deleteWebhook`);
        const res = await fetch(`https://api.telegram.org/bot${config.botToken}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: body.webhookUrl }),
        });
        const data = await res.json();
        if (!data.ok) return Response.json({ error: `Webhook failed: ${data.description}` }, { status: 400 });
      } catch (err) {
        return Response.json({ error: `Webhook error: ${err instanceof Error ? err.message : "unknown"}` }, { status: 500 });
      }
      config.pollingActive = false; // Webhook mode = no polling
    }

    config.active = !!(config.botToken && config.chatId);
    await saveConfig(config);
    return Response.json({ ok: true, active: config.active });
  }

  // ---- SETUP: Remove webhook ----
  if (body.action === "remove_webhook") {
    const config = await loadConfig();
    if (config.botToken) {
      await fetch(`https://api.telegram.org/bot${config.botToken}/deleteWebhook`);
    }
    config.webhookUrl = "";
    await saveConfig(config);
    return Response.json({ ok: true });
  }

  // ---- SETUP: Send test message ----
  if (body.action === "test") {
    const config = await loadConfig();
    if (!config.botToken || !config.chatId) {
      return Response.json({ error: "Set bot token and chat ID first" }, { status: 400 });
    }
    const ok = await sendTelegram(
      config.botToken,
      config.chatId,
      "<b>Autonomous Engine</b>\nConnection active! Send /help for commands."
    );
    return Response.json({ ok });
  }

  // ---- SETUP: Get updates to find chat ID ----
  if (body.action === "get_updates") {
    const config = await loadConfig();
    if (!config.botToken) return Response.json({ error: "No bot token" }, { status: 400 });
    try {
      // Delete webhook first so getUpdates works
      await fetch(`https://api.telegram.org/bot${config.botToken}/deleteWebhook`);
      const res = await fetch(`https://api.telegram.org/bot${config.botToken}/getUpdates?limit=5&timeout=0`);
      const data = await res.json();
      return Response.json(data);
    } catch { return Response.json({ error: "Failed" }, { status: 500 }); }
  }

  // ---- TOGGLE POLLING MODE ----
  if (body.action === "toggle_polling") {
    const config = await loadConfig();
    config.pollingActive = !config.pollingActive;
    if (config.pollingActive && config.webhookUrl) {
      // Remove webhook when switching to polling
      try { await fetch(`https://api.telegram.org/bot${config.botToken}/deleteWebhook`); } catch { /* */ }
      config.webhookUrl = "";
    }
    await saveConfig(config);
    return Response.json({ ok: true, pollingActive: config.pollingActive });
  }

  // ============================================
  // POLL: Fetch and process new messages (no webhook needed)
  // ============================================
  if (body.action === "poll") {
    const config = await loadConfig();
    if (!config.botToken || !config.active) {
      return Response.json({ ok: false, error: "Bot not configured", messages: 0 });
    }

    try {
      const offset = config.lastUpdateId ? config.lastUpdateId + 1 : 0;
      const res = await fetch(
        `https://api.telegram.org/bot${config.botToken}/getUpdates?offset=${offset}&limit=10&timeout=0`
      );
      const data = await res.json();

      if (!data.ok || !data.result?.length) {
        return Response.json({ ok: true, messages: 0 });
      }

      const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
      let processed = 0;

      for (const update of data.result) {
        // Track update ID
        if (update.update_id > config.lastUpdateId) {
          config.lastUpdateId = update.update_id;
        }

        const message = update.message;
        if (!message?.text) continue;

        const chatId = String(message.chat.id);
        const text = message.text.trim();

        // Security: auto-register first user, reject others
        if (!config.chatId) {
          config.chatId = chatId;
        } else if (chatId !== config.chatId) {
          continue; // Ignore unauthorized
        }

        config.totalMessages += 1;
        config.lastMessage = new Date().toISOString();

        // Process the message
        const response = await processMessage(config, chatId, text, baseUrl);

        // Log
        config.commandLog.push({
          at: new Date().toISOString(),
          command: text.slice(0, 200),
          response: response.slice(0, 200),
        });
        if (config.commandLog.length > 100) config.commandLog = config.commandLog.slice(-100);

        // Send response
        await sendTelegram(config.botToken, chatId, response);
        processed++;
      }

      await saveConfig(config);
      return Response.json({ ok: true, messages: processed });
    } catch (err) {
      return Response.json({ ok: false, error: err instanceof Error ? err.message : "Poll failed", messages: 0 });
    }
  }

  // ============================================
  // TELEGRAM WEBHOOK: Process incoming message
  // ============================================
  const update = body;
  const message = update.message;
  if (!message?.text) return Response.json({ ok: true });

  const config = await loadConfig();
  if (!config.botToken) return Response.json({ ok: true });

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  // Security: auto-register first user, reject others
  if (!config.chatId) {
    config.chatId = chatId;
    config.active = true;
  } else if (chatId !== config.chatId) {
    return Response.json({ ok: true }); // Silently ignore
  }

  config.totalMessages += 1;
  config.lastMessage = new Date().toISOString();

  const baseUrl = config.webhookUrl
    ? config.webhookUrl.replace(/\/api\/telegram$/, "")
    : `http://localhost:${process.env.PORT || 3000}`;

  const response = await processMessage(config, chatId, text, baseUrl);

  // Log
  config.commandLog.push({
    at: new Date().toISOString(),
    command: text.slice(0, 200),
    response: response.slice(0, 200),
  });
  if (config.commandLog.length > 100) config.commandLog = config.commandLog.slice(-100);
  await saveConfig(config);

  await sendTelegram(config.botToken, chatId, response);

  return Response.json({ ok: true });
}
