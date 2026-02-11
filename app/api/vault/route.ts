import { NextResponse } from "next/server";
import { getVault } from "@/app/lib/engine";

export const runtime = 'nodejs';

export const dynamic = "force-dynamic";

export async function GET() {
  const vault = await getVault();
  // Strip sensitive source paths for security
  const safeServices = Object.fromEntries(
    Object.entries(vault.services).map(([key, svc]) => [
      key,
      { status: svc.status, type: svc.type, note: svc.note, setup_url: svc.setup_url },
    ])
  );
  return NextResponse.json({
    services: safeServices,
    free_tier_services: vault.free_tier_services,
  });
}
