/*
 * Visualization agent — SQL-tool + code-execution loop over an in-process
 * DuckDB. The model writes SQL to fetch the rows it needs (via the run_sql
 * function tool), then runs Python in Gemini's hosted code-execution sandbox
 * to build a Plotly figure dict. Returns { narration, figures } structured
 * JSON. Adapted from demo-tool-combo/server.mjs but wired to server/viz_db.js
 * and the full 9-table Olympian Roots corpus.
 */

import { GoogleGenAI } from "@google/genai";
import { getVizDb, getTableCounts } from "./viz_db.js";

// Read env LAZILY (inside getAi()). The live voice server imports this
// module before its dotenv.loadEnv runs, so capturing
// process.env.GEMINI_API_KEY at module-load time would be null and we'd
// fail every voice-side chart with "GEMINI_API_KEY not configured".
let _ai = null;
function getAi() {
  if (_ai) return _ai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  _ai = new GoogleGenAI({ apiKey: key });
  return _ai;
}
function getModel() {
  return process.env.VIZ_MODEL || "gemini-3.1-pro-preview";
}

// ── SQL tool ────────────────────────────────────────────────────────────
const SQL_HARD_CAP = 500; // rows returned per query — cap protects the next round-trip's token budget

async function handleSql({ query } = {}) {
  if (!query) return { error: "query is required (a SELECT or WITH statement)" };

  // Read-only enforcement: reject anything that isn't a plain read query.
  const trimmed = query.trim().replace(/;+\s*$/, "");
  const firstWord = trimmed.split(/\s+/, 1)[0]?.toUpperCase();
  if (!["SELECT", "WITH", "EXPLAIN", "DESCRIBE", "SHOW", "PRAGMA"].includes(firstWord)) {
    return { error: `Only SELECT/WITH/EXPLAIN/DESCRIBE/SHOW/PRAGMA queries are allowed. Got: ${firstWord}` };
  }
  if (/;/.test(trimmed)) {
    return { error: "Only a single statement per call (no semicolons)." };
  }

  let rows;
  try {
    const db = await getVizDb();
    const result = await db.run(trimmed);
    rows = await result.getRowObjects();
  } catch (err) {
    return { error: `SQL error: ${err?.message || String(err)}` };
  }

  // Coerce BigInt → number where lossless (DuckDB returns counts as BigInt).
  const safeRows = rows.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "bigint") {
        out[k] = v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER)
          ? Number(v)
          : v.toString();
      } else {
        out[k] = v;
      }
    }
    return out;
  });

  const truncated = safeRows.length > SQL_HARD_CAP;
  const returned = truncated ? safeRows.slice(0, SQL_HARD_CAP) : safeRows;

  return {
    rows: returned,
    row_count: returned.length,
    total_rows: safeRows.length,
    truncated,
    hint: truncated
      ? `Result set has ${safeRows.length} rows; only the first ${SQL_HARD_CAP} returned. Aggregate with GROUP BY or add a LIMIT/WHERE — large row dumps stall the next round-trip.`
      : undefined,
  };
}

// ── Function declaration ────────────────────────────────────────────────
export const SQL_DECL = {
  name: "run_sql",
  description:
    "Execute a read-only SQL query (SELECT / WITH / DESCRIBE / SHOW / PRAGMA / EXPLAIN) against the Olympian Roots " +
    "DuckDB. Returns { rows, row_count, total_rows, truncated, hint }. Aggregate with GROUP BY whenever possible — " +
    "rows are capped at 500. Examples: " +
    "`SELECT family, COUNT(*) AS n FROM athletes WHERE total_medals > 0 GROUP BY family ORDER BY n DESC` for a family aggregate; " +
    "`SELECT a.state, COUNT(*) AS athletes, SUM(a.total_medals) AS medals FROM athletes a JOIN training_centers tc ON a.state = tc.state GROUP BY a.state` for joins. " +
    "Use this to fetch ONLY the data you need before drawing the chart.",
  parameters: {
    type: "object",
    required: ["query"],
    properties: {
      query: {
        type: "string",
        description: "A single read-only SQL statement (no semicolons, no DDL/DML). DuckDB dialect.",
      },
    },
  },
};

