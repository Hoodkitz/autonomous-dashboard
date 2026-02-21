import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { smartAI } from "@/app/lib/smart-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const ARENA_DIR = join(ENGINE_DIR, "arena");
const STATE_FILE = join(ARENA_DIR, "state.json");

// ============================================================
// ARENA TYPES
// ============================================================

interface GladiatorProject {
  name: string;
  tagline: string;
  niche: string;
  strategy: string;
  techStack: string;
  monetization: string;
  pricing: { free: string; pro: string; proPrice: number };
  status: "researching" | "planning" | "building" | "deploying" | "earning" | "optimizing";
  progress: number; // 0-100
  files: Array<{ path: string; description: string }>;
  landingPageCode?: string;
  deployUrl?: string;
}

interface GladiatorAdvice {
  from: string;
  to: string;
  advice: string;
  at: string;
  helpful: boolean | null;
}

interface Gladiator {
  id: string;
  name: string;
  persona: string;
  avatar: string; // emoji-style letter
  color: string;
  strategy: string; // their unique revenue approach
  systemPrompt: string;
  project: GladiatorProject | null;
  revenue: number;
  costs: number;
  profit: number;
  payouts: number;
  rounds: number;
  wins: number;
  adviceGiven: GladiatorAdvice[];
  adviceReceived: GladiatorAdvice[];
  log: string[];
  status: "idle" | "competing" | "won" | "eliminated";
  lastActive: string;
}

interface ArenaState {
  status: "idle" | "battling" | "paused";
  round: number;
  totalRounds: number;
  startedAt: string;
  updatedAt: string;
  gladiators: Gladiator[];
  leaderboard: Array<{ id: string; name: string; profit: number; rank: number }>;
  totalPayout: number;
  pendingPayout: number;
  history: Array<{ round: number; winner: string; profit: number; at: string }>;
}

// ============================================================
// 4 DEFAULT GLADIATORS - Each with a unique revenue approach
// ============================================================

const DEFAULT_GLADIATORS: Omit<Gladiator, "project" | "revenue" | "costs" | "profit" | "payouts" | "rounds" | "wins" | "adviceGiven" | "adviceReceived" | "log" | "status" | "lastActive">[] = [
  {
    id: "alpha",
    name: "Alpha",
    persona: "The SaaS Builder",
    avatar: "A",
    color: "cyan",
    strategy: "micro-saas",
    systemPrompt: `You are ALPHA — the Micro-SaaS Builder gladiator. Your strategy: find a tiny painful problem and build a focused SaaS tool that solves it for $9-29/month. You believe in:
- Laser-focused single-feature tools
- Developer and creator audiences
- Quick MVPs with beautiful landing pages
- SEO-driven organic growth
- Freemium with generous free tier

You are competing against other gladiators. Each has a different strategy. You must find YOUR best niche, build fast, and generate maximum profit.`,
  },
  {
    id: "beta",
    name: "Beta",
    persona: "The API Merchant",
    avatar: "B",
    color: "purple",
    strategy: "api-service",
    systemPrompt: `You are BETA — the API Merchant gladiator. Your strategy: build API-first products that other developers pay to use. You believe in:
- Developer-facing APIs with usage-based pricing
- Solving infrastructure problems (data processing, AI wrappers, integrations)
- Beautiful API docs and SDKs
- Pay-per-request or tiered API keys
- Building what developers hate building themselves

You are competing against other gladiators. Each has a different strategy. You must find YOUR best API opportunity, build fast, and generate maximum profit.`,
  },
  {
    id: "gamma",
    name: "Gamma",
    persona: "The Automation King",
    avatar: "G",
    color: "emerald",
    strategy: "automation-tools",
    systemPrompt: `You are GAMMA — the Automation King gladiator. Your strategy: build automation tools and workflows that save people hours of manual work. You believe in:
- No-code/low-code automation for non-technical users
- Zapier-style integrations but for specific verticals
- Selling time savings (if it saves 10 hours/month, charge $49/month)
- Template marketplaces and pre-built workflows
- Targeting businesses drowning in manual repetitive tasks

You are competing against other gladiators. Each has a different strategy. You must find YOUR best automation niche, build fast, and generate maximum profit.`,
  },
  {
    id: "delta",
    name: "Delta",
    persona: "The Content Machine",
    avatar: "D",
    color: "amber",
    strategy: "content-products",
    systemPrompt: `You are DELTA — the Content Machine gladiator. Your strategy: build AI-powered content tools and digital products. You believe in:
- AI writing/editing tools for specific niches
- Template packs, prompt libraries, course generators
- Content repurposing tools (blog→social, video→text)
- Subscription-based content platforms
- Serving marketers, creators, and educators

You are competing against other gladiators. Each has a different strategy. You must find YOUR best content-product niche, build fast, and generate maximum profit.`,
  },
];

