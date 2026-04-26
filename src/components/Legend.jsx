import React from "react";

export default function Legend({ families, familyColors, familyCounts }) {
  return (
    <aside className="panel legend">
      <section>
        <h2>
          Legend <span className="index">ii.</span>
        </h2>
        <ul>
          {families.map((f) => (
            <li key={f}>
              <span className="sw" style={{ background: familyColors[f] || "#555" }} />
              <span className="name">{f}</span>
              <span className="n">{(familyCounts[f] || 0).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
      <section style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", lineHeight: 1.6 }}>
        <h2>Map keys <span className="index">iii.</span></h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <svg width="16" height="16" viewBox="-10 -10 20 20">
            <path
              d="M0,-9 L2.7,-2.7 L9,0 L2.7,2.7 L0,9 L-2.7,2.7 L-9,0 L-2.7,-2.7 Z"
              fill="#c89837"
              stroke="#1a1410"
              strokeWidth="0.8"
            />
          </svg>
          Training center (gold)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <svg width="16" height="16" viewBox="-10 -10 20 20">
            <path
              d="M0,-9 L2.7,-2.7 L9,0 L2.7,2.7 L0,9 L-2.7,2.7 L-9,0 L-2.7,-2.7 Z"
              fill="#c63d2f"
              stroke="#1a1410"
              strokeWidth="0.8"
            />
          </svg>
          Paralympic-supporting
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <svg width="16" height="16" viewBox="-10 -10 20 20">
            <circle r="8" fill="rgba(93,55,35,0.18)" stroke="rgba(26,20,16,0.55)" strokeWidth="0.6" />
          </svg>
          College alumni (∝ count)
        </div>
      </section>
    </aside>
  );
}
