import { NextRequest, NextResponse } from "next/server";

// Register a new pool for cron tracking
export async function POST(req: NextRequest) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });

  let address: string;
  try {
    const body = await req.json();
    address = (body.address ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  try {
    const res = await fetch(`${backendUrl}/api/pools/${encodeURIComponent(address)}`, {
      method: "POST",
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    return NextResponse.json({ ok: true, address });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

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
