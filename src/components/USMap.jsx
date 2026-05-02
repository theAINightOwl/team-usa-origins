import React, { useMemo, useState, useCallback } from "react";

/*
 * USMap — a hand-rendered SVG atlas plate.
 *
 * Uses d3-geo's Albers USA projection + topojson features provided by the
 * parent. Renders:
 *   • state choropleth (fill from `metric`)
 *   • athlete hometown dots (coloured by sport family)
 *   • training-center markers (gold/rust stars)
 *   • college circles at state centroids (size ∝ matched Team USA profiles)
 *
 * Hover surfaces a minimal tooltip; click fires onSelectState / onSelectAthlete.
 */

const WIDTH = 975;
const HEIGHT = 610;

// Monotone choropleth ramp: aged paper → deep rust.
const RAMP_LOW = [236, 226, 204];  // --land
const RAMP_HIGH = [143, 42, 32];   // --rust-deep

function lerpColor(t) {
  const c = [0, 1, 2].map((i) =>
    Math.round(RAMP_LOW[i] + (RAMP_HIGH[i] - RAMP_LOW[i]) * t)
  );
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Perceptual gamma — keeps the mid tones readable.
function fillFor(value, min, max) {
  if (value == null || isNaN(value) || max === min) return "rgb(236,226,204)";
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return lerpColor(Math.pow(t, 0.6));
}

// 5-point star path, centred at origin, used for training centers.
function starPath(r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

export default function USMap({
  features,
  path,
  projection,
  centroids,
  states,
  athletes,
  trainingCenters,
  colleges,
  familyColors,
  metric,
  selectedState,
  selectedAthlete,
  showDots,
  showCenters,
  showColleges,
  onSelectState,
  onSelectAthlete,
  // Plate-specific overlays
  activePlate,
  factories,
  hoveredFactory,
  onHoverFactory,
}) {
  const [tooltip, setTooltip] = useState(null);

  // Compute metric range for the choropleth, excluding zero states so the
  // scale isn't flattened by empty values.
  const [metricMin, metricMax] = useMemo(() => {
    const vs = Object.values(states)
      .map((s) => extractMetric(s, metric))
      .filter((v) => v != null && !isNaN(v) && v > 0);
    if (!vs.length) return [0, 1];
    return [Math.min(...vs), Math.max(...vs)];
  }, [states, metric]);

  // Pre-project athlete coordinates once per filter change.
  const athleteDots = useMemo(() => {
    if (!showDots || !projection) return [];
    const out = [];
    for (const a of athletes) {
      const p = projection([a.lng, a.lat]);
      if (!p) continue;
      out.push({ ...a, x: p[0], y: p[1] });
    }
    return out;
  }, [athletes, projection, showDots]);

  // Pre-project training centers.
  const centerDots = useMemo(() => {
    if (!showCenters || !projection) return [];
    return trainingCenters
      .map((c) => {
        if (c.lat == null || c.lng == null) return null;
        const p = projection([c.lng, c.lat]);
        if (!p) return null;
        return { ...c, x: p[0], y: p[1] };
      })
      .filter(Boolean);
  }, [trainingCenters, projection, showCenters]);

  // College circles sit at state centroids (one bubble per top-state).
  const collegeBubbles = useMemo(() => {
    if (!showColleges || !projection) return [];
    const byState = new Map();
    for (const col of colleges) {
      const matched = col.matched_profiles ?? col.olympians ?? 0;
      if (matched <= 0) continue;
      const st = col.state;
      if (!st || !centroids[st]) continue;
      const cur = byState.get(st) || { state: st, total: 0, top: col };
      cur.total += matched;
      const topMatched = cur.top.matched_profiles ?? cur.top.olympians ?? 0;
      if (matched > topMatched) cur.top = col;
      byState.set(st, cur);
    }
    return Array.from(byState.values())
      .map((b) => {
        const p = projection(centroids[b.state]);
        if (!p) return null;
        return { ...b, x: p[0], y: p[1] };
      })
      .filter(Boolean);
  }, [colleges, projection, centroids, showColleges]);

  // Pre-project factory city pins (for Plate II).
  const factoryPins = useMemo(() => {
    if (!projection || !factories || activePlate !== "factories") return [];
    return factories.slice(0, 25).map((f, i) => {
      const p = projection([f.lng, f.lat]);
      if (!p) return null;
      return { ...f, rank: i + 1, x: p[0], y: p[1] };
    }).filter(Boolean);
  }, [factories, projection, activePlate]);

  // Pre-project training center halos (for Plate IV).
  const haloCenters = useMemo(() => {
    if (!projection || activePlate !== "halos") return [];
    return trainingCenters
      .map((c) => {
        if (c.lat == null || c.lng == null) return null;
        const p = projection([c.lng, c.lat]);
        if (!p) return null;
        // Approximate miles → SVG pixels at projection scale 1280.
        // Albers USA conus ≈ 2500 mi wide ≈ 770 svg units here → ~0.31 svg/mi.
        const px = 0.31;
        return {
          ...c,
          x: p[0],
          y: p[1],
          rings: [25, 50, 100, 200].map((mi) => mi * px),
        };
      })
      .filter(Boolean);
  }, [trainingCenters, projection, activePlate]);

  const handleMove = useCallback((e) => {
    if (tooltip) setTooltip((t) => ({ ...t, cx: e.clientX, cy: e.clientY }));
  }, [tooltip]);

  if (!features || !projection || !path) {
    return (
      <div className="map-wrap">
        <div className="map-cap">
          <span className="title">Loading atlas…</span>
        </div>
        <div className="map-figure" />
      </div>
    );
  }

  return (
    <div className="map-wrap" onMouseMove={handleMove} onMouseLeave={() => setTooltip(null)}>
      <div className="map-cap">
        <span className="title">{plateCaption(activePlate)}</span>
        <span className="subt">Albers equal-area · {plateSubcaption(activePlate)}</span>
      </div>

      <div className="map-figure">
        <svg className="map-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <pattern id="graticule" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0 L0 0 0 40" fill="none" stroke="rgba(26,20,16,0.045)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#graticule)" />

          {/* State fills + borders */}
          <g>
            {features.map((feat) => {
              const name = feat.properties.name;
              const abbr = NAME_TO_ABBR[name];
              const st = states[abbr];
              const value = extractMetric(st, metric);
              const fill = fillFor(value, metricMin, metricMax);
              const isSelected = selectedState === abbr;
              return (
                <path
                  key={feat.id || name}
                  className={`state-path ${isSelected ? "selected" : ""}`}
                  d={path(feat)}
                  fill={fill}
                  onClick={() => onSelectState(abbr)}
                  onMouseEnter={() =>
                    setTooltip({
                      kind: "state",
                      name,
                      abbr,
                      data: st,
                      metric,
                      value,
                      cx: 0,
                      cy: 0,
                    })
                  }
                />
              );
            })}
          </g>

          {/* Athlete dots */}
          {showDots && (
            <g>
              {athleteDots.map((a) => {
                const r = 1.5 + Math.min(4, Math.sqrt(a.total_medals || 0));
                const color = familyColors[a.family] || "#555";
                const isSelected = selectedAthlete === a.id;
                return (
                  <circle
                    key={a.id}
                    className={`dot ${a.total_medals > 0 ? "medal" : ""}`}
                    cx={a.x}
                    cy={a.y}
                    r={isSelected ? r + 2 : r}
                    fill={color}
                    opacity={isSelected ? 1 : 0.78}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAthlete(a.id);
                    }}
                    onMouseEnter={() =>
                      setTooltip({ kind: "athlete", data: a, cx: 0, cy: 0 })
                    }
                  />
                );
              })}
            </g>
          )}

          {/* College bubbles (under center markers) */}
          {showColleges && (
            <g>
              {collegeBubbles.map((b) => {
                const r = 4 + Math.sqrt(b.total) * 2.3;
                return (
                  <g key={b.state}>
                    <circle
                      className="college-circle"
                      cx={b.x}
                      cy={b.y}
                      r={r}
                      onMouseEnter={() =>
                        setTooltip({ kind: "college", data: b, cx: 0, cy: 0 })
                      }
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Training centers on top */}
          {showCenters && (
            <g>
              {centerDots.map((c) => {
                const isOptc = c.type === "OPTC";
                return (
                  <g
                    key={c.name}
                    className={`tc-mark ${c.paralympic ? "para" : ""} ${isOptc ? "optc" : ""}`}
                    transform={`translate(${c.x} ${c.y})`}
                    onMouseEnter={() =>
                      setTooltip({ kind: "center", data: c, cx: 0, cy: 0 })
                    }
                  >
                    {isOptc && (
                      <circle r="11" fill="none" stroke="#c89837" strokeWidth="0.9" opacity="0.75" />
                    )}
                    <path d={starPath(isOptc ? 8.5 : 6.2)} />
                  </g>
                );
              })}
            </g>
          )}

          {/* Plate IV — halo rings around training centers */}
          {activePlate === "halos" && (
            <g className="halos-layer">
              {haloCenters.map((c) =>
                c.rings.map((r, i) => (
                  <circle
                    key={`${c.name}-${i}`}
                    cx={c.x}
                    cy={c.y}
                    r={r}
                    fill="none"
                    stroke="#c89837"
                    strokeWidth={2.2 - i * 0.35}
                    strokeDasharray={i === 0 ? "" : i === 1 ? "4 3" : "2 4"}
                    opacity={0.95 - i * 0.18}
                  />
                ))
              )}
              {/* center dots painted on top so they're visible above the rings */}
              {haloCenters.map((c) => (
                <circle
                  key={`hub-${c.name}`}
                  cx={c.x}
                  cy={c.y}
                  r={3}
                  fill="#c89837"
                  stroke="#1a1410"
                  strokeWidth={0.8}
                />
              ))}
            </g>
          )}

          {/* Plate II — factory city pins (gold rank markers) */}
          {activePlate === "factories" && (
            <g className="factory-layer">
              {factoryPins.map((f) => {
                const isTopTen = f.rank <= 10;
                const isHover = hoveredFactory === `${f.city}|${f.state}`;
                const r = isTopTen ? (isHover ? 12 : 10) : (isHover ? 7 : 5);
                return (
                  <g
                    key={`fpin-${f.city}-${f.state}`}
                    transform={`translate(${f.x} ${f.y})`}
                    className={`factory-pin ${isHover ? "hover" : ""}`}
                    onMouseEnter={() => {
                      onHoverFactory && onHoverFactory(`${f.city}|${f.state}`);
                      setTooltip({ kind: "factory", data: f, cx: 0, cy: 0 });
                    }}
                    onMouseLeave={() => {
                      onHoverFactory && onHoverFactory(null);
                    }}
                  >
                    <circle r={r} fill="rgba(244, 237, 225, 0.92)" stroke="#c89837" strokeWidth={isTopTen ? 1.6 : 1.2} />
                    {isTopTen && (
                      <text
                        textAnchor="middle"
                        dy="0.36em"
                        fontFamily="JetBrains Mono"
                        fontSize="9"
                        fontWeight="700"
                        fill="#1a1410"
                      >
                        {f.rank}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Compass rose (top-right corner decoration) */}
          <g transform={`translate(${WIDTH - 52} 48)`} opacity="0.7">
            <circle r="18" fill="none" stroke="#1a1410" strokeWidth="0.5" />
            <path d="M0,-18 L3,0 L0,18 L-3,0 Z" fill="#c63d2f" stroke="#1a1410" strokeWidth="0.4" />
            <path d="M-18,0 L0,3 L18,0 L0,-3 Z" fill="#e8dfd0" stroke="#1a1410" strokeWidth="0.4" />
            <text y="-22" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono" fill="#1a1410" letterSpacing="1">N</text>
          </g>
        </svg>

        {tooltip && <Tooltip t={tooltip} familyColors={familyColors} />}
      </div>

      <div className="map-footer">
        <span>{athleteDots.length.toLocaleString()} hometowns plotted</span>
        <div className="scale">
          <span>0</span>
          <div>
            <div className="scale-bar" />
            <div className="scale-ticks">
              <span>low</span>
              <span>—</span>
              <span>high</span>
            </div>
          </div>
          <span>{metricLabel(metric)}</span>
        </div>
      </div>
    </div>
  );
}

function Tooltip({ t, familyColors }) {
  if (!t) return null;
  // Avoid the tooltip clipping off the right edge.
  const x = Math.min((typeof window !== "undefined" ? window.innerWidth : 1200) - 260, t.cx + 14);
  const y = t.cy + 14;
  const style = { left: x, top: y };

  if (t.kind === "state") {
    // Skip the choropleth metric line when it's already shown above
    // (olympians/medals are always shown by default).
    const metricRedundant = t.metric === "olympians" || t.metric === "medals";
    return (
      <div className="tooltip" style={style}>
        <div className="t-name">{t.name}</div>
        <div className="t-line">
          <b>{(t.data?.olympians ?? 0).toLocaleString()}</b> olympians
        </div>
        <div className="t-line">
          <b>{(t.data?.medals ?? 0).toLocaleString()}</b> medals won
        </div>
        {!metricRedundant && (
          <div className="t-line">
            {metricLabel(t.metric)}: <b>{fmtMetric(t.value, t.metric)}</b>
          </div>
        )}
      </div>
    );
  }
  if (t.kind === "athlete") {
    const a = t.data;
    return (
      <div className="tooltip" style={style}>
        <div className="t-name" style={{ color: familyColors[a.family] || "#1a1410" }}>
          {a.sport}
        </div>
        <div className="t-line">
          {a.city}
          {a.state ? `, ${a.state}` : ""}
        </div>
        {a.total_medals > 0 && (
          <div className="t-line">
            <b>{a.total_medals}</b> medal{a.total_medals === 1 ? "" : "s"} · {a.gold}G {a.silver}S {a.bronze}B
          </div>
        )}
      </div>
    );
  }
  if (t.kind === "center") {
    const c = t.data;
    return (
      <div className="tooltip" style={style}>
        <div className="t-name">{c.name}</div>
        <div className="t-line">{c.type}</div>
        <div className="t-line">{c.city}, {c.state}</div>
        {c.year_opened && <div className="t-line">opened {c.year_opened}</div>}
      </div>
    );
  }
  if (t.kind === "factory") {
    const f = t.data;
    return (
      <div className="tooltip" style={style}>
        <div className="t-name">#{f.rank} · {f.city}, {f.state}</div>
        <div className="t-line">
          <b>{f.athletes}</b> Team USA profiles from <b>{f.population.toLocaleString()}</b> residents
        </div>
        <div className="t-line">
          <b>{f.rate.toFixed(1)}</b> per 10,000 — top sport: {f.top_sport}
        </div>
      </div>
    );
  }
  if (t.kind === "college") {
    const b = t.data;
    return (
      <div className="tooltip" style={style}>
        <div className="t-name">{b.state} — {b.total} matched profiles</div>
        <div className="t-line">top program: <b>{b.top.name}</b></div>
      </div>
    );
  }
  return null;
}

function extractMetric(st, metric) {
  if (!st) return null;
  switch (metric) {
    case "olympians": return st.olympians;
    case "medals":    return st.medals;
    case "income":    return st.median_income;
    case "nfhs":      return st.nfhs_total;
    case "temp":      return st.climate?.temp_f;
    case "snow":      return st.climate?.snow_in;
    default:          return st.olympians;
  }
}

export function metricLabel(m) {
  return {
    olympians: "Team USA profiles",
    medals: "total medals",
    income: "median household income",
    nfhs: "HS participation slots",
    temp: "avg annual temp °F",
    snow: "avg annual snow in.",
  }[m] || m;
}

function plateCaption(p) {
  switch (p) {
    case "factories":     return "Plate II — Small-town factories";
    case "concentration": return "Plate III — Where each sport lives";
    case "halos":         return "Plate IV — Reach of the training centers";
    case "distance":      return "Plate V — Distance to nearest sport-serving facility";
    case "climate":       return "Plate VI — Climate × sport family";
    case "paralympic":    return "Plate VII — Paralympic geography";
    case "colleges":      return "Plate VIII — Team USA profiles per athletic dollar";
    case "per_capita":    return "Plate IX — Team USA profiles per 100k residents";
    case "hs_conversion": return "Plate X — NFHS slot density";
    case "era":           return "Plate XI — How the map moved";
    default:              return "Plate I — Hometowns of Team USA, 1896–2026";
  }
}
function plateSubcaption(p) {
  switch (p) {
    case "factories": return "ranked gold pins mark towns ≥ 500 pop, ≥ 2 athletes";
    case "halos":     return "concentric rings: 25, 50, 100, 200 mi from each center";
    default:          return "coordinates from U.S. Census Gazetteer";
  }
}

function fmtMetric(v, m) {
  if (v == null) return "—";
  if (m === "income") return `$${v.toLocaleString()}`;
  if (m === "temp") return `${v.toFixed(1)}°F`;
  if (m === "snow") return `${v.toFixed(1)}″`;
  return v.toLocaleString();
}

// US state name → 2-letter abbr lookup (matches us-atlas properties.name).
export const NAME_TO_ABBR = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI",
  "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
  "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
  "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
  "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
  "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
  "Wisconsin": "WI", "Wyoming": "WY",
  "Puerto Rico": "PR",
};
