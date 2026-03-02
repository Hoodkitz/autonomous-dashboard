"use client";

import { useState, useEffect, useMemo } from "react";

export const runtime = "nodejs";


interface Model {
  id: string;
  name: string;
  description: string;
  pricing: { prompt: string; completion: string };
  context_length: number;
  top_provider: { max_completion_tokens: number | null };
  architecture: { tokenizer: string; modality: string };
}

interface UsageInfo {
  usage: number;
  limit: number | null;
  is_free_tier: boolean;
  rate_limit: { requests: number; interval: string } | null;
}

const MODALITY_COLORS: Record<string, string> = {
  text: "text-accent bg-accent-dim",
  multimodal: "text-purple bg-purple-dim",
  image: "text-cyan bg-cyan-dim",
};

function formatPrice(price: string): string {
  const n = parseFloat(price);
  if (n === 0) return "Free";
  if (n < 0.001) return `$${(n * 1000000).toFixed(2)}/M`;
  return `$${n}/tok`;
}

function getProvider(id: string): string {
  return id.split("/")[0] || id;
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "multimodal">("all");
  const [sortBy, setSortBy] = useState<"name" | "context" | "price">("name");

  useEffect(() => {
    Promise.all([
      fetch("/api/openrouter/models").then((r) => r.json()),
      fetch("/api/openrouter/usage").then((r) => r.json()),
    ])
      .then(([modelsData, usageData]) => {
        setModels(modelsData.models || []);
        if (!usageData.error) setUsage(usageData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = models;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
      );
    }
    if (filter === "free") {
      list = list.filter((m) => parseFloat(m.pricing.prompt) === 0);
    } else if (filter === "multimodal") {
      list = list.filter((m) => m.architecture?.modality === "multimodal");
    }
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "context") return b.context_length - a.context_length;
      return parseFloat(a.pricing.prompt) - parseFloat(b.pricing.prompt);
    });
    return list;
  }, [models, search, filter, sortBy]);

  const providers = useMemo(() => {
    const set = new Set(models.map((m) => getProvider(m.id)));
    return [...set].sort();
  }, [models]);

  const freeCount = models.filter((m) => parseFloat(m.pricing.prompt) === 0).length;

  if (loading) return <div className="text-muted p-6">Loading models...</div>;
  if (error) return <div className="text-danger p-6">Error: {error}</div>;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header + Usage */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">OpenRouter Models</h1>
          <p className="text-sm text-muted mt-0.5">
            {models.length} models from {providers.length} providers ({freeCount} free)
          </p>
        </div>
        {usage && (
          <div className="bg-card border border-card-border rounded-xl p-4 text-right">
            <p className="text-xs text-muted uppercase tracking-wider">Credits Used</p>
            <p className="text-lg font-bold text-foreground">${usage.usage.toFixed(4)}</p>
            {usage.limit !== null && (
              <p className="text-xs text-muted">
                Limit: ${usage.limit} ({usage.is_free_tier ? "Free tier" : "Paid"})
              </p>
            )}
            {usage.is_free_tier && !usage.limit && (
              <p className="text-xs text-success">Free tier active</p>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models..."
          className="bg-card border border-card-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted outline-none focus:border-accent w-64"
        />
        <div className="flex gap-1.5">
          {(["all", "free", "multimodal"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                filter === f
                  ? "bg-accent-dim text-accent ring-1 ring-accent"
                  : "text-muted bg-card-border hover:text-foreground"
              }`}
            >
              {f === "all" ? `All (${models.length})` : f === "free" ? `Free (${freeCount})` : "Multimodal"}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "context" | "price")}
          className="bg-card border border-card-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none"
        >
          <option value="name">Sort: Name</option>
          <option value="context">Sort: Context</option>
          <option value="price">Sort: Price</option>
        </select>
        <span className="text-xs text-muted ml-auto">{filtered.length} results</span>
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.slice(0, 150).map((model) => {
          const isFree = parseFloat(model.pricing.prompt) === 0;
          const modality = model.architecture?.modality || "text";
          const modalColor = MODALITY_COLORS[modality] || MODALITY_COLORS.text;

          return (
            <div
              key={model.id}
              className="bg-card border border-card-border rounded-xl p-4 hover:border-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{model.name}</p>
                  <p className="text-xs text-muted truncate">{model.id}</p>
                </div>
                {isFree && (
                  <span className="text-[10px] font-bold text-success bg-success-dim px-1.5 py-0.5 rounded shrink-0">
                    FREE
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                <div>
                  <span className="text-muted">Context</span>
                  <p className="text-foreground font-medium">
                    {model.context_length >= 1000
                      ? `${(model.context_length / 1000).toFixed(0)}K`
                      : model.context_length}
                  </p>
                </div>
                <div>
                  <span className="text-muted">Input</span>
                  <p className="text-foreground font-medium">{formatPrice(model.pricing.prompt)}</p>
                </div>
                <div>
                  <span className="text-muted">Output</span>
                  <p className="text-foreground font-medium">{formatPrice(model.pricing.completion)}</p>
                </div>
                <div>
                  <span className="text-muted">Type</span>
                  <p className={`font-medium ${modalColor.split(" ")[0]}`}>{modality}</p>
                </div>
              </div>

              {model.top_provider?.max_completion_tokens && (
                <p className="text-[10px] text-muted mt-2">
                  Max output: {(model.top_provider.max_completion_tokens / 1000).toFixed(0)}K tokens
                </p>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length > 150 && (
        <p className="text-xs text-muted text-center">
          Showing 150 of {filtered.length} models. Use search to narrow results.
        </p>
      )}
    </div>
  );
}
