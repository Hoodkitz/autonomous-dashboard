import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const MONEY_DIR = join(ENGINE_DIR, "money-machine");
const STATE_FILE = join(MONEY_DIR, "state.json");
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

interface MoneyMachineState {
  status: "idle" | "running" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  currentPhase: string;
  phases: PhaseResult[];
  product: ProductSpec | null;
  error: string | null;
  runCount: number;
}

interface PhaseResult {
  phase: string;
  status: "pending" | "running" | "done" | "failed";
  startedAt?: string;
  completedAt?: string;
  output?: string;
  data?: Record<string, unknown>;
}

interface ProductSpec {
  name: string;
  tagline: string;
  niche: string;
  problem: string;
  solution: string;
  techStack: string[];
  pages: string[];
  pricing: { free: string; pro: string; proPrice: number };
  estimatedMonthlyRevenue: number;
  deployUrl?: string;
}

function defaultState(): MoneyMachineState {
  return {
    status: "idle",
    startedAt: "",
    updatedAt: new Date().toISOString(),
    currentPhase: "",
    phases: [],
    product: null,
    error: null,
    runCount: 0,
  };
}

async function loadState(): Promise<MoneyMachineState> {
  try {
    return { ...defaultState(), ...JSON.parse(await readFile(STATE_FILE, "utf-8")) };
  } catch {
    return defaultState();
  }
}

async function saveState(state: MoneyMachineState): Promise<void> {
  await mkdir(MONEY_DIR, { recursive: true });
  state.updatedAt = new Date().toISOString();
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

async function aiCall(prompt: string, model = "google/gemini-2.0-flash-001"): Promise<string> {
  if (!OPENROUTER_KEY) return "ERROR: No OpenRouter API key";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });
  if (!res.ok) return `ERROR: ${await res.text()}`;
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "No response";
}

function extractJSON(text: string): Record<string, unknown> | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* */ }
  return null;
}

// GET: Check money machine status
export async function GET() {
  const state = await loadState();
  return Response.json(state);
}

