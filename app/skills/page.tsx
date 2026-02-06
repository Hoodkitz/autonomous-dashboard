import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

interface SkillInfo {
  name: string;
  category: string;
  hasSkillMd: boolean;
  desc: string;
}

const cats: Record<string, string> = {
  "autopilot": "Autonomous", "agentic-development": "Autonomous", "ralph-loop": "Autonomous",
  "ai-agent-workflow": "Autonomous", "autonomous-symbiotic-engine": "Autonomous",
  "autonomous-agent-patterns": "Autonomous", "self-improving-agent": "Autonomous",
  "recursive-handoff": "Autonomous", "recursive-decomposition": "Autonomous",
  "iterative-development": "Autonomous",
  "agent-development": "Agents", "agent-orchestration-planner": "Agents",
  "ai-agents-architect": "Agents", "ai-engineer": "Agents", "create-agent": "Agents",
  "crewai-multi-agent": "Agents", "multi-agent-orchestration": "Agents",
  "multi-agent-patterns": "Agents", "sub-agent-patterns": "Agents",
  "flow-nexus-swarm": "Agents", "claude-agent-sdk": "Agents",
  "nextjs-react-typescript": "Frontend", "react-19": "Frontend",
  "react-best-practices": "Frontend", "modern-ui-designer": "Frontend",
  "senior-frontend": "Frontend", "web-development": "Frontend",
  "tailwind-4": "Frontend", "tailwind-v4-shadcn": "Frontend", "daisyui": "Frontend",
  "redux-toolkit": "Frontend",
  "python": "Backend", "python-backend": "Backend",
  "devops": "DevOps", "docker-patterns": "DevOps", "github-actions-expert": "DevOps",
  "django-security": "Security", "sql-injection-prevention": "Security",
  "flutter-expert": "Mobile", "mobile-agent": "Mobile", "electron-pro": "Desktop",
  "prompt-engineering": "AI", "thought-based-reasoning": "AI",
  "openrouter-typescript-sdk": "AI", "session-compression": "AI", "claude-reflect": "AI",
  "kernel-agent-browser": "Auto", "kernel-cli": "Auto",
  "find-skills": "Utility", "superpowers-lab": "Utility", "keybindings-help": "Utility",
};

const catColors: Record<string, string> = {
  Autonomous: "text-accent bg-accent-dim",
  Agents: "text-purple bg-purple-dim",
  Frontend: "text-cyan bg-cyan-dim",
  Backend: "text-success bg-success-dim",
  DevOps: "text-warning bg-warning-dim",
  Security: "text-danger bg-danger-dim",
  Mobile: "text-cyan bg-cyan-dim",
  Desktop: "text-cyan bg-cyan-dim",
  AI: "text-warning bg-warning-dim",
  Auto: "text-purple bg-purple-dim",
  Utility: "text-muted bg-muted-dim",
  Other: "text-muted bg-muted-dim",
};

function loadSkills(): SkillInfo[] {
  const dir = join(process.env.USERPROFILE || "C:\\Users\\Administrator", ".claude", "skills");
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const mdPath = join(dir, d.name, "SKILL.md");
        const has = existsSync(mdPath);
        let desc = "";
        if (has) {
          try {
            const line = readFileSync(mdPath, "utf-8").split("\n").find((l) => l.trim() && !l.startsWith("#"));
            desc = line?.trim().slice(0, 100) || "";
          } catch { /* skip */ }
        }
        return { name: d.name, category: cats[d.name] || "Other", hasSkillMd: has, desc };
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export default function SkillsPage() {
  const skills = loadSkills();
  const categories = [...new Set(skills.map((s) => s.category))];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Installed Skills</h1>
        <p className="text-sm text-muted mt-0.5">{skills.length} skills, {categories.length} categories</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <span key={cat} className={`text-xs font-medium px-2.5 py-1 rounded-full ${catColors[cat] || catColors.Other}`}>
            {cat} ({skills.filter((s) => s.category === cat).length})
          </span>
        ))}
      </div>

      {categories.map((cat) => (
        <div key={cat}>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{cat}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {skills.filter((s) => s.category === cat).map((skill) => (
              <div key={skill.name} className="bg-card border border-card-border rounded-lg p-3 hover:border-accent transition-colors">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${skill.hasSkillMd ? "bg-success" : "bg-muted"}`} />
                  <span className="text-sm font-medium text-foreground">{skill.name}</span>
                </div>
                {skill.desc && <p className="text-xs text-muted ml-3.5 truncate">{skill.desc}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
