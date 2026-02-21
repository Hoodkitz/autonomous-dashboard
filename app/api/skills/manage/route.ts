import { NextRequest } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "node:child_process";

export const dynamic = "force-dynamic";

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const SKILLS_DIR = join(HOME, ".agents", "skills");
const CLAUDE_SKILLS_DIR = join(HOME, ".claude", "skills");

interface SkillInfo {
  name: string;
  description: string;
  source: "agents" | "claude" | "both";
  path: string;
}

async function getSkillDescription(dir: string, name: string): Promise<string> {
  try {
    const skillMd = await readFile(join(dir, name, "SKILL.md"), "utf-8");
    // Extract first meaningful line after frontmatter
    const lines = skillMd.split("\n");
    let pastFrontmatter = false;
    let foundHeader = false;
    for (const line of lines) {
      if (line.startsWith("---")) {
        pastFrontmatter = !pastFrontmatter;
        continue;
      }
      if (pastFrontmatter) continue;
      if (line.startsWith("# ")) {
        foundHeader = true;
        continue;
      }
      if (foundHeader && line.trim()) return line.trim().slice(0, 200);
    }
    // Try description from frontmatter
    const descMatch = skillMd.match(/description:\s*"([^"]+)"/);
    if (descMatch) return descMatch[1].slice(0, 200);
    return "(no description)";
  } catch {
    return "(no SKILL.md)";
  }
}

// GET: List all installed skills from both directories
export async function GET(req: NextRequest) {
  const skills: SkillInfo[] = [];
  const seen = new Set<string>();

  // Read from .agents/skills
  try {
    const entries = await readdir(SKILLS_DIR);
    for (const name of entries) {
      const desc = await getSkillDescription(SKILLS_DIR, name);
      skills.push({ name, description: desc, source: "agents", path: join(SKILLS_DIR, name) });
      seen.add(name);
    }
  } catch { /* dir may not exist */ }

  // Read from .claude/skills
  try {
    const entries = await readdir(CLAUDE_SKILLS_DIR);
    for (const name of entries) {
      if (seen.has(name)) {
        const existing = skills.find((s) => s.name === name);
        if (existing) existing.source = "both";
        continue;
      }
      const desc = await getSkillDescription(CLAUDE_SKILLS_DIR, name);
      skills.push({ name, description: desc, source: "claude", path: join(CLAUDE_SKILLS_DIR, name) });
    }
  } catch { /* dir may not exist */ }

  // Categorize skills
  const categories: Record<string, string[]> = {
    "AI Agents": [],
    "Web/Frontend": [],
    "Backend": [],
    "Deployment": [],
    "Marketing/Revenue": [],
    "Testing": [],
    "DevOps": [],
    "Other": [],
  };

  for (const skill of skills) {
    const n = skill.name.toLowerCase();
    if (n.includes("agent") || n.includes("ai-") || n.includes("orchestrat") || n.includes("multi-agent") || n.includes("autopilot") || n.includes("ralph") || n.includes("crewai")) {
      categories["AI Agents"].push(skill.name);
    } else if (n.includes("react") || n.includes("next") || n.includes("tailwind") || n.includes("frontend") || n.includes("daisy") || n.includes("shadcn") || n.includes("ui") || n.includes("flutter") || n.includes("electron") || n.includes("mobile") || n.includes("redux") || n.includes("web-dev")) {
      categories["Web/Frontend"].push(skill.name);
    } else if (n.includes("python") || n.includes("django") || n.includes("sql") || n.includes("backend")) {
      categories["Backend"].push(skill.name);
    } else if (n.includes("deploy") || n.includes("vercel") || n.includes("expo") || n.includes("railway")) {
      categories["Deployment"].push(skill.name);
    } else if (n.includes("market") || n.includes("seo") || n.includes("pricing") || n.includes("copy") || n.includes("saas") || n.includes("revenue") || n.includes("stripe") || n.includes("micro-saas")) {
      categories["Marketing/Revenue"].push(skill.name);
    } else if (n.includes("test") || n.includes("e2e") || n.includes("webapp-test")) {
      categories["Testing"].push(skill.name);
    } else if (n.includes("devops") || n.includes("docker") || n.includes("github-action") || n.includes("kernel")) {
      categories["DevOps"].push(skill.name);
    } else {
      categories["Other"].push(skill.name);
    }
  }

  // External tools info
  const externalTools = {
    antigravity: {
      name: "Antigravity Skills Framework",
      description: "Open-source skills ecosystem for AI agents. 70+ skills installed via npx skills.",
      installed: skills.length,
      installCommand: "npx skills add <owner/repo@skill> -g -y",
      searchCommand: "npx skills find <category>",
      registry: "https://github.com/sickn33/antigravity-awesome-skills",
    },
    rovoDev: {
      name: "Rovo Dev (Atlassian)",
      description: "Atlassian's AI coding agent. Paid service ($20/user/month). NOT installed per Rule Zero.",
      installed: false,
      cost: "$20/user/month",
      note: "Rule Zero violation - costs money. Use Claude Code + Gemini CLI + OpenClaw instead (all free).",
      alternative: "Claude Code (free) + installed skills provide equivalent functionality",
    },
  };

  return Response.json({
    totalSkills: skills.length,
    skills,
    categories,
    externalTools,
  });
}

// POST: Install or search for new skills
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (!action) return Response.json({ error: "action required" }, { status: 400 });

  if (action === "search") {
    const query = body.query || "";
    return new Promise<Response>((resolve) => {
      exec(`npx skills find "${query}"`, { timeout: 30000 }, (err, stdout, stderr) => {
        resolve(Response.json({
          ok: !err,
          results: stdout,
          error: err ? stderr : undefined,
        }));
      });
    });
  }

  if (action === "install") {
    const skill = body.skill || "";
    if (!skill) return Response.json({ error: "skill identifier required" }, { status: 400 });
    return new Promise<Response>((resolve) => {
      exec(`npx skills add ${skill} -g -y`, { timeout: 60000 }, (err, stdout, stderr) => {
        resolve(Response.json({
          ok: !err,
          output: stdout,
          error: err ? stderr : undefined,
        }));
      });
    });
  }

  return Response.json({ error: "Unknown action. Use: search, install" }, { status: 400 });
}

export const runtime = 'nodejs';
