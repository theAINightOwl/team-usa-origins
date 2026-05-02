#!/usr/bin/env python3
"""
geocode_teamusa_hometowns.py
============================

Stand-alone geocoder that resolves every (hometown_city, hometown_state)
pair present in ``team_usa_athletes.csv`` to latitude + longitude using the
**2023 U.S. Census Gazetteer — Places file**.

Inputs
------
- ``team_usa_athletes.csv``  (scraped directly from teamusa.com/api/athletes)
- 2023 Census Gazetteer, Places file
  (https://www2.census.gov/geo/docs/maps-data/data/gazetteer/
   2023_Gazetteer/2023_Gaz_place_national.zip)
  Downloaded on first run and cached under ``.cache/``.

Output
------
- ``data/teamusa_hometown_geocodes.csv``
  Columns: city, state, lat, lng, canonical_name, strategy, n_athletes

Matching Strategy (applied in order, first hit wins)
----------------------------------------------------
1. **direct**          normalised (city, state) exact match
2. **saint**           "St. X" ↔ "Saint X" canonicalisation
3. **suffix-strip**    gazetteer names often carry "city/town/village/CDP/
                       borough/township" suffixes; try without them
4. **suffix-add**      the reverse: try adding common suffixes to our query
5. **ending-strip**    strip trailing hyphenated qualifiers (e.g. "Mt.
                       Pleasant-Mountain" → "Mt. Pleasant")
6. **contains**        last resort: any gazetteer name within the given
                       state whose normalised form contains the query
7. **override**        hand-picked entries (NYC boroughs, DC variants,
                       Honolulu, etc.) covered first, before the gazetteer

All strategies use the same normalisation: lowercase, strip accents, drop
punctuation, collapse whitespace.

Run
---
::

    python3 geocode_teamusa_hometowns.py

No third-party dependencies — stdlib only.
"""

import csv
import io
import re
import ssl
import sys
import unicodedata
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────
TEAMUSA_CSV = Path("data/team_usa_athletes.csv")
OUTPUT_CSV = Path("data/teamusa_hometown_geocodes.csv")
CACHE_DIR = Path(".cache")
CACHE_ZIP = CACHE_DIR / "2023_Gaz_place_national.zip"
GAZ_URL = (
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
    "2023_Gazetteer/2023_Gaz_place_national.zip"
)

# ── State-name / abbreviation normalisation ───────────────────────────
STATE_ABBR = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI",
    "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY",
}
ABBR_OK = set(STATE_ABBR.values())

NULL_SENTINELS = {"", "None", "NA", "null", "-", "N/A"}

# ── Manual overrides for places the Gazetteer doesn't list as Places ──
# (Census places don't include NYC boroughs; DC and HI have naming quirks.)
OVERRIDES = {
    ("brooklyn", "NY"):        (40.6782, -73.9442, "New York City (Brooklyn)"),
    ("queens", "NY"):          (40.7282, -73.7949, "New York City (Queens)"),
    ("bronx", "NY"):            (40.8448, -73.8648, "New York City (Bronx)"),
    ("the bronx", "NY"):       (40.8448, -73.8648, "New York City (Bronx)"),
    ("manhattan", "NY"):       (40.7831, -73.9712, "New York City (Manhattan)"),
    ("staten island", "NY"):   (40.5795, -74.1502, "New York City (Staten Island)"),
    ("new york city", "NY"):   (40.7128, -74.0060, "New York City"),
    ("nyc", "NY"):              (40.7128, -74.0060, "New York City"),
    ("washington dc", "DC"):   (38.9072, -77.0369, "Washington, D.C."),
    ("washington d c", "DC"):  (38.9072, -77.0369, "Washington, D.C."),
    ("washington", "DC"):      (38.9072, -77.0369, "Washington, D.C."),
    ("honolulu", "HI"):        (21.3099, -157.8581, "Honolulu"),
    ("las vegas", "NV"):       (36.1699, -115.1398, "Las Vegas"),
    ("paradise", "NV"):        (36.0972, -115.1485, "Paradise"),
    ("the woodlands", "TX"):   (30.1658, -95.4613, "The Woodlands"),
}


# ── Normalisation helpers ─────────────────────────────────────────────
SUFFIXES_TO_STRIP = (
    " city", " town", " village", " borough", " township", " cdp",
    " (cdp)", " (city)", " (town)",
)

