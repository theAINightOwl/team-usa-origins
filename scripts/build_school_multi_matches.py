#!/usr/bin/env python3
"""
Build a multi-school education match file for the college pipeline plate.

The existing LLM match file maps one education string to one EADA institution.
This script keeps that legacy match as the first credit, then adds additional
exact institution-name matches found inside the same education string. The
output is intentionally conservative: it only adds exact/alias matches with
word boundaries and skips college names embedded in high-school names.

Writes:
  data/school_multi_matches.json
"""

import csv
import json
import re
import unicodedata
from pathlib import Path

DATA_DIR = Path("data")
TEAMUSA_CSV = DATA_DIR / "team_usa_athletes.csv"
EADA_CSV = DATA_DIR / "eada_college_sports.csv"
LEGACY_MATCHES = DATA_DIR / "school_matches.json"
OUT = DATA_DIR / "school_multi_matches.json"

NULL_SENTINELS = {"", "None", "NA", "null", "-"}

MANUAL_ALIASES = {
    "University of California, Los Angeles": [
        "UCLA",
        "University of California Los Angeles",
        "University of California-Los Angeles",
        "University of California at Los Angeles",
    ],
    "University of California - Berkeley": [
        "UC Berkeley",
        "University of California Berkeley",
        "University of California, Berkeley",
        "University of California at Berkeley",
    ],
    "University of California, Irvine": [
        "UC Irvine",
        "University of California Irvine",
        "University of California at Irvine",
    ],
    "University of California, San Diego": [
        "UC San Diego",
        "University of California San Diego",
        "University of California at San Diego",
    ],
    "University of California, Santa Barbara": [
        "UC Santa Barbara",
        "University of California Santa Barbara",
        "University of California at Santa Barbara",
    ],
    "University of California, Santa Cruz": [
        "UC Santa Cruz",
        "UCSC",
        "University of California Santa Cruz",
        "University of California at Santa Cruz",
    ],
    "University of Colorado Boulder": [
        "University of Colorado at Boulder",
        "University of Colorado-Boulder",
        "CU Boulder",
    ],
    "University of Colorado Colorado Springs": [
        "University of Colorado, Colorado Springs",
        "University of Colorado-Colorado Springs",
        "University of Colorado - Colorado Springs",
        "UCCS",
    ],
    "University of Minnesota, Twin Cities": [
        "University of Minnesota Twin Cities",
        "University of Minnesota-Twin Cities",
    ],
    "University of Nebraska": [
        "University of Nebraska Omaha",
        "University of Nebraska-Omaha",
        "University of Nebraska at Omaha",
    ],
    "University of Southern California": ["USC"],
    "University of Wisconsin-Whitewater": [
        "University of Wisconsin Whitewater",
        "University of Wisconsin - Whitewater",
        "University of Wisconsin at Whitewater",
        "Wisconsin-Whitewater",
    ],
}

CANONICAL_OVERRIDES = {
    "Hawai'i": "University of Hawaii",
    "Ohio State University": "The Ohio State University",
    "UCLA": "University of California, Los Angeles",
    "University of California--Los Angeles": "University of California, Los Angeles",
    "University of California, Berkeley": "University of California - Berkeley",
    "University of California--Irvine": "University of California, Irvine",
    "University of Colorado, Colorado Springs": "University of Colorado Colorado Springs",
    "University of Illinois": "University of Illinois Urbana-Champaign",
    "University of Illinois Urbana": "University of Illinois Urbana-Champaign",
    "University of Illinois at Urbana Champaign": "University of Illinois Urbana-Champaign",
    "University of Illinois at Urbana-Champaign": "University of Illinois Urbana-Champaign",
    "University of North Carolina at Chapel Hill": "University of North Carolina, Chapel Hill",
    "USC": "University of Southern California",
    "Stanford": "Stanford University",
    "Long Beach State": "Long Beach State University",
    "Oklahoma State": "Oklahoma State University",
    "Penn State": "Penn State University",
    "Pennsylvania State University": "Penn State University",
    "Yale University '23": "Yale University",
}

BROAD_DROP_IF_SPECIFIC = {
    "University of California": "University of California",
    "University of Colorado": "University of Colorado",
    "University of Illinois Urbana-Champaign": "University of Illinois",
    "University of Minnesota": "University of Minnesota",
    "University of North Carolina": "University of North Carolina",
    "University of Texas": "University of Texas",
    "University of Wisconsin": "University of Wisconsin",
}


