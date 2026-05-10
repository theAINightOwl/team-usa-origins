// WebSocket bridge from the browser to Gemini Live (Plate XIII).
//
// Two entry shapes:
//   • Standalone:    `tsx live/server.mts` boots a dedicated http server on
//                    LIVE_PORT (default 8765). Used by `npm run live`.
//   • Co-hosted:     `attachLiveWS(httpServer)` mounts the WebSocketServer
//                    at /live on an existing http.Server (e.g. the Express
//                    server.js uses on Cloud Run). One process, one URL.

import type { Server as HttpServer } from "node:http";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { WebSocketServer } from "ws";

import { GeminiLive } from "./gemini-live.mts";
import { buildPlateBriefs } from "../server/plate_briefs.js";
import { runVizAgent } from "../server/viz_agent.js";
import {
  UPDATE_ATLAS_DECL,
  ATLAS_CONTROLS_INSTRUCTIONS,
  summarizePatch,
} from "../server/atlas_tool.js";
// Model Armor (disabled — re-enable by uncommenting here and the blocks below)
// import { sanitizePrompt, logArmorBanner } from "../server/armor.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
loadEnv({ path: join(ROOT, ".env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("\n⚠️  GEMINI_API_KEY missing from .env — Plate XIII will not work.\n");
}

const MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";
const VOICE = process.env.GEMINI_LIVE_VOICE ?? "Charon";
const PORT = Number(process.env.LIVE_PORT ?? 8765);

const analytics = JSON.parse(
  readFileSync(join(ROOT, "src", "data", "analytics.json"), "utf-8"),
);
const states = JSON.parse(
  readFileSync(join(ROOT, "src", "data", "states.json"), "utf-8"),
);
const plateBriefs = buildPlateBriefs(analytics, states);

const SYSTEM_INSTRUCTION = [
  "You are the voice of Hometown Atlas, an editorial atlas of Team USA",
  "hometowns. The user is listening, not reading — keep replies short,",
  "conversational, and under about 40 spoken words. Prefer one vivid",
  "concrete detail over exhaustive lists. Reference plates by roman numeral",
  "when it helps (\"Plate nine\").",
  "",
  "STRICT RULES — follow without exception:",
  "- NIL: do NOT name any specific athlete, from the dataset or from outside",
  "  knowledge. If the user asks about a particular athlete by name, decline",
  "  and redirect to the pattern, place, program, or sport. \"An Olympic",
  "  medalist from Park City\" is fine; naming them is not.",
  "- Medal-level only: never give detailed athletic performance — no times,",
  "  splits, event placings, world records, personal bests, or race-by-race",
  "  breakdowns. Finest allowed grain is medal level (\"Olympic gold",
  "  medalist\", \"two-time Paralympic bronze\") or counts (\"42 Olympians\").",
  "- If you don't know, say so. Current date: April 2026.",
  "",
  "WHAT THE USER IS LOOKING AT:",
  "",
  plateBriefs,
  "",
  ATLAS_CONTROLS_INSTRUCTIONS,
].join("\n");

const REQUEST_CHART_DECL = {
  name: "request_chart",
  description:
    "Render an interactive Plotly chart for the user when they ask for a visualization, comparison, or trend that benefits from a chart. The chart appears on the user's screen instantly. After calling this, briefly narrate what the chart shows (under 30 spoken words). Pass a self-contained chart specification — what to plot, axes, sort order, any highlight.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Self-contained chart specification: what to plot, axes, highlight, sort order. The chart agent has access to the same atlas dataset you do.",
      },
    },
    required: ["prompt"],
  },
};

const TOOLS: any[] = [{
  googleSearch: {},
  functionDeclarations: [REQUEST_CHART_DECL, UPDATE_ATLAS_DECL],
}];

// Warm DuckDB at boot so the first chart turn doesn't pay the load latency.
// Idempotent — server.js may also warm it; getVizDb() is a singleton.
import("../server/viz_db.js").then((m) => m.getVizDb()).catch((err) => {
  console.warn("[viz] DuckDB warm failed (will retry on first request):", err?.message || err);
});

/**
 * Attach the /live WebSocket bridge to an existing http.Server.
 * Returns the WebSocketServer so the caller can manage shutdown.
 */
export function attachLiveWS(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/live" });
  registerLiveConnections(wss);
  return wss;
}

