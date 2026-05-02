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
    plateIV(analytics.halos, analytics.training_gap),
    plateV(analytics.distance),
    plateVI(analytics.climate_sport),
    plateVII(analytics.paralympic, analytics.meta?.paralympic),
    plateVIII(analytics.college_efficiency),
    plateIX(analytics.per_capita, analytics.meta?.per_capita),
    plateX(analytics.hs_conversion, analytics.meta?.hs_conversion),
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
    "Team USA athlete profiles per 10,000 residents, by hometown. Filter: town pop ≥ 500 and ≥ 2 athletes.",
    "Population from Census PEP `sub-est2023.csv`. Surfaces winter-sports / Olympic-pipeline towns.",
    "",
    "**Top 10 factories (rate per 10k):**",
    ...top10.map((r, i) =>
      `${i + 1}. **${r.city}, ${r.state}** — ${r.athletes} Team USA profiles ÷ ${r.population.toLocaleString()} pop = **${r.rate.toFixed(1)}/10k** (top sport: ${r.top_sport})`
    ),
  ].join("\n");
}

function plateIII(rows) {
  if (!rows?.length) return "## Plate III — Concentration\n(no data)";
  const filt = rows.filter((r) => r.n_athletes >= 7).slice(0, 10);
  return [
    "## Plate III — Sport Geographic Concentration",
    "Herfindahl index per sport: sum of squared state shares across Team USA profile hometowns. 1.0 = single state, 0.02 = perfectly spread.",
    "",
    "**Most concentrated sports:**",
    ...filt.map((r) => {
      const top3 = r.top_states.map((t) => `${t.state} ${Math.round(t.share * 100)}%`).join(", ");
      return `- **${r.sport}** (n=${r.n_athletes}, HHI ${r.hhi.toFixed(2)}) — ${top3}`;
    }),
  ].join("\n");
}

function plateIV(rows, gap) {
  if (!rows?.length) return "## Plate IV — Halos\n(no data)";
  const top = [...rows].sort((a, b) => (b.cumulative.at(-1) ?? 0) - (a.cumulative.at(-1) ?? 0)).slice(0, 6);
  const trackedFacilities = rows.reduce((s, r) => s + (r.facility_count || 1), 0);
  const optcs = rows.filter((r) => r.type === "OPTC").length;
  return [
    "## Plate IV — Training-Center Halos",
    `Team USA profiles within 25/50/100/200 mi of each curated training-facility geography. Cumulative — wider rings include closer ones. ${trackedFacilities} tracked facilities collapse to ${rows.length} map locations; ${optcs} are USOPC-operated OPTCs.`,
    "This is not the complete current USOPC training-site list. Each row also reports direct sport-served profiles based on the facility's sports_served field.",
    gap
      ? `Gap scan: ${gap.far_profiles.toLocaleString()} profiles (${Math.round(gap.share * 100)}%) are more than ${gap.threshold_km}km from the nearest tracked facility geography. Top far metro: ${gap.top_metros?.[0]?.city}, ${gap.top_metros?.[0]?.state} (${gap.top_metros?.[0]?.n}).`
      : "",
    "",
    "**Centers ranked by 200-mi reach:**",
    ...top.map((r) => {
      const c = r.cumulative;
      const d = r.direct_cumulative || [];
      const colocated = r.colocated_names?.length ? `; co-located: ${r.colocated_names.join(", ")}` : "";
      return `- **${r.name}** (${r.city}, ${r.state}) — 25mi: ${c[0]}, 50mi: ${c[1]}, 100mi: ${c[2]}, **200mi: ${c[3]}**; direct sport-served 200mi: ${d[3] ?? 0}${colocated}`;
    }),
  ].join("\n");
}

