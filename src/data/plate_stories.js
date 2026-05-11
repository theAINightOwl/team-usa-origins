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
 * back to the plain key. Plate I (`ref`) and XII (`you`) ignore the toggle.
 */

export const STORIES = {
  ref: ``,

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

One angle could be to re-read the list through the lens of single-sport specialization. **Sixteen of the 50 Olympic factory towns get at least 80% of their Olympians from one sport** — and most are under 5,000 residents. Curling, Freestyle Skiing, Cross-Country Skiing, and Luge are the most-repeated motifs.

For scouts and federations, the pattern that *might* travel is small communities sitting on top of dedicated infrastructure for a single Olympic discipline — a 200km nordic trail network, a curling club going back generations, a ski-jumping hill the town built itself. Walking into one of those settings could help find the next Mapleton or Winthrop more readily than combing through a national talent database.
`,

  factories_paralympic: `
## Tiny towns, big Paralympic rosters

The Paralympic-lens table is anchored by a single institution: the **National Sports Center for the Disabled** at Winter Park Resort, Colorado.

**Winter Park, Colorado** — population **1,149** — has **four Paralympians** in this roster, all in Para Alpine Skiing. That's about **35 Paralympians per 10,000 residents**, the highest rate in any town we tracked, and roughly 175× the national Paralympic rate (~0.20 per 100k). The NSCD has been the Paralympic Alpine team's residency program for decades; athletes who compete at the Games have often spent years living and training in this small mountain town.

**Sun Valley, Idaho** (pop. **1,771**) is the same story for nordic: 2 Para Nordic Skiers from a tiny mountain population. **Granby, Frisco, Silverthorne**, and **Park City UT** round out the top of the table — all small mountain towns adjacent to dedicated Paralympic Alpine or Snowboard residency programs.

But the Paralympic factory pattern isn't only winter. **Gig Harbor, Washington** (pop. **12,604**) appears for Wheelchair Basketball; **Crystal Lake, IL** for Para Judo; **Salem, MA** for Para Swimming. The per-capita rates are smaller (these are bigger towns), but the signature is the same: a town with a single visible adaptive-sport club or program that funnels athletes into one Paralympic discipline.

The dominant top family across the 50 Paralympic factory towns is actually **Team Ball** (14 of 50, mostly Wheelchair Basketball), tied between Winter (10) and Track & Field (10, mostly Para Athletics), with Aquatic (8) close behind. The Paralympic version of "culture density" runs through specific clubs and adaptive-sport organizations, not through the broader civic infrastructure that produces Olympic skiers and curlers.

## Where to look next

For Paralympic scouting, the signature here appears to differ from Olympic factories: rather than civic sports culture, towns hosting a **specific adaptive-sport residency program or anchor club** — Move United chapters, BlazeSports affiliates, university-based wheelchair basketball or wheelchair rugby programs, VA-linked adaptive sport facilities — could be the more useful set to surface.

Only 5 of the top 50 Paralympic factory towns concentrate ≥80% of their athletes in a single sport, compared to 16 of 50 on the Olympic side — Paralympic athletes seem to scatter across more disciplines per town. That suggests the **anchor-program pattern** could help find the next Winter Park or Gig Harbor more readily than per-capita counting alone.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate III — How concentrated each sport is
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

The chart can be read two ways. **A high score may point at which states already hold the Olympic pipeline. A low score can make absence easier to notice** — when a sport tends to be everywhere, the empty states stand out.

**Diving** is one of those genuinely spread-out sports: 199 Olympians across 27 states, with no single state holding more than 18%. And yet **Minnesota and Wisconsin have zero Olympic divers in this roster** — both states sit in the top 15 nationally for overall Team USA output. **Soccer** shows the same gap.

Those reads are best treated as state-level white-space clues rather than proof of missing infrastructure. They could help find places with population and broader athletic culture where this Olympic slice shows no hometown signal for a sport that otherwise spreads across the country.
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

For Paralympic scouting, the concentration chart may be less of a recruiting map than the Olympic version because nothing approaches single-state dominance. One **possible read points the opposite direction**: which Paralympic sports have the broadest geographic reach, and what does the empty-cell pattern look like?

Most Paralympic sports show concentration scores under **0.20**, suggesting national-team athletes come from many states. That could be good news for federation reach, and it may also hint that **classification, club-pathway, and travel-cost barriers are part of the binding constraint** rather than geographic scarcity. A next analytical question could be whether the dispersed Paralympic athlete map lines up with the actual geography of disability and adaptive-sport infrastructure — or whether some states are systematically under-converting.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate VII — Reach of the training centers
   * ───────────────────────────────────────────────────────────────── */
  halos_olympic: `
## Reach of the training centers (Olympic)

Every training center on the map has two numbers worth comparing under the Olympic lens: **how many Olympians live nearby**, and how many of those nearby Olympians do **a sport the center actually trains**. The first is mostly a measure of regional population. The second tells you whether the center is doing real work for Olympic athletes around it — and the two numbers tell very different stories.

Start with the biggest raw number. **290 Olympians live within 200 miles of the USA Volleyball Training Center in Anaheim**, more than any other tracked center on the map for the Olympic lens. But that's mostly Southern California density: only **37 of those 290** are in a sport the center actually trains. USA Volleyball's [National Team Development Program](https://usavolleyball.org/play/national-team-development-program/indoor-ntdp/) uses Anaheim as one location among many for roughly the top 30–40 indoor athletes per birth year.

**Lake Placid** flips that ratio. Only **155 Olympians** live within 200 miles, in a sparsely populated stretch of upstate New York where population alone can't explain the count. But **77 of those 155** — the highest sport-served Olympic count of any tracked center — train in disciplines this site is specifically built for. What put those Olympians there is **history**: the **1980 Winter Games** (Miracle on Ice, Eric Heiden's five golds) and the **1932 Games** before that.

**Colorado Springs**, the original USOPC training center [built in 1978](https://krdo.com/olympic-city-usa/2024/02/14/why-the-usopc-moved-to-colorado-springs-in-the-late-70s/) on the former Ent Air Force Base, anchors the system at altitude (6,035 feet). Roughly 15,000 athletes pass through annually, and the co-located USA Swimming National Training Center is folded into the same geography on this map.

One of the ten tracked geographies — **Lakeshore Foundation** in Homewood, AL — exists for Paralympic sport, not Olympic. It still registers here (30 of the 81 Olympians within 200 miles do a sport Lakeshore lists, mostly Track & Field), but the meaningful story for Lakeshore is on the Paralympic lens.

## Where to look next

Most of the country isn't near a USOPC center. About **half of the Olympians in this roster live more than 300 miles from any tracked training site.** Texas alone holds a large share, with **Houston the biggest single distant metro.**

That's the gap. It probably **isn't** an automatic case for dropping a new center in Houston — Houston's distant Olympians are spread across many different sports, and a multi-sport campus may only pay off when enough nearby athletes do sports that campus can actually train.

A cheaper, more practical angle could be a **single-sport satellite**: a city with a real concentration of one discipline — enough swimmers, wrestlers, or gymnasts to anchor a focused facility — might be a better candidate than a generalist campus. That approach could line up with how Olympic athletes already cluster, instead of chasing raw headcount.
`,

  halos_paralympic: `
## Reach of the training centers (Paralympic)

Looking at the same training-center map under the Paralympic lens reveals something stark: **the tracked facility roster is still mostly Olympic infrastructure, with one explicit Paralympic hub on it.**

The biggest raw Paralympic halo (athletes within 200 miles) belongs to the **Pettit National Ice Center in Milwaukee, with 58 nearby Paralympians** — and **zero of them are in a sport this site trains.** Pettit is a long-track speed-skating facility; almost no Paralympians compete in long-track speed skating in this roster. Geographic proximity is real; functional service is zero. That gap is the headline this lens keeps producing.

The functional-service standout on the Paralympic side is **Lakeshore Foundation** in Homewood, Alabama — the one tracked site whose entire program is built around Paralympic sport. The raw halo is small: only **22 Paralympic athletes** live within 200 miles, in a thinly populated stretch of the South. But **15 of those 22 are in a sport Lakeshore actually trains** — wheelchair rugby, goalball, sitting volleyball, wheelchair basketball, para powerlifting, para athletics, paratriathlon. That's a **68% sport-served rate, the highest of any tracked center on this lens.** The catchment is small, but for the athletes inside it, the match is almost always real.

The rest of the network is bigger but blunter:

- **Chula Vista** — 41 Paralympians within 200 miles, **22 sport-served** (still the highest absolute count, driven by Para Track & Field and Sitting Volleyball folded into existing Olympic programs).
- **Colorado Springs** — 53 nearby, **14 sport-served** through Para Cycling and the few other USOPC-supported disciplines that share the OPTC campus.
- **Lake Placid** — 37 nearby, **6 sport-served** (sled hockey, Para Nordic).
- **Anaheim Volleyball** — 43 nearby, **1 sport-served**.

## Where to look next

Even with Lakeshore on the map, the tracked roster is small and clustered in three regions — the desert Southwest, the Front Range, and the Lake Placid pocket — with a single southern outlier. Many Paralympic disciplines still have **no Para-specific tracked hub anywhere**: Wheelchair Curling, Wheelchair Tennis, Wheelchair Fencing, Para Alpine Skiing, Para-Equestrian, Sailing. Athletes in those sports show up as "unserved" no matter where they live.

For the USOPC and the national federations, the practical question this plate raises isn't whether to copy Lakeshore — it's whether the tracked-facility map is the right frame at all for Paralympic siting and scouting decisions. Mapping the adaptive-sport ecosystem separately — NSCD-style residency centers, BlazeSports / Move United chapters, VA adaptive facilities, university adaptive programs — would likely tell a more honest story about where Paralympic talent actually trains.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate VIII — How far from a training center
   * ───────────────────────────────────────────────────────────────── */
  distance_olympic: `
## How far from a training center? (Olympic)

For each of the **1,855 Olympic athletes** in this lens whose sport is represented in the tracked facility roster, we measured how far their hometown is from the nearest training site that actually trains their sport. The result is striking: **most Olympians grew up nowhere near any tracked center.**

Across all sport families combined, only about **16% lived within 200 miles** of a sport-serving training site, **38% lived 200–800 miles away**, and roughly **47% lived more than 800 miles away.** Put differently: **more than 8 in 10 Olympians grew up more than 200 miles from any sport-serving facility.** The existing training-center geography is largely decoupled from where U.S. Olympic talent actually grows up.

Two families break the pattern. **Endurance** (about 33% within 200 miles) is anchored by clusters around Lake Placid (biathlon) and Park City (cross-country / nordic combined). **Winter** also leans regional — about 21% within 200 miles, with another 53% in the 200–800 band. For everyone else — Aquatic, Combat, Gymnastics, Track & Field, Racket — the close-band shares are small and the >800 share dominates.

This doesn't mean the centers don't matter. Olympic athletes move to train, and elite competition happens at the centers regardless of where they started. What it means is that the existing training-center map is **not** the pipeline that produces most U.S. Olympic athletes — the pipeline runs through clubs, schools, and college programs scattered across the country.

(Note on scope: this analysis is restricted to the Olympic athletes whose sport is represented in the tracked facility roster. Sports like basketball, table tennis, sailing, softball, and equestrian don't have a tracked facility and are excluded.)

## Where to look next

This plate complicates the usual assumption that "more centers near more athletes = more Olympians." **Roughly half of the Olympians in this roster grew up more than 800 miles from any sport-serving training center, and another third grew up in the 200–800 mile band.**

For the USOPC and the national federations, the more useful lever may not be **building** more centers but **strengthening the distributed pipeline** that already appears to be producing: club partnerships, college relationships, and recruiting in the regions where future Olympians already live could help find leverage the center map doesn't reveal. The center may matter later, after an athlete is already on a path. For scouts, the home community could be a more practical place to look than the area around any single center.
`,

  distance_paralympic: `
## How far from a training center? (Paralympic)

For the **571 Paralympic athletes** in this lens whose sport is represented in the tracked facility roster, the same question shows a familiar but reshaped pattern: **most Paralympians still grew up far from any tracked center, but the new Lakeshore Foundation row and the inclusion of more Para-served sports has shifted weight out of the far band and into the middle.**

Across all families combined under the Paralympic lens, roughly **12% lived within 200 miles** of a sport-serving training site, **46% lived 200–800 miles away**, and about **42% lived more than 800 miles away.** The close-band share is still smaller than Olympic, but the mid band now dominates — most Paralympic athletes are within reasonable travel of *some* serving facility, even if they didn't grow up in its immediate orbit.

A few family patterns stand out:

- **Endurance** (n=59) — **15%** within 200, **63%** mid-distance, only **22%** far. Driven by Para Nordic and Para Cycling clustering around Park City and the Colorado Front Range.
- **Winter** (n=90) — **13%** within 200, **36%** mid-distance, **51%** far. Less anchored than Olympic Winter because Para Alpine residency at Winter Park sits off this map.
- **Combat** (n=15) — small sample, but **20%** within 200 (mostly LA-area Para Judo and Para Taekwondo).
- **Track & Field** (n=144, dominated by Para Athletics now that it's classified correctly) — **12%** within 200, **60%** mid-distance, **27%** far. Chula Vista and Lakeshore between them catch a much larger share than the Olympic-only roster did.
- **Team Ball** (n=136) — **9%** within 200, **57%** mid-distance, **34%** far. Lakeshore's adaptive ball-sport programs (Wheelchair Basketball, Wheelchair Rugby, Sitting Volleyball) materially lifted this family out of the far band.

The remaining far-band heaviness sits in **Aquatic** (75% far) and **Winter** (51% far) — disciplines where the tracked roster still doesn't reach into much of the country.

## Where to look next

The headline has softened: adding Lakeshore and folding adaptive sports into the existing roster moves roughly **3 in 10 Paralympic athletes out of the far band and into the mid band.** That's a real reframing — the tracked map isn't as decoupled from the Paralympic pipeline as the pre-Lakeshore numbers suggested.

It still isn't the whole map. Many Paralympic disciplines — Wheelchair Curling, Wheelchair Tennis, Wheelchair Fencing, Para Alpine, Para-Equestrian, Sailing — have no tracked facility anywhere and don't appear in this plate at all. A useful next analysis would be to map the adaptive-sport ecosystem separately (NSCD-style residency centers, BlazeSports / Move United chapters, VA adaptive facilities, university adaptive programs) and ask the distance question against *that* layer. The Paralympic pipeline that runs through the tracked-facility map is now more visible than before; the parts that don't are the next thing to make visible.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate V — Climate × sport family
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

For Olympic federations cultivating a sport in a non-traditional climate, **Wellington could offer a model**: when prize money, venues, and the calendar concentrate in one place, climate appears to matter less. The **counter-climate cells** — Equestrian in Hot Humid, Racket in Mild, Team Ball in Mild — may help surface scouting leads beyond the obvious geography. They tend to be rarer and disproportionately driven by one or two anchor institutions that could be visited in person.

For scouts, the diagonal of this matrix probably reflects where the obvious Olympic pipeline runs. The off-diagonal cells with surprising volume could be the more useful leads to chase.
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

For Paralympic federations, the climate matrix may hint at the same insight as Plate IV: **the existing Paralympic geography appears rooted in where adaptive-sport programs were historically founded**, rather than where the climate or population would predict. That could open a planning angle. Para sports that don't depend on outdoor weather (Wheelchair Basketball, Wheelchair Rugby, Goalball, Para Powerlifting, Para Judo) could in principle be cultivated anywhere — and the chart shows them disproportionately Continental-clustered today, which may have more to do with institutional history than logistics.

One possible read: identifying states where the climate is permissive but the Paralympic numbers are low could help find the places worth asking why no adaptive-sport organization has taken root.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate IX — Profiles per 100k residents (merged)
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

The apparent under-producers may stand out when each state is compared to its climate peers. **West Virginia** sits well below the Continental-zone average. Among states with at least a million residents, the next biggest gaps appear to be **Maine, New Hampshire, Montana, and Iowa** — all in winter-friendly geography but producing fewer Olympians than their climate peers.

For federations, that could read as a recruiting and cultivating opportunity hiding in plain sight: the climate is right, the population is there, yet the Olympic pipeline appears not to be converting. The high end of the list (Vermont, Alaska, Colorado) could be worth studying — what those states have that the under-producers don't may be the more useful question to chase.
`,

  per_capita_paralympic: `
## Paralympians per 100,000 residents

The cleanest way to compare Paralympic output across states is the same per-capita lens used for Olympic, but isolated to Paralympic athletes only. Population-normalized, the national baseline is about **0.20 Paralympians per 100,000 residents** — and a handful of states sit far above that line.

**Colorado leads at 0.89 per 100k**, more than four times the national rate. Then **Alaska (0.68)**, **Maine (0.43)**, **Utah (0.41)**, **Washington (0.41)**, **Minnesota (0.38)**, **Wisconsin (0.37)**, **New Hampshire (0.36)**, **Idaho (0.36)**, and **Hawaii (0.35)**. The pattern is mostly **northern, mountain, and Pacific** — states with strong adaptive-sport ecosystems, year-round outdoor culture, and (in Colorado, Washington, Utah, and Minnesota) institutional anchors like the National Sports Center for the Disabled, BlazeSports, the Move United chapters, and the U.S. Paralympic Nordic and Alpine team residency programs.

The bottom of the list is just as striking. Among states with at least 5 Paralympic profiles and a population above 100,000, the lowest per-capita rates are **Tennessee (0.07), Texas (0.09), South Carolina (0.09), Louisiana (0.11), and Ohio (0.12)** — large, populous states producing far fewer Paralympians per resident than the rural northern leaders.

A note on a metric we considered and rejected: **Paralympic *share* of Olympic+Paralympic profiles** sounds intuitive but distorts the picture. California's "share" is low (~14%) mostly because California has far more Olympians dragging the denominator up, not because California is poor at Paralympic output. Per-capita Paralympians is the cleaner measure of where the Paralympic pipeline is actually working.

## Where to look next

The leaders cluster in the northern half of the country and the mountain west — places with year-round outdoor culture, established adaptive-sport organizations, and Paralympic team residency programs. **Colorado at 0.89 per 100k could be the most useful case to dissect**: what's happening there that produces Paralympians at four times the national rate, and how much of it might be portable to other states?

For the USOPC and the national federations, one possible opportunity sits at the bottom of the list — large states like **Texas, Tennessee, Ohio, Louisiana, and South Carolina** that produce Paralympic athletes at less than half the national rate. Those states have the residents, the disabled population, and (in Texas's case) the high-school participation base. What they appear to lack is the connective tissue: visible adaptive-sport clubs at the youth level, college programs that recruit Paralympic prospects, classification pathways accessible without travel, and a federation presence that scouts those communities.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate X — Profiles per athletic dollar
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

Filtering the same scatter for **small athletic budgets with real Olympic output** could surface a partnership shortlist of NAIA, NJCAA, and Division III programs whose budgets are under $15M and whose alumni appear disproportionately on Team USA. Each may be a candidate for a focused federation partnership — winter at Westminster / Colorado Mountain / Salt Lake CC, and so on.

Scaling these apparently high-efficiency Olympic programs could be cheaper than competing for a Stanford or Princeton athlete, and the alignment to a specific Olympic discipline may already be built in. The match list is a lead rather than a hand-audited alumni ledger — but it could help find a short, walkable target list of programs that are already producing.
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

The Paralympic college-efficiency shortlist looks small: **Wisconsin-Whitewater, Central Oklahoma, UCCS, Texas-Arlington, Illinois, and a handful of NCAA D-III adaptive-sport programs.** That appears to be most of the visible Paralympic college pipeline in this dataset.

For Paralympic federations, that could read as both an opportunity and a warning: the existing pipeline seems concentrated in fewer than ten institutions. Scaling Paralympic recruiting might mean either deepening partnerships with the existing programs or **seeding new adaptive-sport programs at currently-non-producing universities** — particularly in the southern states (Texas outside of UTA, Florida, Georgia, North Carolina) where the Plate IX per-capita gap appears largest.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate XI — Profiles per high-school slot
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

States with massive high-school participation but low Olympic conversion may be talent reservoirs leaking somewhere between high school and Team USA. **Texas appears to be the biggest gap: 122 Olympians from 879,000 NFHS slots**, well below the large-state median.

One useful question could be what's happening to those high-school athletes. Are they choosing collegiate sports outside the Olympic pathway (especially football and basketball in the South)? Aging out before national-team scouting picks them up? Hitting bottlenecks in club or post-collegiate development? Each possibility could point at a different federation lever.
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

Colorado leads, consistent with the Plate IX per-capita finding. Vermont and Alaska remain near the top. The pattern is that states already producing Paralympic athletes at high rates per resident also produce them at high rates per high-school slot — which makes sense, because NFHS slots scale with state population and high-school participation.

The bottom of the chart for Paralympic-per-NFHS shows the same southern under-producers as the per-capita plate: Tennessee, Louisiana, South Carolina, Texas, and Ohio.

## Where to look next

The takeaway here may echo Plate IX (per-capita), filtered through a different denominator. **For Paralympic recruiting, the NFHS denominator looks like a poor baseline.** A more useful future analysis could divide Paralympic athletes by:

- The **disabled-population** of each state (Census ACS)
- The number of **Move United / BlazeSports chapter members** per state
- **VA-eligible population** by state (relevant because a meaningful fraction of Paralympic athletes are veterans)
- **University adaptive-athletics enrollment** counts

Until that data layer exists in this atlas, this chart could serve as a directional indicator: the leaders (CO, VT, AK, WA, UT) appear to have working Paralympic ecosystems, and the under-producers at the bottom of the list may have visible gaps worth investigating.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate IV — Sport family × states
   * ───────────────────────────────────────────────────────────────── */
  home_states_olympic: `
## Where each sport calls home

For every sport family, the three states that supply the most athletes to its current Olympic roster. The map paints the top-3 directly — rank-1 dots are the largest, rank-3 the smallest, all colored by family — so you can read each family's "home" at a glance.

**California is the default #1** for most families just because of population scale. Forty million people produces a lot of athletes in every direction. The interesting reads are the families where another state actually overtakes California:

- **Winter** — Colorado is #1, then Utah, then Minnesota. The cold-belt geography is so concentrated that even California, with its Tahoe / Mammoth pipeline, drops to #4 or #5.
- **Equestrian** — Florida is #1, followed by Texas and California. The horse-country South pulls hard enough to lead a family.
- **Endurance** — California is still #1, but Colorado is unusually close behind for a small-population state, propped up by Boulder / Colorado Springs altitude training.

Across the rest of the table the pattern is the same shape: **California leads, then a regional state or two anchored by infrastructure** — Texas for sun-belt swimming and team sports, New York for combat and racket sports, Florida for sailing and aquatic.

## What this plate is and isn't

This is a snapshot of the *current* Team USA roster's hometowns, not a historical census of where every Olympian ever came from. A state appearing in a family's top-3 means it's currently producing meaningfully more athletes per family than its peers, not that it's the historical hub.

For a state's full sport-by-sport identity, click the state on the map — the StatePanel breaks out its top sports. For *how concentrated* a sport's geography is (versus just *where* it concentrates), see Plate III.
`,

  home_states_paralympic: `
## Where each Paralympic sport calls home

The Paralympic roster is smaller (and more institutional) than the Olympic one, which means the top-3 source states are dominated less by population scale and more by **specific programs and residencies**.

- **Winter** is anchored by Colorado — driven almost entirely by the **National Sports Center for the Disabled** at Winter Park, which has been the Para Alpine team's de-facto residency program for decades. California and Washington round out the top-3 on a much smaller base.
- **Team Ball** (mostly Wheelchair Basketball and Wheelchair Rugby) leans toward states with large university adaptive-sport programs — **Illinois** (the University of Illinois adaptive-sport program, the longest-running in the country) and **Wisconsin** (UW-Whitewater) consistently show up.
- **Track & Field** (dominated by Para Athletics) is California-led but with a long tail of smaller states — its top-3 is the most population-driven of the Paralympic families.

The Paralympic top-3 is best read as a **program map**, not a population map: where active national-team residency / camp programs live, the top-3 follows. Replicating those programs is the closest thing to a portable playbook for Paralympic federations.

## Caveats

Small families on the Paralympic side (**Strength**, **Equestrian**, **Combat**) have under 25 athletes each, which means a single name can move a state in or out of the top-3. Read those rows as suggestive rather than definitive.

Gymnastics is missing entirely from this lens — there are no Paralympic Gymnastics events, so the family has zero athletes under the Paralympic toggle.
`,

  /* ─────────────────────────────────────────────────────────────────
   * Plate VI — Sport family × elevation
   * ───────────────────────────────────────────────────────────────── */
  altitude_olympic: `
## The atlas climbs

Run a USGS lookup on every geocoded hometown in this roster — **1,994 cities, zero misses** — and a clean vertical signal falls out of the data. Across the full Team USA roster the mean Olympic-lens hometown sits at about **1,170 ft**, but that average hides a five-fold spread by sport family. **Endurance leads at 2,435 ft** (mean), with Winter close behind; Equestrian and Racket finish below 500 ft. The sports that ride and aim sit on the coastal plain; the sports that climb and slide are produced in the mountains.

The shift is sharpest as you read the table left to right. At sea level, **Aquatic alone supplies 21% of the roster** and Winter only 9.7%. Above 5,000 ft those proportions invert: **Winter is 47% of the high-altitude roster**, while Aquatic falls to 8%. The plate's strongest single cell is **Winter × ≤500 ft** — only 27% of Winter Olympians come from sea-level hometowns, the lowest sea-level share of any large family. The strongest opposite is **Racket × ≤500 ft at 66%** — tennis, badminton, and squash are coastal sports.

## The high-altitude pipeline is mostly Colorado and Utah

Of the ten Olympic-lens hometowns above 4,000 ft with at least four profiles, **eight sit in Colorado or Utah**. **Park City, UT leads at 7,154 ft with 28 Olympians**, almost all in Winter. **Colorado Springs is second with 18 Olympians from 6,338 ft** — and notably, its top family is **Track & Field, not Winter**, a one-of-its-kind anomaly driven by the U.S. Olympic & Paralympic Training Center pulling distance, race-walk, and field athletes *to* altitude rather than producing them locally. Steamboat Springs, Aspen, Vail, and Mammoth Lakes are the more familiar Winter pattern: pipelines anchored by lifts, jumps, and Nordic trails the towns built around themselves.

The most telling outlier is **Boulder, Colorado at 5,270 ft, where Endurance is the top family** — the only Olympic top-ten high town where distance running and triathlon dominate. Boulder isn't producing endurance athletes from local schools; it's importing them as adults to train at altitude. That's why Endurance has the bimodal signature in the table: a **median hometown elevation under 1,000 ft** (most distance runners grow up at sea level), but a long upper tail anchored at altitude — Boulder, Mammoth Lakes, Flagstaff.

## Where to look next

One honest read is that altitude probably doesn't *cause* Olympic production for most sports. The two families with a real elevation signal — Winter and Endurance — appear to track **deliberate facility geography**: ski jumps and biathlon ranges go where snow stays long, and altitude camps go where the air thins. Everything else looks incidental. A sea-level kid in Florida still has a better statistical chance of making the Olympic roster (per capita) than a kid born above 5,000 ft, simply because that's where the population is.

Where altitude *could* help is in identifying **where the federations have voted with their dollars**. Colorado Springs, Park City, and Lake Placid look like altitude-and-mountain legacies of past Games and the residency programs that followed. An under-tapped question could be whether any non-Colorado high-elevation region — northern New Mexico, eastern Oregon, the Sierra spine — might anchor a fourth such cluster. The current data shows no comparable pipeline outside the Rockies, but the map may leave room for one.
`,

  altitude_paralympic: `
## The atlas climbs, with sharper edges

The Paralympic-lens elevation table is a smaller dataset (**603 profiles** with mappable hometowns) but tells a more concentrated version of the same story. The Paralympic mean hometown elevation is **1,315 ft — slightly higher than the Olympic mean of 1,169 ft** — driven almost entirely by the Para Alpine and Para Nordic residency programs that sit in the Rockies.

Within the table, **Winter is again the dominant high-altitude family**: 19% of Para-Winter profiles come from hometowns above 5,000 ft, and the family's mean elevation is **2,334 ft**. Endurance is the only other family that climbs significantly. Below the snow line, **Team Ball anchors the middle tiers** because its top sport in this lens — Wheelchair Basketball — clusters around adaptive-sport residency programs at universities (Illinois, Whitewater, Texas-Arlington), most of which sit between 600 and 1,200 ft.

## The Paralympic high-altitude towns are very small — and very Colorado

The lens-filtered high-elevation hometown list is short and almost entirely Front Range. **Colorado Springs leads at 6,338 ft with 13 Paralympians**, but the top family there is **Aquatic, not Winter** — that's the Para Swimming residency program at the U.S. Olympic & Paralympic Training Center, the same OTC anomaly the Olympic-lens table shows in track form. **Denver, Salt Lake City, Park City UT, and Winter Park CO at 10,127 ft** round out the visible Paralympic high-altitude towns, each with four to six Paralympians.

**Winter Park** is the most concentrated case in the entire atlas. Population 1,149, sitting above 10,000 ft, with four Paralympians all in Para Alpine — the National Sports Center for the Disabled has been the Paralympic Alpine team's residency program for decades. Where the Olympic high-altitude pipeline runs through several legacy facilities (USOPC OTC, Park City U.S. Ski & Snowboard, Steamboat Springs Winter Sports Club), the **Paralympic high-altitude pipeline collapses into NSCD plus the Para wing of the OTC**. Lose either program and most of the Paralympic Winter or Para Aquatic high-altitude column would disappear from this atlas.

## Where to look next

One read for Paralympic federations runs inverse to the Olympic story. **Most Paralympic athletes still appear to come from sea-level and lowland hometowns** — Wheelchair Basketball, Para Athletics, Para Swimming, Para Cycling look like coastal and inland-suburban sports. The high-altitude column is small but disproportionate in winter medals.

One risk worth flagging is **single-program fragility**. The Paralympic high-altitude pipeline may not have the institutional redundancy the Olympic version has — lose NSCD or the OTC's Para programs and most of the high-altitude Paralympic column in this atlas could thin out, because no comparable second program appears to exist at altitude. The Olympic side leans on at least four anchored institutions (USOPC OTC, Park City U.S. Ski & Snowboard, Steamboat Springs Winter Sports Club, Lake Placid). A second high-altitude Paralympic anchor — at a site with comparable lift access and trained adaptive coaches — could be one of the more resilient moves available to the Paralympic winter program.
`,
};
