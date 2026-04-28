/*
 * Olympian Roots chat backend
 * ---------------------------
 * Tiny Express server that proxies a Gemini-powered chat to the React frontend.
 * The Gemini API key lives in `.env` here — the browser never sees it.
 *
 * One route:
 *   POST /api/chat
 *     body: { messages: [{ role: "user"|"model", text: "..." }, ...] }
 *     resp: text/event-stream of SSE frames:
 *           data: {"type":"text","delta":"..."}\n\n
 *           data: {"type":"sources","sources":[{title,uri},...]}\n\n
 *           data: {"type":"done"}\n\n
 *           data: {"type":"error","message":"..."}\n\n
 *
 * Reads analytics.json + states.json from disk at startup and embeds them in
 * the system prompt so the model can answer specific lookups.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Agent, setGlobalDispatcher } from "undici";
import cors from "cors";
import express from "express";
import { GoogleGenAI } from "@google/genai";

// The Gemini Pro + code-execution path can hold the connection open well
// beyond Node's default 30s headers timeout while it runs Python in the
// hosted sandbox. Bump the global undici dispatcher so /api/chat's chart
// fan-out and /api/viz both have room to breathe.
setGlobalDispatcher(new Agent({
  headersTimeout: 5 * 60_000,
  bodyTimeout: 5 * 60_000,
  connectTimeout: 30_000,
}));

import { buildPlateBriefs } from "./server/plate_briefs.js";
import { runVizAgent } from "./server/viz_agent.js";
// Model Armor (disabled — re-enable by uncommenting here and in /api/chat + app.listen)
// import { sanitizePrompt, logArmorBanner } from "./server/armor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "src", "data");

// ── Load static data context once at boot ───────────────────────────────
const analytics = JSON.parse(readFileSync(join(DATA_DIR, "analytics.json"), "utf-8"));
const states = JSON.parse(readFileSync(join(DATA_DIR, "states.json"), "utf-8"));
const plateBriefs = buildPlateBriefs(analytics, states);

// ── Gemini setup ────────────────────────────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const PORT = Number(process.env.PORT || 5175);

if (!API_KEY) {
  console.warn(
    "\n⚠️  GEMINI_API_KEY missing from .env — server will start, but /api/chat\n" +
    "    will return an explanatory error instead of contacting Gemini.\n" +
    "    Drop your key from https://aistudio.google.com/apikey into .env.\n"
  );
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// ── System prompt builder ───────────────────────────────────────────────
function systemPrompt() {
  return [
    "You are an analytical assistant embedded in **Olympian Roots**, an editorial atlas of Team USA hometowns and the support systems that produce American Olympians and Paralympians.",
    "",
    "The user is currently looking at a US map with 11 plates of pre-computed findings. Your job is to answer their questions about the data and the broader context.",
    "",
    "**What the user can already see — the 11 plates:**",
    "",
    plateBriefs,
    "",
    "**Raw data you can quote from:**",
    "",
    "```json",
    JSON.stringify(analytics, null, 0),
    "```",
    "",
    "**Rules of engagement:**",
    "1. **NIL — strict.** The athletes dataset is anonymised for NIL reasons. Do NOT name any specific athlete, not from the dataset and not from outside knowledge. If the user asks about a particular athlete by name, decline and redirect to the pattern, place, program, or sport instead. \"An Olympic medalist from Park City\" is fine; naming them is not.",
    "2. **Medal-level only.** Never present detailed athletic performance records — no finishing times, splits, event-by-event placings, world records, personal bests, or race-by-race breakdowns. The finest grain you are allowed is medal level (\"an Olympic gold medalist\", \"a two-time Paralympic bronze medalist\", or counts like \"produced 42 Olympians\"). Keep the focus on geography, pipelines, and programs, not individual box scores.",
    "3. **Use the data first.** When the user asks about specific places/sports/states, look up the actual numbers from the data above before reaching for the web.",
    "4. **Use Google Search for context.** For deep-dive 'why' questions — history, training programs, individual towns, sport culture, recent news — call the googleSearch tool and ground your answer in real sources. Do not pull named athletes or performance stats back from the web either.",
    "5. **Cite web sources** inline as `[short title](url)` at the relevant spot.",
    "6. **Be concise.** Markdown is welcome (lists, **bold**, headers). Keep most answers under ~200 words unless the user asks for a deep dive.",
    "7. **Stay honest.** If the data doesn't say or you don't know, say so.",
    "8. The current date is April 2026.",
  ].join("\n");
}

// ── Helpers ─────────────────────────────────────────────────────────────
function sseSend(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function extractGroundingSources(chunk) {
  // Newer Gemini SDK: groundingMetadata under candidates[0].groundingMetadata
  const meta = chunk?.candidates?.[0]?.groundingMetadata;
  if (!meta) return [];
  const chunks = meta.groundingChunks || [];
  const out = [];
  for (const gc of chunks) {
    const w = gc.web;
    if (w?.uri) out.push({ title: w.title || w.uri, uri: w.uri });
  }
  return out;
}

// ── App ─────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    keyPresent: !!API_KEY,
    plates: 11,
  });
});

// Build the dataset payload the viz agent will receive when the chat agent
// invokes its `request_chart` function. Same shape as /api/viz uses below;
// extracted so both code paths stay in sync.
function buildVizDataset() {
  const stateSummary = Object.fromEntries(
    Object.entries(states).map(([abbr, s]) => [
      abbr,
      {
        name: s.name,
        olympians: s.olympians,
        medals: s.medals,
        gold: s.gold,
        top_sports: s.top_sports,
        training_centers: s.training_centers,
      },
    ])
  );
  return { analytics, states: stateSummary };
}

const REQUEST_CHART_DECL = {
  name: "request_chart",
  description:
    "Render an interactive Plotly chart of the atlas data when the user asks for a visualization, comparison, or trend that benefits from a chart. Use sparingly — only when a chart genuinely helps over prose. Pass a self-contained chart specification that names the dimensions, axes, sort order, and any highlight; the chart agent has access to the same atlas analytics you do.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "A self-contained chart specification: what to plot, axes, highlight, sort order, etc. The chart agent will receive only this string plus the atlas dataset, so include any context the chart needs.",
      },
    },
    required: ["prompt"],
  },
};

app.post("/api/chat", async (req, res) => {
  const { messages = [] } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Pass { messages: [{role,text},...] } in body." });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  if (!ai) {
    sseSend(res, {
      type: "error",
      message: "GEMINI_API_KEY is not configured on the server. Add it to olympian-roots/.env and restart.",
    });
    sseSend(res, { type: "done" });
    res.end();
    return;
  }

  // Model Armor — pre-screen the latest user turn before calling Gemini.
  // Disabled. Uncomment the block below (and the import at top of file) to
  // re-enable. Requires MODEL_ARMOR_{PROJECT,LOCATION,TEMPLATE} in .env.
  /*
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const armor = await sanitizePrompt(lastUser?.text || "");
  if (!armor.ok) {
    console.log(`[armor] blocked /api/chat — ${armor.reason}`);
    sseSend(res, {
      type: "error",
      message: `Blocked by safety policy: ${armor.reason}. Try rephrasing in atlas terms (states, sports, programs).`,
    });
    sseSend(res, { type: "done" });
    res.end();
    return;
  }
  */

  const contents = messages.map((m) => ({
    role: m.role === "model" || m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text || "" }],
  }));

  let collectedSources = [];

  // Gemini 3 supports `thinkingConfig`; Gemini 2.5 and earlier reject it.
  const config = {
    systemInstruction: systemPrompt(),
    tools: [{
      googleSearch: {},
      functionDeclarations: [REQUEST_CHART_DECL],
    }],
    // Required when combining built-in tools (googleSearch) with custom
    // functionDeclarations on Gemini 3.
    toolConfig: { includeServerSideToolInvocations: true },
  };
  if (/gemini-3/.test(MODEL) && process.env.GEMINI_THINKING) {
    config.thinkingConfig = { thinkingLevel: process.env.GEMINI_THINKING };
  }

  // Stream one turn of the chat agent. Returns:
  //   { fc: ..., modelTurnParts: [...] }
  // where modelTurnParts is the full accumulated parts array of the model
  // turn (text + any functionCall parts including their thoughtSignature
  // blobs). On Gemini 3 we MUST echo thoughtSignature back when re-feeding
  // the model turn alongside our functionResponse, otherwise the API rejects
  // the next call with "Function call is missing a thought_signature".
  async function streamTurn(turnContents) {
    let textBuffer = "";
    let functionCallPart = null;
    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents: turnContents,
      config,
    });
    for await (const chunk of stream) {
      const delta = chunk?.text;
      if (delta) {
        sseSend(res, { type: "text", delta });
        textBuffer += delta;
      }
      const parts = chunk?.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        if (p.functionCall?.name === "request_chart") {
          // Keep the WHOLE part — it carries the thoughtSignature.
          functionCallPart = p;
        }
      }
      const sources = extractGroundingSources(chunk);
      for (const s of sources) {
        if (!collectedSources.find((x) => x.uri === s.uri)) {
          collectedSources.push(s);
        }
      }
    }
    const modelTurnParts = [];
    if (textBuffer) modelTurnParts.push({ text: textBuffer });
    if (functionCallPart) modelTurnParts.push(functionCallPart);
    return { fc: functionCallPart?.functionCall || null, modelTurnParts };
  }

  try {
    let { fc, modelTurnParts } = await streamTurn(contents);

    while (fc) {
      // Tell the client a chart is being prepared so it can show a placeholder.
      sseSend(res, { type: "chart_pending" });

      let vizResult;
      try {
        vizResult = await runVizAgent(fc.args?.prompt || "", buildVizDataset());
      } catch (err) {
        console.error("[chat] viz agent error:", err);
        vizResult = {
          text: `*Chart could not be generated: ${err?.message || String(err)}*`,
          figures: [],
          code: "",
          stdout: "",
        };
      }

      sseSend(res, {
        type: "chart",
        figures: vizResult.figures || [],
        narration: vizResult.text || "",
        code: vizResult.code || "",
      });

      // Echo the model's full turn back (includes thoughtSignature) and
      // append our functionResponse, then resume streaming so the chat agent
      // can add a one-line wrap-up.
      contents.push({ role: "model", parts: modelTurnParts });
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              id: fc.id,
              name: "request_chart",
              response: {
                result: {
                  rendered: true,
                  figure_count: (vizResult.figures || []).length,
                  narration: vizResult.text || "",
                },
              },
            },
          },
        ],
      });

      ({ fc, modelTurnParts } = await streamTurn(contents));
    }

    if (collectedSources.length > 0) {
      sseSend(res, { type: "sources", sources: collectedSources });
    }
    sseSend(res, { type: "done" });
  } catch (err) {
    console.error("[chat] gemini error:", err);
    sseSend(res, {
      type: "error",
      message: err?.message || String(err),
    });
    sseSend(res, { type: "done" });
  } finally {
    res.end();
  }
});

// ── Viz agent — natural-language → interactive Plotly figure ────────────
//
// Asks the ADK viz agent (Gemini Pro + BuiltInCodeExecutor) to write and
// run Python that produces a themed Plotly figure. Synchronous JSON
// response — small enough to skip SSE.
app.post("/api/viz", async (req, res) => {
  const question = (req.body?.question || "").toString().trim();
  if (!question) {
    res.status(400).json({ error: "Pass { question: '...' } in body." });
    return;
  }
  if (!API_KEY) {
    res.status(500).json({
      error: "GEMINI_API_KEY is not configured on the server. Add it to .env and restart.",
    });
    return;
  }

  try {
    const result = await runVizAgent(question, buildVizDataset());
    res.json(result);
  } catch (err) {
    console.error("[viz] agent error:", err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(
    `\n📜  Olympian Roots chat backend listening on :${PORT}` +
    `\n    model: ${MODEL}` +
    `\n    key:   ${API_KEY ? "loaded ✓" : "missing ✗"}` +
    `\n    plates loaded: 11` +
    "\n"
  );
  // logArmorBanner("   🛡  [armor]");   // Model Armor banner (disabled)
});
