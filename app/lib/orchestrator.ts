
import { getApiKey, chatCompletion, type ChatMessage } from "./openrouter";
import { appendLog } from "./engine";

// All available capabilities the orchestrator can use
export interface Capability {
  id: string;
  name: string;
  type: "cli_agent" | "api_model" | "skill" | "tool";
  strengths: string[];
  speed: "fast" | "medium" | "slow";
  cost: "free" | "cheap" | "paid";
  available: boolean;
}

export const CAPABILITIES: Capability[] = [
  // CLI Agents
  { id: "claude", name: "Claude CLI", type: "cli_agent", strengths: ["coding", "architecture", "debugging", "full-stack"], speed: "medium", cost: "free", available: true },
  { id: "gemini", name: "Gemini CLI", type: "cli_agent", strengths: ["review", "research", "analysis", "web-search"], speed: "medium", cost: "free", available: true },
  { id: "openclaw", name: "OpenClaw", type: "cli_agent", strengths: ["multi-platform", "messaging", "discord", "telegram"], speed: "fast", cost: "free", available: true },

  // OpenRouter Free Models
  { id: "or:google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (OR)", type: "api_model", strengths: ["fast-reasoning", "general", "coding"], speed: "fast", cost: "free", available: true },
  { id: "or:meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (OR)", type: "api_model", strengths: ["general", "instruction-following", "creative"], speed: "fast", cost: "free", available: true },
  { id: "or:qwen/qwen-2.5-72b-instruct:free", name: "Qwen 2.5 72B (OR)", type: "api_model", strengths: ["coding", "math", "multilingual"], speed: "fast", cost: "free", available: true },
  { id: "or:deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3 (OR)", type: "api_model", strengths: ["coding", "reasoning", "analysis"], speed: "fast", cost: "free", available: true },
  { id: "or:mistralai/mistral-small-3.1-24b-instruct:free", name: "Mistral Small 3.1 (OR)", type: "api_model", strengths: ["fast", "efficient", "european"], speed: "fast", cost: "free", available: true },

  // OpenRouter Premium Models
  { id: "or:anthropic/claude-sonnet-4", name: "Claude Sonnet 4 (OR)", type: "api_model", strengths: ["coding", "reasoning", "safety", "analysis"], speed: "medium", cost: "paid", available: true },
  { id: "or:openai/gpt-4o", name: "GPT-4o (OR)", type: "api_model", strengths: ["general", "multimodal", "creative"], speed: "medium", cost: "paid", available: true },
  { id: "or:google/gemini-2.5-pro-preview", name: "Gemini 2.5 Pro (OR)", type: "api_model", strengths: ["reasoning", "coding", "long-context"], speed: "medium", cost: "paid", available: true },
  { id: "or:deepseek/deepseek-r1", name: "DeepSeek R1 (OR)", type: "api_model", strengths: ["deep-reasoning", "math", "logic"], speed: "slow", cost: "paid", available: true },
];

export interface OrchestratorTask {
  goal: string;
  context?: string;
  prefer_free?: boolean;
  max_steps?: number;
}

export interface StepResult {
  step: number;
  agent: string;
  action: string;
  result: string;
  success: boolean;
  duration_ms: number;
}

// Run a CLI agent and return its output
export async function runCliAgent(agent: string, prompt: string, cwd: string): Promise<{ output: string; error: string; code: number }> {
  const commands: Record<string, { cmd: string; args: (p: string) => string[] }> = {
    claude: { cmd: "claude", args: (p) => ["--print", "--dangerously-skip-permissions", p] },
    gemini: { cmd: "gemini", args: (p) => ["-p", p] },
    openclaw: { cmd: "openclaw", args: (p) => ["agent", "--local", "--json", "--message", p] },
  };

  const config = commands[agent];
  if (!config) return { output: "", error: `Unknown CLI agent: ${agent}`, code: 1 };

  try {
    const { spawn } = await import("child_process");
    return new Promise((resolve) => {
      let output = "";
      let error = "";
      const child = spawn(config.cmd, config.args(prompt), {
        cwd, shell: true,
        env: { ...process.env, FORCE_COLOR: "0" },
      });
      child.stdout?.on("data", (c: Buffer) => { output += c.toString(); });
      child.stderr?.on("data", (c: Buffer) => { error += c.toString(); });
      child.on("close", (code) => resolve({ output, error, code: code || 0 }));
      child.on("error", (err) => resolve({ output, error: err.message, code: 1 }));
    });
  } catch {
    return { output: "", error: "child_process not available", code: 1 };
  }
}

