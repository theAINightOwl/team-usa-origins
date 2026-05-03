/*
 * plate_briefs.js — assembles a markdown summary of the atlas plates from
 * the computed analytics.json. The system prompt embeds this so Gemini can
 * answer questions about the data without re-deriving it.
 *
 * Pure function: input = analytics.json + states.json + profileType.
 * Output = a single markdown string ready to drop into the system prompt.
 *
 * The atlas has a binary lens (Olympic / Paralympic). Most plates have
 * lens-specific slices (e.g. analytics.factories_olympic). We pick the
 * right slice up front, fall back to the lumped key if the slice is
 * absent (shouldn't happen post-Phase-1 but kept defensive).
 */

function pick(analytics, baseKey, profileType) {
  return analytics[`${baseKey}_${profileType}`] || analytics[baseKey];
}

export function buildPlateBriefs(analytics, states, profileType = "olympic") {
  const lensLabel = profileType === "paralympic" ? "Paralympic" : "Olympic";
  const sections = [
    plateI(lensLabel),
    plateII(pick(analytics, "factories", profileType), lensLabel),
    plateIII(pick(analytics, "concentration", profileType), lensLabel),
    plateIV(pick(analytics, "halos", profileType), analytics.training_gap, lensLabel),
    plateV(pick(analytics, "distance", profileType), lensLabel),
    plateVI(pick(analytics, "climate_sport", profileType), lensLabel),
    plateVII(pick(analytics, "per_capita", profileType), lensLabel),
    plateVIII(pick(analytics, "college_efficiency", profileType), lensLabel),
    plateIX(pick(analytics, "hs_conversion", profileType), analytics.meta?.hs_conversion, lensLabel),
    plateX(pick(analytics, "era", profileType), lensLabel),
  ];
  return sections.join("\n\n");
}

function plateI(lens) {
  return [
    `## Plate I — Reference (${lens} lens active)`,
    "Editorial intro to the atlas. Roster scraped from teamusa.com (5,201 athletes geocoded out of 8,526 profiles).",
    "Coordinates from the 2023 U.S. Census Gazetteer, augmented by 346 hand-curated corrections.",
    `**Active lens:** ${lens}. The user has set the global lens toggle to ${lens}, so every plate below shows the ${lens}-only slice. Hopefuls are excluded under both lenses.`,
  ].join("\n");
}

function plateII(rows, lens) {
  if (!rows?.length) return `## Plate II — Factories (${lens})\n(no data)`;
  const top10 = rows.slice(0, 10);
  return [
    `## Plate II — Small-Town Factories (${lens})`,
    `${lens} athletes per 10,000 residents, by hometown. Filter: town pop ≥ 500 and ≥ 2 athletes.`,
    "Population from Census PEP `sub-est2023.csv`.",
    "",
    "**Top 10 factories (rate per 10k):**",
    ...top10.map((r, i) =>
      `${i + 1}. **${r.city}, ${r.state}** — ${r.athletes} ${lens} athletes ÷ ${r.population.toLocaleString()} pop = **${r.rate.toFixed(1)}/10k** (top sport: ${r.top_sport})`
    ),
  ].join("\n");
}

function plateIII(rows, lens) {
  if (!rows?.length) return `## Plate III — Concentration (${lens})\n(no data)`;
  const filt = rows.filter((r) => r.n_athletes >= 5).slice(0, 10);
  return [
    `## Plate III — Sport Geographic Concentration (${lens})`,
    `Herfindahl index per ${lens} sport: sum of squared state shares across hometowns. 1.0 = single state, 0.02 = perfectly spread.`,
    "",
    "**Most concentrated sports:**",
    ...filt.map((r) => {
      const top3 = r.top_states.map((t) => `${t.state} ${Math.round(t.share * 100)}%`).join(", ");
      return `- **${r.sport}** (n=${r.n_athletes}, HHI ${r.hhi.toFixed(2)}) — ${top3}`;
    }),
  ].join("\n");
}