// ── System instruction (built on demand so table counts are live) ───────
function buildSystemInstruction() {
  const c = getTableCounts() || {};
  const n = (k) => c[k] ?? "?";

  return `You are an Olympian Roots data visualization specialist working in the visual style of the editorial / printed-magazine aesthetic of the 11-plate atlas of Team USA hometowns. The atlas is a NIL-safe, anonymised cut: aggregate to states / sports / families / hometowns / training programs — never label any individual athlete by name in axis labels, annotations, or narration.

WORKFLOW (strict):
1. Call \`run_sql\` to fetch the rows you need. Aggregate with GROUP BY whenever you can — never SELECT * without LIMIT. The tool caps responses at ${SQL_HARD_CAP} rows.
2. Run Python in the code-execution sandbox to build a Plotly figure as a plain Python dict — do NOT \`import plotly\`, that module is not available in the sandbox. Construct the figure dict directly and \`print(json.dumps(fig_dict))\`.
3. Return a single JSON object: { "narration": "<1-2 sentences, max 80 words, markdown OK but no fenced code>", "figures": [<plotly figure dict>] }.

NIL constraint: athlete records are anonymised (no names, gender mostly empty). Aggregate to states / sports / families / hometowns / training centers. Never label individuals.

────────────────────────── DATABASE SCHEMA — 9 TABLES ──────────────────────────

TABLE \`athletes\` (${n("athletes")} rows)
  Per-athlete records from Team USA, the canonical anonymised cut. One row per known
  Olympian / Paralympian / Hopeful with a resolvable hometown.
    id              VARCHAR    opaque athlete identifier (Storyblok blt-id)
    gender          VARCHAR    almost always empty in this dataset (NIL strip side-effect); do not facet on it
    sport           VARCHAR    sport name, e.g. 'Swimming', 'Athletics', 'Para Snowboarding'
    family          VARCHAR    sport family: 'Aquatic','Track & Field','Team Ball','Winter','Endurance','Combat','Other'
    first           BIGINT     first games year (or NULL — ~2421 of ${n("athletes")} rows)
    last            BIGINT     last games year (or NULL)
    games_count     BIGINT     number of games appeared in
    gold,silver,bronze  BIGINT  medal counts at each tier
    total_medals    BIGINT     sum of gold + silver + bronze
    type            VARCHAR    'Olympic' | 'Paralympic' | 'Hopeful'
    season          VARCHAR    'Summer' | 'Winter' | '' (empty for ~half — source didn't disambiguate)
    city            VARCHAR    hometown city (mixed case, e.g. 'Los Angeles')
    state           VARCHAR    two-letter US state code
    school          VARCHAR    RAW education free-text (HS + college + grad year + major all mashed together)
    lat, lng        DOUBLE     hometown coordinates

TABLE \`hometown_demographics\` (${n("hometown_demographics")} rows)
  Census-year snapshots of US county demographics. NOT city-grain — county-grain.
  Multiple rows per county across snapshot years (2000, 2009, 2010, 2012, 2015, 2018, 2020, 2022).
    county_fips             BIGINT   5-digit FIPS code (state*1000 + county)
    county_name             VARCHAR  e.g. 'Autauga County'
    state                   VARCHAR  two-letter state code
    population              BIGINT   county population
    median_household_income DOUBLE   USD, nominal (NOT inflation-adjusted across years)
    year                    BIGINT   snapshot year (one of the 8 above)

TABLE \`nfhs_participation\` (${n("nfhs_participation")} rows)
  NFHS high-school sport-participation per state × sport × gender × snapshot year.
  Years available: 1995, 2000, 2005, 2010, 2015, 2019, 2024 (7 snapshots).
    year         BIGINT   one of the 7 snapshot years
    state        VARCHAR  two-letter code
    sport        VARCHAR  HS sport name (different naming than athletes.sport — don't naive-join)
    gender       VARCHAR  'Boys' | 'Girls'
    participants BIGINT   participation slots (NOT unique student count)

TABLE \`nfhs_state_totals\` (${n("nfhs_state_totals")} rows)
  Annual NFHS high-school participation totals per state. ONE year only (2025) — 51 rows = 50 states + DC.
  Slot count, not unique student count.
    state   VARCHAR  two-letter code
    year    BIGINT   2025 for every row in the current load
    boys    BIGINT   participation slots
    girls   BIGINT
    total   BIGINT   boys + girls
    source  VARCHAR  citation URL

TABLE \`teamusa_hometown_geocodes\` (${n("teamusa_hometown_geocodes")} rows)
  City/state → lat/lng lookup for hometowns appearing in athletes. Includes a count of athletes per row.
    city           VARCHAR  hometown as stored on athletes (mixed case)
    state          VARCHAR  two-letter code
    lat, lng       DOUBLE
    canonical_name VARCHAR  resolved Census place name (e.g. 'San Diego city')
    strategy       VARCHAR  'direct' | 'state-contains' | 'suffix-add:town' | 'override' | etc.
    n_athletes     BIGINT   number of athlete rows resolved to this (city,state)

TABLE \`eada_college_sports\` (${n("eada_college_sports")} rows)
  EADA college-sports panel: per-institution × per-year. Years 2003–2023.
    institution_name        VARCHAR
    state                   VARCHAR  two-letter code
    classification          VARCHAR  'NCAA Division I' / II / III / 'NAIA' / etc.
    conference              VARCHAR
    total_athletes_men      BIGINT
    total_athletes_women    BIGINT
    total_sports            BIGINT   number of varsity sports offered
    athletic_budget_millions DOUBLE  USD millions, nominal
    year                    BIGINT

TABLE \`sport_family_mapping\` (${n("sport_family_mapping")} rows)
  Reference: sport name → family taxonomy + paralympic flag. The same lookup that stamps athletes.family.
    sport              VARCHAR  may be a SEMI-COLON-SEPARATED list (e.g. 'Para Alpine Skiing; Para Biathlon')
    sport_family       VARCHAR  same vocabulary as athletes.family
    is_paralympic      BOOLEAN
    olympic_equivalent VARCHAR  the non-paralympic counterpart, or NULL

TABLE \`training_centers\` (${n("training_centers")} rows)
  Curated directory of Olympic/Paralympic training centers in the US. Small (10 rows) — useful as JOIN key, not as a complete USOPC site list.
    name          VARCHAR  facility name
    type          VARCHAR  'OPTC' | 'NGB' | 'Private' | etc.
    city          VARCHAR
    state         VARCHAR  two-letter code
    lat, lng      DOUBLE
    sports_served VARCHAR  semicolon-separated list (split with string_split() in DuckDB)
    year_opened   BIGINT
    paralympic    BOOLEAN  paralympic-affiliated

TABLE \`hometown_climate\` (${n("hometown_climate")} rows)
  Per-state climate profile. State-grain (51 rows = 50 states + DC), NOT per-hometown despite the name.
    state                  VARCHAR  two-letter code
    avg_temp_annual_f      DOUBLE   degrees Fahrenheit
    avg_snowfall_annual_in DOUBLE   inches
    avg_precip_annual_in   DOUBLE   inches
    climate_zone           VARCHAR  'Cold','Continental','Subtropical','Hot Humid','Hot Dry','Warm Humid','Mild'
                                    (NOT raw Köppen letters — these are the simplified 7-zone labels used in Plate VI)

────────────────────────── QUERY GUIDANCE ──────────────────────────

- Aggregate at the SQL layer: \`SELECT family, COUNT(*) AS n FROM athletes WHERE total_medals > 0 GROUP BY family ORDER BY n DESC\` — not \`SELECT *\` followed by Python aggregation.
- DuckDB dialect: window functions, QUALIFY, list_agg, struct_pack, string_split, regexp_extract, PIVOT/UNPIVOT are all available.
- Cast counts to DOUBLE before dividing — DuckDB integer division truncates.
- ${SQL_HARD_CAP}-row cap on results. If you'd return more, GROUP BY or LIMIT.

────────────────────────── QUERY PATTERNS ──────────────────────────

Match the user's question shape to one of these — write ONE query, not a loop:
- "Top N states/sports/cities by …" / "ranked by …" / "most …" → \`SELECT col, COUNT(*) AS n FROM athletes WHERE … GROUP BY col ORDER BY n DESC LIMIT N\`
- "Distribution by …" / "breakdown of …" / "by sport family" → \`SELECT family, COUNT(*) AS n FROM athletes GROUP BY family ORDER BY n DESC\`
- "Per capita" → JOIN athletes (aggregated by state) to a per-state population (latest year of \`hometown_demographics\` summed by state, OR \`nfhs_state_totals.total\` for HS-slot density). CAST counts to DOUBLE.
- "HS slot density" / "per million HS slots" → \`SELECT a.state, COUNT(*)::DOUBLE * 1e6 / SUM(t.total) AS rate FROM athletes a JOIN nfhs_state_totals t ON a.state = t.state GROUP BY a.state\`. nfhs_state_totals is 2025-only — call out the snapshot in the narration.
- "Athletes near training centers" → JOIN \`athletes a\` to \`training_centers tc ON a.state = tc.state\` (state-level proximity proxy; coordinate-radius math is OK with haversine in DuckDB if needed).
- "Trends over time" / "by decade" / "since 2000" → bucket on \`first\` or \`last\`, e.g. \`(last / 10) * 10 AS decade\`, then GROUP BY. Filter NULL years first.
- "Filter by medal status" → ALWAYS condition on \`total_medals > 0\` when the user says "medal-winners" / "medalists"; do NOT include hopefuls.
- "By climate zone" → JOIN athletes to hometown_climate ON state (NOT on city), then GROUP BY climate_zone.
- "By college / by school" → \`athletes.school\` is dirty free-text; warn in narration AND/OR \`regexp_extract(school, '(University of [A-Z][a-z]+( [A-Z][a-z]+)*)') AS college\` then group on the extracted token.

────────────────────────── DATA QUIRKS ──────────────────────────

Read this BEFORE writing SQL against any dirty fields:
- \`athletes.school\` is RAW education free-text — often combining HS + college + graduation year + major in one string. Naive \`GROUP BY school\` yields mostly singleton groups. Use regexp_extract or warn in the narration.
- \`athletes.gender\` is almost entirely empty (NIL strip side-effect). Don't filter or facet on gender from athletes.
- \`athletes.season\` is '' (empty string) for roughly half the rows. Use \`season IN ('Summer','Winter')\` if you need it as a dimension.
- \`athletes.first\` / \`athletes.last\` are NULL for ~2,421 of ${n("athletes")} rows (parsing failures). Filter NULLs before bucketing on them.
- \`hometown_demographics\` is COUNTY-grain, not city-grain — there is no direct join key into \`athletes.city\`. To use it as a per-state population denominator, sum \`population\` per (state, year) and pick a single recent year (e.g. 2022).
- \`hometown_demographics\` has 8 snapshot years, NOT a continuous time series. Pick one year (latest = 2022) when computing per-capita rates; \`median_household_income\` is nominal USD and not inflation-adjusted across years.
- \`nfhs_state_totals\` is ONE year (2025) for all 51 rows — it is a snapshot, not a longitudinal series. Use \`nfhs_participation\` for cross-year HS sport trends.
- \`nfhs_participation\` has 7 snapshot years (1995, 2000, 2005, 2010, 2015, 2019, 2024) — not continuous. \`participants\` is slot count, not unique-student count. Sport names differ from \`athletes.sport\` (e.g. NFHS uses 'Track and Field — Outdoor'); don't naive-join on sport.
- \`teamusa_hometown_geocodes.city\` matches \`athletes.city\` directly (same casing) — safe join on (city, state).
- \`hometown_climate\` is STATE-grain (51 rows) despite the name. \`climate_zone\` is the 7-bucket simplified label, NOT raw Köppen letters. Plate VI's "Köppen zones" maps to these labels.
- \`training_centers\` is curated and small (10 rows) — useful as a JOIN key for "near a training center", not as the complete USOPC site list. Only 2 OPTCs exist (Colorado Springs, Lake Placid); the rest are NGB / Private.
- \`sport_family_mapping.sport\` is sometimes a semi-colon-separated multi-sport string (e.g. 'Para Alpine Skiing; Para Biathlon'). Use \`string_split(sport, ';')\` and unnest if joining on individual sports.
- \`eada_college_sports.athletic_budget_millions\` is nominal USD, not inflation-adjusted. \`year\` runs 2003–2023.
- DuckDB returns counts as BIGINT — cast to DOUBLE before dividing or you'll get integer truncation.

────────────────────────── ATLAS VOCABULARY ──────────────────────────

Use these terms accurately when answering plate-style questions:
- "Factories" = small towns punching above weight (Plate II, e.g. Park City UT, Winthrop WA).
- "Halos" = Team USA profiles within 25/50/100/200 mi of a curated tracked training-facility geography (Plate IV).
- "OPTC" = Olympic & Paralympic Training Center, USOPC-operated. Only 2 exist (Colorado Springs, Lake Placid). The Plate IV roster is curated and is not the complete current USOPC training-site list.
- "Köppen zones" in Olympian Roots = the 7-label simplified climate buckets in \`hometown_climate.climate_zone\`, not raw Köppen letter codes (Plate VI).
- "Per capita" = Team USA profiles per 100k residents (Plate IX).
- "HS slot density" (legacy key: "HS conversion") = Team USA profiles per million NFHS participation slots (Plate X). Do not describe it as a longitudinal athlete-development rate.
- "Era presence" = Team USA profiles with parsed active years, counted in each overlapping decade (Plate XI). This is not a complete historical census, migration model, or infrastructure-causality model.

────────────────────────── CHART STYLE ──────────────────────────

The platform automatically applies the editorial style — paper background, Fraunces serif title, hair-thin axes, mono tick fonts, paper hover labels, margins, default trace fills. You DO NOT need to set:
- paper_bgcolor, plot_bgcolor, font, margin, showlegend
- xaxis/yaxis basic styling (showline, ticks, tickfont, gridcolor, axis title font)
- hoverlabel
- title.font, title.x, title.xanchor (just provide title.text and the platform handles positioning)

You DO need to set:
- All data: x, y, type, orientation, mode, etc.
- title.text — a short serif headline. Keep under 60 chars.
- For BAR charts: marker.color as an array — paint the #1 highlighted item in rust "#c63d2f", the rest in ink_4 "#8a7c6a". For non-ranked bars, omit marker.color entirely (platform fills ink_4).
- For LINE charts with one focus series: that series' line.color = rust "#c63d2f", others = ink_4 "#8a7c6a".
- hovertemplate — terse, ending in <extra></extra> to suppress the trace label.

EXACT FIGURE DICT SHAPE (preserve null-avoidance — never set a key to null; omit it instead):

  {
    "data": [
      {
        "type": "bar",
        "x": [...],
        "y": [...],
        "orientation": "h",
        "marker": { "color": ["#c63d2f", "#8a7c6a", "#8a7c6a", ...] },
        "hovertemplate": "<b>%{y}</b>: %{x}<extra></extra>"
      }
    ],
    "layout": {
      "title": { "text": "Top 8 …" }
    }
  }

CRITICAL: every key under \`layout\` must be a fully-populated object or value — NEVER null. If you don't want a setting, OMIT the key entirely. Do not write \`"title": null\` or \`"xaxis": null\` — Plotly will crash.

OUTPUT: respond with the JSON object. The response is in JSON mode — output JSON only, no markdown fences.`;
}

