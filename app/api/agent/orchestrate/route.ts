import { NextRequest } from "next/server";
import { appendLog, updateEngineState } from "@/app/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface OrchestrateRequest {
  goal: string;
  context?: string;
  prefer_free?: boolean;
}

export async function POST(req: NextRequest) {
  const body: OrchestrateRequest = await req.json();
  const { goal, context, prefer_free } = body;

  await updateEngineState({
    status: "in_progress",
    taskDescription: goal.slice(0, 200),
    executorTier: "multi-agent-orchestrator",
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));

      try {
        // 1. Plan Execution
        // Use Gemini 2.0 Flash (free) for fast planning
        const planPrompt = `You are an AI orchestrator. Given a goal, create a step-by-step execution plan using available agents.

AGENTS:
- Claude (coding, architecture, debugging)
- Gemini (research, review, analysis)
- OpenClaw (social media, messaging)

GOAL: ${goal}
CONTEXT: ${context || "None"}
PREFER FREE: ${prefer_free}

Create a plan with 2-5 steps. Each step must specify:
1. Agent to use
2. Action to take
3. Expected output

Format as JSON array of objects: { agent: string, action: string }`;

        // Using dynamic import for child_process
        const { spawn } = await import("child_process");
        const planner = spawn("gemini", ["-p", planPrompt], {
          shell: true,
          env: { ...process.env, FORCE_COLOR: "0" },
        });

        let planOutput = "";
        planner.stdout?.on("data", (chunk) => {
          planOutput += chunk.toString();
          send(JSON.stringify({ type: "planning", data: chunk.toString() }) + "\n");
        });

        planner.on("close", async (code) => {
          if (code !== 0) {
            send(JSON.stringify({ type: "error", data: "Planning failed" }) + "\n");
            controller.close();
            return;
          }

          // 2. Parse Plan
          let steps: Array<{ agent: string; action: string }> = [];
          try {
            const jsonMatch = planOutput.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              steps = JSON.parse(jsonMatch[0]);
            } else {
              // Fallback plan
              steps = [{ agent: "claude", action: goal }];
            }
          } catch {
            steps = [{ agent: "claude", action: goal }];
          }

          send(JSON.stringify({ type: "plan", steps }) + "\n");

          // 3. Execute Steps Sequentially
          for (const step of steps) {
            await appendLog(`[ORCHESTRATOR] Executing step: ${step.action} via ${step.agent}`);
            send(JSON.stringify({ type: "step_start", step }) + "\n");

            const agentCmd = step.agent.toLowerCase().includes("claude") ? "claude" : "gemini";
            const agentArgs = agentCmd === "claude"
              ? ["--print", "--dangerously-skip-permissions", step.action]
              : ["-p", step.action];

            const executor = spawn(agentCmd, agentArgs, {
              shell: true,
              env: { ...process.env, FORCE_COLOR: "0" },
            });

            executor.stdout?.on("data", (chunk) => {
              send(JSON.stringify({ type: "step_output", agent: step.agent, data: chunk.toString() }) + "\n");
            });

            await new Promise((resolve) => executor.on("close", resolve));
            send(JSON.stringify({ type: "step_complete", step }) + "\n");
          }

          // 4. Finalize
          await updateEngineState({ status: "idle", executorTier: null });
          send(JSON.stringify({ type: "complete", success: true }) + "\n");
          controller.close();
        });

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send(JSON.stringify({ type: "error", data: msg }) + "\n");
        await updateEngineState({ status: "failed", executorTier: null });
        controller.close();
      }
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
