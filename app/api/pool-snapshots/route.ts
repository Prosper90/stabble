import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });

  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address param required" }, { status: 400 });

  const from = req.nextUrl.searchParams.get("from") ?? String(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const res = await fetch(`${backendUrl}/api/snapshots/${address}?from=${from}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);

    const raw = await res.json() as Record<string, unknown>[];
    // Strip MongoDB internals (_id, __v, createdAt) for clean export
    const clean = raw.map(({ _id, __v, createdAt, ...rest }) => {
      void _id; void __v; void createdAt;
      return rest;
    });
    return NextResponse.json(clean);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