/**
 * Returns the system instruction string with current row counts substituted.
 * Live counts require getVizDb() to have run; call after `await getVizDb()`.
 */
export function getSystemInstruction() {
  return buildSystemInstruction();
}

export const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    narration: { type: "string" },
    figures: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  },
  required: ["narration", "figures"],
};

const TOOLS = [
  { codeExecution: {} },
  { functionDeclarations: [SQL_DECL] },
];

const TOOL_CONFIG = {
  includeServerSideToolInvocations: true,
  functionCallingConfig: { mode: "VALIDATED" },
};

// Recursively strip null/undefined values from objects and arrays. Plotly.js
// crashes on `{xaxis: null}` etc., so we defensively prune before sending.
function stripNulls(value) {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === null || v === undefined) continue;
      out[k] = stripNulls(v);
    }
    return out;
  }
  return value;
}

// Editorial design tokens — keep in sync with src/styles.css.
const STYLE = {
  paper:    "#f4ede1",
  paper2:   "#ece3d2",
  ink:      "#1a1410",
  ink2:     "#463a2e",
  ink3:     "#6b5e4d",
  ink4:     "#8a7c6a",
  rust:     "#c63d2f",
  gold:     "#c89837",
  hair:     "rgba(26,20,16,0.14)",
  grid:     "rgba(26,20,16,0.05)",
  serif:    "Fraunces, Iowan Old Style, Georgia, serif",
  mono:     "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace",
};

