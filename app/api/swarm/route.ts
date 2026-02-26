import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { join } from "path";
import { smartAI } from "@/app/lib/smart-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const SWARM_DIR = join(ENGINE_DIR, "swarm");
const REGISTRY_FILE = join(SWARM_DIR, "registry.json");
const STATE_FILE = join(SWARM_DIR, "state.json");

// ============================================================
// AGENT TYPES - Each agent is a specialized AI persona
// ============================================================

interface AgentDef {
  id: string;
  name: string;
  role: string;
  domain: string;
  systemPrompt: string;
  capabilities: string[];
  canSpawn: string[];    // agent types this agent can create
  priority: number;      // execution order (lower = first)
  autoRun: boolean;      // runs without manual trigger
  cooldownMs: number;    // minimum time between runs
}

interface AgentInstance {
  agentId: string;
  instanceId: string;
  status: "idle" | "working" | "done" | "failed" | "spawning";
  startedAt: string;
  completedAt?: string;
  task: string;
  output?: string;
  data?: Record<string, unknown>;
  spawnedAgents?: string[];
  tokensUsed?: number;
}

interface SwarmState {
  status: "idle" | "swarming" | "paused";
  startedAt: string;
  updatedAt: string;
  cycle: number;
  activeAgents: AgentInstance[];
  completedAgents: AgentInstance[];
  totalTokens: number;
  totalProducts: number;
  discoveries: string[];
  evolution: Array<{ agent: string; mutation: string; at: string }>;
}

