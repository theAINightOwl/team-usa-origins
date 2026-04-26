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


# ── Per-plate computations ────────────────────────────────────────────
def plate_factories(athletes, place_pop):
    """#1 — small-town factories (per-capita olympians by hometown)."""
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
            "olympians": n,
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
    """#2 — Herfindahl-style geographic concentration index per sport."""
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
    """#3 — training-center halos: athletes in concentric rings around each USOPC center."""
    rings = [25, 50, 100, 200]  # miles
    out = []
    for c in centers:
        if c.get("lat") is None or c.get("lng") is None:
            continue
        clat, clng = c["lat"], c["lng"]
        ring_counts = [0] * len(rings)
        family_counts = [Counter() for _ in rings]
        for a in athletes:
            if a.get("lat") is None or a.get("lng") is None:
                continue
            d = haversine_mi(clat, clng, a["lat"], a["lng"])
            for i, r in enumerate(rings):
                if d <= r:
                    ring_counts[i] += 1
                    if a.get("family"):
                        family_counts[i][a["family"]] += 1
                    break  # an athlete sits in the smallest ring it qualifies for
        # cumulative counts (athletes within 50mi includes athletes within 25mi)
        cumulative = []
        running = 0
        for i in range(len(rings)):
            running += ring_counts[i]
            cumulative.append(running)
        out.append({
            "name": c["name"],
            "city": c.get("city"),
            "state": c.get("state"),
            "lat": clat,
            "lng": clng,
            "rings": rings,
            "ring_counts": ring_counts,
            "cumulative": cumulative,
            "top_family_50mi": (family_counts[0] + family_counts[1]).most_common(3),
            "sports_served": c.get("sports_served", ""),
        })
    out.sort(key=lambda r: -r["cumulative"][-1])
    print(f"  halos: {len(out)} centers. Top reach (200mi): "
          f"{out[0]['name']} = {out[0]['cumulative'][-1]} athletes")
    return out


def plate_climate_sport(athletes, states):
    """#4 — climate zone × sport family heatmap (share of family from each zone)."""
    state_zone = {st: (info.get("climate") or {}).get("zone") for st, info in states.items()}
    by_family = defaultdict(Counter)  # family → zone → count
    for a in athletes:
        fam = a.get("family")
        st = a.get("state")
        zone = state_zone.get(st)
        if not (fam and zone):
            continue
        by_family[fam][zone] += 1
    zones = sorted({z for z in state_zone.values() if z})
    families = sorted(by_family.keys())
    matrix = []
    for fam in families:
        row = {"family": fam, "zones": []}
        total = sum(by_family[fam].values())
        for z in zones:
            n = by_family[fam].get(z, 0)
            row["zones"].append({
                "zone": z,
                "n": n,
                "share": round(n / total, 4) if total else 0,
            })
        row["total"] = total
        matrix.append(row)
    print(f"  climate_sport: {len(families)} families × {len(zones)} climate zones")
    return {"zones": zones, "families": families, "matrix": matrix}


def plate_distance(athletes, centers):
    """#5 — distance-to-nearest-center distribution, medalist vs non-medalist, per family."""
    cs = [c for c in centers if c.get("lat") is not None]
    bins = [0, 25, 50, 100, 200, 400, 800, 5000]
    bin_labels = ["≤25", "≤50", "≤100", "≤200", "≤400", "≤800", ">800"]

    # bucket per (family, medalist?, bin_idx)
    buckets = defaultdict(int)
    totals = defaultdict(int)  # (family, medalist?) → total
    samples = []  # for the distance-to-medals scatter
    for a in athletes:
        if a.get("lat") is None or a.get("lng") is None:
            continue
        # min distance to any center
        d = min(haversine_mi(a["lat"], a["lng"], c["lat"], c["lng"]) for c in cs)
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

    # build per-family rows
    out = {"bins": bin_labels, "families": {}}
    families_seen = sorted({f for (f, _, _) in buckets.keys()})
    for fam in families_seen:
        med = [buckets.get((fam, True, i), 0) for i in range(len(bin_labels))]
        non = [buckets.get((fam, False, i), 0) for i in range(len(bin_labels))]
        out["families"][fam] = {
            "medalist": med,
            "nonmedalist": non,
            "n_med": sum(med),
            "n_non": sum(non),
        }
    print(f"  distance: {len(families_seen)} families bucketed across "
          f"{len(bin_labels)} distance bins")
    return out


