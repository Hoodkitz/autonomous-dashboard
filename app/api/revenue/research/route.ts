import { NextRequest } from "next/server";
import { getApiKey, chatCompletion } from "@/app/lib/openrouter";
import { appendLog, writeJson, getOpportunities, getVault } from "@/app/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const RESEARCH_PROMPT = `You are an autonomous AI revenue research engine. Your job is to find CONCRETE ways to make money using AI agents, automation, and SaaS tools.

The user has these existing assets:
- Autonomous Dashboard (Next.js 16, running)
- OpenRouter API key (300+ AI models)
- Claude Code CLI (full development capability)
- Gemini CLI (research + review)
- OpenClaw gateway (Discord/Telegram/WhatsApp bots)
- 50+ agent skills installed
- memUbot Discord bot
- agent-memory Python system
- All deployed on Windows server

Rules:
- ONLY suggest things that can be built with FREE tiers
- MUST be monetizable within 1-4 weeks
- Focus on AI/automation SaaS products (highest demand right now)
- Each idea must include: name, revenue model, estimated monthly, tech stack, free hosting option, build steps
- Be SPECIFIC and ACTIONABLE, not vague

Current market trends to consider:
- AI agents as a service (huge demand)
- AI-powered automation tools
- Custom GPTs / AI chatbots for businesses
- AI content generation tools
- AI-powered analytics dashboards
- WhatsApp/Telegram business bots
- AI coding assistants

Respond with valid JSON:
{
  "opportunities": [
    {
      "rank": 1,
      "name": "Product Name",
      "type": "saas|bot-service|marketplace|tool|course",
      "description": "What it does",
      "revenue_model": "subscription|freemium|one-time|commission",
      "estimated_monthly": "$X-$Y",
      "build_time": "X days",
      "tech_stack": "tech used",
      "hosting": "free tier host",
      "build_steps": ["step 1", "step 2", ...],
      "existing_assets_used": ["asset1", "asset2"],
      "market_gap": "Why this opportunity exists",
      "competitive_advantage": "What makes this unique"
    }
  ],
  "revolutionary_ideas": [
    "Any novel, undiscovered opportunities the AI has identified"
  ]
}`;

export async function POST(req: NextRequest) {
  let focus = "";
  try {
    const body = await req.json();
    focus = body.focus || "";
  } catch { /* no body */ }

  let apiKey: string;
  try {
    apiKey = await getApiKey();
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  const [vault, currentOpps] = await Promise.all([getVault(), getOpportunities()]);

  const activeServices = Object.entries(vault.services)
    .filter(([, v]) => v.status === "active")
    .map(([k]) => k);

  const contextPrompt = `${RESEARCH_PROMPT}

Active services: ${activeServices.join(", ")}
Current opportunities already identified: ${currentOpps.map(o => o.name).join(", ")}
${focus ? `User focus area: ${focus}` : "Find the BEST opportunities across all categories."}

Research deeply. Think beyond the obvious. Find opportunities others haven't seen yet.`;

  await appendLog("[REVENUE-RESEARCH] Starting autonomous research...");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));

      try {
        send(JSON.stringify({ type: "status", message: "Researching revenue opportunities with AI..." }) + "\n");

        // Use multiple models for diverse perspectives
        const models = [
          "google/gemini-2.0-flash-exp:free",
          "deepseek/deepseek-chat-v3-0324:free",
        ];

        const allOpportunities: Record<string, unknown>[] = [];
        const allRevolutionary: string[] = [];

        for (const model of models) {
          send(JSON.stringify({ type: "status", message: `Querying ${model.split("/")[1]}...` }) + "\n");

          const response = await chatCompletion(apiKey, {
            model,
            messages: [
              { role: "system", content: "You are a revenue research AI. Respond ONLY with valid JSON." },
              { role: "user", content: contextPrompt },
            ],
            stream: false,
          });

          if (!response.ok) continue;

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "";

          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.opportunities) allOpportunities.push(...parsed.opportunities);
              if (parsed.revolutionary_ideas) allRevolutionary.push(...parsed.revolutionary_ideas);
            }
          } catch { /* skip parse error */ }
        }

        // Deduplicate and rank
        const uniqueOpps = allOpportunities.reduce((acc: Record<string, unknown>[], opp: Record<string, unknown>) => {
          const name = String(opp.name || "");
          if (!acc.find((a: Record<string, unknown>) => String(a.name || "") === name)) acc.push(opp);
          return acc;
        }, []);

        // Store results
        await writeJson("revenue/research-latest.json", {
          timestamp: new Date().toISOString(),
          opportunities: uniqueOpps,
          revolutionary_ideas: [...new Set(allRevolutionary)],
          models_consulted: models,
        });

        // Also update main opportunities file with merged data
        const merged = [...currentOpps.map(o => ({ ...o }))];
        for (const opp of uniqueOpps) {
          const name = String(opp.name || "");
          if (!merged.find(m => m.name === name)) {
            merged.push({
              rank: merged.length + 1,
              name,
              type: String(opp.type || "saas"),
              description: String(opp.description || ""),
              revenue_model: String(opp.revenue_model || "freemium"),
              estimated_monthly: String(opp.estimated_monthly || "TBD"),
              build_cost: String((opp as Record<string, unknown>).build_time || "1-2 weeks"),
              tech_stack: String(opp.tech_stack || "Next.js"),
              existing_assets: ((opp as Record<string, unknown>).existing_assets_used as string[]) || [],
              hosting: String(opp.hosting || "Vercel free tier"),
              api_keys_needed: [],
              status: "researched",
              priority: "HIGH",
            });
          }
        }
        await writeJson("revenue/opportunities.json", { opportunities: merged });

        send(JSON.stringify({
          type: "result",
          opportunities: uniqueOpps,
          revolutionary_ideas: [...new Set(allRevolutionary)],
          total_found: uniqueOpps.length,
          merged_total: merged.length,
        }) + "\n");

        await appendLog(`[REVENUE-RESEARCH] Found ${uniqueOpps.length} opportunities, ${allRevolutionary.length} revolutionary ideas`);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send(JSON.stringify({ type: "error", data: msg }) + "\n");
        await appendLog(`[REVENUE-RESEARCH] Error: ${msg}`);
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
