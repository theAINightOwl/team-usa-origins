import React, { useMemo } from "react";

/*
 * AthleteCard — renders when an individual athlete dot is clicked.
 * Shows biographical stats + nearest training center (computed client-side
 * by simple haversine against `trainingCenters`).
 */
export default function AthleteCard({ athlete, trainingCenters, states, familyColors, onClose }) {
  if (!athlete) return null;

  const family = athlete.family || "Other";
  const familyColor = familyColors[family] || "#555";
  const state = states[athlete.state];

  const nearest = useMemo(() => {
    if (!athlete.lat || !athlete.lng) return null;
    let best = null;
    for (const c of trainingCenters) {
      if (c.lat == null || c.lng == null) continue;
      const d = haversine(athlete.lat, athlete.lng, c.lat, c.lng);
      if (best == null || d < best.d) best = { c, d };
    }
    return best;
  }, [athlete, trainingCenters]);

  return (
    <div className="detail">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="eyebrow">Selection · Athlete</p>
          <h3 style={{ fontStyle: "italic", color: familyColor }}>
            {athlete.sport}
          </h3>
          <p className="loc">
            {athlete.city}
            {athlete.state ? `, ${athlete.state}` : ""} — Team USA
          </p>
        </div>
        <button className="close-btn" onClick={onClose}>close</button>
      </div>

      <div className="stats">
        <div className="cell">
          <div className="label">Medals</div>
          <div className="value gold num">{athlete.total_medals || 0}</div>
        </div>
        <div className="cell">
          <div className="label">Games</div>
          <div className="value num">{athlete.games_count || 0}</div>
        </div>
        <div className="cell">
          <div className="label">Era</div>
          <div className="value num" style={{ fontSize: 18 }}>
            {athlete.first || "—"}
            {athlete.last && athlete.last !== athlete.first ? `–${athlete.last}` : ""}
          </div>
        </div>
      </div>

      <section>
        <p className="eyebrow">Sport</p>
        <div className="row">
          <span className="k">Primary</span>
          <span className="v" style={{ color: familyColor, fontStyle: "italic" }}>
            {athlete.sport}
          </span>
        </div>
        <div className="row">
          <span className="k">Family</span>
          <span className="v">{family}</span>
        </div>
        <div className="row">
          <span className="k">Gender</span>
          <span className="v">{athlete.gender || "—"}</span>
        </div>
        <div className="row">
          <span className="k">Games</span>
          <span className="v">{athlete.type} · {athlete.season}</span>
        </div>
        <div className="row">
          <span className="k">Breakdown</span>
          <span className="v num">
            <span style={{ color: "var(--gold)" }}>{athlete.gold}G</span>{" "}
            <span style={{ color: "var(--ink-3)" }}>{athlete.silver}S</span>{" "}
            <span style={{ color: "#8a5a3d" }}>{athlete.bronze}B</span>
          </span>
        </div>
      </section>

      <section>
        <p className="eyebrow" style={{ marginTop: 18 }}>Support</p>
        {athlete.school && (
          <div className="row">
            <span className="k">College</span>
            <span className="v" style={{ fontStyle: "italic", fontSize: 12 }}>
              {athlete.school}
            </span>
          </div>
        )}
        {nearest && (
          <div className="row">
            <span className="k">Nearest USOPC</span>
            <span className="v" style={{ fontSize: 12, fontStyle: "italic" }}>
              {nearest.c.name}
            </span>
          </div>
        )}
        {nearest && (
          <div className="row">
            <span className="k">Distance</span>
            <span className="v num">
              {Math.round(nearest.d)} mi
            </span>
          </div>
        )}
        {state && (
          <div className="row">
            <span className="k">Home state HS</span>
            <span className="v num">
              {(state.nfhs_total || 0).toLocaleString()}
            </span>
          </div>
        )}
        {state && state.median_income != null && (
          <div className="row">
            <span className="k">County income</span>
            <span className="v num">${state.median_income.toLocaleString()}</span>
          </div>
        )}
      </section>

      <p className="eyebrow" style={{ marginTop: 22, color: "var(--ink-4)" }}>
        ↓ co-ordinates {athlete.lat.toFixed(3)}°, {athlete.lng.toFixed(3)}°
      </p>
    </div>
  );
}

// Haversine in miles.
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
