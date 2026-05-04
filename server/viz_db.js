// server/viz_db.js
//
// In-process DuckDB for the viz agent. Tables are loaded once at first call
// and reused. The agent sees these via its run_sql function tool.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DuckDBInstance } from "@duckdb/node-api";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const RAW = join(ROOT, "data");
const SRC = join(ROOT, "src", "data");

let _connPromise = null;
let _counts = null;

export function getVizDb() {
  if (_connPromise) return _connPromise;
  _connPromise = (async () => {
    const instance = await DuckDBInstance.create(":memory:");
    const conn = await instance.connect();

    // Per-athlete records — canonical NIL-safe cut.
    await conn.run(`CREATE TABLE athletes AS SELECT * FROM read_json_auto('${q(join(SRC, "athletes.json"))}')`);
    // Per-city demographics (population, income, etc.).
    await conn.run(`CREATE TABLE hometown_demographics AS SELECT * FROM read_csv_auto('${q(join(RAW, "hometown_demographics.csv"))}', header=true)`);
    // NFHS HS sport participation by year/state/sport.
    await conn.run(`CREATE TABLE nfhs_participation AS SELECT * FROM read_csv_auto('${q(join(RAW, "nfhs_participation.csv"))}', header=true)`);
    // NFHS yearly totals per state (slot count, not unique student count).
    await conn.run(`CREATE TABLE nfhs_state_totals AS SELECT * FROM read_csv_auto('${q(join(RAW, "nfhs_state_totals.csv"))}', header=true)`);
    // City→lat/lng resolution for the curated geocoded set.
    await conn.run(`CREATE TABLE teamusa_hometown_geocodes AS SELECT * FROM read_csv_auto('${q(join(RAW, "teamusa_hometown_geocodes.csv"))}', header=true)`);
    // EADA college sports dataset.
    await conn.run(`CREATE TABLE eada_college_sports AS SELECT * FROM read_csv_auto('${q(join(RAW, "eada_college_sports.csv"))}', header=true)`);
    // Sport → family taxonomy.
    await conn.run(`CREATE TABLE sport_family_mapping AS SELECT * FROM read_csv_auto('${q(join(RAW, "sport_family_mapping.csv"))}', header=true)`);
    // Curated training-center directory.
    await conn.run(`CREATE TABLE training_centers AS SELECT * FROM read_csv_auto('${q(join(RAW, "training_centers.csv"))}', header=true)`);
    // Köppen climate zones per hometown.
    await conn.run(`CREATE TABLE hometown_climate AS SELECT * FROM read_csv_auto('${q(join(RAW, "hometown_climate.csv"))}', header=true)`);

    _counts = await tableCounts(conn);
    const summary = Object.entries(_counts).map(([t, n]) => `${t}=${n}`).join(", ");
    console.log(`viz-db: loaded — ${summary}`);
    return conn;
  })().catch((err) => { _connPromise = null; throw err; });
  return _connPromise;
}

export function getTableCounts() {
  return _counts;
}

async function tableCounts(conn) {
  const tables = [
    "athletes", "hometown_demographics", "nfhs_participation",
    "nfhs_state_totals", "teamusa_hometown_geocodes", "eada_college_sports",
    "sport_family_mapping", "training_centers", "hometown_climate",
  ];
  const out = {};
  for (const t of tables) {
    const r = await conn.run(`SELECT COUNT(*) AS n FROM ${t}`);
    const rows = await r.getRowObjects();
    out[t] = Number(rows[0]?.n ?? 0);
  }
  return out;
}

function q(s) { return s.replace(/'/g, "''"); }
