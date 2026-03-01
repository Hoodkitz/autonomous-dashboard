export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { getApiKey, chatCompletion, type ChatMessage } from "@/app/lib/openrouter";
import { appendLog } from "@/app/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ChatBody {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.model || !body.messages?.length) {
    return Response.json({ error: "model and messages required" }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = await getApiKey();
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  await appendLog(`[OPENROUTER] Chat: model=${body.model}, msgs=${body.messages.length}`);

  try {
    const upstream = await chatCompletion(apiKey, {
      model: body.model,
      messages: body.messages,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      stream: true,
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      await appendLog(`[OPENROUTER] Error ${upstream.status}: ${errText.slice(0, 200)}`);
      return Response.json({ error: errText }, { status: upstream.status });
    }

    // Pipe the SSE stream through to the client
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstream.body!.getReader();

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;

          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                controller.enqueue(encoder.encode(
                  JSON.stringify({ type: "content", data: delta.content }) + "\n"
                ));
              }
              if (parsed.choices?.[0]?.finish_reason) {
                controller.enqueue(encoder.encode(
                  JSON.stringify({
                    type: "done",
                    finish_reason: parsed.choices[0].finish_reason,
                    usage: parsed.usage || null,
                    id: parsed.id,
                  }) + "\n"
                ));
              }
            } catch {
              // Forward raw line
              controller.enqueue(encoder.encode(
                JSON.stringify({ type: "raw", data }) + "\n"
              ));
            }
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendLog(`[OPENROUTER] Error: ${msg}`);
    return Response.json({ error: msg }, { status: 500 });
  }
}