function plateIV(rows, gap, lens) {
  if (!rows?.length) return `## Plate IV — Halos (${lens})\n(no data)`;
  const top = [...rows].sort((a, b) => (b.cumulative.at(-1) ?? 0) - (a.cumulative.at(-1) ?? 0)).slice(0, 6);
  const trackedFacilities = rows.reduce((s, r) => s + (r.facility_count || 1), 0);
  const optcs = rows.filter((r) => r.type === "OPTC").length;
  return [
    `## Plate IV — Training-Center Halos (${lens})`,
    `${lens} athletes within 25/50/100/200 mi of each curated training-facility geography. Cumulative — wider rings include closer ones. ${trackedFacilities} tracked facilities collapse to ${rows.length} map locations; ${optcs} are USOPC-operated OPTCs.`,
    `Direct sport-served counts use each facility's sports_served field. Note: the tracked facility roster was built around Olympic disciplines, so direct sport-served counts are typically smaller under the Paralympic lens.`,
    gap
      ? `Gap scan (lumped, not lens-specific): ${gap.far_profiles.toLocaleString()} profiles (${Math.round(gap.share * 100)}%) are more than ${gap.threshold_km}km from the nearest tracked facility. Top far metro: ${gap.top_metros?.[0]?.city}, ${gap.top_metros?.[0]?.state} (${gap.top_metros?.[0]?.n}).`
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

function plateV(d, lens) {
  if (!d?.families) return `## Plate V — Distance (${lens})\n(no data)`;
  const fams = Object.entries(d.families)
    .map(([fam, x]) => ({ fam, ...x, total: (x.n_med || 0) + (x.n_non || 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const scope = d.scope || {};
  return [
    `## Plate V — Distance to Nearest Sport-Serving Facility (${lens})`,
    `Buckets: ≤25, ≤50, ≤100, ≤200, ≤400, ≤800, >800 miles. Distance from each ${lens} athlete's hometown to the nearest tracked training site that lists their sport.`,
    scope.included_profiles
      ? `Scope: ${scope.included_profiles.toLocaleString()} ${lens} athletes included; ${(scope.unserved_profiles || 0).toLocaleString()} excluded because their sport has no tracked sport-serving facility.`
      : "",
    "",
    "**By family (athletes total, share within 200mi, share beyond 800mi):**",
    ...fams.map(({ fam, medalist, nonmedalist, total }) => {
      const totals = (medalist || []).map((m, i) => m + ((nonmedalist && nonmedalist[i]) || 0));
      const close = totals.slice(0, 4).reduce((s, n) => s + n, 0);
      const far = totals[6] || 0;
      return `- **${fam}** (n=${total}): ${total ? Math.round(close / total * 100) : 0}% within 200mi, ${total ? Math.round(far / total * 100) : 0}% beyond 800mi`;
    }),
  ].join("\n");
}

function plateVI(d, lens) {
  if (!d?.matrix?.length) return `## Plate VI — Climate × Sport (${lens})\n(no data)`;
  const scope = d.scope || {};
  const lines = [
    `## Plate VI — Climate × Sport Family (${lens})`,
    `Share of each ${lens} sport family's hometowns from state-level climate-zone labels in data/hometown_climate.csv.`,
    scope.included_profiles
      ? `Scope: ${scope.included_profiles.toLocaleString()} ${lens} athletes.`
      : "",
    "",
    "**Each family's dominant climate zone:**",
  ];
  for (const row of d.matrix) {
    const peak = row.zones.reduce((m, z) => (z.share > m.share ? z : m), { share: 0 });
    if (peak.share > 0) {
      lines.push(`- **${row.family}** → ${peak.zone} (${Math.round(peak.share * 100)}% of ${row.total})`);
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

function plateVII(rows, lens) {
  if (!rows?.length) return `## Plate VII — Per Capita (${lens})\n(no data)`;
  const top = rows.slice(0, 12);
  const totalProfiles = rows.reduce((s, r) => s + (r.profiles || 0), 0);
  const totalPop = rows.reduce((s, r) => s + (r.population || 0), 0);
  const natl = totalPop ? (totalProfiles / totalPop) * 100_000 : 0;
  const lensWord = lens === "Paralympic" ? "Paralympians" : "Olympians";
  return [
    `## Plate VII — ${lensWord} per 100k Residents`,
    `National average ≈ ${natl.toFixed(2)} ${lensWord.toLowerCase()} per 100k. Population from Census PEP 2023.`,
    "Reorders the country: big states sink, mountain & northeastern states rise.",
    "",
    "**Top 12 states per capita:**",
    ...top.map((r, i) => `${i + 1}. **${r.state}** (${r.name}) — ${r.profiles} ${lensWord.toLowerCase()} ÷ ${(r.population ?? 0).toLocaleString()} = **${(r.per_100k ?? 0).toFixed(2)}/100k**`),
  ].join("\n");
}

function plateVIII(d, lens) {
  if (!d?.points?.length) return `## Plate VIII — Colleges (${lens})\n(no data)`;
  const top = d.points.filter((p) => p.matched_profiles >= 2).slice(0, 10);
  return [
    `## Plate VIII — College Efficiency (${lens} matches per Athletic $M)`,
    `College programs ranked by matched ${lens} athletes ÷ athletic budget ($M). Filter: ≥ 2 matched ${lens} profiles.`,
    `Under the Paralympic lens this surfaces dedicated adaptive-athletics programs (Whitewater, Central Oklahoma, UCCS, Texas-Arlington, Illinois). Under the Olympic lens it surfaces sport-specific NCAA / NAIA / NJCAA pipelines.`,
    "",
    "**Top efficient programs:**",
    ...top.map((r, i) => `${i + 1}. **${r.name}** (${r.state}) — ${r.matched_profiles} ${lens} matches ÷ $${r.budget_m}M = **${r.ratio.toFixed(2)}/$M** (full mix O ${r.olympians} / P ${r.paralympians} / H ${r.hopefuls})`),
  ].join("\n");
}

function plateIX(rows, _meta = {}, lens) {
  if (!rows?.length) return `## Plate IX — NFHS Slot Density (${lens})\n(no data)`;
  const top = rows
    .filter((r) => (r.nfhs_participation_slots ?? r.nfhs) >= 5000)
    .slice(0, 12);
  return [
    `## Plate IX — ${lens} Athletes per NFHS Participation Slot`,
    `${lens} athletes per 1,000,000 NFHS participation slots in the state. Uses 2024-25 official NFHS state totals; participation slots are not unique students.`,
    lens === "Paralympic"
      ? "**Caveat:** the NFHS denominator is built around Olympic-pathway sports, so the Paralympic version of this chart is conceptually mismatched — most Paralympic disciplines have no high-school pipeline. Treat as directional only."
      : "",
    "",
    "**Highest density per NFHS slot:**",
    ...top.map((r, i) => `${i + 1}. **${r.state}** — ${r.profiles} ${lens.toLowerCase()} athletes ÷ ${(r.nfhs_participation_slots ?? r.nfhs).toLocaleString()} slots = **${r.per_million_hs.toFixed(0)}/M**`),
  ].filter(Boolean).join("\n");
}

function plateX(d, lens) {
  if (!d?.per_state) return `## Plate X — Era (${lens})\n(no data)`;
  const decades = d.decades.map((x) => x.label);
  const minTotal = lens === "Paralympic" ? 5 : 30;
  const ranked = Object.entries(d.per_state)
    .map(([st, counts]) => {
      const early = counts[0] + counts[1];
      const late = counts[3] + counts[4];
      const total = counts.reduce((a, b) => a + b, 0);
      const swing = (late + 1) / (early + 1);
      return { state: st, counts, total, swing };
    })
    .filter((r) => r.total >= minTotal)
    .sort((a, b) => b.swing - a.swing)
    .slice(0, 10);
  const scope = d.scope || {};
  return [
    `## Plate X — Era Presence (${lens})`,
    `${lens} athletes with parsed active years, counted in each overlapping decade (${decades.join(" / ")}). Sorted by late-vs-early swing: (2010s + 2020s + 1) / (1980s + 1990s + 1).`,
    scope.included_profiles_with_parsed_year != null
      ? `Scope: ${scope.included_profiles_with_parsed_year.toLocaleString()} ${lens.toLowerCase()} profiles included; ${(scope.excluded_no_parsed_year || 0).toLocaleString()} excluded with no parsed year.`
      : "",
    lens === "Paralympic"
      ? "**Caveat:** the Paralympic Games started in 1960 (Summer) / 1976 (Winter), and teamusa.com's Paralympic coverage skews to currently-active athletes — early decades are often empty or near-empty by roster artifact."
      : "Caveat: the Team USA roster skews to currently-active profiles, so this is not a complete historical census.",
    "",
    "**Biggest late-vs-early swing states:**",
    ...ranked.map((r) => `- **${r.state}** — counts ${r.counts.join("/")}, swing ×${r.swing.toFixed(1)}`),
    "",
    `National row: ${d.national.join(" / ")}`,
  ].filter(Boolean).join("\n");
}
