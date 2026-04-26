#!/usr/bin/env python3
"""
Compute pre-baked JSON data for the `olympian-roots` map app.

Athlete list is taken **directly from the Team USA website scrape**
(`team_usa_athletes.csv`, 8,651 rows) — no Olympedia or Paralympic.org
blending. Hometown coordinates are looked up from
`datasets/teamusa_hometown_geocodes.csv`, produced by the stand-alone
`geocode_teamusa_hometowns.py` script (matches Team USA hometowns against
the 2023 U.S. Census Gazetteer).

Support datasets (training centers, EADA, NFHS, demographics, climate,
sport-family mapping) are unchanged — they are reference tables, not
athlete records.

Outputs (olympian-roots/src/data/*.json):
  - athletes.json
  - training_centers.json
  - colleges.json
  - states.json
  - sport_families.json

Run once:
  python3 compute_olympian_roots.py
"""

import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

DATA_DIR = Path("data")
TEAMUSA_CSV = DATA_DIR / "team_usa_athletes.csv"          # <- canonical athlete list
GEOCODES_CSV = DATA_DIR / "teamusa_hometown_geocodes.csv" # <- from geocode_teamusa_hometowns.py
MANUAL_CSV = DATA_DIR / "teamusa_hometown_manual.csv"     # <- hand-curated; see _notes.md
OUT_DIR = Path("src/data")

FAMILY_COLORS = {
    "Aquatic":        "#2d5f7f",
    "Team Ball":      "#8b5a2b",
    "Combat":         "#722f37",
    "Track & Field":  "#c63d2f",
    "Endurance":      "#5a7a3f",
    "Gymnastics":     "#c89837",
    "Winter":         "#4a5d7e",
    "Precision":      "#6b5d3f",
    "Equestrian":     "#3d2817",
    "Racket":         "#8a7c3d",
    "Strength":       "#2e4a3a",
    "Other":          "#555050",
}

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
ABBR_STATE = {v: k for k, v in STATE_ABBR.items()}

# Team USA uses some sport names that differ from the sport-family mapping.
# This normalizes them so the family lookup hits.
SPORT_NAME_NORMALIZE = {
    "Track and Field": "Athletics",
    "Para Track and Field": "Para Athletics",
    "Para Track & Field": "Para Athletics",
}

NULL_SENTINELS = {"", "None", "NA", "null", "-"}


def norm_state(v):
    if v is None:
        return ""
    v = v.strip()
    if v in NULL_SENTINELS:
        return ""
    if len(v) == 2 and v.upper() in ABBR_STATE:
        return v.upper()
    return STATE_ABBR.get(v, "")


def norm_text(v):
    if v is None:
        return ""
    v = v.strip()
    return "" if v in NULL_SENTINELS else v


