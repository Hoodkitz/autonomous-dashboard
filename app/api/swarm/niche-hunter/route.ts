export const runtime = 'nodejs';
import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { smartAI } from "@/app/lib/smart-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const HUNT_DIR = join(ENGINE_DIR, "niche-hunter");
const HUNT_FILE = join(HUNT_DIR, "hunts.json");

interface NicheOpportunity {
  id: string;
  foundAt: string;
  category: "ai-gap" | "niche" | "revolution" | "disruption" | "trend";
  name: string;
  problem: string;
  solution: string;
  targetAudience: string;
  urgency: number;     // 1-10: how urgent is this gap
  potential: number;    // 1-10: revenue potential
  difficulty: number;   // 1-10: how hard to build
  competitors: string;
  unfairAdvantage: string;
  estimatedMRR: string;
  techStack: string;
  status: "discovered" | "validated" | "building" | "deployed" | "rejected";
  validationNotes?: string;
}

interface HuntState {
  lastHuntAt: string;
  totalHunts: number;
  opportunities: NicheOpportunity[];
  revolutions: string[];
  aiGaps: string[];
}

async function loadHuntState(): Promise<HuntState> {
  try {
    return JSON.parse(await readFile(HUNT_FILE, "utf-8"));
  } catch {
    return { lastHuntAt: "", totalHunts: 0, opportunities: [], revolutions: [], aiGaps: [] };
  }
}

async function saveHuntState(s: HuntState): Promise<void> {
  await mkdir(HUNT_DIR, { recursive: true });
  await writeFile(HUNT_FILE, JSON.stringify(s, null, 2), "utf-8");
}

async function aiCall(systemPrompt: string, userPrompt: string): Promise<{ content: string; tokens: number }> {
  const result = await smartAI(systemPrompt, userPrompt, { temperature: 0.8 });
  return { content: result.content, tokens: result.tokens };
}

// GET: Return hunt state and opportunities
export async function GET() {
  const state = await loadHuntState();
  return Response.json(state);
}

