import { NextResponse } from "next/server";
import { getEngineState } from "@/app/lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getEngineState();
  return NextResponse.json(state);
}

export const runtime = 'nodejs';
