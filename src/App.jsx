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

  // ── Per-plate auto-overlay/metric flips ───────────────────────────
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
  const WELCOME_KEY = "olympian-roots:welcome-seen";
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
            Olympian <em>Roots</em>
          </h1>
          <div className="welcome-meta">
            <span>Team USA · Olympic &amp; Paralympic</span>
            <span className="sep">·</span>
            <span>1896 — 2026</span>
          </div>
        </header>

        <main className="welcome-main">
          <p className="welcome-eyebrow">Welcome</p>
          <h2 id="welcome-title" className="welcome-title">
            An atlas you can <em>talk</em> to.
          </h2>
          <p className="welcome-lede">
            Olympian Roots maps the support systems — training centers, colleges,
            high-school pipelines, wages, and weather — behind 8,500+ Team USA
            Olympic and Paralympic profiles. The unusual part: it ships with an
            agent that turns the whole atlas into a conversation.
          </p>

          <section className="welcome-hero">
            <p className="hero-eyebrow">★ The standout feature</p>
            <h3 className="hero-title">
              Work with <em>Atlas</em>.
            </h3>
            <p className="hero-blurb">
              The chat panel on the right isn't a bolt-on. It can answer in prose,
              draw live charts on demand, and steer the dashboard for you — three
              ways to use the same agent:
            </p>

            <div className="hero-modes">
              <div className="hero-mode">
                <span className="mode-label">Type</span>
                <p className="mode-example">
                  <em>"Why does Park City, UT produce so many olympians?"</em>
                </p>
                <p className="mode-note">Prose answer with citations.</p>
              </div>
              <div className="hero-mode">
                <span className="mode-label">Talk</span>
                <p className="mode-example">
                  <em>Tap the mic. Speak. Atlas replies out loud.</em>
                </p>
                <p className="mode-note">Live voice, interrupt any time.</p>
              </div>
              <div className="hero-mode">
                <span className="mode-label">Chart</span>
                <p className="mode-example">
                  <em>"Bar chart of medals by sport family."</em>
                </p>
                <p className="mode-note">A real Plotly figure renders in the chat.</p>
              </div>
            </div>

            <div className="hero-aside">
              <p>
                <strong>It also drives the dashboard.</strong> Try{" "}
                <em>"filter to Paralympic only"</em> or{" "}
                <em>"jump to the per-capita plate, top 10 states"</em> — the lens,
                filters, plate selector, and map all respond. The agent has
                read-write hands on the same UI you're looking at.
              </p>
            </div>
          </section>

          <section className="welcome-secondary">
            <p className="secondary-eyebrow">Or browse it the old way</p>
            <ul className="secondary-list">
              <li>
                <strong>Pick a plate</strong> — 12 editorial stories along the top, from a
                century of hometowns to your own geography.
              </li>
              <li>
                <strong>Switch lenses</strong> — Olympic / Paralympic toggle inside the
                stage card re-renders the whole atlas.
              </li>
              <li>
                <strong>Filter the map</strong> — sport family, era window, medal-only,
                and overlay toggles below the map.
              </li>
              <li>
                <strong>Click anywhere</strong> — a state opens its profile breakdown;
                an athlete dot opens their card.
              </li>
              <li>
                <strong>Hide a panel</strong> — edge arrows collapse either side; the
                avatar at the bottom-right brings the chat back when it's hidden.
              </li>
            </ul>
          </section>

          <p className="welcome-foot">
            You can reopen this guide any time via the <span className="kbd">?</span> in the top bar.
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
            Olympian <em>Roots</em>
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
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 5h16v11H8l-4 4V5z" />
          <g className="dot-cluster">
            <circle cx="9" cy="11" r="1.1" />
            <circle cx="12" cy="11" r="1.1" />
            <circle cx="15" cy="11" r="1.1" />
          </g>
        </svg>
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
