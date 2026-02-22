import { NextResponse } from "next/server";
import { getOpportunities, getRevenueTracker } from "@/app/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [opportunities, tracker] = await Promise.all([
    getOpportunities(),
    getRevenueTracker(),
  ]);
  return NextResponse.json({ opportunities, tracker });
}
