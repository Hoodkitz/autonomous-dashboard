import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const TELEGRAM_DIR = join(ENGINE_DIR, "telegram");
const CONFIG_FILE = join(TELEGRAM_DIR, "config.json");
const LOG_FILE = join(TELEGRAM_DIR, "messages.json");
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

// ============================================================
// TELEGRAM CONFIG
// ============================================================

interface TelegramConfig {
  botToken: string;
  chatId: string;  // authorized chat ID (only respond to this user)
  webhookUrl: string;
  active: boolean;
  lastMessage: string;
  totalMessages: number;
  commandLog: Array<{ at: string; command: string; response: string }>;
}

async function loadConfig(): Promise<TelegramConfig> {
  try {
    return JSON.parse(await readFile(CONFIG_FILE, "utf-8"));
  } catch {
    return { botToken: "", chatId: "", webhookUrl: "", active: false, lastMessage: "", totalMessages: 0, commandLog: [] };
  }
}

async function saveConfig(c: TelegramConfig): Promise<void> {
  await mkdir(TELEGRAM_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(c, null, 2), "utf-8");
}

async function sendTelegram(token: string, chatId: string, text: string, parseMode = "HTML"): Promise<boolean> {
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000),
        parse_mode: parseMode,
      }),
    });
    return res.ok;
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
    return "Smart router error";
  } catch {
    // Fallback direct to OpenRouter
    if (!OPENROUTER_KEY) return "No API key configured";
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
/model - Current AI model info
/switch [model] - Switch AI model

<b>Revenue:</b>
/launch - Start Money Machine
/arena - Start arena battle
/payout - Collect arena profits
/swarm - Launch agent swarm
/hunt - Run niche hunter

<b>Research:</b>
/scan - Full research scan
/opportunities - Top opportunities

<b>Dashboard:</b>
/board - Notice board summary
/finance - Finance overview
/guardian - Run guardian scan

<b>AI Chat:</b>
Just send any message without / to chat with the AI directly.`;

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
Daily: ${router?.dailyRequests || 0} requests
Switches: ${router?.totalSwitches || 0} total`;
    }

    case "health": {
      try {
        const res = await fetch(`${baseUrl}/api/guardian`);
        const data = await res.json();
        const broken = data.checks?.filter((c: { status: string }) => c.status === "broken").length || 0;
        const healthy = data.checks?.filter((c: { status: string }) => c.status === "healthy").length || 0;
        return `<b>System Health: ${data.overallHealth || 0}%</b>
Healthy: ${healthy} | Broken: ${broken}
Auto-fixes: ${data.totalFixes || 0}
Last scan: ${data.lastScan ? new Date(data.lastScan).toLocaleString() : "never"}`;
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
        return `<b>OpenRouter Credits</b>
Total: $${data.credits?.total?.toFixed(4) || "0"}
Used: $${data.credits?.used?.toFixed(4) || "0"}
Remaining: $${data.credits?.remaining?.toFixed(4) || "0"}`;
      } catch { return "Could not check credits"; }
    }

    case "model": {
      try {
        const res = await fetch(`${baseUrl}/api/smart-router`);
        const data = await res.json();
        return `<b>Current Model</b>
${data.activeModelName || "unknown"}
ID: <code>${data.activeModel || "?"}</code>
Quality: ${data.currentModel?.info?.quality || "?"}/10
Speed: ${data.currentModel?.info?.speed || "?"}/10

Total requests: ${data.totalRequests}
Total tokens: ${data.totalTokens?.toLocaleString()}
Auto-switches: ${data.totalSwitches}`;
      } catch { return "Router unreachable"; }
    }

    case "switch": {
      if (!args) {
        try {
          const res = await fetch(`${baseUrl}/api/smart-router`);
          const data = await res.json();
          const models = data.availableModels?.map((m: { id: string; name: string; quality: number }) =>
            `<code>${m.id}</code> - ${m.name} (Q:${m.quality})`
          ).join("\n") || "No models";
          return `<b>Available Models:</b>\n${models}\n\nUsage: /switch model-id`;
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
        // Fire and forget - money machine is long-running
        fetch(`${baseUrl}/api/money-machine`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
        return "Money Machine launched! Check dashboard for progress.";
      } catch { return "Launch failed"; }
    }

    case "arena": {
      try {
        fetch(`${baseUrl}/api/arena`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "battle" }),
        });
        return "Arena battle started! Check /arena page for live results.";
      } catch { return "Battle launch failed"; }
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
          ? `Collected: $${data.collected?.toFixed(2)}\nTotal payouts: $${data.totalPayout?.toFixed(2)}`
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
        return "Agent swarm launched! Check /swarm page.";
      } catch { return "Swarm launch failed"; }
    }

    case "hunt": {
      try {
        fetch(`${baseUrl}/api/swarm/niche-hunter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "hunt" }),
        });
        return "Niche Hunter deployed! Searching for AI gaps and revolution opportunities...";
      } catch { return "Hunt failed"; }
    }

    case "scan": {
      try {
        fetch(`${baseUrl}/api/research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "scan_all" }),
        });
        return "Full research scan started. Check /research page.";
      } catch { return "Scan failed"; }
    }

    case "opportunities": {
      try {
        const res = await fetch(`${baseUrl}/api/swarm/niche-hunter`);
        const data = await res.json();
        const top5 = data.opportunities?.slice(-5).reverse() || [];
        if (!top5.length) return "No opportunities found yet. Run /hunt first.";
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
        return `<b>Notice Board</b>
Phase: ${data.phase || "idle"}
Status: ${data.status || "unknown"}
Active: ${data.activeWork || "nothing"}

<b>Recent Pins:</b>
${pins.map((p: { from: string; message: string }) => `[${p.from}] ${p.message}`).join("\n") || "None"}`;
      } catch { return "Board unreachable"; }
    }

    case "finance": {
      try {
        const res = await fetch(`${baseUrl}/api/self-finance`);
        const data = await res.json();
        return `<b>Self-Finance</b>
Revenue: $${data.totals?.totalRevenue?.toFixed(2) || "0"}
Costs: $${data.totals?.totalCosts?.toFixed(2) || "0"}
Profit: $${data.totals?.netProfit?.toFixed(2) || "0"}
Streams: ${data.revenueStreams?.length || 0} active`;
      } catch { return "Finance unreachable"; }
    }

    case "guardian": {
      try {
        fetch(`${baseUrl}/api/guardian`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "scan", baseUrl }),
        });
        return "Guardian scan triggered. Check /guardian page.";
      } catch { return "Guardian scan failed"; }
    }

    default:
      return `Unknown command: /${cmd}\nSend /help for available commands.`;
  }
}

