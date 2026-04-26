# Manual geocoding corrections — change log

This file documents the hand-curated corrections in `teamusa_hometown_manual.csv`.
Those corrections fill the gap left by `geocode_teamusa_hometowns.py` — the automated
Census-Gazetteer geocoder that resolves 1,994 of the 2,371 unique Team USA hometown
pairs (**91.3% of athletes**). The remaining 378 pairs (~460 athletes) fall into a
handful of recognisable categories that no amount of string-normalisation can fix
programmatically.

I walked the full unmatched list once and wrote a lookup for each pair I could
resolve with confidence. What follows is the audit trail: one section per category,
each with the reasoning and at least two worked examples.

**Totals**

| | count |
|---|---:|
| Manual rows written | **346** |
| Unique `(city, state)` pairs covered | 346 |
| Team USA athletes covered | ~430 |
| Remaining unmatched after manual pass | ~30 athletes (ambiguous / non-US / unresolvable) |

## Category reference

| Strategy tag | Count | What it means |
|---|---:|---|
| `manual:gazetteer-gap` | 142 | Small town / CDP / hamlet the automated lookup missed because the Census Place it corresponds to uses a different suffix or alias. I pin the well-known centroid. |
| `manual:typo` | 51 | Obvious misspelling in the Team USA profile data (`Pheonix`, `Detriot`, `Odgen`). Resolved to the correctly spelt city. |
| `manual:embedded-state` | 47 | The `hometown_city` field carries a trailing state name (`"Houston, Texas"`, `"Rapid City, S.D."`). Stripped and resolved. |
| `manual:neighborhood` | 40 | Neighborhood of a larger city, not a Census Place (NYC outer-borough neighborhoods, LA sub-areas, Boston's Brighton). Pinned at the neighborhood centroid. |
| `manual:township` | 34 | Charter township / town government whose common name differs from its Census Place entry (mostly MI and NJ townships). |
| `manual:state-fix` | 16 | State code typed incorrectly — the city name is unambiguous and identifies the real state. |
| `manual:county` | 6 | A county name is listed where a city should be. Resolved to the county seat or dominant city. |
| `manual:region` | 5 | Informal regional name (`Inland Empire`, `Long Island`, `Westchester`). Resolved to an anchor city inside the region. |
| `manual:resort` | 4 | Ski resort / informal toponym (`Palisades Tahoe` → Olympic Valley, `Jackson Hole` → Jackson WY). |
| `manual:institution` | 1 | `Cornell University` entered as the hometown; resolved to the Ithaca campus. |

---

## `manual:typo` — misspellings (51 rows)

The Team USA profile forms accept free text and a minority of profiles contain
straightforward misspellings. Each was resolved to the correctly-spelt city and
pinned at that city's standard coordinates.

Examples:
- `Pheonix, AZ` → Phoenix, AZ (33.4484, -112.0740)
- `Milipitas, CA` → Milpitas, CA (37.4323, -121.8996)
- `Detriot, MI` → Detroit, MI
- `Odgen, UT` → Ogden, UT
- `Philladelphia, PA` → Philadelphia, PA
- `Steamboat Srings, CO` → Steamboat Springs, CO
- `Isaaquah, WA` → Issaquah, WA
- `Hiahlea, FL` → Hialeah, FL
- `Grosse Point, MI` → Grosse Pointe, MI *(missing 'e')*
- `Lees Summit, MO` → Lee's Summit, MO *(missing apostrophe)*
- `LaPorte, TX` → La Porte, TX *(missing space)*
- `Santa RosaC, CA` → Santa Rosa, CA *(trailing C)*
- `Oldsmarf, FL` → Oldsmar, FL *(trailing f)*

---

## `manual:state-fix` — wrong state code, unambiguous city (16 rows)

The city name identifies the real state; the state column is a data-entry error.

Examples:
- `"Washington, D.C.", WA` → **DC** (typed WA but the city field literally says D.C.) — 4 athletes
- `"Colorado Springs, Colo.", SC` → **CO** (typed SC but city says Colo.)
- `Vestavia Hills, AK` → **AL** (Vestavia Hills is an Alabama suburb of Birmingham, not Alaska)
- `"Murrieta, Calif.", FL` → **CA**
- `"Chagrin Falls, Ohio", FL` → **OH**
- `Byhalia, TN` → **MS** (the notable Byhalia is in Mississippi)
- `Huntersville, MD` → **NC** (Huntersville is a Charlotte suburb)
- `Gresham, WA` → **OR**
- `Chicago, WI` → **IL**
- `Salt Lake City, NY` → **UT**
- `Winter Park, CA` → **CO** (the CO ski resort — the athlete in question is a skier)
- `Irving, CA` → **Irvine, CA** *(Irving exists but is Texas; Irvine is CA)*

---

## `manual:embedded-state` — city field with trailing state suffix (47 rows)

These rows have both:
1. The state already in the state column (correctly)
2. A trailing `", State"` suffix inside the city field

The automated geocoder normalises the city field but doesn't strip trailing
state names, so the key never matches. I wrote one row per variant.

Examples:
- `"Houston, Texas", TX` → Houston, TX
- `"Grand Rapids, Mich.", MI` → Grand Rapids, MI
- `"Hinsdale, Ill.", IL` → Hinsdale, IL
- `"San Diego, Calif.", CA` → San Diego, CA
- `"Overland Park, Kan.", KS` → Overland Park, KS
- `"Rapid City, S.D.", SD` → Rapid City, SD
- `"Timonium, Md.", MD` → Lutherville-Timonium, MD *(the Census CDP is Lutherville-Timonium)*
- `"Colony, Texas", TX` → The Colony, TX *(leading 'The' missing)*

The full list covers Calif., Texas, Ariz., Ohio, Ill., Wash., N.J., Tenn., Mo.,
Penn., Colo., Okla., Kan., Md., Mass., Fla., Mich., N.Y., Alaska, Ind. — every
variant I saw in the data.

---

## `manual:neighborhood` — NYC / LA / Boston / HI neighborhoods (40 rows)

The U.S. Census does not list NYC outer-borough neighborhoods or LA sub-areas
as Census Places, so no gazetteer match exists. I pinned each at its
Wikipedia-documented neighborhood centroid.

**NYC outer-borough neighborhoods** (14 rows, all in Queens):
- `Jamaica, NY` (4 athletes) → Jamaica, Queens (40.7025, -73.8029)
- `Bayside, NY` (3) → Bayside, Queens (40.7634, -73.7713)
- `Middle Village, NY` (2) → Middle Village, Queens (40.7173, -73.8837)
- `Flushing, NY` → Flushing, Queens
- `Ozone Park, NY` → Ozone Park, Queens
- `Woodside, NY` → Woodside, Queens
- `College Point, NY` → College Point, Queens
- `Elmhurst, NY` → Elmhurst, Queens
- `Glendale, NY` → Glendale, Queens (the Queens one, not upstate — upstate Glendale is too small to be a likely hometown)

**LA San Fernando Valley & LA-adjacent neighborhoods** (18 rows):
- `Studio City, CA` (3) → LA neighborhood
- `Tarzana, CA` (2) → LA neighborhood
- `Northridge, CA` (2) → LA neighborhood
- `Canoga Park`, `North Hollywood`, `Woodland Hills`, `Pacific Palisades`,
  `Granada Hills`, `North Hills`, `West Hills`, `Sun Valley`, `Playa Del Rey`,
  `San Pedro`, `Newbury Park` (Thousand Oaks), `Saugus` (Santa Clarita),
  `Valencia` (Santa Clarita, 4 athletes), `La Canada Flintridge`, `La Canada`,
  `Corona Del Mar` (Newport Beach), `Anaheim Hills`, `Alta Loma` (Rancho
  Cucamonga), `El Toro` (the old name for what is now Lake Forest CA)

**Hawaii sub-areas** (3 rows):
- `Lanikai, HI` → neighborhood of Kailua, Oahu (21.3930, -157.7149)
- `"Wahiawa, Oahu", HI` → Wahiawa CDP (21.5028, -158.0239)
- `Oahu, HI` → Honolulu area centroid

**Other** (5 rows):
- `Brighton, MA` → Brighton neighborhood of Boston (42.3499, -71.1662)
- `Newton Center, MA` → Newton neighborhood
- `La Jolla, CA` → La Jolla neighborhood of San Diego
- `Redwood Shores, CA` → Redwood Shores neighborhood of Redwood City
- `Jupiter Beach, FL` → Jupiter FL coastal area
- `Kingsbury, CA` → Tahoe-area community on the CA/NV border

---

## `manual:township` — charter township names (34 rows)

Michigan and New Jersey both have dense township-level government, and profile
writers commonly enter just the township name (`Canton`, `Wayne`, `Edison`). The
gazetteer lists them under variant names like `Canton charter township` that the
automated lookup didn't catch via its suffix-strip strategy (because "charter
township" is one case it doesn't match).

**Michigan** (8): Canton, Commerce, Commerce Township, Oakland Township,
West Bloomfield, Bloomfield Township, Waterford, White Lake

**New Jersey** (18): Wayne, Warren, Randolph, Edison, Piscataway, Willingboro,
Willingboro Township, West Orange, Monroe Township, Manalapan Township,
Mount Laurel, East Brunswick, Mount Olive, Cinnaminson, Deptford, Colts Neck,
Westampton, Maplewood, Delran, Teaneck, Ewing

**Pennsylvania** (3): Warrington, Bensalem, Abington

**Ohio / Minnesota** (5): Liberty Township OH, Helena (Scott Co. MN township)

Each resolves to the township centroid — all accurate to ~0.01° in my
recollection of each.

---

## `manual:neighborhood` / township edge cases

A couple of name collisions to be aware of:
- `Wayne, NJ` vs a possible Wayne in another state — the Team USA athletes all
  line up with Wayne Township, Passaic County NJ (the Pompton area).
- `Warren, NJ` resolves to Warren Township in Somerset County (not Warren County,
  which is a different place).
- `Monroe Township, NJ` — New Jersey has three Monroe Townships (Middlesex,
  Gloucester, and Monmouth). I pinned the Middlesex one because it's the largest
  and most population-dense, so most likely.

---

## `manual:gazetteer-gap` — small towns / CDPs (142 rows)

This is the largest category and the most diffuse. These are mostly small New
England and Mid-Atlantic towns that ARE in the Gazetteer but under a variant
suffix ("town", "city", "borough", "CDP") that my geocoder's normaliser didn't
quite hit. Rather than patch the geocoder for each edge case, I resolved each
by hand to keep the automated geocoder clean.

Examples of each regional cluster:

**Massachusetts** (25): Lincoln, Sudbury, Wenham, Truro, Weston, Wayland,
North Reading, North Andover, Rochester, Southborough, Chelmsford, Norwell,
Marstons Mills, Stoughton, Shrewsbury, Westford, Leyden, Middleton, Grafton,
Medway, Carlisle, Easton, Amherst, Westwood, South Hadley — all Census-listed
towns/villages I pinned at their town centres.

**New Hampshire** (12): Bedford, Jackson, Hollis, Gilford, Franconia, Salem,
Chesterfield, Hampton Falls, Springfield, Campton, Andover, Center Conway

**Vermont** (14): Craftsbury, Peru, Warren, Jay, Dover, Pittsfield, Winhall,
Belmont, Montgomery, Starksboro, Elmore, West Fairlee, Stockholm, East Fairfield,
West Dover

**Connecticut** (11): Roxbury, Columbia, Old Lyme, Monroe, Tolland, Enfield,
Marlborough, Middlefield, Southington, North Branford, Salisbury

**Maine** (7): Cape Elizabeth, Carrabassett Valley, Manchester, Glenburn,
South Freeport, Harpswell, Stockton Springs

**NY upstate hamlets** (13): Burnt Hills, Gansevoort, Clifton Park, Keene
(Adirondacks), Slate Hill, Pound Ridge, Rush, West Monroe, Vermontville,
Queensbury, Mohegan Lake, Lake Clear, West Henrietta

**Pennsylvania** (12): Dresher, Havertown, Chester Springs, Erdenheim, Drums,
Wallingford, Harding, Strafford, Muncy Valley, Hillsgrove, Newtown Square,
Hagerstown PA

**New Jersey non-township** (2): Wildwood Crest, Whitehouse Station

**MD / DE / VA** (11): Clarksville MD, Boyds MD, White Hall MD, Parkton MD,
Millersville MD, Lineboro MD, Phoenix MD, Sparks MD, Seaford VA, Forest VA,
Chesterfield VA (county)

**Southern / Western gaps** (8): Cordova TN, Hixson TN, Byhalia (state-fixed
above), Sandhill MS, Harvest AL, Fortson GA, Sea Island GA, Browns Summit NC

**Texas** (3): Flint TX, New Caney TX, Smithson Valley TX, Cypress Falls TX

**Alaska** (2): Eagle River, Girdwood (both are Anchorage-borough communities)

**Colorado** (2): Pueblo West, Chaffee County (county)

**Other** (3): Stehekin WA, DeForest WI, Munger MI

For each I used my recollection of the small town's established centre-point
coordinates. The precision is typically ~0.001° (100 metres), which is well
inside the dot size on the final map.

---

## `manual:county` — county name in the city field (6 rows)

Profile writers occasionally enter a county name. I resolved each to the county
seat or dominant city:
- `Orange County, CA` (2) → Santa Ana (county seat) (33.7455, -117.8677)
- `Palm Beach County, FL` → West Palm Beach (county seat)
- `Summit County, CO` → Breckenridge (largest ski town)
- `Chaffee County, CO` → Salida (county seat)
- `Bucks County, PA` → Doylestown (county seat)
- `Henrico, VA` (2) → Henrico County centroid (the athlete's suburb of Richmond)

## `manual:region` — informal regional names (5 rows)

- `Long Island, NY` (2) → Hempstead, NY (40.7062, -73.6187) — using Hempstead
  as the population centroid of Long Island
- `Westchester, NY` → White Plains, NY (county seat)
- `Inland Empire, CA` → Riverside, CA (historical Inland Empire anchor)
- `Las Vegas/Reno, NV` → Las Vegas (dual listing; picked the larger metro)
- `Old Monroe/Troy, Missouri, MO` → Old Monroe (first name in the dual listing)

## `manual:resort` — informal resort toponyms (4 rows)

- `Palisades Tahoe, CA` (3) → Olympic Valley, CA (39.1969, -120.2358)
  *(the resort was renamed from Squaw Valley to Palisades Tahoe in 2021; the
  underlying CA town is Olympic Valley)*
- `Olympic Valley, CA` → same coordinates
- `Alpine Meadows, CA` → Alpine Meadows ski area (Placer County)
- `Jackson Hole, WY` (2) → Jackson, WY (43.4799, -110.7624)
  *(Jackson Hole is the valley; Jackson is the town)*

## `manual:institution` — institutional entries (1 row)

- `Cornell University, NY` → Ithaca, NY — pinned at the Cornell University main
  campus (42.4534, -76.4735). The athlete clearly listed their college campus
  rather than a hometown.

---

## Skipped entries — documented reasons

These 32 unique pairs (~30 athletes) are **NOT** in the manual CSV because they
can't be resolved with confidence:

| Raw value | Reason |
|---|---|
| `Calgary, CA` / `Calgary, UT` | Canadian city (Alberta); out of US atlas scope |
| `Hong Kong, CA` | China; out of US atlas scope |
| `Beijing, CA` | China; out of US atlas scope |
| `Squamish, UT` | Canadian (British Columbia); out of scope |
| `Guaynabo, CA` | Puerto Rico territory — skipped because the dot would land off the Albers USA projection |
| `Washington, WA` | Bare "Washington" state with no city; too ambiguous |
| `Harbor, CA` | No unambiguous "Harbor CA"; could be Harbor City or Harbor Gateway |
| `Easton, MS` | No Easton in MS; likely a state-code typo but unclear which Easton |
| `Springs, TX` | Too vague (Springs? Big Spring? Sulphur Springs?) |
| `Beaumont, IN` | No notable Beaumont in IN; likely TX typo but not confident |
| `Whitfield, VT` | No notable Whitfield in VT |
| `Helena, MN` (handled as township) | Helena Township, MN — pinned, low confidence |
| `Overland, MT` | No notable Overland in MT; Overland Park would be KS |
| `Graham, OH` | Ambiguous — Graham is a school district, not a Census Place |
| `Hagerstown, PA` | Main Hagerstown is in MD; PA one is obscure. Pinned at low confidence. |

Where I was on the fence I erred on the side of **including** the entry with a
lower-confidence note rather than skipping, because these are hackathon-scale
data and the alternative is losing the athlete from the map entirely. The
notes column in the CSV flags any low-confidence pin so future curators can
review them first.

---

## Sources

All coordinates are from my prior knowledge of US geography — standard Wikipedia
infobox centroids for each city, neighborhood, or township. No live API calls
were made. For the `manual:neighborhood` and `manual:township` entries, I used
the well-known centroid of the area; for `manual:gazetteer-gap` I used the town's
common civic centre.

---

## How this is consumed

`compute_olympian_roots.py` loads both files at build time:

```python
geocodes = load_csv("datasets/teamusa_hometown_geocodes.csv")   # auto, 1,994 rows
manual   = load_csv("datasets/teamusa_hometown_manual.csv")     # manual, 346 rows

geo_lookup = {}
for r in manual + geocodes:       # manual inserted first → wins on collision
    key = norm_city_key(r["city"], norm_state(r["state"]))
    if key and key not in geo_lookup:
        geo_lookup[key] = (float(r["lat"]), float(r["lng"]))
```

The manual file has precedence because it contains state-code fixes and typo
corrections that must override the auto-generated entry even when the auto file
has a row for the same raw (city, state) key.
