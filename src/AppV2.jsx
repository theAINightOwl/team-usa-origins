import React, { useCallback, useEffect, useMemo, useState } from "react";
import { geoAlbersUsa, geoPath, geoCentroid } from "d3-geo";
import { feature } from "topojson-client";

import athletesData from "./data/athletes.json";
import trainingCentersData from "./data/training_centers.json";
import collegesData from "./data/colleges.json";
import statesData from "./data/states.json";
import sportFamiliesData from "./data/sport_families.json";
import analyticsData from "./data/analytics.json";

import USMap, { NAME_TO_ABBR } from "./components/USMap.jsx";
import Filters from "./components/Filters.jsx";
import StatePanel from "./components/StatePanel.jsx";
import AthleteCard from "./components/AthleteCard.jsx";
import {
  PLATE_DEFS,
  PlateBody,
  PlateSelector,
  PlateStory,
  LensToggle,
} from "./components/Plates.jsx";
import ChatBot from "./components/ChatBot.jsx";

const MAP_WIDTH = 975;
const MAP_HEIGHT = 610;

/*
 * AppV2 — alternate layout sub-page mounted at /v2.
 *
 * Same data, same components, same chat agent — only the arrangement
 * changes:
 *   - horizontal plate menu at the top
 *   - left card holds map + filters together
 *   - chat lives as a permanent right column (embedded mode)
 *   - plate body + story scroll in a section below the map row
 */
