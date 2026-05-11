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
import AtlasAvatar from "./components/AtlasAvatar.jsx";

const MAP_WIDTH = 975;
const MAP_HEIGHT = 610;

/*
 * App — split-panel layout.
 *
 *   ┌──────────────────────────────────────────┐
 *   │ TOP BAR  wordmark · meta · plate index   │
 *   ├─────────────────────────────┬────────────┤
 *   │ CONTENT (scrolls)           │ CHAT       │
 *   │   stage card (lens, map,    │ pinned to  │
 *   │   filters)                  │ viewport,  │
 *   │   plate body / story        │ messages   │
 *   │                             │ scroll,    │
 *   │                             │ input      │
 *   │                             │ pinned ▼   │
 *   └─────────────────────────────┴────────────┘
 *
 * Either column can collapse to the side via the edge toggles. When the
 * chat is hidden a soft-glowing avatar at the bottom-right invites it back.
 */
export default function App() {
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
      .catch((err) => console.error("[olympian-roots] topology load failed", err));
    return () => { alive = false; };
  }, []);

  const { projection, path } = useMemo(() => {
    const proj = geoAlbersUsa().scale(1280).translate([MAP_WIDTH / 2, MAP_HEIGHT / 2 + 10]);
    return { projection: proj, path: geoPath().projection(proj) };
  }, []);

  // ── Filter state ──────────────────────────────────────────────────
  const allFamilies = sportFamiliesData.families;
  const [metric, setMetric] = useState("none");
  const [selectedFamilies, setSelectedFamilies] = useState(() => new Set(allFamilies));
  const [medalOnly, setMedalOnly] = useState(false);
  const [eraRange, setEraRange] = useState([1896, 2026]);
  const [overlays, setOverlays] = useState({ dots: true, centers: true, colleges: false });

  const PROFILE_TYPE_KEY = "hometown-atlas:profileType";
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

  // ── Selection + cross-component hover ─────────────────────────────
  const [selectedState, setSelectedState] = useState(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState(null);
  const [activePlate, setActivePlate] = useState("ref");
  const [hoveredFactory, setHoveredFactory] = useState(null);
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
  const [userHome, setUserHome] = useState(null);

  // ── Atlas chat dispatcher (validates patches from the chat agent) ─
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
    const ALLOWED_METRICS = ["none","olympians","medals","income","nfhs","temp","snow","elevation","per_capita","hs_per_million"];
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
    const ALLOWED_PLATES = ["ref","factories","concentration","halos","distance","climate","per_capita","colleges","hs_conversion","home_states","altitude","you"];
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

  // ── Per-plate auto-overlay/metric flips ───────────────────────────
  const PLATE_METRIC = {
    per_capita: "per_capita",
    hs_conversion: "hs_per_million",
  };
  const metricLocked = activePlate in PLATE_METRIC;
  useEffect(() => {
    setOverlays((o) => ({
      ...o,
      // Hide athlete dots on Plate XI so the family pins read cleanly.
      dots: activePlate === "home_states" ? false : true,
      centers: true,
      colleges: activePlate === "colleges",
    }));
    if (activePlate in PLATE_METRIC) {
      setMetric(PLATE_METRIC[activePlate]);
    } else if (activePlate === "home_states") {
      // No choropleth competes with the family dots.
      setMetric("none");
    } else {
      // Reset any plate-specific or retired metrics back to "none" when
      // moving off their plate. `era_swing` is kept for migration: users
      // who had the old Plate XI open before the rename get cleared.
      setMetric((m) => (
        m === "per_capita" || m === "hs_per_million" || m === "era_swing" ? "none" : m
      ));
    }
    setHover({});
  }, [activePlate]);

  // One-time migration: any user who had `metric: "era_swing"` persisted in
  // React state from the old Plate XI gets cleared on mount.
  useEffect(() => {
    if (metric === "era_swing") setMetric("none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectState = (abbr) => {
    setSelectedAthleteId(null);
    setSelectedState((prev) => (prev === abbr ? null : abbr));
  };
  const handleSelectAthlete = (id) => {
    setSelectedState(null);
    setSelectedAthleteId((prev) => (prev === id ? null : id));
  };

  // ── Derived data ──────────────────────────────────────────────────
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

  // ── Welcome screen (first-visit overlay) ──────────────────────────
  const WELCOME_KEY = "hometown-atlas:welcome-seen";
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(WELCOME_KEY) !== "1";
  });
  const dismissWelcome = () => {
    setShowWelcome(false);
    if (typeof localStorage !== "undefined") localStorage.setItem(WELCOME_KEY, "1");
  };
  const reopenWelcome = () => setShowWelcome(true);

  // ── Panel collapse state ──────────────────────────────────────────
  // Either 'chat' or 'content' may be hidden, never both at once.
  const [panelHidden, setPanelHidden] = useState(null);
  const togglePanel = useCallback((side) => {
    setPanelHidden((prev) => {
      if (prev === side) return null;       // already hidden — restore
      if (prev != null) return null;        // other is hidden — restore that instead
      return side;                          // hide this one
    });
  }, []);
  const shellClass = [
    "app-shell",
    panelHidden === "chat" ? "chat-hidden" : "",
    panelHidden === "content" ? "content-hidden" : "",
  ].filter(Boolean).join(" ");

  if (showWelcome) {
    return (
      <div className="welcome-page">
        <header className="welcome-header">
          <h1 className="wordmark">
            Hometown <em>Atlas</em>
          </h1>
          <div className="welcome-meta">
            <span>Team USA · Olympic &amp; Paralympic</span>
            <span className="sep">·</span>
            <span>1896 — 2026</span>
          </div>
        </header>

        <main className="welcome-main">
          <p className="welcome-eyebrow">Welcome to Hometown <em>Atlas</em></p>
          <h2 id="welcome-title" className="welcome-title">
            A living dashboard that turns <em>conversation</em> into <em>exploration</em>.
          </h2>
          <p className="welcome-lede">
            Hometown <em>Atlas</em> is an interactive atlas of the people, places, and
            support systems behind 8,500+ Team USA Olympic and Paralympic
            profiles, including hometowns, training centers, colleges,
            high-school pipelines, wages, weather, medals, and sport families.
          </p>
          <p className="welcome-lede">
            At the center of the experience are <strong>12 editorial story
            plates</strong>. Each plate gives you a focused way to explore the
            data, from hometown patterns and per-capita strength to medal
            concentration, regional clusters, college pipelines, and training
            hubs. These plates are the main storytelling layer of the dashboard.
          </p>
          <p className="welcome-lede">
            The other key layer is <strong>Atlas</strong>, your conversational
            guide. Atlas can help you move through the story plates, answer
            questions, generate charts, change filters, jump between views,
            and reshape the dashboard in real time.
          </p>
          <p className="welcome-lede">
            Atlas is also equipped with <strong>web search</strong>, so you
            can go beyond the dashboard and deep dive into any question that
            comes up while exploring.
          </p>

          <section className="welcome-hero">
            <AtlasAvatar size={96} className="welcome-hero-avatar" title="Atlas" />
            <p className="hero-eyebrow">★ What you can do with Atlas</p>
            <h3 className="hero-title">
              Ask, jump, visualize, or <em>steer</em>.
            </h3>

            <div className="hero-modes hero-modes-2col">
              <div className="hero-mode">
                <span className="mode-label">Ask questions</span>
                <p className="mode-example">
                  <em>"Why does Park City, UT produce so many Olympians?"</em>
                </p>
              </div>
              <div className="hero-mode">
                <span className="mode-label">Jump around the dashboard</span>
                <p className="mode-example">
                  <em>"Take me to the per-capita plate and show the top 10 states."</em>
                </p>
              </div>
              <div className="hero-mode">
                <span className="mode-label">Generate visuals</span>
                <p className="mode-example">
                  <em>"Show me a bar chart of medals by sport family."</em>
                </p>
              </div>
              <div className="hero-mode">
                <span className="mode-label">Control the view</span>
                <p className="mode-example">
                  <em>"Filter to Paralympic only."</em>
                  <br />
                  <em>"Show medalists from winter sports since 2000."</em>
                </p>
              </div>
            </div>

            <div className="hero-aside">
              <p>
                You can also <strong>tap the mic and speak naturally</strong>.
                Atlas can reply by voice, and you can interrupt at any time.
              </p>
            </div>
          </section>

          <section className="welcome-secondary">
            <p className="secondary-eyebrow">Explore manually</p>
            <ul className="secondary-list">
              <li>
                <strong>Pick a story plate</strong> to explore one of the 12
                editorial views.
              </li>
              <li>
                <strong>Switch lenses</strong> between Olympic and Paralympic.
              </li>
              <li>
                <strong>Filter the map</strong> by sport family, era,
                medal-only, and overlays.
              </li>
              <li>
                <strong>Click a state or athlete dot</strong> to open deeper
                profile details.
              </li>
              <li>
                <strong>Hide or reopen panels</strong> using the edge arrows,
                or bring Atlas back with the avatar in the bottom-right.
              </li>
            </ul>
          </section>

          <p className="welcome-foot">
            You can reopen this guide any time by clicking the{" "}
            <span className="kbd">?</span> in the top bar.
          </p>
          <button type="button" className="welcome-cta" onClick={dismissWelcome}>
            Enter the atlas →
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <header className="app-topbar">
        <div className="topbar-row">
          <h1 className="wordmark">
            Hometown <em>Atlas</em>
          </h1>
          <div className="topbar-meta">
            <span>Team USA · Olympic &amp; Paralympic</span>
            <span className="sep">·</span>
            <span>1896 — 2026</span>
            <button
              type="button"
              className="topbar-help"
              onClick={reopenWelcome}
              title="What is this? How do I use it?"
              aria-label="Open the welcome guide"
            >
              ?
            </button>
          </div>
        </div>
        <PlateSelector active={activePlate} setActive={setActivePlate} />
      </header>

      <button
        type="button"
        className="edge-toggle edge-left"
        onClick={() => togglePanel("content")}
        title={panelHidden === "content" ? "Show content panel" : "Hide content panel"}
        aria-label={panelHidden === "content" ? "Show content panel" : "Hide content panel"}
      >
        {panelHidden === "content" ? "▶" : "◀"}
      </button>
      <button
        type="button"
        className="edge-toggle edge-right"
        onClick={() => togglePanel("chat")}
        title={panelHidden === "chat" ? "Show chat panel" : "Hide chat panel"}
        aria-label={panelHidden === "chat" ? "Show chat panel" : "Hide chat panel"}
      >
        {panelHidden === "chat" ? "◀" : "▶"}
      </button>
      <button
        type="button"
        className="chat-avatar"
        onClick={() => togglePanel("chat")}
        title="Reopen Work with Atlas"
        aria-label="Reopen Work with Atlas"
      >
        <AtlasAvatar size={32} />
      </button>

      <main className="app-cols">
        <section className="content-col">
          <div className="stage">
            <div className="stage-head">
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
              homeStatesData={analyticsData[`centroids_${profileType}`] || analyticsData.centroids}
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
            <div className="stage-filters">
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
          </div>

          <section className="plate-section">
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
              <>
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
              </>
            )}
          </section>
        </section>

        <aside className="chat-col">
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
