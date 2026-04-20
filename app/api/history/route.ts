import { NextResponse } from "next/server";
import { readSnapshots, getSnapshotNearest } from "@/lib/storage";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const snapshots = readSnapshots();

  // Summarised history for the analytics page (timestamp + aggregates only)
  const history = snapshots.map((s) => ({
    timestamp: s.timestamp,
    totalLocked: s.totalLocked,
    totalStaked: s.totalStaked,
    totalInControl: s.totalInControl,
    totalSupply: s.totalSupply ?? 0,
    lockerCount: s.lockers.length,
    grandTotal: s.totalLocked + s.totalStaked + s.totalInControl,
  }));

  // Pre-computed reference snapshots used for delta cards
  const snap1d = getSnapshotNearest(Date.now() - DAY_MS);
  const snap7d = getSnapshotNearest(Date.now() - 7 * DAY_MS);

  return NextResponse.json({ history, snap1d, snap7d });
}
