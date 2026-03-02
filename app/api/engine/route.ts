import { NextResponse } from "next/server";
import { getEngineState } from "@/app/lib/engine";

export const runtime = "nodejs";


export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getEngineState();
  return NextResponse.json(state);
}
