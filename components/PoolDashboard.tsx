"use client";

import { useEffect, useState, useCallback } from "react";
import { PoolSnapshot, Labels } from "@/lib/types";
import StatCard from "./StatCard";
import SortableTable, { Column } from "./SortableTable";
import DeltaBadge from "./DeltaBadge";
import WalletLabelCell from "./WalletLabelCell";

type DeltaRange = "1d" | "7d" | "30d";

interface AssetRow {
  vault: string;
  mint: string;
  amount: number;
  decimals: number;
  delta1d: number | null;
  delta7d: number | null;
  delta30d: number | null;
}

type RefSnap = { assets: { mint: string; amount: number }[] } | null;

function fmtN(n: number, decimals = 2) {
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function buildDeltas(assets: PoolSnapshot["assets"], ref: RefSnap): Map<string, number> {
  if (!ref) return new Map();
  const old = new Map(ref.assets.map((a) => [a.mint, a.amount]));
  return new Map(assets.map((a) => [a.mint, a.amount - (old.get(a.mint) ?? 0)]));
}

export default function PoolDashboard() {
  const [snapshot, setSnapshot] = useState<PoolSnapshot | null>(null);
  const [labels, setLabels] = useState<Labels>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [snap1d, setSnap1d] = useState<RefSnap>(null);
  const [snap7d, setSnap7d] = useState<RefSnap>(null);
  const [snap30d, setSnap30d] = useState<RefSnap>(null);
  const [deltaRange, setDeltaRange] = useState<DeltaRange>("1d");

  const load = useCallback(async (force = false) => {
    force ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [poolRes, labelsRes] = await Promise.all([
        fetch(`/api/pool${force ? "?force=true" : ""}`),
        fetch("/api/labels"),
      ]);
      if (!poolRes.ok) throw new Error(await poolRes.text());
      const { snapshot: snap, snap1d: s1d, snap7d: s7d, snap30d: s30d, warning } = await poolRes.json();
      const lbls = await labelsRes.json();
      if (warning) console.warn("Pool warning:", warning);
      setSnapshot(snap);
      setLabels(lbls);
      setSnap1d(s1d ?? null);
      setSnap7d(s7d ?? null);
      setSnap30d(s30d ?? null);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveLabel(address: string, name: string) {
    await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, name }),
    });
    setLabels((prev) => {
      const next = { ...prev };
      if (name.trim() === "") delete next[address];
      else next[address] = name.trim();
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#8b949e]">Fetching pool data…</p>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-[#f85149] font-medium">Failed to load pool data</p>
        <p className="text-xs text-[#8b949e] max-w-md text-center">{error}</p>
        <button onClick={() => load(true)} className="px-4 py-2 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors">
          Retry
        </button>
      </div>
    );
  }

  // Not configured yet
  if (!snapshot || snapshot.assets.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-[#e6edf3]">Pool Tracker</h1>
        </div>
        <div className="border border-[#30363d] rounded-lg p-8 text-center space-y-3">
          <p className="text-[#e6edf3] font-medium">No pool configured yet</p>
          <p className="text-sm text-[#8b949e] max-w-lg mx-auto">
            Once your Stabble pool is live, add these two variables to <code className="text-[#58a6ff]">.env.local</code>:
          </p>
          <div className="text-left inline-block bg-[#161b22] border border-[#30363d] rounded-lg px-5 py-3 text-sm font-mono text-[#8b949e] space-y-1">
            <p><span className="text-[#58a6ff]">POOL_ADDRESS</span>=&lt;pool on-chain address&gt;</p>
            <p><span className="text-[#58a6ff]">POOL_VAULTS</span>=&lt;vault1,vault2,vault3,…&gt;</p>
          </div>
          <p className="text-xs text-[#6e7681]">
            Vault addresses are the SPL token accounts holding each asset — find them on Solscan under the pool address.
          </p>
        </div>
      </div>
    );
  }

  const activeRef = deltaRange === "1d" ? snap1d : deltaRange === "7d" ? snap7d : snap30d;
  const deltas = buildDeltas(snapshot.assets, activeRef);

  const rows: AssetRow[] = snapshot.assets.map((a) => ({
    ...a,
    delta1d: buildDeltas(snapshot.assets, snap1d).get(a.mint) ?? null,
    delta7d: buildDeltas(snapshot.assets, snap7d).get(a.mint) ?? null,
    delta30d: buildDeltas(snapshot.assets, snap30d).get(a.mint) ?? null,
  }));

  const columns: Column<AssetRow>[] = [
    {
      key: "mint",
      header: "Token",
      sortable: false,
      render: (row) => (
        <WalletLabelCell
          address={row.mint}
          label={labels[row.mint]}
          onSave={saveLabel}
        />
      ),
    },
    {
      key: "vault",
      header: "Vault",
      sortable: false,
      render: (row) => (
        <a
          href={`https://solscan.io/account/${row.vault}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-[#8b949e] hover:text-[#58a6ff] transition-colors"
        >
          {shortAddr(row.vault)}
        </a>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      render: (row) => fmtN(row.amount),
    },
    {
      key: "delta1d",
      header: "Δ 1d",
      sortable: true,
      align: "right",
      value: (row) => row.delta1d,
      render: (row) => <DeltaBadge value={row.delta1d} />,
    },
    {
      key: "delta7d",
      header: "Δ 7d",
      sortable: true,
      align: "right",
      value: (row) => row.delta7d,
      render: (row) => <DeltaBadge value={row.delta7d} />,
    },
    {
      key: "delta30d",
      header: "Δ 30d",
      sortable: true,
      align: "right",
      value: (row) => row.delta30d,
      render: (row) => <DeltaBadge value={row.delta30d} />,
    },
  ];

  const solscanBase = "https://solscan.io/account/";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">Pool Tracker</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {snapshot.poolAddress && (
              <a
                href={`${solscanBase}${snapshot.poolAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#58a6ff] hover:underline font-mono"
              >
                {shortAddr(snapshot.poolAddress)} ↗
              </a>
            )}
            {lastUpdated && (
              <span className="text-xs text-[#6e7681]">· Last updated: {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="px-4 py-2 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {refreshing && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />}
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-[#5a1e1e] border border-[#f85149] text-[#ffa198] rounded-lg px-4 py-3 text-sm">
          Warning: {error}. Showing cached data.
        </div>
      )}

      {/* Stat cards — one per asset */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {snapshot.assets.map((a) => {
          const label = labels[a.mint] ?? shortAddr(a.mint);
          const delta = deltas.get(a.mint) ?? null;
          return (
            <StatCard
              key={a.mint}
              title={label}
              value={fmtN(a.amount)}
              delta={delta}
            />
          );
        })}
      </div>

      {/* Delta range selector */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-[#6e7681] mr-2">Delta range:</span>
        {(["1d", "7d", "30d"] as DeltaRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setDeltaRange(r)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              deltaRange === r
                ? "bg-[#58a6ff] text-[#0d1117] font-medium"
                : "bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] hover:text-[#e6edf3] border border-[#30363d]"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Assets table */}
      <section>
        <h2 className="text-lg font-semibold text-[#e6edf3] mb-3">
          Pool Assets
          <span className="ml-2 text-sm font-normal text-[#8b949e]">({snapshot.assets.length} tokens)</span>
        </h2>
        <SortableTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.mint}
          emptyMessage="No assets found"
        />
        <p className="text-xs text-[#6e7681] mt-2">
          Click any token address to add a label. Vault addresses link to Solscan.
        </p>
      </section>
    </div>
  );
}
