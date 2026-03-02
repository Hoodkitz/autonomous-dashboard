"use client";

import { useState, useEffect, useCallback } from "react";

export const runtime = "nodejs";


interface Pin {
  from: string;
  message: string;
  at: string;
}

interface NoticeBoard {
  updatedAt: string;
  updatedBy: string;
  phase: string;
  status: string;
  activeWork: string;
  nextSteps: string[];
  completed: string[];
  context: string[];
  blockers: string[];
  projectNotes: string;
  recentFiles: string[];
  git: { branch: string; lastCommit: string };
  pins: Pin[];
}

const PHASE_COLORS: Record<string, string> = {
  idle: "bg-muted",
  research: "bg-info",
  planning: "bg-warning",
  building: "bg-accent",
  reviewing: "bg-purple-500",
  deploying: "bg-success",
  optimizing: "bg-cyan-500",
};

export default function NoticeBoardPage() {
  const [board, setBoard] = useState<NoticeBoard | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [newStep, setNewStep] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newBlocker, setNewBlocker] = useState("");
  const [pinFrom, setPinFrom] = useState("user");
  const [pinMsg, setPinMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/noticeboard");
      if (res.ok) setBoard(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchBoard();
    const iv = setInterval(fetchBoard, 5000);
    return () => clearInterval(iv);
  }, [fetchBoard]);

  async function updateBoard(data: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/noticeboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, updatedBy: "dashboard" }),
      });
      if (res.ok) {
        const { board: updated } = await res.json();
        setBoard(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  async function addStep() {
    if (!newStep.trim()) return;
    await updateBoard({ action: "add_step", step: newStep.trim() });
    setNewStep("");
  }

  async function removeStep(idx: number) {
    await updateBoard({ action: "remove_step", index: idx });
  }

  async function addPin() {
    if (!pinMsg.trim()) return;
    await updateBoard({ action: "pin", from: pinFrom, message: pinMsg.trim() });
    setPinMsg("");
  }

  async function removePin(idx: number) {
    await updateBoard({ action: "unpin", index: idx });
  }

  async function markComplete() {
    await updateBoard({ action: "complete" });
  }

  if (!board) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground mb-4">Development Notice Board</h1>
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  const phaseColor = PHASE_COLORS[board.phase] || "bg-muted";

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Development Notice Board</h1>
          <p className="text-xs text-muted mt-1">
            Shared state for seamless AI handoff &mdash; accessible via{" "}
            <code className="bg-card px-1 rounded">curl localhost:3000/api/noticeboard?format=text</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            Updated {new Date(board.updatedAt).toLocaleTimeString()} by {board.updatedBy}
          </span>
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              editMode ? "bg-accent text-background" : "bg-card text-foreground border border-card-border"
            }`}
          >
            {editMode ? "Done Editing" : "Edit"}
          </button>
        </div>
      </div>

      {/* Phase + Status */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted mb-2">Phase</div>
          {editMode ? (
            <select
              value={board.phase}
              onChange={(e) => updateBoard({ phase: e.target.value })}
              className="bg-background text-foreground border border-card-border rounded px-2 py-1 text-sm w-full"
            >
              {Object.keys(PHASE_COLORS).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          ) : (
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white ${phaseColor}`}>
              {board.phase}
            </span>
          )}
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted mb-2">Status</div>
          {editMode ? (
            <input
              value={board.status}
              onChange={(e) => setBoard({ ...board, status: e.target.value })}
              onBlur={() => updateBoard({ status: board.status })}
              className="bg-background text-foreground border border-card-border rounded px-2 py-1 text-sm w-full"
            />
          ) : (
            <p className="text-sm text-foreground">{board.status}</p>
          )}
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted mb-2">Git</div>
          <p className="text-sm text-foreground">{board.git.branch}</p>
          <p className="text-xs text-muted truncate">{board.git.lastCommit || "(no commit info)"}</p>
        </div>
      </div>

      {/* Active Work */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-muted">Active Work</div>
          {board.activeWork && (
            <button
              onClick={markComplete}
              className="text-xs px-2 py-0.5 rounded bg-success text-white"
            >
              Mark Complete
            </button>
          )}
        </div>
        {editMode ? (
          <input
            value={board.activeWork}
            onChange={(e) => setBoard({ ...board, activeWork: e.target.value })}
            onBlur={() => updateBoard({ activeWork: board.activeWork })}
            className="bg-background text-foreground border border-card-border rounded px-2 py-1 text-sm w-full"
            placeholder="What is currently being worked on..."
          />
        ) : (
          <p className="text-sm text-foreground">
            {board.activeWork || <span className="text-muted italic">No active work</span>}
          </p>
        )}
      </div>

      {/* Two-column: Next Steps + Completed */}
      <div className="grid grid-cols-2 gap-4">
        {/* Next Steps */}
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted mb-3">Next Steps</div>
          <div className="space-y-1.5">
            {board.nextSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-accent font-mono text-xs mt-0.5">{i + 1}.</span>
                <span className="text-foreground flex-1">{step}</span>
                {editMode && (
                  <button onClick={() => removeStep(i)} className="text-danger text-xs">x</button>
                )}
              </div>
            ))}
            {board.nextSteps.length === 0 && (
              <p className="text-xs text-muted italic">No next steps defined</p>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStep()}
              placeholder="Add next step..."
              className="bg-background text-foreground border border-card-border rounded px-2 py-1 text-xs flex-1"
            />
            <button onClick={addStep} className="px-2 py-1 bg-accent text-background rounded text-xs">+</button>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted mb-3">Recently Completed</div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {board.completed.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-success text-xs mt-0.5">&#10003;</span>
                <span className="text-muted">{item}</span>
              </div>
            ))}
            {board.completed.length === 0 && (
              <p className="text-xs text-muted italic">Nothing completed yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Context + Blockers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted mb-3">Important Context</div>
          <div className="space-y-1.5">
            {board.context.map((c, i) => (
              <div key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-info text-xs mt-0.5">i</span>
                <span>{c}</span>
              </div>
            ))}
            {board.context.length === 0 && (
              <p className="text-xs text-muted italic">No context notes</p>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newContext.trim()) {
                  updateBoard({ context: [...board.context, newContext.trim()] });
                  setNewContext("");
                }
              }}
              placeholder="Add context..."
              className="bg-background text-foreground border border-card-border rounded px-2 py-1 text-xs flex-1"
            />
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted mb-3">Blockers</div>
          <div className="space-y-1.5">
            {board.blockers.map((b, i) => (
              <div key={i} className="text-sm text-danger flex items-start gap-2">
                <span className="text-xs mt-0.5">!</span>
                <span>{b}</span>
              </div>
            ))}
            {board.blockers.length === 0 && (
              <p className="text-xs text-muted italic">No blockers</p>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              value={newBlocker}
              onChange={(e) => setNewBlocker(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newBlocker.trim()) {
                  updateBoard({ blockers: [...board.blockers, newBlocker.trim()] });
                  setNewBlocker("");
                }
              }}
              placeholder="Add blocker..."
              className="bg-background text-foreground border border-card-border rounded px-2 py-1 text-xs flex-1"
            />
          </div>
        </div>
      </div>

      {/* Recent Files */}
      {board.recentFiles.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted mb-2">Recently Modified Files</div>
          <div className="flex flex-wrap gap-1.5">
            {board.recentFiles.map((f, i) => (
              <span key={i} className="text-xs bg-background border border-card-border rounded px-2 py-0.5 font-mono text-foreground">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pinned Messages */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="text-xs text-muted mb-3">Pinned Messages (AI-to-AI Communication)</div>
        <div className="space-y-2">
          {board.pins.map((pin, i) => (
            <div key={i} className="flex items-start gap-3 bg-background rounded-lg px-3 py-2">
              <span className="text-xs font-medium text-accent shrink-0 mt-0.5">{pin.from}</span>
              <p className="text-sm text-foreground flex-1">{pin.message}</p>
              <span className="text-xs text-muted shrink-0">
                {new Date(pin.at).toLocaleTimeString()}
              </span>
              <button onClick={() => removePin(i)} className="text-danger text-xs shrink-0">x</button>
            </div>
          ))}
          {board.pins.length === 0 && (
            <p className="text-xs text-muted italic">No pinned messages. AIs can pin messages for each other here.</p>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <select
            value={pinFrom}
            onChange={(e) => setPinFrom(e.target.value)}
            className="bg-background text-foreground border border-card-border rounded px-2 py-1 text-xs"
          >
            <option value="user">user</option>
            <option value="claude">claude</option>
            <option value="gemini">gemini</option>
            <option value="openclaw">openclaw</option>
          </select>
          <input
            value={pinMsg}
            onChange={(e) => setPinMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPin()}
            placeholder="Pin a message for other AIs..."
            className="bg-background text-foreground border border-card-border rounded px-2 py-1 text-xs flex-1"
          />
          <button onClick={addPin} className="px-3 py-1 bg-accent text-background rounded text-xs">Pin</button>
        </div>
      </div>

      {/* Project Notes */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="text-xs text-muted mb-2">Project Notes</div>
        <textarea
          value={board.projectNotes}
          onChange={(e) => setBoard({ ...board, projectNotes: e.target.value })}
          onBlur={() => updateBoard({ projectNotes: board.projectNotes })}
          placeholder="Free-form project notes..."
          rows={4}
          className="bg-background text-foreground border border-card-border rounded px-3 py-2 text-sm w-full resize-y"
        />
      </div>

      {/* API Usage Guide */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="text-xs text-muted mb-2">API Usage for CLI AIs</div>
        <div className="space-y-2 text-xs font-mono text-muted">
          <p># Read board (JSON)</p>
          <p className="text-foreground">curl http://localhost:3000/api/noticeboard</p>
          <p className="mt-2"># Read board (plain text - best for Gemini CLI)</p>
          <p className="text-foreground">curl &quot;http://localhost:3000/api/noticeboard?format=text&quot;</p>
          <p className="mt-2"># Update phase</p>
          <p className="text-foreground">curl -X POST http://localhost:3000/api/noticeboard -H &quot;Content-Type: application/json&quot; -d &apos;{`{"phase":"building","updatedBy":"gemini"}`}&apos;</p>
          <p className="mt-2"># Pin a message</p>
          <p className="text-foreground">curl -X POST http://localhost:3000/api/noticeboard -H &quot;Content-Type: application/json&quot; -d &apos;{`{"action":"pin","from":"gemini","message":"Fixed the auth bug"}`}&apos;</p>
          <p className="mt-2"># Mark active work as complete, auto-pick next step</p>
          <p className="text-foreground">curl -X POST http://localhost:3000/api/noticeboard -H &quot;Content-Type: application/json&quot; -d &apos;{`{"action":"complete","updatedBy":"claude"}`}&apos;</p>
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-accent text-background px-3 py-1.5 rounded text-xs">
          Saving...
        </div>
      )}
    </div>
  );
}
