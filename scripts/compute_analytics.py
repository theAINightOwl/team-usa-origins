#!/usr/bin/env python3
"""
compute_analytics.py
====================

Pre-computes data for the 10 analytics plates listed in ANALYTICS_IDEAS.md.

Reads:
  - olympian-roots/src/data/athletes.json     (from compute_olympian_roots.py)
  - olympian-roots/src/data/states.json
  - olympian-roots/src/data/training_centers.json
  - olympian-roots/src/data/colleges.json
  - olympian-roots/src/data/sport_families.json
  - .cache/sub-est2023.csv                    (Census PEP, fetched once)

Writes:
  - olympian-roots/src/data/analytics.json    (one combined blob, keys = plate slugs)

Run after compute_olympian_roots.py:
  python3 compute_olympian_roots.py
  python3 compute_analytics.py
"""

import csv
import json
import math
import re
import ssl
import sys
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────
DATA_DIR = Path("src/data")
ATHLETES = DATA_DIR / "athletes.json"
STATES = DATA_DIR / "states.json"
CENTERS = DATA_DIR / "training_centers.json"
COLLEGES = DATA_DIR / "colleges.json"
FAMILIES = DATA_DIR / "sport_families.json"
OUT = DATA_DIR / "analytics.json"

CACHE_DIR = Path(".cache")
SUB_EST = CACHE_DIR / "sub-est2023.csv"
SUB_EST_URL = (
    "https://www2.census.gov/programs-surveys/popest/datasets/"
    "2020-2023/cities/totals/sub-est2023.csv"
)

# ── State helpers ─────────────────────────────────────────────────────
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


def norm_place(name):
    """Normalize a place name for join: lowercase, strip suffix words."""
    if not name:
        return ""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    # strip trailing legal-area words appended by Census (e.g. "Park City city")
    s = re.sub(
        r"\b(city|town|village|borough|township|charter township|cdp|municipality|"
        r"corporation|borough \(city\))\b",
        "",
        s,
    )
    s = re.sub(r"\bst\.\s*", "saint ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# ── Census PEP loader ─────────────────────────────────────────────────
def ensure_subest():
    if SUB_EST.exists():
        return
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {SUB_EST_URL} ...", file=sys.stderr)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        SUB_EST_URL,
        headers={"User-Agent": "team-usa-hackathon analytics/1.0"},
    )
    with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
        SUB_EST.write_bytes(resp.read())
    print(f"  cached at {SUB_EST}", file=sys.stderr)


def load_population_lookups():
    """
    Returns:
      place_pop: {(norm_name, st_abbr): pop_2023}  — incorporated places + townships
      state_pop: {st_abbr: pop_2023}
    """
    ensure_subest()
    place_pop = {}
    state_pop = {}
    name_state_to_abbr = STATE_ABBR

    with open(SUB_EST, encoding="latin-1") as f:
        reader = csv.DictReader(f)
        for r in reader:
            sumlev = r["SUMLEV"]
            stname = r["STNAME"]
            st = name_state_to_abbr.get(stname)
            if not st:
                continue
            try:
                pop = int(r["POPESTIMATE2023"])
            except (ValueError, KeyError):
                continue

            if sumlev == "040":  # state total
                state_pop[st] = pop
            elif sumlev in ("162", "061"):  # incorporated places + MCDs
                key = (norm_place(r["NAME"]), st)
                # if duplicate (e.g., place + township share name), keep the larger
                if key not in place_pop or place_pop[key] < pop:
                    place_pop[key] = pop
    return place_pop, state_pop


# ── Geo helpers ───────────────────────────────────────────────────────
def haversine_mi(lat1, lng1, lat2, lng2):
    R = 3958.8  # miles
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


SPORT_ALIASES = {
    "athletics": "track and field",
    "track & field": "track and field",
    "para athletics": "track and field",
    "para track and field": "track and field",
    "speedskating": "speed skating",
    "short track speedskating": "short track speed skating",
    "para swimming": "swimming",
    "para-cycling": "cycling",
    "para cycling": "cycling",
    "para-rowing": "rowing",
    "para rowing": "rowing",
    "paracanoe": "canoe/kayak",
    "para archery": "archery",
    "para shooting": "shooting",
    "para judo": "judo",
    "para taekwondo": "taekwondo",
    "para table tennis": "table tennis",
    "para alpine skiing": "alpine skiing",
    "para snowboarding": "snowboarding",
    "para nordic skiing": "cross-country skiing",
    "para biathlon": "biathlon",
    "sled hockey": "ice hockey",
    "wheelchair curling": "curling",
    "sitting volleyball": "volleyball",
    "wheelchair rugby": "rugby",
    "paratriathlon": "triathlon",
}


def split_sports(value):
    if not value:
        return []
    return [s.strip() for s in re.split(r"\s*;\s*", value) if s.strip()]


def norm_sport(value):
    s = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\s+", " ", s.replace("&", "and")).strip()
    return SPORT_ALIASES.get(s, s)


def normalized_sports(value):
    return {norm_sport(s) for s in split_sports(value)}


def merged_center_rows(centers):
    """Collapse exactly co-located facility rows for halo geography."""
    groups = defaultdict(list)
    for c in centers:
        if c.get("lat") is None or c.get("lng") is None:
            continue
        groups[(round(c["lat"], 4), round(c["lng"], 4))].append(c)

    type_rank = {"OPTC": 0, "NTC": 1, "Training Site": 2}
    merged = []
    for (_, _), rows in groups.items():
        primary = sorted(rows, key=lambda r: (type_rank.get(r.get("type"), 9), r.get("name", "")))[0]
        sports = sorted({s for row in rows for s in split_sports(row.get("sports_served", ""))})
        merged.append({
            "name": primary["name"],
            "city": primary.get("city"),
            "state": primary.get("state"),
            "lat": primary["lat"],
            "lng": primary["lng"],
            "type": primary.get("type"),
            "types": sorted({row.get("type", "") for row in rows if row.get("type")}),
            "facility_count": len(rows),
            "colocated_names": [row["name"] for row in rows if row["name"] != primary["name"]],
            "sports_served": ";".join(sports),
            "sports_served_norm": {norm_sport(s) for s in sports},
        })
    return merged


