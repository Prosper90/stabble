import { NextRequest, NextResponse } from "next/server";
import { fetchPositions } from "@/lib/solana";
import {
  getLatestPositionsSnapshot,
  savePositionsSnapshot,
  getPositionsSnapshotNearest,
} from "@/lib/storage";

const CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "true";

  if (!force) {
    const cached = getLatestPositionsSnapshot();
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const snap1d = getPositionsSnapshotNearest(cached.timestamp - DAY_MS);
      const snap7d = getPositionsSnapshotNearest(cached.timestamp - 7 * DAY_MS);
      return NextResponse.json({ snapshot: cached, snap1d, snap7d, cached: true });
    }
  }

  try {
    const snapshot = await fetchPositions();
    savePositionsSnapshot(snapshot);
    const snap1d = getPositionsSnapshotNearest(snapshot.timestamp - DAY_MS);
    const snap7d = getPositionsSnapshotNearest(snapshot.timestamp - 7 * DAY_MS);
    return NextResponse.json({ snapshot, snap1d, snap7d, cached: false });
  } catch (err) {
    const fallback = getLatestPositionsSnapshot();
    if (fallback) {
      const snap1d = getPositionsSnapshotNearest(fallback.timestamp - DAY_MS);
      const snap7d = getPositionsSnapshotNearest(fallback.timestamp - 7 * DAY_MS);
      return NextResponse.json(
        { snapshot: fallback, snap1d, snap7d, cached: true, warning: String(err) },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
