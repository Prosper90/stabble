import { NextRequest, NextResponse } from "next/server";
import { fetchPool } from "@/lib/solana";
import {
  getLatestPoolSnapshot,
  savePoolSnapshot,
  getPoolSnapshotNearest,
} from "@/lib/storage";
import type { PoolSnapshot } from "@/lib/types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

async function backendNearest(backendUrl: string, address: string, t: number): Promise<PoolSnapshot | null> {
  try {
    const res = await fetch(`${backendUrl}/api/snapshots/${address}/nearest?t=${t}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return await res.json() as PoolSnapshot;
  } catch {
    return null;
  }
}

async function getHistoricalSnaps(address: string, refTimestamp: number): Promise<{
  snap1d: PoolSnapshot | null;
  snap7d: PoolSnapshot | null;
  snap30d: PoolSnapshot | null;
}> {
  const backendUrl = process.env.BACKEND_URL;

  if (backendUrl) {
    const [snap1d, snap7d, snap30d] = await Promise.all([
      backendNearest(backendUrl, address, refTimestamp - DAY_MS),
      backendNearest(backendUrl, address, refTimestamp - 7 * DAY_MS),
      backendNearest(backendUrl, address, refTimestamp - 30 * DAY_MS),
    ]);
    // If backend returned at least one result, use it (others may be null if not enough history yet)
    if (snap1d || snap7d || snap30d) {
      return { snap1d, snap7d, snap30d };
    }
  }

  // Fall back to local JSON
  return {
    snap1d:  getPoolSnapshotNearest(address, refTimestamp - DAY_MS),
    snap7d:  getPoolSnapshotNearest(address, refTimestamp - 7 * DAY_MS),
    snap30d: getPoolSnapshotNearest(address, refTimestamp - 30 * DAY_MS),
  };
}

export async function GET(req: NextRequest) {
  const address = (req.nextUrl.searchParams.get("address") ?? process.env.POOL_ADDRESS ?? "").trim();
  const force = req.nextUrl.searchParams.get("force") === "true";

  if (!address) {
    return NextResponse.json({ snapshot: null, snap1d: null, snap7d: null, snap30d: null });
  }

  if (!force) {
    const cached = getLatestPoolSnapshot(address);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const { snap1d, snap7d, snap30d } = await getHistoricalSnaps(address, cached.timestamp);
      return NextResponse.json({ snapshot: cached, snap1d, snap7d, snap30d, cached: true });
    }
  }

  try {
    const snapshot = await fetchPool(address);
    if (snapshot.assets.length > 0) {
      savePoolSnapshot(snapshot);
      // Register pool with backend tracker (fire-and-forget)
      const backendUrl = process.env.BACKEND_URL;
      if (backendUrl) {
        fetch(`${backendUrl}/api/pools/${address}`, { method: "POST" }).catch(() => {});
      }
    }
    const { snap1d, snap7d, snap30d } = await getHistoricalSnaps(address, snapshot.timestamp);
    return NextResponse.json({ snapshot, snap1d, snap7d, snap30d, cached: false });
  } catch (err) {
    const fallback = getLatestPoolSnapshot(address);
    if (fallback) {
      const { snap1d, snap7d, snap30d } = await getHistoricalSnaps(address, fallback.timestamp);
      return NextResponse.json(
        { snapshot: fallback, snap1d, snap7d, snap30d, cached: true, warning: String(err) },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