const AXIS_BASE = {
  showline: true,
  linecolor: STYLE.hair,
  linewidth: 1,
  ticks: "outside",
  tickcolor: STYLE.hair,
  ticklen: 4,
  zeroline: false,
  tickfont: { family: STYLE.mono, size: 10, color: STYLE.ink3 },
  title: { font: { family: STYLE.serif, size: 11, color: STYLE.ink2 } },
};
const VALUE_AXIS = { ...AXIS_BASE, showgrid: true, gridcolor: STYLE.grid, gridwidth: 1 };
const CATEGORY_AXIS = { ...AXIS_BASE, showgrid: false };

const LAYOUT_DEFAULTS = {
  paper_bgcolor: STYLE.paper,
  plot_bgcolor: STYLE.paper,
  font: { family: STYLE.serif, color: STYLE.ink, size: 12 },
  margin: { l: 70, r: 30, t: 70, b: 60 },
  hoverlabel: {
    bgcolor: STYLE.paper2,
    bordercolor: STYLE.ink,
    font: { family: STYLE.mono, size: 11, color: STYLE.ink },
  },
  showlegend: false,
};

const TITLE_DEFAULTS = {
  font: { family: STYLE.serif, size: 16, color: STYLE.ink },
  x: 0.02,
  xanchor: "left",
};

