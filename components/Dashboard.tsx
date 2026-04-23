"use client";

import { useEffect, useState, useCallback } from "react";
import { Snapshot, Labels } from "@/lib/types";
import StatCard from "./StatCard";
import SortableTable, { Column } from "./SortableTable";
import DeltaBadge from "./DeltaBadge";
import WalletLabelCell from "./WalletLabelCell";
import Link from "next/link";

interface LockerRow {
  address: string;
  lockedAmount: number;
  votingWeight: number;
  unlocksAt: number;
  delta1d: number | null;
  delta7d: number | null;
}

interface TreasuryRow {
  source: string;
  address: string;
  note: string;
  tokenAmount: number;
  delta1d: number | null;
}

function fmtN(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Ref = { totalLocked: number; totalStaked: number; totalInControl: number; lockers: { address: string; lockedAmount: number }[]; treasury: { address: string; tokenAmount: number }[] };

function buildLockerDeltas(lockers: Snapshot["lockers"], ref: Ref | null): Map<string, number> {
  if (!ref) return new Map();
  const old = new Map(ref.lockers.map((l) => [l.address, l.lockedAmount]));
  return new Map(lockers.map((l) => [l.address, l.lockedAmount - (old.get(l.address) ?? 0)]));
}

function buildTreasuryDeltas(treasury: Snapshot["treasury"], ref: Ref | null): Map<string, number> {
  if (!ref) return new Map();
  const old = new Map(ref.treasury.map((t) => [t.address, t.tokenAmount]));
  return new Map(treasury.map((t) => [t.address, t.tokenAmount - (old.get(t.address) ?? 0)]));
}

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [labels, setLabels] = useState<Labels>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [snap1d, setSnap1d] = useState<Ref | null>(null);
  const [snap7d, setSnap7d] = useState<Ref | null>(null);

  const load = useCallback(async (force = false) => {
    force ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [snapRes, labelsRes, histRes] = await Promise.all([
        fetch(`/api/snapshot${force ? "?force=true" : ""}`),
        fetch("/api/labels"),
        fetch("/api/history"),
      ]);
      if (!snapRes.ok) throw new Error(await snapRes.text());
      const { snapshot: snap, warning } = await snapRes.json();
      const lbls = await labelsRes.json();
      const hist = await histRes.json();
      if (warning) console.warn("Snapshot warning:", warning);
      setSnapshot(snap);
      setLabels(lbls);
      setSnap1d(hist.snap1d ?? null);
      setSnap7d(hist.snap7d ?? null);
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
        <p className="text-[#8b949e]">Fetching on-chain data…</p>
        <p className="text-xs text-[#6e7681]">This may take ~30 seconds on first load</p>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-[#f85149] font-medium">Failed to load data</p>
        <p className="text-xs text-[#8b949e] max-w-md text-center">{error}</p>
        <button onClick={() => load(true)} className="px-4 py-2 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (!snapshot) return null;

  const d1Lockers = buildLockerDeltas(snapshot.lockers, snap1d);
  const d7Lockers = buildLockerDeltas(snapshot.lockers, snap7d);
  const d1Treasury = buildTreasuryDeltas(snapshot.treasury, snap1d);

  const d1TotalLocked = snap1d ? snapshot.totalLocked - snap1d.totalLocked : null;
  const d1TotalStaked = snap1d ? snapshot.totalStaked - snap1d.totalStaked : null;
  const grandTotal = snapshot.totalInControl + snapshot.totalLocked + snapshot.totalStaked;
  const circulating = snapshot.totalSupply > 0 ? snapshot.totalSupply - grandTotal : null;

  const lockerRows: LockerRow[] = snapshot.lockers.map((l) => ({
    ...l,
    delta1d: d1Lockers.get(l.address) ?? null,
    delta7d: d7Lockers.get(l.address) ?? null,
  }));

  const treasuryRows: TreasuryRow[] = snapshot.treasury.map((t) => ({
    ...t,
    delta1d: d1Treasury.get(t.address) ?? null,
  }));

  const lockerCols: Column<LockerRow>[] = [
    {
      key: "address",
      header: "Wallet",
      sortable: false,
      render: (row) => (
        <WalletLabelCell address={row.address} label={labels[row.address]} onSave={saveLabel} />
      ),
    },
    {
      key: "lockedAmount",
      header: "Locked",
      sortable: true,
      align: "right",
      render: (row) => fmtN(row.lockedAmount),
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
      key: "votingWeight",
      header: "Voting Weight",
      sortable: true,
      align: "right",
      render: (row) => fmtN(row.votingWeight),
    },
    {
      key: "unlocksAt",
      header: "Unlocks",
      sortable: true,
      align: "right",
      render: (row) => new Date(row.unlocksAt * 1000).toISOString().slice(0, 10),
    },
  ];

  const treasuryCols: Column<TreasuryRow>[] = [
    { key: "source", header: "Source", sortable: true },
    {
      key: "address",
      header: "Wallet",
      sortable: false,
      render: (row) => (
        <WalletLabelCell address={row.address} label={labels[row.address]} onSave={saveLabel} />
      ),
    },
    {
      key: "tokenAmount",
      header: "Balance",
      sortable: true,
      align: "right",
      render: (row) => fmtN(row.tokenAmount),
    },
    {
      key: "delta1d",
      header: "Δ 1d",
      sortable: true,
      align: "right",
      value: (row) => row.delta1d,
      render: (row) => <DeltaBadge value={row.delta1d} />,
    },
    { key: "note", header: "Note", sortable: false },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">STB Token Dashboard</h1>
          {lastUpdated && (
            <p className="text-xs text-[#6e7681] mt-0.5">
              Last updated: {lastUpdated.toLocaleTimeString()}
              {snap1d === null && " · No historical data yet — check back after 24h for deltas"}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Link href="/analytics" className="px-4 py-2 bg-[#21262d] text-[#8b949e] rounded-lg text-sm hover:bg-[#30363d] hover:text-[#e6edf3] transition-colors border border-[#30363d]">
            Analytics →
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
        <StatCard title="Supply" value={snapshot.totalSupply > 0 ? fmtN(snapshot.totalSupply) : "—"} />
        <StatCard title="Total Locked" value={fmtN(snapshot.totalLocked)} delta={d1TotalLocked} />
        <StatCard title="Total Staked" value={fmtN(snapshot.totalStaked)} delta={d1TotalStaked} />
        <StatCard
          title="Circulating"
          value={circulating !== null ? fmtN(circulating) : "—"}
        />
      </div>

      {/* Lockers table */}
      <section>
        <h2 className="text-lg font-semibold text-[#e6edf3] mb-3">
          Vote-Locked Positions
          <span className="ml-2 text-sm font-normal text-[#8b949e]">({snapshot.lockers.length})</span>
        </h2>
        <SortableTable
          columns={lockerCols}
          data={lockerRows}
          rowKey={(r) => r.address}
          emptyMessage="No lockers found"
        />
      </section>

      {/* Treasury table */}
      <section>
        <h2 className="text-lg font-semibold text-[#e6edf3] mb-3">Treasury Wallets</h2>
        <SortableTable
          columns={treasuryCols}
          data={treasuryRows}
          rowKey={(r) => r.address + r.note}
          emptyMessage="No treasury wallets"
        />
      </section>
    </div>
  );
}