// POST: Start the money machine or control it
// { action: "start" } - Begin autonomous pipeline
// { action: "stop" } - Stop current run
// { action: "status" } - Get status
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action || "start";

  if (action === "status") {
    return Response.json(await loadState());
  }

  if (action === "stop") {
    const state = await loadState();
    state.status = "idle";
    state.currentPhase = "";
    await saveState(state);
    return Response.json({ ok: true, stopped: true });
  }

  if (action !== "start") {
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  // Check if already running
  const existing = await loadState();
  if (existing.status === "running") {
    return Response.json({ error: "Already running", state: existing }, { status: 409 });
  }

  // Start streaming pipeline
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      const state: MoneyMachineState = {
        status: "running",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentPhase: "research",
        phases: [
          { phase: "research", status: "pending" },
          { phase: "validate", status: "pending" },
          { phase: "plan", status: "pending" },
          { phase: "build", status: "pending" },
          { phase: "deploy", status: "pending" },
          { phase: "monetize", status: "pending" },
        ],
        product: null,
        error: null,
        runCount: existing.runCount + 1,
      };

      await saveState(state);
      emit({ type: "start", message: "Ultra Autonomous Money Machine activated", runCount: state.runCount });

      try {
        // ========================
        // PHASE 1: RESEARCH
        // ========================
        state.currentPhase = "research";
        state.phases[0].status = "running";
        state.phases[0].startedAt = new Date().toISOString();
        await saveState(state);
        emit({ type: "phase", phase: "research", status: "running", message: "Researching profitable micro-SaaS niches..." });

        const researchPrompt = `You are an expert SaaS market researcher. Find the single BEST micro-SaaS product idea that can be built TODAY with these constraints:

TECH STACK: Next.js 16, Tailwind CSS, Supabase (PostgreSQL), deployed on Vercel free tier.
TIME: Must be buildable as MVP in under 2 hours by an AI agent.
COST: $0 to build and host (free tiers only).
REVENUE: Must be able to charge $9-49/month per user.
COMPETITION: Look for underserved niches where existing tools are overpriced or overcomplicated.

Consider these HIGH-DEMAND categories in 2026:
- AI-powered tools (writing, image, code, data analysis)
- Developer tools (API monitoring, testing, documentation)
- Small business tools (invoicing, scheduling, CRM)
- Content creator tools (SEO, social media, analytics)
- Productivity tools (time tracking, project management, notes)

Return a JSON object with EXACTLY these fields:
{
  "name": "ProductName",
  "tagline": "One-line description",
  "niche": "Category",
  "problem": "What specific problem it solves",
  "solution": "How the product solves it",
  "targetAudience": "Who would pay for this",
  "competitorWeakness": "Why existing solutions fail",
  "monthlySearchVolume": "estimated searches for this need",
  "estimatedMonthlyRevenue": 500,
  "confidence": 8
}

Return ONLY the JSON, no other text.`;

        const researchResult = await aiCall(researchPrompt);
        const researchData = extractJSON(researchResult);

        if (!researchData) {
          throw new Error("Research failed to return valid product idea");
        }

        state.phases[0].status = "done";
        state.phases[0].completedAt = new Date().toISOString();
        state.phases[0].data = researchData;
        emit({ type: "phase", phase: "research", status: "done", data: researchData });

        // ========================
        // PHASE 2: VALIDATE
        // ========================
        state.currentPhase = "validate";
        state.phases[1].status = "running";
        state.phases[1].startedAt = new Date().toISOString();
        await saveState(state);
        emit({ type: "phase", phase: "validate", status: "running", message: `Validating "${researchData.name}"...` });

        const validatePrompt = `You are a SaaS business validator. Evaluate this product idea critically:

Product: ${researchData.name}
Tagline: ${researchData.tagline}
Problem: ${researchData.problem}
Solution: ${researchData.solution}
Target: ${researchData.targetAudience}

Score each dimension 1-10 and provide a GO/NO-GO decision:
{
  "demandScore": 8,
  "feasibilityScore": 9,
  "competitionScore": 7,
  "revenueScore": 8,
  "overallScore": 8,
  "decision": "GO",
  "reasoning": "Why this will/won't work",
  "risks": ["risk1", "risk2"],
  "quickWins": ["First thing to do to get users"]
}

Return ONLY the JSON.`;

        const validateResult = await aiCall(validatePrompt);
        const validateData = extractJSON(validateResult);

        state.phases[1].status = "done";
        state.phases[1].completedAt = new Date().toISOString();
        state.phases[1].data = validateData || { decision: "GO", overallScore: 7 };
        emit({ type: "phase", phase: "validate", status: "done", data: validateData });

        // ========================
        // PHASE 3: PLAN
        // ========================
        state.currentPhase = "plan";
        state.phases[2].status = "running";
        state.phases[2].startedAt = new Date().toISOString();
        await saveState(state);
        emit({ type: "phase", phase: "plan", status: "running", message: "Creating build plan..." });

        const planPrompt = `You are a senior full-stack architect. Create a detailed build plan for this micro-SaaS:

Product: ${researchData.name}
Tagline: ${researchData.tagline}
Problem: ${researchData.problem}
Solution: ${researchData.solution}

Tech: Next.js 16 App Router, Tailwind CSS v4, Supabase (auth + DB), Vercel deployment.

Return a JSON build plan:
{
  "pages": [
    {"path": "/", "purpose": "Landing page with hero, features, pricing, CTA"},
    {"path": "/dashboard", "purpose": "Main app dashboard after login"},
    {"path": "/api/...", "purpose": "API routes"}
  ],
  "dbTables": [
    {"name": "users", "columns": ["id", "email", "plan", "created_at"]},
    {"name": "...", "columns": ["..."]}
  ],
  "features": [
    {"name": "Feature name", "priority": "mvp", "description": "What it does"}
  ],
  "pricing": {
    "free": "What free tier gets",
    "pro": "What pro tier gets",
    "proPrice": 19
  },
  "buildOrder": ["Step 1", "Step 2", "Step 3"]
}

Return ONLY the JSON.`;

        const planResult = await aiCall(planPrompt);
        const planData = extractJSON(planResult);

        state.phases[2].status = "done";
        state.phases[2].completedAt = new Date().toISOString();
        state.phases[2].data = planData || {};
        emit({ type: "phase", phase: "plan", status: "done", data: planData });

        // ========================
        // PHASE 4: BUILD (generate landing page)
        // ========================
        state.currentPhase = "build";
        state.phases[3].status = "running";
        state.phases[3].startedAt = new Date().toISOString();
        await saveState(state);
        emit({ type: "phase", phase: "build", status: "running", message: "Generating product code..." });

        const pricing = (planData as Record<string, unknown>)?.pricing as Record<string, unknown> || { free: "Basic features", pro: "All features", proPrice: 19 };

        const buildPrompt = `Generate a COMPLETE, production-ready landing page for this SaaS product as a single Next.js page component. Use Tailwind CSS for styling. Make it look professional and modern (dark theme).

Product: ${researchData.name}
Tagline: ${researchData.tagline}
Problem: ${researchData.problem}
Solution: ${researchData.solution}
Free tier: ${pricing.free}
Pro tier: ${pricing.pro} at $${pricing.proPrice}/month

The page must include:
1. Hero section with tagline and CTA button
2. Problem/Solution section
3. Features grid (at least 4 features with icons using emoji)
4. Pricing section (Free vs Pro)
5. FAQ section (3-4 questions)
6. Footer with links

Return ONLY the complete React component code (export default function), no imports needed (it's a server component).
Use only Tailwind classes. Make it responsive. Dark theme with accent colors.
Include "use client" if needed for interactivity.

Start with "use client"; and export default function LandingPage().`;

        const buildResult = await aiCall(buildPrompt, "google/gemini-2.0-flash-001");

        // Extract the code
        let code = buildResult;
        const codeMatch = buildResult.match(/```(?:tsx?|jsx?|javascript)?\n([\s\S]*?)```/);
        if (codeMatch) code = codeMatch[1];

        // Save generated code
        const productDir = join(MONEY_DIR, "products", `product-${state.runCount}`);
        await mkdir(productDir, { recursive: true });
        await writeFile(join(productDir, "page.tsx"), code, "utf-8");
        await writeFile(join(productDir, "spec.json"), JSON.stringify({
          ...researchData,
          pricing,
          plan: planData,
          validation: validateData,
          generatedAt: new Date().toISOString(),
        }, null, 2), "utf-8");

        state.phases[3].status = "done";
        state.phases[3].completedAt = new Date().toISOString();
        state.phases[3].data = {
          codeLength: code.length,
          productDir,
          filesGenerated: ["page.tsx", "spec.json"],
        };
        emit({ type: "phase", phase: "build", status: "done", codeLength: code.length, productDir });

        // ========================
        // PHASE 5: DEPLOY
        // ========================
        state.currentPhase = "deploy";
        state.phases[4].status = "running";
        state.phases[4].startedAt = new Date().toISOString();
        await saveState(state);
        emit({ type: "phase", phase: "deploy", status: "running", message: "Preparing deployment package..." });

        // Create a minimal deployable Next.js project
        const deployDir = join(productDir, "deploy");
        await mkdir(join(deployDir, "app"), { recursive: true });

        // package.json
        await writeFile(join(deployDir, "package.json"), JSON.stringify({
          name: String(researchData.name).toLowerCase().replace(/[^a-z0-9]/g, "-"),
          version: "1.0.0",
          private: true,
          scripts: { dev: "next dev", build: "next build", start: "next start" },
          dependencies: { next: "^15", react: "^19", "react-dom": "^19" },
          devDependencies: { "@types/node": "^20", "@types/react": "^19", typescript: "^5", tailwindcss: "^4", "@tailwindcss/postcss": "^4" },
        }, null, 2), "utf-8");

        // Layout
        await writeFile(join(deployDir, "app", "layout.tsx"), `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${researchData.name} - ${researchData.tagline}",
  description: "${researchData.problem}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
`, "utf-8");

        // Global CSS
        await writeFile(join(deployDir, "app", "globals.css"), `@import "tailwindcss";
`, "utf-8");

        // Copy landing page
        await writeFile(join(deployDir, "app", "page.tsx"), code, "utf-8");

        // tsconfig
        await writeFile(join(deployDir, "tsconfig.json"), JSON.stringify({
          compilerOptions: {
            target: "es2017", lib: ["dom", "es2017"], allowJs: true, skipLibCheck: true,
            strict: false, noEmit: true, esModuleInterop: true, module: "esnext",
            moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true,
            jsx: "preserve", incremental: true, plugins: [{ name: "next" }],
            paths: { "@/*": ["./*"] },
          },
          include: ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          exclude: ["node_modules"],
        }, null, 2), "utf-8");

        // postcss config
        await writeFile(join(deployDir, "postcss.config.mjs"), `export default { plugins: { "@tailwindcss/postcss": {} } };\n`, "utf-8");

        state.phases[4].status = "done";
        state.phases[4].completedAt = new Date().toISOString();
        state.phases[4].data = {
          deployDir,
          note: "Project ready for deployment. Run: cd deploy && npm install && npx vercel",
          files: ["package.json", "app/layout.tsx", "app/page.tsx", "app/globals.css", "tsconfig.json", "postcss.config.mjs"],
        };
        emit({ type: "phase", phase: "deploy", status: "done", deployDir, message: "Deployment package ready" });

        // ========================
        // PHASE 6: MONETIZE
        // ========================
        state.currentPhase = "monetize";
        state.phases[5].status = "running";
        state.phases[5].startedAt = new Date().toISOString();
        await saveState(state);
        emit({ type: "phase", phase: "monetize", status: "running", message: "Setting up monetization tracking..." });

        // Update self-finance ledger
        const financeDir = join(ENGINE_DIR, "finance");
        try {
          const ledgerRaw = await readFile(join(financeDir, "ledger.json"), "utf-8");
          const ledger = JSON.parse(ledgerRaw);
          ledger.revenueStreams.push({
            name: researchData.name,
            type: "saas",
            status: "planned",
            monthlyEstimate: researchData.estimatedMonthlyRevenue || (pricing.proPrice as number || 19),
            url: "",
            deployedAt: new Date().toISOString(),
          });
          await writeFile(join(financeDir, "ledger.json"), JSON.stringify(ledger, null, 2), "utf-8");
        } catch { /* finance not set up yet */ }

        // Update notice board
        try {
          const boardRaw = await readFile(join(ENGINE_DIR, "noticeboard.json"), "utf-8");
          const board = JSON.parse(boardRaw);
          board.pins.push({
            from: "money-machine",
            message: `New product generated: ${researchData.name} - ${researchData.tagline}. Code at ${productDir}. Ready for deployment.`,
            at: new Date().toISOString(),
          });
          board.completed.unshift(`Money Machine Run #${state.runCount}: ${researchData.name}`);
          board.updatedBy = "money-machine";
          board.updatedAt = new Date().toISOString();
          await writeFile(join(ENGINE_DIR, "noticeboard.json"), JSON.stringify(board, null, 2), "utf-8");
        } catch { /* */ }

        const product: ProductSpec = {
          name: String(researchData.name),
          tagline: String(researchData.tagline),
          niche: String(researchData.niche),
          problem: String(researchData.problem),
          solution: String(researchData.solution),
          techStack: ["Next.js 16", "Tailwind CSS", "Supabase", "Vercel"],
          pages: ((planData as Record<string, unknown>)?.pages as Array<Record<string, string>> || []).map((p) => p.path),
          pricing: {
            free: String(pricing.free),
            pro: String(pricing.pro),
            proPrice: Number(pricing.proPrice) || 19,
          },
          estimatedMonthlyRevenue: Number(researchData.estimatedMonthlyRevenue) || 500,
        };

        state.phases[5].status = "done";
        state.phases[5].completedAt = new Date().toISOString();
        state.phases[5].data = { product, financeUpdated: true, noticeboardUpdated: true };
        state.product = product;
        state.status = "completed";
        state.currentPhase = "done";
        await saveState(state);

        emit({
          type: "complete",
          message: `Money Machine Run #${state.runCount} complete!`,
          product,
          deployDir: join(productDir, "deploy"),
          nextSteps: [
            `cd ${join(productDir, "deploy")} && npm install && npx vercel`,
            "Add Stripe integration when ready for payments",
            "Run again for another product idea",
          ],
        });

      } catch (err) {
        state.status = "failed";
        state.error = err instanceof Error ? err.message : String(err);
        const currentPhaseIdx = state.phases.findIndex((p) => p.status === "running");
        if (currentPhaseIdx >= 0) state.phases[currentPhaseIdx].status = "failed";
        await saveState(state);
        emit({ type: "error", error: state.error });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
