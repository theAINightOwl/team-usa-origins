import React from "react";

const METRICS = [
  { value: "olympians", label: "Team USA profiles" },
  { value: "medals",    label: "Total medals won" },
  { value: "income",    label: "Median household income" },
  { value: "nfhs",      label: "HS participation slots" },
  { value: "temp",      label: "Average annual temperature" },
  { value: "snow",      label: "Average annual snowfall" },
];

export default function Filters({
  metric, setMetric,
  families, selectedFamilies, toggleFamily,
  familyColors, familyCounts,
  medalOnly, setMedalOnly,
  eraRange, setEraRange,
  overlays, setOverlay,
}) {
  return (
    <aside className="panel">
      <section>
        <h2>
          Filters <span className="index">i.</span>
        </h2>

        <div className="group" style={{ marginBottom: 16 }}>
          <span className="ghead">Choropleth metric</span>
          <select
            className="select"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="group" style={{ marginBottom: 16 }}>
          <span className="ghead">Sport families</span>
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
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        <div className="group" style={{ marginBottom: 16 }}>
          <span className="ghead">Era {eraRange[0]}–{eraRange[1]}</span>
          <div className="range-wrap">
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
            <div className="labels">
              <span>1896</span>
              <span>2026</span>
            </div>
          </div>
        </div>

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
              <span className="sub">12 facilities, rust = paralympic</span>
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
      </section>
    </aside>
  );
}
