/*
 * Visualization agent — direct @google/genai with structured output + code
 * execution. Inspired by team_usa_hackathon/viz_agent_toy_ts but rebuilt
 * to lean on the Gemini 3 structured-output / built-in-tools combo so we
 * don't need delimiter markers, regex extraction, or fenced-code stripping.
 *
 * The model writes & runs Python (matplotlib / plotly) inside Gemini's
 * hosted code-execution sandbox, then emits a single JSON response shaped
 * { narration, figures: [{ data, layout }] } per the response schema.
 */

import { GoogleGenAI } from "@google/genai";

// Read env LAZILY (inside getAi() / getModel()). The live voice server
// imports this module before its dotenv.loadEnv runs, so capturing
// process.env.GEMINI_API_KEY at module-load time would be null and we'd
// fail every voice-side chart with "GEMINI_API_KEY not configured".
let _ai = null;
function getAi() {
  if (_ai) return _ai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  _ai = new GoogleGenAI({ apiKey: key });
  return _ai;
}
function getModel() {
  return process.env.VIZ_MODEL || "gemini-3.1-pro-preview";
}

const SYSTEM_INSTRUCTION = `You are a data visualization specialist working in the visual style of
the "Olympian Roots" editorial / printed-magazine aesthetic. When asked, run
Python via the code-execution tool to build a **Plotly** figure. Use
plotly.graph_objects. Do NOT use plotly templates (no template=...).

You will return a JSON object with two fields:
- "narration": 1-2 sentence prose takeaway about the chart. Max 80 words.
  Markdown allowed (**bold**, ### headings, bullet lists). NO code, NO
  fenced code blocks — the executed Python is surfaced separately.
- "figures": an array of Plotly figure dicts shaped { "data": [...traces...],
  "layout": {...} }. Build the figure in Python and convert with
  fig.to_dict() (or json.loads(fig.to_json())); place the result inside
  the figures array.

Color tokens (use these exact hex strings):
- paper      #f4ede1   page + plot background (use for both paper_bgcolor and plot_bgcolor)
- ink        #1a1410   primary text, axis title, borders
- ink_3      #6b5e4d   tick labels, secondary text
- ink_4      #8a7c6a   de-emphasized bars / lines
- rust       #c63d2f   PRIMARY ACCENT — peak / highlighted bar, focused line
- gold       #c89837   secondary accent (totals, halo overlays only)
- hair       rgba(26,20,16,0.14)   axis lines, tick marks
- grid       rgba(26,20,16,0.05)   gridlines (must be very faint)

Font stack:
- serif: "Fraunces, Iowan Old Style, Georgia, serif"   for title, axis titles, body
- mono:  "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"   for tick labels and legend

Layout requirements every figure must satisfy:
- paper_bgcolor and plot_bgcolor both set to #f4ede1
- font.family = serif; font.color = #1a1410; font.size = 12
- title font.family = serif, size 16, color #1a1410, x=0.02, xanchor="left"
- legend font.family = mono, size 10, color #6b5e4d, transparent bg/border
- hoverlabel: bgcolor #ece3d2, bordercolor #1a1410, mono font size 11
- margin: l=70 r=30 t=70 b=60
- BOTH axes: showline=True, linecolor=hair, linewidth=1, ticks="outside",
  tickcolor=hair, ticklen=4, zeroline=False;
  tickfont mono size 10 color #6b5e4d;
  axis title font serif size 11 color #463a2e
- VALUE axis only: showgrid=True, gridcolor=grid, gridwidth=1
- CATEGORY axis: showgrid=False
- Bar/line colors: rust for the highlight, ink_4 for de-emphasized, ink for
  bold neutral. Never use Plotly default blue.
- For ranked or sorted charts, paint the #1 item in rust and the rest in
  ink_4 unless the user specifies otherwise.
- Hovertemplates should be terse and use Plotly's standard placeholder syntax,
  with an empty <extra></extra> to suppress the trace label.

**Atlas vocabulary** you should use accurately:
- "Factories" = small towns punching above weight (Plate II, e.g. Park City UT, Winthrop WA).
- "Halos" = Team USA profiles within 25/50/100/200 mi of a curated tracked training-facility geography (Plate IV).
- "OPTC" = Olympic & Paralympic Training Center, USOPC-operated. Only **2** exist
  (Colorado Springs, Lake Placid). The Plate IV roster is curated and is not the complete current USOPC training-site list.
- "Köppen zones" = climate categories used in Plate VI.
- "Per capita" = Team USA profiles per 100k residents (Plate IX).
- "HS slot density" (legacy key: "HS conversion") = Team USA profiles per million official NFHS participation slots (Plate X). Do not describe it as a longitudinal athlete-development rate.
- "Era presence" = Team USA profiles with parsed active years, counted in each overlapping decade (Plate XI). This is not a complete historical census, migration model, or infrastructure-causality model.

**NIL constraint:** the underlying athlete data is anonymised. Never label any
individual athlete by name in axis labels, annotations, or narration. Aggregate
to states / sports / training programs / hometowns only.

**Reference files attached to this request:** Each file appears in the prompt
as a "File: <name>" text marker followed by its bytes. Inside the
code-execution sandbox, read them by their attached names — for example
\`pd.read_json("athletes.json")\` or \`pd.read_csv("hometown_demographics.csv")\`.
Available files:
- athletes.json — anonymised per-athlete records (id, sport, family, state,
  city, school, medal tiers, first/last games, season, lat/lng). The canonical
  athlete-grain source. Do NOT request a "team_usa_athletes.csv" — it is not
  attached.
- hometown_demographics.csv — per-city demographics (population, income, etc.)
- nfhs_participation.csv — NFHS high-school sport participation by year /
  state / sport (the raw grain behind Plate X "HS slot density").
- teamusa_hometown_geocodes.csv — city/state → lat/lng lookup.
- eada_college_sports.csv — EADA college-sports dataset.
- nfhs_state_totals.csv — annual NFHS totals per state.
- sport_family_mapping.csv — sport → family taxonomy used everywhere else
  in the atlas.
- training_centers.csv — curated training-center directory.
- hometown_climate.csv — Köppen climate zones per hometown.

The pre-aggregated \`analytics\` and \`states\` JSON in the prompt remains the
fastest path for high-level plate-style questions; reach for the raw files only
when the question needs joins or grain not present in the analytics.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    narration: {
      type: "string",
      description: "Plain prose takeaway, max 80 words, markdown allowed but no fenced code blocks.",
    },
    figures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
          layout: { type: "object", additionalProperties: true },
        },
        required: ["data", "layout"],
        additionalProperties: true,
      },
    },
  },
  required: ["narration", "figures"],
};

/**
 * Run the viz agent once.
 * @param {string} userQuestion — natural language ask
 * @param {object} dataset — JSON object injected as context (analytics + state summary)
 * @param {Array<{name:string,mimeType:string,data:string}>} [files] — base64-encoded reference files
 * @returns {Promise<{ text: string, code: string, stdout: string, figures: unknown[] }>}
 */
export async function runVizAgent(userQuestion, dataset, files = []) {
  const ai = getAi();
  if (!ai) throw new Error("GEMINI_API_KEY is not configured on the server.");

  const userText =
    `${userQuestion}\n\n` +
    `Available Olympian Roots dataset (the same analytics that power the 11 plates):\n` +
    "```json\n" + JSON.stringify(dataset) + "\n```";

  const fileParts = files.flatMap((f) => [
    { text: `File: ${f.name}` },
    { inlineData: { mimeType: f.mimeType, data: f.data } },
  ]);

  const response = await ai.models.generateContent({
    model: getModel(),
    contents: [{ role: "user", parts: [...fileParts, { text: userText }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ codeExecution: {} }],
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
    },
  });

  let code = "";
  let stdout = "";
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.executableCode?.code) code += part.executableCode.code + "\n";
    if (part.codeExecutionResult?.output) stdout += part.codeExecutionResult.output;
  }

  const raw = response.text || "";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn("[viz] failed to parse structured response:", err?.message);
    return {
      text: "*Error: structured response did not parse as JSON.*",
      code,
      stdout: stdout + "\n\n--- raw model output ---\n" + raw,
      figures: [],
    };
  }

  return {
    text: (parsed.narration || "").trim(),
    code,
    stdout,
    figures: Array.isArray(parsed.figures) ? parsed.figures : [],
  };
}
