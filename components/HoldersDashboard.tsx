"use client";

import { useEffect, useState, useCallback } from "react";
import { HolderEntry, HoldersSnapshot, Labels } from "@/lib/types";
import StatCard from "./StatCard";
import SortableTable, { Column } from "./SortableTable";
import DeltaBadge from "./DeltaBadge";
import WalletLabelCell from "./WalletLabelCell";
import Link from "next/link";

type Category = "all" | "holder" | "staker" | "locker";

interface HolderRow extends HolderEntry {
  rank: number;
  delta1d: number | null;
  delta7d: number | null;
}

function fmtN(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CategoryBadge({ cat }: { cat: "holder" | "staker" | "locker" }) {
  const styles = {
    holder: "bg-[#1f4068] text-[#58a6ff] border-[#1c3556]",
    staker: "bg-[#1a3a2a] text-[#3fb950] border-[#1a3a2a]",
    locker: "bg-[#3a1f5e] text-[#d2a8ff] border-[#3a1f5e]",
  };
  return (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ${styles[cat]} mr-1`}>
      {cat}
    </span>
  );
}

function buildDeltaMap(
  current: HolderEntry[],
  ref: HoldersSnapshot | null
): Map<string, number> {
  if (!ref) return new Map();
  const old = new Map(ref.holders.map((h) => [h.address, h.totalBalance]));
  return new Map(current.map((h) => [h.address, h.totalBalance - (old.get(h.address) ?? 0)]));
}

export default function HoldersDashboard() {
  const [snapshot, setSnapshot] = useState<HoldersSnapshot | null>(null);
  const [snap1d, setSnap1d] = useState<HoldersSnapshot | null>(null);
  const [snap7d, setSnap7d] = useState<HoldersSnapshot | null>(null);
  const [labels, setLabels] = useState<Labels>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilter, setActiveFilter] = useState<Category>("all");

  const load = useCallback(async (force = false) => {
    force ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [holdersRes, labelsRes] = await Promise.all([
        fetch(`/api/holders${force ? "?force=true" : ""}`),
        fetch("/api/labels"),
      ]);
      if (!holdersRes.ok) throw new Error(await holdersRes.text());
      const { snapshot: snap, snap1d: s1d, snap7d: s7d, warning } = await holdersRes.json();
      if (warning) console.warn("Holders warning:", warning);
      setSnapshot(snap);
      setSnap1d(s1d ?? null);
      setSnap7d(s7d ?? null);
      setLabels(await labelsRes.json());
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
        <p className="text-[#8b949e]">Fetching all STB holders from chain…</p>
        <p className="text-xs text-[#6e7681]">This may take 30–60 seconds on first load</p>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-[#f85149] font-medium">Failed to load holders</p>
        <p className="text-xs text-[#8b949e] max-w-md text-center">{error}</p>
        <button onClick={() => load(true)} className="px-4 py-2 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (!snapshot) return null;

  const delta1dMap = buildDeltaMap(snapshot.holders, snap1d);
  const delta7dMap = buildDeltaMap(snapshot.holders, snap7d);

  const allHolders = snapshot.holders;
  const walletOnly = allHolders.filter((h) => h.categories.length === 1 && h.categories[0] === "holder");
  const stakers = allHolders.filter((h) => h.categories.includes("staker"));
  const lockers = allHolders.filter((h) => h.categories.includes("locker"));

  const filtered = activeFilter === "all"
    ? allHolders
    : allHolders.filter((h) => h.categories.includes(activeFilter));

  const rows: HolderRow[] = filtered.map((h, i) => ({
    ...h,
    rank: i + 1,
    delta1d: delta1dMap.get(h.address) ?? null,
    delta7d: delta7dMap.get(h.address) ?? null,
  }));

  const d1Count = snap1d ? allHolders.length - snap1d.holders.length : null;

  const columns: Column<HolderRow>[] = [
    {
      key: "rank",
      header: "#",
      sortable: true,
      align: "right",
      render: (row) => <span className="text-[#6e7681]">{row.rank}</span>,
    },
    {
      key: "address",
      header: "Wallet",
      sortable: false,
      render: (row) => (
        <WalletLabelCell address={row.address} label={labels[row.address]} onSave={saveLabel} />
      ),
    },
    {
      key: "categories",
      header: "Type",
      sortable: false,
      render: (row) => (
        <span>{row.categories.map((c) => <CategoryBadge key={c} cat={c} />)}</span>
      ),
    },
    {
      key: "walletBalance",
      header: "Wallet",
      sortable: true,
      align: "right",
      render: (row) => row.walletBalance > 0 ? fmtN(row.walletBalance) : <span className="text-[#6e7681]">—</span>,
    },
    {
      key: "stakedAmount",
      header: "Staked",
      sortable: true,
      align: "right",
      render: (row) => row.stakedAmount > 0 ? fmtN(row.stakedAmount) : <span className="text-[#6e7681]">—</span>,
    },
    {
      key: "lockedAmount",
      header: "Locked",
      sortable: true,
      align: "right",
      render: (row) => row.lockedAmount > 0 ? fmtN(row.lockedAmount) : <span className="text-[#6e7681]">—</span>,
    },
    {
      key: "totalBalance",
      header: "Total",
      sortable: true,
      align: "right",
      render: (row) => <span className="font-medium text-[#e6edf3]">{fmtN(row.totalBalance)}</span>,
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
  ];

  const filterTabs: { key: Category; label: string; count: number }[] = [
    { key: "all", label: "All", count: allHolders.length },
    { key: "holder", label: "Wallet only", count: walletOnly.length },
    { key: "staker", label: "Stakers", count: stakers.length },
    { key: "locker", label: "Lockers", count: lockers.length },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">STB Holders</h1>
          <p className="text-xs text-[#6e7681] mt-0.5">
            Wallets with ≥ {(snapshot.minBalance).toLocaleString()} STB · {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ""}
            {snap1d === null && " · No 1d data yet"}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="px-4 py-2 bg-[#21262d] text-[#8b949e] rounded-lg text-sm hover:bg-[#30363d] hover:text-[#e6edf3] transition-colors border border-[#30363d]">
            ← Dashboard
          </Link>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {refreshing && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#5a1e1e] border border-[#f85149] text-[#ffa198] rounded-lg px-4 py-3 text-sm">
          Warning: {error}. Showing cached data.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Holders" value={String(allHolders.length)} delta={d1Count} />
        <StatCard title="Wallet Only" value={String(walletOnly.length)} />
        <StatCard title="Stakers" value={String(stakers.length)} />
        <StatCard title="Lockers" value={String(lockers.length)} />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              activeFilter === tab.key
                ? "bg-[#58a6ff] text-[#0d1117] border-[#58a6ff]"
                : "bg-[#21262d] text-[#8b949e] border-[#30363d] hover:text-[#e6edf3] hover:bg-[#30363d]"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${activeFilter === tab.key ? "text-[#0d1117]/70" : "text-[#6e7681]"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Holders table */}
      <SortableTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.address}
        emptyMessage="No holders found"
      />
    </div>
  );
}
