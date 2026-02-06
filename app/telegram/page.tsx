"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TelegramState {
  active: boolean;
  pollingActive: boolean;
  chatId: string;
  webhookUrl: string;
  totalMessages: number;
  lastMessage: string;
  hasBotToken: boolean;
  recentCommands: Array<{ at: string; command: string; response: string }>;
}

export default function TelegramPage() {
  const [tg, setTg] = useState<TelegramState | null>(null);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [msg, setMsg] = useState("");
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [step, setStep] = useState(0); // setup wizard step

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram");
      if (res.ok) {
        const data = await res.json();
        setTg(data);
        if (data.pollingActive && !pollRef.current) startPolling();
      }
    } catch { /* */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchState();
    const iv = setInterval(fetchState, 8000);
    return () => {
      clearInterval(iv);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchState]);

  // Auto-detect the current setup step
  useEffect(() => {
    if (!tg) return;
    if (!tg.hasBotToken) setStep(0);
    else if (!tg.chatId) setStep(1);
    else if (!tg.active) setStep(2);
    else setStep(3); // All set
  }, [tg]);

  function startPolling() {
    if (pollRef.current) return;
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "poll" }),
        });
        const data = await res.json();
        if (data.messages > 0) {
          setPollCount((c) => c + data.messages);
          fetchState(); // Refresh state to show new commands
        }
      } catch { /* */ }
    }, 3000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }

  async function togglePolling() {
    await fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_polling" }),
    });
    if (polling) stopPolling();
    else startPolling();
    fetchState();
  }

  async function saveSetup() {
    setMsg("");
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setup",
          botToken: botToken || undefined,
          chatId: chatId || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg("Saved! Bot is " + (data.active ? "active" : "inactive"));
        fetchState();
      } else {
        setMsg(data.error || "Save failed");
      }
    } catch { setMsg("Connection error"); }
  }

  async function autoDetectChat() {
    setMsg("Looking for messages...");
    try {
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
          setMsg(`Found Chat ID: ${lastChat}`);
        } else {
          setMsg("No text messages found. Send something to your bot first.");
        }
      } else {
        setMsg("No messages. Send a message to your bot in Telegram, then try again.");
      }
    } catch { setMsg("Detection failed"); }
  }

  async function testMessage() {
    const res = await fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const data = await res.json();
    setMsg(data.ok ? "Test sent! Check Telegram." : (data.error || "Test failed"));
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Telegram Control</h1>
          <p className="text-xs text-muted mt-0.5">Control the engine from your phone</p>
        </div>
        <div className="flex items-center gap-3">
          {tg?.active && (
            <button
              onClick={togglePolling}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                polling
                  ? "bg-success text-background"
                  : "bg-card border border-card-border text-muted hover:text-foreground"
              }`}
            >
              {polling ? `Polling Active (${pollCount})` : "Start Polling"}
            </button>
          )}
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            tg?.active ? "bg-success-dim text-success" : "bg-danger-dim text-danger"
          }`}>
            {tg?.active ? "Connected" : "Offline"}
          </span>
        </div>
      </div>

      {/* Quick Setup — Step-by-step */}
      {step < 3 && (
        <div className="bg-card border border-accent rounded-xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">Setup — {["Get Bot Token", "Find Chat ID", "Activate"][step]}</h2>

          <div className="flex gap-2 mb-4">
            {[0, 1, 2].map((s) => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-all ${
                s < step ? "bg-success" : s === step ? "bg-accent" : "bg-card-border"
              }`} />
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                1. Open Telegram and search for <code className="text-accent font-medium">@BotFather</code><br />
                2. Send <code className="text-accent font-medium">/newbot</code> and follow prompts<br />
                3. Copy the bot token below
              </p>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="Paste bot token here (e.g. 123456:ABC-DEF...)"
                className="w-full px-3 py-2.5 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                onClick={saveSetup}
                disabled={!botToken}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-background hover:opacity-90 disabled:opacity-30"
              >
                Save Token
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                1. Open Telegram and send any message to your new bot<br />
                2. Come back here and click &quot;Auto-Detect&quot;<br />
                3. Or enter your Chat ID manually
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="Chat ID (auto-detected or manual)"
                  className="flex-1 px-3 py-2.5 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <button
                  onClick={autoDetectChat}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-card-border text-foreground hover:bg-accent hover:text-background transition-colors"
                >
                  Auto-Detect
                </button>
              </div>
              {chatId && (
                <button
                  onClick={saveSetup}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-background hover:opacity-90"
                >
                  Save Chat ID
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Token and Chat ID are set. Click below to activate, then enable Polling Mode to receive messages.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={saveSetup}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-background hover:opacity-90"
                >
                  Activate Bot
                </button>
                <button
                  onClick={testMessage}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-card-border text-foreground hover:bg-accent hover:text-background transition-colors"
                >
                  Send Test Message
                </button>
              </div>
            </div>
          )}

          {msg && (
            <p className={`text-xs mt-3 ${msg.includes("Error") || msg.includes("fail") || msg.includes("No ") ? "text-danger" : "text-success"}`}>
              {msg}
            </p>
          )}
        </div>
      )}

      {/* Connected State */}
      {step === 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-success rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-success">{tg?.totalMessages || 0}</div>
            <div className="text-xs text-muted mt-1">Messages Processed</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-accent">{pollCount}</div>
            <div className="text-xs text-muted mt-1">This Session</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {tg?.lastMessage ? new Date(tg.lastMessage).toLocaleTimeString() : "--"}
            </div>
            <div className="text-xs text-muted mt-1">Last Message</div>
          </div>
        </div>
      )}

      {/* Polling Explanation */}
      {step === 3 && !polling && (
        <div className="bg-warning-dim border border-warning rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-warning">Polling is off</p>
            <p className="text-xs text-muted mt-0.5">Enable polling to receive and respond to Telegram messages in real-time.</p>
          </div>
          <button
            onClick={togglePolling}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-warning text-background hover:opacity-90 shrink-0"
          >
            Start Polling
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Commands Reference */}
        <div className="bg-card border border-card-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Bot Commands</h3>
          <div className="space-y-1.5">
            {[
              { cat: "System", cmds: ["/status", "/health", "/credits", "/model", "/switch"] },
              { cat: "Revenue", cmds: ["/launch", "/arena", "/payout", "/swarm", "/hunt"] },
              { cat: "Research", cmds: ["/scan", "/opportunities"] },
              { cat: "Dashboard", cmds: ["/board", "/finance", "/guardian"] },
            ].map((group) => (
              <div key={group.cat}>
                <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mt-2 first:mt-0">{group.cat}</div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {group.cmds.map((cmd) => (
                    <code key={cmd} className="text-[11px] px-1.5 py-0.5 rounded bg-accent-dim text-accent">{cmd}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-3">Send any text without / to chat with AI directly.</p>
        </div>

        {/* Recent Commands */}
        <div className="bg-card border border-card-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Recent Activity
            {polling && <span className="ml-2 w-2 h-2 rounded-full bg-success inline-block animate-pulse" />}
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {tg?.recentCommands && tg.recentCommands.length > 0 ? (
              tg.recentCommands.slice().reverse().map((cmd, i) => (
                <div key={i} className="bg-background rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-accent font-medium">{cmd.command}</code>
                    <span className="text-[9px] text-muted">{new Date(cmd.at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[11px] text-muted mt-1 line-clamp-2">{cmd.response}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted text-center py-4">No messages yet. Send a command via Telegram.</p>
            )}
          </div>
        </div>
      </div>

      {/* Reconfigure */}
      {step === 3 && (
        <details className="bg-card border border-card-border rounded-xl">
          <summary className="px-4 py-3 text-sm text-muted cursor-pointer hover:text-foreground">
            Reconfigure Bot
          </summary>
          <div className="px-4 pb-4 space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">Bot Token</label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="New token (leave empty to keep current)"
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Chat ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder={`Current: ${tg?.chatId || "?"}`}
                  className="flex-1 px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <button onClick={autoDetectChat} className="px-3 py-2 rounded-lg text-xs bg-card-border text-muted hover:text-foreground">
                  Detect
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveSetup} className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-background hover:opacity-90">
                Save
              </button>
              <button onClick={testMessage} className="px-4 py-2 rounded-lg text-sm font-medium bg-card-border text-foreground hover:bg-accent hover:text-background transition-colors">
                Test
              </button>
            </div>
            {msg && <p className={`text-xs ${msg.includes("Error") || msg.includes("fail") ? "text-danger" : "text-success"}`}>{msg}</p>}
          </div>
        </details>
      )}
    </div>
  );
}
