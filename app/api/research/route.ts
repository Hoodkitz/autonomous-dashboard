import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const RESEARCH_DIR = join(ENGINE_DIR, "research");
const DISCOVERIES_FILE = join(RESEARCH_DIR, "discoveries.json");

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

interface Discovery {
  id: string;
  foundAt: string;
  category: "tool" | "skill" | "plugin" | "api" | "framework" | "service";
  name: string;
  description: string;
  valueScore: number; // 1-10
  effort: "low" | "medium" | "high";
  cost: "free" | "freemium" | "paid";
  relevance: string;
  installCommand?: string;
  url?: string;
  status: "new" | "evaluated" | "installed" | "rejected";
  tags: string[];
}

interface ResearchState {
  updatedAt: string;
  lastScanAt: string;
  discoveries: Discovery[];
  categories: Record<string, number>;
}

function defaultState(): ResearchState {
  return {
    updatedAt: new Date().toISOString(),
    lastScanAt: "",
    discoveries: [],
    categories: {},
  };
}

async function loadState(): Promise<ResearchState> {
  try {
    const raw = await readFile(DISCOVERIES_FILE, "utf-8");
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

async function saveState(state: ResearchState): Promise<void> {
  await mkdir(RESEARCH_DIR, { recursive: true });
  state.updatedAt = new Date().toISOString();
  // Recalc categories
  state.categories = {};
  for (const d of state.discoveries) {
    state.categories[d.category] = (state.categories[d.category] || 0) + 1;
  }
  await writeFile(DISCOVERIES_FILE, JSON.stringify(state, null, 2), "utf-8");
}

async function aiResearch(prompt: string): Promise<string> {
  if (!OPENROUTER_KEY) return "ERROR: No OpenRouter API key configured";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return `ERROR: ${err}`;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "No response";
}

// GET: Return discovered tools/skills/plugins
export async function GET(req: NextRequest) {
  const state = await loadState();
  const filter = req.nextUrl.searchParams.get("filter"); // category filter
  const sort = req.nextUrl.searchParams.get("sort") || "value"; // value, date, effort

  let filtered = state.discoveries;
  if (filter) {
    filtered = filtered.filter((d) => d.category === filter || d.status === filter);
  }

  if (sort === "value") {
    filtered.sort((a, b) => b.valueScore - a.valueScore);
  } else if (sort === "date") {
    filtered.sort((a, b) => b.foundAt.localeCompare(a.foundAt));
  } else if (sort === "effort") {
    const effortOrder = { low: 0, medium: 1, high: 2 };
    filtered.sort((a, b) => effortOrder[a.effort] - effortOrder[b.effort]);
  }

  return Response.json({
    ...state,
    discoveries: filtered,
    summary: {
      total: state.discoveries.length,
      new: state.discoveries.filter((d) => d.status === "new").length,
      highValue: state.discoveries.filter((d) => d.valueScore >= 8).length,
      free: state.discoveries.filter((d) => d.cost === "free").length,
      lowEffort: state.discoveries.filter((d) => d.effort === "low").length,
    },
  });
}

// POST: Run research scans or manage discoveries
// Actions:
//   scan_skills: Search for new antigravity skills to install
//   scan_tools: Search for useful developer tools and CLIs
//   scan_apis: Search for free APIs that add value
//   scan_plugins: Search for Claude Code / AI agent plugins
//   scan_all: Run all scans
//   evaluate: AI evaluates which discoveries are most valuable { action: "evaluate" }
//   add: Manually add a discovery { action: "add", ...discovery }
//   update_status: { action: "update_status", id, status }
//   clear: Remove all rejected items
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (!action) return Response.json({ error: "action required" }, { status: 400 });

  const state = await loadState();

  switch (action) {
    case "scan_skills": {
      const prompt = `You are a research agent for an autonomous AI development engine. The engine has 70+ "antigravity" skills installed for Claude Code (AI coding agent).

Current installed categories: AI Agents, Web/Frontend, Backend, Deployment, Marketing/Revenue, Testing, DevOps.

Search your knowledge for additional skills, plugins, or extensions that would be valuable. Focus on:
1. Skills for REVENUE GENERATION (building SaaS, payments, marketing automation)
2. Skills for DEPLOYMENT (serverless, edge functions, CDN)
3. Skills for MONITORING (error tracking, analytics, uptime)
4. Skills for DATABASE (migrations, ORMs, caching)
5. Skills for SECURITY (auth, encryption, compliance)

For each, provide a JSON array of objects with: name, description, valueScore (1-10), effort (low/medium/high), cost (free/freemium/paid), relevance (why it matters), installCommand (if available), tags.

Return ONLY the JSON array, no other text. Max 15 items, sorted by value.`;

      const result = await aiResearch(prompt);
      const discoveries = parseDiscoveries(result, "skill");
      state.discoveries.push(...discoveries);
      state.lastScanAt = new Date().toISOString();
      await saveState(state);
      return Response.json({ ok: true, found: discoveries.length, discoveries });
    }

    case "scan_tools": {
      const prompt = `You are a research agent. Find the most valuable FREE developer tools and CLIs that would enhance an autonomous AI coding engine. The engine runs on Windows, uses Node.js/Next.js/TypeScript, and builds SaaS products.

Focus on:
1. CLI tools for productivity (build, test, deploy faster)
2. Code generation tools
3. API testing tools
4. Database management tools
5. Performance/monitoring tools
6. Free alternatives to paid tools

Return a JSON array of objects with: name, description, valueScore (1-10), effort (low/medium/high), cost (free/freemium/paid), relevance, url, tags.

Return ONLY the JSON array, no other text. Max 15 items, sorted by value.`;

      const result = await aiResearch(prompt);
      const discoveries = parseDiscoveries(result, "tool");
      state.discoveries.push(...discoveries);
      state.lastScanAt = new Date().toISOString();
      await saveState(state);
      return Response.json({ ok: true, found: discoveries.length, discoveries });
    }

    case "scan_apis": {
      const prompt = `You are a research agent. Find the most valuable FREE APIs that an autonomous AI engine could use to build revenue-generating products. The engine builds SaaS products, bots, and automation tools.

Focus on:
1. AI/ML APIs with free tiers (not OpenAI/Anthropic - already have those)
2. Data APIs (weather, finance, news, social media)
3. Communication APIs (email, SMS, push notifications) with free tiers
4. Payment/billing APIs
5. Analytics and tracking APIs
6. Image/video processing APIs with free tiers

Return a JSON array of objects with: name, description, valueScore (1-10), effort (low/medium/high), cost (free/freemium/paid), relevance, url, tags.

Return ONLY the JSON array, no other text. Max 15 items, sorted by value.`;

      const result = await aiResearch(prompt);
      const discoveries = parseDiscoveries(result, "api");
      state.discoveries.push(...discoveries);
      state.lastScanAt = new Date().toISOString();
      await saveState(state);
      return Response.json({ ok: true, found: discoveries.length, discoveries });
    }

    case "scan_plugins": {
      const prompt = `You are a research agent. Find the most valuable plugins, extensions, and integrations for Claude Code (Anthropic's AI coding CLI) and MCP (Model Context Protocol) servers.

Focus on:
1. MCP servers that provide useful tools (filesystem, database, browser, API access)
2. Claude Code hooks and custom commands
3. VS Code extensions that work with AI agents
4. Browser extensions for AI development
5. GitHub Apps/Actions for AI-powered workflows

Return a JSON array of objects with: name, description, valueScore (1-10), effort (low/medium/high), cost (free/freemium/paid), relevance, installCommand (if any), url, tags.

Return ONLY the JSON array, no other text. Max 15 items, sorted by value.`;

      const result = await aiResearch(prompt);
      const discoveries = parseDiscoveries(result, "plugin");
      state.discoveries.push(...discoveries);
      state.lastScanAt = new Date().toISOString();
      await saveState(state);
      return Response.json({ ok: true, found: discoveries.length, discoveries });
    }

    case "scan_all": {
      // Run all scans sequentially
      const allDiscoveries: Discovery[] = [];
      for (const scanType of ["scan_skills", "scan_tools", "scan_apis", "scan_plugins"]) {
        try {
          const subRes = await POST(new NextRequest(`http://localhost/api/research`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: scanType }),
          }));
          const subData = await subRes.json();
          if (subData.discoveries) allDiscoveries.push(...subData.discoveries);
        } catch { /* continue with other scans */ }
      }
      // Reload state after all scans wrote to it
      const freshState = await loadState();
      return Response.json({
        ok: true,
        totalFound: allDiscoveries.length,
        discoveries: allDiscoveries,
        summary: {
          total: freshState.discoveries.length,
          new: freshState.discoveries.filter((d) => d.status === "new").length,
          highValue: freshState.discoveries.filter((d) => d.valueScore >= 8).length,
        },
      });
    }

    case "evaluate": {
      const newItems = state.discoveries.filter((d) => d.status === "new");
      if (newItems.length === 0) {
        return Response.json({ ok: true, message: "No new items to evaluate" });
      }

      const prompt = `You are an evaluation agent. Review these discovered tools/skills/plugins and rank them by value for an autonomous AI engine that builds SaaS products for revenue.

Items to evaluate:
${JSON.stringify(newItems.map((d) => ({ name: d.name, category: d.category, description: d.description, cost: d.cost })), null, 2)}

For each item, return a JSON array of objects with: name, valueScore (1-10, re-evaluated), recommendation ("install"|"evaluate_further"|"skip"), reason (one sentence why).

Return ONLY the JSON array.`;

      const result = await aiResearch(prompt);
      try {
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const evaluations = JSON.parse(jsonMatch[0]);
          for (const ev of evaluations) {
            const item = state.discoveries.find((d) => d.name === ev.name && d.status === "new");
            if (item) {
              item.valueScore = ev.valueScore || item.valueScore;
              item.status = "evaluated";
              if (ev.recommendation === "skip") item.status = "rejected";
            }
          }
          await saveState(state);
        }
      } catch { /* parse error, keep originals */ }

      return Response.json({ ok: true, evaluated: newItems.length });
    }

    case "add": {
      const discovery: Discovery = {
        id: `d-${Date.now()}`,
        foundAt: new Date().toISOString(),
        category: body.category || "tool",
        name: body.name || "",
        description: body.description || "",
        valueScore: body.valueScore || 5,
        effort: body.effort || "medium",
        cost: body.cost || "free",
        relevance: body.relevance || "",
        installCommand: body.installCommand,
        url: body.url,
        status: "new",
        tags: body.tags || [],
      };
      state.discoveries.push(discovery);
      await saveState(state);
      return Response.json({ ok: true, discovery });
    }

    case "update_status": {
      const { id, status } = body;
      const item = state.discoveries.find((d) => d.id === id);
      if (item) {
        item.status = status;
        await saveState(state);
        return Response.json({ ok: true, item });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    case "clear": {
      state.discoveries = state.discoveries.filter((d) => d.status !== "rejected");
      await saveState(state);
      return Response.json({ ok: true, remaining: state.discoveries.length });
    }

    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}

function parseDiscoveries(raw: string, category: Discovery["category"]): Discovery[] {
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const items = JSON.parse(jsonMatch[0]);
    return items.map((item: Record<string, unknown>, i: number) => ({
      id: `d-${Date.now()}-${i}`,
      foundAt: new Date().toISOString(),
      category,
      name: item.name || "",
      description: item.description || "",
      valueScore: item.valueScore || 5,
      effort: item.effort || "medium",
      cost: item.cost || "free",
      relevance: item.relevance || "",
      installCommand: item.installCommand,
      url: item.url,
      status: "new" as const,
      tags: (item.tags as string[]) || [],
    }));
  } catch {
    return [];
  }
}

export const runtime = 'nodejs';
