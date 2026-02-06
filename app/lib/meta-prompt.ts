/**
 * AIXI-Inspired Self-Improving Meta-Prompting System
 *
 * Based on AIXI universal intelligence principles:
 * - Maintains a model of prompt effectiveness
 * - Continuously improves prompts based on outcomes
 * - Maximizes expected reward (task completion quality)
 * - Always operates in the user's best interest
 *
 * The system tracks every prompt sent to agents, scores outcomes,
 * and evolves prompt templates to extract maximum performance.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { homedir } from "os";

const HOME = process.env.USERPROFILE || homedir();
const META_DIR = join(HOME, ".autonomous-engine", "meta-prompts");

// ======= TYPES =======

export interface PromptTemplate {
  id: string;
  name: string;
  category: "plan" | "execute" | "review" | "debug" | "evolve" | "research";
  template: string;
  variables: string[];
  score: number;           // 0-100 effectiveness score
  uses: number;            // times used
  successes: number;       // times led to good outcome
  failures: number;        // times led to bad outcome
  avgQuality: number;      // average quality of outputs (0-10)
  lastUsed: string;        // ISO date
  evolved: number;         // times this template has been evolved
  parentId: string | null; // template it evolved from
}

export interface PromptOutcome {
  templateId: string;
  timestamp: string;
  success: boolean;
  quality: number;    // 0-10 quality score
  exitCode: number;
  outputLength: number;
  errorLength: number;
  taskType: string;
  feedback?: string;
}

export interface MetaPromptState {
  version: string;
  totalPrompts: number;
  totalEvolutions: number;
  avgScore: number;
  templates: PromptTemplate[];
  outcomes: PromptOutcome[];
  principles: string[];
}

// ======= CORE PRINCIPLES (Always in user's interest) =======

const CORE_PRINCIPLES = [
  "MAXIMIZE task completion quality - extract the best possible output",
  "MINIMIZE wasted tokens - be concise and precise",
  "ALWAYS include structured output format for parseable responses",
  "ALWAYS provide context about the system architecture and goals",
  "NEVER include harmful, expensive, or risky instructions",
  "ADAPT prompts based on which agent (Claude/Gemini/OpenClaw) performs best with which style",
  "EVOLVE toward brevity when verbose prompts don't improve quality",
  "EVOLVE toward specificity when vague prompts produce bad results",
  "INCLUDE acceptance criteria so output quality can be verified",
  "CHAIN prompts in sequences where each step refines the previous",
];

// ======= DEFAULT TEMPLATES =======

const DEFAULT_TEMPLATES: Omit<PromptTemplate, "id">[] = [
  {
    name: "architect-plan",
    category: "plan",
    template: `You are an expert software architect working on behalf of the user. Your goal is to create the BEST possible plan.

CONTEXT: {context}
TASK: {task}
EXISTING CODE: {codebase}

Create a step-by-step implementation plan:
1. List ALL files to create/modify with exact paths
2. For each file, describe the code structure
3. List dependencies needed
4. Define testable acceptance criteria
5. Identify potential risks and mitigations

Output format: Numbered steps with sub-items. Be specific, not vague.
Quality target: Production-ready plan that a junior developer could follow.`,
    variables: ["context", "task", "codebase"],
    score: 75,
    uses: 0,
    successes: 0,
    failures: 0,
    avgQuality: 0,
    lastUsed: "",
    evolved: 0,
    parentId: null,
  },
  {
    name: "executor-code",
    category: "execute",
    template: `You are a senior developer. Write complete, production-ready code.

TASK: {task}
PLAN: {plan}
REVIEW FEEDBACK: {feedback}

Requirements:
- Write ALL code completely - no placeholders, no "..."
- Follow existing project patterns
- Handle errors gracefully
- Use TypeScript strict mode compatible code
- Add brief inline comments only where logic is non-obvious

Output: Complete file contents ready to save. No markdown fences unless showing a file.`,
    variables: ["task", "plan", "feedback"],
    score: 75,
    uses: 0,
    successes: 0,
    failures: 0,
    avgQuality: 0,
    lastUsed: "",
    evolved: 0,
    parentId: null,
  },
  {
    name: "reviewer-validate",
    category: "review",
    template: `You are a thorough code reviewer. Your job is quality assurance.

TASK: {task}
CODE OUTPUT: {code}
ACCEPTANCE CRITERIA: {criteria}

Review checklist:
1. Architecture (1-10): Does it fit the system design?
2. Security (1-10): Any vulnerabilities? (XSS, injection, secrets exposure)
3. Code Quality (1-10): Clean, maintainable, follows conventions?
4. Completeness (1-10): All acceptance criteria met?
5. Performance (1-10): Any obvious bottlenecks?

If ALL scores >= 7, output "APPROVED" at the end.
If any score < 7, list specific fixes needed.
Be constructive - suggest exact code changes, not vague feedback.`,
    variables: ["task", "code", "criteria"],
    score: 75,
    uses: 0,
    successes: 0,
    failures: 0,
    avgQuality: 0,
    lastUsed: "",
    evolved: 0,
    parentId: null,
  },
  {
    name: "debugger-fix",
    category: "debug",
    template: `You are a debugging specialist. Analyze and fix errors.

ORIGINAL TASK: {task}
ERROR OUTPUT: {error}
RELEVANT CODE: {code}

Debugging protocol:
1. Identify the root cause (not just symptoms)
2. Explain WHY the error occurred
3. Provide the EXACT fix (complete corrected code)
4. Add a regression prevention note

Output the fixed code completely - no partial fixes.`,
    variables: ["task", "error", "code"],
    score: 75,
    uses: 0,
    successes: 0,
    failures: 0,
    avgQuality: 0,
    lastUsed: "",
    evolved: 0,
    parentId: null,
  },
  {
    name: "meta-evolve",
    category: "evolve",
    template: `You are a prompt optimization specialist using AIXI-inspired principles.

CURRENT TEMPLATE:
{template}

PERFORMANCE DATA:
- Score: {score}/100
- Uses: {uses}, Successes: {successes}, Failures: {failures}
- Average quality: {avgQuality}/10

RECENT OUTCOMES:
{outcomes}

CORE PRINCIPLES:
{principles}

Evolve this prompt template to improve its effectiveness:
1. Analyze what worked and what didn't
2. Identify patterns in successful vs failed uses
3. Rewrite the template to maximize quality
4. Keep the same variable slots: {variables}

Output ONLY the improved template text. No explanations.`,
    variables: ["template", "score", "uses", "successes", "failures", "avgQuality", "outcomes", "principles", "variables"],
    score: 80,
    uses: 0,
    successes: 0,
    failures: 0,
    avgQuality: 0,
    lastUsed: "",
    evolved: 0,
    parentId: null,
  },
];

// ======= STATE MANAGEMENT =======

async function ensureDir(): Promise<void> {
  if (!existsSync(META_DIR)) await mkdir(META_DIR, { recursive: true });
}

export async function getMetaState(): Promise<MetaPromptState> {
  await ensureDir();
  const statePath = join(META_DIR, "state.json");
  try {
    if (existsSync(statePath)) {
      return JSON.parse(await readFile(statePath, "utf-8"));
    }
  } catch { /* fall through */ }

  // Initialize with defaults
  const templates = DEFAULT_TEMPLATES.map((t, i) => ({
    ...t,
    id: `tpl_${i}_${Date.now()}`,
  }));

  const state: MetaPromptState = {
    version: "1.0.0",
    totalPrompts: 0,
    totalEvolutions: 0,
    avgScore: 75,
    templates,
    outcomes: [],
    principles: CORE_PRINCIPLES,
  };

  await saveMetaState(state);
  return state;
}

