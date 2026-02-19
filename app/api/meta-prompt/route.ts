import { getMetaState, getMetaStats, recordOutcome, shouldEvolve, evolveTemplate, applyEvolution } from "@/app/lib/meta-prompt";
import { NextRequest } from "next/server";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [state, stats] = await Promise.all([getMetaState(), getMetaStats()]);
  return Response.json({
    stats,
    templates: state.templates.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      score: t.score,
      uses: t.uses,
      successes: t.successes,
      failures: t.failures,
      avgQuality: t.avgQuality,
      evolved: t.evolved,
    })),
    principles: state.principles,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "record_outcome": {
      await recordOutcome(body.outcome);
      return Response.json({ ok: true });
    }
    case "check_evolve": {
      const should = await shouldEvolve(body.templateId);
      return Response.json({ shouldEvolve: should });
    }
    case "get_evolve_prompt": {
      const result = await evolveTemplate(body.templateId);
      return Response.json({ prompt: result?.template || null });
    }
    case "apply_evolution": {
      await applyEvolution(body.templateId, body.newTemplate);
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}
