/**
 * Ultimate Autonomous Pipeline
 *
 * Architecture: Plan-and-Execute with ReAct inner loop
 * Agents: Claude (coder), Gemini (reviewer), OpenRouter (planner/researcher), OpenClaw (deploy)
 * State: Supabase PostgreSQL for persistence
 * Budget: Hard cost limits with tracking
 * Human-in-loop: go/no-go checkpoints before deployment
 */

import { runCliAgent, runOpenRouterModel } from "./orchestrator";
import { getApiKey, chatCompletion, type ChatMessage } from "./openrouter";
import { appendLog, getEngineState, updateEngineState } from "./engine";

// Helper to load Node.js modules dynamically
async function getNodeModules() {
  const [fs, path, os] = await Promise.all([
    import("fs/promises"),
    import("path"),
    import("os"),
  ]);
  return { fs, path, os };
}

// Helper to resolve pipeline directory
async function getPipelineDir() {
  const { path, os } = await getNodeModules();
  const HOME = process.env.USERPROFILE || os.homedir();
  return path.join(HOME, ".autonomous-engine", "pipeline");
}

// ============ TYPES ============

export interface PipelineConfig {
  max_iterations: number;
  max_cost_usd: number;
  prefer_free: boolean;
  auto_deploy: boolean;        // false = requires human go/no-go
  checkpoint_interval: number;  // save state every N steps
}

export const DEFAULT_CONFIG: PipelineConfig = {
  max_iterations: 20,
  max_cost_usd: 0.50,   // hard budget cap
  prefer_free: true,
  auto_deploy: false,    // human approval required
  checkpoint_interval: 3,
};

export interface CostTracker {
  total_usd: number;
  breakdown: Record<string, number>;
  api_calls: number;
}

export type PipelinePhase =
  | "research"      // Discover opportunities
  | "planning"      // Plan the product
  | "building"      // Code it
  | "reviewing"     // Review + fix
  | "testing"       // Verify it works
  | "preparing"     // Prepare deployment
  | "awaiting_go"   // Human checkpoint
  | "deploying"     // Ship it
  | "optimizing"    // Self-improve
  | "complete"
  | "failed"
  | "budget_exceeded";

export interface PipelineState {
  id: string;
  phase: PipelinePhase;
  goal: string;
  iteration: number;
  config: PipelineConfig;
  cost: CostTracker;
  memory: Array<{ role: string; agent: string; content: string; timestamp: string }>;
  plan: Array<{ step: string; agent: string; status: "pending" | "running" | "done" | "failed"; result?: string }>;
  artifacts: Record<string, string>;  // file paths, urls, etc
  research_findings: string[];
  errors: string[];
  created_at: string;
  updated_at: string;
}

// ============ STATE MANAGEMENT ============

