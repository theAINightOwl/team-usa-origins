/*
 * plate_stories.js — long-form journalistic context for each plate.
 *
 * Rendered inside an expandable "Story" section on every plate panel.
 * Markdown is parsed by src/lib/markdown.jsx — keep it markdown-compatible.
 *
 * The full source narrative lives at /PLATE_STORIES.md at the repo root;
 * this is a lightly-shortened version tuned for the 380px right column.
 */

export const STORIES = {
  ref: `
## A century of hometowns, in one map

The atlas draws on **5,201 athletes** with mappable hometowns from teamusa.com's published roster of 8,526 profiles. Coordinates come from the 2023 U.S. Census Gazetteer, with **346 hand-curated corrections** for the places the gazetteer misses — NYC outer boroughs, Michigan charter townships, ski resorts that aren't legally incorporated, and the dozens of cases where Team USA's own data lists "Houston, Texas" with the state field set to TX.

Athletes are anonymous in this atlas — names were stripped from the bundle in keeping with NIL norms. What remains is sport, hometown, medals, era. That's enough to draw the country's Olympic geography in surprisingly sharp lines, as the next ten plates show.
`,

  factories: `
## The smallest factories

> **Park City, UT**, population 8,254, has produced **42 Olympians**. About *one Olympian for every 200 people in town.* The national rate is roughly 0.02 per 10k.

Park City hosted the 2002 Winter Olympics, and the infrastructure never left. The **Utah Olympic Park** sits 28 miles east of Salt Lake City and contains one of only four sliding tracks in North America, six Nordic ski jumps, and the U.S. Ski Team's Center of Excellence. A Utah athlete has [reached the Winter podium every Games since 2006](https://utaholympiclegacy.org/about/), and at Beijing, *a third of Team USA lived and trained in Utah.*

Park City isn't even the most extreme case. **Winthrop, WA** — population **578** — leads the table with five Olympians, all in cross-country skiing. The town anchors the Methow Valley, [over 200 km of nordic trails](https://www.adventuresnw.com/cross-country-skiing-nirvana-in-washingtons-methow-valley/), the largest such network in North America. The local high school's nordic team has more kids than football, both basketballs, and volleyball *combined.*

**Mapleton, MN** (pop. 1,649) appears for **curling** — a tradition going back to 1857, the year before Minnesota's statehood. Mapleton produced [John Landsteiner](https://www.mankatofreepress.com/news/golden-boy-landsteiner-brings-olympic-gold-back-to-mapleton/article_3fd52682-36c7-11e8-9bcc-6774d18fb220.html), who won America's first Olympic curling gold in 2018.

The pattern: small towns produce Olympians when the *entire town organizes around a sport.* Park City's sport is every winter sport. Winthrop's is nordic. Mapleton's is curling. The list isn't really about geography — it's about culture density.
`,

  concentration: `
## Where each sport actually lives

**100% of America's beach volleyball Olympians come from California.** The Herfindahl index — economists' measure of monopoly — gives California beach volleyball a perfect **1.00**.

Manhattan Beach is, in a literal sense, [the home of beach volleyball](https://avp.com/news/breaking-down-the-beaches-of-southern-california/). The Manhattan Beach Open started as an amateur tournament in 1960 and is now the AVP tour's crown jewel. At Marine Street alone there are 10–12 permanent courts where pros, ex-pros, and amateurs train side by side.

**Water polo** (HHI 0.84, 91% California) has the same explanation: year-round outdoor pools, deep college pipeline through the Pac-12, weather that lets a kid swim at 4pm in February. **Badminton's** 85% California share runs through SoCal's large Asian-American community, where the sport has institutional depth most of the country lacks.

The data flips warmer further down:
- **Waterski/Wakeboard** — 75% Florida (Lake Hancock and Cypress Gardens built the modern sport)
- **Ski Mountaineering** — 64% Colorado
- **Nordic Combined** — 60% CO / 20% UT
- **Skateboarding** — 48% CA / 18% AZ / 14% FL — an arc along the warm-belt skate-park diaspora

The sports the rest of the country *does* dominate are the universal ones — basketball, soccer, track. The rest are local industries.
`,

  halos: `
## Reach of the training centers

**618** Team USA athletes live within 200 miles of the **USA Volleyball Training Center in Anaheim** — more than any other facility. That's partly Anaheim being in the densest sports state in America, but the center matters: USA Volleyball runs the [National Team Development Program](https://usavolleyball.org/play/national-team-development-program/) out of Anaheim, identifying 8–12 of the top juniors per birth year and routing them through structured training.

The story that's harder to argue away is **Lake Placid**. Only **283** athletes within 200 miles, in a sparsely-populated stretch of upstate New York where pure population can't explain the count. What does explain it: the 1980 Games (Miracle on Ice, Eric Heiden's five golds) and the 1932 Games before that. New York established the [Olympic Regional Development Authority](https://lakeplacidlegacysites.com/history/) in 1981 specifically to maintain those venues. The result, four decades later, is a 96-bed Olympic Training Center that anchors an entire regional economy of bobsled, luge, biathlon, and figure skating.

The original USOPC training center, of course, is **Colorado Springs** — [built in 1978](https://krdo.com/olympic-city-usa/2024/02/14/why-the-usopc-moved-to-colorado-springs-in-the-late-70s/) on the former Ent Air Force Base. It won out over Baton Rouge through a $1/year lease, vast land, sunshine, and crucially **altitude**: 6,035 feet, the physiological stimulus endurance athletes traditionally seek. It now hosts roughly 15,000 athletes per year. **267** Team USA athletes live within 200 miles. The closest the country comes to an Olympic company town.
`,

  climate: `
## Climate × sport family

A single number tells the climate story: **55% of all American Winter-sports Olympians come from the Cold Continental zone.** No other family is so geographically determined.

The opposite extreme is **Equestrian**, which peaks in Hot Humid (Florida) at 32%. That's almost entirely [Wellington, FL](https://www.wellingtoninternational.com/), the self-proclaimed "Winter Equestrian Capital of the World." Its 13-week, 18-arena, $16 million Winter Equestrian Festival draws every Olympic-caliber rider on the continent. The sport doesn't follow climate so much as *follow the money* — and money goes where the arenas and warm winters are.

The middle of the matrix is more nuanced:
- **Aquatic** sports (swim, water polo, dive) lean Continental because swimming is a college sport and college towns are everywhere — but their secondary peaks are unmistakably warm: California, Florida, Texas.
- **Track & Field** is genuinely diffuse, peaking Continental at only 36%. The most universal Olympic sport in America.
- **Racket sports** peak in Mild at 40% — pulling them toward California once again, where college tennis and table-tennis clubs concentrate.

The diagonal exists, but the *columns* tell you something more interesting: certain sport families have *escaped* their climate by building infrastructure (indoor pools, dressage rings, climate-controlled gyms) anywhere a metro can afford them.
`,

  distance: `
## Closer to a center, more medals?

A version of this question is the entire premise of the U.S. Olympic system: the federation built training centers in Colorado Springs, Lake Placid, and Chula Vista on the assumption that **proximity helps.**

Across **all sports**, the distribution of Team USA hometowns is *flat*: most American athletes live nowhere near a USOPC center. Track & Field, basketball, and softball athletes scatter by population, not by training-center geography.

But within **family-specific** distributions, the story diverges. **Winter** athletes cluster dramatically inside the 200-mile radius of Park City and Lake Placid — the medalist density curve sits well left of the non-medalist curve. Same for **Aquatic** sports relative to Chula Vista (the SoCal water-polo and swim hub).

For **Team Ball** (volleyball, basketball, soccer): both medalists and non-medalists are heavily clustered within 200 miles of *something* — but that "something" is usually just California, where almost everything is. The distance signal is real, but it's a stand-in for "do you live in a state that takes your sport seriously?"

The honest reading: training-center proximity matters for the **niche Olympic sports** with one or two viable training sites in the country, and hardly at all for sports with deep, distributed college programs. The USOPC's investment is a bet on the former.
`,

  paralympic: `
## Paralympic geography is its own map

The state with the highest Paralympic share isn't the one you'd guess — it's **New Mexico** at 36%. **Oklahoma** is second at 32%, **Iowa** third at 30%. Every one of those sits well above the national Paralympic share (~13–15%).

The pattern lines up almost perfectly with **military and VA hospital geography**. Iowa City has hosted the [National Disabled Veterans Golf Clinic](https://benefits.com/veterans-disability/va-adaptive-sports/) since 1994, run jointly by the Iowa City VA Medical Center and Disabled American Veterans, and it's grown into a multi-sport adaptive program covering bowling, air rifle, bicycling, and kayaking. The clinic functions as an on-ramp: a wounded veteran tries an adaptive sport, the VA offers a [monthly training stipend](https://news.va.gov/93655/meet-the-21-military-veterans-representing-team-usa-at-the-paralympic-games/), and the pipeline runs into the Paralympic team.

New Mexico's high share has the same explanation — Sandia, White Sands, deep VA presence in Albuquerque — combined with a smaller overall athlete count making ratios swing more.

The deeper observation: the **Paralympic-state geography is not a remix of the Olympic-state geography.** It's its own map, anchored to where the country has historically broken its veterans and then offered them a way back through sport.
`,

  colleges: `
## Olympians per athletic dollar

**Westminster University** in Salt Lake City — total athletic budget about **$5 million** — has produced **22 Olympians**. That's **4.4 Olympians per million dollars**, the most efficient program in the country by a wide margin. **Salt Lake Community College** is second; **Colorado Mountain College** third.

The pattern has one explanation: these schools ride a free elevator the giants of NCAA athletics can't. Westminster runs the official [U.S. Ski & Snowboard college partnership](https://www.usskiandsnowboard.org/news/westminster-university-re-launches-partnership-us-ski-snowboard) — freeskiers and snowboarders training at Woodward Park City attend Westminster on full tuition. The school has produced **50+ Olympians/Paralympians with 10 medals**, including freeski silver medalist Devin Logan. The program's budget is near zero by NCAA standards because the *training* happens at the adjacent Olympic Park, paid for by the federation.

Down the list, similar stories:
- **Bemidji State, MN** — $8M budget, 11 Olympians (1.4/$M). Bemidji is [the Curling Capital of the United States](https://en.wikipedia.org/wiki/Bemidji_Curling_Club).
- **Univ. of Central Oklahoma**, **Marian (IN)**, **Wisconsin-Whitewater**, **Northern Michigan** — all 1.0+ Olympians per $M, each anchoring a sport-specific scene.

Compare to the Ivies. Princeton ($42M, 39 Olympians, 0.93/$M) and Harvard ($50M, 41, 0.82/$M) are nationally extraordinary, but on a per-dollar basis trail the mountain-sport schools. **The ranking isn't about prestige — it's about how aligned a school's budget is with one specific Olympic pipeline.**
`,

  per_capita: `
## Olympians per 100k residents

Reorder the country by population-normalized output and the map reshuffles violently:

| Rank | State | Per 100k |
|---|---|---|
| 1 | **Vermont** | 6.80 |
| 2 | Alaska | 5.73 |
| 3 | Colorado | 4.49 |
| 4 | Minnesota | 3.99 |
| 5 | Hawaii | 3.62 |

The national average is **2.11 per 100k**. Vermont produces Olympians at *more than 3× the national rate.*

[Vermont's outsized output](https://skivermont.com/vermonts-olympic-success) isn't really about snow — every northern state has snow. It's about *how Vermont organizes around winter*. The state hosts **Burke Mountain Academy**, the [first ski racing academy in North America](https://en.wikipedia.org/wiki/Burke_Mountain_Academy), which has produced **40+ Olympians and 154+ National Ski Team members** since 1970 (Mikaela Shiffrin among them). Vermont ranks first nationally for civic participation; over 40% of residents volunteer in some capacity — much of it coaching kids on snow.

Alaska's pipeline is thinner but just as cultural. The [Nordic Skiing Association of Anchorage](https://anchoragenordicski.com/programs/junior-nordic/) runs Junior Nordic for kids 6–14 of all abilities. **Kincaid Park** — 60 km of trails through 1,400 acres — is the operational base for a winter-sports ecosystem that punches at Norwegian density.

California, which dominates raw counts, falls to **8th place at 2.47/100k.**
`,

  hs_conversion: `
## From high-school field to podium

This metric asks a different question: *of every million kids playing high-school sports, how many become Olympians?*

| Rank | State | per Million HS |
|---|---|---:|
| 1 | **Alaska** | 2,989 |
| 2 | **Vermont** | 2,910 |
| 3 | Colorado | 2,064 |
| 4 | Hawaii | 1,840 |
| 5 | Minnesota | 1,659 |

Alaska converts at **27× the rate of Texas.** The reason is partly arithmetic — Alaska has only 14,050 HS sports participants total — and partly cultural. The same Junior Nordic and biathlon ecosystems driving the per-capita ranking concentrate the state's athletic talent into pipelines that *actually feed the Olympics*. A kid playing varsity football in Texas is on a path that produces NFL stars, not Olympians. A kid skiing through Kincaid Park is on a path that does.

Vermont (Burke Mountain Academy, US Ski Team feeder) and Colorado (mountain-resort ski racing) follow the same logic.

The opposite end of the table is humbling. Texas, Florida, and the rest of the Sun Belt — states whose high-school sports systems are the largest and most professionalized in America — convert at roughly **150–300 Olympians per million**, an order of magnitude lower. **The American high-school system is enormous; very little of it points at the Olympics.**
`,

  era: `
## How the map moved

The decade-by-decade table comes with a caveat the data can't hide: **Team USA's own roster skews toward currently-active athletes.** The national row 52 → 89 → 368 → 1,298 → 1,716 mostly reflects who's still profiled on teamusa.com, not who actually competed in 1984.

What *is* meaningful is the **swing column** — which states grew fastest relative to the others.

Topping the swing rankings: **Michigan ×99**, **Colorado ×68**, **Massachusetts ×46**, **Missouri ×44**, **Pennsylvania ×40**, **Utah ×39**, **Vermont ×36**.

Two patterns underwrite that list:

**Sun Belt growth**: [12 of the 15 fastest-growing U.S. cities are in the Sun Belt](https://en.wikipedia.org/wiki/Sun_Belt). The swing column shows Texas, Arizona, North Carolina, and Connecticut all climbing into the top 15 as families relocated and built training infrastructure in places that didn't have it in 1985.

**Mountain-state institutionalization**: Colorado built Olympic Training Center infrastructure starting in 1978; Utah followed in the 1990s and exploded after 2002. The swing captures both states absorbing serious Olympic talent that previously came from California or the Northeast.

What the table does *not* show is decline. No state's swing is below 1.0 — partly because of dataset bias, but also because **the geography of American Olympic development has become more distributed over time, not less.** The country produces Olympians from more places now than it did in 1985. The map widened.
`,
};