function initGladiator(base: typeof DEFAULT_GLADIATORS[0]): Gladiator {
  return {
    ...base,
    project: null,
    revenue: 0,
    costs: 0,
    profit: 0,
    payouts: 0,
    rounds: 0,
    wins: 0,
    adviceGiven: [],
    adviceReceived: [],
    log: [],
    status: "idle",
    lastActive: new Date().toISOString(),
  };
}

function defaultArenaState(): ArenaState {
  return {
    status: "idle",
    round: 0,
    totalRounds: 0,
    startedAt: "",
    updatedAt: new Date().toISOString(),
    gladiators: DEFAULT_GLADIATORS.map(initGladiator),
    leaderboard: [],
    totalPayout: 0,
    pendingPayout: 0,
    history: [],
  };
}

async function loadArena(): Promise<ArenaState> {
  try {
    const raw = await readFile(STATE_FILE, "utf-8");
    const saved = JSON.parse(raw);
    // Ensure all 4 gladiators exist
    const state = { ...defaultArenaState(), ...saved };
    for (const def of DEFAULT_GLADIATORS) {
      if (!state.gladiators.find((g: Gladiator) => g.id === def.id)) {
        state.gladiators.push(initGladiator(def));
      }
    }
    return state;
  } catch {
    return defaultArenaState();
  }
}

async function saveArena(s: ArenaState): Promise<void> {
  await mkdir(ARENA_DIR, { recursive: true });
  s.updatedAt = new Date().toISOString();
  // Update leaderboard
  s.leaderboard = s.gladiators
    .map((g) => ({ id: g.id, name: g.name, profit: g.profit }))
    .sort((a, b) => b.profit - a.profit)
    .map((e, i) => ({ ...e, rank: i + 1 }));
  // Pending payout
  s.pendingPayout = s.gladiators.reduce((sum, g) => sum + Math.max(0, g.profit - g.payouts), 0);
  await writeFile(STATE_FILE, JSON.stringify(s, null, 2), "utf-8");
}

async function aiCall(systemPrompt: string, userPrompt: string): Promise<{ content: string; tokens: number }> {
  const result = await smartAI(systemPrompt, userPrompt, { temperature: 0.8 });
  return { content: result.content, tokens: result.tokens };
}

function extractJSON(text: string): Record<string, unknown> | null {
  try {
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
  } catch { /* */ }
  return null;
}

// ============================================================
// GET: Arena state + leaderboard
// ============================================================
export async function GET() {
  const arena = await loadArena();
  return Response.json(arena);
}

