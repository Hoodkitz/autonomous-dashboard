import { getApiKey, getUsage } from "@/app/lib/openrouter";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apiKey = await getApiKey();
    const usage = await getUsage(apiKey);
    return Response.json(usage);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
