import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const FINANCE_DIR = join(ENGINE_DIR, "finance");
const LEDGER_FILE = join(FINANCE_DIR, "ledger.json");
const CONFIG_FILE = join(FINANCE_DIR, "config.json");

interface CostEntry {
  date: string;
  category: string;
  description: string;
  amount: number; // negative = cost, positive = revenue
  currency: string;
}

interface FinanceLedger {
  updatedAt: string;
  monthlyBudget: number;
  entries: CostEntry[];
  totals: {
    totalCosts: number;
    totalRevenue: number;
    netBalance: number;
    monthCosts: number;
    monthRevenue: number;
  };
  revenueStreams: Array<{
    name: string;
    type: string;
    status: "active" | "planned" | "paused";
    monthlyEstimate: number;
    url?: string;
    deployedAt?: string;
  }>;
  costSources: Array<{
    name: string;
    type: string;
    monthlyCost: number;
    tier: "free" | "paid";
    note: string;
  }>;
  selfFinanceGoal: {
    targetMonthly: number;
    currentMonthly: number;
    selfSustaining: boolean;
    deficit: number;
  };
}

function defaultLedger(): FinanceLedger {
  return {
    updatedAt: new Date().toISOString(),
    monthlyBudget: 0,
    entries: [],
    totals: {
      totalCosts: 0,
      totalRevenue: 0,
      netBalance: 0,
      monthCosts: 0,
      monthRevenue: 0,
    },
    revenueStreams: [],
    costSources: [
      { name: "Anthropic Claude API", type: "api", monthlyCost: 0, tier: "free", note: "Claude Code subscription or credits" },
      { name: "OpenRouter", type: "api", monthlyCost: 0, tier: "free", note: "Free tier models (Gemini Flash, DeepSeek)" },
      { name: "Vercel", type: "hosting", monthlyCost: 0, tier: "free", note: "Free tier for personal projects" },
      { name: "Supabase", type: "database", monthlyCost: 0, tier: "free", note: "Free tier: 500MB database" },
      { name: "GitHub", type: "hosting", monthlyCost: 0, tier: "free", note: "Free repos and Pages" },
    ],
    selfFinanceGoal: {
      targetMonthly: 0,
      currentMonthly: 0,
      selfSustaining: true,
      deficit: 0,
    },
  };
}

async function loadLedger(): Promise<FinanceLedger> {
  try {
    const raw = await readFile(LEDGER_FILE, "utf-8");
    return { ...defaultLedger(), ...JSON.parse(raw) };
  } catch {
    return defaultLedger();
  }
}

async function saveLedger(ledger: FinanceLedger): Promise<void> {
  await mkdir(FINANCE_DIR, { recursive: true });
  ledger.updatedAt = new Date().toISOString();
  recalcTotals(ledger);
  await writeFile(LEDGER_FILE, JSON.stringify(ledger, null, 2), "utf-8");
}

function recalcTotals(ledger: FinanceLedger) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let totalCosts = 0, totalRevenue = 0, monthCosts = 0, monthRevenue = 0;
  for (const entry of ledger.entries) {
    if (entry.amount < 0) {
      totalCosts += Math.abs(entry.amount);
      if (entry.date.startsWith(monthKey)) monthCosts += Math.abs(entry.amount);
    } else {
      totalRevenue += entry.amount;
      if (entry.date.startsWith(monthKey)) monthRevenue += entry.amount;
    }
  }

  ledger.totals = {
    totalCosts,
    totalRevenue,
    netBalance: totalRevenue - totalCosts,
    monthCosts,
    monthRevenue,
  };

  // Calculate self-finance status
  const totalMonthlyCost = ledger.costSources.reduce((s, c) => s + c.monthlyCost, 0);
  const totalMonthlyRevenue = ledger.revenueStreams
    .filter((r) => r.status === "active")
    .reduce((s, r) => s + r.monthlyEstimate, 0);

  ledger.selfFinanceGoal = {
    targetMonthly: totalMonthlyCost,
    currentMonthly: totalMonthlyRevenue,
    selfSustaining: totalMonthlyRevenue >= totalMonthlyCost,
    deficit: Math.max(0, totalMonthlyCost - totalMonthlyRevenue),
  };
}

// GET: Read finance ledger and self-finance status
export async function GET() {
  const ledger = await loadLedger();
  recalcTotals(ledger);
  return Response.json(ledger);
}

// POST: Update finance data
// Actions:
//   add_cost: { action: "add_cost", category, description, amount, currency }
//   add_revenue: { action: "add_revenue", category, description, amount, currency }
//   add_stream: { action: "add_stream", name, type, status, monthlyEstimate, url }
//   remove_stream: { action: "remove_stream", index }
//   update_cost_source: { action: "update_cost_source", index, monthlyCost, tier }
//   set_budget: { action: "set_budget", amount }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ledger = await loadLedger();
  const action = body.action as string;

  if (!action) return Response.json({ error: "action required" }, { status: 400 });

  switch (action) {
    case "add_cost": {
      ledger.entries.push({
        date: new Date().toISOString().slice(0, 10),
        category: body.category || "misc",
        description: body.description || "",
        amount: -Math.abs(body.amount || 0),
        currency: body.currency || "USD",
      });
      break;
    }
    case "add_revenue": {
      ledger.entries.push({
        date: new Date().toISOString().slice(0, 10),
        category: body.category || "revenue",
        description: body.description || "",
        amount: Math.abs(body.amount || 0),
        currency: body.currency || "USD",
      });
      break;
    }
    case "add_stream": {
      ledger.revenueStreams.push({
        name: body.name || "",
        type: body.type || "saas",
        status: body.status || "planned",
        monthlyEstimate: body.monthlyEstimate || 0,
        url: body.url,
        deployedAt: body.deployedAt,
      });
      break;
    }
    case "remove_stream": {
      const idx = typeof body.index === "number" ? body.index : -1;
      if (idx >= 0 && idx < ledger.revenueStreams.length) {
        ledger.revenueStreams.splice(idx, 1);
      }
      break;
    }
    case "update_cost_source": {
      const idx = typeof body.index === "number" ? body.index : -1;
      if (idx >= 0 && idx < ledger.costSources.length) {
        if (body.monthlyCost !== undefined) ledger.costSources[idx].monthlyCost = body.monthlyCost;
        if (body.tier) ledger.costSources[idx].tier = body.tier;
        if (body.note) ledger.costSources[idx].note = body.note;
      }
      break;
    }
    case "set_budget": {
      ledger.monthlyBudget = body.amount || 0;
      break;
    }
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  await saveLedger(ledger);
  return Response.json({ ok: true, ledger });
}

export const runtime = 'nodejs';
