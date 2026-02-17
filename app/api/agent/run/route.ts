import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { appendLog, updateEngineState } from "@/app/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface AgentRequest {
  agent: "claude" | "gemini" | "openclaw";
  prompt: string;
  workDir?: string;
  autoDebug?: boolean;
}

const AGENT_COMMANDS: Record<string, { cmd: string; args: (prompt: string) => string[] }> = {
  claude: {
    cmd: "claude",
    args: (prompt) => ["--print", "--dangerously-skip-permissions", prompt],
  },
  gemini: {
    cmd: "gemini",
    args: (prompt) => ["-p", prompt],
  },
  openclaw: {
    cmd: "openclaw",
    args: (prompt) => ["agent", "--local", "--json", "--message", prompt],
  },
};

export async function POST(req: NextRequest) {
  const body: AgentRequest = await req.json();
  const { agent, prompt, workDir, autoDebug } = body;

  const config = AGENT_COMMANDS[agent];
  if (!config) {
    return Response.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
  }

  await appendLog(`[${agent.toUpperCase()}] Executing: ${prompt.slice(0, 100)}...`);
  await updateEngineState({
    status: "in_progress",
    taskDescription: prompt.slice(0, 200),
    executorTier: agent,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const cwd = workDir || process.env.USERPROFILE || "C:\\Users\\Administrator";
      const child = spawn(config.cmd, config.args(prompt), {
        cwd,
        shell: true,
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      let fullOutput = "";
      let errorOutput = "";

      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        fullOutput += text;
        const msg = JSON.stringify({ type: "stdout", agent, data: text }) + "\n";
        controller.enqueue(encoder.encode(msg));
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        errorOutput += text;
        const msg = JSON.stringify({ type: "stderr", agent, data: text }) + "\n";
        controller.enqueue(encoder.encode(msg));
      });

      child.on("close", async (code) => {
        await appendLog(`[${agent.toUpperCase()}] Exit code: ${code}`);

        if (code !== 0 && autoDebug && errorOutput) {
          const debugMsg = JSON.stringify({
            type: "system",
            agent: "debugger",
            data: `Agent ${agent} failed (exit ${code}). Auto-debug analyzing error...`,
          }) + "\n";
          controller.enqueue(encoder.encode(debugMsg));

          // Self-debug: re-run with error context
          const debugPrompt = `The previous command failed with this error:\n\n${errorOutput.slice(0, 2000)}\n\nOriginal task: ${prompt}\n\nAnalyze the error and fix it. Provide the corrected approach.`;
          const debugChild = spawn(config.cmd, config.args(debugPrompt), {
            cwd,
            shell: true,
            env: { ...process.env, FORCE_COLOR: "0" },
          });

          debugChild.stdout?.on("data", (chunk: Buffer) => {
            const text = chunk.toString();
            const msg = JSON.stringify({ type: "stdout", agent: `${agent}-debug`, data: text }) + "\n";
            controller.enqueue(encoder.encode(msg));
          });

          debugChild.stderr?.on("data", (chunk: Buffer) => {
            const text = chunk.toString();
            const msg = JSON.stringify({ type: "stderr", agent: `${agent}-debug`, data: text }) + "\n";
            controller.enqueue(encoder.encode(msg));
          });

          debugChild.on("close", async (debugCode) => {
            await appendLog(`[${agent.toUpperCase()}-DEBUG] Exit code: ${debugCode}`);
            await updateEngineState({ status: "idle", executorTier: null });
            const endMsg = JSON.stringify({
              type: "done",
              agent,
              exitCode: code,
              debugExitCode: debugCode,
            }) + "\n";
            controller.enqueue(encoder.encode(endMsg));
            controller.close();
          });

          debugChild.on("error", async (err) => {
            const errMsg = JSON.stringify({ type: "error", agent: `${agent}-debug`, data: err.message }) + "\n";
            controller.enqueue(encoder.encode(errMsg));
            await updateEngineState({ status: "idle", executorTier: null });
            controller.close();
          });
        } else {
          await updateEngineState({ status: "idle", executorTier: null });
          const endMsg = JSON.stringify({ type: "done", agent, exitCode: code }) + "\n";
          controller.enqueue(encoder.encode(endMsg));
          controller.close();
        }
      });

      child.on("error", async (err) => {
        const errMsg = JSON.stringify({ type: "error", agent, data: err.message }) + "\n";
        controller.enqueue(encoder.encode(errMsg));
        await appendLog(`[${agent.toUpperCase()}] Error: ${err.message}`);
        await updateEngineState({ status: "failed", executorTier: null });
        controller.close();
      });
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
