"use client";

import { useEffect, useState, useCallback } from "react";
import { PositionEntry, PositionsSnapshot, Labels } from "@/lib/types";
import StatCard from "./StatCard";
import SortableTable, { Column } from "./SortableTable";
import DeltaBadge from "./DeltaBadge";
import WalletLabelCell from "./WalletLabelCell";
import Link from "next/link";

type Filter = "all" | "staker" | "locker";

interface PositionRow extends PositionEntry {
  rank: number;
  delta1d: number | null;
  delta7d: number | null;
}

function fmtN(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TypeBadge({ cat }: { cat: "staker" | "locker" }) {
  const styles = {
    staker: "bg-[#1a3a2a] text-[#3fb950] border-[#1a3a2a]",
    locker: "bg-[#3a1f5e] text-[#d2a8ff] border-[#3a1f5e]",
  };
  return (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ${styles[cat]} mr-1`}>
      {cat}
    </span>
  );
}

function buildDeltaMap(current: PositionEntry[], ref: PositionsSnapshot | null): Map<string, number> {
  if (!ref) return new Map();
  const old = new Map(ref.entries.map((e) => [e.address, e.totalAmount]));
  return new Map(current.map((e) => [e.address, e.totalAmount - (old.get(e.address) ?? 0)]));
}

export default function PositionsDashboard() {
  const [snapshot, setSnapshot] = useState<PositionsSnapshot | null>(null);
  const [snap1d, setSnap1d] = useState<PositionsSnapshot | null>(null);
  const [snap7d, setSnap7d] = useState<PositionsSnapshot | null>(null);
  const [labels, setLabels] = useState<Labels>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async (force = false) => {
    force ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [posRes, labelsRes] = await Promise.all([
        fetch(`/api/positions${force ? "?force=true" : ""}`),
        fetch("/api/labels"),
      ]);
      if (!posRes.ok) throw new Error(await posRes.text());
      const { snapshot: snap, snap1d: s1d, snap7d: s7d, warning } = await posRes.json();
      if (warning) console.warn("Positions warning:", warning);
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
        <p className="text-[#8b949e]">Fetching stakers &amp; lockers…</p>
        <p className="text-xs text-[#6e7681]">This may take ~20 seconds</p>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-[#f85149] font-medium">Failed to load positions</p>
        <p className="text-xs text-[#8b949e] max-w-md text-center">{error}</p>
        <button onClick={() => load(true)} className="px-4 py-2 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (!snapshot) return null;

  const delta1dMap = buildDeltaMap(snapshot.entries, snap1d);
  const delta7dMap = buildDeltaMap(snapshot.entries, snap7d);

  const allEntries = snapshot.entries;
  const stakers = allEntries.filter((e) => e.categories.includes("staker"));
  const lockers = allEntries.filter((e) => e.categories.includes("locker"));
  const both = allEntries.filter((e) => e.categories.length === 2);

  const totalStaked = stakers.reduce((s, e) => s + e.stakedAmount, 0);
  const totalLocked = lockers.reduce((s, e) => s + e.lockedAmount, 0);
  const d1StakerCount = snap1d ? stakers.length - snap1d.entries.filter((e) => e.categories.includes("staker")).length : null;
  const d1LockerCount = snap1d ? lockers.length - snap1d.entries.filter((e) => e.categories.includes("locker")).length : null;

  const filtered = filter === "all" ? allEntries
    : allEntries.filter((e) => e.categories.includes(filter));

  const rows: PositionRow[] = filtered.map((e, i) => ({
    ...e,
    rank: i + 1,
    delta1d: delta1dMap.get(e.address) ?? null,
    delta7d: delta7dMap.get(e.address) ?? null,
  }));

  const columns: Column<PositionRow>[] = [
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
      render: (row) => <span>{row.categories.map((c) => <TypeBadge key={c} cat={c} />)}</span>,
    },
    {
      key: "stakedAmount",
      header: "Staked",
      sortable: true,
      align: "right",
      render: (row) => row.stakedAmount > 0
        ? fmtN(row.stakedAmount)
        : <span className="text-[#6e7681]">—</span>,
    },
    {
      key: "lockedAmount",
      header: "Locked",
      sortable: true,
      align: "right",
      render: (row) => row.lockedAmount > 0
        ? fmtN(row.lockedAmount)
        : <span className="text-[#6e7681]">—</span>,
    },
    {
      key: "totalAmount",
      header: "Total",
      sortable: true,
      align: "right",
      render: (row) => <span className="font-medium text-[#e6edf3]">{fmtN(row.totalAmount)}</span>,
    },
    {
      key: "unlocksAt",
      header: "Unlocks",
      sortable: true,
      align: "right",
      value: (row) => row.unlocksAt ?? 0,
      render: (row) => row.unlocksAt
        ? new Date(row.unlocksAt * 1000).toISOString().slice(0, 10)
        : <span className="text-[#6e7681]">—</span>,
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

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: allEntries.length },
    { key: "staker", label: "Stakers", count: stakers.length },
    { key: "locker", label: "Lockers", count: lockers.length },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">Stakers &amp; Lockers</h1>
          <p className="text-xs text-[#6e7681] mt-0.5">
            All wallets with active stake or lock positions
            {lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ""}
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
        <StatCard title="Total Stakers" value={String(stakers.length)} delta={d1StakerCount} />
        <StatCard title="Total Staked" value={fmtN(totalStaked)} />
        <StatCard title="Total Lockers" value={String(lockers.length)} delta={d1LockerCount} />
        <StatCard title="Total Locked" value={fmtN(totalLocked)} />
      </div>

      {both.length > 0 && (
        <p className="text-xs text-[#8b949e]">
          {both.length} wallet{both.length > 1 ? "s" : ""} appear in both stakers and lockers.
        </p>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              filter === tab.key
                ? "bg-[#58a6ff] text-[#0d1117] border-[#58a6ff]"
                : "bg-[#21262d] text-[#8b949e] border-[#30363d] hover:text-[#e6edf3] hover:bg-[#30363d]"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${filter === tab.key ? "text-[#0d1117]/70" : "text-[#6e7681]"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <SortableTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.address}
        emptyMessage="No positions found"
      />
    </div>
  );
}
