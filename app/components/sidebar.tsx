"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavGroup {
  label: string;
  key: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Agents",
    key: "agents",
    items: [
      { href: "/symbiosis", label: "Symbiosis", icon: "S" },
      { href: "/chat", label: "Agent Chat", icon: "C" },
      { href: "/swarm", label: "Agent Swarm", icon: "W" },
      { href: "/arena", label: "Arena", icon: "!" },
    ],
  },
  {
    label: "Intelligence",
    key: "intel",
    items: [
      { href: "/research", label: "Research", icon: "?" },
      { href: "/models", label: "Models", icon: "M" },
      { href: "/noticeboard", label: "Board", icon: "N" },
    ],
  },
  {
    label: "Revenue",
    key: "revenue",
    items: [
      { href: "/revenue", label: "Revenue", icon: "R" },
      { href: "/deploy", label: "Deploy Hub", icon: "D" },
      { href: "/finance", label: "Finance", icon: "$" },
    ],
  },
  {
    label: "System",
    key: "system",
    items: [
      { href: "/guardian", label: "Guardian AI", icon: "G" },
      { href: "/skills", label: "Skills", icon: "K" },
      { href: "/vault", label: "Vault", icon: "V" },
      { href: "/tasks", label: "Tasks", icon: "T" },
      { href: "/telegram", label: "Telegram", icon: ">" },
      { href: "/logs", label: "Logs", icon: "L" },
    ],
  },
];

interface AgentStatus {
  name: string;
  status: "online" | "offline" | "error";
}

// ⚡ Bolt: Move static color mapping outside render loop
const statusColor: Record<string, string> = {
  online: "bg-success",
  offline: "bg-muted",
  error: "bg-danger",
};

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [agents, setAgents] = useState<AgentStatus[]>([
    { name: "Claude", status: "online" },
    { name: "Gemini", status: "online" },
    { name: "OpenClaw", status: "online" },
    { name: "Router", status: "offline" },
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ae-sidebar");
      if (saved) setCollapsed(JSON.parse(saved));
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetch("/api/openrouter/usage")
      .then((r) => {
        if (r.ok) setAgents((prev) => prev.map((a) => a.name === "Router" ? { ...a, status: "online" } : a));
      })
      .catch(() => {
        setAgents((prev) => prev.map((a) => a.name === "Router" ? { ...a, status: "error" } : a));
      });
  }, []);

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem("ae-sidebar", JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  }

  // ⚡ Bolt: useMemo to cache navigation group processing to avoid constant array
  // mapping and .some() iterations on every render unless pathname changes
  const processedGroups = useMemo(() => {
    return navGroups.map(group => {
      const hasActive = group.items.some((item) => pathname === item.href);
      return {
        ...group,
        hasActive,
        itemsWithState: group.items.map(item => ({
          ...item,
          isActive: pathname === item.href
        }))
      };
    });
  }, [pathname]);

  const isHome = pathname === "/";

  return (
    <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-screen shrink-0 select-none">
      {/* Brand */}
      <Link href="/" className="block p-4 border-b border-sidebar-border group">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-background font-bold text-xs shrink-0 transition-shadow group-hover:shadow-lg group-hover:shadow-accent/20">
            AE
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-foreground leading-tight truncate">Autonomous</h1>
            <p className="text-[10px] text-muted leading-tight">Symbiotic Engine</p>
          </div>
        </div>
      </Link>

      {/* Dashboard — always visible */}
      <div className="px-2 pt-2.5 pb-0.5">
        <Link
          href="/"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            isHome
              ? "bg-accent-dim text-accent shadow-sm shadow-accent/5"
              : "text-muted hover:text-foreground hover:bg-card"
          }`}
        >
          <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 ${
            isHome ? "bg-accent text-background" : "bg-card-border text-muted"
          }`}>
            E
          </span>
          Dashboard
        </Link>
      </div>

      {/* Grouped navigation */}
      <nav className="flex-1 px-2 pb-2 overflow-y-auto sidebar-scroll">
        {processedGroups.map((group) => {
          const isCollapsed = collapsed[group.key] && !group.hasActive;

          return (
            <div key={group.key} className="mt-3 first:mt-2">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className={`w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold uppercase tracking-widest rounded transition-colors ${
                  group.hasActive ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <span>{group.label}</span>
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 4.5L6 7.5L9 4.5" />
                </svg>
              </button>

              {/* Group items */}
              <div
                className={`space-y-0.5 mt-0.5 overflow-hidden transition-all duration-200 ${
                  isCollapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
                }`}
              >
                {group.itemsWithState.map((item) => {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                        item.isActive
                          ? "bg-accent-dim text-accent shadow-sm shadow-accent/5"
                          : "text-muted hover:text-foreground hover:bg-card"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 ${
                        item.isActive ? "bg-accent text-background" : "bg-card-border text-muted"
                      }`}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Agent Status */}
      <div className="px-3 py-2.5 border-t border-sidebar-border">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {agents.map((agent) => (
            <div key={agent.name} className="flex items-center gap-1.5 text-[10px] min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor[agent.status]} ${agent.status === "online" ? "shadow-sm shadow-success/30" : ""}`} />
              <span className="text-muted truncate">{agent.name}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