def load_csv(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def norm_text(value):
    if value is None:
        return ""
    value = value.strip()
    return "" if value in NULL_SENTINELS else value


def norm_match(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = value.lower()
    value = value.replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def canonical_name(name, college_names):
    override = CANONICAL_OVERRIDES.get(name, name)
    if override in college_names:
        return override
    if name in college_names:
        return name
    return ""


def should_skip_match(text, start, end):
    after = text[end:].lstrip()
    before = text[:start].rstrip()
    if re.match(r"^(high school|hs|prep school|preparatory school|preparatory)\b", after):
        return True
    if re.search(r"\b(high school|hs|preparatory|prep)$", before):
        return True
    if re.search(r"\b(east|eastern|west|western|north|northern|south|southern)$", before):
        return True
    matched = text[start:end].strip()
    if matched == "marian university" and before.endswith("omaha"):
        return True
    if matched == "university of kentucky" and before.endswith("james madison"):
        return True
    return False


def drop_broad_matches(matches):
    out = []
    for canon in matches:
        broad_prefix = BROAD_DROP_IF_SPECIFIC.get(canon)
        has_specific = any(
            other != canon and other.startswith(broad_prefix)
            for other in matches
        ) if broad_prefix else False
        if not has_specific and canon not in out:
            out.append(canon)
    return out


def build_aliases(college_names):
    aliases = []
    for raw_name in sorted(college_names):
        canon = canonical_name(raw_name, college_names)
        if not canon:
            continue
        candidates = {raw_name, canon}
        candidates.update(MANUAL_ALIASES.get(canon, []))

        for candidate in candidates:
            alias = norm_match(candidate)
            if not alias:
                continue
            # Avoid dangerous one-word aliases except for established acronym
            # rows that appear as all-caps institution names in the data.
            token_count = len(alias.split())
            is_acronym = candidate.isupper() and len(candidate) >= 3
            if token_count < 2 and not is_acronym:
                continue
            aliases.append((alias, canon))

    # Longest aliases first, so "University of Colorado Boulder" wins over
    # the broad "University of Colorado" when both match the same span.
    aliases.sort(key=lambda item: (-len(item[0]), item[0], item[1]))
    return aliases


def find_extra_matches(education, aliases):
    if len(education) > 600:
        return []
    text = norm_match(education)
    matches = []
    used_spans = []
    padded = f" {text} "

    for alias, canon in aliases:
        needle = f" {alias} "
        search_from = 0
        while True:
            idx = padded.find(needle, search_from)
            if idx == -1:
                break
            start = idx
            end = idx + len(needle) - 2
            search_from = idx + 1

            if should_skip_match(text, start, end):
                continue
            if any(start >= s and end <= e for s, e in used_spans):
                continue
            used_spans.append((start, end))
            matches.append((start, canon))

    matches.sort(key=lambda item: item[0])
    out = []
    for _, canon in matches:
        if canon not in out:
            out.append(canon)
    return drop_broad_matches(out)


def main():
    athletes = load_csv(TEAMUSA_CSV)
    colleges = load_csv(EADA_CSV)
    college_names = {r["institution_name"] for r in colleges if r.get("institution_name")}
    legacy = json.loads(LEGACY_MATCHES.read_text()) if LEGACY_MATCHES.exists() else {}
    aliases = build_aliases(college_names)

    education_strings = sorted({
        e
        for r in athletes
        for e in [norm_text(r.get("education"))]
        if e
    })

    results = {}
    total_extra = 0
    multi_count = 0
    for education in education_strings:
        matches = []
        legacy_match = legacy.get(education)
        if isinstance(legacy_match, str):
            legacy_match = canonical_name(legacy_match, college_names)
            if legacy_match:
                matches.append(legacy_match)
        elif isinstance(legacy_match, list):
            for item in legacy_match:
                if isinstance(item, str):
                    item = canonical_name(item, college_names)
                    if item and item not in matches:
                        matches.append(item)

        extra_matches = find_extra_matches(education, aliases)
        if not matches and len(extra_matches) == 1:
            extra_matches = []
        for canon in extra_matches:
            if canon not in matches:
                matches.append(canon)
                total_extra += 1

        matches = drop_broad_matches(matches)
        results[education] = matches
        if len(matches) > 1:
            multi_count += 1

    OUT.write_text(json.dumps(results, indent=2) + "\n")
    non_empty = sum(1 for v in results.values() if v)
    print(f"Wrote {OUT}: {len(results):,} strings, {non_empty:,} non-empty")
    print(f"  multi-school strings: {multi_count:,}")
    print(f"  exact/alias matches added beyond legacy first credit: {total_extra:,}")


if __name__ == "__main__":
    main()
