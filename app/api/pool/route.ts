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
  const address = (req.nextUrl.searchParams.get("address") ?? process.env.POOL_ADDRESS ?? "").trim();
  const force = req.nextUrl.searchParams.get("force") === "true";

  if (!address) {
    return NextResponse.json({ snapshot: null, snap1d: null, snap7d: null, snap30d: null });
  }

  if (!force) {
    const cached = getLatestPoolSnapshot(address);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const snap1d  = getPoolSnapshotNearest(address, cached.timestamp - DAY_MS);
      const snap7d  = getPoolSnapshotNearest(address, cached.timestamp - 7 * DAY_MS);
      const snap30d = getPoolSnapshotNearest(address, cached.timestamp - 30 * DAY_MS);
      return NextResponse.json({ snapshot: cached, snap1d, snap7d, snap30d, cached: true });
    }
  }

  try {
    const snapshot = await fetchPool(address);
    if (snapshot.assets.length > 0) savePoolSnapshot(snapshot);
    const snap1d  = getPoolSnapshotNearest(address, snapshot.timestamp - DAY_MS);
    const snap7d  = getPoolSnapshotNearest(address, snapshot.timestamp - 7 * DAY_MS);
    const snap30d = getPoolSnapshotNearest(address, snapshot.timestamp - 30 * DAY_MS);
    return NextResponse.json({ snapshot, snap1d, snap7d, snap30d, cached: false });
  } catch (err) {
    const fallback = getLatestPoolSnapshot(address);
    if (fallback) {
      const snap1d  = getPoolSnapshotNearest(address, fallback.timestamp - DAY_MS);
      const snap7d  = getPoolSnapshotNearest(address, fallback.timestamp - 7 * DAY_MS);
      const snap30d = getPoolSnapshotNearest(address, fallback.timestamp - 30 * DAY_MS);
      return NextResponse.json(
        { snapshot: fallback, snap1d, snap7d, snap30d, cached: true, warning: String(err) },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