// ============================================================
// POST: Arena actions
// ============================================================
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  if (!action) return Response.json({ error: "action required" }, { status: 400 });

  // PAYOUT: Collect profits
  if (action === "payout") {
    const arena = await loadArena();
    let totalCollected = 0;
    for (const g of arena.gladiators) {
      const available = Math.max(0, g.profit - g.payouts);
      if (available > 0) {
        g.payouts += available;
        totalCollected += available;
        g.log.push(`Payout: $${available.toFixed(2)} collected`);
      }
    }
    arena.totalPayout += totalCollected;
    await saveArena(arena);
    return Response.json({ ok: true, collected: totalCollected, totalPayout: arena.totalPayout });
  }

  // STOP
  if (action === "stop") {
    const arena = await loadArena();
    arena.status = "idle";
    await saveArena(arena);
    return Response.json({ ok: true });
  }

  // ADD GLADIATOR
  if (action === "add_gladiator") {
    const arena = await loadArena();
    const newG = initGladiator({
      id: body.id || `gladiator-${Date.now()}`,
      name: body.name || "Custom",
      persona: body.persona || "Custom Strategy",
      avatar: body.avatar || "X",
      color: body.color || "pink",
      strategy: body.strategy || "custom",
      systemPrompt: body.systemPrompt || `You are a custom gladiator competing to make the most profit. Strategy: ${body.strategy || "find your own path"}.`,
    });
    arena.gladiators.push(newG);
    await saveArena(arena);
    return Response.json({ ok: true, gladiators: arena.gladiators.length });
  }

  // ========================================
  // BATTLE: Full arena round - streaming
  // ========================================
  if (action === "battle") {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function emit(data: Record<string, unknown>) {
          try { controller.enqueue(encoder.encode(JSON.stringify(data) + "\n")); } catch { /* */ }
        }

        const arena = await loadArena();
        if (arena.status === "battling") {
          emit({ type: "error", message: "Battle already in progress" });
          controller.close();
          return;
        }

        arena.status = "battling";
        arena.round += 1;
        arena.totalRounds += 1;
        if (!arena.startedAt) arena.startedAt = new Date().toISOString();
        await saveArena(arena);

        emit({ type: "battle_start", round: arena.round, gladiators: arena.gladiators.map((g) => g.name) });

        // ---- PHASE 1: Each gladiator researches their niche ----
        emit({ type: "phase", phase: "research", status: "running", message: "Gladiators researching opportunities..." });

        const researchResults = await Promise.allSettled(
          arena.gladiators.map(async (gladiator) => {
            emit({ type: "gladiator_action", id: gladiator.id, name: gladiator.name, action: "researching", phase: "research" });

            const otherProjects = arena.gladiators
              .filter((g) => g.id !== gladiator.id && g.project)
              .map((g) => `${g.name}: ${g.project!.niche} (${g.project!.strategy})`);

            const prevAdvice = gladiator.adviceReceived.slice(-3).map((a) => a.advice).join("\n");

            const { content, tokens } = await aiCall(
              gladiator.systemPrompt,
              `ROUND ${arena.round} — RESEARCH PHASE

You are competing in the Arena. Your strategy: ${gladiator.strategy}.

${gladiator.project ? `Your current project: "${gladiator.project.name}" — ${gladiator.project.tagline}
Current profit: $${gladiator.profit.toFixed(2)}
Status: ${gladiator.project.status}` : "You don't have a project yet. Find one!"}

Other gladiators' projects (AVOID overlapping niches):
${otherProjects.length > 0 ? otherProjects.join("\n") : "None yet — you're first to move!"}

${prevAdvice ? `Advice from other gladiators:\n${prevAdvice}` : ""}

${gladiator.project && gladiator.rounds > 0 ? `OPTIMIZE: Your project exists. Find ways to INCREASE revenue. Consider:
- New features worth paying for
- Better pricing strategy
- Marketing channels
- Upsell opportunities
Return JSON: { action: "optimize", improvements: [...], estimatedRevenueIncrease: number, newPricing?: {...} }` :
`RESEARCH: Find your best opportunity. It MUST be different from other gladiators.
Return JSON: { name, tagline, niche, strategy, monetization, pricing: { free, pro, proPrice }, estimatedMRR, techStack, targetAudience }`}`
            );

            return { gladiatorId: gladiator.id, content, tokens };
          })
        );

        for (const result of researchResults) {
          if (result.status !== "fulfilled") continue;
          const { gladiatorId, content, tokens } = result.value;
          const gladiator = arena.gladiators.find((g) => g.id === gladiatorId)!;
          const parsed = extractJSON(content);

          if (parsed && !gladiator.project) {
            gladiator.project = {
              name: String(parsed.name || "Untitled"),
              tagline: String(parsed.tagline || ""),
              niche: String(parsed.niche || ""),
              strategy: String(parsed.strategy || gladiator.strategy),
              techStack: String(parsed.techStack || "Next.js + Supabase"),
              monetization: String(parsed.monetization || "subscription"),
              pricing: {
                free: String((parsed.pricing as Record<string, unknown>)?.free || "Basic"),
                pro: String((parsed.pricing as Record<string, unknown>)?.pro || "Pro"),
                proPrice: Number((parsed.pricing as Record<string, unknown>)?.proPrice) || 19,
              },
              status: "researching",
              progress: 10,
              files: [],
            };
            gladiator.log.push(`Round ${arena.round}: Found niche — "${gladiator.project.name}"`);
          } else if (parsed && parsed.action === "optimize" && gladiator.project) {
            const increase = Number(parsed.estimatedRevenueIncrease) || 0;
            gladiator.revenue += increase;
            gladiator.profit += increase;
            gladiator.project.status = "optimizing";
            gladiator.log.push(`Round ${arena.round}: Optimized — +$${increase.toFixed(2)} revenue`);
          }

          gladiator.costs += tokens * 0.00001; // Rough token cost estimate
          gladiator.rounds += 1;
          gladiator.lastActive = new Date().toISOString();

          emit({
            type: "gladiator_result",
            id: gladiatorId,
            name: gladiator.name,
            phase: "research",
            project: gladiator.project?.name,
            tokens,
          });
        }

        emit({ type: "phase", phase: "research", status: "done" });
        await saveArena(arena);

        // ---- PHASE 2: Build / Progress Projects ----
        emit({ type: "phase", phase: "build", status: "running", message: "Gladiators building their projects..." });

        const buildResults = await Promise.allSettled(
          arena.gladiators.filter((g) => g.project).map(async (gladiator) => {
            emit({ type: "gladiator_action", id: gladiator.id, name: gladiator.name, action: "building", phase: "build" });

            const { content, tokens } = await aiCall(
              gladiator.systemPrompt,
              `ROUND ${arena.round} — BUILD PHASE

Your project: "${gladiator.project!.name}" — ${gladiator.project!.tagline}
Niche: ${gladiator.project!.niche}
Monetization: ${gladiator.project!.monetization}
Pricing: Free (${gladiator.project!.pricing.free}) | Pro $${gladiator.project!.pricing.proPrice}/mo (${gladiator.project!.pricing.pro})
Current progress: ${gladiator.project!.progress}%
Current status: ${gladiator.project!.status}

${gladiator.project!.progress < 100 ? `BUILD: Advance your project. Create the key components.
Generate a conversion-optimized landing page hero section and feature list.
Return JSON: {
  progress: <new progress 0-100>,
  status: "building" | "deploying" | "earning",
  landingHero: "<h1 headline>",
  features: ["feature1", "feature2", ...],
  estimatedMRR: <number>,
  marketingPlan: "<1 sentence>"
}` : `OPTIMIZE: Your project is deployed. Generate revenue optimization strategy.
Return JSON: {
  progress: 100,
  status: "earning",
  revenueThisRound: <simulated revenue number>,
  newFeature: "<feature to add>",
  marketingAction: "<action taken>"
}`}`
            );

            return { gladiatorId: gladiator.id, content, tokens };
          })
        );

        for (const result of buildResults) {
          if (result.status !== "fulfilled") continue;
          const { gladiatorId, content, tokens } = result.value;
          const gladiator = arena.gladiators.find((g) => g.id === gladiatorId)!;
          const parsed = extractJSON(content);

          if (parsed && gladiator.project) {
            const newProgress = Math.min(100, Number(parsed.progress) || gladiator.project.progress + 25);
            gladiator.project.progress = newProgress;

            if (parsed.status === "earning" || newProgress >= 100) {
              gladiator.project.status = "earning";
              gladiator.project.progress = 100;
              // Simulate revenue based on pricing
              const revenueThisRound = Number(parsed.revenueThisRound) ||
                (gladiator.project.pricing.proPrice * (Math.random() * 5 + 1));
              gladiator.revenue += revenueThisRound;
              gladiator.profit = gladiator.revenue - gladiator.costs;
              gladiator.log.push(`Round ${arena.round}: Earned $${revenueThisRound.toFixed(2)}`);
            } else {
              gladiator.project.status = String(parsed.status || "building") as GladiatorProject["status"];
              gladiator.log.push(`Round ${arena.round}: Progress ${newProgress}%`);
            }

            if (parsed.landingHero) {
              gladiator.project.landingPageCode = String(parsed.landingHero);
            }
          }

          gladiator.costs += tokens * 0.00001;

          emit({
            type: "gladiator_result",
            id: gladiatorId,
            name: gladiator.name,
            phase: "build",
            progress: gladiator.project?.progress,
            status: gladiator.project?.status,
            revenue: gladiator.revenue,
            tokens,
          });
        }

        emit({ type: "phase", phase: "build", status: "done" });
        await saveArena(arena);

        // ---- PHASE 3: Mutual Advice Exchange ----
        emit({ type: "phase", phase: "advice", status: "running", message: "Gladiators exchanging competitive advice..." });

        // Each gladiator advises one other gladiator
        for (let i = 0; i < arena.gladiators.length; i++) {
          const advisor = arena.gladiators[i];
          const advisee = arena.gladiators[(i + 1) % arena.gladiators.length];

          if (!advisor.project || !advisee.project) continue;

          emit({ type: "advice_exchange", from: advisor.name, to: advisee.name });

          const { content, tokens } = await aiCall(
            `You are ${advisor.name} (${advisor.persona}). You're advising a competitor — but good sportsmanship means giving honest advice. Your own project: "${advisor.project.name}" (${advisor.strategy}). Be strategic — help them improve but also subtly protect your advantage.`,
            `Review ${advisee.name}'s project and give honest competitive advice:

Project: "${advisee.project.name}" — ${advisee.project.tagline}
Niche: ${advisee.project.niche}
Strategy: ${advisee.strategy}
Revenue: $${advisee.revenue.toFixed(2)}
Progress: ${advisee.project.progress}%
Pricing: Free (${advisee.project.pricing.free}) | Pro $${advisee.project.pricing.proPrice}/mo

Give 2-3 specific, actionable suggestions to improve their revenue. Be direct and honest.
Return JSON: { advice: "<2-3 sentences of actionable advice>", rating: <1-10 how good their project is> }`
          );

          const parsed = extractJSON(content);
          if (parsed) {
            const adviceEntry: GladiatorAdvice = {
              from: advisor.id,
              to: advisee.id,
              advice: String(parsed.advice || content.slice(0, 300)),
              at: new Date().toISOString(),
              helpful: null,
            };
            advisor.adviceGiven.push(adviceEntry);
            advisee.adviceReceived.push(adviceEntry);

            emit({
              type: "advice_given",
              from: advisor.name,
              to: advisee.name,
              advice: adviceEntry.advice.slice(0, 150),
              rating: parsed.rating,
            });
          }

          advisor.costs += tokens * 0.00001;
        }

        emit({ type: "phase", phase: "advice", status: "done" });

        // ---- PHASE 4: Scoring & Leaderboard ----
        emit({ type: "phase", phase: "scoring", status: "running", message: "Calculating scores..." });

        // Recalculate profits
        for (const g of arena.gladiators) {
          g.profit = g.revenue - g.costs;
          g.status = "competing";
        }

        // Sort by profit
        const sorted = [...arena.gladiators].sort((a, b) => b.profit - a.profit);
        if (sorted[0]?.profit > 0) {
          sorted[0].wins += 1;
          arena.history.push({
            round: arena.round,
            winner: sorted[0].name,
            profit: sorted[0].profit,
            at: new Date().toISOString(),
          });
        }

        arena.status = "idle";
        await saveArena(arena);

        // Emit final standings
        for (const g of sorted) {
          emit({
            type: "standing",
            rank: sorted.indexOf(g) + 1,
            id: g.id,
            name: g.name,
            persona: g.persona,
            project: g.project?.name,
            revenue: g.revenue,
            costs: g.costs,
            profit: g.profit,
            progress: g.project?.progress || 0,
            wins: g.wins,
          });
        }

        emit({
          type: "battle_complete",
          round: arena.round,
          winner: sorted[0]?.name,
          winnerProfit: sorted[0]?.profit,
          totalRevenue: arena.gladiators.reduce((s, g) => s + g.revenue, 0),
          pendingPayout: arena.pendingPayout,
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
    });
  }

  return Response.json({ error: "Unknown action. Use: battle, stop, payout, add_gladiator" }, { status: 400 });
}
