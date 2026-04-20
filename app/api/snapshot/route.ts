import { NextRequest, NextResponse } from "next/server";
import { fetchSnapshot } from "@/lib/solana";
import { getLatestSnapshot, saveSnapshot } from "@/lib/storage";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "true";

  if (!force) {
    const cached = getLatestSnapshot();
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ snapshot: cached, cached: true });
    }
  }

  try {
    const snapshot = await fetchSnapshot();
    saveSnapshot(snapshot);
    return NextResponse.json({ snapshot, cached: false });
  } catch (err) {
    const fallback = getLatestSnapshot();
    if (fallback) {
      return NextResponse.json(
        { snapshot: fallback, cached: true, warning: String(err) },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