// Built-in agent definitions - the swarm DNA
const BUILT_IN_AGENTS: AgentDef[] = [
  {
    id: "scout",
    name: "Scout Agent",
    role: "Market Intelligence",
    domain: "research",
    systemPrompt: `You are the Scout Agent - an elite market intelligence AI. Your mission:
1. Find UNTAPPED micro-SaaS niches with high demand and low competition
2. Analyze trending topics, pain points, and willingness to pay
3. Score each opportunity: demand (1-10), competition (1-10), buildability (1-10)
4. Focus on niches that can be monetized with $9-49/month subscriptions
5. Look for problems developers, creators, and small businesses face DAILY
Return JSON array of 3 opportunities, each with: name, problem, solution, targetAudience, demandScore, competitionScore, estimatedMRR, buildHours`,
    capabilities: ["market-research", "trend-analysis", "niche-scoring"],
    canSpawn: ["validator", "builder"],
    priority: 1,
    autoRun: true,
    cooldownMs: 60000,
  },
  {
    id: "validator",
    name: "Validator Agent",
    role: "Business Validation",
    domain: "research",
    systemPrompt: `You are the Validator Agent - a ruthless business critic. For the given product idea:
1. Identify the TOP 3 competitors and their weaknesses
2. Calculate realistic customer acquisition cost
3. Estimate time to first $1000 MRR
4. Find the unfair advantage we can exploit
5. Give a GO/PIVOT/KILL decision with confidence score
Return JSON: { decision, confidence, competitors, acquisitionStrategy, unfairAdvantage, risks, timeToRevenue }`,
    capabilities: ["validation", "competitor-analysis", "risk-assessment"],
    canSpawn: ["architect"],
    priority: 2,
    autoRun: true,
    cooldownMs: 30000,
  },
  {
    id: "architect",
    name: "Architect Agent",
    role: "System Design",
    domain: "engineering",
    systemPrompt: `You are the Architect Agent - a senior full-stack system designer. For the given product:
1. Design the complete technical architecture (Next.js 16 + Supabase + Vercel)
2. Define all pages, API routes, and database schema
3. Plan the auth flow (Supabase Auth)
4. Design the pricing/billing integration points
5. Create a step-by-step build order for parallel agent execution
Return JSON: { pages[], apiRoutes[], dbSchema[], authFlow, pricingModel, buildSteps[], estimatedFiles }`,
    capabilities: ["architecture", "schema-design", "api-design"],
    canSpawn: ["coder-frontend", "coder-backend", "coder-landing"],
    priority: 3,
    autoRun: true,
    cooldownMs: 30000,
  },
  {
    id: "coder-landing",
    name: "Landing Page Agent",
    role: "Landing Page Builder",
    domain: "engineering",
    systemPrompt: `You are the Landing Page Agent. Generate a STUNNING, conversion-optimized landing page.
Use Next.js + Tailwind CSS. Dark theme. Include:
1. Hero with magnetic headline + sub-headline + CTA
2. Social proof section (stats, testimonials placeholders)
3. Features grid with emoji icons (6+ features)
4. How it works (3 steps)
5. Pricing table (Free vs Pro)
6. FAQ accordion (5 questions)
7. Final CTA section
8. Footer
Make it responsive. Use modern gradients. Add subtle animations with Tailwind.
Return the COMPLETE page.tsx code only, starting with "use client";`,
    capabilities: ["landing-page", "conversion-optimization", "ui-design"],
    canSpawn: [],
    priority: 4,
    autoRun: true,
    cooldownMs: 30000,
  },
  {
    id: "coder-backend",
    name: "Backend Agent",
    role: "API Builder",
    domain: "engineering",
    systemPrompt: `You are the Backend Agent. Generate production-ready Next.js API routes.
For the given architecture, create:
1. Auth API routes (using Supabase client)
2. Core CRUD API routes for the main entities
3. Webhook endpoints if needed
4. Rate limiting middleware pattern
Return JSON with: { files: [{ path: "app/api/...", code: "..." }] }`,
    capabilities: ["api-development", "database", "auth"],
    canSpawn: [],
    priority: 4,
    autoRun: true,
    cooldownMs: 30000,
  },
  {
    id: "coder-frontend",
    name: "Frontend Agent",
    role: "Dashboard Builder",
    domain: "engineering",
    systemPrompt: `You are the Frontend Agent. Generate the core app dashboard.
For the given product, create:
1. Main dashboard page with key metrics
2. Settings/profile page
3. Core feature pages based on the architecture
Use Next.js App Router + Tailwind. Dark theme. Clean minimal UI.
Return JSON with: { files: [{ path: "app/...", code: "..." }] }`,
    capabilities: ["frontend", "dashboard", "components"],
    canSpawn: [],
    priority: 4,
    autoRun: true,
    cooldownMs: 30000,
  },
  {
    id: "marketer",
    name: "Marketing Agent",
    role: "Growth Hacker",
    domain: "marketing",
    systemPrompt: `You are the Marketing Agent - a growth hacking specialist. For the given product:
1. Write 5 SEO-optimized blog post titles + meta descriptions
2. Create 3 Twitter/X launch thread drafts
3. Write ProductHunt launch copy (tagline + description)
4. Generate 5 cold outreach email templates
5. Identify 10 subreddits/communities to promote in
6. Create a 30-day launch plan
Return JSON: { seoContent[], twitterThreads[], productHunt, emails[], communities[], launchPlan[] }`,
    capabilities: ["seo", "social-media", "email-marketing", "community"],
    canSpawn: ["seo-agent"],
    priority: 5,
    autoRun: true,
    cooldownMs: 60000,
  },
  {
    id: "seo-agent",
    name: "SEO Agent",
    role: "Search Optimizer",
    domain: "marketing",
    systemPrompt: `You are the SEO Agent. For the given product:
1. Find 20 high-value long-tail keywords
2. Generate meta tags for all pages
3. Create a sitemap structure
4. Write alt text for images
5. Generate structured data (JSON-LD)
6. Create a programmatic SEO strategy for auto-generated pages
Return JSON: { keywords[], metaTags{}, sitemap[], structuredData, programmaticStrategy }`,
    capabilities: ["keyword-research", "meta-optimization", "structured-data"],
    canSpawn: [],
    priority: 6,
    autoRun: true,
    cooldownMs: 60000,
  },
  {
    id: "deployer",
    name: "Deploy Agent",
    role: "Infrastructure",
    domain: "ops",
    systemPrompt: `You are the Deploy Agent. Generate all deployment configuration:
1. Vercel config (vercel.json)
2. Environment variables list
3. Supabase migration SQL
4. GitHub Actions CI/CD workflow
5. Domain/DNS setup instructions
Return JSON: { vercelConfig, envVars[], supabaseSQL, githubAction, domainSetup }`,
    capabilities: ["deployment", "ci-cd", "infrastructure"],
    canSpawn: ["monitor"],
    priority: 7,
    autoRun: true,
    cooldownMs: 60000,
  },
  {
    id: "monitor",
    name: "Monitor Agent",
    role: "Performance Tracker",
    domain: "ops",
    systemPrompt: `You are the Monitor Agent. Create monitoring and analytics setup:
1. Key metrics to track (MRR, churn, conversion, page views)
2. Alert rules (revenue drop, error spike, downtime)
3. Dashboard layout for business metrics
4. A/B test suggestions for the landing page
5. Revenue optimization recommendations
Return JSON: { metrics[], alerts[], dashboardLayout, abTests[], optimizations[] }`,
    capabilities: ["monitoring", "analytics", "optimization"],
    canSpawn: ["optimizer"],
    priority: 8,
    autoRun: true,
    cooldownMs: 120000,
  },
  {
    id: "optimizer",
    name: "Optimizer Agent",
    role: "Self-Improvement",
    domain: "evolution",
    systemPrompt: `You are the Optimizer Agent - the SELF-EVOLUTION core. Your job:
1. Analyze results from ALL other agents in this cycle
2. Identify what worked well and what failed
3. Suggest improvements to agent prompts and strategies
4. Propose NEW agent types that would add value
5. Calculate ROI of the entire swarm operation
6. Decide if we should: ITERATE (improve current product), PIVOT (new niche), or SCALE (deploy + market harder)
Return JSON: { analysis, improvements[], newAgentProposals[], roi, decision, reasoning, nextCycleStrategy }`,
    capabilities: ["optimization", "self-evolution", "strategy"],
    canSpawn: ["scout"],
    priority: 9,
    autoRun: true,
    cooldownMs: 120000,
  },
  {
    id: "evolver",
    name: "Evolver Agent",
    role: "Agent Creator",
    domain: "evolution",
    systemPrompt: `You are the Evolver Agent - you CREATE NEW AGENTS. Based on the optimizer's analysis:
1. Design a new specialized agent that fills a gap in the swarm
2. Write its complete system prompt
3. Define its capabilities and what it can spawn
4. Explain why this agent improves the swarm's revenue potential
Return JSON: { id, name, role, domain, systemPrompt, capabilities[], canSpawn[], reasoning }`,
    capabilities: ["agent-creation", "prompt-engineering", "system-design"],
    canSpawn: [],
    priority: 10,
    autoRun: false,
    cooldownMs: 300000,
  },
];

