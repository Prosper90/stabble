import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ configured: false, pools: [] });
  }

  try {
    const res = await fetch(`${backendUrl}/api/pools`, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const pools = await res.json();

    // For each pool, fetch its latest snapshot and 24h snapshot count
    const withSnapshots = await Promise.all(
      pools.map(async (pool: { address: string; addedAt: string }) => {
        try {
          const [snapRes, countRes] = await Promise.all([
            fetch(`${backendUrl}/api/snapshots/${pool.address}/latest`, { next: { revalidate: 0 } }),
            fetch(`${backendUrl}/api/snapshots/${pool.address}/count`, { next: { revalidate: 0 } }),
          ]);
          const latest = snapRes.ok ? await snapRes.json() : null;
          const countData = countRes.ok ? await countRes.json() : null;
          return { ...pool, latest, snapshotCount: countData?.count ?? null };
        } catch {
          return { ...pool, latest: null, snapshotCount: null };
        }
      })
    );

    return NextResponse.json({ configured: true, pools: withSnapshots });
  } catch (e) {
    return NextResponse.json({ configured: true, error: String(e), pools: [] });
  }
}
