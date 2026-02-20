import { readFile, writeFile, appendFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";

const HOME = process.env.USERPROFILE || homedir();
const ENGINE_DIR = join(HOME, ".autonomous-engine");

// Optimization: Cache confirmed existing directories to avoid redundant syscalls
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
    // Optimization: Removed blocking existsSync check. Rely on try/catch.
    const data = await readFile(full, "utf-8");
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(relPath: string, data: unknown): Promise<void> {
  const full = join(ENGINE_DIR, relPath);
  const dir = dirname(full);

  // Optimization: Check cache first to avoid blocking existsSync
  if (!knownDirs.has(dir)) {
    await mkdir(dir, { recursive: true });
    knownDirs.add(dir);
  }

  try {
    await writeFile(full, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    // If directory was deleted externally, retry creation
    if ((error as { code?: string }).code === 'ENOENT') {
       await mkdir(dir, { recursive: true });
       knownDirs.add(dir);
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

  // Optimization: Check cache first
  if (!knownDirs.has(logDir)) {
    await mkdir(logDir, { recursive: true });
    knownDirs.add(logDir);
  }

  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${line}\n`;

  try {
    await appendFile(logFile, entry, "utf-8");
  } catch (error) {
     if ((error as { code?: string }).code === 'ENOENT') {
       await mkdir(logDir, { recursive: true });
       knownDirs.add(logDir);
       await appendFile(logFile, entry, "utf-8");
     } else {
       // Fallback behavior preserved from original (mostly), but using appendFile ideally
       try {
         // Original code fell back to writeFile, implying overwrite or create if append failed?
         // We'll retry appendFile. If that fails, we let it throw or handle silently?
         // Original code: catch { await writeFile(...) }
         await writeFile(logFile, entry, "utf-8");
       } catch { /* ignore */ }
     }
  }
}
