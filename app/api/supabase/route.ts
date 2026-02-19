import { NextRequest } from "next/server";
import { INIT_SQL } from "@/app/lib/supabase";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Check Supabase connection status
export async function GET() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    return Response.json({
      connected: false,
      error: "DATABASE_URL not set",
      tables: [],
    });
  }

  try {
    // Use the Supabase REST API to check connection
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      return Response.json({
        connected: false,
        error: "SUPABASE_URL and SUPABASE_ANON_KEY required for REST API",
        database_url_set: true,
        host: connStr.match(/@([^:]+)/)?.[1] || "unknown",
      });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, key);

    // Simple health check
    const { error } = await client.from("engine_logs").select("id").limit(1);

    return Response.json({
      connected: !error || error.code === "42P01",
      tables_exist: !error,
      needs_init: error?.code === "42P01",
      host: connStr.match(/@([^:]+)/)?.[1] || "unknown",
      error: error?.message,
    });
  } catch (err) {
    return Response.json({
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// POST: Initialize database tables
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = (body as Record<string, string>).action || "init";

  if (action === "init") {
    return Response.json({
      sql: INIT_SQL,
      instructions: "Run this SQL in the Supabase SQL Editor at https://supabase.com/dashboard/project/aexnmaqvkjhcvynkekdq/sql",
      note: "Copy the SQL above and paste it into the SQL Editor, then click Run",
    });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
