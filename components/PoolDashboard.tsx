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
  symbol: string;
  amount: number;
  decimals: number;
  usdValue: number | null;
  delta1d: number | null;
  delta7d: number | null;
  delta30d: number | null;
}

type RefSnap = { assets: { mint: string; amount: number }[] } | null;

function fmtN(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
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
  locked?: boolean;
}

export default function PoolDashboard({ defaultPool = "", locked = false }: Props) {
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

      setSnapshot(snap);
      setLabels(await labelsRes.json());
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
  const deltas = buildDeltaMap(snapshot?.assets ?? [], activeRef);

  const rows: AssetRow[] = (snapshot?.assets ?? []).map((a) => ({
    vault: a.vault,
    mint: a.mint,
    symbol: labels[a.mint] ?? a.symbol ?? shortAddr(a.mint),
    amount: a.amount,
    decimals: a.decimals,
    usdValue: a.usdPrice != null ? a.amount * a.usdPrice : null,
    delta1d:  buildDeltaMap(snapshot!.assets, snap1d).get(a.mint)  ?? null,
    delta7d:  buildDeltaMap(snapshot!.assets, snap7d).get(a.mint)  ?? null,
    delta30d: buildDeltaMap(snapshot!.assets, snap30d).get(a.mint) ?? null,
  }));

  // Stabble uses a shared vault — all rows reference the pool account itself.
  // Hide the Vault column when every row has the same vault address to avoid repetition.
  const showVaultCol = rows.length > 0 && !rows.every((r) => r.vault === rows[0].vault);

  const columns: Column<AssetRow>[] = [
    {
      key: "symbol",
      header: "Token",
      sortable: false,
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-[#e6edf3]">{row.symbol}</span>
          <WalletLabelCell address={row.mint} label={labels[row.mint]} onSave={saveLabel} />
        </div>
      ),
    },
    ...(showVaultCol ? [{
      key: "vault" as const,
      header: "Vault",
      sortable: false,
      render: (row: AssetRow) => (
        <button
          onClick={() => window.open(`https://solscan.io/account/${row.vault}`, "_blank", "noopener,noreferrer")}
          className="font-mono text-xs text-[#8b949e] hover:text-[#58a6ff] transition-colors flex items-center gap-1"
        >
          {shortAddr(row.vault)}
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
            <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z" />
          </svg>
        </button>
      ),
    } as Column<AssetRow>] : []),
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      render: (row) => fmtN(row.amount),
    },
    {
      key: "usdValue",
      header: "Value (USD)",
      sortable: true,
      align: "right",
      value: (row) => row.usdValue,
      render: (row) =>
        row.usdValue != null ? (
          <span className="text-[#e6edf3]">{fmtUsd(row.usdValue)}</span>
        ) : (
          <span className="text-[#6e7681]">—</span>
        ),
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
              <button
                onClick={() => window.open(`https://solscan.io/account/${activePool}`, "_blank", "noopener,noreferrer")}
                className="text-xs text-[#58a6ff] hover:underline font-mono"
              >
                {shortAddr(activePool)} ↗
              </button>
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
          onChange={(e) => !locked && setInput(e.target.value)}
          readOnly={locked}
          placeholder="Paste a Stabble pool address…"
          className={[
            "flex-1 border rounded-lg px-4 py-2.5 text-sm font-mono outline-none transition-colors",
            locked
              ? "bg-[#0d1117] border-[#21262d] text-[#6e7681] cursor-not-allowed select-none"
              : "bg-[#161b22] border-[#30363d] text-[#e6edf3] placeholder-[#6e7681] focus:border-[#58a6ff]",
          ].join(" ")}
        />
        {!locked && (
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {loading && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />}
            {loading ? "Loading…" : "Search"}
          </button>
        )}
      </form>

      {error && (
        <div className="bg-[#5a1e1e] border border-[#f85149] text-[#ffa198] rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !snapshot && !error && (
        <div className="border border-[#30363d] rounded-lg p-8 text-center">
          <p className="text-[#8b949e] text-sm">Loading pool data…</p>
        </div>
      )}

      {!loading && snapshot && snapshot.assets.length === 0 && (
        <div className="border border-[#30363d] rounded-lg p-8 text-center space-y-2">
          <p className="text-[#e6edf3] font-medium">No vault data found for this pool</p>
          <p className="text-xs text-[#6e7681]">
            The pool may be brand new with no swap transactions yet, or the address may be incorrect.
          </p>
        </div>
      )}

      {snapshot && snapshot.assets.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {snapshot.assets.map((a) => {
              const symbol = labels[a.mint] ?? a.symbol ?? shortAddr(a.mint);
              const delta = deltas.get(a.mint) ?? null;
              const usdValue = a.usdPrice != null ? a.amount * a.usdPrice : null;
              return (
                <StatCard
                  key={a.mint}
                  title={symbol}
                  value={fmtN(a.amount)}
                  sub={usdValue != null ? fmtUsd(usdValue) : undefined}
                  delta={delta}
                  deltaLabel={deltaRange}
                />
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
              Hover any token address to copy, label, or view on Solscan.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
