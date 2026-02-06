"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Agent = "claude" | "gemini" | "openclaw" | "orchestrate";

interface Message {
  id: string;
  role: "user" | "agent" | "system" | "error" | "debug";
  agent?: string;
  content: string;
  timestamp: Date;
}

const agentStyles: Record<string, { label: string; color: string; bg: string }> = {
  claude: { label: "Claude", color: "text-accent", bg: "bg-accent-dim" },
  gemini: { label: "Gemini", color: "text-cyan", bg: "bg-cyan-dim" },
  openclaw: { label: "OpenClaw", color: "text-purple", bg: "bg-purple-dim" },
  orchestrate: { label: "Orchestrator", color: "text-warning", bg: "bg-warning-dim" },
  "claude-debug": { label: "Claude Debug", color: "text-danger", bg: "bg-danger-dim" },
  "gemini-debug": { label: "Gemini Debug", color: "text-danger", bg: "bg-danger-dim" },
  orchestrator: { label: "Orchestrator", color: "text-warning", bg: "bg-warning-dim" },
  debugger: { label: "Auto-Debug", color: "text-danger", bg: "bg-danger-dim" },
  evolve: { label: "Evolve", color: "text-purple", bg: "bg-purple-dim" },
  user: { label: "You", color: "text-foreground", bg: "bg-card-border" },
  system: { label: "System", color: "text-muted", bg: "bg-muted-dim" },
};

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "numeric", second: "numeric", hour12: true,
  }).format(date);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };
  return (
    <button onClick={copy} className="text-muted hover:text-foreground transition-colors text-xs px-1" title="Copy">
      {copied ? "ok" : "cp"}
    </button>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome", role: "system", agent: "system",
    content: "Agent Chat ready. Pick an agent or use Orchestrate for multi-agent pipeline (Claude plans -> Gemini reviews -> Claude executes -> auto-debug).",
    timestamp: new Date(),
  }]);
  const [debugMsgs, setDebugMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [agent, setAgent] = useState<Agent>("claude");
  const [isRunning, setIsRunning] = useState(false);
  const [autoDebug, setAutoDebug] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [showEvolve, setShowEvolve] = useState(false);
  const [evolveInstruction, setEvolveInstruction] = useState("");
  const [evolveAgent, setEvolveAgent] = useState<"claude" | "gemini">("claude");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages, debugMsgs, scrollToBottom]);

  const addMsg = useCallback((msg: Omit<Message, "id" | "timestamp">) => {
    const m = { ...msg, id: crypto.randomUUID(), timestamp: new Date() };
    if (msg.role === "debug") {
      setDebugMsgs((p) => [...p, m]);
    } else {
      setMessages((p) => [...p, m]);
    }
  }, []);

  const clearChat = () => {
    setMessages([]);
    setDebugMsgs([]);
    addMsg({ role: "system", agent: "system", content: "Chat cleared." });
  };

  const streamResponse = async (endpoint: string, body: Record<string, unknown>) => {
    setIsRunning(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        addMsg({ role: "error", agent: "system", content: `HTTP ${res.status}: ${await res.text()}` });
        setIsRunning(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { addMsg({ role: "error", agent: "system", content: "No stream" }); setIsRunning(false); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      let curAgent = "";
      let curContent = "";

      const flushCurrent = () => {
        if (curContent && curAgent) {
          const a = curAgent, c = curContent;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.agent === a && last.role === "agent") {
              return [...prev.slice(0, -1), { ...last, content: c, timestamp: new Date() }];
            }
            return [...prev, { id: crypto.randomUUID(), role: "agent", agent: a, content: c, timestamp: new Date() }];
          });
          curContent = "";
          curAgent = "";
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);

            if (evt.type === "done") {
              flushCurrent();
              addMsg({ role: "system", agent: "system", content: `Done (exit: ${evt.exitCode ?? "ok"})` });
            } else if (evt.type === "system") {
              flushCurrent();
              if (evt.agent === "debugger") {
                addMsg({ role: "debug", agent: evt.agent, content: evt.data });
              } else {
                addMsg({ role: "system", agent: evt.agent || "system", content: evt.data });
              }
            } else if (evt.type === "error") {
              addMsg({ role: "error", agent: evt.agent || "system", content: evt.data });
            } else if (evt.type === "stdout" || evt.type === "stderr") {
              if (evt.agent !== curAgent) flushCurrent();
              curAgent = evt.agent;
              curContent += evt.data;
              const a = curAgent, c = curContent;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.agent === a && last.role === "agent") {
                  return [...prev.slice(0, -1), { ...last, content: c }];
                }
                return [...prev, { id: crypto.randomUUID(), role: "agent", agent: a, content: c, timestamp: new Date() }];
              });
            }
          } catch { /* not JSON */ }
        }
      }
      flushCurrent();
    } catch (err) {
      addMsg({ role: "error", agent: "system", content: err instanceof Error ? err.message : String(err) });
    }

    setIsRunning(false);
    inputRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!input.trim() || isRunning) return;
    const prompt = input.trim();
    setInput("");
    addMsg({ role: "user", agent: "user", content: prompt });

    const isOrch = agent === "orchestrate";
    const endpoint = isOrch ? "/api/agent/orchestrate" : "/api/agent/run";
    const body = isOrch ? { task: prompt } : { agent, prompt, autoDebug };
    await streamResponse(endpoint, body);
  };

  const handleEvolve = async () => {
    if (!evolveInstruction.trim() || isRunning) return;
    const instruction = evolveInstruction.trim();
    setEvolveInstruction("");
    addMsg({ role: "user", agent: "user", content: `[EVOLVE] ${instruction}` });
    await streamResponse("/api/agent/evolve", {
      target: "self",
      instruction,
      agent: evolveAgent,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || !e.shiftKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agent Chat</h1>
          <p className="text-xs text-muted">Agents execute commands and write code. Ctrl+Enter or Enter to send.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input type="checkbox" checked={autoDebug} onChange={(e) => setAutoDebug(e.target.checked)} className="rounded" />
            Auto-debug
          </label>
          <button onClick={clearChat} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-card-border text-muted hover:text-foreground transition-colors">
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
        {messages.map((msg) => {
          const style = agentStyles[msg.agent || "system"] || agentStyles.system;
          return (
            <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : ""}>
              <div className={`max-w-4xl ${msg.role === "user" ? "bg-card-border rounded-2xl rounded-br-sm px-4 py-2" : ""}`}>
                {msg.role !== "user" && (
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${style.bg} ${style.color}`}>{style.label}</span>
                    <span className="text-xs text-muted">{formatTime(msg.timestamp)}</span>
                    {msg.role === "agent" && <CopyButton text={msg.content} />}
                  </div>
                )}
                <div className={`text-sm whitespace-pre-wrap break-words ${
                  msg.role === "error" ? "text-danger border border-danger rounded-lg p-3 bg-danger-dim" :
                  msg.role === "system" ? "text-muted" :
                  msg.role === "user" ? "text-foreground" :
                  "text-foreground font-mono text-xs leading-relaxed bg-card border border-card-border rounded-lg p-3 mt-0.5"
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-accent">
            <span className="w-2 h-2 rounded-full bg-accent pulse-glow" />
            Agent working...
          </div>
        )}
      </div>

      {/* Debug panel */}
      {debugMsgs.length > 0 && (
        <div className="mb-3 border border-card-border rounded-xl bg-card">
          <button onClick={() => setShowDebug(!showDebug)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-muted hover:text-foreground">
            <span>Auto-Debug Output ({debugMsgs.length})</span>
            <span>{showDebug ? "^" : "v"}</span>
          </button>
          {showDebug && (
            <div className="border-t border-card-border p-3 max-h-40 overflow-y-auto font-mono text-xs space-y-1">
              {debugMsgs.map((m) => (
                <div key={m.id} className="text-danger">{m.content}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Self-Evolve Panel */}
      <div className="mb-3 border border-card-border rounded-xl bg-card">
        <button onClick={() => setShowEvolve(!showEvolve)}
          className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-muted hover:text-foreground">
          <span className="flex items-center gap-1.5">
            <span className="text-purple">Self-Evolve</span>
            <span className="text-muted">- Let agents modify their own code</span>
          </span>
          <span>{showEvolve ? "^" : "v"}</span>
        </button>
        {showEvolve && (
          <div className="border-t border-card-border p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <select
                value={evolveAgent}
                onChange={(e) => setEvolveAgent(e.target.value as "claude" | "gemini")}
                disabled={isRunning}
                className="bg-card-border text-foreground text-xs rounded-lg px-2 py-1.5 outline-none"
              >
                <option value="claude">Claude</option>
                <option value="gemini">Gemini</option>
              </select>
              <input
                value={evolveInstruction}
                onChange={(e) => setEvolveInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEvolve(); } }}
                placeholder="Instruction for self-evolution (e.g. 'Add dark/light theme toggle')..."
                disabled={isRunning}
                className="flex-1 bg-transparent text-foreground text-xs outline-none placeholder-muted"
              />
              <button
                onClick={handleEvolve}
                disabled={isRunning || !evolveInstruction.trim()}
                className="px-3 py-1.5 bg-purple text-background text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-30 transition-opacity"
              >
                Evolve
              </button>
            </div>
            <p className="text-[10px] text-muted">
              Agent will read the entire dashboard codebase, apply improvements, and hot-reload changes.
            </p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border border-card-border rounded-xl bg-card p-3">
        <div className="flex gap-1.5 mb-2">
          {(["claude", "gemini", "openclaw", "orchestrate"] as Agent[]).map((a) => {
            const s = agentStyles[a];
            return (
              <button key={a} onClick={() => setAgent(a)} disabled={isRunning}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  agent === a ? `${s.bg} ${s.color} ring-1 ring-current` : "text-muted hover:text-foreground bg-card-border"
                }`}>
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={agent === "orchestrate" ? "Task for multi-agent team..." : `Message ${agentStyles[agent].label}...`}
            disabled={isRunning} rows={2}
            className="flex-1 bg-transparent text-foreground text-sm resize-none outline-none placeholder-muted" />
          <button onClick={handleSubmit} disabled={isRunning || !input.trim()}
            className="self-end px-4 py-2 bg-accent text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-30 transition-opacity">
            {isRunning ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
