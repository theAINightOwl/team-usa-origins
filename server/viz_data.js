// server/viz_data.js
import { readFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const RAW = join(ROOT, "data");
const SRC = join(ROOT, "src", "data");

// Curated list of files exposed to the viz agent's code-execution sandbox.
// Files are inlined on every viz request. Code-execution accepts text/csv;
// it rejects application/json (HTTP 400 INVALID_ARGUMENT) — so JSON sources
// are flattened to CSV at load time.
const SPEC = [
  {
    path: join(SRC, "athletes.json"),
    mimeType: "text/csv",
    asName: "athletes.csv",
    transform: (buf) => jsonArrayToCsv(JSON.parse(buf.toString("utf-8"))),
  },
  { path: join(RAW, "hometown_demographics.csv"),     mimeType: "text/csv" },
  { path: join(RAW, "nfhs_participation.csv"),        mimeType: "text/csv" },
  { path: join(RAW, "teamusa_hometown_geocodes.csv"), mimeType: "text/csv" },
  { path: join(RAW, "eada_college_sports.csv"),       mimeType: "text/csv" },
  { path: join(RAW, "nfhs_state_totals.csv"),         mimeType: "text/csv" },
  { path: join(RAW, "sport_family_mapping.csv"),      mimeType: "text/csv" },
  { path: join(RAW, "training_centers.csv"),          mimeType: "text/csv" },
  { path: join(RAW, "hometown_climate.csv"),          mimeType: "text/csv" },
];

function jsonArrayToCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  // Union of keys across rows — a single first-row scan is wrong if later
  // rows have extra fields. Walk all rows once.
  const cols = [];
  const seen = new Set();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) { seen.add(k); cols.push(k); }
    }
  }
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => escape(r[c])).join(","));
  return lines.join("\n");
}

let _cached = null;

export function loadVizFiles() {
  if (_cached) return _cached;
  _cached = SPEC.map(({ path, mimeType, asName, transform }) => {
    const raw = readFileSync(path);
    const finalBuf = transform
      ? Buffer.from(transform(raw), "utf-8")
      : raw;
    return {
      name: asName || basename(path),
      mimeType,
      data: finalBuf.toString("base64"),
      rawBytes: finalBuf.length,
    };
  });
  const totalKb = (_cached.reduce((s, f) => s + f.rawBytes, 0) / 1024).toFixed(0);
  const names = _cached.map((f) => f.name).join(", ");
  console.log(`viz-data: loaded ${_cached.length} files (~${totalKb} KB raw): ${names}`);
  return _cached;
}
