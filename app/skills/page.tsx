import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  "copywriting": "Marketing", "marketing-ideas": "Marketing", "marketing-psychology": "Marketing",
  "pricing-strategy": "Marketing", "seo-audit": "Marketing", "programmatic-seo": "Marketing",
  "micro-saas-launcher": "SaaS", "saas-architect": "SaaS",
  "nextjs-supabase-saas-planner": "SaaS", "stripe-integration": "SaaS",
  "marketplace-liquidity": "SaaS",
  "webapp-testing": "Testing", "e2e-testing-patterns": "Testing",
  "javascript-testing-patterns": "Testing",
  "deployment": "Deploy", "deployment-pipeline-design": "Deploy",
  "deployment-procedures": "Deploy", "vercel-deployment": "Deploy",
  "expo-deployment": "Deploy", "frontend-design": "Frontend",
  "tailwindcss-animations": "Frontend",
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
  Marketing: "text-pink-400 bg-pink-400/10",
  SaaS: "text-emerald-400 bg-emerald-400/10",
  Testing: "text-orange-400 bg-orange-400/10",
  Deploy: "text-sky-400 bg-sky-400/10",
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

      {/* Antigravity Framework */}
      <div className="bg-card border border-accent rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center text-accent font-bold text-xs">AG</span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Antigravity Skills Framework</h2>
            <p className="text-xs text-muted">Open-source skills ecosystem for AI agents &mdash; {skills.length} skills installed</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-background rounded p-2">
            <span className="text-muted">Search:</span>
            <code className="text-foreground ml-1">npx skills find &lt;category&gt;</code>
          </div>
          <div className="bg-background rounded p-2">
            <span className="text-muted">Install:</span>
            <code className="text-foreground ml-1">npx skills add &lt;skill&gt; -g -y</code>
          </div>
          <div className="bg-background rounded p-2">
            <span className="text-muted">Manage API:</span>
            <code className="text-foreground ml-1">GET /api/skills/manage</code>
          </div>
          <div className="bg-background rounded p-2">
            <span className="text-muted">Registry:</span>
            <span className="text-accent ml-1">sickn33/antigravity-awesome-skills</span>
          </div>
        </div>
      </div>

      {/* Rovo Dev Info */}
      <div className="bg-card border border-card-border rounded-lg p-4 opacity-60">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-8 rounded-lg bg-card-border flex items-center justify-center text-muted font-bold text-xs">RD</span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Rovo Dev (Atlassian)</h2>
            <p className="text-xs text-danger">NOT installed &mdash; $20/user/month (Rule Zero violation)</p>
          </div>
        </div>
        <p className="text-xs text-muted">
          Atlassian&apos;s AI coding agent. Equivalent functionality already available via Claude Code + Gemini CLI + OpenClaw + 70 installed skills &mdash; all free.
        </p>
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
