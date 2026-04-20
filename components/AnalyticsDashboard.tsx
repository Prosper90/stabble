"use client";

import { useEffect, useState } from "react";
import StatCard from "./StatCard";
import Link from "next/link";

interface HistoryRow {
  timestamp: number;
  totalLocked: number;
  totalStaked: number;
  totalInControl: number;
  totalSupply: number;
  lockerCount: number;
  grandTotal: number;
}

interface RefSnap {
  totalLocked: number;
  totalStaked: number;
  totalInControl: number;
  lockerCount: number;
}

function fmtN(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function AnalyticsDashboard() {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [snap1d, setSnap1d] = useState<RefSnap | null>(null);
  const [snap7d, setSnap7d] = useState<RefSnap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => {
        setHistory(d.history ?? []);
        setSnap1d(d.snap1d ?? null);
        setSnap7d(d.snap7d ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-20 text-[#8b949e]">
        <p className="text-lg">No historical data yet.</p>
        <p className="text-sm mt-2">Visit the dashboard and refresh a few times to start building history.</p>
        <Link href="/" className="mt-6 inline-block px-4 py-2 bg-[#238636] text-white rounded-lg text-sm hover:bg-[#2ea043] transition-colors">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const latest = history[history.length - 1];

  const d1Locked = snap1d ? latest.totalLocked - snap1d.totalLocked : null;
  const d1Staked = snap1d ? latest.totalStaked - snap1d.totalStaked : null;
  const d1InControl = snap1d ? latest.totalInControl - snap1d.totalInControl : null;
  const d1LockerCount = snap1d ? latest.lockerCount - (snap1d.lockerCount ?? 0) : null;

  const d7Locked = snap7d ? latest.totalLocked - snap7d.totalLocked : null;
  const d7Staked = snap7d ? latest.totalStaked - snap7d.totalStaked : null;
  const d7LockerCount = snap7d ? latest.lockerCount - (snap7d.lockerCount ?? 0) : null;

  const circulating = latest.totalSupply > 0
    ? latest.totalSupply - latest.grandTotal
    : null;

  const circ1d = snap1d && latest.totalSupply > 0
    ? circulating! - (latest.totalSupply - (snap1d.totalLocked + snap1d.totalStaked + snap1d.totalInControl))
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">Analytics</h1>
          <p className="text-xs text-[#6e7681] mt-0.5">{history.length} snapshots · {fmtDate(history[0].timestamp)} → {fmtDate(latest.timestamp)}</p>
        </div>
        <Link href="/" className="px-4 py-2 bg-[#21262d] text-[#8b949e] rounded-lg text-sm hover:bg-[#30363d] hover:text-[#e6edf3] transition-colors border border-[#30363d]">
          ← Dashboard
        </Link>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8b949e] mb-3">1-Day Changes</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Staking Δ 1d" value={d1Staked !== null ? fmtN(d1Staked) : "—"} delta={d1Staked} />
          <StatCard title="Locked Δ 1d" value={d1Locked !== null ? fmtN(d1Locked) : "—"} delta={d1Locked} />
          <StatCard title="Treasury Δ 1d" value={d1InControl !== null ? fmtN(d1InControl) : "—"} delta={d1InControl} />
          <StatCard
            title="New Lockers 1d"
            value={d1LockerCount !== null ? (d1LockerCount >= 0 ? `+${d1LockerCount}` : String(d1LockerCount)) : "—"}
          />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8b949e] mb-3">7-Day Changes</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard title="Staking Δ 7d" value={d7Staked !== null ? fmtN(d7Staked) : "—"} delta={d7Staked} />
          <StatCard title="Locked Δ 7d" value={d7Locked !== null ? fmtN(d7Locked) : "—"} delta={d7Locked} />
          <StatCard
            title="New Lockers 7d"
            value={d7LockerCount !== null ? (d7LockerCount >= 0 ? `+${d7LockerCount}` : String(d7LockerCount)) : "—"}
          />
        </div>
      </div>

      {circulating !== null && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8b949e] mb-3">Circulating Supply</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title="Circulating Now" value={fmtN(circulating)} delta={circ1d} />
            <StatCard title="Total Supply" value={fmtN(latest.totalSupply)} />
            <StatCard title="% Circulating" value={((circulating / latest.totalSupply) * 100).toFixed(2) + "%"} />
          </div>
        </div>
      )}

      {/* Snapshot history table */}
      <section>
        <h2 className="text-lg font-semibold text-[#e6edf3] mb-3">Snapshot History</h2>
        <div className="overflow-x-auto rounded-lg border border-[#30363d]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363d]">
                {["Time", "Locked", "Staked", "Treasury", "Grand Total", "Lockers"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#8b949e] text-right first:text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((row) => (
                <tr key={row.timestamp} className="border-b border-[#21262d] hover:bg-[#161b22] transition-colors last:border-0">
                  <td className="px-4 py-3 text-[#8b949e] text-xs whitespace-nowrap">{fmtDate(row.timestamp)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#e6edf3]">{fmtN(row.totalLocked)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#e6edf3]">{fmtN(row.totalStaked)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#e6edf3]">{fmtN(row.totalInControl)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#e6edf3] font-medium">{fmtN(row.grandTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#8b949e]">{row.lockerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
