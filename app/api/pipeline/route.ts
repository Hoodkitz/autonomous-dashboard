import { NextRequest } from "next/server";
import { runPipeline, resumePipeline, loadLatestState, DEFAULT_CONFIG } from "@/app/lib/autonomous-pipeline";

export const runtime = "nodejs";


export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max for long pipelines

// GET: Get current pipeline state
export async function GET() {
  const state = await loadLatestState();
  if (!state) {
    return Response.json({ active: false, message: "No pipeline running" });
  }
  return Response.json({
    active: state.phase !== "complete" && state.phase !== "failed" && state.phase !== "budget_exceeded",
    state: {
      id: state.id,
      phase: state.phase,
      goal: state.goal,
      iteration: state.iteration,
      cost: state.cost,
      plan: state.plan.map((s) => ({ step: s.step.slice(0, 80), agent: s.agent, status: s.status })),
      errors: state.errors,
      research_findings: state.research_findings.slice(0, 3),
      artifacts: state.artifacts,
      created_at: state.created_at,
      updated_at: state.updated_at,
    },
  });
}

// POST: Start or resume pipeline
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, goal, config } = body as {
    action?: "start" | "go" | "stop" | "status";
    goal?: string;
    config?: Record<string, unknown>;
  };

  // Status check
  if (action === "status") {
    const state = await loadLatestState();
    return Response.json({ state });
  }

  // Resume with go/stop
  if (action === "go" || action === "stop") {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const emit = (data: string) => {
          try { controller.enqueue(encoder.encode(data)); } catch {}
        };

        const cwd = process.cwd();
        const result = await resumePipeline(action, emit, cwd);

        if (!result) {
          emit(JSON.stringify({ type: "error", message: "No pipeline to resume" }) + "\n");
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson", "Transfer-Encoding": "chunked" },
    });
  }

  // Start new pipeline
  if (!goal) {
    return Response.json({ error: "goal is required" }, { status: 400 });
  }

  // Check if one is already running
  const existing = await loadLatestState();
  if (existing && existing.phase !== "complete" && existing.phase !== "failed" && existing.phase !== "budget_exceeded") {
    return Response.json({
      error: "Pipeline already active",
      phase: existing.phase,
      id: existing.id,
      hint: "Send action='stop' to cancel it first, or action='go' to resume",
    }, { status: 409 });
  }

  const pipelineConfig = {
    ...DEFAULT_CONFIG,
    ...(config || {}),
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: string) => {
        try { controller.enqueue(encoder.encode(data)); } catch {}
      };

      const cwd = process.cwd();
      await runPipeline(goal, pipelineConfig, cwd, emit);

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Transfer-Encoding": "chunked" },
  });
}
