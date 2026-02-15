import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { appendLog, updateEngineState } from "@/app/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface OrchestrateRequest {
  task: string;
  workDir?: string;
}

function runAgent(agent: string, cmd: string, args: string[], cwd: string): Promise<{ output: string; error: string; code: number }> {
  return new Promise((resolve) => {
    let output = "";
    let error = "";
    const child = spawn(cmd, args, { cwd, shell: true, env: { ...process.env, FORCE_COLOR: "0" } });

    child.stdout?.on("data", (c: Buffer) => { output += c.toString(); });
    child.stderr?.on("data", (c: Buffer) => { error += c.toString(); });
    child.on("close", (code) => resolve({ output, error, code: code || 0 }));
    child.on("error", (err) => resolve({ output, error: err.message, code: 1 }));
  });
}

export async function POST(req: NextRequest) {
  const body: OrchestrateRequest = await req.json();
  const { task, workDir } = body;
  const cwd = workDir || process.env.USERPROFILE || "C:\\Users\\Administrator";

  await updateEngineState({
    status: "in_progress",
    phase: "orchestration",
    taskDescription: task,
    executorTier: "multi-agent",
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, agent: string, data: string) {
        controller.enqueue(encoder.encode(JSON.stringify({ type, agent, data }) + "\n"));
      }

      try {
        // Phase 1: Claude plans the architecture
        send("system", "orchestrator", "Phase 1/4: Claude CLI planning architecture...");
        await appendLog("[ORCHESTRATOR] Phase 1: Claude planning");

        const planPrompt = `You are the lead architect. Plan this task step by step. Be concise. Output only the plan as numbered steps.\n\nTask: ${task}`;
        const planResult = await runAgent("claude", "claude", ["--print", "--dangerously-skip-permissions", planPrompt], cwd);
        send("stdout", "claude", planResult.output || planResult.error);

        // Phase 2: Gemini reviews the plan
        send("system", "orchestrator", "Phase 2/4: Gemini CLI reviewing plan...");
        await appendLog("[ORCHESTRATOR] Phase 2: Gemini reviewing");

        const reviewPrompt = `Review this plan for a task. Identify issues, suggest improvements, rate 1-10. Be concise.\n\nTask: ${task}\n\nPlan:\n${planResult.output.slice(0, 3000)}`;
        const reviewResult = await runAgent("gemini", "gemini", ["-p", reviewPrompt], cwd);
        send("stdout", "gemini", reviewResult.output || reviewResult.error);

        // Phase 3: Claude executes with review feedback
        send("system", "orchestrator", "Phase 3/4: Claude CLI executing with feedback...");
        await appendLog("[ORCHESTRATOR] Phase 3: Claude executing");

        const execPrompt = `Execute this task. Write all code needed. Apply the review feedback.\n\nTask: ${task}\n\nPlan:\n${planResult.output.slice(0, 2000)}\n\nReview feedback:\n${reviewResult.output.slice(0, 1500)}`;
        const execResult = await runAgent("claude", "claude", ["--print", "--dangerously-skip-permissions", execPrompt], cwd);
        send("stdout", "claude", execResult.output || execResult.error);

        // Phase 4: Self-debug if errors
        if (execResult.code !== 0 || execResult.error) {
          send("system", "orchestrator", "Phase 4/4: Self-debugging errors...");
          await appendLog("[ORCHESTRATOR] Phase 4: Self-debugging");

          const debugPrompt = `Debug and fix these errors from the previous execution:\n\nErrors:\n${execResult.error.slice(0, 2000)}\n\nOriginal task: ${task}`;
          const debugResult = await runAgent("claude", "claude", ["--print", "--dangerously-skip-permissions", debugPrompt], cwd);
          send("stdout", "claude-debug", debugResult.output || debugResult.error);
        } else {
          send("system", "orchestrator", "Phase 4/4: Execution completed successfully. No debug needed.");
        }

        await updateEngineState({ status: "idle", phase: null, executorTier: null });
        send("done", "orchestrator", "Multi-agent orchestration complete.");
        await appendLog("[ORCHESTRATOR] Task complete");

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send("error", "orchestrator", msg);
        await appendLog(`[ORCHESTRATOR] Error: ${msg}`);
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

export const runtime = 'nodejs';
