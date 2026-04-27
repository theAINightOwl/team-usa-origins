import React, { useEffect, useMemo, useState } from "react";
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
import Legend from "./components/Legend.jsx";
import StatePanel from "./components/StatePanel.jsx";
import AthleteCard from "./components/AthleteCard.jsx";
import Plates from "./components/Plates.jsx";
import ChatBot from "./components/ChatBot.jsx";

const MAP_WIDTH = 975;
const MAP_HEIGHT = 610;

export default function App() {
  // ── Topology load ────────────────────────────────────────────────
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
    return () => {
      alive = false;
    };
  }, []);

  // ── Projection + path (shared across the whole plate) ────────────
  const { projection, path } = useMemo(() => {
    const proj = geoAlbersUsa().scale(1280).translate([MAP_WIDTH / 2, MAP_HEIGHT / 2 + 10]);
    return { projection: proj, path: geoPath().projection(proj) };
  }, []);

  // ── Filter state ─────────────────────────────────────────────────
  const allFamilies = sportFamiliesData.families;
  const [metric, setMetric] = useState("olympians");
  const [selectedFamilies, setSelectedFamilies] = useState(() => new Set(allFamilies));
  const [medalOnly, setMedalOnly] = useState(false);
  const [eraRange, setEraRange] = useState([1896, 2026]);
  const [overlays, setOverlays] = useState({ dots: true, centers: true, colleges: false });

  const toggleFamily = (f) => {
    setSelectedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };
  const setOverlay = (k, v) => setOverlays((o) => ({ ...o, [k]: v }));

  // ── Selection state ──────────────────────────────────────────────
  const [selectedState, setSelectedState] = useState(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState(null);
  const [activePlate, setActivePlate] = useState("ref");
  const [hoveredFactory, setHoveredFactory] = useState(null);

  const handleSelectState = (abbr) => {
    setSelectedAthleteId(null);
    setSelectedState((prev) => (prev === abbr ? null : abbr));
  };
  const handleSelectAthlete = (id) => {
    setSelectedState(null);
    setSelectedAthleteId((prev) => (prev === id ? null : id));
  };

  // ── Filtered athlete set for the map & panels ────────────────────
  const filteredAthletes = useMemo(() => {
    return athletesData.filter((a) => {
      if (!selectedFamilies.has(a.family)) return false;
      if (medalOnly && !(a.total_medals > 0)) return false;
      if (a.first != null) {
        if (a.first > eraRange[1]) return false;
      }
      if (a.last != null) {
        if (a.last < eraRange[0]) return false;
      }
      return true;
    });
  }, [selectedFamilies, medalOnly, eraRange]);

  const totals = useMemo(
    () => ({
      athletes: 8526, // total athletes scraped from teamusa.com
      geocoded: athletesData.length,
      filtered: filteredAthletes.length,
      medals: filteredAthletes.reduce((s, a) => s + (a.total_medals || 0), 0),
      states: new Set(filteredAthletes.map((a) => a.state).filter(Boolean)).size,
    }),
    [filteredAthletes]
  );

  const selectedAthlete = useMemo(
    () => (selectedAthleteId ? athletesData.find((a) => a.id === selectedAthleteId) : null),
    [selectedAthleteId]
  );
  const selectedStateObj = selectedState ? statesData[selectedState] : null;

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <div className="dateline">
            <span>Team USA · Olympic &amp; Paralympic</span>
            <span className="sep" />
            <span>1896 — 2026</span>
            <span className="sep" />
            <span>Vol. I</span>
          </div>
          <h1 className="wordmark">
            Olympian <em>Roots</em>
          </h1>
          <p className="subhead">
            A cartography of hometowns and the support systems — training centers, colleges,
            high-school pipelines, wages, and weather — that produce American olympians.
          </p>
        </div>
        <div className="plate">
          Plate <span className="big">I</span>
          <br />
          Hometowns · United States
        </div>
      </header>

      <div className="metastrip">
        <div className="cell">
          <span className="label">Athletes located</span>
          <span className="value num">
            {totals.geocoded.toLocaleString()}
            <span className="unit">geocoded</span>
          </span>
        </div>
        <div className="cell">
          <span className="label">After filters</span>
          <span className="value num">
            {totals.filtered.toLocaleString()}
            <span className="unit">shown</span>
          </span>
        </div>
        <div className="cell">
          <span className="label">Medals earned</span>
          <span className="value num">
            {totals.medals.toLocaleString()}
            <span className="unit">career total</span>
          </span>
        </div>
        <div className="cell">
          <span className="label">USOPC training centers</span>
          <span className="value num">
            {trainingCentersData.filter((c) => c.type === "OPTC").length}
            <span className="unit">official OPTCs</span>
          </span>
        </div>
        <div className="cell">
          <span className="label">Affiliated sites</span>
          <span className="value num">
            {trainingCentersData.filter((c) => c.type !== "OPTC").length}
            <span className="unit">USOPC-recognized</span>
          </span>
        </div>
        <div className="cell">
          <span className="label">Feeder colleges</span>
          <span className="value num">
            {collegesData.filter((c) => c.olympians > 0).length}
            <span className="unit">NCAA matched</span>
          </span>
        </div>
        <div className="cell">
          <span className="label">States covered</span>
          <span className="value num">
            {totals.states}
            <span className="unit">of 51</span>
          </span>
        </div>
      </div>

      <div className="main">
        <Filters
          metric={metric}
          setMetric={setMetric}
          families={allFamilies}
          selectedFamilies={selectedFamilies}
          toggleFamily={toggleFamily}
          familyColors={sportFamiliesData.colors}
          familyCounts={sportFamiliesData.counts}
          medalOnly={medalOnly}
          setMedalOnly={setMedalOnly}
          eraRange={eraRange}
          setEraRange={setEraRange}
          overlays={overlays}
          setOverlay={setOverlay}
        />

        <div>
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
            factories={analyticsData.factories}
            hoveredFactory={hoveredFactory}
            onHoverFactory={setHoveredFactory}
          />
          <div style={{ marginTop: 24 }}>
            <Legend
              families={allFamilies}
              familyColors={sportFamiliesData.colors}
              familyCounts={sportFamiliesData.counts}
            />
          </div>
        </div>

        <div>
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
            />
          ) : (
            <Plates
              activePlate={activePlate}
              setActivePlate={setActivePlate}
              totals={totals}
              hoveredFactory={hoveredFactory}
              onHoverFactory={setHoveredFactory}
            />
          )}
        </div>
      </div>

      <ChatBot />
    </div>
  );
}
