import { NextRequest, NextResponse } from "next/server";
import { fetchPool } from "@/lib/solana";
import {
  getLatestPoolSnapshot,
  savePoolSnapshot,
  getPoolSnapshotNearest,
} from "@/lib/storage";
import type { PoolAsset, PoolSnapshot } from "@/lib/types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

async function fetchSymbols(mints: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    mints.map(async (mint) => {
      try {
        const res = await fetch(`https://tokens.jup.ag/token/${mint}`, { next: { revalidate: 3600 } });
        if (res.ok) {
          const data = await res.json();
          if (data.symbol) results[mint] = data.symbol;
        }
      } catch { /* skip */ }
    })
  );
  return results;
}

async function fetchPrices(mints: string[]): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      `https://api.jup.ag/price/v2?ids=${mints.join(",")}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return {};
    const json = await res.json();
    const prices: Record<string, number> = {};
    for (const [mint, d] of Object.entries(json.data as Record<string, { price: string }>)) {
      const p = parseFloat(d.price);
      if (!isNaN(p)) prices[mint] = p;
    }
    return prices;
  } catch {
    return {};
  }
}

async function enrich(assets: PoolAsset[]): Promise<PoolAsset[]> {
  const mints = assets.map((a) => a.mint);
  const [symbols, prices] = await Promise.all([fetchSymbols(mints), fetchPrices(mints)]);
  return assets.map((a) => ({
    ...a,
    symbol: symbols[a.mint],
    usdPrice: prices[a.mint],
  }));
}

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

async function getHistoricalSnaps(address: string, refTimestamp: number) {
  const backendUrl = process.env.BACKEND_URL;
  if (backendUrl) {
    const [snap1d, snap7d, snap30d] = await Promise.all([
      backendNearest(backendUrl, address, refTimestamp - DAY_MS),
      backendNearest(backendUrl, address, refTimestamp - 7 * DAY_MS),
      backendNearest(backendUrl, address, refTimestamp - 30 * DAY_MS),
    ]);
    if (snap1d || snap7d || snap30d) return { snap1d, snap7d, snap30d };
  }
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
      const enriched = { ...cached, assets: await enrich(cached.assets) };
      const { snap1d, snap7d, snap30d } = await getHistoricalSnaps(address, cached.timestamp);
      return NextResponse.json({ snapshot: enriched, snap1d, snap7d, snap30d, cached: true });
    }
  }

  try {
    const snapshot = await fetchPool(address);
    if (snapshot.assets.length > 0) {
      savePoolSnapshot(snapshot);
      const backendUrl = process.env.BACKEND_URL;
      if (backendUrl) {
        fetch(`${backendUrl}/api/pools/${address}`, { method: "POST" }).catch(() => {});
      }
    }
    const enriched = { ...snapshot, assets: await enrich(snapshot.assets) };
    const { snap1d, snap7d, snap30d } = await getHistoricalSnaps(address, snapshot.timestamp);
    return NextResponse.json({ snapshot: enriched, snap1d, snap7d, snap30d, cached: false });
  } catch (err) {
    const fallback = getLatestPoolSnapshot(address);
    if (fallback) {
      const enriched = { ...fallback, assets: await enrich(fallback.assets) };
      const { snap1d, snap7d, snap30d } = await getHistoricalSnaps(address, fallback.timestamp);
      return NextResponse.json(
        { snapshot: enriched, snap1d, snap7d, snap30d, cached: true, warning: String(err) },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
