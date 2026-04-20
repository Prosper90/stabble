import { NextRequest, NextResponse } from "next/server";
import { fetchHolders } from "@/lib/solana";
import {
  getLatestHoldersSnapshot,
  saveHoldersSnapshot,
  getHoldersSnapshotNearest,
} from "@/lib/storage";

const CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "true";

  if (!force) {
    const cached = getLatestHoldersSnapshot();
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const snap1d = getHoldersSnapshotNearest(cached.timestamp - DAY_MS);
      const snap7d = getHoldersSnapshotNearest(cached.timestamp - 7 * DAY_MS);
      return NextResponse.json({ snapshot: cached, snap1d, snap7d, cached: true });
    }
  }

  try {
    const snapshot = await fetchHolders(100_000);
    saveHoldersSnapshot(snapshot);
    const snap1d = getHoldersSnapshotNearest(snapshot.timestamp - DAY_MS);
    const snap7d = getHoldersSnapshotNearest(snapshot.timestamp - 7 * DAY_MS);
    return NextResponse.json({ snapshot, snap1d, snap7d, cached: false });
  } catch (err) {
    const fallback = getLatestHoldersSnapshot();
    if (fallback) {
      const snap1d = getHoldersSnapshotNearest(fallback.timestamp - DAY_MS);
      const snap7d = getHoldersSnapshotNearest(fallback.timestamp - 7 * DAY_MS);
      return NextResponse.json(
        { snapshot: fallback, snap1d, snap7d, cached: true, warning: String(err) },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