function defaultSwarmState(): SwarmState {
  return {
    status: "idle",
    startedAt: "",
    updatedAt: new Date().toISOString(),
    cycle: 0,
    activeAgents: [],
    completedAgents: [],
    totalTokens: 0,
    totalProducts: 0,
    discoveries: [],
    evolution: [],
  };
}

async function loadSwarmState(): Promise<SwarmState> {
  try {
    return { ...defaultSwarmState(), ...JSON.parse(await readFile(STATE_FILE, "utf-8")) };
  } catch { return defaultSwarmState(); }
}

async function saveSwarmState(s: SwarmState): Promise<void> {
  await mkdir(SWARM_DIR, { recursive: true });
  s.updatedAt = new Date().toISOString();
  await writeFile(STATE_FILE, JSON.stringify(s, null, 2), "utf-8");
}

async function loadRegistry(): Promise<AgentDef[]> {
  try {
    const raw = await readFile(REGISTRY_FILE, "utf-8");
    const custom: AgentDef[] = JSON.parse(raw);
    // Merge built-in + custom (custom overrides built-in by id)
    const merged = [...BUILT_IN_AGENTS];
    for (const c of custom) {
      const idx = merged.findIndex((a) => a.id === c.id);
      if (idx >= 0) merged[idx] = c;
      else merged.push(c);
    }
    return merged.sort((a, b) => a.priority - b.priority);
  } catch {
    return [...BUILT_IN_AGENTS];
  }
}

