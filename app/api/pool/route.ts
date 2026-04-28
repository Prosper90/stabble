import { NextRequest, NextResponse } from "next/server";
import { fetchPool } from "@/lib/solana";
import {
  getLatestPoolSnapshot,
  savePoolSnapshot,
  getPoolSnapshotNearest,
} from "@/lib/storage";

const CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "true";

  if (!force) {
    const cached = getLatestPoolSnapshot();
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const snap1d = getPoolSnapshotNearest(cached.timestamp - DAY_MS);
      const snap7d = getPoolSnapshotNearest(cached.timestamp - 7 * DAY_MS);
      const snap30d = getPoolSnapshotNearest(cached.timestamp - 30 * DAY_MS);
      return NextResponse.json({ snapshot: cached, snap1d, snap7d, snap30d, cached: true });
    }
  }

  try {
    const snapshot = await fetchPool();
    if (snapshot.assets.length > 0) savePoolSnapshot(snapshot);
    const snap1d = getPoolSnapshotNearest(snapshot.timestamp - DAY_MS);
    const snap7d = getPoolSnapshotNearest(snapshot.timestamp - 7 * DAY_MS);
    const snap30d = getPoolSnapshotNearest(snapshot.timestamp - 30 * DAY_MS);
    return NextResponse.json({ snapshot, snap1d, snap7d, snap30d, cached: false });
  } catch (err) {
    const fallback = getLatestPoolSnapshot();
    if (fallback) {
      const snap1d = getPoolSnapshotNearest(fallback.timestamp - DAY_MS);
      const snap7d = getPoolSnapshotNearest(fallback.timestamp - 7 * DAY_MS);
      const snap30d = getPoolSnapshotNearest(fallback.timestamp - 30 * DAY_MS);
      return NextResponse.json(
        { snapshot: fallback, snap1d, snap7d, snap30d, cached: true, warning: String(err) },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
