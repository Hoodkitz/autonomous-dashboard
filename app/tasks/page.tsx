import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { getEngineState } from "../lib/engine";

export const runtime = "nodejs";


export const dynamic = "force-dynamic";

interface Story {
  id: string;
  title: string;
  criteria: string[];
  status: string;
}

function loadStories(): Story[] {
  const dir = join(process.env.USERPROFILE || "C:\\Users\\Administrator", ".autonomous-engine", "stories");
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as Story);
  } catch {
    return [];
  }
}

function loadLogs(): string[] {
  const dir = join(process.env.USERPROFILE || "C:\\Users\\Administrator", ".autonomous-engine", "progress");
  if (!existsSync(dir)) return [];
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".log")).sort().reverse();
    if (files.length === 0) return [];
    return readFileSync(join(dir, files[0]), "utf-8").split("\n").filter(Boolean).slice(-30);
  } catch {
    return [];
  }
}

export default async function TasksPage() {
  const state = await getEngineState();
  const stories = loadStories();
  const logs = loadLogs();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tasks & Stories</h1>
        <p className="text-sm text-muted mt-0.5">{state.completedStories.length} completed, {stories.length} total</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Current Task</h2>
        {state.taskDescription ? (
          <div>
            <p className="text-foreground">{state.taskDescription}</p>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="text-muted">Phase: <span className="text-accent">{state.phase || "None"}</span></span>
              <span className="text-muted">Step: <span className="text-accent">{state.currentStep}/{state.totalSteps}</span></span>
            </div>
            {state.totalSteps > 0 && (
              <div className="mt-3 w-full bg-card-border rounded-full h-1.5">
                <div className="bg-accent rounded-full h-1.5 transition-all" style={{ width: `${Math.round((state.currentStep / state.totalSteps) * 100)}%` }} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted italic">No active task. Engine is idle.</p>
        )}
      </div>

      {stories.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">User Stories</h2>
          <div className="space-y-3">
            {stories.map((story) => (
              <div key={story.id} className="bg-card border border-card-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-foreground">{story.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    story.status === "done" ? "bg-success-dim text-success" :
                    story.status === "in_progress" ? "bg-accent-dim text-accent" :
                    "bg-muted-dim text-muted"
                  }`}>{story.status}</span>
                </div>
                {story.criteria?.map((c, i) => (
                  <div key={i} className="text-xs text-muted flex items-center gap-2 ml-1">
                    <span className={story.status === "done" ? "text-success" : "text-muted"}>
                      {story.status === "done" ? "+" : "o"}
                    </span>
                    {c}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center">
          <p className="text-muted mb-1">No stories yet</p>
          <p className="text-xs text-muted">Stories appear when the engine runs a task.</p>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Activity Log</h2>
        {logs.length > 0 ? (
          <div className="bg-card border border-card-border rounded-xl p-4 font-mono text-xs space-y-0.5 max-h-64 overflow-y-auto">
            {logs.map((line, i) => (
              <div key={i} className="text-muted">{line}</div>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl p-8 text-center">
            <p className="text-muted mb-1">No logs yet</p>
            <p className="text-xs text-muted">Logs stream here during execution.</p>
          </div>
        )}
      </div>
    </div>
  );
}
