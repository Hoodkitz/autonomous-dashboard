import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const BOARD_FILE = join(ENGINE_DIR, "noticeboard.json");

interface NoticeBoard {
  /** Last updated ISO timestamp */
  updatedAt: string;
  /** Who last updated (claude, gemini, openclaw, user, etc.) */
  updatedBy: string;
  /** Current development phase */
  phase: string;
  /** Short status line */
  status: string;
  /** What is currently being worked on */
  activeWork: string;
  /** Ordered list of next steps for any AI picking up */
  nextSteps: string[];
  /** Recently completed items */
  completed: string[];
  /** Important context any AI needs to know */
  context: string[];
  /** Blockers or issues needing attention */
  blockers: string[];
  /** Project-level notes */
  projectNotes: string;
  /** Key files that were recently modified */
  recentFiles: string[];
  /** Current git branch and last commit */
  git: { branch: string; lastCommit: string };
  /** Free-form pinned messages between AIs */
  pins: Array<{ from: string; message: string; at: string }>;
}

function defaultBoard(): NoticeBoard {
  return {
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
    phase: "idle",
    status: "No active work",
    activeWork: "",
    nextSteps: [],
    completed: [],
    context: [],
    blockers: [],
    projectNotes: "",
    recentFiles: [],
    git: { branch: "master", lastCommit: "" },
    pins: [],
  };
}

async function loadBoard(): Promise<NoticeBoard> {
  try {
    const raw = await readFile(BOARD_FILE, "utf-8");
    return { ...defaultBoard(), ...JSON.parse(raw) };
  } catch {
    return defaultBoard();
  }
}

async function saveBoard(board: NoticeBoard): Promise<void> {
  await mkdir(ENGINE_DIR, { recursive: true });
  await writeFile(BOARD_FILE, JSON.stringify(board, null, 2), "utf-8");
}

// GET: Read the notice board - any AI or tool can call this
// curl http://localhost:3000/api/noticeboard
// Also supports ?format=text for plain-text summary (easy for CLI AIs)
export async function GET(req: NextRequest) {
  const board = await loadBoard();
  const format = req.nextUrl.searchParams.get("format");

  if (format === "text" || format === "plain") {
    // Plain-text format for CLI tools like Gemini CLI
    const lines = [
      `=== AUTONOMOUS ENGINE NOTICE BOARD ===`,
      `Updated: ${board.updatedAt} by ${board.updatedBy}`,
      `Phase: ${board.phase}`,
      `Status: ${board.status}`,
      ``,
      `--- ACTIVE WORK ---`,
      board.activeWork || "(none)",
      ``,
      `--- NEXT STEPS ---`,
      ...(board.nextSteps.length ? board.nextSteps.map((s, i) => `${i + 1}. ${s}`) : ["(none)"]),
      ``,
      `--- RECENTLY COMPLETED ---`,
      ...(board.completed.length ? board.completed.map((s) => `- ${s}`) : ["(none)"]),
      ``,
      `--- CONTEXT ---`,
      ...(board.context.length ? board.context.map((s) => `- ${s}`) : ["(none)"]),
      ``,
      `--- BLOCKERS ---`,
      ...(board.blockers.length ? board.blockers.map((s) => `! ${s}`) : ["(none)"]),
      ``,
      `--- RECENT FILES ---`,
      ...(board.recentFiles.length ? board.recentFiles.map((f) => `  ${f}`) : ["(none)"]),
      ``,
      `--- GIT ---`,
      `Branch: ${board.git.branch}`,
      `Last commit: ${board.git.lastCommit}`,
      ``,
      `--- PINNED MESSAGES ---`,
      ...(board.pins.length
        ? board.pins.map((p) => `[${p.from} @ ${p.at}] ${p.message}`)
        : ["(none)"]),
      ``,
      `--- PROJECT NOTES ---`,
      board.projectNotes || "(none)",
      ``,
      `=== END NOTICE BOARD ===`,
    ];
    return new Response(lines.join("\n"), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return Response.json(board);
}

// POST: Update the notice board
// Any AI can post updates. Supports partial updates (only send fields you want to change).
// Special actions via "action" field:
//   - "pin": Add a pinned message { action: "pin", from: "gemini", message: "..." }
//   - "unpin": Remove pins by index { action: "unpin", index: 0 }
//   - "complete": Move activeWork to completed, clear activeWork
//   - "add_step": Add a next step { action: "add_step", step: "..." }
//   - "remove_step": Remove a next step by index { action: "remove_step", index: 0 }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const board = await loadBoard();

  const action = body.action as string | undefined;

  if (action === "pin") {
    board.pins.push({
      from: body.from || "unknown",
      message: body.message || "",
      at: new Date().toISOString(),
    });
  } else if (action === "unpin") {
    const idx = typeof body.index === "number" ? body.index : -1;
    if (idx >= 0 && idx < board.pins.length) {
      board.pins.splice(idx, 1);
    }
  } else if (action === "complete") {
    if (board.activeWork) {
      board.completed.unshift(board.activeWork);
      if (board.completed.length > 20) board.completed = board.completed.slice(0, 20);
      board.activeWork = "";
    }
    if (board.nextSteps.length > 0) {
      board.activeWork = board.nextSteps.shift()!;
    }
  } else if (action === "add_step") {
    if (body.step) board.nextSteps.push(body.step);
  } else if (action === "remove_step") {
    const idx = typeof body.index === "number" ? body.index : -1;
    if (idx >= 0 && idx < board.nextSteps.length) {
      board.nextSteps.splice(idx, 1);
    }
  } else {
    // Partial update - merge provided fields
    const fields: (keyof NoticeBoard)[] = [
      "phase", "status", "activeWork", "nextSteps", "completed",
      "context", "blockers", "projectNotes", "recentFiles", "git", "pins",
    ];
    for (const key of fields) {
      if (key in body) {
        (board as Record<string, unknown>)[key] = body[key];
      }
    }
  }

  board.updatedAt = new Date().toISOString();
  board.updatedBy = body.updatedBy || body.from || "unknown";

  await saveBoard(board);
  return Response.json({ ok: true, board });
}
export const runtime = 'nodejs';
