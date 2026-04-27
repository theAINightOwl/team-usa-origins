/*
 * plate_briefs.js — assembles a markdown summary of all 11 plates from the
 * computed analytics.json. The system prompt embeds this so Gemini can
 * answer questions about the data without re-deriving it.
 *
 * Pure function: input = analytics.json + states.json. Output = a single
 * markdown string ready to drop into the system prompt.
 */

export function buildPlateBriefs(analytics, states) {
  const sections = [
    plateI(),
    plateII(analytics.factories),
    plateIII(analytics.concentration),
    plateIV(analytics.halos),
    plateV(analytics.distance),
    plateVI(analytics.climate_sport),
    plateVII(analytics.paralympic),
    plateVIII(analytics.college_efficiency),
    plateIX(analytics.per_capita),
    plateX(analytics.hs_conversion),
    plateXI(analytics.era),
  ];
  return sections.join("\n\n");
}

function plateI() {
  return [
    "## Plate I — Reference",
    "Editorial intro to the atlas. Roster scraped from teamusa.com (5,201 athletes geocoded out of 8,526 profiles).",
    "Coordinates from the 2023 U.S. Census Gazetteer, augmented by 346 hand-curated corrections.",
  ].join("\n");
}

function plateII(rows) {
  if (!rows?.length) return "## Plate II — Factories\n(no data)";
  const top10 = rows.slice(0, 10);
  return [
    "## Plate II — Small-Town Factories",
    "Olympians per 10,000 residents, by hometown. Filter: town pop ≥ 500 and ≥ 2 athletes.",
    "Population from Census PEP `sub-est2023.csv`. Surfaces winter-sports / Olympic-pipeline towns.",
    "",
    "**Top 10 factories (rate per 10k):**",
    ...top10.map((r, i) =>
      `${i + 1}. **${r.city}, ${r.state}** — ${r.olympians} olympians ÷ ${r.population.toLocaleString()} pop = **${r.rate.toFixed(1)}/10k** (top sport: ${r.top_sport})`
    ),
  ].join("\n");
}

function plateIII(rows) {
  if (!rows?.length) return "## Plate III — Concentration\n(no data)";
  const filt = rows.filter((r) => r.n_athletes >= 8).slice(0, 10);
  return [
    "## Plate III — Sport Geographic Concentration",
    "Herfindahl index per sport: sum of squared state shares. 1.0 = single state, 0.02 = perfectly spread.",
    "",
    "**Most concentrated sports:**",
    ...filt.map((r) => {
      const top3 = r.top_states.map((t) => `${t.state} ${Math.round(t.share * 100)}%`).join(", ");
      return `- **${r.sport}** (n=${r.n_athletes}, HHI ${r.hhi.toFixed(2)}) — ${top3}`;
    }),
  ].join("\n");
}

function plateIV(rows) {
  if (!rows?.length) return "## Plate IV — Halos\n(no data)";
  const top = [...rows].sort((a, b) => (b.cumulative.at(-1) ?? 0) - (a.cumulative.at(-1) ?? 0)).slice(0, 6);
  return [
    "## Plate IV — Training-Center Halos",
    "Athletes within 25/50/100/200 mi of each USOPC-recognized facility. Cumulative — wider rings include closer ones.",
    "Of the 10 facilities tracked, **2 are official Olympic & Paralympic Training Centers (OPTCs)** owned and operated by USOPC — Colorado Springs and Lake Placid. The other 8 are USOPC-affiliated training sites (Chula Vista was sold to the City of Chula Vista in 2017 and is no longer USOPC-owned).",
    "",
    "**Centers ranked by 200-mi reach:**",
    ...top.map((r) => {
      const c = r.cumulative;
      return `- **${r.name}** (${r.city}, ${r.state}) — 25mi: ${c[0]}, 50mi: ${c[1]}, 100mi: ${c[2]}, **200mi: ${c[3]}**`;
    }),
  ].join("\n");
}

function plateV(d) {
  if (!d?.families) return "## Plate V — Distance\n(no data)";
  const fams = Object.entries(d.families).sort((a, b) => b[1].n_med - a[1].n_med).slice(0, 6);
  return [
    "## Plate V — Distance to Nearest USOPC Center",
    "Buckets: ≤25, ≤50, ≤100, ≤200, ≤400, ≤800, >800 miles. Compares medalists vs non-medalists per family.",
    "",
    "**By family (medalist count / non-medalist count):**",
    ...fams.map(([fam, x]) => `- **${fam}**: ${x.n_med} medalists / ${x.n_non} non-medalists`),
  ].join("\n");
}

