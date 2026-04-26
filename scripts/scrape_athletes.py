#!/usr/bin/env python3
"""Scrape all athlete profiles from Team USA's API."""

import csv
import json
import re
import ssl
import time
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode

API_URL = "https://www.teamusa.com/api/athletes"
BATCH_SIZE = 500
DELAY_SECONDS = 0.5
MAX_RETRIES = 3
OUTPUT_CSV = "data/team_usa_athletes.csv"
OUTPUT_JSON = "data/team_usa_athletes.json"

CSV_COLUMNS = [
    "uid", "profile_url", "first_name", "last_name",
    "height", "birthday", "age", "hometown_city", "hometown_state",
    "education", "fun_fact",
    "biography",
    "gold_medals", "silver_medals", "bronze_medals",
    "olympic_paralympic",
    "sport", "sport_type", "sport_season",
    "olympian_paralympian_years", "olympian_paralympian_qualified",
    "world_championship_years", "para_classification",
    "hero_image_url", "thumbnail_image_url",
    "content_tags",
]


class HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def get_text(self):
        return " ".join(self.parts)


def strip_html(html_str):
    if not html_str:
        return ""
    stripper = HTMLStripper()
    stripper.feed(html_str)
    text = stripper.get_text()
    return re.sub(r"\s+", " ", text).strip()


def safe_get(d, *keys, default=""):
    val = d
    for k in keys:
        if isinstance(val, dict):
            val = val.get(k)
        else:
            return default
        if val is None:
            return default
    return val


def flatten_athlete(entry):
    bio = entry.get("bio") or {}
    qf = bio.get("quick_facts") or {}
    hometown = qf.get("hometown") or {}
    medals = entry.get("medals") or {}
    sports = entry.get("sport") or []
    hero_images = entry.get("hero_image") or []
    thumb_images = entry.get("thumbnail_image_list") or []
    tags = entry.get("content_tags") or []

    return {
        "uid": entry.get("uid", ""),
        "profile_url": "https://www.teamusa.com" + entry.get("url", ""),
        "first_name": (entry.get("first_name") or "").strip(),
        "last_name": (entry.get("last_name") or "").strip(),
        "height": qf.get("height", ""),
        "birthday": qf.get("birthday", ""),
        "age": qf.get("age", ""),
        "hometown_city": hometown.get("city", ""),
        "hometown_state": hometown.get("state", ""),
        "education": qf.get("education", ""),
        "fun_fact": qf.get("fun_fact", ""),
        "biography": strip_html(bio.get("biography", "")),
        "gold_medals": medals.get("gold", 0),
        "silver_medals": medals.get("silver", 0),
        "bronze_medals": medals.get("bronze", 0),
        "olympic_paralympic": entry.get("olympic_paralympic", ""),
        "sport": "; ".join(s.get("title", "") for s in sports),
        "sport_type": "; ".join(s.get("type", "") for s in sports),
        "sport_season": "; ".join(s.get("season", "") for s in sports),
        "olympian_paralympian_years": entry.get("olympian_paralympian_years", ""),
        "olympian_paralympian_qualified": entry.get("olympian_paralympian_qualified", ""),
        "world_championship_years": entry.get("world_championship_years", ""),
        "para_classification": entry.get("para_classification", ""),
        "hero_image_url": hero_images[0].get("secure_url", "") if hero_images else "",
        "thumbnail_image_url": thumb_images[0].get("secure_url", "") if thumb_images else "",
        "content_tags": "; ".join(t.get("title", "") for t in tags),
    }


def fetch_batch(skip, limit):
    params = urlencode({
        "skip": skip,
        "limit": limit,
        "sortField": "last_name.keyword",
    })
    url = f"{API_URL}?{params}"
    req = Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "TeamUSA-Scraper/1.0",
    })

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urlopen(req, timeout=30, context=ctx) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (URLError, HTTPError, TimeoutError) as e:
            print(f"  Attempt {attempt}/{MAX_RETRIES} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Failed to fetch batch at skip={skip} after {MAX_RETRIES} retries")


def main():
    print("Fetching first batch to get total count...")
    first = fetch_batch(0, BATCH_SIZE)
    total = first["total"]
    all_entries = first["entries"]
    print(f"Total athletes: {total}")
    print(f"Batch 1: fetched {len(first['entries'])} athletes (0-{len(first['entries'])-1})")

    skip = BATCH_SIZE
    batch_num = 2
    while skip < total:
        time.sleep(DELAY_SECONDS)
        data = fetch_batch(skip, BATCH_SIZE)
        entries = data["entries"]
        all_entries.extend(entries)
        print(f"Batch {batch_num}: fetched {len(entries)} athletes ({skip}-{skip+len(entries)-1}), total so far: {len(all_entries)}")
        skip += BATCH_SIZE
        batch_num += 1

    print(f"\nTotal fetched: {len(all_entries)} athletes")

    # Save raw JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_entries, f, ensure_ascii=False, indent=2)
    print(f"Saved raw JSON to {OUTPUT_JSON}")

    # Flatten and save CSV
    rows = [flatten_athlete(e) for e in all_entries]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved CSV to {OUTPUT_CSV} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
