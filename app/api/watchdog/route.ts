import { existsSync } from "fs";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const HOME = process.env.USERPROFILE || homedir();
const STOP_FILE = join(HOME, "autonomous-dashboard", "scripts", ".watchdog-stop");

// GET: Check watchdog status
export async function GET() {
  const stopped = existsSync(STOP_FILE);
  return Response.json({
    active: !stopped,
    status: stopped ? "stopped_by_user" : "active",
    stop_file: STOP_FILE,
  });
}

// POST: Start or stop watchdog
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { action } = body as { action?: "stop" | "start" };

  if (action === "stop") {
    // Create stop file - watchdog will see this and exit
    await writeFile(STOP_FILE, `Stopped by user at ${new Date().toISOString()}`, "utf-8");
    return Response.json({ ok: true, active: false, message: "Watchdog will stop on next check cycle" });
  }

  if (action === "start") {
    // Remove stop file - watchdog needs to be relaunched manually or via auto-start
    if (existsSync(STOP_FILE)) {
      await unlink(STOP_FILE);
    }
    return Response.json({ ok: true, active: true, message: "Watchdog stop signal removed. Relaunch watchdog.bat to activate." });
  }

  return Response.json({ error: "action must be 'start' or 'stop'" }, { status: 400 });
}
