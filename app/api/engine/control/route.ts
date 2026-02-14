import { NextRequest } from "next/server";
import { getEngineState, updateEngineState, appendLog } from "@/app/lib/engine";

export const dynamic = "force-dynamic";

interface ControlRequest {
  action: "start" | "pause" | "stop" | "resume" | "scan_revenue" | "scan_skills" | "scan_archives";
  task?: string;
}

export async function POST(req: NextRequest) {
  const body: ControlRequest = await req.json();
  const { action, task } = body;

  const state = await getEngineState();

  switch (action) {
    case "start": {
      const cores: Record<string, string> = {};
      for (const key of Object.keys(state.cores)) {
        cores[key] = "running";
      }
      const updated = await updateEngineState({
        status: "in_progress",
        phase: "understand",
        currentStep: 1,
        totalSteps: 5,
        cores,
        taskDescription: task || state.taskDescription || "Autonomous engine activated",
        executorTier: "multi-agent",
      });
      await appendLog("[ENGINE] Started - all cores running");
      return Response.json({ ok: true, state: updated });
    }

    case "pause": {
      const cores: Record<string, string> = {};
      for (const key of Object.keys(state.cores)) {
        cores[key] = "paused";
      }
      const updated = await updateEngineState({
        status: "paused",
        cores,
        executorTier: null,
      });
      await appendLog("[ENGINE] Paused");
      return Response.json({ ok: true, state: updated });
    }

    case "stop": {
      const cores: Record<string, string> = {};
      for (const key of Object.keys(state.cores)) {
        cores[key] = "ready";
      }
      const updated = await updateEngineState({
        status: "idle",
        phase: null,
        currentStep: 0,
        totalSteps: 0,
        cores,
        taskDescription: null,
        executorTier: null,
      });
      await appendLog("[ENGINE] Stopped - all cores idle");
      return Response.json({ ok: true, state: updated });
    }

    case "resume": {
      const cores: Record<string, string> = {};
      for (const key of Object.keys(state.cores)) {
        cores[key] = "running";
      }
      const updated = await updateEngineState({
        status: "in_progress",
        cores,
        executorTier: "multi-agent",
      });
      await appendLog(`[ENGINE] Resumed from phase: ${state.phase}`);
      return Response.json({ ok: true, state: updated });
    }

    case "scan_revenue": {
      await updateEngineState({
        status: "in_progress",
        phase: "discovery",
        taskDescription: "Revenue opportunity scan",
        executorTier: "revenue_engine",
        cores: { ...state.cores, revenue_engine: "running" },
      });
      await appendLog("[REVENUE] Scan initiated");
      return Response.json({ ok: true, message: "Revenue scan started" });
    }

    case "scan_skills": {
      await updateEngineState({
        status: "in_progress",
        phase: "discovery",
        taskDescription: "Skill discovery scan",
        executorTier: "agentic_dev",
        cores: { ...state.cores, agentic_dev: "running" },
      });
      await appendLog("[SKILLS] Discovery scan initiated");
      return Response.json({ ok: true, message: "Skill scan started" });
    }

    case "scan_archives": {
      await updateEngineState({
        status: "in_progress",
        phase: "discovery",
        taskDescription: "Archive scan for incomplete projects",
        executorTier: "autopilot",
        cores: { ...state.cores, autopilot: "running" },
      });
      await appendLog("[ARCHIVE] Scan initiated");
      return Response.json({ ok: true, message: "Archive scan started" });
    }

    default:
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}

export const runtime = 'nodejs';
