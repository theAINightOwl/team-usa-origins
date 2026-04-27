import React, { useState } from "react";
import analytics from "../data/analytics.json";
import trainingCentersData from "../data/training_centers.json";
import { STORIES } from "../data/plate_stories.js";
import Markdown from "../lib/markdown.jsx";

const CENTER_TYPE_BY_NAME = new Map(trainingCentersData.map((c) => [c.name, c.type]));
const OPTC_COUNT = trainingCentersData.filter((c) => c.type === "OPTC").length;
const AFFILIATE_COUNT = trainingCentersData.length - OPTC_COUNT;

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
  { key: "distance", roman: "V", short: "Distance", title: "Closer to a center, more medals?" },
  { key: "climate", roman: "VI", short: "Climate", title: "Climate × sport family" },
  { key: "paralympic", roman: "VII", short: "Paralympic", title: "Paralympic geography" },
  { key: "colleges", roman: "VIII", short: "Colleges", title: "Olympians per athletic dollar" },
  { key: "per_capita", roman: "IX", short: "Per Capita", title: "Olympians per 100k residents" },
  { key: "hs_conversion", roman: "X", short: "Pipeline", title: "From high-school field to podium" },
  { key: "era", roman: "XI", short: "Era", title: "How the map moved, decade by decade" },
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

/* ── Expandable journalist story for each plate ────────────────────── */
function PlateStory({ plateKey }) {
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
          <p className="story-foot">
            <em>From the journalist's notebook — full version at <code>PLATE_STORIES.md</code>.</em>
          </p>
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
        per capita, by climate, by training-center proximity, decade by decade.
      </p>
      <div className="footnote">
        <p><sup>1</sup> Athlete roster scraped from <em>teamusa.com/api/athletes</em>; names, hometowns, sports, and medals come from the Team USA profile payload directly.</p>
        <p><sup>2</sup> Hometown coordinates from the 2023 U.S. Census Gazetteer, augmented by hand-curated entries (see <em>datasets/teamusa_hometown_manual.csv</em>).</p>
        <p><sup>3</sup> Training-center roster from the USOPC. Feeder-college counts fuzzy-matched against the EADA public dataset (2023).</p>
        <p><sup>4</sup> Place population for the per-capita plates from the Census PEP <em>sub-est2023.csv</em> file.</p>
      </div>
      <PlateStory plateKey="ref" />
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
        Towns ranked by olympians produced per <span className="num">10,000</span> residents.
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
                {fmt(r.olympians)} from {fmt(r.population)} pop · {r.top_sport}
              </span>
            </span>
            <span className="rv">
              <b>{r.rate.toFixed(1)}</b>
              <span className="u">/10k</span>
            </span>
          </li>
        ))}
      </ol>
      <PlateStory plateKey="factories" />
    </>
  );
}

/* ── Plate III — Sport Concentration ───────────────────────────────── */

