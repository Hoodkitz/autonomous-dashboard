"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Engine", icon: "E" },
  { href: "/symbiosis", label: "Symbiosis", icon: "S" },
  { href: "/chat", label: "Agent Chat", icon: "C" },
  { href: "/revenue", label: "Revenue", icon: "R" },
  { href: "/tasks", label: "Tasks", icon: "T" },
  { href: "/skills", label: "Skills", icon: "K" },
  { href: "/vault", label: "Vault", icon: "V" },
  { href: "/logs", label: "Logs", icon: "L" },
];

export function Sidebar() {
  const pathname = usePathname();

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
        <div className="flex items-center gap-2 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-muted">Claude CLI</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-muted">Gemini CLI</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-muted">OpenClaw</span>
        </div>
      </div>
    </aside>
  );
}
