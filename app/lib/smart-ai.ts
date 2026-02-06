/**
 * Smart AI Call - Uses the smart router for all AI calls.
 * Auto-selects best model, retries on failure, tracks usage.
 *
 * Falls back to direct OpenRouter call if smart router is unavailable.
 */

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

// Free models in priority order for direct fallback
const FALLBACK_MODELS = [
  "google/gemini-2.0-flash-001",
  "google/gemini-2.5-flash",
  "deepseek/deepseek-v3.2-20251201",
  "moonshotai/kimi-k2.5-0127",
  "x-ai/grok-4.1-fast",
  "qwen/qwen3-235b",
];

export async function smartAI(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<{ content: string; tokens: number; model: string }> {
  const { maxTokens = 4000, temperature = 0.7 } = options || {};

  // Try smart router first (internal API call)
  try {
    const port = process.env.PORT || 3000;
    const res = await fetch(`http://localhost:${port}/api/smart-router`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        content: data.content || "",
        tokens: data.tokens || 0,
        model: data.model || "smart-router",
      };
    }
  } catch {
    // Smart router unavailable, fall through to direct
  }

  // Direct fallback: try each model until one works
  if (!OPENROUTER_KEY) return { content: "ERROR: No API key", tokens: 0, model: "none" };

  for (const model of FALLBACK_MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          content: data.choices?.[0]?.message?.content || "",
          tokens: data.usage?.total_tokens || 0,
          model,
        };
      }
    } catch {
      continue; // Try next model
    }
  }

  return { content: "ERROR: All models failed", tokens: 0, model: "none" };
}