async function saveMetaState(state: MetaPromptState): Promise<void> {
  await ensureDir();
  const statePath = join(META_DIR, "state.json");
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
}

// ======= PROMPT GENERATION =======

export async function getBestTemplate(category: PromptTemplate["category"]): Promise<PromptTemplate> {
  const state = await getMetaState();
  const templates = state.templates.filter((t) => t.category === category);
  if (templates.length === 0) {
    // Fallback to first matching default
    const def = DEFAULT_TEMPLATES.find((t) => t.category === category);
    return { ...(def || DEFAULT_TEMPLATES[0]), id: `fallback_${Date.now()}` } as PromptTemplate;
  }
  // Select by score (exploitation) with occasional exploration
  const explore = Math.random() < 0.1; // 10% exploration rate
  if (explore) {
    return templates[Math.floor(Math.random() * templates.length)];
  }
  return templates.sort((a, b) => b.score - a.score)[0];
}

export function fillTemplate(template: PromptTemplate, vars: Record<string, string>): string {
  let result = template.template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value || "");
  }
  return result;
}

export async function generatePrompt(
  category: PromptTemplate["category"],
  vars: Record<string, string>
): Promise<{ prompt: string; templateId: string }> {
  const template = await getBestTemplate(category);
  const prompt = fillTemplate(template, vars);

  // Update usage
  const state = await getMetaState();
  const tpl = state.templates.find((t) => t.id === template.id);
  if (tpl) {
    tpl.uses++;
    tpl.lastUsed = new Date().toISOString();
    state.totalPrompts++;
    await saveMetaState(state);
  }

  return { prompt, templateId: template.id };
}

// ======= OUTCOME RECORDING =======

