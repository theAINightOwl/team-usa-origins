/*
 * plate_stories.js — long-form journalistic context for each plate.
 *
 * Rendered inside an expandable "Story" section on every plate panel.
 * Markdown is parsed by src/lib/markdown.jsx — keep it markdown-compatible.
 *
 * This is tuned for the 380px right column.
 *
 * Toggle-aware plates have BOTH `<key>_olympic` and `<key>_paralympic`
 * versions. PlateStory looks up the lens-specific key first and falls
 * back to the plain key. Plate I (`ref`) and XI (`you`) ignore the toggle.
 */

export const STORIES = {
  ref: `
## A century of hometowns, in one map

The atlas draws on **5,201 athletes** with mappable hometowns from teamusa.com's published roster of 8,526 profiles. Coordinates come from the 2023 U.S. Census Gazetteer, with **346 hand-curated corrections** for the places the gazetteer misses — NYC outer-borough neighborhoods, Michigan charter townships, ski-resort place names, and entries where Team USA's city field already includes a state name, such as "Houston, Texas" with the state field set to TX.

The app bundle is name-stripped in keeping with NIL norms: first and last names stay out of the shipped data. It still keeps the geography and analytic fields needed for the atlas — sport, hometown coordinates, school where available, medal counts, athlete type, and era. That's enough to draw the country's Olympic and Paralympic geography in surprisingly sharp lines, as the next ten analytical plates show.

Use the **Olympic / Paralympic lens toggle** at the top of the right column to flip every chart and story between the two audiences. Most plates tell a noticeably different story under each lens — the Paralympic geography is its own map, not a smaller copy of the Olympic one.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate II — Tiny towns, big rosters
   * ───────────────────────────────────────────────────────────────── */
  factories_olympic: `
## Tiny towns, big Olympic rosters

**Winthrop, Washington** — population **578** — has three Olympians in this roster, all winter-endurance: two cross-country skiers and one biathlete. That works out to about **52 Olympians per 10,000 residents**, more than any other town in the Olympic-lens table. For comparison, the national rate among Olympians is roughly **0.07 per 10k** — Winthrop is hundreds of times that.

Winthrop anchors the Methow Valley, where the [200+ km nordic trail network](https://www.adventuresnw.com/cross-country-skiing-nirvana-in-washingtons-methow-valley/) is the largest in North America, and the local high school's nordic team has more kids than football, basketball, and volleyball *combined.* That's the pattern at the top of the Olympic list: tiny towns lead per-capita not because they produce all-around athletes, but because **one sport saturates the place.**

**Park City, Utah** (pop. **8,254**) is the same pattern at scale. **28 Olympians** — about one for every 295 residents — almost all in winter sports, with Freestyle Skiing the most common. Park City hosted the 2002 Winter Olympics and the infrastructure stayed: the Utah Olympic Park has one of only four sliding tracks in North America and six Nordic ski jumps, and U.S. Ski & Snowboard's Center of Excellence sits in town.

**Lake Placid, New York** (pop. **2,275**) shows the East Coast version — **8 Olympians**, top sport Luge, anchored by the legacy of the 1932 and 1980 Winter Games and the New York Olympic Regional Development Authority that kept those venues alive.

The Olympic-lens table is overwhelmingly winter: **27 of the top 50 factory towns have a Winter sport as their top discipline.** It's less about geography than about **culture density** — places where one Olympic sport is the thing kids actually do.

## Where to look next

Read the same list and ask which towns are most narrowly specialized in a single sport. **Sixteen of the 50 Olympic factory towns get at least 80% of their Olympians from one sport** — and most are under 5,000 residents. Curling, Freestyle Skiing, Cross-Country Skiing, and Luge are the most-repeated motifs.

For scouts and federations, the recipe is portable: look for small communities sitting on top of dedicated infrastructure for a single Olympic discipline — a 200km nordic trail network, a curling club going back generations, a ski-jumping hill the town built itself. The next Mapleton or Winthrop is more likely to be discovered by walking into one of those settings than by combing through a national talent database.
`,

  factories_paralympic: `
## Tiny towns, big Paralympic rosters

The Paralympic-lens table is anchored by a single institution: the **National Sports Center for the Disabled** at Winter Park Resort, Colorado.

**Winter Park, Colorado** — population **1,149** — has **four Paralympians** in this roster, all in Para Alpine Skiing. That's about **35 Paralympians per 10,000 residents**, the highest rate in any town we tracked, and roughly 175× the national Paralympic rate (~0.20 per 100k). The NSCD has been the Paralympic Alpine team's residency program for decades; athletes who compete at the Games have often spent years living and training in this small mountain town.

**Sun Valley, Idaho** (pop. **1,771**) is the same story for nordic: 2 Para Nordic Skiers from a tiny mountain population. **Granby, Frisco, Silverthorne**, and **Park City UT** round out the top of the table — all small mountain towns adjacent to dedicated Paralympic Alpine or Snowboard residency programs.

But the Paralympic factory pattern isn't only winter. **Gig Harbor, Washington** (pop. **12,604**) appears for Wheelchair Basketball; **Crystal Lake, IL** for Para Judo; **Salem, MA** for Para Swimming. The per-capita rates are smaller (these are bigger towns), but the signature is the same: a town with a single visible adaptive-sport club or program that funnels athletes into one Paralympic discipline.

The dominant top family across the 50 Paralympic factory towns is actually **Team Ball** (14 of 50, mostly Wheelchair Basketball), followed by Winter (10), Other (9, mostly Para Athletics and Para Swimming), and Aquatic (8). The Paralympic version of "culture density" runs through specific clubs and adaptive-sport organizations, not through the broader civic infrastructure that produces Olympic skiers and curlers.

## Where to look next

For Paralympic scouting, the actionable signature is different from Olympic factories: instead of looking for towns with deep civic sports culture, look for towns that host a **specific adaptive-sport residency program or anchor club** — Move United chapters, BlazeSports affiliates, university-based wheelchair basketball or wheelchair rugby programs, VA-linked adaptive sport facilities.

Only 5 of the top 50 Paralympic factory towns concentrate ≥80% of their athletes in a single sport, compared to 16 of 50 on the Olympic side — Paralympic athletes scatter across more disciplines per town. That makes the **anchor-program pattern** more useful than per-capita counting for finding the next Winter Park or Gig Harbor.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate III — Where each sport lives
   * ───────────────────────────────────────────────────────────────── */
  concentration_olympic: `
## Where each Olympic sport lives

**Every one of America's 7 beach volleyball Olympians in this roster comes from California.** It's a small sample, but it tells you something blunt about the sport: in this dataset, beach volleyball is, geographically, a California-only Olympic sport.

Southern California's South Bay is the center of gravity. The [Manhattan Beach Open](https://avp.com/event/2026-manhattan-beach-open/), established in 1960, is still the iconic domestic stop, and Marine Street alone has [10–12 permanent courts](https://avp.com/news/breaking-down-the-beaches-of-southern-california/) where pros, ex-pros, and amateurs share the sand.

Beach volleyball is the extreme, but most Olympic sports turn out to live in just one or two states. A few more **California stories** sit near the top of the chart:

- **Water Polo** — 92% California (43 of 47 Olympians). Year-round outdoor pools and the California/MPSF/NCAA college pipeline let kids swim at 4pm in February.
- **Badminton** — 86% California. Institutional depth in SoCal's Asian-American community that the sport doesn't have anywhere else.

Step away from California and the same one-state pattern shows up around different hubs:

- **Waterski / Wakeboard** — 75% Florida (Lake Hancock and Cypress Gardens built the modern sport)
- **Ski Mountaineering** — 64% Colorado
- **Nordic Combined** — 60% Colorado, 20% Utah
- **Skateboarding** — 48% California, 19% Arizona, 15% Florida — a Sun Belt skate-park spread

The Olympic sports that *do* spread widely are the universal ones — track and field, basketball, and swimming all score in the **0.05–0.06** range, meaning their Olympic hometowns are scattered roughly evenly across the country. The rest are local industries.

## Where to look next

The chart reads two ways. **A high score shows scouts which states already hold the Olympic pipeline. A low score makes absence easier to notice** — when a sport should be everywhere, the empty states stand out.

**Diving** is one of those genuinely spread-out sports: 199 Olympians across 27 states, with no single state holding more than 18%. And yet **Minnesota and Wisconsin have zero Olympic divers in this roster** — both states sit in the top 15 nationally for overall Team USA output. **Soccer** has the same hole.

Treat those as state-level white-space clues, not proof of missing infrastructure. They flag places with population and broader athletic culture where this Olympic slice shows no hometown signal for a sport that's otherwise spread across the country.
`,

  concentration_paralympic: `
## Where each Paralympic sport lives

Paralympic sport concentration looks very different from the Olympic version. The most "concentrated" Paralympic discipline — **Wheelchair Curling, with 50% of its 12 athletes in Wisconsin** — scores just **0.29** on the concentration scale. Beach Volleyball, the Olympic leader at **1.00**, has no Paralympic equivalent. **Paralympic sports are noticeably less geographically concentrated than Olympic sports.**

That isn't an accident. Paralympic disciplines depend on **classification pathways, adaptive-sport clubs, and federation-led residency programs** rather than the school / college / climate funnels that make Olympic sports cluster around a state. A talented Paralympic prospect in Tennessee can reach the national team through the same VA programs and Move United chapters as a prospect in California.

A few of the most concentrated Paralympic sports tell the rest of the story:

- **Wheelchair Curling** — 50% Wisconsin, anchored by the deep curling culture in northern Wisconsin and Minnesota that already shows up in the Olympic Curling chart.
- **Para Powerlifting** — 40% Florida (n=5, small sample).
- **Para Judo** — 29% California (n=7), with the rest spread across CO, IL.
- **Para Shooting** — 18% each in Texas, Colorado, and California.
- **Wheelchair Fencing** — 20% each in Ohio and Utah, the rest scattered.

The biggest single Paralympic state cluster is Colorado for **Para Alpine Skiing** and **Para Nordic Skiing** — those don't appear at the top of this chart because they're spread across two sports, but the Plate II factory list captures them clearly through Winter Park, Granby, and Frisco.

## Where to look next

For Paralympic scouting, the concentration chart is less of a recruiting map than the Olympic version because nothing approaches single-state dominance. The **actionable read is the opposite direction**: which Paralympic sports have the broadest geographic reach, and what does the empty-cell pattern look like?

Most Paralympic sports show concentration scores under **0.20**, meaning national-team athletes come from many states. That's good news for federation reach but also a signal that **classification, club-pathway, and travel-cost barriers may be the binding constraint**, not geographic scarcity. The next analytical question is whether the dispersed Paralympic athlete map matches the actual geography of disability and adaptive-sport infrastructure — or whether some states are systematically under-converting.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate IV — Reach of the training centers
   * ───────────────────────────────────────────────────────────────── */
  halos_olympic: `
## Reach of the training centers (Olympic)

Every training center on the map has two numbers worth comparing under the Olympic lens: **how many Olympians live nearby**, and how many of those nearby Olympians do **a sport the center actually trains**. The first is mostly a measure of regional population. The second tells you whether the center is doing real work for Olympic athletes around it — and the two numbers tell very different stories.

Start with the biggest raw number. **290 Olympians live within 200 miles of the USA Volleyball Training Center in Anaheim**, more than any other tracked center on the map for the Olympic lens. But that's mostly Southern California density: only **37 of those 290** are in a sport the center actually trains. USA Volleyball's [National Team Development Program](https://usavolleyball.org/play/national-team-development-program/indoor-ntdp/) uses Anaheim as one location among many for roughly the top 30–40 indoor athletes per birth year.

**Lake Placid** flips that ratio. Only **155 Olympians** live within 200 miles, in a sparsely populated stretch of upstate New York where population alone can't explain the count. But **77 of those 155** — the highest sport-served Olympic count of any tracked center — train in disciplines this site is specifically built for. What put those Olympians there is **history**: the **1980 Winter Games** (Miracle on Ice, Eric Heiden's five golds) and the **1932 Games** before that.

**Colorado Springs**, the original USOPC training center [built in 1978](https://krdo.com/olympic-city-usa/2024/02/14/why-the-usopc-moved-to-colorado-springs-in-the-late-70s/) on the former Ent Air Force Base, anchors the system at altitude (6,035 feet). Roughly 15,000 athletes pass through annually, and the co-located USA Swimming National Training Center is folded into the same geography on this map.

## Where to look next

Most of the country isn't near a USOPC center. About **half of the Olympians in this roster live more than 300 miles from any tracked training site.** Texas alone holds a large share, with **Houston the biggest single distant metro.**

That's the gap. It is **not** an automatic recommendation to drop a new center in Houston — Houston's distant Olympians are spread across many different sports, and a multi-sport campus only pays off when enough nearby athletes do sports that campus can actually train.

The cheaper, more practical move is a **single-sport satellite**: find a city with a real concentration of one discipline — enough swimmers, wrestlers, or gymnasts to anchor a focused facility — and build for that one sport. It lines up with how Olympic athletes already cluster, instead of chasing raw headcount.
`,

  halos_paralympic: `
## Reach of the training centers (Paralympic)

Looking at the same training-center map under the Paralympic lens reveals something stark: **the existing Olympic infrastructure barely serves the Paralympic athlete pool.**

The biggest Paralympic halo (athletes within 200 miles) belongs to the **Pettit National Ice Center in Milwaukee, with 58 nearby Paralympians** — but **zero of them are in a sport this site trains.** That gap is the headline. Pettit is a long-track speed-skating facility; almost no Paralympians compete in long-track speed skating in this roster. Geographic proximity is real; functional service is zero.

The Paralympic sport-served counts elsewhere are similarly small:

- **Chula Vista** — 41 Paralympians within 200 miles, **22 sport-served** (the highest Paralympic sport-served count, driven by Para Track & Field).
- **Colorado Springs** — 53 nearby, **14 sport-served**, with Para Cycling and a few other USOPC-supported disciplines.
- **Lake Placid** — 37 nearby, **6 sport-served** (sled hockey, Para Nordic).
- **Anaheim Volleyball** — 43 nearby, **1 sport-served**.

**The tracked OPTC and federation-facility roster was built around Olympic disciplines.** Paralympic residency programs — Winter Park / NSCD for Para Alpine, Bridger Bowl and other adaptive-sport ecosystems for Para Nordic, BlazeSports / Move United chapters for adaptive ball sports — don't appear in this roster. That's why the Paralympic halo numbers look so empty.

## Where to look next

For the USOPC and the national federations, this plate makes a concrete case: **the existing tracked-facility map is not the Paralympic talent infrastructure.** Most of the Paralympic athletes who reach elite competition do so through programs that aren't on this map.

The actionable extension of this atlas is to **map the adaptive-sport infrastructure separately** — university wheelchair basketball programs, Move United chapters, VA adaptive-sport facilities, NSCD-style residency centers — and use that as the basis for Paralympic siting and scouting decisions, rather than the Olympic-built OPTC roster. A Paralympic athlete near Pettit Ice Center may grow up far from the right facility for their sport even when the dot on the map looks close.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate V — How far from a training center
   * ───────────────────────────────────────────────────────────────── */
  distance_olympic: `
## How far from a training center? (Olympic)

For each of the **1,834 Olympic athletes** in this lens whose sport is represented in the tracked facility roster, we measured how far their hometown is from the nearest training site that actually trains their sport. The result is striking: **most Olympians grew up nowhere near any tracked center.**

Across all sport families combined, only about **14% lived within 200 miles** of a sport-serving training site, **22% lived 200–800 miles away**, and roughly **64% lived more than 800 miles away.** The existing training-center geography is largely decoupled from where U.S. Olympic talent actually grows up.

Two families break the pattern. **Endurance** (about 28% within 200 miles) is anchored by clusters around Lake Placid (biathlon) and Park City (cross-country / nordic combined). **Winter** also leans regional — about 21% within 200 miles, 53% in the 200–800 band. For everyone else — Aquatic, Combat, Gymnastics, Track & Field, Racket — the close-and-mid-distance shares are small and the >800 share dominates.

This doesn't mean the centers don't matter. Olympic athletes move to train, and elite competition happens at the centers regardless of where they started. What it means is that the existing training-center map is **not** the pipeline that produces most U.S. Olympic athletes — the pipeline runs through clubs, schools, and college programs scattered across the country.

(Note on scope: this analysis is restricted to the Olympic athletes whose sport is represented in the tracked facility roster. Sports like basketball, table tennis, sailing, softball, triathlon, and equestrian don't have a tracked facility and are excluded.)

## Where to look next

This plate flips the usual assumption that "more centers near more athletes = more Olympians." **Roughly two-thirds of the Olympians in this roster grew up more than 800 miles from any sport-serving training center.**

For the USOPC and the national federations, the actionable lever may not be **building** more centers but **strengthening the distributed pipeline** that's already producing: fund club partnerships, deepen college relationships, and recruit in the regions where future Olympians already live. The center comes later, after an athlete is already on a path. For scouts, the practical move is to look in the home community, not from the center.
`,

  distance_paralympic: `
## How far from a training center? (Paralympic)

For the **472 Paralympic athletes** in this lens whose sport is represented in the tracked facility roster, the same question shows a similar but slightly different pattern: **most Paralympians also grew up far from the tracked centers, but the distance distribution is more compact, especially for Endurance and Winter.**

Across all families combined under the Paralympic lens, roughly **11% lived within 200 miles** of a sport-serving training site, **19% lived 200–800 miles away**, and about **70% lived more than 800 miles away.** That's broadly similar to the Olympic numbers but with a larger far-from-center share, partly because the tracked facility roster is poorly matched to Paralympic disciplines (Plate IV).

The pattern-breaking families:

- **Endurance** (n=59) — **15%** within 200, **63%** mid-distance, only **22%** far. Driven by Para Nordic and Para Cycling clustering around Park City, Bridger Bowl, and the Colorado Front Range.
- **Winter** (n=90) — **13%** within 200, **36%** mid-distance, **51%** far. Less anchored than Olympic Winter because Para Alpine residency at Winter Park (Plate II) sits between the close and mid bands.
- **Combat** (n=15) — small sample, but **20%** within 200 (mostly LA-area Para Judo and Para Taekwondo).

For all other families — Aquatic, Other (mostly Para Athletics), Team Ball — over **70%** of Paralympic athletes grew up more than 800 miles from any tracked sport-serving facility.

## Where to look next

The training-center roster wasn't built around Paralympic geography, and the distance numbers reflect that. **Roughly 7 in 10 Paralympic athletes grew up more than 800 miles from any tracked sport-serving center**, and the close-band share is smaller than for Olympic athletes.

For Paralympic recruiting, the practical takeaway is the same as the Olympic version, with one extra wrinkle: **don't filter Paralympic prospects by training-center proximity at all.** The most useful next analysis is to map adaptive-sport clubs, university programs (Whitewater, Central Oklahoma, UCCS), VA adaptive facilities, and Move United chapters — then ask the distance question against *that* layer. Most of the Paralympic pipeline doesn't run through the OPTC map at all.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate VI — Climate × sport family
   * ───────────────────────────────────────────────────────────────── */
  climate_olympic: `
## Climate × Olympic sport family

Climate sets the floor for some Olympic sport families; infrastructure overrides it for others. **Winter does what you'd expect** — about 78% of Olympic Winter profiles come from Cold or Continental states. But **Equestrian peaks in Hot Humid** — a sport that followed money and a year-round venue (Wellington, Florida), not the weather.

For the rest of the Olympic matrix:

- **Aquatic** sports peak in Continental but their warm-zone cells (Hot Humid, Mild, Subtropical) all sit above expectation, reflecting the year-round outdoor pool culture in California, Florida, and Texas.
- **Track & Field** is the most diffuse Olympic family — peaks in Continental at only ~36%, with strong positives in Warm Humid.
- **Racket** sports peak in Mild at ~40%, pulled toward California and the West Coast racket-sport infrastructure.
- **Team Ball** peaks in Mild — a California-and-warm-South pattern driven by water polo, beach volleyball, and softball.

The columns are the most interesting part: some Olympic sport families have escaped climate through infrastructure — indoor pools, dressage rings, climate-controlled gyms, and college programs — anywhere a metro can afford them.

## Where to look next

For Olympic federations cultivating a sport in a non-traditional climate, **Wellington is the playbook**: concentrate prize money, venues, and the calendar in one place, and climate stops mattering. The **counter-climate cells** — Equestrian in Hot Humid, Racket in Mild, Team Ball in Mild — are where to scout beyond the obvious geography. They're rarer, harder to find, and disproportionately driven by one or two anchor institutions that can be visited in person.

For scouts, the diagonal of this matrix already tells you where the obvious Olympic pipeline runs. The off-diagonal cells with surprising volume are the leads worth chasing.
`,

  climate_paralympic: `
## Climate × Paralympic sport family

The Paralympic climate matrix is similar in shape to the Olympic version but more concentrated. **Continental climate dominates almost every Paralympic family** because Paralympic athlete hometowns lean heavily on Northeast and upper Midwest geography — the historic strongholds of adaptive-sport organization in the United States.

Notable cells:

- **Winter** — 59% Continental, 11% Cold. Winter Park CO, Park City UT, and the legacy Northeast adaptive-ski programs sit in those zones.
- **Endurance** — 44% Continental, 26% Mild. The Mild share is bigger here than in the Olympic version, reflecting California-based Para Cycling and Para Triathlon clusters.
- **Aquatic** — 42% Continental, 16% Mild, 12% Hot Humid. Para Swimming clusters around college programs in the Midwest, Southeast, and California.
- **Equestrian** — 71% Continental (n=7, very small sample). Para-Equestrian's geography looks different from Olympic Equestrian's Wellington-FL cluster — concentrated in Pennsylvania and the broader Northeast adaptive-equestrian community.
- **Strength** (Para Powerlifting, n=5) — 60% Hot Dry, all from a tiny sample dominated by Florida.

The Paralympic-Equestrian / Olympic-Equestrian contrast is the most striking finding in this matrix: Olympic Equestrian travels south to Wellington's prize money and year-round venue, while Para-Equestrian remains anchored where adaptive-equestrian programs originated — Pennsylvania, Michigan, Massachusetts.

## Where to look next

For Paralympic federations, the climate matrix points at the same insight as Plate IV: **the existing Paralympic geography is rooted in where adaptive-sport programs were historically founded**, not where the climate or population would predict they should be. That's a planning opportunity. Para sports that don't depend on outdoor weather (Wheelchair Basketball, Wheelchair Rugby, Goalball, Para Powerlifting, Para Judo) could in principle be cultivated anywhere — and the chart shows they're disproportionately Continental-cluster today, which is more about institutional history than logistics.

The actionable read is to identify states where the climate is permissive but the Paralympic numbers are low, then ask why no adaptive-sport organization has taken root.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate VII — Profiles per 100k residents (merged)
   * ───────────────────────────────────────────────────────────────── */
  per_capita_olympic: `
## Olympians per 100k residents

Reorder the country by population-normalized Olympic output and the map reshuffles violently:

| Rank | State | Olympians per 100k |
|---|---|---|
| 1 | **Vermont** | 4.02 |
| 2 | Alaska | 2.86 |
| 3 | Colorado | 2.21 |
| 4 | Utah | 1.67 |
| 5 | Minnesota | 1.59 |

The national average is roughly **0.70 Olympians per 100k residents**. Vermont is more than **5×** that.

[Vermont's outsized output](https://skivermont.com/vermonts-olympic-success) is not only about snow — every northern state has snow. It is about *how Vermont organizes around winter*. The state hosts **Burke Mountain Academy**, the [first ski academy of its kind in the United States](https://www.burkemtnacademy.org/about/history). Burke's quick facts list **37 alumni Olympians** and **154 alumni named to national ski teams** since 1970, with Mikaela Shiffrin among the school's Olympic alumni.

Alaska's pipeline is thinner but just as cultural. The [Nordic Skiing Association of Anchorage](https://anchoragenordicski.com/programs/junior-nordic/) runs Junior Nordic for kids 6–14 of all abilities. **Kincaid Park** — 60 km of trails through 1,400 acres — anchors a winter-sports ecosystem that punches at Norwegian density.

California, which dominates raw Olympic counts, falls to **mid-pack** at roughly **1.15 per 100k**.

## Where to look next

The under-producers stand out when you compare each state to its climate peers. **West Virginia** sits well below the Continental-zone average. Among states with at least a million residents, the next biggest gaps are **Maine, New Hampshire, Montana, and Iowa** — all in winter-friendly geography but producing far fewer Olympians than their climate peers.

For federations, that's a recruiting and cultivating opportunity hiding in plain sight: the climate is right, the population is there, but the Olympic pipeline isn't converting. The high end of the list (Vermont, Alaska, Colorado) is the model worth studying — what specifically do those states have that the under-producers don't?
`,

  per_capita_paralympic: `
## Paralympians per 100,000 residents

The cleanest way to compare Paralympic output across states is the same per-capita lens used for Olympic, but isolated to Paralympic athletes only. Population-normalized, the national baseline is about **0.20 Paralympians per 100,000 residents** — and a handful of states sit far above that line.

**Colorado leads at 0.89 per 100k**, more than four times the national rate. Then **Alaska (0.68)**, **Maine (0.43)**, **Utah (0.41)**, **Washington (0.41)**, **Minnesota (0.38)**, **Wisconsin (0.37)**, **New Hampshire (0.36)**, **Idaho (0.36)**, and **Hawaii (0.35)**. The pattern is mostly **northern, mountain, and Pacific** — states with strong adaptive-sport ecosystems, year-round outdoor culture, and (in Colorado, Washington, Utah, and Minnesota) institutional anchors like the National Sports Center for the Disabled, BlazeSports, the Move United chapters, and the U.S. Paralympic Nordic and Alpine team residency programs.

The bottom of the list is just as striking. Among states with at least 5 Paralympic profiles and a population above 100,000, the lowest per-capita rates are **Tennessee (0.07), Texas (0.09), South Carolina (0.09), Louisiana (0.11), and Ohio (0.12)** — large, populous states producing far fewer Paralympians per resident than the rural northern leaders.

A note on a metric we considered and rejected: **Paralympic *share* of Olympic+Paralympic profiles** sounds intuitive but distorts the picture. California's "share" is low (~14%) mostly because California has far more Olympians dragging the denominator up, not because California is poor at Paralympic output. Per-capita Paralympians is the cleaner measure of where the Paralympic pipeline is actually working.

## Where to look next

The leaders are concentrated in the northern half of the country and the mountain west — places with year-round outdoor culture, established adaptive-sport organizations, and Paralympic team residency programs. **Colorado at 0.89 per 100k is the model worth dissecting**: what specifically is happening there that produces Paralympians at four times the national rate, and how much of it is portable to other states?

For the USOPC and the national federations, the actionable opportunity is the bottom of the list — large states like **Texas, Tennessee, Ohio, Louisiana, and South Carolina** that produce Paralympic athletes at less than half the national rate. Those states have the residents, the disabled population, and (in Texas's case) the high-school participation base. What they appear to lack is the connective tissue: visible adaptive-sport clubs at the youth level, college programs that recruit Paralympic prospects, classification pathways accessible without travel, and a federation presence that scouts those communities.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate VIII — Profiles per athletic dollar
   * ───────────────────────────────────────────────────────────────── */
  colleges_olympic: `
## Olympic profiles per athletic dollar

**Westminster College** in Salt Lake City — total athletic budget about **$5 million** — has **20 matched Olympians** in this roster. That's **4.0 Olympians per million dollars of athletic spending**, the highest ratio of any college we matched.

The pattern is not NCAA prestige; it is pipeline fit. Westminster's official [U.S. Ski & Snowboard college partnership](https://www.usskiandsnowboard.org/news/westminster-university-re-launches-partnership-us-ski-snowboard) gives national-team athletes a tiered tuition-discount model, flexible degree timelines, online coursework, advising support, and proximity to Park City training facilities. The plate does not prove who paid for training or how much of the athletic budget served those Olympians.

Down the list, the small-budget Olympic pipeline gets clearer:

- **Colorado Mountain College** — $1.5M budget, **4 matched Olympians**.
- **Salt Lake Community College** — $3M budget, **5 matched Olympians**.
- **Northern Michigan University** — winter-sport pipeline anchor.
- **Burke Mountain Academy → Vermont college network** — quietly produces Olympic skiers at a rate that doesn't show up in Pac-12-style efficiency rankings.

Compare to the Ivies. **Princeton** ($42M budget, ~30 Olympians, 0.7/$M) and **Harvard** ($50M, similar count) are nationally extraordinary, but on a per-dollar basis trail the mountain-sport schools.

## Where to look next

Filter the same scatter for **small athletic budgets with real Olympic output** and you get a concrete partnership shortlist of NAIA, NJCAA, and Division III programs whose budgets are under $15M and whose alumni show up disproportionately on Team USA. Each is a candidate for a focused federation partnership — winter at Westminster / Colorado Mountain / Salt Lake CC, and so on.

Scaling these high-efficiency Olympic programs is much cheaper than competing for a Stanford or Princeton athlete, and the alignment to a specific Olympic discipline is already built in. The match list is a lead, not a hand-audited alumni ledger — but it's a short, walkable target list of programs that are already producing.
`,

  colleges_paralympic: `
## Paralympic profiles per athletic dollar

The Paralympic college-efficiency chart has a completely different cast of characters. **Wisconsin-Whitewater** — $5M athletic budget — leads with **14 Paralympians**, a ratio of **2.8 Paralympians per million dollars.** Whitewater's [adaptive athletics program](https://www.uww.edu/admissions/adaptive-athletics) is the longest-running collegiate wheelchair basketball powerhouse in the country, with multiple national championships and a continuous pipeline to the U.S. Wheelchair Basketball national teams.

The next several rows continue the adaptive-sport pattern:

- **University of Central Oklahoma** — $10M, **9 Paralympians**, 0.9/$M. Wheelchair basketball + adaptive track & field.
- **University of Colorado Colorado Springs** — $8M, **4 Paralympians**, 0.5/$M. Co-located with USOPC headquarters; deep Para residency exposure.
- **University of Texas at Arlington** — $28M, **12 Paralympians**, 0.43/$M. Largest collegiate adaptive-sport program in Texas.
- **University of Illinois Urbana-Champaign** — $110M, **37 Paralympians**, 0.34/$M. Illinois's [Disability Resources & Educational Services](https://disability.illinois.edu/) was the first university adaptive-sport program in the country (founded 1948) and remains the deepest.

Compare to the Ivies again. **Princeton** has effectively zero Paralympic alumni in this roster despite a $42M budget. The schools that lead the Paralympic chart are concentrated in the Midwest and Mountain West, run small or mid-sized athletic budgets, and historically operate dedicated **adaptive athletics** programs — not just standard college sports with adaptive accommodations.

## Where to look next

The Paralympic college-efficiency shortlist is concrete and small: **Wisconsin-Whitewater, Central Oklahoma, UCCS, Texas-Arlington, Illinois, and a handful of NCAA D-III adaptive-sport programs.** That's the entire visible Paralympic college pipeline in this dataset.

For Paralympic federations, that's both an opportunity and a warning: the existing pipeline is concentrated in fewer than ten institutions. Scaling Paralympic recruiting means either deepening partnerships with the existing programs or **investing in new adaptive-sport programs at currently-non-producing universities** — particularly in the southern states (Texas outside of UTA, Florida, Georgia, North Carolina) where the Plate VII per-capita gap is largest.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate IX — Profiles per high-school slot
   * ───────────────────────────────────────────────────────────────── */
  hs_conversion_olympic: `
## Olympians per NFHS slot

This metric divides the Olympians in this roster by the official **2024-25 NFHS state totals**. NFHS counts participation slots, not unique students, so this is a normalized density measure rather than a longitudinal athlete-development rate.

| Rank | State | Olympians per Million NFHS Slots |
|---|---|---:|
| 1 | **Vermont** | 2,589 |
| 2 | **Alaska** | 1,137 |
| 3 | Colorado | 884 |
| 4 | Utah | 585 |
| 5 | Nevada | 559 |

Vermont sits at **26 Olympians over 10,043 official NFHS slots**, a very small denominator attached to a very winter-specific Olympic profile mix. Alaska follows at **21 Olympians over 18,475 slots**. Colorado is the larger-scale version: **130 Olympians over 147,139 slots**.

These are useful leads, not proof that high-school programs created the Olympians. The numerator is a cumulative Olympic stock; the denominator is one recent year of NFHS participation slots.

The opposite end is also a lead list. Among states with at least **200,000 official NFHS slots**, the lowest Olympic densities are **Texas (139/M), Ohio (161/M), North Carolina (169/M), Michigan (231/M), Illinois (262/M), and New Jersey (273/M)**. Florida and California are not low — they sit comfortably above the median.

## Where to look next

States with massive high-school participation but low Olympic conversion are talent reservoirs leaking somewhere between high school and Team USA. **Texas is the biggest gap: 122 Olympians from 879,000 NFHS slots**, well below the large-state median.

The actionable question is what's happening to all those high-school athletes. Are they choosing collegiate sports outside the Olympic pathway (especially football and basketball in the South)? Aging out before national-team scouting picks them up? Hitting bottlenecks in club or post-collegiate development? Each answer points at a different federation lever.
`,

  hs_conversion_paralympic: `
## Paralympians per NFHS slot

Reading this chart through the Paralympic lens requires a heavy caveat up front: **the NFHS denominator is built around Olympic-pathway sports, not Paralympic ones.** Most high schools don't field adaptive-sport teams at all, and the ones that do typically aren't represented in the official NFHS participation count. The chart is technically accurate but conceptually mismatched: it's dividing Paralympic output by an Olympic-pathway denominator.

That said, the resulting ranking is still informative as a relative measure:

| Rank | State | Paralympians per Million NFHS Slots |
|---|---|---:|
| 1 | **Colorado** | 353 |
| 2 | **Vermont** | 299 |
| 3 | Alaska | 271 |
| 4 | Washington | 177 |
| 5 | Utah | 144 |

Colorado leads, consistent with the Plate VII per-capita finding. Vermont and Alaska remain near the top. The pattern is that states already producing Paralympic athletes at high rates per resident also produce them at high rates per high-school slot — which makes sense, because NFHS slots scale with state population and high-school participation.

The bottom of the chart for Paralympic-per-NFHS shows the same southern under-producers as the per-capita plate: Tennessee, Louisiana, South Carolina, Texas, and Ohio.

## Where to look next

The actionable takeaway here is the same as Plate VII (per-capita), filtered through a different denominator. **For Paralympic recruiting, the NFHS denominator is the wrong baseline entirely.** A more useful future analysis would divide Paralympic athletes by:

- The **disabled-population** of each state (Census ACS)
- The number of **Move United / BlazeSports chapter members** per state
- **VA-eligible population** by state (relevant because a meaningful fraction of Paralympic athletes are veterans)
- **University adaptive-athletics enrollment** counts

Until that data layer exists in this atlas, treat this chart as a directional indicator: the leaders (CO, VT, AK, WA, UT) have working Paralympic ecosystems, and the under-producers at the bottom of the list have visible gaps to investigate.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate X — Era presence by decade
   * ───────────────────────────────────────────────────────────────── */
  era_olympic: `
## Olympic presence by decade

The decade-by-decade table includes only Olympic athletes with a parsed active-era year, counted in every decade overlapping their parsed first/last active years.

The national row mostly reflects the current-profile bias in teamusa.com, not a complete historical census of who competed in each decade. What *is* useful is the **swing column** as a within-roster comparison: **(2010s + 2020s + 1) / (1980s + 1990s + 1)**.

Topping the swing rankings: **Michigan ×70, New York ×59, Colorado ×48, Pennsylvania ×47, Minnesota ×45, Massachusetts ×35.5, Vermont ×31, Missouri ×30, North Carolina ×29, Utah ×29.**

That top tier mixes **legacy Midwest/Northeast states** (Michigan, New York, Pennsylvania, Massachusetts, Missouri) with **mountain-state winter Olympic profiles** (Colorado, Utah, Vermont). Texas, Arizona, and the Sun Belt are not at the top — this is more a story of older industrial regions plus the mountain-west winter ecosystem than a Sun Belt narrative.

The table does not prove migration, training residence, or infrastructure causality. It only says that, inside this current Olympic profile bundle, late-era roster presence is much higher than early-era roster presence for those states.

## Where to look next

The states gaining the most Olympic representation over the last two decades are doing something right that's worth studying. For federations, those are the places where the *current* Olympic pipeline visibly works.

The action is to ask what specifically changed in each state — a new club, a new college program, a generational coach, a state-level investment — and whether any of those changes is portable. Replicating something that's already producing is a more practical path than building a pipeline from scratch in a state that has never had one. The roster bias means this isn't a complete historical census, but the upward signal is real.
`,

  era_paralympic: `
## Paralympic presence by decade

The Paralympic-lens era table is dominated by **a single fact: almost every Paralympic athlete in this roster competed in the 2000s, 2010s, or 2020s.** The Paralympic Games themselves are younger than the Olympic Games (the modern Summer Paralympics began in 1960, Winter in 1976), and teamusa.com's Paralympic coverage is heavily concentrated on athletes still active or recently active.

That's why the **swing ratios** at the top of the Paralympic era table are higher than the Olympic ones — for many states, the early-era count is literally zero, so any modern presence drives a large ratio.

Top Paralympic swing rankings:

- **Colorado ×60.0** — counts: 0 / 0 / 9 / 35 / 24
- **Washington ×37.0** — 0 / 0 / 7 / 18 / 18
- **Illinois ×36.0** — 0 / 0 / 4 / 14 / 21
- **Michigan ×30.0** — 0 / 0 / 6 / 17 / 12
- **Wisconsin ×28.0** — 0 / 0 / 4 / 12 / 15
- **Florida ×19.5** — 0 / 1 / 3 / 17 / 21
- **California ×16.4** — 2 / 2 / 12 / 36 / 45

The interesting non-finding: even in the top Paralympic-growth states, the 1980s and 1990s columns are mostly zero or near-zero. That's a roster-coverage artifact, not an absence of historical Paralympic activity. Paralympic athletes from earlier decades exist but aren't well-represented in the current teamusa.com profile inventory.

## Where to look next

For Paralympic federations, the era table works less as a historical comparison and more as a **current-pipeline signal**. The states with the largest 2010s + 2020s columns — California, Colorado, Florida, Illinois, New York — are where the modern Paralympic infrastructure visibly works.

The actionable extension is to study those states' Paralympic ecosystems alongside the Plate VII per-capita and Plate VIII college-efficiency findings: **Colorado** (NSCD + UCCS + Para residency programs), **Illinois** (University of Illinois adaptive-sport program, the longest-running in the country), **Wisconsin** (Whitewater, plus Wheelchair Curling concentration), and **California** (population scale + multiple adaptive-sport networks). What works in these states should be the basis for replicating Paralympic infrastructure in the southern under-producers.

A real comparison of Paralympic history would require joining this roster with USOPC historical Paralympic team rosters dating back to the 1960s — a dataset upgrade, not something this atlas can resolve on its own.
`,
};
