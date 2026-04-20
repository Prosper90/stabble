import fs from "fs";
import path from "path";
import { Snapshot, Labels, HoldersSnapshot } from "./types";

// On Netlify (Linux + production), cwd is read-only Lambda; /tmp is the only writable path.
// Locally on Windows dev, use the project data/ folder as before.
const DATA_DIR =
  process.platform !== "win32" && process.env.NODE_ENV === "production"
    ? "/tmp/stb-data"
    : path.join(process.cwd(), "data");
const SNAPSHOTS_FILE = path.join(DATA_DIR, "snapshots.json");
const LABELS_FILE = path.join(DATA_DIR, "labels.json");
const HOLDERS_FILE = path.join(DATA_DIR, "holders-history.json");

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // read-only filesystem — all reads will return empty defaults, writes are no-ops
  }
}

// ── Snapshots ──────────────────────────────────────────────────────────────

export function readSnapshots(): Snapshot[] {
  ensureDataDir();
  if (!fs.existsSync(SNAPSHOTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, "utf-8")) as Snapshot[];
  } catch {
    return [];
  }
}

export function saveSnapshot(snapshot: Snapshot): void {
  try {
    ensureDataDir();
    const existing = readSnapshots();
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const pruned = existing.filter((s) => s.timestamp > cutoff);
    pruned.push(snapshot);
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(pruned), "utf-8");
  } catch { /* ephemeral filesystem — skip persistence */ }
}

export function getLatestSnapshot(): Snapshot | null {
  const snapshots = readSnapshots();
  if (snapshots.length === 0) return null;
  return snapshots.reduce((best, s) => (s.timestamp > best.timestamp ? s : best));
}

export function getSnapshotNearest(targetMs: number): Snapshot | null {
  const snapshots = readSnapshots();
  if (snapshots.length === 0) return null;
  return snapshots.reduce((best, s) =>
    Math.abs(s.timestamp - targetMs) < Math.abs(best.timestamp - targetMs) ? s : best
  );
}

// ── Labels ─────────────────────────────────────────────────────────────────

export function readLabels(): Labels {
  ensureDataDir();
  if (!fs.existsSync(LABELS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(LABELS_FILE, "utf-8")) as Labels;
  } catch {
    return {};
  }
}

export function saveLabel(address: string, name: string): void {
  try {
    ensureDataDir();
    const labels = readLabels();
    if (name.trim() === "") {
      delete labels[address];
    } else {
      labels[address] = name.trim();
    }
    fs.writeFileSync(LABELS_FILE, JSON.stringify(labels, null, 2), "utf-8");
  } catch { /* ephemeral filesystem — skip persistence */ }
}

// ── Holders History ─────────────────────────────────────────────────────────

export function readHoldersHistory(): HoldersSnapshot[] {
  ensureDataDir();
  if (!fs.existsSync(HOLDERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(HOLDERS_FILE, "utf-8")) as HoldersSnapshot[];
  } catch {
    return [];
  }
}

export function saveHoldersSnapshot(snapshot: HoldersSnapshot): void {
  try {
    ensureDataDir();
    const existing = readHoldersHistory();
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const pruned = existing.filter((s) => s.timestamp > cutoff);
    pruned.push(snapshot);
    fs.writeFileSync(HOLDERS_FILE, JSON.stringify(pruned), "utf-8");
  } catch { /* ephemeral filesystem — skip persistence */ }
}

export function getLatestHoldersSnapshot(): HoldersSnapshot | null {
  const history = readHoldersHistory();
  if (history.length === 0) return null;
  return history.reduce((best, s) => (s.timestamp > best.timestamp ? s : best));
}

export function getHoldersSnapshotNearest(targetMs: number): HoldersSnapshot | null {
  const history = readHoldersHistory();
  if (history.length === 0) return null;
  return history.reduce((best, s) =>
    Math.abs(s.timestamp - targetMs) < Math.abs(best.timestamp - targetMs) ? s : best
  );
}
