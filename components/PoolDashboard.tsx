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

function fmtN(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function buildDeltaMap(assets: PoolSnapshot["assets"], ref: RefSnap): Map<string, number> {
  if (!ref) return new Map();
  const old = new Map(ref.assets.map((a) => [a.mint, a.amount]));
  return new Map(assets.map((a) => [a.mint, a.amount - (old.get(a.mint) ?? 0)]));
}

interface Props {
  defaultPool?: string;
}

export default function PoolDashboard({ defaultPool = "" }: Props) {
  const [input, setInput] = useState(defaultPool);
  const [activePool, setActivePool] = useState("");
  const [snapshot, setSnapshot] = useState<PoolSnapshot | null>(null);
  const [labels, setLabels] = useState<Labels>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [snap1d, setSnap1d] = useState<RefSnap>(null);
  const [snap7d, setSnap7d] = useState<RefSnap>(null);
  const [snap30d, setSnap30d] = useState<RefSnap>(null);
  const [deltaRange, setDeltaRange] = useState<DeltaRange>("1d");

  const loadPool = useCallback(async (address: string, force = false) => {
    const addr = address.trim();
    if (!addr) return;

    force ? setRefreshing(true) : setLoading(true);
    setDiscovering(!force);
    setError(null);

    try {
      const [poolRes, labelsRes] = await Promise.all([
        fetch(`/api/pool?address=${encodeURIComponent(addr)}${force ? "&force=true" : ""}`),
        fetch("/api/labels"),
      ]);

      if (!poolRes.ok) throw new Error(await poolRes.text());
      const { snapshot: snap, snap1d: s1d, snap7d: s7d, snap30d: s30d, warning, error: apiErr } = await poolRes.json();

      if (apiErr) throw new Error(apiErr);
      if (warning) console.warn("Pool warning:", warning);

      const lbls = await labelsRes.json();
      setSnapshot(snap);
      setLabels(lbls);
      setSnap1d(s1d ?? null);
      setSnap7d(s7d ?? null);
      setSnap30d(s30d ?? null);
      setActivePool(addr);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSnapshot(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setDiscovering(false);
    }
  }, []);

  // Auto-load default pool on mount
  useEffect(() => {
    if (defaultPool) loadPool(defaultPool);
  }, [defaultPool, loadPool]);

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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadPool(input);
  }

  const activeRef = deltaRange === "1d" ? snap1d : deltaRange === "7d" ? snap7d : snap30d;

  const rows: AssetRow[] = (snapshot?.assets ?? []).map((a) => ({
    ...a,
    delta1d:  buildDeltaMap(snapshot!.assets, snap1d).get(a.mint)  ?? null,
    delta7d:  buildDeltaMap(snapshot!.assets, snap7d).get(a.mint)  ?? null,
    delta30d: buildDeltaMap(snapshot!.assets, snap30d).get(a.mint) ?? null,
  }));

  const deltas = buildDeltaMap(snapshot?.assets ?? [], activeRef);

  const columns: Column<AssetRow>[] = [
    {
      key: "mint",
      header: "Token",
      sortable: false,
      render: (row) => (
        <WalletLabelCell address={row.mint} label={labels[row.mint]} onSave={saveLabel} />
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
          {shortAddr(row.vault)} ↗
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

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">Pool Tracker</h1>
          {activePool && (
            <div className="flex items-center gap-2 mt-0.5">
              <a
                href={`https://solscan.io/account/${activePool}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#58a6ff] hover:underline font-mono"
              >
                {shortAddr(activePool)} ↗
              </a>
              {lastUpdated && (
                <span className="text-xs text-[#6e7681]">· Last updated: {lastUpdated.toLocaleTimeString()}</span>
              )}
            </div>
          )}
        </div>
        {activePool && (
          <button
            onClick={() => loadPool(activePool, true)}
            disabled={refreshing}
            className="px-4 py-2 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {refreshing && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a Stabble pool address…"
          className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-2.5 text-sm text-[#e6edf3] placeholder-[#6e7681] font-mono outline-none focus:border-[#58a6ff] transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-2.5 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          {loading && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />}
          {loading ? (discovering ? "Discovering vaults…" : "Loading…") : "Search"}
        </button>
      </form>

      {error && (
        <div className="bg-[#5a1e1e] border border-[#f85149] text-[#ffa198] rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Empty / not-yet-searched state */}
      {!loading && !snapshot && !error && (
        <div className="border border-[#30363d] rounded-lg p-8 text-center space-y-2">
          <p className="text-[#8b949e] text-sm">
            Enter any Stabble pool address above to see its asset composition and balances.
          </p>
          <p className="text-xs text-[#6e7681]">
            Vault addresses are discovered automatically from on-chain transaction history — no manual setup needed.
          </p>
        </div>
      )}

      {/* No assets found (pool exists but no transactions yet) */}
      {!loading && snapshot && snapshot.assets.length === 0 && (
        <div className="border border-[#30363d] rounded-lg p-8 text-center space-y-2">
          <p className="text-[#e6edf3] font-medium">No vault data found for this pool</p>
          <p className="text-xs text-[#6e7681]">
            The pool may be brand new with no swap transactions yet, or the address may be incorrect.
          </p>
        </div>
      )}

      {/* Results */}
      {snapshot && snapshot.assets.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {snapshot.assets.map((a) => {
              const label = labels[a.mint] ?? shortAddr(a.mint);
              const delta = deltas.get(a.mint) ?? null;
              return (
                <StatCard key={a.mint} title={label} value={fmtN(a.amount)} delta={delta} />
              );
            })}
          </div>

          {/* Delta range selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#6e7681] mr-2">Compare to:</span>
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
                {r} ago
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
              emptyMessage="No assets"
            />
            <p className="text-xs text-[#6e7681] mt-2">
              Click any token address to add a label. Vault links open on Solscan.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