async function saveRegistry(agents: AgentDef[]): Promise<void> {
  await mkdir(SWARM_DIR, { recursive: true });
  // Only save non-built-in or modified agents
  const custom = agents.filter((a) => !BUILT_IN_AGENTS.find((b) => b.id === a.id && b.systemPrompt === a.systemPrompt));
  await writeFile(REGISTRY_FILE, JSON.stringify(custom, null, 2), "utf-8");
}

async function aiCall(systemPrompt: string, userPrompt: string): Promise<{ content: string; tokens: number }> {
  const result = await smartAI(systemPrompt, userPrompt);
  return { content: result.content, tokens: result.tokens };
}

function extractJSON(text: string): Record<string, unknown> | null {
  try {
    // Try array first
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) return { _array: JSON.parse(arrMatch[0]) };
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
  } catch { /* */ }
  return null;
}

// GET: Return swarm status + registry
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "status";

  if (action === "registry") {
    const agents = await loadRegistry();
    return Response.json({ agents, count: agents.length });
  }

  const swarm = await loadSwarmState();
  const agents = await loadRegistry();

  // List product directories
  let products: string[] = [];
  try {
    const mmDir = join(ENGINE_DIR, "money-machine", "products");
    products = await readdir(mmDir);
  } catch { /* */ }

  return Response.json({
    ...swarm,
    registeredAgents: agents.length,
    agentTypes: agents.map((a) => ({ id: a.id, name: a.name, role: a.role, domain: a.domain })),
    products,
  });
}

