import React from "react";
import trainingCentersData from "../data/training_centers.json";

const TC_COUNT = trainingCentersData.length;

const METRICS = [
  { value: "none",           label: "None (no state shading)" },
  { value: "olympians",      label: "Team USA profiles" },
  { value: "medals",         label: "Total medals won" },
  { value: "income",         label: "Median household income" },
  { value: "nfhs",           label: "HS participation slots" },
  { value: "temp",           label: "Average annual temperature" },
  { value: "snow",           label: "Average annual snowfall" },
  { value: "elevation",      label: "Average hometown elevation" },
  { value: "per_capita",     label: "Profiles per 100k residents" },
  { value: "hs_per_million", label: "Profiles per 1M NFHS slots" },
];

const METRIC_LABELS = Object.fromEntries(METRICS.map((m) => [m.value, m.label]));

export default function Filters({
  metric, setMetric,
  families, selectedFamilies, toggleFamily,
  familyColors, familyCounts,
  medalOnly, setMedalOnly,
  eraRange, setEraRange,
  overlays, setOverlay,
  compact = false,
  setSelectedFamilies,
  metricLocked = false,
}) {
  const allOn = selectedFamilies.size === families.length;
  const noneOn = selectedFamilies.size === 0;
  const familyChips = (
    <div className="chips">
      {families.map((f) => {
        const on = selectedFamilies.has(f);
        return (
          <button
            key={f}
            className={`chip ${on ? "on" : ""}`}
            onClick={() => toggleFamily(f)}
            title={`${familyCounts[f] || 0} athletes`}
          >
            <span
              className="swatch"
              style={{ background: familyColors[f] || "#555" }}
            />
            <span className="chip-label">
              <span className="chip-name">{f}</span>
              <span className="chip-count">{(familyCounts[f] || 0).toLocaleString()}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className={`panel ${compact ? "compact" : ""}`}>
      <section>
        {!compact && (
          <h2>
            Filters <span className="index">i.</span>
          </h2>
        )}

        <div className="group" style={{ marginBottom: 16 }}>
          {compact ? (
            <details
              className={`family-picker metric-picker ${metricLocked ? "locked" : ""}`}
              onToggle={(e) => { if (metricLocked) e.currentTarget.removeAttribute("open"); }}
            >
              <summary>
                <span className="ghead">Choropleth overlays</span>
                <span className="family-summary">{METRIC_LABELS[metric] || metric}</span>
                <span className="caret">{metricLocked ? "·" : "▾"}</span>
              </summary>
              {!metricLocked && (
                <div className="family-picker-body">
                  <ul className="metric-options">
                    {METRICS.map((m) => (
                      <li key={m.value}>
                        <button
                          type="button"
                          className={`metric-option ${metric === m.value ? "on" : ""}`}
                          onClick={(e) => {
                            setMetric(m.value);
                            e.currentTarget.closest("details")?.removeAttribute("open");
                          }}
                        >
                          {m.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </details>
          ) : (
            <>
              <span className="ghead">Choropleth overlays</span>
              <select
                className="select"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                disabled={metricLocked}
              >
                {METRICS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </>
          )}
          {metricLocked && (
            <span className="metric-lock-hint">set by plate</span>
          )}
        </div>

        <div className="group" style={{ marginBottom: 16 }}>
          {compact ? (
            <details className="family-picker">
              <summary>
                <span className="ghead">Sport families</span>
                <span className="family-summary">
                  {allOn
                    ? `all ${families.length}`
                    : `${selectedFamilies.size} of ${families.length}`}
                </span>
                <span className="caret">▾</span>
              </summary>
              <div className="family-picker-body">
                {setSelectedFamilies && (
                  <div className="family-picker-actions">
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setSelectedFamilies(new Set(families))}
                      disabled={allOn}
                    >
                      Select all
                    </button>
                    <span className="sep">·</span>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setSelectedFamilies(new Set())}
                      disabled={noneOn}
                    >
                      Deselect all
                    </button>
                  </div>
                )}
                {familyChips}
              </div>
            </details>
          ) : (
            <>
              <span className="ghead">Sport families</span>
              {familyChips}
            </>
          )}
        </div>

        <div className={`group ${compact ? "era-row" : ""}`} style={{ marginBottom: 16 }}>
          <span className="ghead">Era <span className="era-bounds">{eraRange[0]}–{eraRange[1]}</span></span>
          <div
            className="range-wrap"
            style={{
              "--era-start": `${((eraRange[0] - 1896) / (2026 - 1896)) * 100}%`,
              "--era-end":   `${((eraRange[1] - 1896) / (2026 - 1896)) * 100}%`,
            }}
          >
            <input
              type="range"
              min={1896}
              max={2026}
              value={eraRange[0]}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEraRange([Math.min(v, eraRange[1]), eraRange[1]]);
              }}
            />
            <input
              type="range"
              min={1896}
              max={2026}
              value={eraRange[1]}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEraRange([eraRange[0], Math.max(v, eraRange[0])]);
              }}
            />
            {!compact && (
              <div className="labels">
                <span>1896</span>
                <span>2026</span>
              </div>
            )}
          </div>
        </div>

        {!compact && (
          <div className="group">
            <span className="ghead">Overlays</span>
            <div
              className={`toggle-row ${overlays.dots ? "on" : ""}`}
              onClick={() => setOverlay("dots", !overlays.dots)}
            >
              <div>
                <span className="label">Athlete hometowns</span>
                <span className="sub">dots coloured by sport family</span>
              </div>
              <span className="switch" />
            </div>
            <div
              className={`toggle-row ${overlays.centers ? "on" : ""}`}
              onClick={() => setOverlay("centers", !overlays.centers)}
            >
              <div>
                <span className="label">USOPC training centers</span>
                <span className="sub">{TC_COUNT} facilities, rust = paralympic</span>
              </div>
              <span className="switch" />
            </div>
            <div
              className={`toggle-row ${overlays.colleges ? "on" : ""}`}
              onClick={() => setOverlay("colleges", !overlays.colleges)}
            >
              <div>
                <span className="label">Feeder colleges</span>
                <span className="sub">College programs, sized by matched profiles</span>
              </div>
              <span className="switch" />
            </div>
            <div
              className={`toggle-row ${medalOnly ? "on" : ""}`}
              onClick={() => setMedalOnly(!medalOnly)}
            >
              <div>
                <span className="label">Medalists only</span>
                <span className="sub">hide zero-medal athletes</span>
              </div>
              <span className="switch" />
            </div>
          </div>
        )}
      </section>
    </aside>
  );
}
