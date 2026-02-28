import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GATEWAY_HOST = process.env.OPENCLAW_GATEWAY_HOST || "127.0.0.1";
const GATEWAY_PORT = process.env.OPENCLAW_GATEWAY_PORT || "18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const BASE = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;

async function gwFetch(path: string, opts?: RequestInit) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(GATEWAY_TOKEN ? { Authorization: `Bearer ${GATEWAY_TOKEN}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...headers, ...(opts?.headers as Record<string, string> || {}) },
  });
  return res;
}

// GET: Check OpenClaw gateway status + capabilities
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "status";

  try {
    if (action === "status") {
      // Health check - try to list sessions via tools invoke
      const res = await gwFetch("/tools/invoke", {
        method: "POST",
        body: JSON.stringify({ tool: "sessions_list", action: "json", args: {} }),
      });

      if (res.ok) {
        const data = await res.json();
        return Response.json({
          online: true,
          gateway: `${BASE}`,
          sessions: data.result,
          capabilities: [
            "messaging", "chat-completions", "tools-invoke", "webhooks",
            "browser", "tts", "cron", "memory", "web-search",
          ],
          channels: ["whatsapp", "telegram", "discord", "slack", "webchat"],
        });
      }

      return Response.json({ online: false, error: "Gateway returned non-OK" }, { status: 502 });
    }

    if (action === "tools") {
      // List available tools
      const res = await gwFetch("/tools/invoke", {
        method: "POST",
        body: JSON.stringify({ tool: "tools_list", action: "json", args: {} }),
      });
      if (!res.ok) return Response.json({ error: "Failed to list tools" }, { status: 502 });
      return Response.json(await res.json());
    }

    return Response.json({ error: "Unknown action. Use: status, tools" }, { status: 400 });
  } catch (err) {
    return Response.json({
      online: false,
      error: err instanceof Error ? err.message : String(err),
      hint: "Is OpenClaw gateway running? Start with: openclaw gateway",
    }, { status: 503 });
  }
}

// POST: Execute OpenClaw actions
// Actions:
//   send - Send a message via channel { action: "send", channel: "telegram", to: "...", text: "..." }
//   chat - OpenAI-compatible chat { action: "chat", messages: [...], agent: "main", stream: false }
//   tool - Invoke a tool { action: "tool", tool: "web_search", args: {...} }
//   cron - Manage cron jobs { action: "cron", subaction: "list|add|remove", ... }
//   notify - Send notification to all configured channels { action: "notify", text: "..." }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (!action) {
    return Response.json({ error: "action required" }, { status: 400 });
  }

  try {
    switch (action) {
      case "send": {
        // Send message via OpenClaw's message tool
        const { channel, to, text, media } = body;
        if (!text) return Response.json({ error: "text required" }, { status: 400 });

        const res = await gwFetch("/tools/invoke", {
          method: "POST",
          body: JSON.stringify({
            tool: "message",
            action: "send",
            args: {
              ...(channel ? { channel } : {}),
              ...(to ? { to } : {}),
              text,
              ...(media ? { media } : {}),
            },
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          return Response.json({ error: `Send failed: ${err}` }, { status: 502 });
        }
        return Response.json({ ok: true, result: await res.json() });
      }

      case "chat": {
        // OpenAI-compatible chat completions via OpenClaw
        const { messages, agent, stream } = body;
        if (!messages?.length) return Response.json({ error: "messages required" }, { status: 400 });

        const res = await gwFetch("/v1/chat/completions", {
          method: "POST",
          headers: {
            ...(agent ? { "x-openclaw-agent-id": agent } : {}),
          },
          body: JSON.stringify({
            model: `openclaw:${agent || "main"}`,
            messages,
            stream: stream || false,
          }),
        });

        if (!res.ok) {
          return Response.json({ error: "Chat failed" }, { status: 502 });
        }

        if (stream && res.body) {
          return new Response(res.body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        }

        return Response.json(await res.json());
      }

      case "tool": {
        // Invoke any OpenClaw tool
        const { tool, args: toolArgs, sessionKey } = body;
        if (!tool) return Response.json({ error: "tool name required" }, { status: 400 });

        const res = await gwFetch("/tools/invoke", {
          method: "POST",
          body: JSON.stringify({
            tool,
            args: toolArgs || {},
            ...(sessionKey ? { sessionKey } : {}),
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          return Response.json({ error: `Tool invoke failed: ${err}` }, { status: 502 });
        }
        return Response.json(await res.json());
      }

      case "notify": {
        // Send notification to all active channels (best-effort)
        const { text, channels } = body;
        if (!text) return Response.json({ error: "text required" }, { status: 400 });

        const targetChannels = channels || ["telegram", "whatsapp"];
        const results: Record<string, unknown> = {};

        for (const ch of targetChannels) {
          try {
            const res = await gwFetch("/tools/invoke", {
              method: "POST",
              body: JSON.stringify({
                tool: "message",
                action: "send",
                args: { channel: ch, text: `[Engine] ${text}` },
              }),
            });
            results[ch] = res.ok ? "sent" : `error: ${res.status}`;
          } catch (e) {
            results[ch] = `error: ${e instanceof Error ? e.message : String(e)}`;
          }
        }

        return Response.json({ ok: true, results });
      }

      case "tts": {
        // Text-to-speech via OpenClaw
        const { text: ttsText, provider, voice } = body;
        if (!ttsText) return Response.json({ error: "text required" }, { status: 400 });

        const res = await gwFetch("/tools/invoke", {
          method: "POST",
          body: JSON.stringify({
            tool: "tts",
            args: {
              text: ttsText,
              ...(provider ? { provider } : {}),
              ...(voice ? { voice } : {}),
            },
          }),
        });

        if (!res.ok) return Response.json({ error: "TTS failed" }, { status: 502 });
        return Response.json(await res.json());
      }

      default:
        return Response.json({
          error: `Unknown action: ${action}`,
          available: ["send", "chat", "tool", "notify", "tts"],
        }, { status: 400 });
    }
  } catch (err) {
    return Response.json({
      error: err instanceof Error ? err.message : String(err),
      hint: "Is OpenClaw gateway running? Start with: openclaw gateway",
    }, { status: 503 });
  }
}