_ws_re = re.compile(r"\s+")
_punc_re = re.compile(r"[^a-z0-9\s]")


def norm(s):
    """Lowercase, strip accents, drop punctuation, collapse whitespace."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower()
    s = s.replace("st.", "saint")
    s = s.replace("st ", "saint ")
    s = s.replace("ft.", "fort")
    s = s.replace("mt.", "mount")
    s = _punc_re.sub(" ", s)
    s = _ws_re.sub(" ", s).strip()
    return s


def strip_suffix(name):
    """Remove common Census Gazetteer suffixes if present."""
    for suf in SUFFIXES_TO_STRIP:
        if name.endswith(suf):
            return name[: -len(suf)].strip()
    return name


def state_abbr(v):
    if not v:
        return ""
    v = v.strip()
    if v in NULL_SENTINELS:
        return ""
    if len(v) == 2 and v.upper() in ABBR_OK:
        return v.upper()
    return STATE_ABBR.get(v, "")


# ── Gazetteer loader ──────────────────────────────────────────────────
def ensure_gazetteer():
    """Download the Gazetteer zip to .cache/ if not already present."""
    if CACHE_ZIP.exists():
        return
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading Census Gazetteer from {GAZ_URL} …", file=sys.stderr)
    req = urllib.request.Request(
        GAZ_URL,
        headers={"User-Agent": "team-usa-hackathon geocoder/1.0"},
    )
    # The project's other scrapers disable TLS verification for compatibility
    # with the macOS Python SSL store (see DATASET_CREATION.md). Matching that
    # behaviour keeps the script runnable out of the box.
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
        data = resp.read()
    CACHE_ZIP.write_bytes(data)
    print(f"  cached {len(data):,} bytes at {CACHE_ZIP}", file=sys.stderr)


def load_gazetteer():
    """
    Return two lookups:
      • by_key:      {(normalised_name, state_abbr): (lat, lng, canonical_name)}
      • by_state:    {state_abbr: [(normalised_name, canonical_name, lat, lng), ...]}
    """
    ensure_gazetteer()
    by_key = {}
    by_state = defaultdict(list)

    with zipfile.ZipFile(CACHE_ZIP) as zf:
        fname = next((n for n in zf.namelist() if n.endswith(".txt")), None)
        if not fname:
            raise SystemExit(f"Gazetteer zip has no .txt file: {zf.namelist()}")
        raw = zf.read(fname).decode("latin-1")

    # The Census file uses tab separators with a trailing whitespace quirk
    # in column names — strip them before parsing.
    lines = raw.splitlines()
    header = [h.strip() for h in lines[0].split("\t")]
    col_state = header.index("USPS")
    col_name = header.index("NAME")
    col_lat = header.index("INTPTLAT")
    col_lng = header.index("INTPTLONG")

    count = 0
    for line in lines[1:]:
        parts = line.split("\t")
        if len(parts) <= col_lng:
            continue
        st = parts[col_state].strip()
        name = parts[col_name].strip()
        try:
            lat = float(parts[col_lat].strip())
            lng = float(parts[col_lng].strip())
        except ValueError:
            continue
        if st not in ABBR_OK and st != "DC":
            continue

        n_full = norm(name)
        n_bare = norm(strip_suffix(n_full))

        # Register both the full and stripped form in the direct lookup.
        for key_name in {n_full, n_bare}:
            if key_name:
                by_key.setdefault((key_name, st), (lat, lng, name))

        by_state[st].append((n_bare or n_full, name, lat, lng))
        count += 1

    print(f"  Gazetteer places loaded: {count:,} "
          f"({len(by_key):,} lookup keys, {len(by_state)} states)",
          file=sys.stderr)
    return by_key, by_state


# ── Core geocoder ─────────────────────────────────────────────────────
def geocode(city_raw, state, by_key, by_state):
    """
    Try each strategy in order. Return (lat, lng, canonical, strategy) or
    None if nothing matched.
    """
    st = state_abbr(state)
    if not st or not city_raw:
        return None

    query = norm(city_raw)
    if not query:
        return None

    # 0. Hand-picked overrides (for places the Gazetteer doesn't list).
    ov = OVERRIDES.get((query, st))
    if ov:
        return (ov[0], ov[1], ov[2], "override")

    # 1. Direct match on the normalised full name.
    hit = by_key.get((query, st))
    if hit:
        return (hit[0], hit[1], hit[2], "direct")

    # 2. Strip trailing suffix from the query and try again.
    q_bare = strip_suffix(query)
    if q_bare != query:
        hit = by_key.get((q_bare, st))
        if hit:
            return (hit[0], hit[1], hit[2], "suffix-strip")

    # 3. Add common suffixes to the query and try each.
    for suf in ("city", "town", "village", "borough"):
        candidate = f"{query} {suf}"
        hit = by_key.get((candidate, st))
        if hit:
            return (hit[0], hit[1], hit[2], f"suffix-add:{suf}")

    # 4. Handle hyphenated compound names — try the first segment only.
    if "-" in city_raw:
        left = norm(city_raw.split("-", 1)[0])
        if left and left != query:
            hit = by_key.get((left, st))
            if hit:
                return (hit[0], hit[1], hit[2], "hyphen-left")

    # 5. Contains fallback: any gazetteer place in the state whose
    #    normalised name starts with the query.
    candidates = by_state.get(st, [])
    starts = [c for c in candidates if c[0].startswith(query + " ") or c[0] == query]
    if len(starts) == 1:
        n, canon, lat, lng = starts[0]
        return (lat, lng, canon, "state-starts")
    if len(starts) > 1:
        # Prefer exact match when multiple starts found.
        exact = [c for c in starts if c[0] == query]
        if len(exact) == 1:
            n, canon, lat, lng = exact[0]
            return (lat, lng, canon, "state-starts-exact")

    # 6. Broader contains: gazetteer name contains query as a word.
    contains = [c for c in candidates if f" {query} " in f" {c[0]} "]
    if len(contains) == 1:
        n, canon, lat, lng = contains[0]
        return (lat, lng, canon, "state-contains")

    return None


# ── Pipeline ──────────────────────────────────────────────────────────
def main():
    if not TEAMUSA_CSV.exists():
        raise SystemExit(f"Missing {TEAMUSA_CSV}")

    # Collect unique (city, state) pairs and athlete counts.
    pairs = Counter()
    with open(TEAMUSA_CSV, newline="") as f:
        for row in csv.DictReader(f):
            city = (row.get("hometown_city") or "").strip()
            state = state_abbr(row.get("hometown_state") or "")
            if not city or city in NULL_SENTINELS or not state:
                continue
            pairs[(city, state)] += 1

    print(f"Team USA unique (city, state) pairs: {len(pairs):,} "
          f"covering {sum(pairs.values()):,} athletes")

    by_key, by_state = load_gazetteer()

    # Geocode each pair once.
    rows = []
    matched = 0
    strategy_counts = Counter()
    unmatched = []

    for (city, state), n in pairs.most_common():
        result = geocode(city, state, by_key, by_state)
        if result:
            lat, lng, canonical, strategy = result
            rows.append({
                "city": city,
                "state": state,
                "lat": round(lat, 5),
                "lng": round(lng, 5),
                "canonical_name": canonical,
                "strategy": strategy,
                "n_athletes": n,
            })
            matched += n
            strategy_counts[strategy] += 1
        else:
            unmatched.append((city, state, n))

    total_athletes = sum(pairs.values())
    print(f"\nMatched unique pairs : {len(rows):>5,} / {len(pairs):,} "
          f"({len(rows) / max(1, len(pairs)) * 100:5.1f}%)")
    print(f"Matched athletes     : {matched:>5,} / {total_athletes:,} "
          f"({matched / max(1, total_athletes) * 100:5.1f}%)")
    print("\nStrategy distribution (unique pairs):")
    for s, n in strategy_counts.most_common():
        print(f"  {s:<24} {n:>5,}")

    if unmatched:
        unmatched_sorted = sorted(unmatched, key=lambda x: -x[2])
        print(f"\nTop unmatched pairs ({len(unmatched)} total):")
        for city, state, n in unmatched_sorted[:20]:
            print(f"  {n:>4} × {city}, {state}")

    # Write the lookup CSV sorted by athlete count (most common first).
    rows.sort(key=lambda r: (-r["n_athletes"], r["state"], r["city"]))
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["city", "state", "lat", "lng", "canonical_name", "strategy", "n_athletes"],
        )
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
    print(f"\nWrote {len(rows):,} rows → {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
