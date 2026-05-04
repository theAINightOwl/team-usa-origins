import React, { useEffect, useRef, useState } from "react";
import analytics from "../data/analytics.json";
import trainingCentersData from "../data/training_centers.json";
import { STORIES } from "../data/plate_stories.js";
import Markdown from "../lib/markdown.jsx";
import { streamPersonal } from "../lib/sse.js";

const CENTER_TYPE_BY_NAME = new Map(trainingCentersData.map((c) => [c.name, c.type]));
const TRACKED_FACILITY_COUNT = trainingCentersData.length;
const TRACKED_GEOGRAPHY_COUNT = analytics.halos?.length || TRACKED_FACILITY_COUNT;
const TRACKED_OPTC_COUNT = analytics.halos?.filter((c) => c.type === "OPTC").length ||
  trainingCentersData.filter((c) => c.type === "OPTC").length;

/*
 * Plates — the right-hand reading column.
 *
 * Plate I is the editorial reference (Marginalia content). Plates II–XI are
 * each a separate analytical plate, computed by compute_analytics.py and
 * baked into analytics.json.
 *
 * The plate selector is a vertical roman-numeral index at the top of the
 * panel. Active plate content fills the rest of the column.
 */

export const PLATE_DEFS = [
  { key: "ref", roman: "I", short: "Reference", title: "A century of hometowns" },
  { key: "factories", roman: "II", short: "Factories", title: "Tiny towns, big rosters" },
  { key: "concentration", roman: "III", short: "Concentration", title: "Where each sport lives" },
  { key: "halos", roman: "IV", short: "Halos", title: "Reach of the training centers" },
  { key: "distance", roman: "V", short: "Distance", title: "How far from a center?" },
  { key: "climate", roman: "VI", short: "Climate", title: "Climate × sport family" },
  { key: "per_capita", roman: "VII", short: "Per Capita", title: "Profiles per 100k residents" },
  { key: "colleges", roman: "VIII", short: "Colleges", title: "Profiles per athletic dollar" },
  { key: "hs_conversion", roman: "IX", short: "NFHS Slots", title: "Profiles per high-school slot" },
  { key: "era", roman: "X", short: "Era", title: "Roster presence by decade" },
  { key: "you", roman: "XI", short: "You", title: "Your geography, your facts" },
];

const TOGGLE_AWARE = new Set([
  "factories",
  "concentration",
  "halos",
  "distance",
  "climate",
  "per_capita",
  "colleges",
  "hs_conversion",
  "era",
]);

function lensSlice(key, profileType) {
  // Map plate key to analytics key, then suffix with the active lens.
  const ANALYTICS_KEY = {
    factories: "factories",
    concentration: "concentration",
    halos: "halos",
    distance: "distance",
    climate: "climate_sport",
    per_capita: "per_capita",
    colleges: "college_efficiency",
    hs_conversion: "hs_conversion",
    era: "era",
  };
  const base = ANALYTICS_KEY[key];
  if (!base) return null;
  return analytics[`${base}_${profileType}`] || analytics[base];
}

export default function Plates({
  activePlate,
  setActivePlate,
  totals,
  onHoverFactory,
  hoveredFactory,
  profileType,
}) {
  const plate = PLATE_DEFS.find((p) => p.key === activePlate) || PLATE_DEFS[0];
  return (
    <div className="detail">
      <PlateSelector active={activePlate} setActive={setActivePlate} />
      <PlateBody
        plate={plate}
        totals={totals}
        onHoverFactory={onHoverFactory}
        hoveredFactory={hoveredFactory}
        profileType={profileType}
      />
    </div>
  );
}

/* ── Lens toggle (Olympic / Paralympic) ────────────────────────────── */
// Exported so App can render it ABOVE the right-column conditional, so it
// stays visible whether the user is looking at Plates, StatePanel, or
// AthleteCard.

export function LensToggle({ profileType, setProfileType }) {
  return (
    <div className="lens-toggle" role="radiogroup" aria-label="Profile type">
      <span className="lens-toggle-lab">Lens</span>
      <button
        type="button"
        className={`lens-btn ${profileType === "olympic" ? "on" : ""}`}
        onClick={() => setProfileType("olympic")}
        aria-pressed={profileType === "olympic"}
      >
        Olympic
      </button>
      <button
        type="button"
        className={`lens-btn ${profileType === "paralympic" ? "on" : ""}`}
        onClick={() => setProfileType("paralympic")}
        aria-pressed={profileType === "paralympic"}
      >
        Paralympic
      </button>
    </div>
  );
}