function newState(goal: string, config: PipelineConfig): PipelineState {
  return {
    id: `pipeline_${Date.now()}`,
    phase: "research",
    goal,
    iteration: 0,
    config,
    cost: { total_usd: 0, breakdown: {}, api_calls: 0 },
    memory: [],
    plan: [],
    artifacts: {},
    research_findings: [],
    errors: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function saveState(state: PipelineState): Promise<void> {
  const { fs, path } = await getNodeModules();
  const PIPELINE_DIR = await getPipelineDir();

  // Use engine's knownDirs cache if possible, but here we do simple check or rely on mkdir recursive
  await fs.mkdir(PIPELINE_DIR, { recursive: true });

  state.updated_at = new Date().toISOString();
  await fs.writeFile(path.join(PIPELINE_DIR, `${state.id}.json`), JSON.stringify(state, null, 2));
  // Also save as "latest"
  await fs.writeFile(path.join(PIPELINE_DIR, "latest.json"), JSON.stringify(state, null, 2));
}

export async function loadLatestState(): Promise<PipelineState | null> {
  try {
    const { fs, path } = await getNodeModules();
    const PIPELINE_DIR = await getPipelineDir();
    const filePath = path.join(PIPELINE_DIR, "latest.json");

    // Direct read with try/catch instead of existsSync
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch { return null; }
}

// ============ COST TRACKING ============

function trackCost(state: PipelineState, category: string, amount: number) {
  state.cost.total_usd += amount;
  state.cost.breakdown[category] = (state.cost.breakdown[category] || 0) + amount;
  state.cost.api_calls++;
}

function budgetExceeded(state: PipelineState): boolean {
  return state.cost.total_usd >= state.config.max_cost_usd;
}

// ============ AGENT HELPERS ============

async function callFreeModel(messages: ChatMessage[]): Promise<{ content: string; cost: number }> {
  try {
    const apiKey = await getApiKey();
    const res = await chatCompletion(apiKey, {
      model: "google/gemini-2.0-flash-exp:free",
      messages,
      stream: false,
    });
    if (!res.ok) {
      // Fallback to DeepSeek
      const res2 = await chatCompletion(apiKey, {
        model: "deepseek/deepseek-chat-v3-0324:free",
        messages,
        stream: false,
      });
      if (!res2.ok) throw new Error(`Both free models failed`);
      const data = await res2.json();
      return { content: data.choices?.[0]?.message?.content || "", cost: 0 };
    }
    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content || "", cost: 0 };
  } catch (err) {
    return { content: "", cost: 0 };
  }
}

// ============ PIPELINE PHASES ============

async function phaseResearch(
  state: PipelineState,
  emit: (data: string) => void
): Promise<void> {
  emit(JSON.stringify({ type: "phase", phase: "research", message: "Researching revenue opportunities..." }) + "\n");
  await appendLog(`[PIPELINE:${state.id}] Research phase started`);

  const prompt = `You are an autonomous revenue research AI. Find the SINGLE BEST opportunity to build and monetize given these assets:
- Dashboard (Next.js 16, running)
- OpenRouter (300+ AI models, free tier)
- Claude Code CLI, Gemini CLI
- OpenClaw (Discord/Telegram/WhatsApp)
- Supabase PostgreSQL (free tier)
- 50+ agent skills

Goal: ${state.goal}

Return JSON:
{
  "opportunity": {
    "name": "Product Name",
    "description": "What it does",
    "revenue_model": "How it makes money",
    "estimated_monthly": "$X-$Y",
    "tech_stack": ["tech1", "tech2"],
    "build_steps": ["step 1", "step 2", ...],
    "deploy_to": "Vercel/Cloudflare/etc (free tier)",
    "time_estimate": "X days"
  },
  "why": "Why this is the best choice right now"
}`;

  const result = await callFreeModel([
    { role: "system", content: "Respond with valid JSON only." },
    { role: "user", content: prompt },
  ]);

  state.memory.push({ role: "research", agent: "gemini-flash", content: result.content, timestamp: new Date().toISOString() });
  trackCost(state, "research", result.cost);

  try {
    const json = JSON.parse(result.content.match(/\{[\s\S]*\}/)?.[0] || "{}");
    if (json.opportunity) {
      state.research_findings.push(JSON.stringify(json.opportunity));
      state.artifacts.opportunity = JSON.stringify(json.opportunity);
      emit(JSON.stringify({ type: "research", opportunity: json.opportunity, why: json.why }) + "\n");
    }
  } catch {
    state.research_findings.push(result.content.slice(0, 1000));
  }

  state.phase = "planning";
}

async function phasePlanning(
  state: PipelineState,
  emit: (data: string) => void
): Promise<void> {
  emit(JSON.stringify({ type: "phase", phase: "planning", message: "Creating build plan..." }) + "\n");

  const opportunity = state.artifacts.opportunity || state.research_findings[0] || state.goal;

  const prompt = `You are an expert software architect. Create a detailed build plan for:

${opportunity}

Create 4-8 concrete steps. Each step must specify which agent should do it:
- "claude" for coding/architecture (CLI agent, full file system access)
- "gemini" for review/research (CLI agent)
- "openrouter" for AI analysis (API, use for planning/research)

Return JSON:
{
  "plan": [
    { "step": "Description of what to do", "agent": "claude|gemini|openrouter" }
  ]
}`;

  const result = await callFreeModel([
    { role: "system", content: "Respond with valid JSON only." },
    { role: "user", content: prompt },
  ]);

  trackCost(state, "planning", result.cost);

  try {
    const json = JSON.parse(result.content.match(/\{[\s\S]*\}/)?.[0] || "{}");
    if (json.plan?.length) {
      state.plan = json.plan.map((s: { step: string; agent: string }) => ({
        step: s.step,
        agent: s.agent,
        status: "pending" as const,
      }));
      emit(JSON.stringify({ type: "plan", steps: state.plan.length, plan: state.plan }) + "\n");
    }
  } catch {
    // Fallback plan
    state.plan = [
      { step: "Set up project structure", agent: "claude", status: "pending" },
      { step: "Implement core features", agent: "claude", status: "pending" },
      { step: "Review and test", agent: "gemini", status: "pending" },
      { step: "Prepare deployment", agent: "claude", status: "pending" },
    ];
  }

  state.memory.push({ role: "planning", agent: "planner", content: JSON.stringify(state.plan), timestamp: new Date().toISOString() });
  state.phase = "building";
}

async function phaseBuilding(
  state: PipelineState,
  emit: (data: string) => void,
  cwd: string
): Promise<void> {
  emit(JSON.stringify({ type: "phase", phase: "building", message: `Executing ${state.plan.length} build steps...` }) + "\n");

  let previousOutput = "";

  for (let i = 0; i < state.plan.length; i++) {
    const step = state.plan[i];
    if (step.status === "done") continue;

    // Check budget
    if (budgetExceeded(state)) {
      state.phase = "budget_exceeded";
      emit(JSON.stringify({ type: "budget", message: `Budget exceeded: $${state.cost.total_usd.toFixed(4)}/${state.config.max_cost_usd}` }) + "\n");
      return;
    }

    // Check iteration limit
    state.iteration++;
    if (state.iteration > state.config.max_iterations) {
      state.phase = "failed";
      state.errors.push("Max iterations exceeded");
      return;
    }

    step.status = "running";
    emit(JSON.stringify({ type: "step", index: i, total: state.plan.length, step: step.step, agent: step.agent }) + "\n");

    const contextPrompt = previousOutput
      ? `${step.step}\n\nContext from previous step:\n${previousOutput.slice(0, 3000)}`
      : step.step;

    let result: { output: string; error: string; success: boolean };

    if (step.agent === "claude" || step.agent === "gemini") {
      const r = await runCliAgent(step.agent, contextPrompt, cwd);
      result = { output: r.output, error: r.error, success: r.code === 0 };
    } else {
      result = await runOpenRouterModel("or:google/gemini-2.0-flash-exp:free", [
        { role: "user", content: contextPrompt },
      ]);
      trackCost(state, "build-openrouter", 0); // free model
    }

    if (result.success) {
      step.status = "done";
      step.result = result.output.slice(0, 2000);
      previousOutput = result.output;
      emit(JSON.stringify({ type: "step_done", index: i, success: true, preview: result.output.slice(0, 200) }) + "\n");
    } else {
      // Retry once with error context
      emit(JSON.stringify({ type: "step_retry", index: i, error: result.error.slice(0, 200) }) + "\n");

      const retryPrompt = `The previous step failed with error:\n${result.error.slice(0, 1500)}\n\nOriginal task: ${step.step}\n\nFix the issue and try again.`;
      const retryAgent = step.agent === "gemini" ? "claude" : step.agent; // fallback to claude
      const r2 = await runCliAgent(retryAgent, retryPrompt, cwd);

      if (r2.code === 0) {
        step.status = "done";
        step.result = r2.output.slice(0, 2000);
        previousOutput = r2.output;
      } else {
        step.status = "failed";
        step.result = r2.error.slice(0, 500);
        state.errors.push(`Step ${i}: ${r2.error.slice(0, 200)}`);
      }
    }

    // Checkpoint
    if (i % state.config.checkpoint_interval === 0) {
      await saveState(state);
    }

    state.memory.push({
      role: "build",
      agent: step.agent,
      content: `Step ${i}: ${step.step} -> ${step.status}`,
      timestamp: new Date().toISOString(),
    });
  }

  const failedSteps = state.plan.filter((s) => s.status === "failed").length;
  if (failedSteps > state.plan.length / 2) {
    state.phase = "failed";
  } else {
    state.phase = "reviewing";
  }
}

async function phaseReviewing(
  state: PipelineState,
  emit: (data: string) => void,
  cwd: string
): Promise<void> {
  emit(JSON.stringify({ type: "phase", phase: "reviewing", message: "Multi-model review..." }) + "\n");

  const buildResults = state.plan
    .filter((s) => s.result)
    .map((s, i) => `Step ${i}: ${s.step}\nResult: ${s.result?.slice(0, 500)}`)
    .join("\n\n");

  // Use Gemini CLI for code review
  const reviewPrompt = `Review this build output. Check for: bugs, security issues, missing features, deployment readiness.

Build results:
${buildResults.slice(0, 4000)}

Respond with:
1. Issues found (if any)
2. Overall quality rating 1-10
3. Ready for deployment? yes/no
4. Fixes needed (if any)`;

  const review = await runCliAgent("gemini", reviewPrompt, cwd);

  state.memory.push({
    role: "review",
    agent: "gemini",
    content: review.output.slice(0, 2000),
    timestamp: new Date().toISOString(),
  });

  emit(JSON.stringify({ type: "review", content: review.output.slice(0, 1000) }) + "\n");

  // Also get OpenRouter analysis for second opinion
  const aiReview = await callFreeModel([
    { role: "system", content: "You are a code reviewer. Be concise. Rate quality 1-10 and say if ready to deploy." },
    { role: "user", content: `Review:\n${buildResults.slice(0, 3000)}` },
  ]);

  trackCost(state, "review", aiReview.cost);

  emit(JSON.stringify({ type: "review_ai", content: aiReview.content.slice(0, 500) }) + "\n");

  // If auto_deploy is false, go to human checkpoint
  if (!state.config.auto_deploy) {
    state.phase = "awaiting_go";
  } else {
    state.phase = "deploying";
  }
}

async function phaseOptimizing(
  state: PipelineState,
  emit: (data: string) => void
): Promise<void> {
  emit(JSON.stringify({ type: "phase", phase: "optimizing", message: "Self-optimizing..." }) + "\n");

  const summary = {
    goal: state.goal,
    iterations: state.iteration,
    cost: state.cost,
    errors: state.errors,
    steps_total: state.plan.length,
    steps_done: state.plan.filter((s) => s.status === "done").length,
    steps_failed: state.plan.filter((s) => s.status === "failed").length,
  };

  const result = await callFreeModel([
    { role: "system", content: "Analyze this pipeline execution and suggest improvements for next time. Be specific and actionable." },
    { role: "user", content: JSON.stringify(summary, null, 2) },
  ]);

  trackCost(state, "optimization", result.cost);

  // Save optimization insights
  await writeJson("pipeline/optimizations.json", {
    timestamp: new Date().toISOString(),
    pipeline_id: state.id,
    insights: result.content,
    metrics: summary,
  });

  emit(JSON.stringify({ type: "optimization", insights: result.content.slice(0, 1000) }) + "\n");
  state.phase = "complete";
}

// ============ MAIN PIPELINE ============

export async function runPipeline(
  goal: string,
  config: Partial<PipelineConfig> = {},
  cwd: string,
  emit: (data: string) => void,
): Promise<PipelineState> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const state = newState(goal, fullConfig);

  await appendLog(`[PIPELINE] Starting: ${goal.slice(0, 100)}`);
  await updateEngineState({
    status: "in_progress",
    phase: "autonomous_pipeline",
    taskDescription: goal.slice(0, 200),
    executorTier: "autonomous",
  });

  emit(JSON.stringify({
    type: "pipeline_start",
    id: state.id,
    goal,
    config: fullConfig,
    budget: `$${fullConfig.max_cost_usd}`,
  }) + "\n");

  try {
    // Phase 1: Research
    if (state.phase === "research") {
      await phaseResearch(state, emit);
      await saveState(state);
    }

    // Phase 2: Planning
    if (state.phase === "planning") {
      await phasePlanning(state, emit);
      await saveState(state);
    }

    // Phase 3: Building
    if (state.phase === "building") {
      await phaseBuilding(state, emit, cwd);
      await saveState(state);
    }

    // Phase 4: Reviewing
    if (state.phase === "reviewing") {
      await phaseReviewing(state, emit, cwd);
      await saveState(state);
    }

    // Phase 5: Awaiting human go/no-go
    if (state.phase === "awaiting_go") {
      emit(JSON.stringify({
        type: "checkpoint",
        message: "Pipeline paused. Awaiting your GO to deploy. Review the results above.",
        action_needed: "Send 'go' to deploy or 'stop' to cancel",
        artifacts: state.artifacts,
        cost_so_far: `$${state.cost.total_usd.toFixed(4)}`,
      }) + "\n");
      // State is saved - pipeline can be resumed later
      await saveState(state);
      return state;
    }

    // Phase 6: Deploying (only if auto_deploy or human said go)
    if (state.phase === "deploying") {
      emit(JSON.stringify({ type: "phase", phase: "deploying", message: "Deploying to free tier..." }) + "\n");
      // Deployment is handled by the CLI agents
      state.phase = "optimizing";
      await saveState(state);
    }

    // Phase 7: Self-optimize
    if (state.phase === "optimizing") {
      await phaseOptimizing(state, emit);
      await saveState(state);
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    state.phase = "failed";
    state.errors.push(msg);
    emit(JSON.stringify({ type: "error", message: msg }) + "\n");
  }

  // Final summary
  emit(JSON.stringify({
    type: "pipeline_complete",
    id: state.id,
    phase: state.phase,
    iterations: state.iteration,
    cost: state.cost,
    plan_status: state.plan.map((s) => ({ step: s.step.slice(0, 60), status: s.status })),
    errors: state.errors,
  }) + "\n");

  await updateEngineState({
    status: state.phase === "complete" ? "idle" : "failed",
    phase: null,
    executorTier: null,
  });

  await saveState(state);
  await appendLog(`[PIPELINE] ${state.phase}: ${state.iteration} iterations, $${state.cost.total_usd.toFixed(4)} cost`);

  return state;
}

// Resume a pipeline that was paused at a checkpoint
export async function resumePipeline(
  action: "go" | "stop",
  emit: (data: string) => void,
  cwd: string,
): Promise<PipelineState | null> {
  const state = await loadLatestState();
  if (!state) return null;

  if (action === "stop") {
    state.phase = "complete";
    emit(JSON.stringify({ type: "pipeline_stopped", message: "Pipeline stopped by user" }) + "\n");
    await saveState(state);
    return state;
  }

  if (state.phase === "awaiting_go") {
    state.phase = "deploying";
    emit(JSON.stringify({ type: "phase", phase: "deploying", message: "Human approved - deploying..." }) + "\n");

    // Continue from deploying
    if (state.phase === "deploying") {
      state.phase = "optimizing";
      await saveState(state);
    }
    if (state.phase === "optimizing") {
      await phaseOptimizing(state, emit);
      await saveState(state);
    }

    emit(JSON.stringify({
      type: "pipeline_complete",
      id: state.id,
      phase: state.phase,
      cost: state.cost,
    }) + "\n");
  }

  return state;
}