export async function recordOutcome(outcome: PromptOutcome): Promise<void> {
  const state = await getMetaState();

  // Record the outcome
  state.outcomes.push(outcome);
  // Keep last 100 outcomes
  if (state.outcomes.length > 100) {
    state.outcomes = state.outcomes.slice(-100);
  }

  // Update template scores
  const tpl = state.templates.find((t) => t.id === outcome.templateId);
  if (tpl) {
    if (outcome.success) {
      tpl.successes++;
    } else {
      tpl.failures++;
    }

    // Update average quality
    const totalOutcomes = tpl.successes + tpl.failures;
    tpl.avgQuality = totalOutcomes > 0
      ? ((tpl.avgQuality * (totalOutcomes - 1)) + outcome.quality) / totalOutcomes
      : outcome.quality;

    // Recalculate score: weighted combination
    const successRate = totalOutcomes > 0 ? (tpl.successes / totalOutcomes) * 100 : 50;
    const qualityScore = tpl.avgQuality * 10;
    tpl.score = Math.round(successRate * 0.6 + qualityScore * 0.4);
  }

  // Update global average
  const allScores = state.templates.map((t) => t.score);
  state.avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

  await saveMetaState(state);
}

// ======= SELF-EVOLUTION =======

export async function shouldEvolve(templateId: string): Promise<boolean> {
  const state = await getMetaState();
  const tpl = state.templates.find((t) => t.id === templateId);
  if (!tpl) return false;

  const totalOutcomes = tpl.successes + tpl.failures;
  // Evolve if: enough data AND score is below average OR hasn't been evolved recently
  return (
    totalOutcomes >= 3 && (tpl.score < state.avgScore || tpl.evolved === 0)
  );
}

export async function evolveTemplate(templateId: string): Promise<PromptTemplate | null> {
  const state = await getMetaState();
  const tpl = state.templates.find((t) => t.id === templateId);
  if (!tpl) return null;

  // Get outcomes for this template
  const relevantOutcomes = state.outcomes
    .filter((o) => o.templateId === templateId)
    .slice(-10)
    .map((o) => `- ${o.success ? "SUCCESS" : "FAIL"} (quality: ${o.quality}/10, exit: ${o.exitCode})`)
    .join("\n");

  // Generate the meta-evolution prompt
  const metaTemplate = await getBestTemplate("evolve");
  const evolvePrompt = fillTemplate(metaTemplate, {
    template: tpl.template,
    score: String(tpl.score),
    uses: String(tpl.uses),
    successes: String(tpl.successes),
    failures: String(tpl.failures),
    avgQuality: String(tpl.avgQuality.toFixed(1)),
    outcomes: relevantOutcomes || "No outcomes yet",
    principles: state.principles.join("\n"),
    variables: tpl.variables.join(", "),
  });

  return {
    ...tpl,
    template: evolvePrompt, // This is the prompt to send to an agent for evolution
  };
}

export async function applyEvolution(templateId: string, newTemplate: string): Promise<void> {
  const state = await getMetaState();
  const oldTpl = state.templates.find((t) => t.id === templateId);
  if (!oldTpl) return;

  // Create new evolved template (keep old one for comparison)
  const newId = `tpl_evolved_${Date.now()}`;
  const evolvedTpl: PromptTemplate = {
    ...oldTpl,
    id: newId,
    template: newTemplate,
    score: oldTpl.score + 5, // Small initial boost
    uses: 0,
    successes: 0,
    failures: 0,
    avgQuality: 0,
    evolved: oldTpl.evolved + 1,
    parentId: templateId,
    lastUsed: "",
  };

  state.templates.push(evolvedTpl);
  state.totalEvolutions++;
  oldTpl.evolved++;

  // Prune: keep max 3 templates per category
  const categories = new Set(state.templates.map((t) => t.category));
  for (const cat of categories) {
    const catTemplates = state.templates.filter((t) => t.category === cat);
    if (catTemplates.length > 3) {
      // Remove lowest scoring ones
      const sorted = catTemplates.sort((a, b) => a.score - b.score);
      const toRemove = sorted.slice(0, catTemplates.length - 3);
      state.templates = state.templates.filter((t) => !toRemove.includes(t));
    }
  }

  await saveMetaState(state);
}

// ======= API EXPORTS =======

export async function getMetaStats(): Promise<{
  totalPrompts: number;
  totalEvolutions: number;
  avgScore: number;
  templateCount: number;
  bestTemplate: { name: string; score: number; category: string } | null;
  worstTemplate: { name: string; score: number; category: string } | null;
}> {
  const state = await getMetaState();
  const sorted = [...state.templates].sort((a, b) => b.score - a.score);
  return {
    totalPrompts: state.totalPrompts,
    totalEvolutions: state.totalEvolutions,
    avgScore: state.avgScore,
    templateCount: state.templates.length,
    bestTemplate: sorted[0] ? { name: sorted[0].name, score: sorted[0].score, category: sorted[0].category } : null,
    worstTemplate: sorted.at(-1) ? { name: sorted.at(-1)!.name, score: sorted.at(-1)!.score, category: sorted.at(-1)!.category } : null,
  };
}