# ── Per-plate computations ────────────────────────────────────────────
def filter_by_type(athletes, profile_type):
    """Return athletes whose `type` matches the given lens ('olympic' or 'paralympic')."""
    target = profile_type.lower()
    return [a for a in athletes if (a.get("type") or "").strip().lower() == target]


def plate_factories(athletes, place_pop):
    """#1 — small-town factories (per-capita Team USA athlete profiles by hometown)."""
    by_city = defaultdict(list)
    for a in athletes:
        city = a.get("city")
        st = a.get("state")
        if not city or not st:
            continue
        by_city[(city, st)].append(a)

    rows = []
    misses = 0
    for (city, st), athls in by_city.items():
        n = len(athls)
        if n < 2:
            continue
        # try direct, then drop "the " prefix
        key = (norm_place(city), st)
        pop = place_pop.get(key)
        if pop is None:
            # try city without leading "the"
            stripped = re.sub(r"^the\s+", "", norm_place(city))
            pop = place_pop.get((stripped, st))
        if pop is None or pop < 500:
            misses += 1
            continue
        rate = n / pop * 10_000
        sport_counts = Counter(a["sport"] for a in athls if a.get("sport"))
        top_sport, _ = (sport_counts.most_common(1) or [(None, 0)])[0]
        family_counts = Counter(a["family"] for a in athls if a.get("family"))
        top_family, _ = (family_counts.most_common(1) or [(None, 0)])[0]
        # NIL: do not store athlete names. Track top sports as the "flavor" hint.
        top_sports = [
            {"sport": s, "n": c}
            for s, c in sport_counts.most_common(3)
        ]
        rows.append({
            "city": city,
            "state": st,
            "lat": athls[0]["lat"],
            "lng": athls[0]["lng"],
            "population": pop,
            "athletes": n,
            "rate": round(rate, 2),
            "top_sport": top_sport,
            "top_family": top_family,
            "top_sports": top_sports,
        })
    rows.sort(key=lambda r: -r["rate"])
    print(f"  factories: {len(rows)} cities qualified, "
          f"{misses} skipped (no pop / pop<500). Top: "
          f"{rows[0]['city']}, {rows[0]['state']} ({rows[0]['rate']})"
          if rows else "  factories: none")
    return rows[:50]


def plate_concentration(athletes, families):
    """#2 — state-level geographic concentration index per sport profile."""
    by_sport = defaultdict(Counter)
    for a in athletes:
        s = a.get("sport")
        st = a.get("state")
        if not s or not st:
            continue
        by_sport[s][st] += 1

    rows = []
    for sport, sc in by_sport.items():
        total = sum(sc.values())
        if total < 5:
            continue
        shares = [n / total for n in sc.values()]
        hhi = sum(p * p for p in shares)
        # top 3 states with share
        top3 = [
            {"state": s, "n": n, "share": round(n / total, 3)}
            for s, n in sc.most_common(3)
        ]
        # family lookup via families.sports
        fam = families.get("sports", {}).get(sport, {}).get("family", "Other")
        rows.append({
            "sport": sport,
            "family": fam,
            "n_athletes": total,
            "n_states": len(sc),
            "hhi": round(hhi, 4),
            "top_states": top3,
        })
    rows.sort(key=lambda r: -r["hhi"])
    print(f"  concentration: {len(rows)} sports indexed. Most concentrated: "
          f"{rows[0]['sport']} (HHI {rows[0]['hhi']})")
    return rows


def plate_halos(athletes, centers):
    """#3 — training-center halos around the curated facility roster."""
    rings = [25, 50, 100, 200]  # miles
    out = []
    for c in merged_center_rows(centers):
        clat, clng = c["lat"], c["lng"]
        ring_counts = [0] * len(rings)
        direct_ring_counts = [0] * len(rings)
        family_counts = [Counter() for _ in rings]
        direct_family_counts = [Counter() for _ in rings]
        served_sports = c.get("sports_served_norm", set())
        for a in athletes:
            if a.get("lat") is None or a.get("lng") is None:
                continue
            d = haversine_mi(clat, clng, a["lat"], a["lng"])
            directly_served = bool(served_sports & normalized_sports(a.get("sport", "")))
            for i, r in enumerate(rings):
                if d <= r:
                    ring_counts[i] += 1
                    if a.get("family"):
                        family_counts[i][a["family"]] += 1
                    if directly_served:
                        direct_ring_counts[i] += 1
                        if a.get("family"):
                            direct_family_counts[i][a["family"]] += 1
                    break  # an athlete sits in the smallest ring it qualifies for
        # cumulative counts (athletes within 50mi includes athletes within 25mi)
        cumulative = []
        direct_cumulative = []
        running = 0
        direct_running = 0
        for i in range(len(rings)):
            running += ring_counts[i]
            direct_running += direct_ring_counts[i]
            cumulative.append(running)
            direct_cumulative.append(direct_running)
        out.append({
            "name": c["name"],
            "city": c.get("city"),
            "state": c.get("state"),
            "lat": clat,
            "lng": clng,
            "type": c.get("type"),
            "types": c.get("types", []),
            "facility_count": c.get("facility_count", 1),
            "colocated_names": c.get("colocated_names", []),
            "rings": rings,
            "ring_counts": ring_counts,
            "cumulative": cumulative,
            "direct_ring_counts": direct_ring_counts,
            "direct_cumulative": direct_cumulative,
            "top_family_50mi": (family_counts[0] + family_counts[1]).most_common(3),
            "top_direct_family_50mi": (direct_family_counts[0] + direct_family_counts[1]).most_common(3),
            "sports_served": c.get("sports_served", ""),
        })
    out.sort(key=lambda r: -r["cumulative"][-1])
    print(f"  halos: {len(out)} center geographies. Top reach (200mi): "
          f"{out[0]['name']} = {out[0]['cumulative'][-1]} athletes")
    return out


