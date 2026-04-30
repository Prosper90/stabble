"use client";

import { useEffect, useState } from "react";

type FileEntry = {
  exists: boolean;
  size: number;
  entries: number | null;
  data: unknown;
};

type AdminData = Record<string, FileEntry>;

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/data");
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">Data Store</h1>
          <p className="text-xs text-[#6e7681] mt-0.5">Raw contents of the server-side JSON storage</p>
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
        <div className="text-[#8b949e] text-sm">Loading data store…</div>
      )}

      {data && (
        <div className="space-y-3">
          {Object.entries(data).map(([key, entry]) => (
            <div key={key} className="border border-[#30363d] rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#161b22]">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${entry.exists ? "bg-[#238636]" : "bg-[#6e7681]"}`}
                  />
                  <span className="font-mono text-sm text-[#e6edf3]">{key}.json</span>
                  {entry.exists && (
                    <span className="text-xs text-[#6e7681]">
                      {entry.entries !== null ? `${entry.entries} entries` : ""} · {fmtBytes(entry.size)}
                    </span>
                  )}
                  {!entry.exists && (
                    <span className="text-xs text-[#6e7681]">not yet created</span>
                  )}
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

              {expanded === key && entry.data && (
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
    </div>
  );
}
