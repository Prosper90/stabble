import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR =
  process.platform !== "win32" && process.env.NODE_ENV === "production"
    ? "/tmp/stb-data"
    : path.join(process.cwd(), "data");

const FILES = [
  { key: "pool-history", file: "pool-history.json" },
  { key: "snapshots", file: "snapshots.json" },
  { key: "holders-history", file: "holders-history.json" },
  { key: "positions-history", file: "positions-history.json" },
  { key: "labels", file: "labels.json" },
];

export async function GET() {
  const result: Record<string, { exists: boolean; size: number; entries: number | null; data: unknown }> = {};

  for (const { key, file } of FILES) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      result[key] = { exists: false, size: 0, entries: null, data: null };
      continue;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const size = Buffer.byteLength(raw, "utf-8");
    let data: unknown = null;
    let entries: number | null = null;
    try {
      data = JSON.parse(raw);
      if (Array.isArray(data)) entries = data.length;
      else if (typeof data === "object" && data !== null) {
        // pool-history is Record<address, PoolSnapshot[]>
        entries = Object.values(data as Record<string, unknown[]>).reduce(
          (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
          0
        );
      }
    } catch {
      data = raw;
    }
    result[key] = { exists: true, size, entries, data };
  }

  return NextResponse.json(result);
}