const TRACE_DEFAULTS_BY_TYPE = {
  bar:     { marker: { color: STYLE.ink4 }, hovertemplate: "%{label}: %{value}<extra></extra>" },
  line:    { line:   { color: STYLE.ink, width: 2 }, marker: { color: STYLE.ink, size: 6 } },
  scatter: { marker: { color: STYLE.ink4, size: 8 } },
};

// Deep-merge: model values win over defaults at every level. Arrays from the
// model replace defaults entirely (we don't try to merge bar-color arrays).
function mergeStyle(defaults, override) {
  if (override === null || override === undefined) return defaults;
  if (Array.isArray(override)) return override;
  if (typeof override !== "object") return override;
  const out = { ...defaults };
  for (const [k, v] of Object.entries(override)) {
    out[k] = mergeStyle(defaults?.[k], v);
  }
  return out;
}

// Bars with horizontal orientation: x is value, y is category.
// Default (vertical bars, line, scatter): x is category, y is value.
function pickAxisDefaults(figure) {
  const trace = figure?.data?.[0];
  const isHBar = trace?.type === "bar" && trace?.orientation === "h";
  return isHBar
    ? { xaxis: VALUE_AXIS, yaxis: CATEGORY_AXIS }
    : { xaxis: CATEGORY_AXIS, yaxis: VALUE_AXIS };
}

