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

const MODEL = process.env.VIZ_MODEL || "gemini-3.1-pro-preview";
const API_KEY = process.env.GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

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
- "Halos" = athletes within 25/50/100/200 mi of a USOPC-recognized facility (Plate IV).
- "OPTC" = Olympic & Paralympic Training Center, USOPC-operated. Only **2** exist
  (Colorado Springs, Lake Placid). The other 8 are USOPC-affiliated training sites.
- "Köppen zones" = climate categories used in Plate VI.
- "Per capita" = Olympians per 100k residents (Plate IX).
- "HS conversion" = Olympians per million high-school sports participants (Plate X).

**NIL constraint:** the underlying athlete data is anonymised. Never label any
individual athlete by name in axis labels, annotations, or narration. Aggregate
to states / sports / training programs / hometowns only.`;

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
 * @returns {Promise<{ text: string, code: string, stdout: string, figures: unknown[] }>}
 */
export async function runVizAgent(userQuestion, dataset) {
  if (!ai) throw new Error("GEMINI_API_KEY is not configured on the server.");

  const userText =
    `${userQuestion}\n\n` +
    `Available Olympian Roots dataset (the same analytics that power the 11 plates):\n` +
    "```json\n" + JSON.stringify(dataset) + "\n```";

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: userText }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ codeExecution: {} }],
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
    },
  });

  // The intermediate code-execution turns leave executableCode +
  // codeExecutionResult parts in the response — surface them so the
  // existing <details> disclosure still works.
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