def plate_training_gap(athletes, halo_centers):
    """Nearest tracked-facility gap and simple city-centered candidate halos."""
    threshold_mi = 500 / 1.609344
    far = []
    for a in athletes:
        if a.get("lat") is None or a.get("lng") is None:
            continue
        nearest = min(
            haversine_mi(a["lat"], a["lng"], c["lat"], c["lng"])
            for c in halo_centers
        )
        if nearest > threshold_mi:
            far.append(a)

    city_groups = defaultdict(list)
    for a in far:
        if a.get("city") and a.get("state"):
            city_groups[(a["city"], a["state"])].append(a)

    candidate_rows = []
    for (city, st), local in city_groups.items():
        if len(local) < 5:
            continue
        clat = sum(a["lat"] for a in local) / len(local)
        clng = sum(a["lng"] for a in local) / len(local)
        covered = [
            a for a in far
            if haversine_mi(clat, clng, a["lat"], a["lng"]) <= 200
        ]
        candidate_rows.append({
            "city": city,
            "state": st,
            "far_profiles_in_city": len(local),
            "profiles_within_200mi": len(covered),
            "top_states": [
                {"state": s, "n": n}
                for s, n in Counter(a["state"] for a in covered).most_common(5)
            ],
            "top_families": [
                {"family": f, "n": n}
                for f, n in Counter(a["family"] for a in covered if a.get("family")).most_common(5)
            ],
        })
    candidate_rows.sort(
        key=lambda r: (-r["profiles_within_200mi"], -r["far_profiles_in_city"], r["city"])
    )

    return {
        "threshold_km": 500,
        "threshold_mi": round(threshold_mi, 1),
        "far_profiles": len(far),
        "share": round(len(far) / len(athletes), 4) if athletes else 0,
        "top_states": [
            {"state": s, "n": n}
            for s, n in Counter(a["state"] for a in far).most_common(10)
        ],
        "top_metros": [
            {"city": city, "state": st, "n": n}
            for (city, st), n in Counter((a["city"], a["state"]) for a in far).most_common(15)
        ],
        "candidate_sites": candidate_rows[:20],
    }


def plate_climate_sport(athletes, states):
    """#4 — climate zone × sport family heatmap (share of family from each zone)."""
    state_zone = {st: (info.get("climate") or {}).get("zone") for st, info in states.items()}
    by_family = defaultdict(Counter)  # family → zone → count
    profile_type_counts = Counter()
    skipped = 0
    for a in athletes:
        fam = a.get("family")
        st = a.get("state")
        zone = state_zone.get(st)
        if not (fam and zone):
            skipped += 1
            continue
        by_family[fam][zone] += 1
        profile_type_counts[a.get("type") or "Unknown"] += 1
    zones = sorted({z for z in state_zone.values() if z})
    families = sorted(by_family.keys())
    family_totals = {fam: sum(by_family[fam].values()) for fam in families}
    zone_totals = {
        z: sum(by_family[fam].get(z, 0) for fam in families)
        for z in zones
    }
    grand_total = sum(family_totals.values())
    matrix = []
    residuals = []
    for fam in families:
        row = {"family": fam, "zones": []}
        total = family_totals[fam]
        for z in zones:
            n = by_family[fam].get(z, 0)
            expected = (total * zone_totals[z] / grand_total) if grand_total else 0
            standardized_residual = (
                (n - expected) / math.sqrt(expected)
                if expected > 0 else 0
            )
            cell = {
                "zone": z,
                "n": n,
                "share": round(n / total, 4) if total else 0,
                "expected": round(expected, 1),
                "standardized_residual": round(standardized_residual, 1),
            }
            row["zones"].append({
                **cell,
            })
            residuals.append({
                "family": fam,
                **cell,
                "family_total": total,
                "zone_total": zone_totals[z],
            })
        row["total"] = total
        matrix.append(row)
    residuals.sort(key=lambda r: -r["standardized_residual"])
    print(f"  climate_sport: {len(families)} families × {len(zones)} climate zones")
    return {
        "zones": zones,
        "families": families,
        "matrix": matrix,
        "residuals": residuals,
        "scope": {
            "included_profiles": grand_total,
            "profile_type_counts": dict(sorted(profile_type_counts.items())),
            "skipped_profiles": skipped,
            "climate_source": "data/hometown_climate.csv state-level climate_zone labels",
            "assignment": "athlete hometown state",
        },
    }


ELEVATION_CSV = Path("data/hometown_elevation.csv")
ELEVATION_TIERS = [
    ("≤500 ft",       0,    500),
    ("500–1,500",   500,  1500),
    ("1,500–3,000", 1500, 3000),
    ("3,000–5,000", 3000, 5000),
    (">5,000",      5000, 99999),
]


def _load_elevation_lookup():
    if not ELEVATION_CSV.exists():
        return {}
    lookup = {}
    with ELEVATION_CSV.open() as f:
        for r in csv.DictReader(f):
            try:
                lat = round(float(r["lat"]), 4)
                lng = round(float(r["lng"]), 4)
                ft = float(r["elevation_ft"])
            except (TypeError, ValueError, KeyError):
                continue
            lookup[(lat, lng)] = ft
    return lookup


