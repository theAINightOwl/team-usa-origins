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
 *   • per-plate overlays driven by `activePlate`
 *
 * Hover surfaces a minimal tooltip; click fires onSelectState / onSelectAthlete.
 */

const WIDTH = 975;
const HEIGHT = 610;

// Approx miles → SVG units at projection scale 1280 (Albers USA conus
// ≈ 2500 mi wide ≈ 770 svg units → ~0.31 svg/mi).
const SVG_PER_MI = 0.31;

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

// Haversine distance in miles between two [lng, lat] points.
function haversineMi(a, b) {
  if (!a || !b) return Infinity;
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Categorical climate-zone palette — desaturated atlas tones.
const CLIMATE_COLORS = {
  "Cold":              "#7d96b3",
  "Continental":       "#9bb09a",
  "Mild":              "#d6c277",
  "Humid Subtropical": "#c89370",
  "Arid":              "#c8a06c",
  "Tropical":          "#a36a4f",
};
function climateFill(zone) {
  return CLIMATE_COLORS[zone] || "rgb(236,226,204)";
}

// Distance-from-center bucket palette (Plate V).
const DISTANCE_BUCKETS = [
  { key: "near", maxMi: 200,    color: "#5a7a3f", label: "≤200 mi" },
  { key: "mid",  maxMi: 800,    color: "#c89837", label: "200–800 mi" },
  { key: "far",  maxMi: Infinity, color: "#722f37", label: "800+ mi" },
];

// Elevation tier palette (Plate XI). Tied to state-mean elevation since
// athletes.json doesn't carry per-hometown elevation today.
const ELEVATION_TIERS = [
  { max: 500,    color: "#c8d3b3", label: "≤500 ft" },
  { max: 1500,   color: "#a8c4a3", label: "500–1.5k" },
  { max: 3000,   color: "#7e9c8d", label: "1.5–3k" },
  { max: 5000,   color: "#5a7c7c", label: "3k–5k" },
  { max: Infinity, color: "#3a5e7a", label: "5k+" },
];
function tierForElevation(ft) {
  if (ft == null || isNaN(ft)) return null;
  return ELEVATION_TIERS.find((t) => ft <= t.max);
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
  // Cross-plate hover sync (concentration / per_capita / hs / era / colleges / altitude / distance / climate / halos)
  hover = {},
  // Per-plate analytics slices (passed by App / AppV2)
  concentrationData,
  perCapitaData,
  hsConversionData,
  homeStatesData,
  altitudeData,
  // YOU plate user marker
  userHome,
  // Lens (Olympic/Paralympic) — used for the choropleth + tooltip
  profileType,
  lensStateCounts,
  stats,
}) {
  const [tooltip, setTooltip] = useState(null);

  // Build a fast index of analytics data keyed by state — used by extractMetric
  // for the new per_capita / hs_per_million metrics so the existing
  // choropleth machinery can color states without bespoke render code.
  const perCapitaByState = useMemo(() => {
    const m = {};
    for (const r of perCapitaData || []) m[r.state] = r;
    return m;
  }, [perCapitaData]);
  const hsByState = useMemo(() => {
    const m = {};
    for (const r of hsConversionData || []) m[r.state] = r;
    return m;
  }, [hsConversionData]);
  const [metricMin, metricMax] = useMemo(() => {
    const vs = Object.keys(states)
      .map((abbr) => extractMetric(states[abbr], metric, lensStateCounts, {
        perCapitaByState, hsByState, abbr,
      }))
      .filter((v) => v != null && !isNaN(v) && v > 0);
    if (!vs.length) return [0, 1];
    return [Math.min(...vs), Math.max(...vs)];
  }, [states, metric, lensStateCounts, perCapitaByState, hsByState]);

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

  // For Plate V — for each athlete, distance to nearest training center that
  // serves their sport. Indexed by athlete id.
  const distanceByAthlete = useMemo(() => {
    if (activePlate !== "distance") return null;
    const sportToCenters = new Map();
    for (const c of trainingCenters) {
      if (c.lat == null || c.lng == null) continue;
      const sports = (c.sports_served || "").split(";").map((s) => s.trim()).filter(Boolean);
      for (const sp of sports) {
        if (!sportToCenters.has(sp)) sportToCenters.set(sp, []);
        sportToCenters.get(sp).push(c);
      }
    }
    const out = {};
    for (const a of athletes) {
      const ctrs = sportToCenters.get(a.sport) || [];
      if (!ctrs.length) { out[a.id] = null; continue; }
      let best = Infinity;
      for (const c of ctrs) {
        const d = haversineMi([a.lng, a.lat], [c.lng, c.lat]);
        if (d < best) best = d;
      }
      out[a.id] = best;
    }
    return out;
  }, [activePlate, athletes, trainingCenters]);

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

  // Plate XI — top-3 source states per family. For each (family, rank), look
  // up the state centroid from the projected `centroids` map, offset by a
  // fixed angle keyed off the family's alphabetical index so multiple
  // families on the same state (CA, NY, FL) don't fully stack.
  const homeStatePins = useMemo(() => {
    if (!projection || !homeStatesData?.length || activePlate !== "home_states") return [];
    const familyNames = homeStatesData.map((f) => f.family).sort();
    const offsetFor = (fam) => {
      const i = familyNames.indexOf(fam);
      const n = Math.max(familyNames.length, 1);
      const angle = (i / n) * Math.PI * 2;
      return [Math.cos(angle) * 8, Math.sin(angle) * 8];
    };
    const out = [];
    for (const fam of homeStatesData) {
      const states = fam.top_states || [];
      const [dx, dy] = offsetFor(fam.family);
      for (let rank = 0; rank < states.length; rank++) {
        const s = states[rank];
        const c = centroids[s.state];
        if (!c) continue;
        const proj = projection(c);
        if (!proj) continue;
        out.push({
          family: fam.family,
          state: s.state,
          rank: rank + 1,
          pct: s.pct,
          n: s.n,
          x: proj[0] + dx,
          y: proj[1] + dy,
          radius: rank === 0 ? 9 : rank === 1 ? 7 : 5,
        });
      }
    }
    return out;
  }, [homeStatesData, projection, activePlate, centroids]);

  // Pre-project training center halos (for Plate IV).
  const haloCenters = useMemo(() => {
    if (!projection || activePlate !== "halos") return [];
    return trainingCenters
      .map((c) => {
        if (c.lat == null || c.lng == null) return null;
        const p = projection([c.lng, c.lat]);
        if (!p) return null;
        return {
          ...c,
          x: p[0],
          y: p[1],
          rings: [25, 50, 100, 200].map((mi) => mi * SVG_PER_MI),
        };
      })
      .filter(Boolean);
  }, [trainingCenters, projection, activePlate]);

  // Plate III — Concentration: focus on the active sport (hovered or top
  // by HHI) and surface its top-3 states with rank numerals.
  const concentrationFocus = useMemo(() => {
    if (activePlate !== "concentration" || !concentrationData?.length) return null;
    const sport = hover.sport
      ? concentrationData.find((r) => r.sport === hover.sport)
      : concentrationData[0];
    if (!sport) return null;
    return {
      sport,
      states: (sport.top_states || []).slice(0, 3).map((s, i) => {
        const c = centroids[s.state];
        if (!c) return null;
        const p = projection(c);
        if (!p) return null;
        return { abbr: s.state, share: s.share, rank: i + 1, x: p[0], y: p[1] };
      }).filter(Boolean),
    };
  }, [activePlate, concentrationData, centroids, projection, hover.sport]);

  // Plate VII / IX — top-5 ranked state centroids for label numerals.
  const rankCentroids = useMemo(() => {
    if (!projection) return [];
    let rows = null;
    if (activePlate === "per_capita") rows = perCapitaData;
    else if (activePlate === "hs_conversion") rows = hsConversionData;
    if (!rows) return [];
    const sortKey = activePlate === "per_capita" ? "per_100k" : "per_million_hs";
    return [...rows]
      .filter((r) => r[sortKey] > 0)
      .sort((a, b) => b[sortKey] - a[sortKey])
      .slice(0, 5)
      .map((r, i) => {
        const c = centroids[r.state];
        if (!c) return null;
        const p = projection(c);
        if (!p) return null;
        return { abbr: r.state, rank: i + 1, value: r[sortKey], x: p[0], y: p[1] };
      })
      .filter(Boolean);
  }, [activePlate, perCapitaData, hsConversionData, centroids, projection]);

  // Plate XI — high-altitude town pins.
  const altitudePins = useMemo(() => {
    if (activePlate !== "altitude" || !projection || !altitudeData?.top_high_towns) return [];
    return altitudeData.top_high_towns
      .map((t) => {
        // Look up coordinates from athletes.json by city+state match.
        const match = athletes.find((a) => a.city === t.city && a.state === t.state);
        const lng = match?.lng;
        const lat = match?.lat;
        if (lng == null || lat == null) return null;
        const p = projection([lng, lat]);
        if (!p) return null;
        return { ...t, x: p[0], y: p[1] };
      })
      .filter(Boolean);
  }, [activePlate, altitudeData, athletes, projection]);

  // Plate XII — user's submitted hometown marker.
  const userPin = useMemo(() => {
    if (activePlate !== "you" || !projection || !userHome) return null;
    let pt = null;
    if (Number.isFinite(userHome.lng) && Number.isFinite(userHome.lat)) {
      pt = projection([userHome.lng, userHome.lat]);
    } else if (userHome.state && centroids[userHome.state]) {
      pt = projection(centroids[userHome.state]);
    }
    if (!pt) return null;
    return {
      x: pt[0],
      y: pt[1],
      label: userHome.label || `${userHome.city || ""}${userHome.state ? `, ${userHome.state}` : ""}`.trim(),
      ring: 200 * SVG_PER_MI,
    };
  }, [activePlate, projection, userHome, centroids]);

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

  // Decide a state's fill: most plates use the metric choropleth, but the
  // climate plate paints a categorical climate-zone palette and the
  // concentration plate dims non-top-3 states.
  function fillForState(abbr, st, value) {
    if (activePlate === "climate") {
      return climateFill(st?.climate?.zone);
    }
    if (metric === "none") return "rgb(236,226,204)";
    return fillFor(value, metricMin, metricMax);
  }

  // Concentration plate dims dots that aren't in the focused sport.
  function dotIsDim(a) {
    if (activePlate === "concentration" && concentrationFocus?.sport) {
      return a.sport !== concentrationFocus.sport.sport;
    }
    if ((activePlate === "distance" || activePlate === "climate" || activePlate === "altitude")
        && hover.family) {
      return a.family !== hover.family;
    }
    return false;
  }

  // Athlete dot color override per plate (distance buckets, altitude tiers).
  function dotColor(a) {
    if (activePlate === "distance" && distanceByAthlete) {
      const d = distanceByAthlete[a.id];
      if (d == null || d === Infinity) return "rgb(180,170,150)";
      const bucket = DISTANCE_BUCKETS.find((b) => d <= b.maxMi);
      return bucket ? bucket.color : "#555";
    }
    if (activePlate === "altitude") {
      const ft = states[a.state]?.elevation?.mean_ft;
      const tier = tierForElevation(ft);
      return tier ? tier.color : "rgb(180,170,150)";
    }
    return familyColors[a.family] || "#555";
  }

  // Plate-specific legend rendered as a thin horizontal strip BELOW the
  // map (lives on the same level as .map-scale) so it never sits on top of
  // the geography it explains.
  function renderLegend() {
    let title = null;
    let items = null;
    if (activePlate === "distance") {
      title = "Miles to nearest sport-serving center";
      items = DISTANCE_BUCKETS.map((b) => ({ key: b.key, color: b.color, label: b.label }));
    } else if (activePlate === "climate") {
      title = "State climate zone";
      items = Object.entries(CLIMATE_COLORS).map(([z, color]) => ({ key: z, color, label: z }));
    } else if (activePlate === "altitude") {
      title = "State-mean hometown elevation";
      items = ELEVATION_TIERS.map((t) => ({ key: t.label, color: t.color, label: t.label }));
    }
    if (!items) return null;
    return (
      <div className="map-legend">
        <span className="leg-title">{title}</span>
        {items.map((it) => (
          <span className="leg-row" key={it.key}>
            <span className="leg-swatch" style={{ background: it.color }} />
            <span className="leg-label">{it.label}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="map-wrap" onMouseMove={handleMove} onMouseLeave={() => setTooltip(null)}>
      <div className="map-cap">
        <span className="title">{plateCaption(activePlate)}</span>
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
              const value = extractMetric(st, metric, lensStateCounts, {
                perCapitaByState, hsByState, abbr,
              });
              const lens = lensStateCounts && lensStateCounts[abbr];
              const fill = fillForState(abbr, st, value);
              const isSelected = selectedState === abbr;
              // State-level dimming for plate hover sync.
              const dim = (() => {
                if (activePlate === "concentration" && concentrationFocus) {
                  const inTop = concentrationFocus.states.some((s) => s.abbr === abbr);
                  return !inTop;
                }
                if ((activePlate === "per_capita" || activePlate === "hs_conversion" || activePlate === "era" || activePlate === "colleges")
                    && hover.state) {
                  return hover.state !== abbr;
                }
                return false;
              })();
              return (
                <path
                  key={feat.id || name}
                  className={`state-path ${isSelected ? "selected" : ""} ${dim ? "dim" : ""}`}
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
                      lensCount: lens?.count ?? 0,
                      lensMedals: lens?.medals ?? 0,
                      profileType,
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
                const color = dotColor(a);
                const isSelected = selectedAthlete === a.id;
                const dim = dotIsDim(a);
                return (
                  <circle
                    key={a.id}
                    className={`dot ${a.total_medals > 0 ? "medal" : ""} ${dim ? "dim" : ""}`}
                    cx={a.x}
                    cy={a.y}
                    r={isSelected ? r + 2 : r}
                    fill={color}
                    opacity={isSelected ? 1 : (dim ? 0.18 : 0.78)}
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
                const isHover = hover.state === b.state;
                return (
                  <g key={b.state}>
                    <circle
                      className={`college-circle ${isHover ? "hover" : ""}`}
                      cx={b.x}
                      cy={b.y}
                      r={isHover ? r + 3 : r}
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
              {haloCenters.map((c) => {
                const isHover = hover.center && hover.center === c.name;
                return c.rings.map((r, i) => (
                  <circle
                    key={`${c.name}-${i}`}
                    cx={c.x}
                    cy={c.y}
                    r={r}
                    fill="none"
                    stroke="#c89837"
                    strokeWidth={(isHover ? 3.4 : 2.2) - i * 0.35}
                    strokeDasharray={i === 0 ? "" : i === 1 ? "4 3" : "2 4"}
                    opacity={isHover ? 1 : (0.95 - i * 0.18)}
                  />
                ));
              })}
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

          {/* Plate XI — top-3 source states per family: 36 dots colored by family, sized by rank (1 > 2 > 3). Hover focuses one family. */}
          {activePlate === "home_states" && (
            <g className="home-states-layer">
              {homeStatePins.map((p) => {
                const fill = familyColors[p.family] || "#555";
                const focused = hover?.family === p.family;
                const dimmed = hover?.family && hover.family !== p.family;
                const opacity = focused ? 1 : dimmed ? 0.15 : 0.75;
                return (
                  <g
                    key={`hs-${p.family}-${p.state}-${p.rank}`}
                    transform={`translate(${p.x} ${p.y})`}
                    className={`home-state-pin rank-${p.rank} ${focused ? "hover" : ""}`}
                    opacity={opacity}
                    onMouseEnter={() => {
                      setTooltip({
                        kind: "home_state",
                        family: p.family,
                        state: p.state,
                        rank: p.rank,
                        n: p.n,
                        pct: p.pct,
                        cx: 0, cy: 0,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <circle
                      r={focused ? p.radius + 2 : p.radius}
                      fill={fill}
                      stroke="#1a1410"
                      strokeWidth={0.8}
                    />
                  </g>
                );
              })}
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

          {/* Plate III — Concentration: rank circles on the focused sport's
              top-3 states. */}
          {activePlate === "concentration" && concentrationFocus && (
            <g className="concentration-layer">
              {concentrationFocus.states.map((s) => (
                <g key={`conc-${s.abbr}`} transform={`translate(${s.x} ${s.y})`}>
                  <circle r={14} fill="rgba(200, 152, 55, 0.18)" stroke="#c89837" strokeWidth={1.4} />
                  <text
                    textAnchor="middle"
                    dy="0.34em"
                    fontFamily="EB Garamond, Georgia, serif"
                    fontStyle="italic"
                    fontSize="14"
                    fill="#1a1410"
                  >
                    {s.rank}
                  </text>
                </g>
              ))}
              <text
                x={WIDTH / 2}
                y={HEIGHT - 16}
                textAnchor="middle"
                fontFamily="JetBrains Mono"
                fontSize="10"
                fill="#1a1410"
                letterSpacing="1.5"
              >
                {`TOP STATES · ${concentrationFocus.sport.sport.toUpperCase()} (HHI ${concentrationFocus.sport.hhi.toFixed(2)})`}
              </text>
            </g>
          )}

          {/* Plate VII / IX — rank labels on top-5 state centroids. */}
          {(activePlate === "per_capita" || activePlate === "hs_conversion") && (
            <g className="rank-layer">
              {rankCentroids.map((r) => (
                <g key={`rnk-${r.abbr}`} transform={`translate(${r.x} ${r.y})`}>
                  <circle r={12} fill="rgba(244, 237, 225, 0.9)" stroke="#1a1410" strokeWidth={0.9} />
                  <text
                    textAnchor="middle"
                    dy="0.34em"
                    fontFamily="EB Garamond, Georgia, serif"
                    fontStyle="italic"
                    fontSize="13"
                    fill="#1a1410"
                  >
                    {r.rank}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* Plate XI — high-altitude town triangle pins. */}
          {activePlate === "altitude" && (
            <g className="altitude-layer">
              {altitudePins.map((t) => {
                const isHover = hover.town && hover.town.city === t.city && hover.town.state === t.state;
                const size = isHover ? 9 : 6;
                return (
                  <g key={`alt-${t.city}-${t.state}`} transform={`translate(${t.x} ${t.y})`} className={`altitude-pin ${isHover ? "hover" : ""}`}>
                    <path
                      d={`M0,${-size} L${size},${size * 0.85} L${-size},${size * 0.85} Z`}
                      fill={isHover ? "#c63d2f" : "rgba(198, 61, 47, 0.85)"}
                      stroke="#1a1410"
                      strokeWidth={0.7}
                    />
                    {isHover && (
                      <text
                        x={0}
                        y={-size - 4}
                        textAnchor="middle"
                        fontFamily="JetBrains Mono"
                        fontSize="9"
                        fill="#1a1410"
                      >
                        {`${t.city.toUpperCase()} · ${t.ft.toLocaleString()}ft`}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Plate XII — user's hometown marker + 200mi halo. */}
          {activePlate === "you" && userPin && (
            <g className="you-layer">
              <circle
                cx={userPin.x}
                cy={userPin.y}
                r={userPin.ring}
                fill="rgba(198, 61, 47, 0.06)"
                stroke="#c63d2f"
                strokeWidth={1.2}
                strokeDasharray="3 4"
              />
              <g transform={`translate(${userPin.x} ${userPin.y})`}>
                <circle r="6" fill="#c63d2f" stroke="#1a1410" strokeWidth={0.8} />
                <text
                  y={-14}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono"
                  fontSize="10"
                  fill="#1a1410"
                  letterSpacing="0.6"
                >
                  {userPin.label || "YOU"}
                </text>
              </g>
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

      {renderLegend()}

      {metric !== "none" && activePlate !== "climate" && (
        <div className="map-scale">
          <span>{metricLabel(metric)}</span>
          <div className="scale-bar" />
          <div className="scale-ticks">
            <span>low</span>
            <span>—</span>
            <span>high</span>
          </div>
        </div>
      )}

      {stats && stats.length > 0 && (
        <div className="map-stats">
          {stats.map((s) => (
            <div className="cell" key={s.label}>
              <span className="label">{s.label}</span>
              <span className="value num">
                {s.value}
                <span className="unit">{s.unit}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Tooltip({ t, familyColors }) {
  if (!t) return null;
  const x = Math.min((typeof window !== "undefined" ? window.innerWidth : 1200) - 260, t.cx + 14);
  const y = t.cy + 14;
  const style = { left: x, top: y };

  if (t.kind === "state") {
    // Skip the third metric line entirely when no choropleth is set, or when
    // it'd just repeat the olympians/medals counts already printed above.
    const metricRedundant = !t.metric || t.metric === "none" || t.metric === "olympians" || t.metric === "medals";
    const lensWord = t.profileType === "paralympic" ? "Paralympians" : "Olympians";
    return (
      <div className="tooltip" style={style}>
        <div className="t-name">{t.name}</div>
        <div className="t-line">
          <b>{(t.lensCount ?? 0).toLocaleString()}</b> {lensWord}
        </div>
        <div className="t-line">
          <b>{(t.lensMedals ?? 0).toLocaleString()}</b> medals won
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
  if (t.kind === "home_state") {
    return (
      <div className="tooltip" style={style}>
        <div className="t-name" style={{ color: familyColors[t.family] || "#1a1410" }}>{t.family}</div>
        <div className="t-line">#{t.rank} state: <b>{t.state}</b></div>
        <div className="t-line"><b>{t.n.toLocaleString()}</b> athletes ({t.pct}% of family)</div>
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

function extractMetric(st, metric, lensStateCounts, ctx = {}) {
  if (!st) return null;
  const lens = lensStateCounts && lensStateCounts[st.abbr];
  switch (metric) {
    case "olympians":      return lens ? lens.count : 0;
    case "medals":         return lens ? lens.medals : 0;
    case "temp":           return st.climate?.temp_f;
    case "snow":           return st.climate?.snow_in;
    case "elevation":      return st.elevation?.mean_ft;
    case "per_capita":     return ctx.perCapitaByState?.[ctx.abbr]?.per_100k;
    default:               return lens ? lens.count : 0;
  }
}

export function metricLabel(m) {
  return {
    olympians:      "Team USA profiles",
    medals:         "total medals",
    temp:           "avg annual temp °F",
    snow:           "avg annual snow in.",
    elevation:      "mean hometown elevation",
    per_capita:     "Team USA per 100k residents",
  }[m] || m;
}

function plateCaption(p) {
  switch (p) {
    case "factories":     return "Plate II — Tiny towns, big rosters";
    case "concentration": return "Plate III — How concentrated each sport is";
    case "home_states":   return "Plate IV — Sport family × states";
    case "climate":       return "Plate V — Sport family × climate";
    case "altitude":      return "Plate VI — Sport family × altitude";
    case "halos":         return "Plate VII — Reach of the training centers";
    case "distance":      return "Plate VIII — How far Team USA grew up from a training center";
    case "per_capita":    return "Plate IX — Profiles per 100k residents";
    case "you":           return "Plate X — Your geography, your atlas";
    default:              return "Plate I — Hometowns of Team USA, 1896–2026";
  }
}

function fmtMetric(v, m) {
  if (v == null) return "—";
  if (m === "temp") return `${v.toFixed(1)}°F`;
  if (m === "snow") return `${v.toFixed(1)}″`;
  if (m === "elevation") return `${Math.round(v).toLocaleString()} ft`;
  if (m === "per_capita") return `${v.toFixed(2)} / 100k`;
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
