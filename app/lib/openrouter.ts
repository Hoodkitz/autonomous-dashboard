import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const HOME = process.env.USERPROFILE || homedir();
const VAULT_PATH = join(HOME, ".autonomous-engine", "vault", "keys.json");
const BASE_URL = "https://openrouter.ai/api/v1";

export async function getApiKey(): Promise<string> {
  // 1. env var
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  // 2. vault file
  try {
    const vault = JSON.parse(await readFile(VAULT_PATH, "utf-8"));
    if (vault.services?.openrouter?.key) return vault.services.openrouter.key;
  } catch { /* fallthrough */ }
  throw new Error("OpenRouter API key not configured. Set OPENROUTER_API_KEY or add to vault.");
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  pricing: { prompt: string; completion: string };
  context_length: number;
  top_provider: { max_completion_tokens: number | null };
  architecture: { tokenizer: string; modality: string };
}

export async function listModels(): Promise<OpenRouterModel[]> {
  const res = await fetch(`${BASE_URL}/models`, {
    headers: { "HTTP-Referer": "http://localhost:3000", "X-Title": "Autonomous Dashboard" },
  });
  if (!res.ok) throw new Error(`Models API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data || [];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export async function chatCompletion(apiKey: string, req: ChatRequest): Promise<Response> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream: req.stream ?? true,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens;

  return fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Autonomous Dashboard",
    },
    body: JSON.stringify(body),
  });
}

export interface UsageInfo {
  usage: number;
  limit: number | null;
  is_free_tier: boolean;
  rate_limit: { requests: number; interval: string } | null;
}

export async function getUsage(apiKey: string): Promise<UsageInfo> {
  const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Usage API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    usage: data.data?.usage ?? 0,
    limit: data.data?.limit ?? null,
    is_free_tier: data.data?.is_free_tier ?? true,
    rate_limit: data.data?.rate_limit ?? null,
  };
}

export async function getGeneration(apiKey: string, generationId: string) {
  const res = await fetch(`https://openrouter.ai/api/v1/generation?id=${generationId}`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;
  return res.json();
}
