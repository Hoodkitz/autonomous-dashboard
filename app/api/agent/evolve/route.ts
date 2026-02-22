import { NextRequest } from "next/server";
import { appendLog, updateEngineState } from "@/app/lib/engine";
import { join } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const DASHBOARD_DIR = join(process.env.USERPROFILE || "C:\\Users\\Administrator", "autonomous-dashboard");

export async function POST(req: NextRequest) {
  const { action, targetFile, improvement } = await req.json();

  if (action === "evolve_file") {
    await updateEngineState({
      status: "in_progress",
      taskDescription: `Evolving file: ${targetFile}`,
      executorTier: "agentic-dev",
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (msg: string) => controller.enqueue(encoder.encode(msg + "\n"));

        try {
          // 1. Read the file content
          // In a real scenario we'd use fs.readFile, but for now we assume the agent handles it via CLI
          send(`[EVOLVE] Targeting: ${targetFile}`);

          // 2. Construct the evolution prompt
          const prompt = `Refactor and improve this file: ${targetFile}
Context: ${improvement}
Requirements:
- Implement requested changes
- Add error handling
- Improve type safety
- Keep existing functionality
- Output ONLY the new file content`;

          // 3. Spawn the agent
          // Use dynamic import for child_process
          const { spawn } = await import("child_process");
          const child = spawn("claude", ["--print", "--dangerously-skip-permissions", prompt], {
            cwd: DASHBOARD_DIR,
            shell: true,
            env: { ...process.env, FORCE_COLOR: "0" },
          });

          let output = "";

          child.stdout?.on("data", (chunk) => {
            const text = chunk.toString();
            output += text;
            send(JSON.stringify({ type: "progress", data: text }));
          });

          child.stderr?.on("data", (chunk) => {
            send(JSON.stringify({ type: "stderr", data: chunk.toString() }));
          });

          child.on("close", async (code) => {
            if (code === 0 && output.length > 0) {
              // 4. Save the result (in a real scenario)
              // For now we just log it
              await appendLog(`[EVOLVE] Successfully evolved ${targetFile}`);
              send(JSON.stringify({ type: "complete", success: true, code }));
            } else {
              await appendLog(`[EVOLVE] Failed to evolve ${targetFile}`);
              send(JSON.stringify({ type: "complete", success: false, code }));
            }
            await updateEngineState({ status: "idle", executorTier: null });
            controller.close();
          });

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          send(JSON.stringify({ type: "error", data: msg }));
          await updateEngineState({ status: "failed", executorTier: null });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