// Coerce common model regressions back to Plotly-correct shapes.
// - marker as a flat color array → { color: [...] }
// - line as a flat color array → { color: [...] } (less common but possible)
function normalizeTrace(trace) {
  if (!trace || typeof trace !== "object") return trace;
  const out = { ...trace };
  if (Array.isArray(out.marker)) out.marker = { color: out.marker };
  if (Array.isArray(out.line)) out.line = { color: out.line };
  return out;
}

function applyEditorialStyle(figure) {
  if (!figure || typeof figure !== "object") return figure;

  const data = Array.isArray(figure.data)
    ? figure.data.map((trace) => mergeStyle(TRACE_DEFAULTS_BY_TYPE[trace?.type] || {}, normalizeTrace(trace)))
    : figure.data;

  const axisDefaults = pickAxisDefaults(figure);
  const baseLayout = { ...LAYOUT_DEFAULTS, ...axisDefaults };
  if (figure?.layout?.title) baseLayout.title = TITLE_DEFAULTS;
  const layout = mergeStyle(baseLayout, figure.layout || {});

  return { ...figure, data, layout };
}

/**
 * Run the viz agent once.
 * @param {string} userQuestion — natural language ask
 * @returns {Promise<{ text: string, code: string, stdout: string, figures: unknown[] }>}
 */