// POST: Control the swarm
// { action: "swarm" } - Launch full swarm cycle
// { action: "run_agent", agentId: "scout" } - Run single agent
// { action: "stop" } - Stop swarm
// { action: "evolve" } - Trigger self-evolution
// { action: "add_agent", agent: {...} } - Register new agent type
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  if (!action) return Response.json({ error: "action required" }, { status: 400 });

  if (action === "stop") {
    const s = await loadSwarmState();
    s.status = "idle";
    await saveSwarmState(s);
    return Response.json({ ok: true });
  }

  if (action === "add_agent") {
    const agentDef = body.agent as AgentDef;
    if (!agentDef?.id || !agentDef?.systemPrompt) {
      return Response.json({ error: "agent id and systemPrompt required" }, { status: 400 });
    }
    const agents = await loadRegistry();
    const idx = agents.findIndex((a) => a.id === agentDef.id);
    if (idx >= 0) agents[idx] = agentDef;
    else agents.push(agentDef);
    await saveRegistry(agents);
    return Response.json({ ok: true, registered: agents.length });
  }

  // ========================================
  // FULL SWARM CYCLE - streaming NDJSON
  // ========================================
  if (action === "swarm" || action === "run_agent" || action === "evolve") {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function emit(data: Record<string, unknown>) {
          try { controller.enqueue(encoder.encode(JSON.stringify(data) + "\n")); } catch { /* closed */ }
        }

        const swarm = await loadSwarmState();
        const registry = await loadRegistry();

        if (swarm.status === "swarming" && action === "swarm") {
          emit({ type: "error", message: "Swarm already active" });
          controller.close();
          return;
        }

        swarm.status = "swarming";
        swarm.cycle += 1;
        swarm.startedAt = new Date().toISOString();
        swarm.activeAgents = [];
        await saveSwarmState(swarm);

        emit({ type: "swarm_start", cycle: swarm.cycle, agents: registry.length });

        // Determine which agents to run
        let agentsToRun: AgentDef[];
        if (action === "run_agent") {
          const a = registry.find((r) => r.id === body.agentId);
          agentsToRun = a ? [a] : [];
        } else if (action === "evolve") {
          agentsToRun = registry.filter((a) => a.domain === "evolution");
        } else {
          agentsToRun = registry.filter((a) => a.autoRun);
        }

        // Context accumulator - each agent's output feeds the next
        let context: Record<string, unknown> = {};
        const cycleDir = join(SWARM_DIR, `cycle-${swarm.cycle}`);
        await mkdir(cycleDir, { recursive: true });

        // Group agents by priority for parallel execution within same priority
        const priorityGroups = new Map<number, AgentDef[]>();
        for (const agent of agentsToRun) {
          const group = priorityGroups.get(agent.priority) || [];
          group.push(agent);
          priorityGroups.set(agent.priority, group);
        }

        const sortedPriorities = [...priorityGroups.keys()].sort((a, b) => a - b);

        for (const priority of sortedPriorities) {
          const group = priorityGroups.get(priority)!;

          // Check if swarm was stopped
          const currentState = await loadSwarmState();
          if (currentState.status !== "swarming") {
            emit({ type: "stopped", message: "Swarm stopped by user" });
            break;
          }

          emit({ type: "priority_group", priority, agents: group.map((a) => a.id) });

          // Run agents in this priority group in parallel
          const results = await Promise.allSettled(
            group.map(async (agentDef) => {
              const instanceId = `${agentDef.id}-${swarm.cycle}-${Date.now()}`;
              const instance: AgentInstance = {
                agentId: agentDef.id,
                instanceId,
                status: "working",
                startedAt: new Date().toISOString(),
                task: `Cycle ${swarm.cycle} - ${agentDef.role}`,
              };

              swarm.activeAgents.push(instance);
              await saveSwarmState(swarm);

              emit({
                type: "agent_start",
                agentId: agentDef.id,
                name: agentDef.name,
                role: agentDef.role,
                domain: agentDef.domain,
              });

              // Build context prompt from previous agents' outputs
              const contextStr = Object.keys(context).length > 0
                ? `\n\nCONTEXT FROM PREVIOUS AGENTS:\n${JSON.stringify(context, null, 2)}`
                : "";

              const userPrompt = `Execute your mission for Cycle #${swarm.cycle}.${contextStr}\n\nDeliver your best work. Be specific and actionable.`;

              const { content, tokens } = await aiCall(agentDef.systemPrompt, userPrompt);
              const parsed = extractJSON(content);

              instance.status = content.startsWith("ERROR") ? "failed" : "done";
              instance.completedAt = new Date().toISOString();
              instance.output = content.slice(0, 2000);
              instance.data = parsed || {};
              instance.tokensUsed = tokens;
              swarm.totalTokens += tokens;

              // Save agent output to file
              await writeFile(
                join(cycleDir, `${agentDef.id}.json`),
                JSON.stringify({ agent: agentDef.id, instance, parsed, rawOutput: content }, null, 2),
                "utf-8"
              );

              emit({
                type: "agent_done",
                agentId: agentDef.id,
                name: agentDef.name,
                status: instance.status,
                tokens,
                dataKeys: parsed ? Object.keys(parsed) : [],
                preview: content.slice(0, 200),
              });

              // Check if this agent wants to spawn new agents
              if (agentDef.id === "evolver" && parsed) {
                try {
                  const newAgent: AgentDef = {
                    id: String(parsed.id || `custom-${Date.now()}`),
                    name: String(parsed.name || "Custom Agent"),
                    role: String(parsed.role || "Specialist"),
                    domain: String(parsed.domain || "custom"),
                    systemPrompt: String(parsed.systemPrompt || ""),
                    capabilities: (parsed.capabilities as string[]) || [],
                    canSpawn: (parsed.canSpawn as string[]) || [],
                    priority: 5,
                    autoRun: true,
                    cooldownMs: 60000,
                  };
                  if (newAgent.systemPrompt.length > 50) {
                    const reg = await loadRegistry();
                    reg.push(newAgent);
                    await saveRegistry(reg);
                    swarm.evolution.push({
                      agent: newAgent.id,
                      mutation: `Evolved: ${newAgent.name} - ${newAgent.role}`,
                      at: new Date().toISOString(),
                    });
                    instance.spawnedAgents = [newAgent.id];
                    emit({
                      type: "agent_evolved",
                      newAgent: { id: newAgent.id, name: newAgent.name, role: newAgent.role },
                    });
                  }
                } catch { /* skip */ }
              }

              return { agentId: agentDef.id, parsed, tokens };
            })
          );

          // Collect results into context for next priority group
          for (const result of results) {
            if (result.status === "fulfilled" && result.value.parsed) {
              context[result.value.agentId] = result.value.parsed;
            }
          }

          // Move active to completed
          swarm.completedAgents.push(
            ...swarm.activeAgents.filter((a) => a.status === "done" || a.status === "failed")
          );
          swarm.activeAgents = swarm.activeAgents.filter((a) => a.status === "working");
        }

        // Save full cycle context
        await writeFile(join(cycleDir, "_context.json"), JSON.stringify(context, null, 2), "utf-8");

        // If scout found opportunities and we have a full pipeline, create product
        if (context.scout && context["coder-landing"]) {
          swarm.totalProducts += 1;
          // Save product to money-machine directory too
          const productDir = join(ENGINE_DIR, "money-machine", "products", `swarm-${swarm.cycle}`);
          await mkdir(join(productDir, "deploy", "app"), { recursive: true });

          const scoutData = context.scout as Record<string, unknown>;
          const opportunities = (scoutData._array as Array<Record<string, unknown>>) || [scoutData];
          const product = opportunities[0] || {};

          const landingData = context["coder-landing"] as Record<string, unknown>;
          const landingCode = String(landingData._raw || landingData.code || "// Generated by swarm");

          await writeFile(join(productDir, "spec.json"), JSON.stringify({ product, context }, null, 2), "utf-8");
          if (landingCode.length > 100) {
            await writeFile(join(productDir, "deploy", "app", "page.tsx"), landingCode, "utf-8");
          }

          emit({ type: "product_created", product: product.name, cycle: swarm.cycle });
        }

        // Update notice board
        try {
          const boardRaw = await readFile(join(ENGINE_DIR, "noticeboard.json"), "utf-8");
          const board = JSON.parse(boardRaw);
          board.pins.push({
            from: "swarm",
            message: `Swarm Cycle #${swarm.cycle} complete. ${swarm.completedAgents.length} agents ran. ${swarm.evolution.length} evolutions.`,
            at: new Date().toISOString(),
          });
          board.updatedBy = "swarm";
          board.updatedAt = new Date().toISOString();
          await writeFile(join(ENGINE_DIR, "noticeboard.json"), JSON.stringify(board, null, 2), "utf-8");
        } catch { /* */ }

        swarm.status = "idle";
        await saveSwarmState(swarm);

        emit({
          type: "swarm_complete",
          cycle: swarm.cycle,
          agentsRan: swarm.completedAgents.length,
          totalTokens: swarm.totalTokens,
          products: swarm.totalProducts,
          evolutions: swarm.evolution.length,
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
    });
  }

  return Response.json({ error: "Unknown action. Use: swarm, run_agent, stop, evolve, add_agent" }, { status: 400 });
}
export const runtime = 'nodejs';