def plate_elevation_sport(athletes):
    """Elevation × sport family heatmap (share of family from each tier)."""
    elev = _load_elevation_lookup()
    if not elev:
        return {
            "tiers": [t[0] for t in ELEVATION_TIERS],
            "families": [],
            "matrix": [],
            "top_high_towns": [],
            "scope": {
                "included_profiles": 0,
                "skipped_profiles": len(athletes),
                "elevation_source": "data/hometown_elevation.csv (missing)",
            },
        }

    tier_labels = [t[0] for t in ELEVATION_TIERS]

    def to_tier(ft):
        for label, lo, hi in ELEVATION_TIERS:
            if lo <= ft < hi:
                return label
        return None

    by_family = defaultdict(Counter)  # family → tier → count
    profile_type_counts = Counter()
    skipped = 0
    town_counts = defaultdict(lambda: {"n": 0, "ft": 0.0, "state": "", "fams": Counter()})

    for a in athletes:
        fam = a.get("family")
        lat = a.get("lat")
        lng = a.get("lng")
        if fam is None or lat is None or lng is None:
            skipped += 1
            continue
        ft = elev.get((round(lat, 4), round(lng, 4)))
        if ft is None:
            skipped += 1
            continue
        tier = to_tier(ft)
        if tier is None:
            skipped += 1
            continue
        by_family[fam][tier] += 1
        profile_type_counts[a.get("type") or "Unknown"] += 1
        city = a.get("city") or ""
        st = a.get("state") or ""
        key = (city, st)
        rec = town_counts[key]
        rec["n"] += 1
        rec["ft"] = ft
        rec["state"] = st
        rec["fams"][fam] += 1

    families_sorted = sorted(by_family.keys())
    family_totals = {f: sum(by_family[f].values()) for f in families_sorted}
    tier_totals = {t: sum(by_family[f].get(t, 0) for f in families_sorted) for t in tier_labels}
    grand_total = sum(family_totals.values())

    matrix = []
    for fam in families_sorted:
        row = {"family": fam, "tiers": []}
        total = family_totals[fam]
        for tier in tier_labels:
            n = by_family[fam].get(tier, 0)
            expected = (total * tier_totals[tier] / grand_total) if grand_total else 0
            standardized = ((n - expected) / math.sqrt(expected)) if expected > 0 else 0
            row["tiers"].append({
                "tier": tier,
                "n": n,
                "share": round(n / total, 4) if total else 0,
                "expected": round(expected, 1),
                "standardized_residual": round(standardized, 1),
            })
        row["total"] = total
        row["mean_ft"] = None
        # mean elevation per family — feet, weighted by athlete count
        feet = []
        for a in athletes:
            if a.get("family") != fam: continue
            lat = a.get("lat"); lng = a.get("lng")
            if lat is None or lng is None: continue
            ft = elev.get((round(lat, 4), round(lng, 4)))
            if ft is not None: feet.append(ft)
        if feet:
            row["mean_ft"] = round(sum(feet) / len(feet), 0)
            row["median_ft"] = round(sorted(feet)[len(feet) // 2], 0)
        matrix.append(row)

    top_high = sorted(
        ({"city": c, "state": v["state"], "ft": round(v["ft"]), "n": v["n"],
          "top_family": v["fams"].most_common(1)[0][0]}
         for (c, _), v in town_counts.items() if v["ft"] >= 4000 and v["n"] >= 4),
        key=lambda r: -r["n"],
    )[:10]

    print(f"  elevation_sport: {len(families_sorted)} families × {len(tier_labels)} tiers "
          f"(grand_total={grand_total}, skipped={skipped})")
    return {
        "tiers": tier_labels,
        "families": families_sorted,
        "matrix": matrix,
        "top_high_towns": top_high,
        "scope": {
            "included_profiles": grand_total,
            "profile_type_counts": dict(sorted(profile_type_counts.items())),
            "skipped_profiles": skipped,
            "elevation_source": "data/hometown_elevation.csv (USGS EPQS, falls back to Open-Elevation)",
            "assignment": "athlete hometown coordinates",
        },
    }


def plate_distance(athletes, centers):
    """#5 — distance to nearest sport-serving tracked facility geography."""
    cs = merged_center_rows(centers)
    bins = [0, 25, 50, 100, 200, 400, 800, 5000]
    bin_labels = ["≤25", "≤50", "≤100", "≤200", "≤400", "≤800", ">800"]
    eligible_types = {"olympic", "paralympic"}

    # bucket per (family, medalist?, bin_idx)
    buckets = defaultdict(int)
    totals = defaultdict(int)  # (family, medalist?) → total
    samples = []  # for the distance-to-medals scatter
    profile_type_counts = Counter()
    excluded_type_counts = Counter()
    unserved_sports = Counter()
    geocoded_profiles = 0
    for a in athletes:
        if a.get("lat") is None or a.get("lng") is None:
            continue
        geocoded_profiles += 1
        profile_type = (a.get("type") or "Unknown").strip()
        profile_type_counts[profile_type] += 1
        if profile_type.lower() not in eligible_types:
            excluded_type_counts[profile_type] += 1
            continue

        sport = norm_sport(a.get("sport"))
        sport_centers = [c for c in cs if sport and sport in c["sports_served_norm"]]
        if not sport_centers:
            unserved_sports[a.get("sport") or "(missing sport)"] += 1
            continue

        # min distance to a tracked facility geography that lists this sport
        d = min(haversine_mi(a["lat"], a["lng"], c["lat"], c["lng"]) for c in sport_centers)
        fam = a.get("family", "Other")
        is_medalist = (a.get("total_medals") or 0) > 0
        # find bin
        bi = 0
        for i in range(1, len(bins)):
            if d <= bins[i]:
                bi = i - 1
                break
        else:
            bi = len(bin_labels) - 1
        buckets[(fam, is_medalist, bi)] += 1
        totals[(fam, is_medalist)] += 1
        if a.get("total_medals", 0) > 0:
            samples.append({"d": round(d, 1), "medals": a["total_medals"], "family": fam})

    def rate(med_count, non_count):
        total = med_count + non_count
        return round(med_count / total, 4) if total else 0

    # build per-family rows
    included_profiles = sum(totals.values())
    medal_eligible_geocoded = sum(
        n for t, n in profile_type_counts.items()
        if t.lower() in eligible_types
    )
    out = {
        "bins": bin_labels,
        "families": {},
        "scope": {
            "distance_basis": "nearest tracked facility geography that lists the athlete's sport",
            "included_profile_types": ["Olympic", "Paralympic"],
            "geocoded_profiles": geocoded_profiles,
            "profile_type_counts": dict(sorted(profile_type_counts.items())),
            "medal_eligible_geocoded_profiles": medal_eligible_geocoded,
            "included_profiles": included_profiles,
            "eligible_profiles": included_profiles,
            "excluded_profile_types": dict(sorted(excluded_type_counts.items())),
            "unserved_profiles": sum(unserved_sports.values()),
            "unserved_sports": [
                {"sport": sport, "n": n}
                for sport, n in unserved_sports.most_common(12)
            ],
        },
    }
    families_seen = sorted({f for (f, _, _) in buckets.keys()})
    for fam in families_seen:
        med = [buckets.get((fam, True, i), 0) for i in range(len(bin_labels))]
        non = [buckets.get((fam, False, i), 0) for i in range(len(bin_labels))]
        within_200_med = sum(med[:4]) / sum(med) if sum(med) else 0
        within_200_non = sum(non[:4]) / sum(non) if sum(non) else 0
        out["families"][fam] = {
            "medalist": med,
            "nonmedalist": non,
            "medalist_rate": [rate(m, n) for m, n in zip(med, non)],
            "n_med": sum(med),
            "n_non": sum(non),
            "within_200_medalist_share": round(within_200_med, 4),
            "within_200_nonmedalist_share": round(within_200_non, 4),
            "premium_within_200_pp": round((within_200_med - within_200_non) * 100, 1),
        }

    overall_med = [
        sum(out["families"][fam]["medalist"][i] for fam in families_seen)
        for i in range(len(bin_labels))
    ]
    overall_non = [
        sum(out["families"][fam]["nonmedalist"][i] for fam in families_seen)
        for i in range(len(bin_labels))
    ]
    out["overall"] = {
        "medalist": overall_med,
        "nonmedalist": overall_non,
        "medalist_rate": [rate(m, n) for m, n in zip(overall_med, overall_non)],
    }
    out["family_premiums"] = sorted(
        [
            {
                "family": fam,
                "premium_within_200_pp": d["premium_within_200_pp"],
                "within_200_medalist_share": d["within_200_medalist_share"],
                "within_200_nonmedalist_share": d["within_200_nonmedalist_share"],
                "n_med": d["n_med"],
                "n_non": d["n_non"],
            }
            for fam, d in out["families"].items()
        ],
        key=lambda r: -r["premium_within_200_pp"],
    )
    print(f"  distance: {len(families_seen)} families bucketed across "
          f"{len(bin_labels)} distance bins; "
          f"{out['scope']['eligible_profiles']} medal-eligible profiles included, "
          f"{sum(excluded_type_counts.values())} profile-type excluded, "
          f"{sum(unserved_sports.values())} no tracked sport-serving facility")
    return out


def plate_paralympic(athletes):
    """#6 — paralympic vs olympic ratio by state."""
    p_by_state = Counter()
    o_by_state = Counter()
    h_by_state = Counter()
    for a in athletes:
        st = a.get("state")
        t = (a.get("type") or "Unknown").strip()
        t_norm = t.lower()
        if not st:
            continue
        if "paralym" in t_norm:
            p_by_state[st] += 1
        elif t_norm in {"olympic", "olympian"}:
            o_by_state[st] += 1
        elif "hopeful" in t_norm:
            h_by_state[st] += 1
    rows = []
    for st in sorted(set(p_by_state) | set(o_by_state) | set(h_by_state)):
        o = o_by_state.get(st, 0)
        p = p_by_state.get(st, 0)
        h = h_by_state.get(st, 0)
        total = o + p
        para_share = p / total if total else 0
        rows.append({
            "state": st,
            "olympic": o,
            "paralympic": p,
            "total": total,
            "para_share": round(para_share, 4),
            "hopeful_excluded": h,
        })
    rows.sort(key=lambda r: (-r["para_share"], -r["total"]))
    included = sum(r["total"] for r in rows)
    excluded = sum(r["hopeful_excluded"] for r in rows)
    top = next((r for r in rows if r["total"] >= 10), None)
    if top:
        print(f"  paralympic: {len(rows)} states. Highest para share: "
              f"{top['state']} ({top['para_share'] * 100:.1f}%, min n=10); "
              f"{included} Olympic/Paralympic included, {excluded} Hopeful excluded")
    else:
        print("  paralympic: no Olympic/Paralympic profiles")
    return rows


def plate_college_efficiency(colleges, profile_type=None):
    """#8 — matched Team USA profiles vs athletic budget.

    If `profile_type` is given ('olympic' or 'paralympic'), the matched-profile
    count is restricted to that lens via each college's profile_types dict.
    """
    pts = []
    type_key = profile_type.capitalize() if profile_type else None
    for c in colleges:
        type_counts = c.get("profile_types") or {}
        if type_key:
            matched = type_counts.get(type_key, 0) or 0
        else:
            matched = c.get("matched_profiles", c.get("olympians", 0)) or 0
        if c.get("budget_m") and matched > 0:
            type_counts = c.get("profile_types") or {}
            pts.append({
                "name": c["name"],
                "state": c.get("state", ""),
                "classification": c.get("classification", ""),
                "budget_m": round(c["budget_m"], 2),
                "matched_profiles": matched,
                "profile_types": {
                    "Olympic": type_counts.get("Olympic", c.get("olympians", 0)) or 0,
                    "Paralympic": type_counts.get("Paralympic", c.get("paralympians", 0)) or 0,
                    "Hopeful": type_counts.get("Hopeful", c.get("hopefuls", 0)) or 0,
                },
                "olympians": type_counts.get("Olympic", c.get("olympians", 0)) or 0,
                "paralympians": type_counts.get("Paralympic", c.get("paralympians", 0)) or 0,
                "hopefuls": type_counts.get("Hopeful", c.get("hopefuls", 0)) or 0,
                "ratio": round(matched / c["budget_m"], 3),
            })
    pts.sort(key=lambda r: -r["ratio"])
    # also pre-compute log-log trend so frontend can render the line
    n = len(pts)
    if n > 1:
        xs = [math.log10(p["budget_m"]) for p in pts]
        ys = [math.log10(p["matched_profiles"]) for p in pts]
        mx, my = sum(xs) / n, sum(ys) / n
        num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        den = sum((x - mx) ** 2 for x in xs) or 1
        slope = num / den
        intercept = my - slope * mx
    else:
        slope, intercept = 0, 0
    print(f"  college_efficiency: {n} colleges with budget+matched Team USA profiles. "
          f"Most efficient: {pts[0]['name']} ({pts[0]['ratio']} profiles/$M)")
    return {
        "points": pts,
        "trend": {"slope": round(slope, 4), "intercept": round(intercept, 4)},
    }


def plate_per_capita(states_data, state_pop, profile_type=None):
    """#9 — per-capita Team USA profiles per state per 100k residents.

    If `profile_type` is given ('olympic' or 'paralympic'), the numerator is
    restricted to that lens via each state's profile_types dict.
    """
    type_key = profile_type.capitalize() if profile_type else None
    rows = []
    for st, info in states_data.items():
        pop = state_pop.get(st)
        if not pop or pop < 50_000:
            continue
        type_counts = info.get("profile_types") or {}
        if type_key:
            profiles = type_counts.get(type_key, 0) or 0
        else:
            profiles = info.get("profiles", info.get("olympians", 0)) or 0
        if profiles == 0:
            continue
        per100k = profiles / pop * 100_000
        rows.append({
            "state": st,
            "name": info.get("name"),
            "profiles": profiles,
            "profile_types": {
                "Olympic": type_counts.get("Olympic", 0),
                "Paralympic": type_counts.get("Paralympic", 0),
                "Hopeful": type_counts.get("Hopeful", 0),
            },
            "olympians": type_counts.get("Olympic", 0),
            "paralympians": type_counts.get("Paralympic", 0),
            "hopefuls": type_counts.get("Hopeful", 0),
            "population": pop,
            "climate_zone": (info.get("climate") or {}).get("zone", ""),
            "per_100k": round(per100k, 3),
        })
    rows.sort(key=lambda r: -r["per_100k"])
    print(f"  per_capita: {len(rows)} states. Top: {rows[0]['state']} "
          f"({rows[0]['per_100k']} profiles per 100k)")
    return rows


def plate_hs_conversion(states_data, profile_type=None):
    """#10 — Team USA profiles per official NFHS participation slot.

    If `profile_type` is given ('olympic' or 'paralympic'), the numerator is
    restricted to that lens.
    """
    type_key = profile_type.capitalize() if profile_type else None
    rows = []
    for st, info in states_data.items():
        nfhs_slots = (
            info.get("nfhs_participation_slots")
            or info.get("nfhs_total")
            or 0
        )
        type_counts = info.get("profile_types") or {}
        if type_key:
            profiles = type_counts.get(type_key, 0) or 0
        else:
            profiles = (
                info.get("profiles")
                or sum(type_counts.values())
                or info.get("olympians", 0)
            )
        if nfhs_slots and profiles:
            ratio = profiles / nfhs_slots * 1_000_000
            rows.append({
                "state": st,
                "name": info.get("name"),
                "profiles": profiles,
                "profile_types": {
                    "Olympic": type_counts.get("Olympic", 0),
                    "Paralympic": type_counts.get("Paralympic", 0),
                    "Hopeful": type_counts.get("Hopeful", 0),
                },
                "olympians": type_counts.get("Olympic", 0),
                "paralympians": type_counts.get("Paralympic", 0),
                "hopefuls": type_counts.get("Hopeful", 0),
                "nfhs": nfhs_slots,
                "nfhs_participation_slots": nfhs_slots,
                "nfhs_year": info.get("nfhs_year"),
                "nfhs_source": info.get("nfhs_source"),
                "nfhs_source_label": info.get("nfhs_source_label"),
                "per_million_hs": round(ratio, 1),
            })
    rows.sort(key=lambda r: -r["per_million_hs"])
    print(f"  hs_conversion: {len(rows)} states. Highest density: {rows[0]['state']} "
          f"({rows[0]['per_million_hs']} profiles per million NFHS participation slots)")
    return rows


def plate_centroids(athletes, families):
    """#11 — sport-family centroids: geographic center of each family's roster.

    For each family, compute the arithmetic mean of athlete (lat, lng) — the
    same planar approximation other plates use — plus the top three source
    states for context. Athletes with missing coordinates or family are
    skipped.
    """
    by_family_coords = defaultdict(list)
    by_family_states = defaultdict(Counter)
    skipped_no_coords = 0
    skipped_no_family = 0
    for a in athletes:
        fam = a.get("family")
        lat = a.get("lat")
        lng = a.get("lng")
        if not fam:
            skipped_no_family += 1
            continue
        if lat is None or lng is None:
            skipped_no_coords += 1
            continue
        by_family_coords[fam].append((lat, lng))
        st = a.get("state")
        if st:
            by_family_states[fam][st] += 1

    rows = []
    family_order = families.get("families") or sorted(by_family_coords.keys())
    for fam in family_order:
        coords = by_family_coords.get(fam) or []
        n = len(coords)
        if n == 0:
            continue
        lat_mean = sum(c[0] for c in coords) / n
        lng_mean = sum(c[1] for c in coords) / n
        top_states = []
        for st, cnt in by_family_states.get(fam, Counter()).most_common(3):
            top_states.append({"state": st, "n": cnt, "pct": round(100.0 * cnt / n, 1)})
        rows.append({
            "family": fam,
            "lat": round(lat_mean, 4),
            "lng": round(lng_mean, 4),
            "n": n,
            "top_states": top_states,
        })
    print(
        f"  centroids: {len(rows)} families "
        f"(skipped {skipped_no_coords} no-coords, {skipped_no_family} no-family)"
    )
    if rows:
        print(
            f"    largest: {rows and max(rows, key=lambda r: r['n'])['family']}, "
            f"northernmost: {rows and max(rows, key=lambda r: r['lat'])['family']}"
        )
    return rows


def median(values):
    values = sorted(values)
    n = len(values)
    if n == 0:
        return None
    mid = n // 2
    if n % 2:
        return values[mid]
    return (values[mid - 1] + values[mid]) / 2


def build_meta(out):
    per_capita = out["per_capita"]
    pc_profiles = sum(r["profiles"] for r in per_capita)
    pc_population = sum(r["population"] for r in per_capita)
    national_per_100k = pc_profiles / pc_population * 100_000 if pc_population else 0
    pc_type_counts = Counter()
    for r in per_capita:
        for profile_type, n in (r.get("profile_types") or {}).items():
            pc_type_counts[profile_type] += n

    zone_groups = defaultdict(list)
    for r in per_capita:
        zone = r.get("climate_zone")
        if zone:
            zone_groups[zone].append(r)
    zone_means = {
        zone: sum(r["per_100k"] for r in rows) / len(rows)
        for zone, rows in zone_groups.items()
        if rows
    }
    climate_zone_residuals = []
    for r in per_capita:
        zone = r.get("climate_zone")
        expected_rate = zone_means.get(zone)
        if expected_rate is None:
            continue
        expected_profiles = expected_rate * r["population"] / 100_000
        climate_zone_residuals.append({
            "state": r["state"],
            "name": r["name"],
            "climate_zone": zone,
            "profiles": r["profiles"],
            "population": r["population"],
            "per_100k": r["per_100k"],
            "zone_mean_per_100k": round(expected_rate, 3),
            "residual_per_100k": round(r["per_100k"] - expected_rate, 3),
            "gap_to_zone_mean_profiles": round(expected_profiles - r["profiles"], 1),
        })
    climate_zone_residuals.sort(key=lambda r: r["residual_per_100k"])

    hs_rows = out["hs_conversion"]
    hs_values = [r["per_million_hs"] for r in hs_rows]
    hs_large_threshold = 200_000
    hs_large_rows = [
        r for r in hs_rows
        if r.get("nfhs_participation_slots", r.get("nfhs", 0)) >= hs_large_threshold
    ]
    hs_large = [r["per_million_hs"] for r in hs_large_rows]
    hs_profile_type_counts = Counter()
    for r in hs_rows:
        for profile_type, n in (r.get("profile_types") or {}).items():
            hs_profile_type_counts[profile_type] += n
    hs_years = sorted({r.get("nfhs_year") for r in hs_rows if r.get("nfhs_year")})
    hs_source_labels = sorted({
        r.get("nfhs_source_label") for r in hs_rows if r.get("nfhs_source_label")
    })
    hs_sources = sorted({r.get("nfhs_source") for r in hs_rows if r.get("nfhs_source")})
    hs_total_profiles = sum(r["profiles"] for r in hs_rows)
    hs_total_slots = sum(r.get("nfhs_participation_slots", r.get("nfhs", 0)) for r in hs_rows)
    hs_national_per_million = (
        hs_total_profiles / hs_total_slots * 1_000_000
        if hs_total_slots
        else 0
    )
    hs_median = median(hs_values)
    hs_large_median = median(hs_large)
    hs_large_gap_scan = []
    if hs_large_median is not None:
        for r in hs_large_rows:
            slots = r.get("nfhs_participation_slots", r.get("nfhs", 0))
            expected = hs_large_median * slots / 1_000_000
            hs_large_gap_scan.append({
                "state": r["state"],
                "name": r["name"],
                "profiles": r["profiles"],
                "nfhs_participation_slots": slots,
                "per_million_hs": r["per_million_hs"],
                "benchmark_per_million_hs": round(hs_large_median, 1),
                "profiles_below_large_state_median_rate_benchmark": round(
                    max(0, expected - r["profiles"]), 1
                ),
            })
        hs_large_gap_scan.sort(
            key=lambda r: -r["profiles_below_large_state_median_rate_benchmark"]
        )

    para_rows = out["paralympic"]
    para_total = sum(r["total"] for r in para_rows)
    olympic_n = sum(r["olympic"] for r in para_rows)
    para_n = sum(r["paralympic"] for r in para_rows)
    hopeful_excluded = sum(r.get("hopeful_excluded", 0) for r in para_rows)
    para_share = para_n / para_total if para_total else 0
    para_gap = {}
    for r in para_rows:
        expected = para_share * r["total"]
        para_gap[r["state"]] = {
            "expected_at_national_share": round(expected, 1),
            "gap_vs_national_share": round(expected - r["paralympic"], 1),
        }

    college_rows = out["college_efficiency"]["points"]
    college_type_counts = Counter()
    for r in college_rows:
        for profile_type, n in (r.get("profile_types") or {}).items():
            college_type_counts[profile_type] += n

    return {
        "per_capita": {
            "metric": "Team USA profiles per 100k residents",
            "national_per_100k": round(national_per_100k, 3),
            "total_profiles": pc_profiles,
            "profile_type_counts": dict(pc_type_counts),
            "total_population": pc_population,
            "included_profile_types": ["Olympic", "Paralympic", "Hopeful"],
            "climate_zone_residual_method": (
                "Unweighted mean of state per-100k profile rates within each state-level climate zone."
            ),
            "climate_zone_means": {
                zone: round(rate, 3) for zone, rate in sorted(zone_means.items())
            },
            "climate_zone_residuals": climate_zone_residuals,
        },
        "hs_conversion": {
            "metric": "Team USA profiles per 1,000,000 NFHS participation slots",
            "nfhs_source_label": hs_source_labels[0] if len(hs_source_labels) == 1 else None,
            "nfhs_source_labels": hs_source_labels,
            "nfhs_source": hs_sources[0] if len(hs_sources) == 1 else None,
            "nfhs_sources": hs_sources,
            "nfhs_year": hs_years[0] if len(hs_years) == 1 else None,
            "nfhs_years": hs_years,
            "participation_slot_note": (
                "NFHS totals count participation slots, not unique students; "
                "a student in multiple sports can be counted more than once."
            ),
            "included_profile_types": ["Olympic", "Paralympic", "Hopeful"],
            "profile_type_counts": dict(hs_profile_type_counts),
            "total_profiles": hs_total_profiles,
            "total_nfhs_participation_slots": hs_total_slots,
            "national_per_million_hs": round(hs_national_per_million, 1),
            "national_median_per_million_hs": round(hs_median, 1) if hs_median is not None else None,
            "large_state_median_per_million_hs": (
                round(hs_large_median, 1) if hs_large_median is not None else None
            ),
            "large_state_threshold_nfhs": hs_large_threshold,
            "large_state_gap_scan": hs_large_gap_scan,
        },
        "paralympic": {
            "national_share": round(para_share, 4),
            "national_paralympians": para_n,
            "national_olympians": olympic_n,
            "national_total": para_total,
            "included_profile_types": ["Olympic", "Paralympic"],
            "excluded_profile_types": {"Hopeful": hopeful_excluded},
            "profile_type_counts": {
                "Olympic": olympic_n,
                "Paralympic": para_n,
                "Hopeful": hopeful_excluded,
            },
            "display_threshold_total": 10,
            "gap_by_state": para_gap,
        },
        "college_efficiency": {
            "metric": "matched Team USA profiles per athletic budget $M",
            "display_threshold_matched_profiles": 2,
            "profile_type_counts": dict(college_type_counts),
            "matched_profiles": sum(college_type_counts.values()),
        },
    }


# ── Main ──────────────────────────────────────────────────────────────
def main():
    if not ATHLETES.exists():
        raise SystemExit(
            f"Missing {ATHLETES}. Run `python3 compute_olympian_roots.py` first."
        )
    athletes = json.loads(ATHLETES.read_text())
    states = json.loads(STATES.read_text())
    centers = json.loads(CENTERS.read_text())
    colleges = json.loads(COLLEGES.read_text())
    families = json.loads(FAMILIES.read_text())
    print(f"Loaded {len(athletes):,} athletes, {len(states)} states, "
          f"{len(centers)} centers, {len(colleges)} colleges")

    place_pop, state_pop = load_population_lookups()
    print(f"Loaded {len(place_pop):,} place pops + {len(state_pop)} state pops "
          f"from sub-est2023.csv\n")

    print("Computing plates …")
    halos = plate_halos(athletes, centers)
    out = {
        "factories": plate_factories(athletes, place_pop),
        "concentration": plate_concentration(athletes, families),
        "halos": halos,
        "training_gap": plate_training_gap(athletes, halos),
        "climate_sport": plate_climate_sport(athletes, states),
        "elevation_sport": plate_elevation_sport(athletes),
        "distance": plate_distance(athletes, centers),
        "paralympic": plate_paralympic(athletes),
        "college_efficiency": plate_college_efficiency(colleges),
        "per_capita": plate_per_capita(states, state_pop),
        "hs_conversion": plate_hs_conversion(states),
        "centroids": plate_centroids(athletes, families),
    }
    out["meta"] = build_meta(out)

    # ── Per-lens slices (Olympic / Paralympic) ────────────────────────
    print("\nComputing per-lens slices …")
    ath_o = filter_by_type(athletes, "olympic")
    ath_p = filter_by_type(athletes, "paralympic")
    print(f"  filtered: {len(ath_o)} olympic, {len(ath_p)} paralympic")

    for lens, ath_lens in (("olympic", ath_o), ("paralympic", ath_p)):
        suffix = f"_{lens}"
        print(f"  ── {lens} lens ──")
        out[f"factories{suffix}"] = plate_factories(ath_lens, place_pop)
        out[f"concentration{suffix}"] = plate_concentration(ath_lens, families)
        out[f"halos{suffix}"] = plate_halos(ath_lens, centers)
        out[f"climate_sport{suffix}"] = plate_climate_sport(ath_lens, states)
        out[f"elevation_sport{suffix}"] = plate_elevation_sport(ath_lens)
        out[f"distance{suffix}"] = plate_distance(ath_lens, centers)
        out[f"per_capita{suffix}"] = plate_per_capita(states, state_pop, profile_type=lens)
        out[f"college_efficiency{suffix}"] = plate_college_efficiency(colleges, profile_type=lens)
        out[f"hs_conversion{suffix}"] = plate_hs_conversion(states, profile_type=lens)
        out[f"centroids{suffix}"] = plate_centroids(ath_lens, families)

    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"\nWrote analytics.json ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