function plateV(d) {
  if (!d?.families) return "## Plate V — Distance\n(no data)";
  const fams = Object.entries(d.families).sort((a, b) => b[1].n_med - a[1].n_med).slice(0, 6);
  const overallRates = d.overall?.medalist_rate || [];
  const scope = d.scope || {};
  const excludedHopefuls = scope.excluded_profile_types?.Hopeful || 0;
  return [
    "## Plate V — Distance to Nearest Sport-Serving Facility",
    "Buckets: ≤25, ≤50, ≤100, ≤200, ≤400, ≤800, >800 miles. Compares medalist rates and ≤200mi proximity premiums for Olympic/Paralympic profiles only.",
    scope.included_profiles
      ? `Scope: ${scope.included_profiles.toLocaleString()} profiles with a tracked sport-serving facility; excludes ${excludedHopefuls.toLocaleString()} Hopeful profiles and ${(scope.unserved_profiles || 0).toLocaleString()} Olympic/Paralympic profiles whose sport is not listed on the tracked facility roster.`
      : "",
    overallRates.length
      ? `Overall medalist rate by bucket: ${overallRates.map((r, i) => `${d.bins[i]} ${(r * 100).toFixed(1)}%`).join(", ")}.`
      : "",
    "",
    "**By family (medalist count / non-medalist count / ≤200mi premium):**",
    ...fams.map(([fam, x]) => {
      const premium = x.premium_within_200_pp || 0;
      return `- **${fam}**: ${x.n_med} medalists / ${x.n_non} non-medalists / ${premium > 0 ? "+" : ""}${premium.toFixed(1)}pp`;
    }),
  ].join("\n");
}

function plateVI(d) {
  if (!d?.matrix?.length) return "## Plate VI — Climate × Sport\n(no data)";
  const scope = d.scope || {};
  const lines = ["## Plate VI — Climate × Sport Family",
    "Share of each sport family's Team USA profiles from state-level climate-zone labels in data/hometown_climate.csv, assigned by athlete hometown state.",
    scope.included_profiles
      ? `Scope: ${scope.included_profiles.toLocaleString()} profiles (${Object.entries(scope.profile_type_counts || {}).map(([type, n]) => `${type} ${n.toLocaleString()}`).join(", ")}).`
      : "",
    "",
    "**Each family's dominant climate zone:**"];
  for (const row of d.matrix) {
    const peak = row.zones.reduce((m, z) => (z.share > m.share ? z : m), { share: 0 });
    if (peak.share > 0) {
      lines.push(`- **${row.family}** → ${peak.zone} (${Math.round(peak.share * 100)}% of ${row.total} profiles)`);
    }
  }
  if (d.residuals?.length) {
    lines.push("", "**Top positive standardized residuals:**");
    for (const r of d.residuals.slice(0, 6)) {
      lines.push(`- **${r.family} × ${r.zone}**: ${r.standardized_residual.toFixed(1)} (${r.n} observed vs. ${r.expected.toFixed(1)} expected)`);
    }
  }
  return lines.join("\n");
}

function plateVII(rows, meta = {}) {
  if (!rows?.length) return "## Plate VII — Paralympic\n(no data)";
  const threshold = meta.display_threshold_total || 10;
  const excludedHopefuls = meta.excluded_profile_types?.Hopeful || 0;
  const top = rows.filter((r) => r.total >= threshold).slice(0, 8);
  return [
    "## Plate VII — Paralympic Geography",
    `Each state's Paralympic share of Olympic+Paralympic profiles. Hopeful profiles are excluded (${excludedHopefuls.toLocaleString()}); filter: ≥ ${threshold} included profiles.`,
    meta.national_share
      ? `National baseline: ${(meta.national_share * 100).toFixed(1)}% Paralympic (${meta.national_paralympians?.toLocaleString()} of ${meta.national_total?.toLocaleString()} included profiles).`
      : "",
    "",
    "**Highest Paralympic share by state:**",
    ...top.map((r) => `- **${r.state}** — ${(r.para_share * 100).toFixed(0)}% Paralympic (${r.paralympic} of ${r.total}; ${r.hopeful_excluded || 0} Hopeful excluded)`),
  ].join("\n");
}

function plateVIII(d) {
  if (!d?.points?.length) return "## Plate VIII — Colleges\n(no data)";
  const top = d.points.filter((p) => p.matched_profiles >= 2).slice(0, 10);
  return [
    "## Plate VIII — College Efficiency (Team USA Profiles per Athletic $M)",
    "College programs ranked by matched Team USA profiles ÷ athletic budget ($M). Filter: ≥ 2 matched profiles.",
    "Surfaces efficient mid-budget programs alongside the giants.",
    "",
    "**Top efficient programs:**",
    ...top.map((r, i) => `${i + 1}. **${r.name}** (${r.state}) — ${r.matched_profiles} profiles ÷ $${r.budget_m}M = **${r.ratio.toFixed(2)}/$M** (O ${r.olympians}, P ${r.paralympians}, H ${r.hopefuls})`),
  ].join("\n");
}

