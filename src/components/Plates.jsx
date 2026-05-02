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
  { key: "factories", roman: "II", short: "Factories", title: "The smallest factories" },
  { key: "concentration", roman: "III", short: "Concentration", title: "Where each sport lives" },
  { key: "halos", roman: "IV", short: "Halos", title: "Reach of the training centers" },
  { key: "distance", roman: "V", short: "Distance", title: "Closer to the right facility?" },
  { key: "climate", roman: "VI", short: "Climate", title: "Climate × sport family" },
  { key: "paralympic", roman: "VII", short: "Paralympic", title: "Paralympic geography" },
  { key: "colleges", roman: "VIII", short: "Colleges", title: "Team USA profiles per athletic dollar" },
  { key: "per_capita", roman: "IX", short: "Per Capita", title: "Team USA profiles per 100k residents" },
  { key: "hs_conversion", roman: "X", short: "NFHS Slots", title: "Team USA profiles per NFHS slot" },
  { key: "era", roman: "XI", short: "Era", title: "Era presence by decade" },
  { key: "you", roman: "XII", short: "You", title: "Your atlas — fun facts about your geography" },
];

export default function Plates({ activePlate, setActivePlate, totals, onHoverFactory, hoveredFactory }) {
  const plate = PLATE_DEFS.find((p) => p.key === activePlate) || PLATE_DEFS[0];
  return (
    <div className="detail">
      <PlateSelector active={activePlate} setActive={setActivePlate} />
      <PlateBody plate={plate} totals={totals} onHoverFactory={onHoverFactory} hoveredFactory={hoveredFactory} />
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
            <span className="r">{p.roman}</span>
            <span className="s">{p.short}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ── Plate dispatcher ──────────────────────────────────────────────── */

function PlateBody({ plate, totals, onHoverFactory, hoveredFactory }) {
  switch (plate.key) {
    case "ref":           return <PlateReference totals={totals} />;
    case "factories":     return <PlateFactories onHoverFactory={onHoverFactory} hoveredFactory={hoveredFactory} />;
    case "concentration": return <PlateConcentration />;
    case "halos":         return <PlateHalos />;
    case "climate":       return <PlateClimate />;
    case "distance":      return <PlateDistance />;
    case "paralympic":    return <PlateParalympic />;
    case "colleges":      return <PlateColleges />;
    case "per_capita":    return <PlatePerCapita />;
    case "hs_conversion": return <PlateHSConversion />;
    case "era":           return <PlateEra />;
    case "you":           return <PlateYou />;
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
export function PlateStory({ plateKey }) {
  const [open, setOpen] = useState(false);
  const text = STORIES[plateKey];
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
        <p><sup>1</sup> Athlete roster scraped from <em>teamusa.com/api/athletes</em>; hometowns, sports, medals, and other analytic fields come from the Team USA profile payload. The shipped app bundle strips first and last names.</p>
        <p><sup>2</sup> Hometown coordinates from the 2023 U.S. Census Gazetteer, augmented by hand-curated entries (see <em>data/teamusa_hometown_manual.csv</em>).</p>
        <p><sup>3</sup> Training-facility roster is curated from official facility pages. Feeder-college counts use conservative multi-school matches against the EADA public dataset (2023).</p>
        <p><sup>4</sup> Place population for the per-capita plates from the Census PEP <em>sub-est2023.csv</em> file.</p>
      </div>
    </div>
  );
}

/* ── Plate II — Small-Town Factories ───────────────────────────────── */

function PlateFactories({ onHoverFactory, hoveredFactory }) {
  const rows = analytics.factories.slice(0, 25);
  return (
    <>
      <PlateHeader roman="II" eyebrow="Per-Capita" title="The smallest " italic="factories." />
      <p className="plate-lede">
        Towns ranked by Team USA athlete profiles per <span className="num">10,000</span> residents.
        Filtered to places ≥ 500 population with ≥ 2 athletes — the rest is statistical noise.
        Hover a row to find its gold pin on the map.
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

function PlateConcentration() {
  const rows = analytics.concentration.filter((r) => r.n_athletes >= 7).slice(0, 24);
  return (
    <>
      <PlateHeader roman="III" eyebrow="Geography" title="Where each sport " italic="lives." />
      <p className="plate-lede">
        Herfindahl index: the sum of squared state shares for each sport's Team USA profiles.
        <span className="num"> 1.0</span> means every profile is from one state;
        <span className="num"> 0.02</span> means perfectly spread across all 51.
        Sorted most → least concentrated.
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
    </>
  );
}

/* ── Plate IV — Training-Center Halos ──────────────────────────────── */

function PlateHalos() {
  const rows = analytics.halos;
  const maxCum = Math.max(...rows.map((r) => r.cumulative[r.cumulative.length - 1]));
  return (
    <>
      <PlateHeader roman="IV" eyebrow="Influence" title="Reach of the " italic="training centers." />
      <p className="plate-lede">
        Team USA profiles within <span className="num">25 / 50 / 100 / 200</span> miles of each tracked facility geography.
        The curated roster includes {TRACKED_FACILITY_COUNT} facilities collapsed to {TRACKED_GEOGRAPHY_COUNT} map locations;
        <strong> {TRACKED_OPTC_COUNT} are USOPC-operated OPTCs</strong> (badged below). Cumulative — wider rings include all closer ones.
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

function PlateDistance() {
  const { bins, families, scope } = analytics.distance;
  // sort families by # medalists
  const ordered = Object.entries(families)
    .sort((a, b) => b[1].n_med - a[1].n_med)
    .slice(0, 8);
  return (
    <>
      <PlateHeader roman="V" eyebrow="Proximity" title="Closer to the right facility, " italic="more medals?" />
      <p className="plate-lede">
        Distance from each Olympic/Paralympic hometown to the nearest tracked facility geography
        that lists the athlete's sport, bucketed by family. Bars show each bucket's{" "}
        <span className="rust-tag">medalist rate</span>; the right edge shows the ≤200mi proximity
        premium versus non-medalists. Sports outside the tracked facility roster are excluded
        ({(scope?.unserved_profiles || 0).toLocaleString()} profiles).
      </p>
      <div className="dist-list">
        {ordered.map(([fam, d]) => {
          const premium = d.premium_within_200_pp || 0;
          return (
            <div className="dist-row" key={fam}>
              <div className="dist-fam">
                <span className="dot" style={{ background: FAMILY_COLOR_HINT[fam] || "#555" }} />
                {fam}
                <span className="dist-counts">
                  {premium > 0 ? "+" : ""}{premium.toFixed(1)}<span className="sep">pp</span> ≤200
                </span>
              </div>
              <div className="dist-bars">
                {bins.map((b, i) => {
                  const med = d.medalist[i] || 0;
                  const non = d.nonmedalist[i] || 0;
                  const rate = d.medalist_rate?.[i] || 0;
                  return (
                    <div key={b} className="dist-col">
                      <div
                        className="med"
                        style={{ height: `${rate * 100}%` }}
                        title={`${b}: ${(rate * 100).toFixed(1)}% medalist rate (${med} medalists, ${non} non-medalists)`}
                      />
                      <div className="lab">{b}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Plate VI — Climate × Sport ────────────────────────────────────── */

function PlateClimate() {
  const { zones, matrix, scope } = analytics.climate_sport;
  // For each family row, pick the dominant zone to highlight
  return (
    <>
      <PlateHeader roman="VI" eyebrow="Atmosphere" title="Climate × " italic="sport family." />
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

/* ── Plate VII — Paralympic Geography ──────────────────────────────── */

function PlateParalympic() {
  const meta = analytics.meta?.paralympic || {};
  const threshold = meta.display_threshold_total || 10;
  const excludedHopefuls = meta.excluded_profile_types?.Hopeful || 0;
  const rows = analytics.paralympic.filter((r) => r.total >= threshold);
  return (
    <>
      <PlateHeader roman="VII" eyebrow="Two Games" title="Paralympic " italic="geography." />
      <p className="plate-lede">
        Each state's <span className="rust-tag">Paralympic</span> share of Olympic+Paralympic
        profiles. Hopeful profiles are excluded ({excludedHopefuls.toLocaleString()}); chart shows
        states with at least {threshold} included profiles.
      </p>
      <ul className="div-list">
        {rows.map((r) => {
          const oWidth = (r.olympic / r.total) * 100;
          const pWidth = (r.paralympic / r.total) * 100;
          return (
            <li key={r.state} className="div-row">
              <span className="lab">{r.state}</span>
              <span className="div-bar">
                <span className="o" style={{ width: `${oWidth}%` }} title={`${r.olympic} Olympic profiles`} />
                <span className="p" style={{ width: `${pWidth}%` }} title={`${r.paralympic} Paralympic profiles`} />
              </span>
              <span className="num para-pct">{(r.para_share * 100).toFixed(0)}%</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ── Plate VIII — College Efficiency ───────────────────────────────── */

function PlateColleges() {
  const rows = analytics.college_efficiency.points
    .filter((p) => p.matched_profiles >= 2)
    .slice(0, 20);
  return (
    <>
      <PlateHeader roman="VIII" eyebrow="Per Dollar" title="Team USA profiles per " italic="athletic dollar." />
      <p className="plate-lede">
        College programs by <b>matched Team USA profiles ÷ athletic budget ($M)</b>.
        Filter ≥ 2 matched profiles. Olympic, Paralympic, and Hopeful records are shown in the type mix.
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

/* ── Plate IX — Per-Capita State Rankings ──────────────────────────── */

function PlatePerCapita() {
  const rows = analytics.per_capita.slice(0, 25);
  const max = rows[0].per_100k;
  const national = analytics.meta?.per_capita?.national_per_100k ??
    (analytics.per_capita.reduce((s, r) => s + r.profiles, 0) /
      analytics.per_capita.reduce((s, r) => s + r.population, 0) * 100000);
  return (
    <>
      <PlateHeader roman="IX" eyebrow="Density" title="Team USA profiles per " italic="100k residents." />
      <p className="plate-lede">
        Same map, new metric. Big states sink, mountain &amp; northeastern states rise.
        All profile types are included; state population from Census PEP 2023.
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
                  style={{ width: `${(r.per_100k / max) * 100}%` }}
                >
                  <span className="o" style={{ width: `${(r.olympians / profiles) * 100}%` }} />
                  <span className="p" style={{ width: `${(r.paralympians / profiles) * 100}%` }} />
                  <span className="h" style={{ width: `${(r.hopefuls / profiles) * 100}%` }} />
                </span>
              </span>
              <span className="num">
                <b>{r.per_100k.toFixed(2)}</b>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="plate-foot">
        Rate per 100,000 Team USA profiles. National average ≈ {national.toFixed(2)}. Bars split Olympic / Paralympic / Hopeful.
      </p>
    </>
  );
}

/* ── Plate X — NFHS participation-slot density ─────────────────────── */

function PlateHSConversion() {
  const rows = analytics.hs_conversion
    .filter((r) => (r.nfhs_participation_slots ?? r.nfhs) >= 5000)
    .slice(0, 25);
  const max = rows[0].per_million_hs;
  return (
    <>
      <PlateHeader roman="X" eyebrow="Density" title="Team USA profiles per " italic="NFHS slot." />
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

function PlateEra() {
  const { decades, per_state, national, scope = {}, swing_metric = {} } = analytics.era;
  // Largest relative growth: (2010s + 2020s + 1) / (1980s + 1990s + 1).
  const ranked = (analytics.era.swing_rankings || Object.entries(per_state)
    .map(([st, counts]) => {
      const early = counts[0] + counts[1];
      const late = counts[3] + counts[4];
      const total = counts.reduce((a, b) => a + b, 0);
      const swing = (late + 1) / (early + 1);
      return { state: st, counts, total, swing };
    })
    .filter((r) => r.total >= 30)
    .sort((a, b) => b.swing - a.swing))
    .slice(0, 14)
    .map((r) => ({ st: r.state, counts: r.counts, total: r.total, swing: r.swing }));
  const colMax = decades.map((_, i) => Math.max(...ranked.map((r) => r.counts[i]), 1));
  return (
    <>
      <PlateHeader roman="XI" eyebrow="Time" title="Era presence " italic="by decade." />
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

function PlateYou() {
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
      for await (const evt of streamPersonal({ hometown: h, residence: r, signal: ctrl.signal })) {
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
      <PlateHeader roman="XII" eyebrow="For You" title="Your " italic="atlas." />
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
