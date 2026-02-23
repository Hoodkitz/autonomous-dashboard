import { NextRequest } from "next/server";
import { runPipeline, resumePipeline, loadLatestState, DEFAULT_CONFIG } from "@/app/lib/autonomous-pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, goal, config, workDir } = body;
  const cwd = workDir || process.env.USERPROFILE || "C:\\Users\\Administrator";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: string) => controller.enqueue(encoder.encode(data));

      try {
        if (action === "start") {
          await runPipeline(goal, config, cwd, emit);
        } else if (action === "resume" || action === "stop") {
          await resumePipeline(action === "stop" ? "stop" : "go", emit, cwd);
        } else {
          emit(JSON.stringify({ type: "error", message: "Invalid action" }) + "\n");
        }
      } catch (err) {
        emit(JSON.stringify({ type: "error", message: String(err) }) + "\n");
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

export async function GET() {
  const state = await loadLatestState();
  return Response.json({
    active: !!state && state.phase !== "complete" && state.phase !== "failed",
    state: state || null,
    defaultConfig: DEFAULT_CONFIG,
  });
}