function plateIX(rows, meta) {
  if (!rows?.length) return "## Plate IX — Per Capita\n(no data)";
  const top = rows.slice(0, 12);
  const natl = meta?.national_per_100k ??
    (rows.reduce((s, r) => s + r.profiles, 0) /
      rows.reduce((s, r) => s + r.population, 0) * 100_000);
  return [
    "## Plate IX — Team USA Profiles per 100k Residents",
    `National average ≈ ${natl.toFixed(2)} profiles per 100k. Population from Census PEP 2023; Olympic, Paralympic, and Hopeful profiles included.`,
    "Reorders the country: big states sink, mountain & northeastern states rise.",
    "",
    "**Top 12 states per capita:**",
    ...top.map((r, i) => `${i + 1}. **${r.state}** (${r.name}) — ${r.profiles} profiles ÷ ${r.population.toLocaleString()} = **${r.per_100k.toFixed(2)}/100k** (O ${r.olympians}, P ${r.paralympians}, H ${r.hopefuls})`),
  ].join("\n");
}

function plateX(rows, meta = {}) {
  if (!rows?.length) return "## Plate X — NFHS Slot Density\n(no data)";
  const top = rows
    .filter((r) => (r.nfhs_participation_slots ?? r.nfhs) >= 5000)
    .slice(0, 12);
  const national = meta?.national_per_million_hs;
  return [
    "## Plate X — Team USA Profiles per NFHS Participation Slot",
    "Team USA profiles per 1,000,000 NFHS participation slots in the state.",
    "Uses 2024-25 official NFHS state totals. Participation slots are not unique students.",
    national ? `National profile density ≈ ${national.toFixed(0)}/M slots.` : "",
    "",
    "**Highest profile density per NFHS slot:**",
    ...top.map((r, i) => `${i + 1}. **${r.state}** — ${r.profiles} profiles ÷ ${(r.nfhs_participation_slots ?? r.nfhs).toLocaleString()} slots = **${r.per_million_hs.toFixed(0)}/M** (O ${r.olympians}, P ${r.paralympians}, H ${r.hopefuls})`),
  ].filter(Boolean).join("\n");
}

function plateXI(d) {
  if (!d?.per_state) return "## Plate XI — Era\n(no data)";
  const decades = d.decades.map((x) => x.label);
  const ranked = (d.swing_rankings || Object.entries(d.per_state)
    .map(([st, counts]) => {
      const early = counts[0] + counts[1];
      const late = counts[3] + counts[4];
      const total = counts.reduce((a, b) => a + b, 0);
      const swing = (late + 1) / (early + 1);
      return { state: st, counts, total, swing };
    })
    .filter((r) => r.total >= 30)
    .sort((a, b) => b.swing - a.swing))
    .slice(0, 10)
    .map((r) => ({ st: r.state, counts: r.counts, total: r.total, swing: r.swing }));
  const scope = d.scope || {};
  return [
    "## Plate XI — Era Presence",
    `Team USA profiles with parsed active years, counted in each overlapping decade (${decades.join(" / ")}). Sorted by late-vs-early swing: ${d.swing_metric?.label || "(2010s + 2020s + 1) / (1980s + 1990s + 1)"}.`,
    scope.included_profiles_with_parsed_year != null
      ? `Scope: ${scope.included_profiles_with_parsed_year.toLocaleString()} profiles included; ${(scope.excluded_no_parsed_year || 0).toLocaleString()} geocoded profiles have no parsed year and are excluded.`
      : "",
    "Caveat: the Team USA roster skews to currently-active profiles, so this is not a complete historical census or a migration model.",
    "",
    "**Biggest late-vs-early swing states:**",
    ...ranked.map((r) => `- **${r.st}** — counts ${r.counts.join("/")}, swing ×${r.swing.toFixed(1)}`),
    "",
    `National row: ${d.national.join(" / ")}`,
  ].filter(Boolean).join("\n");
}
