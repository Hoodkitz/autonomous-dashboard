import { listModels } from "@/app/lib/openrouter";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const models = await listModels();
    return Response.json({ models, count: models.length });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
