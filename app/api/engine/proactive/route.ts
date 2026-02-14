export const runtime = 'nodejs';
import { NextRequest } from "next/server";
import { getApiKey, chatCompletion } from "@/app/lib/openrouter";
import { getVault, getEngineState, getOpportunities, appendLog, writeJson } from "@/app/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ProactiveAction {
  type: "api_needed" | "revenue_idea" | "improvement" | "debug_suggestion";
  title: string;
  description: string;
  signup_url?: string;
  priority: "high" | "medium" | "low";
  action_required: boolean;
}

const SYSTEM_PROMPT = `You are the Autonomous Symbiotic Engine's proactive intelligence module. Your job is to:

1. ANALYZE the current system state, vault, and opportunities
2. IDENTIFY what's missing, what can be improved, and how to make money
3. RECOMMEND specific actions with direct signup URLs for free API keys

Always respond with valid JSON array of actions. Each action:
{
  "type": "api_needed" | "revenue_idea" | "improvement" | "debug_suggestion",
  "title": "Short title",
  "description": "What to do and why",
  "signup_url": "https://... direct link to get free key (if applicable)",
  "priority": "high" | "medium" | "low",
  "action_required": true/false
}

Known free tier signup URLs:
- OpenRouter: https://openrouter.ai/settings/keys
- Supabase: https://supabase.com/dashboard (free DB + auth)
- Vercel: https://vercel.com/signup (free hosting)
- Stripe: https://dashboard.stripe.com/register (payments)
- Resend: https://resend.com/signup (free email API, 3000/mo)
- Upstash: https://console.upstash.com (free Redis + Kafka)
- Clerk: https://dashboard.clerk.com/sign-up (free auth)
- Neon: https://console.neon.tech/signup (free PostgreSQL)
- Turso: https://turso.tech (free SQLite edge DB)
- Cloudflare: https://dash.cloudflare.com/sign-up/workers (free workers)
- GitHub: https://github.com/settings/tokens (API tokens)
- Sentry: https://sentry.io/signup (free error tracking)
- PostHog: https://app.posthog.com/signup (free analytics)
- Plausible: https://plausible.io (privacy analytics)

Focus on REVENUE GENERATION first. Then self-improvement. Then debugging.
Only suggest FREE tier services. Never suggest anything that costs money upfront.
Be specific and actionable. Include exact URLs.`;

export async function POST(req: NextRequest) {
  let context = "";
  try {
    const body = await req.json();
    context = body.context || "";
  } catch { /* no body */ }

  let apiKey: string;
  try {
    apiKey = await getApiKey();
  } catch {
    return Response.json({
      actions: [{
        type: "api_needed",
        title: "OpenRouter API Key Required",
        description: "The engine needs an OpenRouter API key to use its AI-powered proactive analysis. Get a free key:",
        signup_url: "https://openrouter.ai/settings/keys",
        priority: "high",
        action_required: true,
      }],
    });
  }

  const [vault, state, opportunities] = await Promise.all([
    getVault(),
    getEngineState(),
    getOpportunities(),
  ]);

  const stateContext = JSON.stringify({
    engine_status: state.status,
    phase: state.phase,
    completed_stories: state.completedStories.length,
    active_services: Object.entries(vault.services)
      .filter(([, v]) => v.status === "active")
      .map(([k]) => k),
    missing_services: Object.entries(vault.services)
      .filter(([, v]) => v.status !== "active")
      .map(([k, v]) => ({ service: k, note: v.note, setup_url: v.setup_url })),
    opportunities_count: opportunities.length,
    top_opportunities: opportunities.slice(0, 3).map((o) => o.name),
    user_context: context,
  }, null, 2);

  await appendLog("[PROACTIVE] Running analysis...");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await chatCompletion(apiKey, {
          model: "google/gemini-2.0-flash-exp:free",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Analyze current state and recommend proactive actions:\n\n${stateContext}` },
          ],
          stream: false,
        });

        if (!response.ok) {
          const err = await response.text();
          controller.enqueue(encoder.encode(JSON.stringify({
            type: "error",
            data: `OpenRouter error: ${err.slice(0, 500)}`,
          }) + "\n"));
          controller.close();
          return;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "[]";

        // Extract JSON from response
        let actions: ProactiveAction[] = [];
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            actions = JSON.parse(jsonMatch[0]);
          }
        } catch {
          actions = [{
            type: "improvement",
            title: "Analysis Complete",
            description: content.slice(0, 500),
            priority: "medium",
            action_required: false,
          }];
        }

        // Store recommendations
        await writeJson("proactive/latest.json", {
          timestamp: new Date().toISOString(),
          actions,
        });

        controller.enqueue(encoder.encode(JSON.stringify({
          type: "result",
          actions,
          timestamp: new Date().toISOString(),
        }) + "\n"));

        await appendLog(`[PROACTIVE] Found ${actions.length} actions`);
      } catch (err) {
        controller.enqueue(encoder.encode(JSON.stringify({
          type: "error",
          data: err instanceof Error ? err.message : String(err),
        }) + "\n"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

export async function GET() {
  // Return latest proactive scan results
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const { homedir } = await import("os");
    const HOME = process.env.USERPROFILE || homedir();
    const path = join(HOME, ".autonomous-engine", "proactive", "latest.json");
    const data = JSON.parse(await readFile(path, "utf-8"));
    return Response.json(data);
  } catch {
    return Response.json({ actions: [], timestamp: null });
  }
}