// Run an OpenRouter model
export async function runOpenRouterModel(modelId: string, messages: ChatMessage[]): Promise<{ output: string; error: string; success: boolean }> {
  try {
    const apiKey = await getApiKey();
    const response = await chatCompletion(apiKey, {
      model: modelId.replace("or:", ""),
      messages,
      stream: false,
    });

    if (!response.ok) {
      const err = await response.text();
      return { output: "", error: `OpenRouter ${response.status}: ${err.slice(0, 500)}`, success: false };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    return { output: content, error: "", success: true };
  } catch (err) {
    return { output: "", error: err instanceof Error ? err.message : String(err), success: false };
  }
}

// The Planning AI - uses a free model to plan the optimal execution strategy
export async function planExecution(task: OrchestratorTask): Promise<{ steps: Array<{ agent_id: string; action: string; prompt: string }> }> {
  const capList = CAPABILITIES
    .filter((c) => task.prefer_free !== false ? c.cost === "free" : true)
    .map((c) => `- ${c.id} (${c.type}): ${c.strengths.join(", ")} [${c.speed}, ${c.cost}]`)
    .join("\n");

  const planPrompt = `You are an AI orchestrator planner. Given a goal and available agents, create an optimal execution plan.

AVAILABLE AGENTS:
${capList}

GOAL: ${task.goal}
${task.context ? `CONTEXT: ${task.context}` : ""}

Create a plan with 2-6 steps. Each step should use the best agent for that subtask.
Prefer free agents unless paid ones are clearly needed.
Use multiple different agents to leverage their unique strengths.

Respond ONLY with valid JSON:
{
  "steps": [
    { "agent_id": "agent-id-from-list", "action": "what to do", "prompt": "exact prompt for the agent" }
  ]
}`;

  const result = await runOpenRouterModel("or:google/gemini-2.0-flash-exp:free", [
    { role: "system", content: "You are an AI orchestrator planner. Always respond with valid JSON only." },
    { role: "user", content: planPrompt },
  ]);

  if (!result.success) {
    // Fallback: simple 2-step plan
    return {
      steps: [
        { agent_id: "claude", action: "Execute task", prompt: task.goal },
        { agent_id: "gemini", action: "Review result", prompt: `Review the following task execution and suggest improvements:\n\nTask: ${task.goal}` },
      ],
    };
  }

  try {
    const jsonMatch = result.output.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fallback */ }

  return {
    steps: [
      { agent_id: "claude", action: "Execute task", prompt: task.goal },
    ],
  };
}

// Execute a single step
export async function executeStep(
  step: { agent_id: string; action: string; prompt: string },
  cwd: string,
  onStream: (data: string) => void,
): Promise<StepResult> {
  const start = Date.now();
  const cap = CAPABILITIES.find((c) => c.id === step.agent_id);

  await appendLog(`[ORCHESTRATOR] Step: ${step.action} via ${step.agent_id}`);
  onStream(JSON.stringify({ type: "step_start", agent: step.agent_id, action: step.action }) + "\n");

  let result: { output: string; error: string; success: boolean };

  if (cap?.type === "cli_agent") {
    const r = await runCliAgent(step.agent_id, step.prompt, cwd);
    result = { output: r.output, error: r.error, success: r.code === 0 };
  } else if (cap?.type === "api_model") {
    result = await runOpenRouterModel(step.agent_id, [
      { role: "user", content: step.prompt },
    ]);
  } else {
    result = { output: "", error: `Unknown capability: ${step.agent_id}`, success: false };
  }

  const duration = Date.now() - start;

  onStream(JSON.stringify({
    type: "step_result",
    agent: step.agent_id,
    action: step.action,
    output: result.output.slice(0, 5000),
    error: result.error.slice(0, 1000),
    success: result.success,
    duration_ms: duration,
  }) + "\n");

  return {
    step: 0,
    agent: step.agent_id,
    action: step.action,
    result: result.output,
    success: result.success,
    duration_ms: duration,
  };
}

// Self-optimization: analyze results and improve
export async function selfOptimize(
  goal: string,
  results: StepResult[],
  onStream: (data: string) => void,
): Promise<string> {
  const summary = results.map((r, i) =>
    `Step ${i + 1} [${r.agent}]: ${r.action} - ${r.success ? "SUCCESS" : "FAILED"} (${r.duration_ms}ms)`
  ).join("\n");

  const optimizeResult = await runOpenRouterModel("or:deepseek/deepseek-chat-v3-0324:free", [
    { role: "system", content: "You are a self-optimization module. Analyze execution results, identify improvements, and suggest optimizations. Be concise and actionable." },
    { role: "user", content: `Goal: ${goal}\n\nExecution Results:\n${summary}\n\nAnalyze: What worked? What failed? How to improve next time? Any new possibilities discovered?` },
  ]);

  onStream(JSON.stringify({
    type: "optimization",
    analysis: optimizeResult.output.slice(0, 3000),
  }) + "\n");

  return optimizeResult.output;
}