def plate_paralympic(athletes):
    """#6 — paralympic vs olympic ratio by state."""
    p_by_state = Counter()
    o_by_state = Counter()
    for a in athletes:
        st = a.get("state")
        t = (a.get("type") or "").lower()
        if not st:
            continue
        if "paralym" in t:
            p_by_state[st] += 1
        elif "olym" in t or "team usa" in t or "hopeful" in t:
            o_by_state[st] += 1
    rows = []
    for st in sorted(set(p_by_state) | set(o_by_state)):
        o = o_by_state.get(st, 0)
        p = p_by_state.get(st, 0)
        total = o + p
        if total < 5:
            continue
        para_share = p / total if total else 0
        rows.append({
            "state": st,
            "olympic": o,
            "paralympic": p,
            "total": total,
            "para_share": round(para_share, 4),
        })
    rows.sort(key=lambda r: -r["para_share"])
    print(f"  paralympic: {len(rows)} states. Highest para share: "
          f"{rows[0]['state']} ({rows[0]['para_share'] * 100:.1f}%)")
    return rows


def plate_college_efficiency(colleges):
    """#7 — olympians vs athletic budget. Outliers above the trend = efficient."""
    pts = []
    for c in colleges:
        if c.get("budget_m") and c.get("olympians", 0) > 0:
            pts.append({
                "name": c["name"],
                "state": c.get("state", ""),
                "budget_m": round(c["budget_m"], 2),
                "olympians": c["olympians"],
                "ratio": round(c["olympians"] / c["budget_m"], 3),
            })
    pts.sort(key=lambda r: -r["ratio"])
    # also pre-compute log-log trend so frontend can render the line
    n = len(pts)
    if n > 1:
        xs = [math.log10(p["budget_m"]) for p in pts]
        ys = [math.log10(p["olympians"]) for p in pts]
        mx, my = sum(xs) / n, sum(ys) / n
        num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        den = sum((x - mx) ** 2 for x in xs) or 1
        slope = num / den
        intercept = my - slope * mx
    else:
        slope, intercept = 0, 0
    print(f"  college_efficiency: {n} colleges with budget+olympians. Most efficient: "
          f"{pts[0]['name']} ({pts[0]['ratio']} olympians/$M)")
    return {
        "points": pts,
        "trend": {"slope": round(slope, 4), "intercept": round(intercept, 4)},
    }


def plate_per_capita(states_data, state_pop):
    """#8 — per-capita olympians per state per 100k residents."""
    rows = []
    for st, info in states_data.items():
        pop = state_pop.get(st)
        if not pop or pop < 50_000:
            continue
        n = info.get("olympians", 0)
        if n == 0:
            continue
        per100k = n / pop * 100_000
        rows.append({
            "state": st,
            "name": info.get("name"),
            "olympians": n,
            "population": pop,
            "per_100k": round(per100k, 3),
        })
    rows.sort(key=lambda r: -r["per_100k"])
    print(f"  per_capita: {len(rows)} states. Top: {rows[0]['state']} "
          f"({rows[0]['per_100k']} per 100k)")
    return rows


def plate_hs_conversion(states_data):
    """#9 — NFHS participation vs olympians produced."""
    rows = []
    for st, info in states_data.items():
        nfhs = info.get("nfhs_total", 0)
        n = info.get("olympians", 0)
        if nfhs and n:
            ratio = n / nfhs * 1_000_000
            rows.append({
                "state": st,
                "name": info.get("name"),
                "nfhs": nfhs,
                "olympians": n,
                "per_million_hs": round(ratio, 1),
            })
    rows.sort(key=lambda r: -r["per_million_hs"])
    print(f"  hs_conversion: {len(rows)} states. Best converter: {rows[0]['state']} "
          f"({rows[0]['per_million_hs']} olympians per million HS participants)")
    return rows


def plate_era(athletes):
    """#10 — era migration: athletes per state per decade."""
    decades = [(1980, 1989), (1990, 1999), (2000, 2009), (2010, 2019), (2020, 2029)]
    out = {"decades": [], "per_state": {}}
    for lo, hi in decades:
        label = f"{lo}s"
        out["decades"].append({"label": label, "lo": lo, "hi": hi})

    state_decade_counts = defaultdict(lambda: [0] * len(decades))
    for a in athletes:
        first = a.get("first")
        last = a.get("last") or first
        st = a.get("state")
        if not (first and st):
            continue
        for i, (lo, hi) in enumerate(decades):
            if first <= hi and last >= lo:
                state_decade_counts[st][i] += 1

    for st, counts in state_decade_counts.items():
        out["per_state"][st] = counts
    # also a national totals row
    out["national"] = [
        sum(state_decade_counts[st][i] for st in state_decade_counts)
        for i in range(len(decades))
    ]
    print(f"  era: {len(decades)} decades, {len(state_decade_counts)} states with athletes")
    return out


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
    out = {
        "factories": plate_factories(athletes, place_pop),
        "concentration": plate_concentration(athletes, families),
        "halos": plate_halos(athletes, centers),
        "climate_sport": plate_climate_sport(athletes, states),
        "distance": plate_distance(athletes, centers),
        "paralympic": plate_paralympic(athletes),
        "college_efficiency": plate_college_efficiency(colleges),
        "per_capita": plate_per_capita(states, state_pop),
        "hs_conversion": plate_hs_conversion(states),
        "era": plate_era(athletes),
    }

    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"\nWrote analytics.json ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