/* ── Plate selector strip ──────────────────────────────────────────── */

function PlateSelector({ active, setActive }) {
  return (
    <nav className="plate-nav">
      <div className="plate-nav-label">Plates</div>
      <div className="plate-nav-list">
        {PLATE_DEFS.map((p) => (
          <button
            key={p.key}
            className={`plate-chip ${p.key === active ? "on" : ""}`}
            onClick={() => setActive(p.key)}
            title={p.title}
          >
            <span className="chip-row">
              <span className="r">{p.roman}</span>
              <span className="s">{p.short}</span>
            </span>
            <span className="t">{p.title}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ── Plate dispatcher ──────────────────────────────────────────────── */

function PlateBody({ plate, totals, onHoverFactory, hoveredFactory, profileType }) {
  const k = plate.key;
  // Each toggle-aware plate gets its lens-specific slice + roman numeral.
  const sliceProps = TOGGLE_AWARE.has(k)
    ? { profileType, slice: lensSlice(k, profileType), roman: plate.roman }
    : { roman: plate.roman };
  switch (k) {
    case "ref":           return <PlateReference totals={totals} />;
    case "factories":     return <PlateFactories onHoverFactory={onHoverFactory} hoveredFactory={hoveredFactory} {...sliceProps} />;
    case "concentration": return <PlateConcentration {...sliceProps} />;
    case "halos":         return <PlateHalos {...sliceProps} />;
    case "climate":       return <PlateClimate {...sliceProps} />;
    case "distance":      return <PlateDistance {...sliceProps} />;
    case "colleges":      return <PlateColleges {...sliceProps} />;
    case "per_capita":    return <PlatePerCapita {...sliceProps} />;
    case "hs_conversion": return <PlateHSConversion {...sliceProps} />;
    case "era":           return <PlateEra {...sliceProps} />;
    case "you":           return <PlateYou profileType={profileType} />;
    default:              return null;
  }
}

/* ── Shared bits ───────────────────────────────────────────────────── */

function PlateHeader({ roman, eyebrow, title, italic }) {
  return (
    <header className="plate-head">
      <p className="eyebrow">Plate {roman} · {eyebrow}</p>
      <h3>{title} {italic && <em>{italic}</em>}</h3>
    </header>
  );
}

/* ── Expandable journalist story for each plate ──────────────────────
 *
 * Exported so the host (App.jsx) can render the story directly under the
 * map while the plate selector + per-plate analytics live in the right
 * column. Plate bodies no longer render their own story — App owns it.
 */
export function PlateStory({ plateKey, profileType }) {
  const [open, setOpen] = useState(false);
  const text =
    (profileType && STORIES[`${plateKey}_${profileType}`]) || STORIES[plateKey];
  if (!text) return null;
  return (
    <section className={`plate-story ${open ? "open" : ""}`}>
      <button
        className="story-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="dot" />
        <span className="lab">{open ? "Collapse the story" : "Read the story behind the data"}</span>
        <span className="caret">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="story-body">
          <Markdown text={text} />
        </div>
      )}
    </section>
  );
}

function fmt(n) { return n != null ? n.toLocaleString() : "—"; }
function pct(x) { return (x * 100).toFixed(1) + "%"; }
function lensEyebrow(base, profileType) {
  if (!profileType) return base;
  return `${base} · ${profileType === "paralympic" ? "Paralympic" : "Olympic"}`;
}

const FAMILY_COLOR_HINT = {
  "Aquatic":        "#2d5f7f",
  "Team Ball":      "#8b5a2b",
  "Combat":         "#722f37",
  "Track & Field":  "#c63d2f",
  "Endurance":      "#5a7a3f",
  "Gymnastics":     "#c89837",
  "Winter":         "#4a5d7e",
  "Precision":      "#6b5d3f",
  "Equestrian":     "#3d2817",
  "Racket":         "#8a7c3d",
  "Strength":       "#2e4a3a",
  "Other":          "#555050",
};

/* ── Plate I — Reference (was Marginalia) ──────────────────────────── */

function PlateReference({ totals }) {
  return (
    <div className="marginalia">
      <PlateHeader roman="I" eyebrow="Reference" title="A century of " italic="hometowns." />
      <p className="drop">
        This atlas draws from the {totals.athletes.toLocaleString()} athlete profiles currently
        published on <em>teamusa.com</em> — the official Team USA website — of whom {totals.geocoded.toLocaleString()}
        list a hometown we could pin on the ground by latitude and longitude. What follows is the
        geography of American Olympic and Paralympic talent, as Team USA itself describes it.
      </p>
      <p>
        Click any state to see who it produced, what sports it sends, and the quiet machinery behind
        that production. Click any plate at the top of this column to read the country a different way —
        per capita, by climate, by tracked-facility proximity, decade by decade.
      </p>
      <div className="footnote">
        <p><sup>1</sup> Athlete roster scraped from teamusa.com; hometowns, sports, medals, and other analytic fields come from the Team USA profile payload. The shipped app bundle strips first and last names.</p>
        <p><sup>2</sup> Hometown coordinates from the 2023 U.S. Census Gazetteer, augmented by hand-curated entries.</p>
        <p><sup>3</sup> Training-facility roster is curated from official facility pages. Feeder-college counts use conservative multi-school matches against the EADA public dataset (2023).</p>
        <p><sup>4</sup> Place population for the per-capita plates from the U.S. Census Population Estimates Program (2023).</p>
      </div>
    </div>
  );
}

/* ── Plate II — Small-Town Factories ───────────────────────────────── */

function PlateFactories({ onHoverFactory, hoveredFactory, slice, roman, profileType }) {
  const data = slice || analytics.factories;
  const rows = data.slice(0, 25);
  return (
    <>
      <PlateHeader roman={roman || "II"} eyebrow={lensEyebrow("Per-Capita", profileType)} title="Tiny towns, " italic="big rosters." />
      <p className="plate-lede">
        Towns ranked by Team USA athlete profiles per <span className="num">10,000</span> residents.
        Limited to places with at least <span className="num">500</span> people and{" "}
        <span className="num">2</span> athletes — below that, one extra athlete swings the rate
        too far to compare fairly. Hover a row to find its gold pin on the map.
      </p>
      <ol className="rank-list">
        {rows.map((r, i) => (
          <li
            key={`${r.city}-${r.state}`}
            className={`rank-row ${hoveredFactory === r.city + "|" + r.state ? "hover" : ""}`}
            onMouseEnter={() => onHoverFactory && onHoverFactory(`${r.city}|${r.state}`)}
            onMouseLeave={() => onHoverFactory && onHoverFactory(null)}
          >
            <span className="rk">{i + 1}</span>
            <span className="rb">
              <span className="city">{r.city}, <i>{r.state}</i></span>
              <span className="sub">
                {fmt(r.athletes)} from {fmt(r.population)} pop · {r.top_sport}
              </span>
            </span>
            <span className="rv">
              <b>{r.rate.toFixed(1)}</b>
              <span className="u">/10k</span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

/* ── Plate III — Sport Concentration ───────────────────────────────── */

function PlateConcentration({ slice, roman, profileType }) {
  const data = slice || analytics.concentration;
  const rows = data.filter((r) => r.n_athletes >= 7).slice(0, 24);
  return (
    <>
      <PlateHeader roman={roman || "III"} eyebrow={lensEyebrow("Geography", profileType)} title="Where each sport " italic="lives." />
      <p className="plate-lede">
        How concentrated each sport's hometowns are. A score of{" "}
        <span className="num">1.00</span> means every Team USA profile comes from a single state;
        <span className="num"> 0.05</span> means the sport is spread evenly across the country.
      </p>
      <ul className="rank-list">
        {rows.map((r) => (
          <li key={r.sport} className="rank-row tall">
            <span className="rk dot" style={{ background: FAMILY_COLOR_HINT[r.family] || "#555" }} />
            <span className="rb">
              <span className="city">{r.sport}</span>
              <span className="sub">
                {r.top_states.map((t, i) => (
                  <span key={t.state}>
                    {i > 0 && " · "}
                    <b>{t.state}</b> {Math.round(t.share * 100)}%
                  </span>
                ))}
              </span>
            </span>
            <span className="rv">
              <span className="hhi-bar">
                <span className="hhi-bar-fg" style={{ width: `${Math.min(100, r.hhi * 100)}%` }} />
              </span>
              <span className="u num">{r.hhi.toFixed(2)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="plate-foot">
        The score is the <em>Herfindahl-Hirschman Index</em>, a standard
        concentration measure (the sum of each state's squared share of a sport's profiles).
        It runs from <span className="num">0</span> — perfectly spread across all 51 states — to{" "}
        <span className="num">1</span> — every profile from one state.
      </p>
    </>
  );
}

/* ── Plate IV — Training-Center Halos ──────────────────────────────── */

function PlateHalos({ slice, roman, profileType }) {
  const rows = slice || analytics.halos;
  const maxCum = Math.max(...rows.map((r) => r.cumulative[r.cumulative.length - 1]));
  return (
    <>
      <PlateHeader roman={roman || "IV"} eyebrow={lensEyebrow("Influence", profileType)} title="Reach of the " italic="training centers." />
      <p className="plate-lede">
        How many Team USA athletes live within{" "}
        <span className="num">25 / 50 / 100 / 200</span> miles of each tracked training site.
        Each ring includes everyone in the closer rings, so the 200-mile count is the total within
        200 miles. <strong>Sport-served</strong> counts only athletes whose sport that site
        actually trains — a tighter measure than raw proximity. {TRACKED_FACILITY_COUNT} sites are
        collapsed onto {TRACKED_GEOGRAPHY_COUNT} map locations where they share a campus, and
        <strong> {TRACKED_OPTC_COUNT} are official USOPC training centers</strong> (badged below).
      </p>
      <ul className="halo-list">
        {rows.map((r) => {
          const isOptc = r.type === "OPTC" || CENTER_TYPE_BY_NAME.get(r.name) === "OPTC";
          const direct = r.direct_cumulative?.[r.direct_cumulative.length - 1] || 0;
          return (
          <li key={r.name + r.lat} className={`halo-row${isOptc ? " optc" : ""}`}>
            <div className="halo-name">
              <span className="name">
                {r.name.replace(/^U\.S\. (Olympic & Paralympic )?/, "")}
                {isOptc && <span className="halo-badge" title="USOPC-operated Olympic & Paralympic Training Center">OFFICIAL</span>}
              </span>
              <span className="loc">
                {r.city}, {r.state} · {direct} sport-served profiles within 200mi
                {r.colocated_names?.length ? " · co-located facility collapsed" : ""}
              </span>
            </div>
            <div className="halo-rings">
              {r.rings.map((mi, i) => (
                <span key={mi} className="halo-ring" title={`within ${mi}mi`}>
                  <span className="lab">{mi}mi</span>
                  <span className="bar">
                    <span
                      className="fg"
                      style={{ width: `${(r.cumulative[i] / maxCum) * 100}%` }}
                    />
                  </span>
                  <span className="n num">{r.cumulative[i]}</span>
                </span>
              ))}
            </div>
          </li>
          );
        })}
      </ul>
    </>
  );
}

/* ── Plate V — Distance to Training Center ─────────────────────────── */

function PlateDistance({ slice, roman, profileType }) {
  const { bins, families, scope } = slice || analytics.distance;
  // For each family, collapse the 7 bins into 3 zones: ≤200, 200-800, >800.
  // Sort by total athletes, descending.
  const rows = Object.entries(families)
    .map(([fam, d]) => {
      const totals = bins.map((_, i) => (d.medalist[i] || 0) + (d.nonmedalist[i] || 0));
      const total = totals.reduce((s, n) => s + n, 0);
      const close = totals[0] + totals[1] + totals[2] + totals[3]; // ≤200
      const mid = totals[4] + totals[5];                            // 200-800
      const far = totals[6];                                        // >800
      return { fam, total, close, mid, far };
    })
    .filter((r) => r.total >= 25)
    .sort((a, b) => b.total - a.total);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandClose = rows.reduce((s, r) => s + r.close, 0);
  const grandMid = rows.reduce((s, r) => s + r.mid, 0);
  const grandFar = rows.reduce((s, r) => s + r.far, 0);
  return (
    <>
      <PlateHeader roman={roman || "V"} eyebrow={lensEyebrow("Hometowns", profileType)} title="How far from a " italic="training center?" />
      <p className="plate-lede">
        For each Olympic and Paralympic athlete, the distance from their hometown to the nearest
        tracked training site that actually serves their sport, grouped by sport family. Sports with
        no tracked facility are excluded ({(scope?.unserved_profiles || 0).toLocaleString()} athletes).
      </p>
      <ul className="dist-stack-list">
        {rows.map(({ fam, total, close, mid, far }) => {
          const cp = (close / total) * 100;
          const mp = (mid / total) * 100;
          const fp = (far / total) * 100;
          return (
            <li className="dist-stack-row" key={fam}>
              <div className="dist-fam">
                <span className="dot" style={{ background: FAMILY_COLOR_HINT[fam] || "#555" }} />
                {fam}
                <span className="dist-counts num">{total} athletes</span>
              </div>
              <div className="dist-stack-bar">
                {cp > 0 && (
                  <span
                    className="seg close"
                    style={{ width: `${cp}%` }}
                    title={`${close} within 200mi (${cp.toFixed(1)}%)`}
                  >
                    {cp >= 8 ? `${Math.round(cp)}%` : ""}
                  </span>
                )}
                {mp > 0 && (
                  <span
                    className="seg mid"
                    style={{ width: `${mp}%` }}
                    title={`${mid} 200–800mi (${mp.toFixed(1)}%)`}
                  >
                    {mp >= 8 ? `${Math.round(mp)}%` : ""}
                  </span>
                )}
                {fp > 0 && (
                  <span
                    className="seg far"
                    style={{ width: `${fp}%` }}
                    title={`${far} more than 800mi (${fp.toFixed(1)}%)`}
                  >
                    {fp >= 8 ? `${Math.round(fp)}%` : ""}
                  </span>
                )}
              </div>
            </li>
          );
        })}
        <li className="dist-stack-row total">
          <div className="dist-fam">
            <span className="dot" style={{ background: "#222" }} />
            <strong>All families</strong>
            <span className="dist-counts num">{grandTotal} athletes</span>
          </div>
          <div className="dist-stack-bar">
            <span
              className="seg close"
              style={{ width: `${(grandClose / grandTotal) * 100}%` }}
            >
              {Math.round((grandClose / grandTotal) * 100)}%
            </span>
            <span
              className="seg mid"
              style={{ width: `${(grandMid / grandTotal) * 100}%` }}
            >
              {Math.round((grandMid / grandTotal) * 100)}%
            </span>
            <span
              className="seg far"
              style={{ width: `${(grandFar / grandTotal) * 100}%` }}
            >
              {Math.round((grandFar / grandTotal) * 100)}%
            </span>
          </div>
        </li>
      </ul>
      <div className="dist-legend">
        <span><span className="swatch close" /> within 200 mi</span>
        <span><span className="swatch mid" /> 200–800 mi</span>
        <span><span className="swatch far" /> 800+ mi</span>
      </div>
    </>
  );
}

/* ── Plate VI — Climate × Sport ────────────────────────────────────── */

function PlateClimate({ slice, roman, profileType }) {
  const { zones, matrix, scope } = slice || analytics.climate_sport;
  // For each family row, pick the dominant zone to highlight
  return (
    <>
      <PlateHeader roman={roman || "VI"} eyebrow={lensEyebrow("Atmosphere", profileType)} title="Climate × " italic="sport family." />
      <p className="plate-lede">
        Share of each sport family's Team USA profiles from each state-level climate zone.
        Cell darkness = share; residuals compare each cell to the all-roster climate mix.
        Strong signals: Winter in Cold/Continental, Racket in Mild.
      </p>
      <table className="climate-grid">
        <thead>
          <tr>
            <th></th>
            {zones.map((z) => (
              <th key={z} title={z}>
                {z.replace(/^Humid /, "H. ").replace(/Subtropical/, "Subtr.").substring(0, 9)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => {
            const dominant = row.zones.reduce((m, z) => (z.share > m.share ? z : m), { share: 0 });
            return (
              <tr key={row.family}>
                <th className="fam">
                  <span className="dot" style={{ background: FAMILY_COLOR_HINT[row.family] || "#555" }} />
                  {row.family}
                </th>
                {row.zones.map((z) => {
                  const a = z.share;
                  const isMax = z.zone === dominant.zone && a > 0.05;
                  const bg = a === 0 ? "transparent" : `rgba(198, 61, 47, ${Math.min(1, a * 1.6)})`;
                  return (
                    <td key={z.zone} style={{ background: bg }} className={isMax ? "peak" : ""}>
                      {a > 0.04 ? Math.round(a * 100) : ""}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="plate-foot">
        State-level climate-zone labels from <em>data/hometown_climate.csv</em>, applied by
        athlete hometown state ({(scope?.included_profiles || 0).toLocaleString()} profiles).
      </p>
    </>
  );
}

/* ── Plate VIII — College Efficiency ───────────────────────────────── */

function PlateColleges({ slice, roman, profileType }) {
  const data = slice || analytics.college_efficiency;
  const rows = data.points
    .filter((p) => p.matched_profiles >= 2)
    .slice(0, 20);
  const lensLabel = profileType === "paralympic" ? "Paralympic" : "Olympic";
  return (
    <>
      <PlateHeader roman={roman || "VIII"} eyebrow={lensEyebrow("Per Dollar", profileType)} title={`${lensLabel} profiles per `} italic="athletic dollar." />
      <p className="plate-lede">
        College programs by <b>matched {lensLabel} profiles ÷ athletic budget ($M)</b>.
        Filter ≥ 2 matched profiles in this lens. Hover a row to see the full Olympic / Paralympic / Hopeful split.
      </p>
      <ul className="rank-list">
        {rows.map((r, i) => (
          <li key={r.name} className="rank-row">
            <span className="rk">{i + 1}</span>
            <span className="rb">
              <span className="city">{r.name}</span>
              <span className="sub">
                {r.matched_profiles} profiles · ${r.budget_m}M budget · {r.state}
                {r.classification ? ` · ${r.classification}` : ""}
                {" · "}
                O {r.olympians} / P {r.paralympians} / H {r.hopefuls}
              </span>
            </span>
            <span className="rv">
              <b>{r.ratio.toFixed(2)}</b>
              <span className="u">/$M</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Plate VII — Per-Capita State Rankings (merged Olympic/Paralympic) ── */

function PlatePerCapita({ slice, roman, profileType }) {
  const lensLabel = profileType === "paralympic" ? "Paralympians" : "Olympians";
  const all = slice || analytics.per_capita;
  // Filter out zero-row states for the active lens; sort by per-100k desc
  const sorted = [...all].sort((a, b) => b.per_100k - a.per_100k);
  const rows = sorted.slice(0, 25);
  const max = rows.length ? rows[0].per_100k : 1;
  const totalProfiles = all.reduce((s, r) => s + (r.profiles || 0), 0);
  const totalPop = all.reduce((s, r) => s + (r.population || 0), 0);
  const national = totalPop ? (totalProfiles / totalPop) * 100_000 : 0;
  return (
    <>
      <PlateHeader roman={roman || "VII"} eyebrow={lensEyebrow("Density", profileType)} title={`${lensLabel} per `} italic="100k residents." />
      <p className="plate-lede">
        {lensLabel} per <span className="num">100,000</span> state residents. State
        population from Census PEP 2023. National baseline:{" "}
        <strong>{national.toFixed(2)} per 100k</strong>.
      </p>
      <ul className="div-list">
        {rows.map((r) => (
          <li
            key={r.state}
            className="div-row"
            title={`${r.profiles} ${lensLabel} · ${r.population.toLocaleString()} residents`}
          >
            <span className="lab strong">{r.state}</span>
            <span className="div-bar tall">
              <span className="solo" style={{ width: `${(r.per_100k / max) * 100}%` }} />
            </span>
            <span className="num">
              <b>{r.per_100k.toFixed(2)}</b>
            </span>
          </li>
        ))}
      </ul>
      <p className="plate-foot">
        {lensLabel} from teamusa.com; population from Census PEP 2023. Switch the lens toggle above to swap between Olympic and Paralympic.
      </p>
    </>
  );
}

/* ── Plate X — NFHS participation-slot density ─────────────────────── */

function PlateHSConversion({ slice, roman, profileType }) {
  const data = slice || analytics.hs_conversion;
  const lensLabel = profileType === "paralympic" ? "Paralympians" : "Olympians";
  const rows = data
    .filter((r) => (r.nfhs_participation_slots ?? r.nfhs) >= 5000)
    .slice(0, 25);
  const max = rows.length ? rows[0].per_million_hs : 1;
  return (
    <>
      <PlateHeader roman={roman || "IX"} eyebrow={lensEyebrow("Density", profileType)} title={`${lensLabel} per `} italic="NFHS slot." />
      <p className="plate-lede">
        Team USA profiles per <span className="num">1,000,000</span> NFHS participation
        slots. Uses 2024-25 official NFHS state totals; slots are not unique students.
      </p>
      <ul className="div-list">
        {rows.map((r) => {
          const profiles = r.profiles || 1;
          return (
            <li
              key={r.state}
              className="div-row"
              title={`Olympic ${r.olympians} / Paralympic ${r.paralympians} / Hopeful ${r.hopefuls}`}
            >
              <span className="lab strong">{r.state}</span>
              <span className="div-bar tall">
                <span
                  className="stack"
                  style={{ width: `${(r.per_million_hs / max) * 100}%` }}
                >
                  <span className="o" style={{ width: `${(r.olympians / profiles) * 100}%` }} />
                  <span className="p" style={{ width: `${(r.paralympians / profiles) * 100}%` }} />
                  <span className="h" style={{ width: `${(r.hopefuls / profiles) * 100}%` }} />
                </span>
              </span>
              <span className="num">
                <b>{r.per_million_hs.toFixed(0)}</b>
                <span className="u">/M</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="plate-foot">
        Official NFHS 2024-25 state totals; participation slots, not unique students. Bars split Olympic / Paralympic / Hopeful.
      </p>
    </>
  );
}

/* ── Plate XI — Era Presence ───────────────────────────────────────── */

function PlateEra({ slice, roman, profileType }) {
  const data = slice || analytics.era;
  const { decades, per_state, national, scope = {}, swing_metric = {} } = data;
  const minTotal = profileType === "paralympic" ? 5 : 30;
  // Recompute the ranking client-side so we can use a lens-appropriate threshold
  // (Paralympic totals are smaller than Olympic, so the upstream min_total=30 cuts too much).
  const ranked = Object.entries(per_state)
    .map(([st, counts]) => {
      const early = counts[0] + counts[1];
      const late = counts[3] + counts[4];
      const total = counts.reduce((a, b) => a + b, 0);
      const swing = (late + 1) / (early + 1);
      return { state: st, counts, total, swing };
    })
    .filter((r) => r.total >= minTotal)
    .sort((a, b) => b.swing - a.swing)
    .slice(0, 14)
    .map((r) => ({ st: r.state, counts: r.counts, total: r.total, swing: r.swing }));
  const colMax = decades.map((_, i) => Math.max(...ranked.map((r) => r.counts[i]), 1));
  return (
    <>
      <PlateHeader roman={roman || "X"} eyebrow={lensEyebrow("Time", profileType)} title="Era presence " italic="by decade." />
      <p className="plate-lede">
        Team USA profiles with parsed active years, counted in every overlapping decade.
        Sorted by {swing_metric.label || "(2010s + 2020s + 1) / (1980s + 1990s + 1)"};
        legacy Midwest/Northeast states and mountain states dominate this roster slice.
      </p>
      <table className="era-grid">
        <thead>
          <tr>
            <th></th>
            {decades.map((d) => (
              <th key={d.label}>{d.label}</th>
            ))}
            <th className="swing">×</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r) => (
            <tr key={r.st}>
              <th>{r.st}</th>
              {r.counts.map((n, i) => {
                const intensity = colMax[i] ? n / colMax[i] : 0;
                const bg = n === 0 ? "transparent" : `rgba(74, 93, 126, ${Math.min(1, 0.15 + intensity * 0.8)})`;
                return (
                  <td key={i} style={{ background: bg }}>{n || ""}</td>
                );
              })}
              <td className="swing num">{r.swing.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>USA</th>
            {national.map((n, i) => (
              <td key={i} className="natl num">{n}</td>
            ))}
            <td></td>
          </tr>
        </tfoot>
      </table>
      <p className="plate-foot">
        Scope: {(scope.included_profiles_with_parsed_year || 0).toLocaleString()} profiles included;
        {" "}
        {(scope.excluded_no_parsed_year || 0).toLocaleString()} geocoded profiles have no parsed year and are excluded.
        Current-profile roster bias means this is not a complete historical census.
      </p>
    </>
  );
}

/* ── Plate XII — Your atlas (personalized fun facts) ──────────────── */

const YOU_STORAGE_KEY = "olympian-roots:you";

function loadYouState() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(YOU_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveYouState(value) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(YOU_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

function PlateYou({ profileType = "olympic" }) {
  const cached = loadYouState();
  const [hometown, setHometown] = useState(cached?.hometown || "");
  const [residence, setResidence] = useState(cached?.residence || "");
  const [response, setResponse] = useState(cached?.response || "");
  const [editing, setEditing] = useState(!cached?.response);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  async function submit() {
    const h = hometown.trim();
    const r = residence.trim();
    if (!h && !r) {
      setError("Tell the atlas at least one place — hometown or current residence.");
      return;
    }
    setError(null);
    setEditing(false);
    setStreaming(true);
    setResponse("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = "";

    try {
      for await (const evt of streamPersonal({ hometown: h, residence: r, profileType, signal: ctrl.signal })) {
        if (evt.type === "text") {
          acc += evt.delta;
          setResponse(acc);
        } else if (evt.type === "done") {
          setStreaming(false);
          saveYouState({ hometown: h, residence: r, response: acc });
          break;
        } else if (evt.type === "error") {
          setError(evt.message);
          setStreaming(false);
          break;
        }
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        setError(e?.message || String(e));
        setStreaming(false);
      }
    } finally {
      abortRef.current = null;
    }
  }

  function clearAll() {
    abortRef.current?.abort();
    setResponse("");
    setHometown("");
    setResidence("");
    setEditing(true);
    setError(null);
    setStreaming(false);
    if (typeof localStorage !== "undefined") localStorage.removeItem(YOU_STORAGE_KEY);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  const showForm = editing || (!response && !streaming);

  return (
    <>
      <PlateHeader roman="XI" eyebrow="For You" title="Your " italic="atlas." />
      <p className="plate-lede">
        Tell the atlas where you grew up and where you live now. It will
        thread the same data behind the other 11 plates around your
        geography — five quick facts, no athlete names.
      </p>

      {showForm ? (
        <form
          className="you-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="you-field">
            <span className="you-lab">Where did you grow up?</span>
            <input
              type="text"
              value={hometown}
              onChange={(e) => setHometown(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Park City, UT"
              autoFocus
              maxLength={120}
            />
          </label>
          <label className="you-field">
            <span className="you-lab">Where do you live now?</span>
            <input
              type="text"
              value={residence}
              onChange={(e) => setResidence(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Burlington, VT"
              maxLength={120}
            />
          </label>
          <div className="you-actions">
            <button
              type="submit"
              className="you-submit"
              disabled={streaming || (!hometown.trim() && !residence.trim())}
            >
              {streaming ? "Reading…" : "Read my atlas"}
            </button>
            {response && (
              <button type="button" className="you-cancel" onClick={() => setEditing(false)}>
                cancel
              </button>
            )}
          </div>
          {error && <p className="you-error">{error}</p>}
        </form>
      ) : (
        <div className="you-result">
          <div className="you-meta">
            <span className="you-meta-row">
              <span className="you-meta-lab">Hometown</span>
              <span className="you-meta-val">{hometown || "—"}</span>
            </span>
            <span className="you-meta-row">
              <span className="you-meta-lab">Now in</span>
              <span className="you-meta-val">{residence || "—"}</span>
            </span>
            <button type="button" className="you-edit" onClick={() => setEditing(true)}>
              edit
            </button>
          </div>
          {response ? (
            <Markdown text={response} />
          ) : streaming ? (
            <p className="you-thinking">
              <span className="thinking">
                <span /><span /><span />
              </span>
              <span className="you-thinking-lab">atlas is reading</span>
            </p>
          ) : null}
          {error && <p className="you-error">{error}</p>}
          <p className="you-foot">
            Drawn from the same dataset as the rest of the atlas. No external sources, no athlete names.
          </p>
          <button type="button" className="you-reset" onClick={clearAll}>
            start over
          </button>
        </div>
      )}
    </>
  );
}