// POST: Run the niche hunter
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string || "hunt";

  if (action === "update_status") {
    const state = await loadHuntState();
    const opp = state.opportunities.find((o) => o.id === body.id);
    if (opp) {
      opp.status = body.status;
      if (body.notes) opp.validationNotes = body.notes;
      await saveHuntState(state);
    }
    return Response.json({ ok: true });
  }

  // ============================
  // HUNT: Multi-phase niche research
  // ============================
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: Record<string, unknown>) {
        try { controller.enqueue(encoder.encode(JSON.stringify(data) + "\n")); } catch { /* */ }
      }

      const state = await loadHuntState();
      state.totalHunts += 1;
      state.lastHuntAt = new Date().toISOString();

      emit({ type: "hunt_start", huntNumber: state.totalHunts });

      // ---- PHASE 1: AI Gap Analysis ----
      emit({ type: "phase", phase: "ai_gaps", status: "running", message: "Scanning for AI gaps and missing solutions..." });

      const gapResult = await aiCall(
        `You are an elite AI industry analyst and gap hunter. Your mission: find UNSOLVED problems and GAPS in the AI ecosystem that represent massive opportunities.

Focus on:
1. Tasks that AI SHOULD be able to do but CAN'T yet (or does poorly)
2. Industries that haven't been disrupted by AI yet
3. AI tools that exist but have terrible UX/are too expensive
4. Workflows where humans still manually do things that AI could automate
5. Data problems that AI could solve but nobody has built the solution
6. AI infrastructure gaps (missing tools, libraries, platforms)

For each gap, identify:
- The specific pain point
- Who suffers from it (target audience)
- What a solution would look like
- Why nobody has built it yet (moat potential)
- Estimated monthly revenue if built

Return JSON array of 5 AI gaps, each with: name, problem, solution, targetAudience, whyUnbuilt, estimatedMRR, urgency(1-10), potential(1-10), difficulty(1-10)`,
        `Hunt #${state.totalHunts}. Today is ${new Date().toISOString().split("T")[0]}. Find AI gaps that are CURRENT and ACTIONABLE. Focus on things a solo developer with AI agents could build in 1-4 weeks. Previously found gaps: ${state.aiGaps.slice(-5).join(", ") || "none"} - DO NOT repeat these. Find NEW ones.`
      );

      let aiGaps: NicheOpportunity[] = [];
      try {
        const arrMatch = gapResult.content.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const parsed = JSON.parse(arrMatch[0]);
          aiGaps = parsed.map((g: Record<string, unknown>, i: number) => ({
            id: `gap-${state.totalHunts}-${i}`,
            foundAt: new Date().toISOString(),
            category: "ai-gap" as const,
            name: String(g.name || ""),
            problem: String(g.problem || ""),
            solution: String(g.solution || ""),
            targetAudience: String(g.targetAudience || ""),
            urgency: Number(g.urgency) || 5,
            potential: Number(g.potential) || 5,
            difficulty: Number(g.difficulty) || 5,
            competitors: String(g.whyUnbuilt || ""),
            unfairAdvantage: "AI-powered autonomous development",
            estimatedMRR: String(g.estimatedMRR || "$0"),
            techStack: "Next.js + Supabase + Vercel",
            status: "discovered" as const,
          }));
        }
      } catch { /* */ }

      for (const gap of aiGaps) {
        emit({ type: "gap_found", name: gap.name, problem: gap.problem, potential: gap.potential, urgency: gap.urgency });
        state.aiGaps.push(gap.name);
      }

      emit({ type: "phase", phase: "ai_gaps", status: "done", message: `Found ${aiGaps.length} AI gaps` });

      // ---- PHASE 2: Emerging Niche Discovery ----
      emit({ type: "phase", phase: "niches", status: "running", message: "Researching emerging micro-SaaS niches..." });

      const nicheResult = await aiCall(
        `You are a micro-SaaS niche hunter specializing in finding REVOLUTIONARY opportunities. Your focus:

1. Emerging niches where demand is GROWING FAST but supply is LOW
2. Niches created by new regulations, technologies, or cultural shifts
3. "Boring" B2B niches with high willingness to pay ($29-99/month)
4. API-first products that solve developer pain points
5. Vertical SaaS for underserved industries
6. AI-powered replacements for expensive legacy software

For each niche, assess:
- Market timing (is NOW the right time?)
- Entry barrier (can a solo dev compete?)
- Revenue velocity (how fast to first $1000 MRR?)
- Defensibility (moat potential)

Return JSON array of 5 niches, each with: name, problem, solution, targetAudience, marketTiming, estimatedMRR, urgency(1-10), potential(1-10), difficulty(1-10), competitors, unfairAdvantage`,
        `Hunt #${state.totalHunts}. Date: ${new Date().toISOString().split("T")[0]}. Find niches for Q1 2026. Previously found: ${state.opportunities.slice(-5).map((o) => o.name).join(", ") || "none"} - find DIFFERENT ones. Think about what's changing RIGHT NOW in tech, business, and society.`
      );

      let niches: NicheOpportunity[] = [];
      try {
        const arrMatch = nicheResult.content.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const parsed = JSON.parse(arrMatch[0]);
          niches = parsed.map((n: Record<string, unknown>, i: number) => ({
            id: `niche-${state.totalHunts}-${i}`,
            foundAt: new Date().toISOString(),
            category: "niche" as const,
            name: String(n.name || ""),
            problem: String(n.problem || ""),
            solution: String(n.solution || ""),
            targetAudience: String(n.targetAudience || ""),
            urgency: Number(n.urgency) || 5,
            potential: Number(n.potential) || 5,
            difficulty: Number(n.difficulty) || 5,
            competitors: String(n.competitors || ""),
            unfairAdvantage: String(n.unfairAdvantage || ""),
            estimatedMRR: String(n.estimatedMRR || "$0"),
            techStack: "Next.js + Supabase + Vercel",
            status: "discovered" as const,
          }));
        }
      } catch { /* */ }

      for (const niche of niches) {
        emit({ type: "niche_found", name: niche.name, problem: niche.problem, potential: niche.potential, urgency: niche.urgency });
      }

      emit({ type: "phase", phase: "niches", status: "done", message: `Found ${niches.length} emerging niches` });

      // ---- PHASE 3: Revolution Detector ----
      emit({ type: "phase", phase: "revolutions", status: "running", message: "Scanning for revolutionary disruption opportunities..." });

      const revResult = await aiCall(
        `You are a technology revolution detector. Your mission: find areas where a PARADIGM SHIFT is happening or about to happen that creates massive opportunity.

Think about:
1. Technologies reaching inflection points (AI agents, spatial computing, quantum, etc.)
2. Industries about to be completely disrupted
3. New platforms emerging that need an ecosystem of tools
4. Convergence of multiple trends creating new categories
5. Problems that were impossible to solve until NOW

For each revolution:
- What's the fundamental shift happening?
- What NEW product category does this enable?
- What's the first product to build to ride this wave?
- What's the timing window (how long before everyone else notices)?

Return JSON array of 3 revolutions, each with: name, shift, newCategory, firstProduct, timingWindow, problem, solution, targetAudience, estimatedMRR, urgency(1-10), potential(1-10), difficulty(1-10)`,
        `Hunt #${state.totalHunts}. Date: ${new Date().toISOString().split("T")[0]}. What's JUST STARTING to change? Previous revolutions tracked: ${state.revolutions.slice(-3).join(", ") || "none"} - find NEW shifts.`
      );

      let revolutions: NicheOpportunity[] = [];
      try {
        const arrMatch = revResult.content.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const parsed = JSON.parse(arrMatch[0]);
          revolutions = parsed.map((r: Record<string, unknown>, i: number) => ({
            id: `rev-${state.totalHunts}-${i}`,
            foundAt: new Date().toISOString(),
            category: "revolution" as const,
            name: String(r.name || r.firstProduct || ""),
            problem: String(r.problem || r.shift || ""),
            solution: String(r.solution || r.firstProduct || ""),
            targetAudience: String(r.targetAudience || ""),
            urgency: Number(r.urgency) || 7,
            potential: Number(r.potential) || 8,
            difficulty: Number(r.difficulty) || 6,
            competitors: String(r.timingWindow || ""),
            unfairAdvantage: String(r.newCategory || ""),
            estimatedMRR: String(r.estimatedMRR || "$0"),
            techStack: "Next.js + Supabase + Vercel",
            status: "discovered" as const,
          }));
        }
      } catch { /* */ }

      for (const rev of revolutions) {
        emit({ type: "revolution_found", name: rev.name, problem: rev.problem, potential: rev.potential });
        state.revolutions.push(rev.name);
      }

      emit({ type: "phase", phase: "revolutions", status: "done", message: `Found ${revolutions.length} revolutions` });

      // ---- PHASE 4: Rank & Prioritize ----
      emit({ type: "phase", phase: "ranking", status: "running", message: "Ranking all opportunities..." });

      const allNew = [...aiGaps, ...niches, ...revolutions];
      allNew.sort((a, b) => {
        const scoreA = a.urgency * 0.3 + a.potential * 0.5 - a.difficulty * 0.2;
        const scoreB = b.urgency * 0.3 + b.potential * 0.5 - b.difficulty * 0.2;
        return scoreB - scoreA;
      });

      state.opportunities.push(...allNew);

      // Keep only latest 100 opportunities
      if (state.opportunities.length > 100) {
        state.opportunities = state.opportunities.slice(-100);
      }

      await saveHuntState(state);

      emit({
        type: "phase",
        phase: "ranking",
        status: "done",
        message: `Ranked ${allNew.length} new opportunities. Top: ${allNew[0]?.name || "none"}`,
      });

      // Emit top 3 as highlights
      for (const top of allNew.slice(0, 3)) {
        emit({
          type: "highlight",
          name: top.name,
          category: top.category,
          problem: top.problem,
          potential: top.potential,
          urgency: top.urgency,
          estimatedMRR: top.estimatedMRR,
        });
      }

      // Update notice board
      try {
        const boardRaw = await readFile(join(ENGINE_DIR, "noticeboard.json"), "utf-8");
        const board = JSON.parse(boardRaw);
        board.pins = board.pins || [];
        board.pins.push({
          from: "niche-hunter",
          message: `Hunt #${state.totalHunts}: Found ${allNew.length} opportunities. Top pick: "${allNew[0]?.name}" (potential: ${allNew[0]?.potential}/10)`,
          at: new Date().toISOString(),
        });
        board.updatedBy = "niche-hunter";
        board.updatedAt = new Date().toISOString();
        await writeFile(join(ENGINE_DIR, "noticeboard.json"), JSON.stringify(board, null, 2), "utf-8");
      } catch { /* */ }

      emit({
        type: "hunt_complete",
        huntNumber: state.totalHunts,
        totalFound: allNew.length,
        aiGaps: aiGaps.length,
        niches: niches.length,
        revolutions: revolutions.length,
        topPick: allNew[0]?.name || "none",
        totalOpportunities: state.opportunities.length,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