export async function runVizAgent(userQuestion) {
  const ai = getAi();
  if (!ai) throw new Error("GEMINI_API_KEY is not configured on the server.");
  await getVizDb(); // ensure DuckDB is loaded so getTableCounts() returns numbers

  const systemInstruction = buildSystemInstruction();
  const contents = [{ role: "user", parts: [{ text: userQuestion }] }];
  let accumulatedCode = "";
  let accumulatedStdout = "";
  let turn = 0;

  while (turn++ < 10) {
    const resp = await ai.models.generateContent({
      model: getModel(),
      contents,
      config: {
        systemInstruction,
        tools: TOOLS,
        toolConfig: TOOL_CONFIG,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    });

    if (resp.usageMetadata) {
      console.log("[viz] usage:", JSON.stringify(resp.usageMetadata));
    }

    const parts = resp.candidates?.[0]?.content?.parts ?? [];
    let functionCallPart = null;
    for (const p of parts) {
      if (p.functionCall) functionCallPart = p;
      if (p.executableCode?.code) accumulatedCode += p.executableCode.code + "\n";
      if (p.codeExecutionResult?.output) accumulatedStdout += p.codeExecutionResult.output;
    }

    if (!functionCallPart) {
      const raw = resp.text || "";
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch (err) {
        console.warn("[viz] failed to parse structured response:", err?.message);
        return {
          text: "*Error: structured response did not parse as JSON.*",
          code: accumulatedCode,
          stdout: accumulatedStdout + "\n\n--- raw ---\n" + raw,
          figures: [],
        };
      }
      const figures = Array.isArray(parsed.figures)
        ? parsed.figures.map(stripNulls).map(applyEditorialStyle)
        : [];
      return {
        text: (parsed.narration || "").trim(),
        code: accumulatedCode,
        stdout: accumulatedStdout,
        figures,
      };
    }

    const args = functionCallPart.functionCall.args || {};
    const result = await handleSql(args);
    const summary = result.error
      ? `error: ${result.error}`
      : `${result.row_count}/${result.total_rows} rows${result.truncated ? " (truncated)" : ""}`;
    console.log(`[viz] run_sql: ${(args.query || "").replace(/\s+/g, " ").slice(0, 160)} → ${summary}`);

    contents.push({ role: "model", parts });
    contents.push({
      role: "user",
      parts: [{
        functionResponse: {
          id: functionCallPart.functionCall.id,
          name: functionCallPart.functionCall.name,
          response: { result },
        },
      }],
    });
  }
  throw new Error("viz agent loop exceeded 10 turns");
}
