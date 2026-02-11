import { getOpportunities, getRevenueTracker } from "../lib/engine";
import { StatusBadge } from "../components/status-badge";

export const runtime = 'nodejs';

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const [opportunities, tracker] = await Promise.all([
    getOpportunities(),
    getRevenueTracker(),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">Autonomous income pipeline</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <p className="text-xs text-muted uppercase tracking-wider">Total Revenue</p>
          <p className="text-3xl font-bold text-success mt-1">${tracker.totalRevenue}</p>
          <p className="text-xs text-muted mt-1">Lifetime</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5">
          <p className="text-xs text-muted uppercase tracking-wider">Active Projects</p>
          <p className="text-3xl font-bold text-accent mt-1">{tracker.activeProjects}</p>
          <p className="text-xs text-muted mt-1">Generating</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5">
          <p className="text-xs text-muted uppercase tracking-wider">Opportunities</p>
          <p className="text-3xl font-bold text-warning mt-1">{opportunities.length}</p>
          <p className="text-xs text-muted mt-1">Ranked</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Opportunity Pipeline</h2>
        <div className="space-y-3">
          {opportunities.map((opp) => (
            <div key={opp.rank} className="bg-card border border-card-border rounded-xl p-5 hover:border-accent transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold text-accent bg-accent-dim rounded-full w-6 h-6 flex items-center justify-center">
                  {opp.rank}
                </span>
                <h3 className="font-semibold text-foreground">{opp.name}</h3>
                <span className={`text-xs font-bold ${opp.priority === "HIGH" ? "text-danger" : "text-warning"}`}>
                  {opp.priority}
                </span>
                <StatusBadge status={opp.status} />
              </div>
              <p className="text-sm text-muted mb-3">{opp.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted">Revenue Model</span>
                  <p className="text-foreground mt-0.5">{opp.revenue_model}</p>
                </div>
                <div>
                  <span className="text-muted">Est. Monthly</span>
                  <p className="text-success font-semibold mt-0.5">{opp.estimated_monthly}</p>
                </div>
                <div>
                  <span className="text-muted">Build Cost</span>
                  <p className="text-foreground mt-0.5">{opp.build_cost}</p>
                </div>
                <div>
                  <span className="text-muted">Hosting</span>
                  <p className="text-foreground mt-0.5">{opp.hosting}</p>
                </div>
              </div>
              {opp.existing_assets.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {opp.existing_assets.map((asset, i) => (
                    <span key={i} className="text-xs bg-card-border text-muted px-2 py-0.5 rounded">
                      {asset}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
