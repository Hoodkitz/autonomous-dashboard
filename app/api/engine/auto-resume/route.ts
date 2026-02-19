import { getEngineState, appendLog, updateEngineState } from "@/app/lib/engine";
import { loadLatestState } from "@/app/lib/autonomous-pipeline";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: Auto-resume check - called on dashboard startup
export async function POST() {
  const results: { engine: string; pipeline: string; actions: string[] } = {
    engine: "idle",
    pipeline: "idle",
    actions: [],
  };

  try {
    // 1. Check engine state
    const engineState = await getEngineState();
    results.engine = engineState.status;

    if (engineState.status === "in_progress") {
      await appendLog("[AUTO-RESUME] Engine was in_progress on startup - marking for resume");
      results.actions.push("engine_needs_resume");
    } else if (engineState.status === "failed") {
      await appendLog("[AUTO-RESUME] Engine was failed on startup - attempting self-heal");
      // Reset to idle so user can restart
      await updateEngineState({ status: "idle", phase: null, executorTier: null });
      results.actions.push("engine_reset_from_failed");
    }

    // 2. Check pipeline state
    const pipelineState = await loadLatestState();
    if (pipelineState) {
      results.pipeline = pipelineState.phase;

      if (pipelineState.phase === "awaiting_go") {
        await appendLog("[AUTO-RESUME] Pipeline awaiting go/no-go decision");
        results.actions.push("pipeline_awaiting_go");
      } else if (
        pipelineState.phase !== "complete" &&
        pipelineState.phase !== "failed" &&
        pipelineState.phase !== "budget_exceeded"
      ) {
        await appendLog(`[AUTO-RESUME] Pipeline was interrupted at phase: ${pipelineState.phase}`);
        results.actions.push("pipeline_interrupted");
      }
    }

    // 3. Log the startup
    await appendLog(
      `[AUTO-RESUME] Dashboard started. Engine: ${results.engine}, Pipeline: ${results.pipeline}, Actions: ${results.actions.join(", ") || "none"}`
    );

    return Response.json({
      ok: true,
      ...results,
      timestamp: new Date().toISOString(),
      message: results.actions.length > 0
        ? `Found ${results.actions.length} items needing attention`
        : "All systems nominal",
    });
  } catch (err) {
    return Response.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// GET: Check auto-resume status (same logic, no mutations)
export async function GET() {
  try {
    const engineState = await getEngineState();
    const pipelineState = await loadLatestState();

    const needsAttention: string[] = [];

    if (engineState.status === "in_progress") needsAttention.push("engine_in_progress");
    if (engineState.status === "failed") needsAttention.push("engine_failed");

    if (pipelineState) {
      if (pipelineState.phase === "awaiting_go") needsAttention.push("pipeline_awaiting_go");
      else if (
        pipelineState.phase !== "complete" &&
        pipelineState.phase !== "failed" &&
        pipelineState.phase !== "budget_exceeded"
      ) {
        needsAttention.push(`pipeline_interrupted_at_${pipelineState.phase}`);
      }
    }

    return Response.json({
      engine_status: engineState.status,
      engine_phase: engineState.phase,
      engine_task: engineState.taskDescription,
      pipeline_phase: pipelineState?.phase || null,
      pipeline_goal: pipelineState?.goal || null,
      pipeline_cost: pipelineState?.cost?.total_usd || 0,
      needs_attention: needsAttention,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) });
  }
}