function PlateConcentration() {
  const rows = analytics.concentration.filter((r) => r.n_athletes >= 8).slice(0, 24);
  return (
    <>
      <PlateHeader roman="III" eyebrow="Geography" title="Where each sport " italic="lives." />
      <p className="plate-lede">
        Herfindahl index: the sum of squared state shares for each sport.
        <span className="num"> 1.0</span> means every athlete is from one state;
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
      <PlateStory plateKey="concentration" />
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
        Athletes within <span className="num">25 / 50 / 100 / 200</span> miles of each facility.
        <strong> {OPTC_COUNT} are official USOPC-operated OPTCs</strong> (badged below);
        the other {AFFILIATE_COUNT} are USOPC-affiliated training sites. Cumulative — wider rings include all closer ones.
      </p>
      <ul className="halo-list">
        {rows.map((r) => {
          const isOptc = CENTER_TYPE_BY_NAME.get(r.name) === "OPTC";
          return (
          <li key={r.name + r.lat} className={`halo-row${isOptc ? " optc" : ""}`}>
            <div className="halo-name">
              <span className="name">
                {r.name.replace(/^U\.S\. (Olympic & Paralympic )?/, "")}
                {isOptc && <span className="halo-badge" title="USOPC-operated Olympic & Paralympic Training Center">OFFICIAL</span>}
              </span>
              <span className="loc">{r.city}, {r.state}</span>
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
      <PlateStory plateKey="halos" />
    </>
  );
}

/* ── Plate V — Distance to Training Center ─────────────────────────── */

function PlateDistance() {
  const { bins, families } = analytics.distance;
  // sort families by # medalists
  const ordered = Object.entries(families)
    .sort((a, b) => b[1].n_med - a[1].n_med)
    .slice(0, 8);
  const rowMax = (counts) => Math.max(1, ...counts);
  return (
    <>
      <PlateHeader roman="V" eyebrow="Proximity" title="Closer to a center, " italic="more medals?" />
      <p className="plate-lede">
        Distance from each athlete's hometown to the nearest USOPC center, bucketed.
        For each family: <span className="rust-tag">medalists</span> on top,
        <span className="ink-tag"> non-medalists</span> on bottom. Watch the winter sports.
      </p>
      <div className="dist-list">
        {ordered.map(([fam, d]) => {
          const m = rowMax([...d.medalist, ...d.nonmedalist]);
          return (
            <div className="dist-row" key={fam}>
              <div className="dist-fam">
                <span className="dot" style={{ background: FAMILY_COLOR_HINT[fam] || "#555" }} />
                {fam}
                <span className="dist-counts">
                  {d.n_med}<span className="sep">m</span> · {d.n_non}<span className="sep">n</span>
                </span>
              </div>
              <div className="dist-bars">
                {bins.map((b, i) => {
                  const med = d.medalist[i] || 0;
                  const non = d.nonmedalist[i] || 0;
                  return (
                    <div key={b} className="dist-col">
                      <div className="med" style={{ height: `${(med / m) * 100}%` }} title={`${b}: ${med} medalists`} />
                      <div className="non" style={{ height: `${(non / m) * 100}%` }} title={`${b}: ${non} non-medalists`} />
                      <div className="lab">{b}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <PlateStory plateKey="distance" />
    </>
  );
}

/* ── Plate VI — Climate × Sport ────────────────────────────────────── */

function PlateClimate() {
  const { zones, families, matrix } = analytics.climate_sport;
  // For each family row, pick the dominant zone to highlight
  return (
    <>
      <PlateHeader roman="VI" eyebrow="Atmosphere" title="Climate × " italic="sport family." />
      <p className="plate-lede">
        Share of each sport family's athletes from each climate zone.
        Cell darkness = share. Diagonal stories: Winter ↔ Cold, Aquatic ↔ Subtropical.
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
        Zones from NCEI Köppen classification, applied to athlete's state of residence.
      </p>
      <PlateStory plateKey="climate" />
    </>
  );
}

/* ── Plate VII — Paralympic Geography ──────────────────────────────── */

function PlateParalympic() {
  const rows = analytics.paralympic.filter((r) => r.total >= 10);
  return (
    <>
      <PlateHeader roman="VII" eyebrow="Two Games" title="Paralympic " italic="geography." />
      <p className="plate-lede">
        Each state's <span className="rust-tag">Paralympic</span> share of its total Team USA athletes.
        States with high shares often live near a VA hospital or military base.
      </p>
      <ul className="div-list">
        {rows.map((r) => {
          const oWidth = (r.olympic / r.total) * 100;
          const pWidth = (r.paralympic / r.total) * 100;
          return (
            <li key={r.state} className="div-row">
              <span className="lab">{r.state}</span>
              <span className="div-bar">
                <span className="o" style={{ width: `${oWidth}%` }} title={`${r.olympic} Olympic`} />
                <span className="p" style={{ width: `${pWidth}%` }} title={`${r.paralympic} Paralympic`} />
              </span>
              <span className="num para-pct">{(r.para_share * 100).toFixed(0)}%</span>
            </li>
          );
        })}
      </ul>
      <PlateStory plateKey="paralympic" />
    </>
  );
}

/* ── Plate VIII — College Efficiency ───────────────────────────────── */

function PlateColleges() {
  const rows = analytics.college_efficiency.points.filter((p) => p.olympians >= 2).slice(0, 20);
  return (
    <>
      <PlateHeader roman="VIII" eyebrow="Per Dollar" title="Olympians per " italic="athletic dollar." />
      <p className="plate-lede">
        Top NCAA programs by <b>olympians produced ÷ athletic budget ($M)</b>.
        Filter ≥ 2 olympians. The list rewards efficient mid-budget programs as much as the giants.
      </p>
      <ul className="rank-list">
        {rows.map((r, i) => (
          <li key={r.name} className="rank-row">
            <span className="rk">{i + 1}</span>
            <span className="rb">
              <span className="city">{r.name}</span>
              <span className="sub">
                {r.olympians} olympians · ${r.budget_m}M budget · {r.state}
              </span>
            </span>
            <span className="rv">
              <b>{r.ratio.toFixed(2)}</b>
              <span className="u">/$M</span>
            </span>
          </li>
        ))}
      </ul>
      <PlateStory plateKey="colleges" />
    </>
  );
}

/* ── Plate IX — Per-Capita State Rankings ──────────────────────────── */

function PlatePerCapita() {
  const rows = analytics.per_capita.slice(0, 25);
  const max = rows[0].per_100k;
  return (
    <>
      <PlateHeader roman="IX" eyebrow="Density" title="Olympians per " italic="100k residents." />
      <p className="plate-lede">
        Same map, new metric. Big states sink, mountain &amp; northeastern states rise.
        State population from Census PEP 2023.
      </p>
      <ul className="div-list">
        {rows.map((r) => (
          <li key={r.state} className="div-row">
            <span className="lab strong">{r.state}</span>
            <span className="div-bar tall">
              <span
                className="solo"
                style={{ width: `${(r.per_100k / max) * 100}%` }}
              />
            </span>
            <span className="num">
              <b>{r.per_100k.toFixed(2)}</b>
            </span>
          </li>
        ))}
      </ul>
      <p className="plate-foot">
        Rate per 100,000. National average ≈ {(rows.reduce((s, r) => s + r.olympians, 0) /
          rows.reduce((s, r) => s + r.population, 0) * 100000).toFixed(2)}.
      </p>
      <PlateStory plateKey="per_capita" />
    </>
  );
}

/* ── Plate X — HS to Podium Pipeline ───────────────────────────────── */

function PlateHSConversion() {
  const rows = analytics.hs_conversion.filter((r) => r.nfhs >= 5000).slice(0, 25);
  const max = rows[0].per_million_hs;
  return (
    <>
      <PlateHeader roman="X" eyebrow="Pipeline" title="From high-school field to " italic="podium." />
      <p className="plate-lede">
        Olympians produced per <span className="num">1,000,000</span> NFHS high-school
        sports participants in the state. Filter NFHS ≥ 5k to drop micro-states.
      </p>
      <ul className="div-list">
        {rows.map((r) => (
          <li key={r.state} className="div-row">
            <span className="lab strong">{r.state}</span>
            <span className="div-bar tall">
              <span
                className="solo gold"
                style={{ width: `${(r.per_million_hs / max) * 100}%` }}
              />
            </span>
            <span className="num">
              <b>{r.per_million_hs.toFixed(0)}</b>
              <span className="u">/M</span>
            </span>
          </li>
        ))}
      </ul>
      <PlateStory plateKey="hs_conversion" />
    </>
  );
}

/* ── Plate XI — Era Migration ──────────────────────────────────────── */

function PlateEra() {
  const { decades, per_state, national } = analytics.era;
  // pick the 12 states with the largest swing (relative growth) from 1980s → 2020s
  const ranked = Object.entries(per_state)
    .map(([st, counts]) => {
      const early = counts[0] + counts[1];
      const late = counts[3] + counts[4];
      const total = counts.reduce((a, b) => a + b, 0);
      const swing = (late + 1) / (early + 1);
      return { st, counts, total, swing };
    })
    .filter((r) => r.total >= 30)
    .sort((a, b) => b.swing - a.swing)
    .slice(0, 14);
  const colMax = decades.map((_, i) => Math.max(...ranked.map((r) => r.counts[i]), 1));
  return (
    <>
      <PlateHeader roman="XI" eyebrow="Time" title="How the map " italic="moved." />
      <p className="plate-lede">
        For each state, athletes active in each decade. Sorted by 2020s/1980s ratio —
        the Sun Belt and the mountain west float to the top.
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
      <PlateStory plateKey="era" />
    </>
  );
}
