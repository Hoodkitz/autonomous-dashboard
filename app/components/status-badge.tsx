export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    idle: "text-muted bg-muted-dim",
    ready: "text-success bg-success-dim",
    in_progress: "text-accent bg-accent-dim",
    running: "text-accent bg-accent-dim",
    paused: "text-warning bg-warning-dim",
    failed: "text-danger bg-danger-dim",
    active: "text-success bg-success-dim",
    needs_setup: "text-warning bg-warning-dim",
    needs_check: "text-warning bg-warning-dim",
    ready_to_build: "text-cyan bg-cyan-dim",
    nearly_complete: "text-success bg-success-dim",
    ready_to_package: "text-purple bg-purple-dim",
    needs_extraction_and_polish: "text-warning bg-warning-dim",
    ready_to_create: "text-cyan bg-cyan-dim",
    offline: "text-danger bg-danger-dim",
    online: "text-success bg-success-dim",
  };

  const labels: Record<string, string> = {
    idle: "Idle",
    ready: "Ready",
    in_progress: "Running",
    running: "Running",
    paused: "Paused",
    failed: "Failed",
    active: "Active",
    needs_setup: "Needs Setup",
    needs_check: "Check",
    ready_to_build: "Ready",
    nearly_complete: "Nearly Done",
    ready_to_package: "Packageable",
    needs_extraction_and_polish: "Needs Polish",
    ready_to_create: "Ready",
    offline: "Offline",
    online: "Online",
  };

  const dotColors: Record<string, string> = {
    idle: "bg-muted",
    ready: "bg-success",
    in_progress: "bg-accent",
    running: "bg-accent",
    paused: "bg-warning",
    failed: "bg-danger",
    active: "bg-success",
    needs_setup: "bg-warning",
    needs_check: "bg-warning",
    ready_to_build: "bg-cyan",
    nearly_complete: "bg-success",
    ready_to_package: "bg-purple",
    needs_extraction_and_polish: "bg-warning",
    ready_to_create: "bg-cyan",
    offline: "bg-danger",
    online: "bg-success",
  };

  const s = styles[status] || "text-muted bg-muted-dim";
  const l = labels[status] || status;
  const d = dotColors[status] || "bg-muted";
  const pulse = status === "running" || status === "in_progress" ? "pulse-glow" : "";

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${d} ${pulse}`} />
      {l}
    </span>
  );
}
