import { readFile, writeFile, appendFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";

const HOME = process.env.USERPROFILE || homedir();
const ENGINE_DIR = join(HOME, ".autonomous-engine");

// Cache for directories we've confirmed exist or created
const knownDirs = new Set<string>();

export interface EngineState {
  status: string;
  phase: string | null;
  currentStep: number;
  totalSteps: number;
  lastCheckpoint: string;
  currentStory: string | null;
  completedStories: string[];
  failedAttempts: number;
  executorTier: string | null;
  resumeInstructions: string | null;
  taskDescription: string | null;
  engineVersion: string;
  cores: Record<string, string>;
}

export interface Opportunity {
  rank: number;
  name: string;
  type: string;
  description: string;
  revenue_model: string;
  estimated_monthly: string;
  build_cost: string;
  tech_stack: string;
  existing_assets: string[];
  hosting: string;
  api_keys_needed: string[];
  status: string;
  priority: string;
}

export interface VaultData {
  services: Record<string, {
    source: string;
    status: string;
    type: string;
    note: string;
    setup_url?: string;
  }>;
  free_tier_services: Record<string, string>;
}

export interface RevenueTracker {
  totalRevenue: number;
  activeProjects: number;
  projects: Array<{ name: string; revenue: number; status: string }>;
}

async function readJson<T>(relPath: string, fallback: T): Promise<T> {
  try {
    const full = join(ENGINE_DIR, relPath);
    // Optimized: assume file exists to avoid blocking existsSync
    const data = await readFile(full, "utf-8");
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

async function ensureDir(dir: string) {
  if (knownDirs.has(dir)) return;
  await mkdir(dir, { recursive: true });
  knownDirs.add(dir);
}

export async function writeJson(relPath: string, data: unknown): Promise<void> {
  const full = join(ENGINE_DIR, relPath);
  const dir = dirname(full);

  await ensureDir(dir);

  try {
    await writeFile(full, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      // Directory might have been deleted externally
      knownDirs.delete(dir);
      await ensureDir(dir);
      await writeFile(full, JSON.stringify(data, null, 2), "utf-8");
    } else {
      throw error;
    }
  }
}

export async function getEngineState(): Promise<EngineState> {
  return readJson<EngineState>("state.json", {
    status: "offline", phase: null, currentStep: 0, totalSteps: 0,
    lastCheckpoint: new Date().toISOString(), currentStory: null,
    completedStories: [], failedAttempts: 0, executorTier: null,
    resumeInstructions: null, taskDescription: null, engineVersion: "1.0.0",
    cores: {},
  });
}

export async function updateEngineState(partial: Partial<EngineState>): Promise<EngineState> {
  const current = await getEngineState();
  const updated = { ...current, ...partial, lastCheckpoint: new Date().toISOString() };
  await writeJson("state.json", updated);
  return updated;
}

export async function getOpportunities(): Promise<Opportunity[]> {
  const data = await readJson<{ opportunities: Opportunity[] }>("revenue/opportunities.json", { opportunities: [] });
  return data.opportunities;
}

export async function getVault(): Promise<VaultData> {
  return readJson<VaultData>("vault/keys.json", { services: {}, free_tier_services: {} });
}

export async function getRevenueTracker(): Promise<RevenueTracker> {
  return readJson<RevenueTracker>("revenue/tracker.json", { totalRevenue: 0, activeProjects: 0, projects: [] });
}

export async function appendLog(line: string): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  const logDir = join(ENGINE_DIR, "progress");
  const logFile = join(logDir, `${date}.log`);

  await ensureDir(logDir);

  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${line}\n`;

  try {
    await appendFile(logFile, entry, "utf-8");
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      // Directory might have been deleted externally
      knownDirs.delete(logDir);
      await ensureDir(logDir);
      await appendFile(logFile, entry, "utf-8");
    } else {
      // Original fallback logic: try writeFile if appendFile fails
      // This handles cases where appendFile might behave unexpectedly
      try {
        await writeFile(logFile, entry, "utf-8");
      } catch {
        // Final fallback failed, suppress error
      }
    }
  }
}