export default function AppV2() {
  const [topoState, setTopoState] = useState({ features: null, centroids: {} });
  useEffect(() => {
    let alive = true;
    fetch("/us-states-10m.json")
      .then((r) => r.json())
      .then((topology) => {
        if (!alive) return;
        const fc = feature(topology, topology.objects.states);
        const features = fc.features;
        const centroids = {};
        for (const f of features) {
          const abbr = NAME_TO_ABBR[f.properties.name];
          if (!abbr) continue;
          centroids[abbr] = geoCentroid(f);
        }
        setTopoState({ features, centroids });
      })
      .catch((err) => console.error("[olympian-roots/v2] topology load failed", err));
    return () => { alive = false; };
  }, []);

  const { projection, path } = useMemo(() => {
    const proj = geoAlbersUsa().scale(1280).translate([MAP_WIDTH / 2, MAP_HEIGHT / 2 + 10]);
    return { projection: proj, path: geoPath().projection(proj) };
  }, []);

  // ── Filter state (mirrors App.jsx) ────────────────────────────────
  const allFamilies = sportFamiliesData.families;
  const [metric, setMetric] = useState("none");
  const [selectedFamilies, setSelectedFamilies] = useState(() => new Set(allFamilies));
  const [medalOnly, setMedalOnly] = useState(false);
  const [eraRange, setEraRange] = useState([1896, 2026]);
  const [overlays, setOverlays] = useState({ dots: true, centers: true, colleges: false });

  const PROFILE_TYPE_KEY = "olympian-roots:profileType";
  const [profileType, setProfileTypeState] = useState(() => {
    if (typeof localStorage === "undefined") return "olympic";
    const stored = localStorage.getItem(PROFILE_TYPE_KEY);
    return stored === "paralympic" ? "paralympic" : "olympic";
  });
  const setProfileType = (next) => {
    setProfileTypeState(next);
    if (typeof localStorage !== "undefined") localStorage.setItem(PROFILE_TYPE_KEY, next);
  };

  const toggleFamily = (f) => {
    setSelectedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };
  const setOverlay = (k, v) => setOverlays((o) => ({ ...o, [k]: v }));

  // ── Atlas patch dispatcher (same validation as App.jsx) ───────────
  const applyAtlasPatch = useCallback((patch) => {
    if (!patch || typeof patch !== "object") return;

    if (patch.reset === true) {
      setSelectedFamilies(new Set(allFamilies));
      setMedalOnly(false);
      setEraRange([1896, 2026]);
      setMetric("none");
      setOverlays({ dots: true, centers: true, colleges: false });
      setActivePlate("ref");
      setSelectedState(null);
      setSelectedAthleteId(null);
    }

    if (patch.families === null) {
      setSelectedFamilies(new Set(allFamilies));
    } else if (Array.isArray(patch.families)) {
      const valid = patch.families.filter((f) => allFamilies.includes(f));
      if (valid.length) setSelectedFamilies(new Set(valid));
    }
    if (typeof patch.medalOnly === "boolean") setMedalOnly(patch.medalOnly);
    if (Number.isFinite(patch.eraStart) || Number.isFinite(patch.eraEnd)) {
      setEraRange(([curStart, curEnd]) => {
        let s = Number.isFinite(patch.eraStart) ? patch.eraStart : curStart;
        let e = Number.isFinite(patch.eraEnd)   ? patch.eraEnd   : curEnd;
        s = Math.max(1896, Math.min(2026, s));
        e = Math.max(1896, Math.min(2026, e));
        if (s > e) [s, e] = [e, s];
        return [s, e];
      });
    }
    if (patch.lens === "Olympic") setProfileType("olympic");
    else if (patch.lens === "Paralympic") setProfileType("paralympic");
    const ALLOWED_METRICS = ["none","olympians","medals","income","nfhs","temp","snow","elevation","per_capita","hs_per_million","era_swing"];
    if (typeof patch.metric === "string" && ALLOWED_METRICS.includes(patch.metric)) {
      setMetric(patch.metric);
    }
    if (patch.overlays && typeof patch.overlays === "object") {
      setOverlays((prev) => {
        const next = { ...prev };
        for (const k of ["dots", "centers", "colleges"]) {
          if (typeof patch.overlays[k] === "boolean") next[k] = patch.overlays[k];
        }
        return next;
      });
    }
    const ALLOWED_PLATES = ["ref","factories","concentration","halos","distance","climate","per_capita","colleges","hs_conversion","era","altitude","you"];
    if (typeof patch.plate === "string" && ALLOWED_PLATES.includes(patch.plate)) {
      setActivePlate(patch.plate);
    }
    if (typeof patch.state === "string") {
      if (patch.state === "") setSelectedState(null);
      else if (Object.values(NAME_TO_ABBR).includes(patch.state)) {
        setSelectedAthleteId(null);
        setSelectedState(patch.state);
      }
    }
  }, [allFamilies]);

  // ── Selection + cross-component hover state ──────────────────────
  const [selectedState, setSelectedState] = useState(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState(null);
  const [activePlate, setActivePlate] = useState("ref");
  const [hoveredFactory, setHoveredFactory] = useState(null);

  // Single hover bag for cross-plate sync (sport / state / town / family /
  // training-center name / decade). Plate body rows call setHover*; USMap
  // reads the bag and applies appropriate dim/glow.
  const [hover, setHover] = useState({});
  const setHoverField = useCallback((key, value) => {
    setHover((h) => {
      if (value == null) {
        if (h[key] == null) return h;
        const next = { ...h };
        delete next[key];
        return next;
      }
      if (h[key] === value) return h;
      return { ...h, [key]: value };
    });
  }, []);

  // User's submitted hometown for Plate XII — populated by PlateYou via callback.
  const [userHome, setUserHome] = useState(null);

  // V2 keeps athlete-hometowns + training-centers overlays always on, and
  // auto-flips the feeder-colleges overlay on only when the colleges plate
  // is active (otherwise it stays off so the bubbles don't clutter the map).
  // Also auto-sets/locks the choropleth metric for state-aggregate plates.
  const PLATE_METRIC = {
    per_capita: "per_capita",
    hs_conversion: "hs_per_million",
    era: "era_swing",
  };
  const metricLocked = activePlate in PLATE_METRIC;
  useEffect(() => {
    setOverlays((o) => ({
      ...o,
      dots: true,
      centers: true,
      colleges: activePlate === "colleges",
    }));
    if (activePlate in PLATE_METRIC) {
      setMetric(PLATE_METRIC[activePlate]);
    } else {
      setMetric((m) => (
        m === "per_capita" || m === "hs_per_million" || m === "era_swing" ? "none" : m
      ));
    }
    setHover({});
  }, [activePlate]);

  const handleSelectState = (abbr) => {
    setSelectedAthleteId(null);
    setSelectedState((prev) => (prev === abbr ? null : abbr));
  };
  const handleSelectAthlete = (id) => {
    setSelectedState(null);
    setSelectedAthleteId((prev) => (prev === id ? null : id));
  };

  // ── Derived data ─────────────────────────────────────────────────
  const filteredAthletes = useMemo(() => {
    return athletesData.filter((a) => {
      if ((a.type || "").toLowerCase() !== profileType) return false;
      if (!selectedFamilies.has(a.family)) return false;
      if (medalOnly && !(a.total_medals > 0)) return false;
      if (a.first != null && a.first > eraRange[1]) return false;
      if (a.last != null && a.last < eraRange[0]) return false;
      return true;
    });
  }, [profileType, selectedFamilies, medalOnly, eraRange]);

  const totals = useMemo(() => {
    const lensTotal = athletesData.filter(
      (a) => (a.type || "").toLowerCase() === profileType
    ).length;
    return {
      athletes: 8526,
      geocoded: athletesData.length,
      lensGeocoded: lensTotal,
      filtered: filteredAthletes.length,
      medals: filteredAthletes.reduce((s, a) => s + (a.total_medals || 0), 0),
      states: new Set(filteredAthletes.map((a) => a.state).filter(Boolean)).size,
    };
  }, [filteredAthletes, profileType]);

  const lensStateCounts = useMemo(() => {
    const agg = {};
    for (const a of athletesData) {
      if ((a.type || "").toLowerCase() !== profileType) continue;
      const st = a.state;
      if (!st) continue;
      if (!agg[st]) agg[st] = { count: 0, medals: 0 };
      agg[st].count += 1;
      agg[st].medals += a.total_medals || 0;
    }
    return agg;
  }, [profileType]);

  const selectedAthlete = useMemo(
    () => (selectedAthleteId ? athletesData.find((a) => a.id === selectedAthleteId) : null),
    [selectedAthleteId]
  );
  const selectedStateObj = selectedState ? statesData[selectedState] : null;
  const activePlateObj = PLATE_DEFS.find((p) => p.key === activePlate) || PLATE_DEFS[0];

  return (
    <div className="app v2">
      <header className="v2-header">
        <div className="dateline">
          <span>Team USA · Olympic &amp; Paralympic</span>
          <span className="sep" />
          <span>1896 — 2026</span>
        </div>
        <div className="v2-header-row">
          <h1 className="wordmark">
            Olympian <em>Roots</em>
          </h1>
          <a className="v2-route-link" href="/">← classic layout</a>
        </div>
        <p className="subhead">
          A cartography of hometowns and the support systems — training centers, colleges,
          high-school pipelines, wages, and weather — behind Team USA profiles.
        </p>
        <div className="v2-plate-nav">
          <PlateSelector active={activePlate} setActive={setActivePlate} />
        </div>
      </header>

      <main className="v2-main">
        <section className="v2-stage">
          <div className="v2-stage-lens">
            <LensToggle profileType={profileType} setProfileType={setProfileType} />
          </div>
          <USMap
            features={topoState.features}
            path={path}
            projection={projection}
            centroids={topoState.centroids}
            states={statesData}
            athletes={filteredAthletes}
            trainingCenters={trainingCentersData}
            colleges={collegesData}
            familyColors={sportFamiliesData.colors}
            metric={metric}
            selectedState={selectedState}
            selectedAthlete={selectedAthleteId}
            showDots={overlays.dots}
            showCenters={overlays.centers}
            showColleges={overlays.colleges}
            onSelectState={handleSelectState}
            onSelectAthlete={handleSelectAthlete}
            activePlate={activePlate}
            factories={(analyticsData[`factories_${profileType}`] || analyticsData.factories)}
            hoveredFactory={hoveredFactory}
            onHoverFactory={setHoveredFactory}
            hover={hover}
            concentrationData={analyticsData[`concentration_${profileType}`] || analyticsData.concentration}
            perCapitaData={analyticsData[`per_capita_${profileType}`] || analyticsData.per_capita}
            hsConversionData={analyticsData[`hs_conversion_${profileType}`] || analyticsData.hs_conversion}
            eraData={analyticsData[`era_${profileType}`] || analyticsData.era}
            altitudeData={analyticsData[`elevation_sport_${profileType}`] || analyticsData.elevation_sport}
            userHome={userHome}
            profileType={profileType}
            lensStateCounts={lensStateCounts}
            stats={[
              {
                label: profileType === "paralympic" ? "Paralympians located" : "Olympians located",
                value: totals.lensGeocoded.toLocaleString(),
                unit: "geocoded",
              },
              { label: "States covered", value: totals.states, unit: "of 51" },
            ]}
          />
          <div className="v2-filters-strip">
            <Filters
              metric={metric}
              setMetric={setMetric}
              families={allFamilies}
              selectedFamilies={selectedFamilies}
              toggleFamily={toggleFamily}
              setSelectedFamilies={setSelectedFamilies}
              familyColors={sportFamiliesData.colors}
              familyCounts={sportFamiliesData.counts}
              medalOnly={medalOnly}
              setMedalOnly={setMedalOnly}
              eraRange={eraRange}
              setEraRange={setEraRange}
              overlays={overlays}
              setOverlay={setOverlay}
              compact
              metricLocked={metricLocked}
            />
          </div>
        </section>

        <section className="v2-plate-scroll">
        {selectedAthlete ? (
          <AthleteCard
            athlete={selectedAthlete}
            trainingCenters={trainingCentersData}
            states={statesData}
            familyColors={sportFamiliesData.colors}
            onClose={() => setSelectedAthleteId(null)}
          />
        ) : selectedStateObj ? (
          <StatePanel
            state={selectedStateObj}
            colleges={collegesData}
            onClose={() => setSelectedState(null)}
            profileType={profileType}
            lensStateCounts={lensStateCounts}
          />
        ) : (
          <div className="v2-plate-body">
            <PlateBody
              plate={activePlateObj}
              totals={totals}
              hoveredFactory={hoveredFactory}
              onHoverFactory={setHoveredFactory}
              hover={hover}
              setHoverField={setHoverField}
              onUserHome={setUserHome}
              profileType={profileType}
            />
            <PlateStory plateKey={activePlate} profileType={profileType} />
          </div>
        )}
        </section>

        <aside className="v2-chat">
          <ChatBot
            profileType={profileType}
            onApplyPatch={applyAtlasPatch}
            embedded
          />
        </aside>
      </main>
    </div>
  );
}
