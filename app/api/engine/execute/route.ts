import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { appendLog, updateEngineState, getEngineState, writeJson } from "@/app/lib/engine";
import { generatePrompt, recordOutcome, shouldEvolve, evolveTemplate, applyEvolution } from "@/app/lib/meta-prompt";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export const runtime = 'nodejs';

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HOME = process.env.USERPROFILE || homedir();
const ENGINE_DIR = join(HOME, ".autonomous-engine");

interface ExecuteRequest {
  task: string;
  workDir?: string;
  maxCycles?: number;
}

function runAgent(
  agent: "claude" | "gemini" | "openclaw",
  prompt: string,
  cwd: string
): Promise<{ output: string; error: string; code: number }> {
  return new Promise((resolve) => {
    const cmds: Record<string, { cmd: string; args: string[] }> = {
      claude: { cmd: "claude", args: ["--print", "--dangerously-skip-permissions", prompt] },
      gemini: { cmd: "gemini", args: ["-p", prompt] },
      openclaw: { cmd: "openclaw", args: ["agent", "--local", "--json", "--message", prompt] },
    };
    const cfg = cmds[agent] || cmds.claude;
    let output = "";
    let error = "";
    const child = spawn(cfg.cmd, cfg.args, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    child.stdout?.on("data", (c: Buffer) => { output += c.toString(); });
    child.stderr?.on("data", (c: Buffer) => { error += c.toString(); });
    child.on("close", (code) => resolve({ output, error, code: code || 0 }));
    child.on("error", (err) => resolve({ output, error: err.message, code: 1 }));
  });
}

// Load the SKILL.md knowledge base for agent context
function getSkillContext(): string {
  const skillPath = join(HOME, ".claude", "skills", "autonomous-symbiotic-engine", "SKILL.md");
  if (existsSync(skillPath)) {
    const content = readFileSync(skillPath, "utf-8");
    return content.slice(0, 4000);
  }
  return "Autonomous Symbiotic Engine with 5 cores: Autopilot, Agentic Dev, Ralph Loop, AI Workflow, Revenue Engine.";
}

export async function POST(req: NextRequest) {
  const body: ExecuteRequest = await req.json();
  const { task, workDir, maxCycles = 3 } = body;
  const cwd = workDir || HOME;
  const skillContext = getSkillContext();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, agent: string, data: string) {
        controller.enqueue(encoder.encode(JSON.stringify({ type, agent, data }) + "\n"));
      }

      try {
        // ===== PHASE 1: UNDERSTAND =====
        send("system", "orchestrator", "PHASE 1/5: UNDERSTAND - Expanding task into detailed spec...");
        await updateEngineState({
          status: "in_progress",
          phase: "understand",
          currentStep: 1,
          totalSteps: 5,
          taskDescription: task,
          executorTier: "multi-agent",
          cores: {
            autopilot: "running",
            agentic_dev: "running",
            ralph_loop: "ready",
            ai_agent_workflow: "ready",
            revenue_engine: "ready",
          },
        });
        await appendLog("[ENGINE] Phase 1: UNDERSTAND started");

        const { prompt: expandPrompt, templateId: planTplId } = await generatePrompt("plan", {
          context: skillContext.slice(0, 2000),
          task,
          codebase: "Next.js 16 + Tailwind v4 + TypeScript autonomous dashboard",
        });

        const specResult = await runAgent("claude", expandPrompt, cwd);

        // Record outcome for meta-prompt learning
        await recordOutcome({
          templateId: planTplId,
          timestamp: new Date().toISOString(),
          success: specResult.code === 0 && specResult.output.length > 200,
          quality: specResult.code === 0 ? 7 : 3,
          exitCode: specResult.code,
          outputLength: specResult.output.length,
          errorLength: specResult.error.length,
          taskType: "understand",
        });
        send("stdout", "claude", specResult.output || specResult.error);
        const spec = specResult.output;

        // Save spec
        await writeJson("spec.md", spec);
        await appendLog("[ENGINE] Spec generated and saved");

        // ===== PHASE 2: PLAN =====
        send("system", "orchestrator", "PHASE 2/5: PLAN - Creating implementation plan + review...");
        await updateEngineState({
          phase: "plan",
          currentStep: 2,
          cores: {
            autopilot: "running",
            agentic_dev: "running",
            ralph_loop: "running",
            ai_agent_workflow: "ready",
            revenue_engine: "ready",
          },
        });
        await appendLog("[ENGINE] Phase 2: PLAN started");

        const { prompt: planPrompt, templateId: planTplId2 } = await generatePrompt("plan", {
          context: `Spec:\n${spec.slice(0, 3000)}`,
          task: "Create detailed implementation plan with file paths and acceptance criteria",
          codebase: "Based on the specification above",
        });

        const planResult = await runAgent("claude", planPrompt, cwd);
        await recordOutcome({
          templateId: planTplId2,
          timestamp: new Date().toISOString(),
          success: planResult.code === 0,
          quality: planResult.code === 0 ? 7 : 3,
          exitCode: planResult.code,
          outputLength: planResult.output.length,
          errorLength: planResult.error.length,
          taskType: "plan",
        });
        send("stdout", "claude", planResult.output || planResult.error);
        const plan = planResult.output;

        // Gemini reviews the plan
        send("system", "orchestrator", "Gemini reviewing plan...");
        const { prompt: reviewPrompt, templateId: reviewTplId } = await generatePrompt("review", {
          task,
          code: plan.slice(0, 3000),
          criteria: "Plan completeness, feasibility, risk assessment",
        });
        const reviewResult = await runAgent("gemini", reviewPrompt, cwd);
        await recordOutcome({
          templateId: reviewTplId,
          timestamp: new Date().toISOString(),
          success: reviewResult.code === 0,
          quality: reviewResult.code === 0 ? 7 : 4,
          exitCode: reviewResult.code,
          outputLength: reviewResult.output.length,
          errorLength: reviewResult.error.length,
          taskType: "review",
        });
        send("stdout", "gemini", reviewResult.output || reviewResult.error);
        const review = reviewResult.output;

        // Save plan
        await writeJson("plan.md", plan + "\n\n--- REVIEW ---\n" + review);
        await appendLog("[ENGINE] Plan created and reviewed");

        // ===== PHASE 3: EXECUTE =====
        send("system", "orchestrator", "PHASE 3/5: EXECUTE - Building with feedback loop...");
        await updateEngineState({
          phase: "execute",
          currentStep: 3,
          cores: {
            autopilot: "running",
            agentic_dev: "running",
            ralph_loop: "running",
            ai_agent_workflow: "running",
            revenue_engine: "ready",
          },
        });
        await appendLog("[ENGINE] Phase 3: EXECUTE started");

        const { prompt: execPrompt, templateId: execTplId } = await generatePrompt("execute", {
          task,
          plan: plan.slice(0, 2500),
          feedback: review.slice(0, 1500),
        });

        const execResult = await runAgent("claude", execPrompt, cwd);
        await recordOutcome({
          templateId: execTplId,
          timestamp: new Date().toISOString(),
          success: execResult.code === 0 && execResult.output.length > 500,
          quality: execResult.code === 0 ? 8 : 3,
          exitCode: execResult.code,
          outputLength: execResult.output.length,
          errorLength: execResult.error.length,
          taskType: "execute",
        });
        send("stdout", "claude", execResult.output || execResult.error);

        // ===== PHASE 4: VALIDATE =====
        send("system", "orchestrator", "PHASE 4/5: VALIDATE - Multi-reviewer quality gate...");
        await updateEngineState({
          phase: "validate",
          currentStep: 4,
          cores: {
            autopilot: "running",
            agentic_dev: "running",
            ralph_loop: "ready",
            ai_agent_workflow: "running",
            revenue_engine: "ready",
          },
        });
        await appendLog("[ENGINE] Phase 4: VALIDATE started");

        const { prompt: validatePrompt, templateId: valTplId } = await generatePrompt("review", {
          task,
          code: execResult.output.slice(0, 3000),
          criteria: "Architecture fit, security, code quality, completeness. APPROVED if all >= 7/10.",
        });

        const validateResult = await runAgent("gemini", validatePrompt, cwd);
        await recordOutcome({
          templateId: valTplId,
          timestamp: new Date().toISOString(),
          success: validateResult.code === 0 && validateResult.output.toUpperCase().includes("APPROVED"),
          quality: validateResult.output.toUpperCase().includes("APPROVED") ? 9 : 5,
          exitCode: validateResult.code,
          outputLength: validateResult.output.length,
          errorLength: validateResult.error.length,
          taskType: "validate",
        });
        send("stdout", "gemini", validateResult.output || validateResult.error);

        // Save validation
        await writeJson("validation/latest.json", {
          timestamp: new Date().toISOString(),
          task,
          result: validateResult.output.slice(0, 2000),
          approved: validateResult.output.toUpperCase().includes("APPROVED"),
        });

        // ===== PHASE 5: CONTINUOUS / SELF-HEAL =====
        const isApproved = validateResult.output.toUpperCase().includes("APPROVED");

        if (!isApproved && maxCycles > 1) {
          send("system", "orchestrator", "PHASE 5/5: CONTINUOUS - Fixing issues found in validation...");
          await updateEngineState({
            phase: "continuous",
            currentStep: 5,
            cores: {
              autopilot: "running",
              agentic_dev: "running",
              ralph_loop: "running",
              ai_agent_workflow: "running",
              revenue_engine: "ready",
            },
          });
          await appendLog("[ENGINE] Phase 5: CONTINUOUS - self-healing");

          const fixPrompt = `The code review found issues. Fix them.\n\nOriginal task: ${task}\n\nValidation feedback:\n${validateResult.output.slice(0, 2000)}\n\nPrevious output:\n${execResult.output.slice(0, 2000)}\n\nFix all issues listed. Write the corrected code.`;

          const fixResult = await runAgent("claude", fixPrompt, cwd);
          send("stdout", "claude-debug", fixResult.output || fixResult.error);

          await appendLog("[ENGINE] Self-healing fix applied");
        } else if (isApproved) {
          send("system", "orchestrator", "PHASE 5/5: All validators APPROVED. Task complete.");
        } else {
          send("system", "orchestrator", "PHASE 5/5: Validation issues found but max cycles reached.");
        }

        // ===== META-PROMPT SELF-EVOLUTION =====
        // Check if any templates need evolution based on outcomes
        for (const tplId of [planTplId, planTplId2, reviewTplId, execTplId, valTplId]) {
          if (await shouldEvolve(tplId)) {
            send("system", "orchestrator", `Meta-prompt evolving template ${tplId.slice(0, 15)}...`);
            const evolveData = await evolveTemplate(tplId);
            if (evolveData) {
              // Use Gemini to evolve the prompt (different perspective)
              const evolveResult = await runAgent("gemini", evolveData.template, cwd);
              if (evolveResult.code === 0 && evolveResult.output.length > 100) {
                await applyEvolution(tplId, evolveResult.output);
                send("system", "orchestrator", "Template evolved successfully. Future prompts will use improved version.");
                await appendLog(`[META] Template ${tplId.slice(0, 15)} evolved`);
              }
            }
          }
        }

        // Final state
        const stories = await getEngineState().then((s) => s.completedStories);
        await updateEngineState({
          status: "idle",
          phase: null,
          currentStep: 0,
          totalSteps: 0,
          executorTier: null,
          completedStories: [...stories, task.slice(0, 50)],
          cores: {
            autopilot: "ready",
            agentic_dev: "ready",
            ralph_loop: "ready",
            ai_agent_workflow: "ready",
            revenue_engine: "ready",
          },
        });

        send("done", "orchestrator", "Symbiotic Engine pipeline complete.");
        await appendLog(`[ENGINE] Task complete: ${task.slice(0, 80)}`);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send("error", "orchestrator", msg);
        await appendLog(`[ENGINE] Error: ${msg}`);
        await updateEngineState({
          status: "failed",
          executorTier: null,
          failedAttempts: (await getEngineState()).failedAttempts + 1,
          cores: {
            autopilot: "ready",
            agentic_dev: "ready",
            ralph_loop: "ready",
            ai_agent_workflow: "ready",
            revenue_engine: "ready",
          },
        });
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