function registerLiveConnections(wss: WebSocketServer) {
  wss.on("connection", async (ws) => {
  console.log("[live] client connected");

  if (!GEMINI_API_KEY) {
    ws.send(JSON.stringify({
      type: "error",
      error: "GEMINI_API_KEY is not configured on the live server.",
    }));
    ws.close();
    return;
  }

  // Model Armor per-connection buffer + check. Disabled.
  // Uncomment this block (and the import at top) to re-enable:
  /*
  let userBuffer = "";
  let blocked = false;

  async function checkUserText(text: string) {
    if (blocked) return;
    const armor = await sanitizePrompt(text);
    if (!armor.ok) {
      blocked = true;
      console.log(`[live] [armor] blocked — ${armor.reason} — closing session`);
      try {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: "error",
            error: `Blocked by safety policy: ${armor.reason}. Try rephrasing in atlas terms.`,
          }));
        }
      } catch {}
      try { gemini.close(); } catch {}
      try { ws.close(); } catch {}
    }
  }
  */

  // Voice chart mapping. Closes over ws so we can push the figure straight
  // to the browser; the string returned to the model is intentionally short
  // so the speech response stays terse.
  const toolMapping = {
    request_chart: async ({ prompt }: { prompt?: string }) => {
      try {
        const result: any = await runVizAgent(prompt || "");
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: "chart",
            figures: result.figures || [],
            narration: result.text || "",
            code: result.code || "",
          }));
        }
        return `Chart rendered with ${(result.figures || []).length} figure(s). Narration: ${result.text || "(none)"}`;
      } catch (e: any) {
        const msg = `Chart generation failed: ${e?.message ?? e}`;
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "error", error: msg }));
        }
        return msg;
      }
    },
    // Voice version of update_atlas: push the patch to the browser; client
    // validates and applies it locally. Returned string is what the model
    // gets back, which it uses to compose its short spoken confirmation.
    update_atlas: async (patch: any) => {
      try {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "view_patch", patch: patch || {} }));
        }
        return `Atlas updated: ${summarizePatch(patch || {})}`;
      } catch (e: any) {
        const msg = `Atlas update failed: ${e?.message ?? e}`;
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "error", error: msg }));
        }
        return msg;
      }
    },
  };

  const gemini = new GeminiLive({
    apiKey: GEMINI_API_KEY,
    model: MODEL,
    voice: VOICE,
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: TOOLS,
    toolMapping,
    onAudio: (bytes) => {
      if (ws.readyState === ws.OPEN) ws.send(bytes, { binary: true });
    },
    onEvent: (event) => {
      // Model Armor turn-boundary check. Disabled.
      /*
      if (event.type === "user" && typeof event.text === "string") {
        userBuffer += event.text;
      }
      if (event.type === "turn_complete") {
        const toCheck = userBuffer;
        userBuffer = "";
        if (toCheck.trim()) void checkUserText(toCheck);
      }
      */
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
    },
  });

  try {
    await gemini.start();
    console.log(`[live] Gemini Live session opened (${MODEL})`);
  } catch (e: any) {
    console.error("[live] failed to open Gemini session:", e);
    try {
      ws.send(JSON.stringify({ type: "error", error: e?.message ?? String(e) }));
    } catch {}
    ws.close();
    return;
  }

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      gemini.sendAudio(data as Buffer);
      return;
    }
    const text = data.toString();
    let typed: string | null = null;
    try {
      const payload = JSON.parse(text);
      if (payload && typeof payload.text === "string") typed = payload.text;
    } catch {
      typed = text;
    }
    if (typed != null) {
      // Model Armor typed-text check. Disabled.
      // await checkUserText(typed); if (blocked) return;
      gemini.sendText(typed);
    }
  });

  ws.on("close", () => {
    console.log("[live] client disconnected");
    gemini.close();
  });
});
}

// Standalone entry — only fires when this module is the process entry point.
// When server.js imports attachLiveWS() to co-host on Cloud Run, this block
// is skipped so we don't bind a second http server.
const isStandalone =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isStandalone) {
  const httpServer = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        model: MODEL,
        voice: VOICE,
        keyPresent: Boolean(GEMINI_API_KEY),
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  attachLiveWS(httpServer);

  httpServer.listen(PORT, "127.0.0.1", () => {
    console.log(
      `\n🎤  Hometown Atlas live voice on ws://127.0.0.1:${PORT}/live` +
      `\n    model: ${MODEL}` +
      `\n    voice: ${VOICE}` +
      `\n    key:   ${GEMINI_API_KEY ? "loaded ✓" : "missing ✗"}` +
      "\n",
    );
    // logArmorBanner("   🛡  [armor]");   // Model Armor banner (disabled)
  });
}
