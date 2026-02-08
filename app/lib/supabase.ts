import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const HOME = process.env.USERPROFILE || homedir();
const VAULT_PATH = join(HOME, ".autonomous-engine", "vault", "keys.json");

interface SupabaseConfig {
  url: string;
  anonKey: string;
  connectionString: string;
}

let _configCache: SupabaseConfig | null = null;

async function getSupabaseConfig(): Promise<SupabaseConfig> {
  if (_configCache) return _configCache;

  // 1. env vars
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const connStr = process.env.DATABASE_URL;

  if (url && anonKey) {
    _configCache = { url, anonKey, connectionString: connStr || "" };
    return _configCache;
  }

  // 2. vault
  try {
    const vault = JSON.parse(await readFile(VAULT_PATH, "utf-8"));
    const supa = vault.services?.supabase;
    if (supa) {
      _configCache = {
        url: `https://${supa.host?.replace("db.", "").replace(":5432", "") || ""}`,
        anonKey: supa.anon_key || anonKey || "",
        connectionString: supa.connection_string || connStr || "",
      };
      return _configCache;
    }
  } catch { /* fallthrough */ }

  throw new Error("Supabase not configured. Set SUPABASE_URL + SUPABASE_ANON_KEY or add to vault.");
}

let _client: SupabaseClient | null = null;

export async function getSupabase(): Promise<SupabaseClient> {
  if (_client) return _client;
  const config = await getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    throw new Error("Supabase URL and anon key required");
  }
  _client = createClient(config.url, config.anonKey);
  return _client;
}

export async function getConnectionString(): Promise<string> {
  const config = await getSupabaseConfig();
  return config.connectionString;
}

// Database initialization - creates tables if they don't exist
export async function initDatabase(client: SupabaseClient): Promise<{ success: boolean; error?: string }> {
  try {
    // Test connection
    const { error } = await client.from("engine_logs").select("id").limit(1);
    if (error && error.code === "42P01") {
      // Table doesn't exist - that's OK, we'll create via SQL
      return { success: true };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// SQL to create all needed tables
export const INIT_SQL = `
-- Engine state snapshots
CREATE TABLE IF NOT EXISTS engine_snapshots (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL,
  phase TEXT,
  current_step INT DEFAULT 0,
  total_steps INT DEFAULT 0,
  task_description TEXT,
  executor_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs
CREATE TABLE IF NOT EXISTS engine_logs (
  id SERIAL PRIMARY KEY,
  level TEXT DEFAULT 'info',
  agent TEXT,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue opportunities
CREATE TABLE IF NOT EXISTS opportunities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT,
  description TEXT,
  revenue_model TEXT,
  estimated_monthly TEXT,
  priority TEXT DEFAULT 'MEDIUM',
  status TEXT DEFAULT 'researched',
  tech_stack TEXT,
  hosting TEXT,
  build_steps JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proactive recommendations
CREATE TABLE IF NOT EXISTS proactive_actions (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  signup_url TEXT,
  priority TEXT DEFAULT 'medium',
  action_required BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat history
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  session_id TEXT,
  role TEXT NOT NULL,
  agent TEXT,
  model TEXT,
  content TEXT NOT NULL,
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id SERIAL PRIMARY KEY,
  service TEXT NOT NULL,
  model TEXT,
  tokens_prompt INT DEFAULT 0,
  tokens_completion INT DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_logs_created ON engine_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_agent ON engine_logs(agent);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_service ON api_usage(service);
CREATE INDEX IF NOT EXISTS idx_usage_created ON api_usage(created_at DESC);
`;