// ============================================================
// GET: Telegram bot config and status
// ============================================================
export async function GET() {
  const config = await loadConfig();
  return Response.json({
    active: config.active,
    chatId: config.chatId ? `${config.chatId.slice(0, 3)}...` : "",
    webhookUrl: config.webhookUrl,
    totalMessages: config.totalMessages,
    lastMessage: config.lastMessage,
    hasBotToken: !!config.botToken,
    recentCommands: config.commandLog.slice(-10),
  });
}

// ============================================================
// POST: Webhook from Telegram OR setup actions
// ============================================================
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // ---- SETUP: Configure bot token and chat ID ----
  if (body.action === "setup") {
    const config = await loadConfig();

    if (body.botToken) config.botToken = body.botToken;
    if (body.chatId) config.chatId = body.chatId;

    // Set webhook
    if (body.webhookUrl && config.botToken) {
      config.webhookUrl = body.webhookUrl;
      try {
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
    config.active = false;
    await saveConfig(config);
    return Response.json({ ok: true });
  }

  // ---- SETUP: Send test message ----
  if (body.action === "test") {
    const config = await loadConfig();
    const ok = await sendTelegram(
      config.botToken,
      config.chatId,
      "<b>Autonomous Engine</b>\nTelegram connection active. Send /help for commands."
    );
    return Response.json({ ok });
  }

  // ---- SETUP: Get bot info / get chat ID ----
  if (body.action === "get_updates") {
    const config = await loadConfig();
    if (!config.botToken) return Response.json({ error: "No bot token" }, { status: 400 });
    try {
      const res = await fetch(`https://api.telegram.org/bot${config.botToken}/getUpdates?limit=5`);
      const data = await res.json();
      return Response.json(data);
    } catch { return Response.json({ error: "Failed to get updates" }, { status: 500 }); }
  }

  // ============================================
  // TELEGRAM WEBHOOK: Process incoming message
  // ============================================
  const update = body;
  const message = update.message;
  if (!message?.text) return Response.json({ ok: true }); // Ignore non-text

  const config = await loadConfig();
  if (!config.active) return Response.json({ ok: true });

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  // Security: only respond to authorized chat
  if (config.chatId && chatId !== config.chatId) {
    // If no chatId set yet, auto-register first user
    if (!config.chatId) {
      config.chatId = chatId;
      await saveConfig(config);
    } else {
      return Response.json({ ok: true }); // Silently ignore unauthorized
    }
  }

  config.totalMessages += 1;
  config.lastMessage = new Date().toISOString();

  const baseUrl = config.webhookUrl
    ? config.webhookUrl.replace(/\/api\/telegram$/, "")
    : `http://localhost:${process.env.PORT || 3000}`;

  let response: string;

  if (text.startsWith("/")) {
    // Command mode
    const parts = text.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1).join(" ");
    response = await handleCommand(command, args, baseUrl);
  } else {
    // AI Chat mode - use smart router
    response = await smartChat([
      {
        role: "system",
        content: `You are the Autonomous Symbiotic Engine AI assistant, responding via Telegram. Be concise and direct. The user controls a dashboard with:
- Money Machine (builds SaaS products)
- Agent Swarm (multi-agent system)
- Arena (competitive gladiator agents)
- Guardian (system health monitor)
- Niche Hunter (discovers AI gaps)
- Smart Router (auto-switches AI models)
- Revenue tracking and self-finance

Help the user control and understand the system. Suggest actions when appropriate. Keep responses under 300 words.`,
      },
      { role: "user", content: text },
    ]);
  }

  // Log command
  config.commandLog.push({
    at: new Date().toISOString(),
    command: text.slice(0, 200),
    response: response.slice(0, 200),
  });
  if (config.commandLog.length > 100) config.commandLog = config.commandLog.slice(-100);
  await saveConfig(config);

  // Send response
  await sendTelegram(config.botToken, chatId, response);

  return Response.json({ ok: true });
}
