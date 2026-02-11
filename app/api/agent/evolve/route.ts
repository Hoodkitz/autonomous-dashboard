import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { appendLog, updateEngineState } from "@/app/lib/engine";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export const runtime = 'nodejs';

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DASHBOARD_DIR = join(process.env.USERPROFILE || "C:\\Users\\Administrator", "autonomous-dashboard");

interface EvolveRequest {
  target: "self" | "file";
  filePath?: string;
  instruction: string;
  agent?: "claude" | "gemini";
}

export async function POST(req: NextRequest) {
  const body: EvolveRequest = await req.json();
  const { target, filePath, instruction, agent = "claude" } = body;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, agentName: string, data: string) {
        controller.enqueue(encoder.encode(JSON.stringify({ type, agent: agentName, data }) + "\n"));
      }

      try {
        await updateEngineState({ status: "in_progress", phase: "evolving", executorTier: agent });

        const targetFile = filePath;
        let fileContent = "";

        if (target === "self") {
          // Self-evolve: agent reads the dashboard code and improves it
          send("system", "evolve", "Self-evolution mode: Agent will analyze and improve dashboard code...");
          await appendLog("[EVOLVE] Self-evolution started");

          // Gather all source files
          const srcFiles = [
            "app/page.tsx", "app/chat/page.tsx", "app/layout.tsx",
            "app/revenue/page.tsx", "app/tasks/page.tsx", "app/skills/page.tsx",
            "app/vault/page.tsx", "app/logs/page.tsx",
            "app/lib/engine.ts", "app/globals.css",
            "app/api/agent/run/route.ts", "app/api/agent/orchestrate/route.ts",
            "app/components/sidebar.tsx", "app/components/status-badge.tsx",
          ];

          const codeContext = srcFiles
            .filter((f) => existsSync(join(DASHBOARD_DIR, f)))
            .map((f) => {
              const content = readFileSync(join(DASHBOARD_DIR, f), "utf-8");
              return `=== ${f} ===\n${content.slice(0, 3000)}`;
            })
            .join("\n\n");

          const prompt = `You are a senior developer evolving a Next.js dashboard. Here is the current codebase:\n\n${codeContext.slice(0, 12000)}\n\nInstruction: ${instruction}\n\nOutput your changes as a JSON array of file edits:\n[{"file": "app/example.tsx", "content": "full file content..."}]\n\nOnly output the JSON array. No markdown, no explanations.`;

          const result = await runAgent(agent, prompt, DASHBOARD_DIR);
          send("stdout", agent, "Agent analysis complete. Parsing changes...");

          // Parse and apply changes
          try {
            const jsonMatch = result.output.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const changes = JSON.parse(jsonMatch[0]) as Array<{ file: string; content: string }>;
              for (const change of changes) {
                const safePath = change.file.replace(/\.\./g, "").replace(/^\//, "");
                const fullPath = join(DASHBOARD_DIR, safePath);
                // Safety: only allow writing inside dashboard dir
                if (!fullPath.startsWith(DASHBOARD_DIR)) {
                  send("error", "evolve", `Blocked write outside dashboard: ${safePath}`);
                  continue;
                }
                writeFileSync(fullPath, change.content, "utf-8");
                send("system", "evolve", `Updated: ${safePath}`);
                await appendLog(`[EVOLVE] Updated: ${safePath}`);
              }
              send("system", "evolve", `Applied ${changes.length} file changes. Dashboard will hot-reload.`);
            } else {
              send("stdout", agent, result.output);
              send("system", "evolve", "Agent did not output structured changes. Showing raw output above.");
            }
          } catch {
            send("stdout", agent, result.output);
            send("system", "evolve", "Could not parse structured output. Showing raw response.");
          }
        } else if (target === "file" && targetFile) {
          // Edit a specific file
          const safePath = targetFile.replace(/\.\./g, "").replace(/^\//, "");
          const fullPath = join(DASHBOARD_DIR, safePath);

          if (!fullPath.startsWith(DASHBOARD_DIR)) {
            send("error", "evolve", "Path must be inside the dashboard directory");
            controller.close();
            return;
          }

          if (existsSync(fullPath)) {
            fileContent = readFileSync(fullPath, "utf-8");
          }

          send("system", "evolve", `Evolving: ${safePath}`);

          const prompt = `Here is a file from a Next.js dashboard:\n\n=== ${safePath} ===\n${fileContent}\n\nInstruction: ${instruction}\n\nOutput ONLY the complete updated file content. No markdown code fences, no explanations. Just the raw file content.`;

          const result = await runAgent(agent, prompt, DASHBOARD_DIR);

          // Write the result
          let newContent = result.output.trim();
          // Strip markdown fences if agent added them
          if (newContent.startsWith("```")) {
            newContent = newContent.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
          }

          if (newContent.length > 50) {
            writeFileSync(fullPath, newContent, "utf-8");
            send("system", "evolve", `File updated: ${safePath} (${newContent.length} chars)`);
            await appendLog(`[EVOLVE] File updated: ${safePath}`);
          } else {
            send("error", "evolve", "Agent output too short, skipping write to avoid corruption.");
            send("stdout", agent, result.output);
          }
        }

        await updateEngineState({ status: "idle", phase: null, executorTier: null });
        send("done", "evolve", "Evolution complete.");

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send("error", "evolve", msg);
        await updateEngineState({ status: "failed", phase: null });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

function runAgent(agent: string, prompt: string, cwd: string): Promise<{ output: string; error: string; code: number }> {
  return new Promise((resolve) => {
    const cmds: Record<string, { cmd: string; args: string[] }> = {
      claude: { cmd: "claude", args: ["--print", "--dangerously-skip-permissions", prompt] },
      gemini: { cmd: "gemini", args: ["-p", prompt] },
    };
    const cfg = cmds[agent] || cmds.claude;
    let output = "", error = "";
    const child = spawn(cfg.cmd, cfg.args, { cwd, shell: true, env: { ...process.env, FORCE_COLOR: "0" } });
    child.stdout?.on("data", (c: Buffer) => { output += c.toString(); });
    child.stderr?.on("data", (c: Buffer) => { error += c.toString(); });
    child.on("close", (code) => resolve({ output, error, code: code || 0 }));
    child.on("error", (err) => resolve({ output, error: err.message, code: 1 }));
  });
}