function plateVI(d) {
  if (!d?.matrix?.length) return "## Plate VI — Climate × Sport\n(no data)";
  const lines = ["## Plate VI — Climate × Sport Family",
    "Share of each sport family's athletes from each climate zone (NCEI Köppen).",
    "",
    "**Each family's dominant climate zone:**"];
  for (const row of d.matrix) {
    const peak = row.zones.reduce((m, z) => (z.share > m.share ? z : m), { share: 0 });
    if (peak.share > 0) {
      lines.push(`- **${row.family}** → ${peak.zone} (${Math.round(peak.share * 100)}% of ${row.total} athletes)`);
    }
  }
  return lines.join("\n");
}

function plateVII(rows) {
  if (!rows?.length) return "## Plate VII — Paralympic\n(no data)";
  const top = rows.filter((r) => r.total >= 10).slice(0, 8);
  return [
    "## Plate VII — Paralympic Geography",
    "Each state's Paralympic share of its total Team USA athletes (filter: ≥ 10 athletes).",
    "",
    "**Highest Paralympic share by state:**",
    ...top.map((r) => `- **${r.state}** — ${(r.para_share * 100).toFixed(0)}% Paralympic (${r.paralympic} of ${r.total})`),
  ].join("\n");
}

function plateVIII(d) {
  if (!d?.points?.length) return "## Plate VIII — Colleges\n(no data)";
  const top = d.points.filter((p) => p.olympians >= 2).slice(0, 10);
  return [
    "## Plate VIII — College Efficiency (Olympians per Athletic $M)",
    "NCAA programs ranked by olympians ÷ athletic budget ($M). Filter: ≥ 2 olympians.",
    "Surfaces efficient mid-budget programs alongside the giants.",
    "",
    "**Top efficient programs:**",
    ...top.map((r, i) => `${i + 1}. **${r.name}** (${r.state}) — ${r.olympians} olympians ÷ $${r.budget_m}M = **${r.ratio.toFixed(2)}/$M**`),
  ].join("\n");
}

function plateIX(rows) {
  if (!rows?.length) return "## Plate IX — Per Capita\n(no data)";
  const top = rows.slice(0, 12);
  const total = rows.reduce((s, r) => s + r.olympians, 0);
  const totalPop = rows.reduce((s, r) => s + r.population, 0);
  const natl = total / totalPop * 100_000;
  return [
    "## Plate IX — Olympians per 100k Residents",
    `National average ≈ ${natl.toFixed(2)} olympians per 100k. Population from Census PEP 2023.`,
    "Reorders the country: big states sink, mountain & northeastern states rise.",
    "",
    "**Top 12 states per capita:**",
    ...top.map((r, i) => `${i + 1}. **${r.state}** (${r.name}) — ${r.olympians} ÷ ${r.population.toLocaleString()} = **${r.per_100k.toFixed(2)}/100k**`),
  ].join("\n");
}

function plateX(rows) {
  if (!rows?.length) return "## Plate X — Pipeline\n(no data)";
  const top = rows.filter((r) => r.nfhs >= 5000).slice(0, 12);
  return [
    "## Plate X — High-School Pipeline Conversion",
    "Olympians produced per 1,000,000 NFHS high-school sports participants in the state.",
    "Filter NFHS ≥ 5,000 to drop micro-states with noisy ratios.",
    "",
    "**Best HS-to-podium converters:**",
    ...top.map((r, i) => `${i + 1}. **${r.state}** — ${r.olympians} olympians ÷ ${r.nfhs.toLocaleString()} HS participants = **${r.per_million_hs.toFixed(0)}/M**`),
  ].join("\n");
}

function plateXI(d) {
  if (!d?.per_state) return "## Plate XI — Era\n(no data)";
  const decades = d.decades.map((x) => x.label);
  // Replicate the panel's "swing" metric (2020s+2010s vs 1980s+1990s)
  const ranked = Object.entries(d.per_state)
    .map(([st, counts]) => {
      const early = counts[0] + counts[1];
      const late = counts[3] + counts[4];
      const total = counts.reduce((a, b) => a + b, 0);
      const swing = (late + 1) / (early + 1);
      return { st, counts, total, swing };
    })
    .filter((r) => r.total >= 30)
    .sort((a, b) => b.swing - a.swing)
    .slice(0, 10);
  return [
    "## Plate XI — Era Migration",
    `Athletes active in each decade (${decades.join(" / ")}). Sorted by 2020s/1980s swing ratio.`,
    "Caveat: the Team USA roster skews to currently-active athletes, so absolute decade counts climb sharply; the cross-state swing comparison is the meaningful insight.",
    "",
    "**Biggest growth states (1980s → 2020s ratio):**",
    ...ranked.map((r) => `- **${r.st}** — counts ${r.counts.join("/")}, swing ×${r.swing.toFixed(1)}`),
    "",
    `National row: ${d.national.join(" / ")}`,
  ].join("\n");
}