def norm_name(s):
    """Normalized school/institution name for fuzzy matching."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower()
    s = re.sub(r"\b(university|college|the|of|at)\b", " ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def norm_city_key(city, state):
    """Key for the (city, state) -> (lat, lng) lookup."""
    if not city or not state:
        return None
    c = unicodedata.normalize("NFKD", city).encode("ascii", "ignore").decode()
    c = c.lower().strip()
    c = re.sub(r"\b(city|town|village|borough|cdp)\b", "", c)
    c = re.sub(r"\bst\.", "saint", c)
    c = re.sub(r"\s+", " ", c).strip()
    return f"{c}|{state.upper()}"


def load_csv(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def to_float(v):
    try:
        return float(v) if v not in (None, "", "None", "NA") else None
    except (ValueError, TypeError):
        return None


def to_int(v):
    try:
        return int(float(v)) if v not in (None, "", "None", "NA") else None
    except (ValueError, TypeError):
        return None


def parse_years(s):
    """
    Parse a Team USA 'olympian_paralympian_years' field, e.g.
      "Olympian 2020, 2024"  ->  [2020, 2024]
      "Paralympian 2026"     ->  [2026]
      "None"                 ->  []
    """
    if not s or s in NULL_SENTINELS:
        return []
    return sorted({int(y) for y in re.findall(r"\b(19|20)(\d{2})\b", s) for y in [f"{y[0]}{y[1]}" if False else (int(y[0] + "0" + y[1]) if False else 0)]})


# Simpler year parser — previous attempt got too clever.
def parse_years_simple(s):
    if not s or s.strip() in NULL_SENTINELS:
        return []
    return sorted({int(m) for m in re.findall(r"\b(19\d{2}|20\d{2})\b", s)})


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # ── Load sources ────────────────────────────────────────────────────
    teamusa = load_csv(TEAMUSA_CSV)
    if not GEOCODES_CSV.exists():
        raise SystemExit(
            f"Missing {GEOCODES_CSV}. Run `python3 geocode_teamusa_hometowns.py` first."
        )
    geocodes = load_csv(GEOCODES_CSV)
    manual = load_csv(MANUAL_CSV) if MANUAL_CSV.exists() else []
    family_map = load_csv(DATA_DIR / "sport_family_mapping.csv")
    centers = load_csv(DATA_DIR / "training_centers.csv")
    colleges_raw = load_csv(DATA_DIR / "eada_college_sports.csv")
    nfhs = load_csv(DATA_DIR / "nfhs_participation.csv")
    demog = load_csv(DATA_DIR / "hometown_demographics.csv")
    climate = load_csv(DATA_DIR / "hometown_climate.csv")

    print(f"Loaded {len(teamusa):,} athletes (Team USA website)")
    print(f"Loaded {len(geocodes):,} auto-geocoded hometowns (Census Gazetteer)")
    print(f"Loaded {len(manual):,} manually-corrected hometowns "
          f"({'missing — optional' if not manual else 'overrides auto'})")
    print(f"Loaded {len(family_map)} sport-family rows, {len(centers)} training centers, "
          f"{len(colleges_raw):,} EADA rows, {len(nfhs):,} NFHS rows, "
          f"{len(demog):,} demographics rows, {len(climate)} climate rows")

    # ── (city, state) → (lat, lng) lookup ─────────────────────────────
    # Manual entries are inserted FIRST so they take precedence on any
    # (city, state) collision with the automated geocoder. This lets the
    # manual file override state-code fixes and typo corrections.
    geo_lookup = {}
    manual_key_hits = 0
    for r in manual + geocodes:
        city = norm_text(r.get("city"))
        st = norm_state(r.get("state"))
        lat = to_float(r.get("lat"))
        lng = to_float(r.get("lng"))
        if not (city and st and lat is not None and lng is not None):
            continue
        key = norm_city_key(city, st)
        if key and key not in geo_lookup:
            geo_lookup[key] = (round(lat, 4), round(lng, 4))
            if r in manual:
                manual_key_hits += 1
    print(f"Built geocoding lookup: {len(geo_lookup):,} (city, state) pairs "
          f"({manual_key_hits} from manual override)")

    # ── Sport family lookup ─────────────────────────────────────────────
    sport_to_family = {}
    for r in family_map:
        sport_to_family[r["sport"]] = {
            "family": r["sport_family"] or "Other",
            "is_paralympic": r.get("is_paralympic", "").lower() in ("true", "1", "yes"),
        }

    def family_of(sport):
        s = SPORT_NAME_NORMALIZE.get(sport, sport)
        return sport_to_family.get(s, {}).get("family", "Other")

    # ── 1. athletes.json — from Team USA website rows ───────────────────
    out_athletes = []
    family_counts = Counter()
    state_athletes = defaultdict(list)
    unmatched_cities = Counter()
    skipped_no_hometown = 0

    for row in teamusa:
        first = norm_text(row.get("first_name"))
        last = norm_text(row.get("last_name"))
        name = (first + " " + last).strip()
        if not name:
            continue

        city = norm_text(row.get("hometown_city"))
        st = norm_state(row.get("hometown_state"))
        if not city or not st:
            skipped_no_hometown += 1
            continue

        key = norm_city_key(city, st)
        coords = geo_lookup.get(key)
        if not coords:
            # Fallback: drop trailing descriptors ("city", "town") aggressively,
            # then try again. The lookup already normalises these but handle
            # occasional stragglers.
            unmatched_cities[f"{city}, {st}"] += 1
            continue
        lat, lng = coords

        sport_raw = norm_text(row.get("sport"))
        sport = SPORT_NAME_NORMALIZE.get(sport_raw, sport_raw)
        family = family_of(sport_raw)

        gold = to_int(row.get("gold_medals")) or 0
        silver = to_int(row.get("silver_medals")) or 0
        bronze = to_int(row.get("bronze_medals")) or 0
        total = gold + silver + bronze

        years = parse_years_simple(row.get("olympian_paralympian_years", ""))
        first_year = years[0] if years else None
        last_year = years[-1] if years else None
        games_count = len(years)

        op = norm_text(row.get("olympic_paralympic"))
        if op == "Paralympian":
            games_type = "Paralympic"
        elif op == "Olympian":
            games_type = "Olympic"
        elif op == "Team USA":
            games_type = "Hopeful"
        else:
            games_type = op or "Team USA"

        rec = {
            # NIL: never persist athlete name in the published bundle.
            "id": row.get("uid") or f"teamusa-{len(out_athletes)}",
            "gender": "",
            "sport": sport,
            "family": family,
            "first": first_year,
            "last": last_year,
            "games_count": games_count,
            "gold": gold,
            "silver": silver,
            "bronze": bronze,
            "total_medals": total,
            "type": games_type,
            "season": norm_text(row.get("sport_season")),
            "city": city,
            "state": st,
            "school": norm_text(row.get("education")),
            "lat": lat,
            "lng": lng,
        }
        out_athletes.append(rec)
        family_counts[family] += 1
        state_athletes[st].append(rec)

    print(f"\nLocated {len(out_athletes):,} athletes from Team USA")
    print(f"  skipped (no hometown city+state): {skipped_no_hometown:,}")
    print(f"  unmatched (city not in geocoding lookup): {sum(unmatched_cities.values()):,} "
          f"across {len(unmatched_cities)} unique city/state pairs")
    print(f"  families: {dict(family_counts.most_common())}")

    with open(OUT_DIR / "athletes.json", "w") as f:
        json.dump(out_athletes, f, separators=(",", ":"))

    # ── 2. training_centers.json ────────────────────────────────────────
    out_centers = []
    for r in centers:
        out_centers.append({
            "name": r["name"],
            "type": r.get("type", ""),
            "city": r.get("city", ""),
            "state": norm_state(r.get("state", "")),
            "lat": to_float(r.get("lat")),
            "lng": to_float(r.get("lng")),
            "sports_served": r.get("sports_served", ""),
            "year_opened": to_int(r.get("year_opened")),
            "paralympic": (r.get("paralympic", "") or "").lower() in ("true", "1", "yes"),
        })
    with open(OUT_DIR / "training_centers.json", "w") as f:
        json.dump(out_centers, f, indent=2)
    print(f"Wrote {len(out_centers)} training centers")

    # ── 3. colleges.json ────────────────────────────────────────────────
    latest_year = max(to_int(r.get("year")) or 0 for r in colleges_raw)
    latest_rows = [r for r in colleges_raw if to_int(r.get("year")) == latest_year]
    institution_names = {norm_name(r["institution_name"]): r["institution_name"] for r in latest_rows}

    olympians_by_school = Counter()
    for a in out_athletes:
        school = a.get("school", "")
        if not school:
            continue
        n = norm_name(school)
        if not n:
            continue
        if n in institution_names:
            olympians_by_school[institution_names[n]] += 1
            continue
        tokens = set(n.split())
        for key, canon in institution_names.items():
            key_tokens = set(key.split())
            if key_tokens and key_tokens.issubset(tokens):
                olympians_by_school[canon] += 1
                break

    out_colleges = []
    for r in latest_rows:
        out_colleges.append({
            "name": r["institution_name"],
            "state": norm_state(r.get("state", "")),
            "classification": r.get("classification", ""),
            "conference": r.get("conference", ""),
            "men": to_int(r.get("total_athletes_men")) or 0,
            "women": to_int(r.get("total_athletes_women")) or 0,
            "sports": to_int(r.get("total_sports")) or 0,
            "budget_m": to_float(r.get("athletic_budget_millions")),
            "olympians": olympians_by_school.get(r["institution_name"], 0),
        })
    out_colleges.sort(key=lambda x: -x["olympians"])
    with open(OUT_DIR / "colleges.json", "w") as f:
        json.dump(out_colleges, f, indent=2)
    print(f"Wrote {len(out_colleges)} colleges (year={latest_year}); "
          f"{sum(1 for c in out_colleges if c['olympians'] > 0)} matched to Team USA athletes")

    # ── 4. states.json ──────────────────────────────────────────────────
    nfhs_latest_year = max(to_int(r.get("year")) or 0 for r in nfhs)
    nfhs_by_state = defaultdict(int)
    nfhs_history = defaultdict(dict)
    for r in nfhs:
        yr = to_int(r.get("year"))
        if yr is None:
            continue
        st = norm_state(r.get("state", ""))
        p = to_int(r.get("participants")) or 0
        nfhs_history[st][yr] = nfhs_history[st].get(yr, 0) + p
        if yr == nfhs_latest_year:
            nfhs_by_state[st] += p

    dem_years_with_income = sorted({
        to_int(r.get("year"))
        for r in demog
        if to_int(r.get("year")) is not None and to_float(r.get("median_household_income"))
    })
    dem_year = dem_years_with_income[-1] if dem_years_with_income else None
    dem_state = {}
    for r in demog:
        if to_int(r.get("year")) != dem_year:
            continue
        st = norm_state(r.get("state", ""))
        pop = to_float(r.get("population")) or 0
        inc = to_float(r.get("median_household_income"))
        if st and inc is not None and pop > 0:
            cur = dem_state.get(st, {"pop_sum": 0.0, "weighted_inc": 0.0})
            cur["pop_sum"] += pop
            cur["weighted_inc"] += inc * pop
            dem_state[st] = cur

    climate_by_state = {}
    for r in climate:
        st = norm_state(r.get("state", ""))
        climate_by_state[st] = {
            "zone": r.get("climate_zone", ""),
            "temp_f": to_float(r.get("avg_temp_annual_f")),
            "snow_in": to_float(r.get("avg_snowfall_annual_in")),
            "precip_in": to_float(r.get("avg_precip_annual_in")),
        }

    tc_counts = Counter(c["state"] for c in out_centers if c["state"])

    out_states = {}
    for st in sorted(STATE_ABBR.values()):
        arrivals = state_athletes.get(st, [])
        medals = sum(a["total_medals"] for a in arrivals)
        gold = sum(a["gold"] for a in arrivals)
        sports_counter = Counter(a["sport"] for a in arrivals if a["sport"])
        top_sports = [{"sport": s, "n": n} for s, n in sports_counter.most_common(5)]

        inc_row = dem_state.get(st)
        median_income = (
            round(inc_row["weighted_inc"] / inc_row["pop_sum"])
            if inc_row and inc_row["pop_sum"] > 0 else None
        )

        out_states[st] = {
            "abbr": st,
            "name": ABBR_STATE.get(st, st),
            "olympians": len(arrivals),
            "medals": medals,
            "gold": gold,
            "top_sports": top_sports,
            "nfhs_total": nfhs_by_state.get(st, 0),
            "nfhs_history": [
                {"year": y, "n": n} for y, n in sorted(nfhs_history.get(st, {}).items())
            ],
            "median_income": median_income,
            "climate": climate_by_state.get(st, {}),
            "training_centers": tc_counts.get(st, 0),
        }
    with open(OUT_DIR / "states.json", "w") as f:
        json.dump(out_states, f, indent=2)
    print(f"Wrote {len(out_states)} state rollups "
          f"(nfhs year={nfhs_latest_year}, demographics year={dem_year})")

    # ── 5. sport_families.json ──────────────────────────────────────────
    families = sorted({v["family"] for v in sport_to_family.values()})
    out_families = {
        "colors": FAMILY_COLORS,
        "counts": dict(family_counts.most_common()),
        "sports": {
            r["sport"]: {
                "family": family_of(r["sport"]),
                "is_paralympic": r.get("is_paralympic", "").lower() in ("true", "1", "yes"),
            }
            for r in family_map
        },
        "families": families,
    }
    with open(OUT_DIR / "sport_families.json", "w") as f:
        json.dump(out_families, f, indent=2)
    print(f"Wrote {len(families)} families, {len(family_map)} sports")

    # ── Summary ─────────────────────────────────────────────────────────
    print("\n── Summary ──")
    print(f"athletes.json         {len(out_athletes):>6,} rows  (from team_usa_athletes.csv)")
    print(f"training_centers.json {len(out_centers):>6,} rows")
    print(f"colleges.json         {len(out_colleges):>6,} rows")
    print(f"states.json           {len(out_states):>6,} rows")
    print(f"sport_families.json   {len(family_map):>6,} sports")

    if unmatched_cities:
        print(f"\nTop unmatched cities (no geocode):")
        for (pair, n) in unmatched_cities.most_common(10):
            print(f"  {n:>4} × {pair}")


if __name__ == "__main__":
    main()
