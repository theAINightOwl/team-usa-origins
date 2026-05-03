import React from "react";

/*
 * StatePanel — renders when a US state is selected on the map.
 * Shows counts, climate, NFHS context, top sports, and top feeder colleges
 * for that state.
 */
export default function StatePanel({ state, colleges, onClose, profileType, lensStateCounts }) {
  if (!state) return null;

  const lens = (lensStateCounts && lensStateCounts[state.abbr]) || { count: 0, medals: 0 };
  const lensWord = profileType === "paralympic" ? "Paralympians" : "Olympians";

  const stateColleges = colleges
    .filter((c) => c.state === state.abbr && (c.matched_profiles ?? c.olympians ?? 0) > 0)
    .slice(0, 5);

  const topMax = Math.max(1, ...(state.top_sports || []).map((s) => s.n));

  return (
    <div className="detail">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="eyebrow">Selection · State</p>
          <h3>
            {state.name}
          </h3>
          <p className="loc">
            {state.climate?.zone || "—"} · {state.abbr}
          </p>
        </div>
        <button className="close-btn" onClick={onClose}>close</button>
      </div>

      <div className="stats">
        <div className="cell">
          <div className="label">{lensWord}</div>
          <div className="value rust num">{lens.count.toLocaleString()}</div>
        </div>
        <div className="cell">
          <div className="label">Medals</div>
          <div className="value gold num">{lens.medals.toLocaleString()}</div>
        </div>
        <div className="cell">
          <div className="label">All profiles</div>
          <div className="value num">{(state.profiles ?? state.olympians ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {state.top_sports && state.top_sports.length > 0 && (
        <section>
          <p className="eyebrow">Top sports</p>
          <div className="bar-list">
            {state.top_sports.map((s) => (
              <div className="bar-row" key={s.sport}>
                <span className="sport">{s.sport}</span>
                <div className="bar-bg">
                  <div className="bar-fg" style={{ width: `${(s.n / topMax) * 100}%` }} />
                </div>
                <span className="n num">{s.n}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="eyebrow" style={{ marginTop: 18 }}>Context</p>
        <div className="row">
          <span className="k">Avg temp</span>
          <span className="v num">
            {state.climate?.temp_f != null ? `${state.climate.temp_f.toFixed(1)}°F` : "—"}
          </span>
        </div>
        <div className="row">
          <span className="k">Avg snow</span>
          <span className="v num">
            {state.climate?.snow_in != null ? `${state.climate.snow_in.toFixed(1)}″` : "—"}
          </span>
        </div>
        <div className="row">
          <span className="k">Median income</span>
          <span className="v num">
            {state.median_income != null ? `$${state.median_income.toLocaleString()}` : "—"}
          </span>
        </div>
        <div className="row">
          <span className="k">HS slots ({state.nfhs_year || 2025})</span>
          <span className="v num">
            {(state.nfhs_total || 0).toLocaleString()}
          </span>
        </div>
        <div className="row">
          <span className="k">Training centers</span>
          <span className="v num">{state.training_centers || 0}</span>
        </div>
      </section>

      {state.nfhs_history && state.nfhs_history.length > 1 && (
        <section>
          <p className="eyebrow" style={{ marginTop: 18 }}>
            HS Participation · {state.nfhs_history[0].year}–{state.nfhs_history[state.nfhs_history.length - 1].year}
          </p>
          <div className="nfhs-spark">
            <Sparkline series={state.nfhs_history} />
          </div>
        </section>
      )}

      {stateColleges.length > 0 && (
        <section>
          <p className="eyebrow" style={{ marginTop: 18 }}>Top feeder colleges</p>
          {stateColleges.map((c) => (
            <div className="row" key={c.name}>
              <span className="k" style={{ maxWidth: 220, textTransform: "none", letterSpacing: 0, fontSize: 11, fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-2)" }}>
                {c.name}
              </span>
              <span className="v num" style={{ color: "var(--rust)" }}>
                {c.matched_profiles ?? c.olympians}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Sparkline({ series }) {
  if (!series || series.length < 2) return null;
  const W = 300;
  const H = 50;
  const pad = 4;
  const xs = series.map((p) => p.year);
  const ys = series.map((p) => p.n);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys, 1);
  const minY = 0;

  const toX = (x) => pad + ((x - minX) / (maxX - minX || 1)) * (W - 2 * pad);
  const toY = (y) => H - pad - ((y - minY) / (maxY - minY || 1)) * (H - 2 * pad);

  const linePath = series.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.year).toFixed(1)},${toY(p.n).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${toX(xs[xs.length - 1]).toFixed(1)},${H - pad} L${toX(xs[0]).toFixed(1)},${H - pad} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <path className="area" d={areaPath} />
      <path className="line" d={linePath} />
      <text className="axis" x={pad} y={H - 1}>{minX}</text>
      <text className="axis" x={W - pad} y={H - 1} textAnchor="end">{maxX}</text>
      <text className="axis" x={W - pad} y={10} textAnchor="end">{maxY.toLocaleString()}</text>
    </svg>
  );
}
