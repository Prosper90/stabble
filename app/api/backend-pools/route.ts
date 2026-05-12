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

    // For each pool, also fetch its latest snapshot
    const withSnapshots = await Promise.all(
      pools.map(async (pool: { address: string; addedAt: string }) => {
        try {
          const snapRes = await fetch(`${backendUrl}/api/snapshots/${pool.address}/latest`, {
            next: { revalidate: 0 },
          });
          const latest = snapRes.ok ? await snapRes.json() : null;
          return { ...pool, latest };
        } catch {
          return { ...pool, latest: null };
        }
      })
    );

    return NextResponse.json({ configured: true, pools: withSnapshots });
  } catch (e) {
    return NextResponse.json({ configured: true, error: String(e), pools: [] });
  }
}
