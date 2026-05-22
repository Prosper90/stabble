"use client";

import { useEffect, useState } from "react";

type FileEntry = {
  exists: boolean;
  size: number;
  entries: number | null;
  data: unknown;
};

type AdminData = Record<string, FileEntry>;

type PoolEntry = {
  address: string;
  addedAt: string;
  snapshotCount: number | null;
  latest: {
    timestamp: number;
    assets: { vault: string; mint: string; amount: number; symbol?: string }[];
  } | null;
};

type BackendData = {
  configured: boolean;
  error?: string;
  pools: PoolEntry[];
};

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [backend, setBackend] = useState<BackendData | null>(null);
  const [backendLoading, setBackendLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin-data");
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadBackend() {
    setBackendLoading(true);
    try {
      const res = await fetch("/api/backend-pools");
      if (res.ok) setBackend(await res.json());
    } finally {
      setBackendLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadBackend();
  }, []);

  return (
    <div className="space-y-10">

      {/* Pool Tracker (MongoDB backend) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#e6edf3]">Pool Tracker</h1>
            <p className="text-xs text-[#6e7681] mt-0.5">Pools being monitored by the backend cron job (MongoDB)</p>
          </div>
          <button
            onClick={loadBackend}
            disabled={backendLoading}
            className="px-4 py-2 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors disabled:opacity-50"
          >
            {backendLoading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {!backendLoading && backend && !backend.configured && (
          <div className="border border-[#30363d] rounded-lg px-4 py-6 text-center text-[#6e7681] text-sm">
            Backend not configured — set <span className="font-mono text-[#8b949e]">BACKEND_URL</span> in Netlify env vars once the server is deployed.
          </div>
        )}

        {!backendLoading && backend?.error && (
          <div className="bg-[#5a1e1e] border border-[#f85149] text-[#ffa198] rounded-lg px-4 py-3 text-sm">
            Backend error: {backend.error}
          </div>
        )}

        {!backendLoading && backend?.configured && !backend.error && (
          backend.pools.length === 0 ? (
            <div className="border border-[#30363d] rounded-lg px-4 py-6 text-center text-[#6e7681] text-sm">
              No pools tracked yet — search a pool on the Pool page to register it.
            </div>
          ) : (
            <div className="space-y-2">
              {backend.pools.map((pool) => (
                <div key={pool.address} className="border border-[#30363d] rounded-lg px-4 py-3 bg-[#161b22]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm text-[#e6edf3]">{shortAddr(pool.address)}</span>
                      <span className="ml-3 text-xs text-[#6e7681]">
                        Added {new Date(pool.addedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {pool.latest ? (
                      <div className="text-right">
                        <div className="text-xs text-[#3fb950]">
                          {pool.latest.assets.length} assets
                          {pool.snapshotCount !== null && (
                            <span className="ml-1.5 text-[#58a6ff] font-semibold">
                              · {pool.snapshotCount.toLocaleString()} snapshots (24h)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#6e7681] mt-0.5">
                          last: {new Date(pool.latest.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-xs text-[#6e7681] mt-0.5">
                          {pool.latest.assets.map((a) =>
                            `${a.symbol ?? a.mint.slice(0, 4)}: ${a.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                          ).join(" · ")}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-[#6e7681]">No snapshots yet</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* Local JSON data store */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#e6edf3]">Local Data Store</h2>
            <p className="text-xs text-[#6e7681] mt-0.5">
              Ephemeral cache on this serverless instance — resets on every cold start.
              Pool time-series history lives in MongoDB (shown above).
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="bg-[#5a1e1e] border border-[#f85149] text-[#ffa198] rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="text-[#8b949e] text-sm">Loading…</div>
        )}

        {data && (
          <div className="space-y-3">
            {Object.entries(data).map(([key, entry]) => (
              <div key={key} className="border border-[#30363d] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-[#161b22]">
                  <div className="flex items-center gap-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${entry.exists ? "bg-[#238636]" : "bg-[#6e7681]"}`} />
                    <span className="font-mono text-sm text-[#e6edf3]">{key}.json</span>
                    {entry.exists && (
                      <span className="text-xs text-[#6e7681]">
                        {entry.entries !== null ? `${entry.entries} entries` : ""} · {fmtBytes(entry.size)}
                      </span>
                    )}
                    {!entry.exists && <span className="text-xs text-[#6e7681]">not yet created</span>}
                  </div>
                  {entry.exists && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadJson(key, entry.data)}
                        className="px-3 py-1 text-xs bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] rounded transition-colors"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => setExpanded(expanded === key ? null : key)}
                        className="px-3 py-1 text-xs bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] rounded transition-colors"
                      >
                        {expanded === key ? "Collapse" : "Preview"}
                      </button>
                    </div>
                  )}
                </div>

                {expanded === key && entry.data != null && (
                  <div className="border-t border-[#30363d] bg-[#0d1117] p-4 overflow-auto max-h-[500px]">
                    <pre className="text-xs text-[#e6edf3] font-mono whitespace-pre-wrap">
                      {JSON.stringify(entry.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
