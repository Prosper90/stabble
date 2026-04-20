import { NextRequest, NextResponse } from "next/server";
import { readLabels, saveLabel } from "@/lib/storage";

export async function GET() {
  return NextResponse.json(readLabels());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { address, name } = body as { address: string; name: string };
  if (!address || typeof name !== "string") {
    return NextResponse.json({ error: "address and name required" }, { status: 400 });
  }
  saveLabel(address, name);
  return NextResponse.json({ ok: true });
}
