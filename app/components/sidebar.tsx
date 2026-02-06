"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/guardian", label: "Guardian AI", icon: "G" },
  { href: "/", label: "Engine", icon: "E" },
  { href: "/symbiosis", label: "Symbiosis", icon: "S" },
  { href: "/noticeboard", label: "Notice Board", icon: "N" },
  { href: "/chat", label: "Agent Chat", icon: "C" },
  { href: "/models", label: "Models", icon: "M" },
  { href: "/research", label: "Research", icon: "?" },
  { href: "/revenue", label: "Revenue", icon: "R" },
  { href: "/tasks", label: "Tasks", icon: "T" },
  { href: "/swarm", label: "Agent Swarm", icon: "W" },
  { href: "/arena", label: "Arena", icon: "!" },
  { href: "/skills", label: "Skills", icon: "K" },
  { href: "/vault", label: "Vault", icon: "V" },
  { href: "/finance", label: "Self-Finance", icon: "$" },
  { href: "/logs", label: "Logs", icon: "L" },
];

interface AgentStatus {
  name: string;
  status: "online" | "offline" | "error";
}

export function Sidebar() {
  const pathname = usePathname();
  const [agents, setAgents] = useState<AgentStatus[]>([
    { name: "Claude CLI", status: "online" },
    { name: "Gemini CLI", status: "online" },
    { name: "OpenClaw", status: "online" },
    { name: "OpenRouter", status: "offline" },
  ]);

  useEffect(() => {
    // Check OpenRouter status
    fetch("/api/openrouter/usage")
      .then((r) => {
        if (r.ok) {
          setAgents((prev) =>
            prev.map((a) => a.name === "OpenRouter" ? { ...a, status: "online" } : a)
          );
        }
      })
      .catch(() => {
        setAgents((prev) =>
          prev.map((a) => a.name === "OpenRouter" ? { ...a, status: "error" } : a)
        );
      });
  }, []);

  const statusColor: Record<string, string> = {
    online: "bg-success",
    offline: "bg-muted",
    error: "bg-danger",
  };

  return (
    <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-screen shrink-0">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center text-accent font-bold text-xs">
            AE
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-tight">Autonomous</h1>
            <p className="text-xs text-muted">Symbiotic Engine</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-accent-dim text-accent"
                  : "text-muted hover:text-foreground hover:bg-card"
              }`}
            >
              <span className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                isActive ? "bg-accent text-background" : "bg-card-border text-muted"
              }`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        {agents.map((agent) => (
          <div key={agent.name} className="flex items-center gap-2 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor[agent.status]}`} />
            <span className="text-muted">{agent.name}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
