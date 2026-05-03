// server/viz_data.js
import { readFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const RAW = join(ROOT, "data");
const SRC = join(ROOT, "src", "data");

// Curated list of files exposed to the viz agent's code-execution sandbox.
// Order is roughly "most likely to be useful first" — the model still picks.
const SPEC = [
  { path: join(SRC, "athletes.json"),                  mimeType: "application/json" },
  { path: join(RAW, "hometown_demographics.csv"),      mimeType: "text/csv" },
  { path: join(RAW, "nfhs_participation.csv"),         mimeType: "text/csv" },
  { path: join(RAW, "teamusa_hometown_geocodes.csv"),  mimeType: "text/csv" },
  { path: join(RAW, "eada_college_sports.csv"),        mimeType: "text/csv" },
  { path: join(RAW, "nfhs_state_totals.csv"),          mimeType: "text/csv" },
  { path: join(RAW, "sport_family_mapping.csv"),       mimeType: "text/csv" },
  { path: join(RAW, "training_centers.csv"),           mimeType: "text/csv" },
  { path: join(RAW, "hometown_climate.csv"),           mimeType: "text/csv" },
];

let _cached = null;

export function loadVizFiles() {
  if (_cached) return _cached;
  _cached = SPEC.map(({ path, mimeType }) => {
    const buf = readFileSync(path);
    return {
      name: basename(path),
      mimeType,
      data: buf.toString("base64"),
      rawBytes: buf.length,
    };
  });
  const totalKb = (_cached.reduce((s, f) => s + f.rawBytes, 0) / 1024).toFixed(0);
  const names = _cached.map((f) => f.name).join(", ");
  console.log(`viz-data: loaded ${_cached.length} files (~${totalKb} KB raw): ${names}`);
  return _cached;
}
