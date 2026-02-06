"use client";

import { useState, useEffect, useCallback } from "react";

interface TelegramState {
  active: boolean;
  chatId: string;
  webhookUrl: string;
  totalMessages: number;
  lastMessage: string;
  hasBotToken: boolean;
  recentCommands: Array<{ at: string; command: string; response: string }>;
}

interface RouterState {
  activeModel: string;
  activeModelName: string;
  credits: { total: number; used: number; remaining: number; lastChecked: string };
  totalRequests: number;
  totalTokens: number;
  totalSwitches: number;
  dailyRequests: number;
  switchLog: Array<{ from: string; to: string; reason: string; at: string }>;
  availableModels: Array<{ id: string; name: string; quality: number; speed: number; context: number }>;
  modelUsage: Record<string, { totalRequests: number; failures: number; consecutiveFailures: number; blocked: boolean }>;
}

export default function TelegramPage() {
  const [tg, setTg] = useState<TelegramState | null>(null);
  const [router, setRouter] = useState<RouterState | null>(null);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [setupMsg, setSetupMsg] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const [tgRes, routerRes] = await Promise.all([
        fetch("/api/telegram"),
        fetch("/api/smart-router"),
      ]);
      if (tgRes.ok) setTg(await tgRes.json());
      if (routerRes.ok) setRouter(await routerRes.json());
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 10000);
    return () => clearInterval(interval);
  }, [fetchState]);

  async function setupBot() {
    setSetupLoading(true);
    setSetupMsg("");
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setup",
          botToken: botToken || undefined,
          chatId: chatId || undefined,
          webhookUrl: webhookUrl || undefined,
        }),
      });
      const data = await res.json();
      setSetupMsg(data.ok ? "Setup complete! Bot is active." : `Error: ${data.error}`);
      fetchState();
    } catch { setSetupMsg("Setup failed"); }
    setSetupLoading(false);
  }

  async function testBot() {
    const res = await fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const data = await res.json();
    setSetupMsg(data.ok ? "Test message sent!" : "Test failed — check token and chat ID");
  }

  async function getUpdates() {
    const res = await fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_updates" }),
    });
    const data = await res.json();
    if (data.result?.length > 0) {
      const lastChat = data.result[data.result.length - 1]?.message?.chat?.id;
      if (lastChat) {
        setChatId(String(lastChat));
        setSetupMsg(`Found Chat ID: ${lastChat}. Click Save to activate.`);
      }
    } else {
      setSetupMsg("No messages found. Send a message to your bot first, then try again.");
    }
  }

  async function switchModel(modelId: string) {
    await fetch("/api/smart-router", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch", modelId }),
    });
    fetchState();
  }

  async function checkCredits() {
    await fetch("/api/smart-router", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_credits" }),
    });
    fetchState();
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Telegram Bot & Smart Router</h1>
          <p className="text-xs text-muted mt-1">
            Control the engine from your phone + auto-model switching
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded font-medium ${
            tg?.active ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
          }`}>
            Bot: {tg?.active ? "ACTIVE" : "INACTIVE"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: Telegram Bot Setup */}
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Telegram Bot Setup</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Bot Token (from @BotFather)</label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456:ABC-DEF..."
                  className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">
                  Chat ID <button onClick={getUpdates} className="text-accent hover:underline ml-1">(auto-detect)</button>
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="Your Telegram user/chat ID"
                  className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Webhook URL (public HTTPS URL to this dashboard)</label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-domain.com/api/telegram"
                  className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted"
                />
                <p className="text-[10px] text-muted mt-1">
                  Must be HTTPS. Use ngrok or Cloudflare Tunnel for local dev.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={setupBot}
                  disabled={setupLoading}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-background hover:opacity-90 disabled:opacity-50"
                >
                  {setupLoading ? "Saving..." : "Save & Activate"}
                </button>
                <button
                  onClick={testBot}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-card-border text-foreground hover:bg-accent hover:text-background"
                >
                  Send Test
                </button>
              </div>
              {setupMsg && (
                <p className={`text-xs ${setupMsg.includes("Error") || setupMsg.includes("failed") ? "text-danger" : "text-success"}`}>
                  {setupMsg}
                </p>
              )}
            </div>
          </div>

          {/* Bot Status */}
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Bot Status</h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">{tg?.totalMessages || 0}</div>
                <div className="text-xs text-muted">Messages</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">{tg?.hasBotToken ? "Yes" : "No"}</div>
                <div className="text-xs text-muted">Token Set</div>
              </div>
            </div>
            {tg?.lastMessage && (
              <p className="text-[10px] text-muted mt-2">Last: {new Date(tg.lastMessage).toLocaleString()}</p>
            )}
          </div>

          {/* How to Setup Guide */}
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Quick Setup Guide</h3>
            <ol className="text-xs text-muted space-y-1.5 list-decimal list-inside">
              <li>Open Telegram, search <code className="text-accent">@BotFather</code></li>
              <li>Send <code className="text-accent">/newbot</code> and follow the prompts</li>
              <li>Copy the bot token and paste it above</li>
              <li>Send any message to your new bot</li>
              <li>Click <span className="text-accent">(auto-detect)</span> to get your Chat ID</li>
              <li>For webhook: expose this dashboard via HTTPS (ngrok, Cloudflare Tunnel, or deploy to Vercel)</li>
              <li>Set webhook URL to <code className="text-accent">https://your-url/api/telegram</code></li>
              <li>Click Save &amp; Activate</li>
            </ol>
          </div>

          {/* Available Commands */}
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Bot Commands</h3>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {[
                ["/status", "Engine status"],
                ["/health", "System health"],
                ["/credits", "API credits"],
                ["/model", "Current model"],
                ["/switch", "Switch model"],
                ["/launch", "Money Machine"],
                ["/arena", "Start battle"],
                ["/payout", "Collect profits"],
                ["/swarm", "Agent swarm"],
                ["/hunt", "Niche hunter"],
                ["/scan", "Research scan"],
                ["/opportunities", "Top niches"],
                ["/board", "Notice board"],
                ["/finance", "Finance info"],
                ["/guardian", "Guardian scan"],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex gap-1">
                  <code className="text-accent">{cmd}</code>
                  <span className="text-muted">{desc}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-2">Send any text without / to chat with the AI directly.</p>
          </div>
        </div>

        {/* RIGHT: Smart Router */}
        <div className="space-y-4">
          {/* Current Model */}
          <div className="bg-card border border-accent/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-accent mb-3">Smart Model Router</h3>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-bold text-foreground">{router?.activeModelName || "Loading..."}</div>
                <code className="text-[10px] text-muted">{router?.activeModel}</code>
              </div>
              <button
                onClick={checkCredits}
                className="px-3 py-1.5 rounded-lg text-xs bg-card-border text-muted hover:text-foreground"
              >
                Refresh Credits
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="text-lg font-bold text-success">${router?.credits?.remaining?.toFixed(4) || "?"}</div>
                <div className="text-[10px] text-muted">Credits Left</div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{router?.totalRequests?.toLocaleString() || 0}</div>
                <div className="text-[10px] text-muted">Requests</div>
              </div>
              <div>
                <div className="text-lg font-bold text-accent">{router?.dailyRequests || 0}</div>
                <div className="text-[10px] text-muted">Today</div>
              </div>
              <div>
                <div className="text-lg font-bold text-warning">{router?.totalSwitches || 0}</div>
                <div className="text-[10px] text-muted">Switches</div>
              </div>
            </div>
            <p className="text-[9px] text-muted mt-2">
              Auto-switches to next best model on failure. Monitors credits and daily limits.
            </p>
          </div>

          {/* Available Models */}
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Available Models (Free Tier)</h3>
            <div className="space-y-1.5">
              {router?.availableModels?.map((model) => {
                const usage = router.modelUsage?.[model.id];
                const isActive = model.id === router.activeModel;
                const isBlocked = usage?.blocked;
                return (
                  <div
                    key={model.id}
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all cursor-pointer hover:bg-card-border/50 ${
                      isActive ? "bg-accent/10 border border-accent/30" :
                      isBlocked ? "opacity-40 bg-danger/5" : "border border-transparent"
                    }`}
                    onClick={() => !isActive && switchModel(model.id)}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      isActive ? "bg-accent" : isBlocked ? "bg-danger" : "bg-card-border"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{model.name}</span>
                        {isActive && <span className="text-[8px] px-1 py-0.5 rounded bg-accent/20 text-accent font-bold">ACTIVE</span>}
                        {isBlocked && <span className="text-[8px] px-1 py-0.5 rounded bg-danger/20 text-danger font-bold">BLOCKED</span>}
                      </div>
                      <div className="flex gap-2 text-[10px] text-muted">
                        <span>Q:{model.quality}</span>
                        <span>S:{model.speed}</span>
                        <span>{(model.context / 1000).toFixed(0)}k ctx</span>
                        {usage && <span>{usage.totalRequests} req</span>}
                        {usage?.failures ? <span className="text-danger">{usage.failures} fail</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Switch Log */}
          {router?.switchLog && router.switchLog.length > 0 && (
            <div className="bg-card border border-card-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Model Switch Log</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {router.switchLog.slice(-10).reverse().map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className="text-warning font-bold">SWITCH</span>
                    <span className="text-muted">{s.from.split("/").pop()}</span>
                    <span className="text-foreground">→</span>
                    <span className="text-accent">{s.to.split("/").pop()}</span>
                    <span className="text-muted">({s.reason})</span>
                    <span className="text-muted ml-auto">{new Date(s.at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Commands */}
          {tg?.recentCommands && tg.recentCommands.length > 0 && (
            <div className="bg-card border border-card-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Recent Telegram Commands</h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {tg.recentCommands.slice(-10).reverse().map((cmd, i) => (
                  <div key={i} className="bg-background rounded p-2">
                    <div className="flex items-center justify-between">
                      <code className="text-xs text-accent">{cmd.command}</code>
                      <span className="text-[9px] text-muted">{new Date(cmd.at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10px] text-muted mt-0.5 truncate">{cmd.response}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
