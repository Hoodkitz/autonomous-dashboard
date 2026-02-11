import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

export const runtime = 'nodejs';

export const dynamic = "force-dynamic";

interface LogEntry {
  file: string;
  modified: string;
  lines: string[];
}

function loadLogs(): LogEntry[] {
  const dirs = [
    join(process.env.USERPROFILE || "C:\\Users\\Administrator", ".autonomous-engine", "progress"),
    join(process.env.USERPROFILE || "C:\\Users\\Administrator", ".autonomous-engine", "validation"),
  ];
  const entries: LogEntry[] = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      for (const f of readdirSync(dir).sort().reverse()) {
        const full = join(dir, f);
        const stat = statSync(full);
        if (!stat.isFile()) continue;
        try {
          const content = readFileSync(full, "utf-8");
          entries.push({
            file: f,
            modified: stat.mtime.toLocaleString(),
            lines: content.split("\n").filter(Boolean),
          });
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  return entries.sort((a, b) => b.modified.localeCompare(a.modified));
}

export default function LogsPage() {
  const logs = loadLogs();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
        <p className="text-sm text-muted mt-0.5">Execution history & validation</p>
      </div>

      {logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{log.file}</span>
                <span className="text-xs text-muted">{log.modified}</span>
              </div>
              <div className="font-mono text-xs space-y-0.5 max-h-48 overflow-y-auto">
                {log.lines.map((line, j) => (
                  <div key={j} className="text-muted">{line}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <p className="text-muted mb-1">No logs yet</p>
          <p className="text-xs text-muted">Logs appear during engine execution.</p>
        </div>
      )}
    </div>
  );
}
