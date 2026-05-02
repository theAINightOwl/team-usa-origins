import React from "react";

/*
 * Marginalia — default right-column content when nothing is selected.
 * Styled like an atlas's printed reference page: drop cap, footnotes, sources.
 */
export default function Marginalia({ totals }) {
  return (
    <div className="detail marginalia">
      <p className="eyebrow">Plate I · Reference</p>
      <h3 style={{ fontSize: 28, letterSpacing: "-0.015em" }}>
        A <em>century</em> of hometowns.
      </h3>

      <p className="drop">
        This atlas draws from the {totals.athletes.toLocaleString()} athlete profiles currently
        published on <em>teamusa.com</em> — the official Team USA website — of whom {totals.geocoded.toLocaleString()}
        list a hometown we could pin on the ground by latitude and longitude. What follows is the
        geography of American Olympic and Paralympic talent, as Team USA itself describes it.
      </p>

      <p>
        Click any state to see who it produced, what sports it sends, and the quiet machinery behind
        that production: <em>the training centers it borders, the colleges it feeds, the high-school
        gyms that fill on weekday afternoons, the climate and wage that shape which games a
        child can reasonably choose.</em>
      </p>

      <p>
        The dots are athletes. The stars are training centers. The circles are colleges. The choropleth
          can be any of six metrics — from Team USA profiles to average annual snowfall — and each one
        rearranges the country in its own particular way.
      </p>

      <div className="footnote">
        <p>
          <sup>1</sup> Athlete roster scraped directly from <em>teamusa.com/api/athletes</em>.
          Names, hometowns, sports, schools, and medal counts come straight from the Team USA
          profile payload — no Olympedia or Paralympic.org blending.
        </p>
        <p>
          <sup>1a</sup> Hometown coordinates looked up against the 2023 U.S. Census Gazetteer by
          (city, state); athletes whose city has no gazetteer match are shown aggregated in their
          state rollup but not as individual dots.
        </p>
        <p>
          <sup>2</sup> Training-center roster is curated from official facility pages. Feeder-college
          counts use conservative multi-school matches against the EADA public dataset for the 2023 reporting year.
        </p>
        <p>
          <sup>3</sup> High-school participation uses official 2024-25 NFHS state totals.
          NFHS counts participation slots, not unique students; a multisport student can
          count more than once. The old estimated history table remains legacy support data
          and is not used for Plate X.
        </p>
        <p>
          <sup>4</sup> County-level income is from the Census ACS 5-year, 2022 vintage, weighted by
          county population and rolled up to the state.
        </p>
      </div>
    </div>
  );
}
