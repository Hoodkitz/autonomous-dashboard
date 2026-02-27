import { NextRequest } from "next/server";
import { planExecution, executeStep, selfOptimize, CAPABILITIES, type StepResult } from "@/app/lib/orchestrator";
import { appendLog, updateEngineState } from "@/app/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface OrchestratorRequest {
  goal: string;
  context?: string;
  prefer_free?: boolean;
  max_steps?: number;
  workDir?: string;
  auto_optimize?: boolean;
}

export async function POST(req: NextRequest) {
  const body: OrchestratorRequest = await req.json();
  const { goal, context, prefer_free = true, max_steps = 6, workDir, auto_optimize = true } = body;
  const cwd = workDir || process.env.USERPROFILE || "C:\\Users\\Administrator";

  await updateEngineState({
    status: "in_progress",
    phase: "unified_orchestration",
    taskDescription: goal.slice(0, 200),
    executorTier: "unified-orchestrator",
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));

      try {
        // Phase 1: Plan
        send(JSON.stringify({
          type: "phase",
          phase: "planning",
          message: `Planning optimal execution with ${CAPABILITIES.filter((c) => prefer_free ? c.cost === "free" : true).length} available agents...`,
        }) + "\n");
        await appendLog(`[UNIFIED] Planning: ${goal.slice(0, 100)}`);

        const plan = await planExecution({ goal, context, prefer_free, max_steps });
        const steps = plan.steps.slice(0, max_steps);

        send(JSON.stringify({
          type: "plan",
          steps: steps.map((s) => ({ agent: s.agent_id, action: s.action })),
          total_steps: steps.length,
        }) + "\n");

        // Phase 2: Execute each step
        send(JSON.stringify({
          type: "phase",
          phase: "execution",
          message: `Executing ${steps.length} steps across multiple agents...`,
        }) + "\n");

        const results: StepResult[] = [];
        let previousOutput = "";

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const currentStep = i + 1;

          await updateEngineState({
            currentStep,
            totalSteps: steps.length,
            executorTier: step.agent_id,
          });

          // Inject previous step's output as context
          const augmentedPrompt = previousOutput
            ? `${step.prompt}\n\nPrevious step output (for context):\n${previousOutput.slice(0, 2000)}`
            : step.prompt;

          const result = await executeStep(
            { ...step, prompt: augmentedPrompt },
            cwd,
            send,
          );
          result.step = currentStep;
          results.push(result);

          if (result.success && result.result) {
            previousOutput = result.result;
          }

          send(JSON.stringify({
            type: "progress",
            current: currentStep,
            total: steps.length,
            success: result.success,
          }) + "\n");
        }

        // Phase 3: Self-optimize
        if (auto_optimize) {
          send(JSON.stringify({
            type: "phase",
            phase: "optimization",
            message: "Self-analyzing results and finding improvements...",
          }) + "\n");
          await appendLog("[UNIFIED] Self-optimizing...");

          const optimization = await selfOptimize(goal, results, send);
          await appendLog(`[UNIFIED] Optimization: ${optimization.slice(0, 200)}`);
        }

        // Summary
        const successes = results.filter((r) => r.success).length;
        const totalTime = results.reduce((sum, r) => sum + r.duration_ms, 0);
        const agentsUsed = [...new Set(results.map((r) => r.agent))];

        send(JSON.stringify({
          type: "complete",
          summary: {
            goal,
            steps_total: results.length,
            steps_succeeded: successes,
            steps_failed: results.length - successes,
            total_duration_ms: totalTime,
            agents_used: agentsUsed,
            auto_optimized: auto_optimize,
          },
        }) + "\n");

        await updateEngineState({
          status: "idle",
          phase: null,
          executorTier: null,
          currentStep: 0,
          totalSteps: 0,
        });
        await appendLog(`[UNIFIED] Complete: ${successes}/${results.length} steps succeeded in ${totalTime}ms`);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send(JSON.stringify({ type: "error", data: msg }) + "\n");
        await appendLog(`[UNIFIED] Error: ${msg}`);
        await updateEngineState({ status: "failed", phase: null, executorTier: null });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}

// GET: Return available capabilities
export async function GET() {
  return Response.json({
    capabilities: CAPABILITIES,
    total: CAPABILITIES.length,
    free: CAPABILITIES.filter((c) => c.cost === "free").length,
    types: {
      cli_agents: CAPABILITIES.filter((c) => c.type === "cli_agent").length,
      api_models: CAPABILITIES.filter((c) => c.type === "api_model").length,
    },
  });
}

export const runtime = "nodejs";
