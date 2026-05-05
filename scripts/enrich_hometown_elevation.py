#!/usr/bin/env python3
"""
Enrich every geocoded hometown with elevation (feet).

Reads:  data/teamusa_hometown_geocodes.csv
Writes: data/hometown_elevation.csv  (canonical_name, lat, lng, elevation_ft)
Cache:  data/.elevation_cache.json   (gitignored — keyed by "lat,lng")

Primary source:  USGS EPQS  (https://epqs.nationalmap.gov/v1/json) — feet, US-only.
Fallback source: Open-Elevation (https://api.open-elevation.com)    — meters.

Run:
    python3 scripts/enrich_hometown_elevation.py
"""

import csv
import json
import time
from pathlib import Path

import requests

DATA_DIR = Path("data")
GEOCODES_CSV = DATA_DIR / "teamusa_hometown_geocodes.csv"
OUT_CSV = DATA_DIR / "hometown_elevation.csv"
CACHE_FILE = DATA_DIR / ".elevation_cache.json"

USGS_URL = "https://epqs.nationalmap.gov/v1/json"
OPEN_ELEV_URL = "https://api.open-elevation.com/api/v1/lookup"

REQUEST_TIMEOUT = 15
USGS_PAUSE_S = 0.05
OPEN_ELEV_PAUSE_S = 1.0
MAX_RETRIES = 3
M_TO_FT = 3.280839895


def load_cache() -> dict:
    if CACHE_FILE.exists():
        with CACHE_FILE.open() as f:
            return json.load(f)
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, indent=2, sort_keys=True))


def cache_key(lat: float, lng: float) -> str:
    return f"{round(lat, 5)},{round(lng, 5)}"


def fetch_usgs(lat: float, lng: float) -> float | None:
    params = {"x": lng, "y": lat, "units": "Feet", "wkid": 4326}
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.get(USGS_URL, params=params, timeout=REQUEST_TIMEOUT)
            if r.status_code != 200:
                time.sleep(0.5 * (attempt + 1))
                continue
            payload = r.json()
            # Endpoint returns either {"value": "1234.5"} or a richer nested
            # response depending on traffic; tolerate both.
            value = payload.get("value")
            if value is None and isinstance(payload.get("USGS_Elevation_Point_Query_Service"), dict):
                value = (
                    payload["USGS_Elevation_Point_Query_Service"]
                    .get("Elevation_Query", {})
                    .get("Elevation")
                )
            if value is None:
                return None
            ft = float(value)
            # USGS sentinel for "no data" is -1000000.
            if ft <= -1000:
                return None
            return ft
        except (requests.RequestException, ValueError):
            time.sleep(0.5 * (attempt + 1))
    return None


def fetch_open_elevation(lat: float, lng: float) -> float | None:
    params = {"locations": f"{lat},{lng}"}
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.get(OPEN_ELEV_URL, params=params, timeout=REQUEST_TIMEOUT)
            if r.status_code != 200:
                time.sleep(1.0 * (attempt + 1))
                continue
            payload = r.json()
            results = payload.get("results") or []
            if not results:
                return None
            meters = results[0].get("elevation")
            if meters is None:
                return None
            return float(meters) * M_TO_FT
        except (requests.RequestException, ValueError):
            time.sleep(1.0 * (attempt + 1))
    return None


def lookup_elevation(lat: float, lng: float, cache: dict) -> tuple[float | None, str]:
    key = cache_key(lat, lng)
    if key in cache:
        entry = cache[key]
        return entry.get("elevation_ft"), entry.get("source", "cache")

    ft = fetch_usgs(lat, lng)
    source = "usgs"
    time.sleep(USGS_PAUSE_S)
    if ft is None:
        ft = fetch_open_elevation(lat, lng)
        source = "open-elevation"
        time.sleep(OPEN_ELEV_PAUSE_S)
        if ft is None:
            cache[key] = {"elevation_ft": None, "source": "miss"}
            return None, "miss"

    cache[key] = {"elevation_ft": round(ft, 1), "source": source}
    return cache[key]["elevation_ft"], source


def main() -> None:
    if not GEOCODES_CSV.exists():
        raise SystemExit(f"Missing {GEOCODES_CSV}. Run geocode_teamusa_hometowns.py first.")

    with GEOCODES_CSV.open() as f:
        rows = list(csv.DictReader(f))

    cache = load_cache()
    save_every = 50

    out_rows: list[dict] = []
    misses: list[dict] = []
    src_counter = {"cache": 0, "usgs": 0, "open-elevation": 0, "miss": 0}

    for i, r in enumerate(rows, 1):
        try:
            lat = float(r["lat"])
            lng = float(r["lng"])
        except (TypeError, ValueError):
            continue

        canonical = r.get("canonical_name") or f'{r.get("city","")}, {r.get("state","")}'
        ft, src = lookup_elevation(lat, lng, cache)
        src_counter[src] = src_counter.get(src, 0) + 1

        if ft is None:
            misses.append({"canonical_name": canonical, "lat": lat, "lng": lng})
            continue

        out_rows.append({
            "canonical_name": canonical,
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "elevation_ft": round(ft, 1),
        })

        if i % save_every == 0:
            save_cache(cache)
            print(f"  [{i}/{len(rows)}] {canonical}: {ft:.0f} ft  ({src})")

    save_cache(cache)

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["canonical_name", "lat", "lng", "elevation_ft"])
        w.writeheader()
        w.writerows(out_rows)

    print()
    print(f"Wrote {len(out_rows):,} rows to {OUT_CSV}")
    print(f"  cache hits:     {src_counter['cache']:,}")
    print(f"  USGS hits:      {src_counter['usgs']:,}")
    print(f"  open-elevation: {src_counter['open-elevation']:,}")
    print(f"  misses:         {src_counter['miss']:,}")
    if misses:
        print("Unresolved hometowns:")
        for m in misses[:20]:
            print(f"  - {m['canonical_name']} ({m['lat']:.4f}, {m['lng']:.4f})")
        if len(misses) > 20:
            print(f"  …and {len(misses) - 20} more")


if __name__ == "__main__":
    main()
