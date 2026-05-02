/*
 * plate_stories.js — long-form journalistic context for each plate.
 *
 * Rendered inside an expandable "Story" section on every plate panel.
 * Markdown is parsed by src/lib/markdown.jsx — keep it markdown-compatible.
 *
 * This is tuned for the 380px right column.
 */

export const STORIES = {
  ref: `
## A century of hometowns, in one map

The atlas draws on **5,201 athletes** with mappable hometowns from teamusa.com's published roster of 8,526 profiles. Coordinates come from the 2023 U.S. Census Gazetteer, with **346 hand-curated corrections** for the places the gazetteer misses — NYC outer-borough neighborhoods, Michigan charter townships, ski-resort place names, and entries where Team USA's city field already includes a state name, such as "Houston, Texas" with the state field set to TX.

The app bundle is name-stripped in keeping with NIL norms: first and last names stay out of the shipped data. It still keeps the geography and analytic fields needed for the atlas — sport, hometown coordinates, school where available, medal counts, athlete type, and era. That's enough to draw the country's Olympic geography in surprisingly sharp lines, as the next ten analytical plates show.

## Where to look next

The same map, read as a coverage grid, reveals gaps in this roster slice rather than a complete census of federation reach. Across the 12 sport families, **249 family-by-state cells have no geocoded athlete with a parsed active-era year** (since 1996). **Equestrian** is missing from 39 states; **Strength** from 37; **Gymnastics** from 33. Each empty cell is a recruiting question — a place where this dataset shows no recent hometown signal, and where a federation could ask whether the next athlete has a visible path in.
`,

  factories: `
## The smallest factories

> **Park City, UT**, population 8,254, has **42 Team USA athlete profiles** in the geocoded roster. About *one rostered athlete for every 200 people in town.* The national rate in this geocoded roster is roughly **0.16 per 10k**.

Park City hosted the 2002 Winter Olympics, and the infrastructure never left. The **Utah Olympic Park** sits about 25 miles east of Salt Lake City and contains one of only four sliding tracks in North America plus six Nordic ski jumps. Nearby, U.S. Ski & Snowboard's Center of Excellence keeps federation infrastructure in Park City, too. A Utah-linked athlete has [reached the Winter podium every Games since 2006](https://park-citystyle.com/the-olympic-legacy-of-park-city/), and at Beijing, roughly 40% of Team USA lived, trained, or went to school in Utah.

Park City isn't even the most extreme case. **Winthrop, WA** — population **578** — leads the table with five Team USA profiles: three in cross-country skiing and two in biathlon. The town anchors the Methow Valley, [over 200 km of nordic trails](https://www.adventuresnw.com/cross-country-skiing-nirvana-in-washingtons-methow-valley/), the largest such network in North America. The local high school's nordic team has more kids than football, both basketballs, and volleyball *combined.*

**Mapleton, MN** (pop. 1,649) appears for **curling** — a tradition going back to 1857, the year before Minnesota's statehood. The roster has four Mapleton curling profiles, and the town produced [John Landsteiner](https://www.mankatofreepress.com/news/golden-boy-landsteiner-brings-olympic-gold-back-to-mapleton/article_3fd52682-36c7-11e8-9bcc-6774d18fb220.html), who won America's first Olympic curling gold in 2018.

The pattern: small towns produce Team USA athletes when the *entire town organizes around a sport.* Park City's sport is every winter sport. Winthrop's is nordic. Mapleton's is curling. The list isn't really about geography — it's about culture density.

## Where to look next

Run the factory profile in reverse. **Eight of the 50 factory towns concentrate ≥80% of their Team USA profiles in a single sport**. Seven are under 5,000 residents; **Bemidji, MN** is the exception, with 12 of its 14 profiles in curling. Curling is the most-repeated motif, leading **seven of the 50 factories**. The analysis does not identify the next Mapleton on its own — it only shows the signature a scout could test against local club, school, and facility data: a small place whose civic sports culture points hard at one Olympic discipline.
`,

  concentration: `
## Where each sport actually lives

**100% of America's beach volleyball profiles in this roster come from California.** The Herfindahl index — economists' measure of monopoly — gives California beach volleyball a perfect **1.00**.

Southern California's South Bay is one of American beach volleyball's core training geographies. The [Manhattan Beach Open](https://avp.com/event/2026-manhattan-beach-open/) was established in 1960 and remains the sport's iconic domestic stop. At Marine Street alone, the AVP's beach guide counts [10–12 permanent courts](https://avp.com/news/breaking-down-the-beaches-of-southern-california/) where pros, ex-pros, and amateurs train side by side.

**Water polo** (HHI 0.84, 91% California) has the same explanation: year-round outdoor pools, a deep California/MPSF/NCAA pipeline, and weather that lets a kid swim at 4pm in February. **Badminton's** 85% California share runs through SoCal's large Asian-American community, where the sport has institutional depth most of the country lacks.

The data flips warmer further down:
- **Waterski/Wakeboard** — 75% Florida (Lake Hancock and Cypress Gardens built the modern sport)
- **Ski Mountaineering** — 64% Colorado
- **Nordic Combined** — 60% CO / 20% UT
- **Skateboarding** — 48% CA / 18% AZ / 14% FL — an arc along the warm-belt skate-park diaspora

The sports the rest of the country *does* spread more widely are the universal ones — basketball, soccer, track. The rest are local industries.

## Where to look next

The HHI cuts both ways. **High-HHI sports tell scouts which states already hold the pipeline. Low-HHI sports make absence easier to notice.** In **Diving** — a diffuse aquatic sport (HHI 0.085, 199 profiles across 27 states) — **Minnesota and Wisconsin have zero profiles in this roster** despite both sitting in the top 15 by overall output. Soccer has the same MN/WI hole. These are state-level white-space clues, not proof of absent infrastructure: places with population and broader athletic culture where this Team USA slice shows no hometown signal for a sport that is otherwise widely distributed.
`,

  halos: `
## Reach of the training centers

**618** Team USA profiles live within 200 miles of the **USA Volleyball Training Center in Anaheim** — more than any tracked facility geography. That is mostly Southern California density: **71** of those nearby profiles are in sports the facility directly serves. The program signal is narrower but still real. USA Volleyball's [National Team Development Program](https://usavolleyball.org/play/national-team-development-program/indoor-ntdp/) runs training series around the country, with Anaheim among the training locations for roughly the top 30–40 indoor athletes per birth year.

The story that's harder to argue away is **Lake Placid**. Only **283** profiles sit within 200 miles, in a sparsely-populated stretch of upstate New York where pure population can't explain the count; **106** are in sports the facility directly serves. What does explain it: the 1980 Games (Miracle on Ice, Eric Heiden's five golds) and the 1932 Games before that. New York created the [Olympic Regional Development Authority](https://lakeplacidlegacysites.com/history/) after the 1980 Games to keep those venues alive. The result, four decades later, is an Olympic Training Center that anchors an entire regional economy of bobsled, luge, biathlon, and figure skating.

The original USOPC training center, of course, is **Colorado Springs** — [built in 1978](https://krdo.com/olympic-city-usa/2024/02/14/why-the-usopc-moved-to-colorado-springs-in-the-late-70s/) on the former Ent Air Force Base. It won out over Baton Rouge through a $1/year lease, vast land, sunshine, and crucially **altitude**: 6,035 feet, the physiological stimulus endurance athletes traditionally seek. It now hosts roughly 15,000 athletes per year. The Colorado Springs halo is **267** profiles within 200 miles, with the co-located USA Swimming facility collapsed into the same geography.

## Where to look next

Invert the map. **2,375 Team USA profiles — 46% of the geocoded roster — live more than 500 km from the nearest tracked facility geography.** **Texas alone holds 306 of them**, and **Houston is the densest single far metro at 43 profiles**. That is a gap scan, not a siting model. A simple city-centered 200-mile candidate scan points first to Mid-Atlantic and Bay Area clusters before Houston; the recurring families are Aquatic, Team Ball, Other, Track & Field, and Combat. The next analytic step is sport-specific siting: which places have enough profiles in sports a facility can actually serve, not merely enough athletes nearby.
`,

  climate: `
## Climate × sport family

A single number tells the climate story: **55.2% of Team USA Winter profiles come from the Continental state-level climate zone.** Add the separate Cold zone and the winter-family skew rises to **77.7%**. No other family is this climate-skewed.

The opposite edge is **Equestrian**, which peaks in Hot Humid at **12 of 37 profiles**. Six of those are Wellington, Florida hometowns. The sample is small, but the signal points at a real ecosystem: [Wellington International](https://www.wellingtoninternational.com/) hosts the Winter Equestrian Festival, the Adequan Global Dressage Festival, draws participants from all 50 states and 34+ countries, and advertises more than **$16 million** in prize money. The sport follows infrastructure and money as much as weather.

The middle of the matrix is more nuanced:
- **Aquatic** sports peak in Continental at **33.0%**, but their warm-zone cells all sit above expectation: Warm Humid, Hot Humid, Mild, and Subtropical are each positive residuals.
- **Track & Field** is genuinely diffuse, peaking Continental at only **36.0%**, with its strongest positive residual in Warm Humid.
- **Racket sports** peak in Mild at **40.0%**, pulled toward California and the West Coast racket-sport infrastructure.

The diagonal exists, but the *columns* tell you something more interesting: some sport families have escaped climate through infrastructure — indoor pools, dressage rings, climate-controlled gyms, and college programs — anywhere a metro can afford them.

## Where to look next

The counter-climate cells are leads, not funding orders. Standardized residuals against an independence baseline now ship in the analytics JSON: **Winter in Cold (+14.7)**, **Endurance in Cold (+13.3)**, **Winter in Continental (+8.6)**, **Team Ball in Mild (+5.6)**, **Equestrian in Hot Humid (+4.1)**, **Racket in Mild (+4.0)**, and **Track & Field in Warm Humid (+3.0)** are the cells punching above the roster-wide climate mix. The next step is to test those cells against training sites, participation data, school and club density, and cost before treating them as investment targets.
`,

  distance: `
## Closer to the right facility, more medals?

The corrected version asks a narrower question: among **Olympic and Paralympic profiles only**, how far is each hometown from the nearest tracked facility geography that actually lists the athlete's sport?

That leaves **2,306 profiles** in the distance analysis. It excludes **2,213 Hopeful profiles** and **682 Olympic/Paralympic profiles** whose sport is not represented in the tracked facility roster. That boundary matters: basketball, table tennis, curling, sailing, softball, triathlon, and equestrian are not fully answerable from this facility list.

Once the distance is sport-serving rather than "nearest anything," the old proximity story mostly disappears. The all-family medalist rate is **35.7%** within 25 miles, **37.9%** in the 100-200 mile bucket, and **47.9%** beyond 800 miles. Farther hometowns do not underperform.

The family premiums are mixed and small. **Precision** is the clearest positive at **+7.6 percentage points**; **Other** sits at **+6.0**, while **Team Ball** and **Combat** are nearly flat at **+1.4** and **+1.0**. The former headline examples move the other way: **Aquatic is −1.8** and **Winter is −5.9**.

The honest reading is humbler: hometown distance to a tracked sport-serving facility is not a strong medalist separator in this roster. It may still matter for individual sports, but this plate cannot prove facility use, training residence, or a causal medal effect.

## Where to look next

The next analysis should join where athletes **trained**, not only where they were from: club locations, college programs, national-team camps, residency histories, and era. For facility planning, the right question is marginal coverage by candidate site and sport, validated against participation and pipeline data.
`,

  paralympic: `
## Paralympic geography is its own map

This plate now compares **Olympic and Paralympic profiles only**, excluding Hopefuls from the denominator. On that cleaner denominator, the national Paralympic share is **21.9%**. Among states with at least 10 included profiles, **Oklahoma** leads at **47%**, followed by **Kansas** at **44%**, **Nebraska** at **43%**, and **Iowa** at **39%**. Smaller denominators still swing hard: New Mexico is **5 of 8** and West Virginia is **2 of 3**, so they sit below the display threshold.

The military and VA hypothesis is still worth testing, but this plate does **not** measure it directly. The roster has hometown state and profile type; it does not contain veteran status, VA program participation, military-base distance, or VA-hospital distance.

Iowa is useful context, not proof. VA News describes the [National Disabled Veterans Golf Clinic](https://news.va.gov/108393/disabled-veterans-golf-clinic-underway-iowa/) as a VA/DAV week-long adaptive golf program in the Iowa City area, with other adaptive activities including air rifle, bicycling, bowling, and kayaking. VA also runs a [Monthly Training Allowance](https://department.va.gov/veteran-sports/training-allowance/) for eligible veteran athletes training in Paralympic or Olympic sports. Those are plausible pipeline assets; the roster does not show whether Iowa's seven Paralympic profiles came through them.

The deeper observation is narrower but stronger: **Paralympic-state geography is not simply the Olympic-state geography.** Colorado, Washington, North Carolina, Oklahoma, Kansas, Nebraska, and Iowa all sit well above the national Paralympic share on the corrected denominator. Why they do is a follow-up question, not something this ratio alone proves.

## Where to look next

California is the diagnostic flag: it has the largest absolute Paralympic count in the roster (**71 profiles**) but the lowest share among states with at least 100 Olympic+Paralympic profiles (**13.7%**, versus the **21.9%** national baseline). At the national share, California would have about **114** Paralympic profiles, a gap of roughly **43**. That is not yet a recruitment prescription. The next step is to join veteran population, VA and adaptive-sport program locations, sport participation, classification pathways, and travel access before recommending where to build or replicate funnel infrastructure.
`,

  colleges: `
## Team USA profiles per athletic dollar

**Colorado Mountain College** — total athletic budget about **$1.5 million** — has **7 matched Team USA profiles** in the cleaned education-string match. That's **4.7 profiles per million dollars**, narrowly ahead of **Westminster College** at **4.2** and **Salt Lake Community College** at **3.3**.

The pattern is not NCAA prestige; it is pipeline fit. Westminster's official [U.S. Ski & Snowboard college partnership](https://www.usskiandsnowboard.org/news/westminster-university-re-launches-partnership-us-ski-snowboard) gives national-team athletes a tiered tuition-discount model, flexible degree timelines, online coursework, advising support, and proximity to Park City training facilities. The plate does not prove who paid for training or how much of the athletic budget served those athletes.

Down the list, the type mix matters:
- **Wisconsin-Whitewater** — $5M budget, **15 matched profiles** (**0 Olympic, 14 Paralympic, 1 Hopeful**), much of it through adaptive-sport pipelines.
- **Central Oklahoma** — $10M budget, **10 matched profiles** (**0 Olympic, 9 Paralympic, 1 Hopeful**), another adaptive-sport-heavy signal.
- **Minnesota Duluth** and **Bemidji State** — 12 and 10 matched profiles, respectively, each anchoring a sport-specific scene.

Compare to the Ivies. **Princeton** ($42M, **40 profiles**, **0.95/$M**) and **Harvard** ($50M, **40**, **0.80/$M**) are nationally extraordinary, but on a per-dollar basis trail the mountain-sport and adaptive-sport schools. **The ranking is about how aligned a school's budget is with a specific Team USA pipeline, not about a verified Olympic-only alumni ledger.**

## Where to look next

Filter the same scatter for small budgets with real output and the next shortlist is concrete: **Wisconsin-Whitewater, University of Colorado Colorado Springs, Minnesota Duluth, Central Oklahoma, Bemidji State, Northern Michigan, Marian, Ashland, Clarkson, Queens Charlotte, and Tennessee State** all run ≤$15M athletic budgets with at least four matched Team USA profiles. Each is a candidate for a sport-specific federation partnership, but the multi-school matcher should still be treated as a lead list rather than a hand-audited alumni ledger.
`,

  per_capita: `
## Team USA profiles per 100k residents

Reorder the country by population-normalized output and the map reshuffles violently:

| Rank | State | Per 100k |
|---|---|---|
| 1 | **Vermont** | 6.80 |
| 2 | Alaska | 5.73 |
| 3 | Colorado | 4.49 |
| 4 | Minnesota | 3.99 |
| 5 | Hawaii | 3.62 |

The national average is **1.55 matched Team USA profiles per 100k residents**. Vermont is more than **4×** that all-profile national rate. The numerator includes Olympic, Paralympic, and Hopeful profiles; the bar split shows that mix.

[Vermont's outsized output](https://skivermont.com/vermonts-olympic-success) is not only about snow — every northern state has snow. It is about *how Vermont organizes around winter*. The state hosts **Burke Mountain Academy**, the [first ski academy of its kind in the United States](https://www.burkemtnacademy.org/about/history). Burke's current quick facts list **37 alumni Olympians** and **154 alumni named to national ski teams** since 1970, with Mikaela Shiffrin among the school's Olympic alumni. Vermont also ranked second nationally in 2023 formal volunteering, at about **40.5%** of residents; that is civic context, not proof of a specific coaching channel.

Alaska's pipeline is thinner but just as cultural. The [Nordic Skiing Association of Anchorage](https://anchoragenordicski.com/programs/junior-nordic/) runs Junior Nordic for kids 6–14 of all abilities. **Kincaid Park** — 60 km of trails through 1,400 acres — is the operational base for a winter-sports ecosystem that punches at Norwegian density.

California, which dominates raw counts, falls to **8th place at 2.47/100k.**

## Where to look next

Per capita can also be read as a rough residual map. The generated metadata groups states by state-level climate zone and compares each state's profile rate with the unweighted mean of its climate peers. On that screen, **West Virginia produces 0.23 profiles per 100k — 1.38 below the Continental-zone mean**. Among states with at least 1 million residents, the next largest negative residuals are **Maine, New Hampshire, Montana, and Iowa**. This is a gap scan for follow-up research, not a forecast of how many athletes a program can create.
`,

  hs_conversion: `
## Team USA profiles per NFHS slot

This metric divides matched Team USA profiles by the official **2024-25 NFHS state totals**. NFHS counts participation slots, not unique students, so this is a normalized density measure rather than a longitudinal athlete-development rate.

| Rank | State | Profiles per Million NFHS Slots |
|---|---|---:|
| 1 | **Vermont** | 4,381 |
| 2 | **Alaska** | 2,273 |
| 3 | Colorado | 1,794 |
| 4 | Hawaii | 1,410 |
| 5 | Nevada | 1,140 |

Vermont now sits at **44 profiles over 10,043 official NFHS slots**, a very small denominator attached to a very winter-specific profile mix: 26 Olympic, 3 Paralympic, and 15 Hopeful profiles. Alaska follows at **42 profiles over 18,475 slots**. Colorado is the larger-scale version: **264 profiles over 147,139 slots**.

Those examples are useful leads, not proof that high-school programs created the athletes. The numerator is a cumulative Team USA profile stock; the denominator is one recent year of NFHS participation slots.

The opposite end is also a lead list. Among states with at least **200,000 official NFHS slots**, the lowest profile densities are **Texas (349/M), Ohio (438/M), Michigan (446/M), North Carolina (487/M), New Jersey (507/M), and Georgia (535/M)**. Florida is not low under the official denominator; it sits at **940/M**.

## Where to look next

The generated metadata compares large states with the large-state median rate of **612 profiles per million NFHS slots**. On that benchmark, Texas is **231 profiles below the median-rate benchmark**, followed by Ohio (59), Michigan (50), New Jersey (30), North Carolina (26), and Georgia (16). Treat those as places to investigate next, not as proof of athlete supply or an intervention forecast.
`,

  era: `
## How roster presence changed

The decade-by-decade table includes only geocoded Team USA profiles with a parsed active-era year: **2,780 profiles included**, while **2,421 geocoded profiles have no parsed year and are excluded**. A profile is counted in every decade overlapping its parsed first/last active years.

The national row **52 → 89 → 368 → 1,298 → 1,716** mostly reflects the current-profile bias in teamusa.com, not a complete historical census of who competed in each decade.

What *is* useful is the **swing column** as a within-roster comparison: **(2010s + 2020s + 1) / (1980s + 1990s + 1)**.

Topping the swing rankings: **Michigan ×99**, **Colorado ×68**, **Massachusetts ×46**, **Missouri ×44**, **Pennsylvania ×40**, **Utah ×39**, **Vermont ×36**.

That top tier is not a simple Sun Belt story. It mixes **Midwest/Northeast legacy states** (Michigan, Massachusetts, Missouri, Pennsylvania, Vermont) with **mountain-state winter profiles** (Colorado, Utah, Vermont, Alaska). Texas, Arizona, and North Carolina do reach the top 15, but they do not define the top of the table.

The table does **not** prove migration, training residence, or infrastructure causality. It only says that, inside this current Team USA profile bundle, late-era roster presence is much higher than early-era roster presence for those states.

No qualified state's smoothed swing falls below 1.0, but that should be read through the roster's modern skew and sparse early-decade counts. In this roster slice, modern state-decade coverage is broader; it is not proof that no state declined in the historical record.

## Where to look next

The next version should compare this current-profile slice with a complete historical Olympic/Paralympic roster, then separate hometown, training residence, college, and club histories. That is the level needed to talk about migration or infrastructure rather than profile-era presence.
`,
};
