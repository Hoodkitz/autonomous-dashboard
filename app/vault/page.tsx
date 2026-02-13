import { getVault } from "../lib/engine";
import { StatusBadge } from "../components/status-badge";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const vault = await getVault();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API Vault</h1>
        <p className="text-sm text-muted mt-0.5">Credentials & free tier services</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">API Keys</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(vault.services).map(([key, svc]) => (
            <div key={key} className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-foreground capitalize">{key}</span>
                <StatusBadge status={svc.status} />
              </div>
              <p className="text-sm text-muted mb-1">{svc.note}</p>
              <p className="text-xs text-muted">Type: {svc.type}</p>
              {svc.setup_url && (
                <a href={svc.setup_url} target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-accent hover:underline">
                  Get free API key
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Free Tier Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(vault.free_tier_services)
            .filter(([k]) => !k.startsWith("_"))
            .map(([name, desc]) => (
              <div key={name} className="bg-card border border-card-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span className="text-sm font-medium text-foreground capitalize">{name.replace(/_/g, " ")}</span>
                </div>
                <p className="text-xs text-muted">{desc}</p>
              </div>
            ))}
        </div>
      </div>

      <div className="bg-card border border-warning-dim rounded-xl p-4">
        <p className="text-xs text-warning font-semibold mb-1">Security</p>
        <p className="text-xs text-muted">
          Keys stored locally at ~/.autonomous-engine/vault/ - never committed to git. Protected by Rule Zero.
        </p>
      </div>
    </div>
  );
}

export const runtime = "nodejs";
