# Hometown Atlas

An editorial atlas of Team USA hometowns and the support systems that
produce American Olympians and Paralympians. The app has **10 analytical
plates** rendered over a US map, plus an embedded chat agent ("Work
with Atlas") that can answer questions, drive the dashboard, render
Plotly charts on demand, and respond to voice.

The site is built with Vite + React 19 on the frontend and a single
Express server on the backend that handles both the chat HTTP/SSE
endpoints and the voice WebSocket. Both AI paths talk to the Gemini API
(text chat + Gemini Live for voice).

## Repo structure

```
.
├── src/                    Frontend (Vite + React 19)
│   ├── App.jsx             Top-level shell, lens toggle, plate dispatcher
│   ├── components/         Plates, Filters, USMap, ChatBot, AtlasAvatar
│   ├── hooks/              useGeminiLive (browser WS client)
│   ├── lib/                SSE client, Plotly loader, markdown renderer
│   ├── data/               Pre-built static JSONs the frontend ships with
│   └── styles.css          All styling (editorial paper + rust accent)
│
├── server.js               Express backend: serves /api/* and /live
├── server/                 Backend internals
│   ├── plate_briefs.js     Markdown summaries of each plate (chat context)
│   ├── atlas_tool.js       update_atlas function-call schema for the agent
│   ├── viz_agent.js        SQL + code-execution loop that renders charts
│   └── viz_db.js           DuckDB warm-load over the same data files
│
├── live/                   Gemini Live voice bridge (TypeScript)
│   ├── server.mts          Exports attachLiveWS(httpServer); server.js mounts it
│   └── gemini-live.mts     Thin wrapper around @google/genai's Live API
│
├── public/                 Static assets served at root (atlas.svg, topology)
├── data/                   CSV inputs the viz agent's DuckDB loads at boot
│
├── Dockerfile              Two-stage build (npm ci + vite build, then runtime)
├── .dockerignore           Excludes scratch, demo_video, raw inputs
├── vite.config.js          Dev-only: proxies /api/* and /live to :5175
└── .env.example            Environment-variable template
```

A few keys to read this with:

- **One server, two protocols.** In production Cloud Run runs a single
  Node container. `server.js` mounts both Express routes and a
  WebSocket server (via `attachLiveWS` from `live/server.mts`) on the
  same HTTP server. Locally the Vite dev server proxies `/api/*` and
  `/live` to port 5175 so the dev experience matches prod.
- **Static data is checked in.** Everything the frontend renders ships
  as JSON in `src/data/`. The Python build pipeline that produced
  those JSONs lives in `scripts/` but is out of scope for this README.
- **The chat agent has two tools.** `update_atlas` drives the
  dashboard (lens, filters, active plate, etc.); `request_chart` hands
  off to the viz agent, which writes SQL against the in-process DuckDB
  and renders a Plotly figure.

## Setup

Requirements:

- Node 22 (LTS recommended). Older Node will work but the Cloud Run
  Dockerfile pins to `node:22-slim`.
- A Gemini API key from [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
  — free tier is enough to drive everything below.

Install and configure:

```bash
# 1. Install dependencies (legacy-peer-deps because of react-simple-maps)
npm install --legacy-peer-deps

# 2. Copy the env template and paste your Gemini key in
cp .env.example .env
$EDITOR .env
```

`.env` only needs `GEMINI_API_KEY` to run. Everything else has a
sensible default.

## Running locally

```bash
npm run dev:all
```

This starts the Vite dev server on **:5174** and the Express backend
(which also hosts the voice WebSocket) on **:5175** in one terminal
under [`concurrently`](https://www.npmjs.com/package/concurrently).
Open [http://localhost:5174](http://localhost:5174).

Individual processes if you want them apart:

| Script | What it does |
|---|---|
| `npm run dev`        | Vite frontend only (the API calls 404) |
| `npm run server`     | Express backend only (runs via `tsx`) |
| `npm run server:dev` | Backend with `tsx watch` auto-reload |
| `npm run live`       | Standalone voice server on :8765 (unused in prod) |
| `npm run build`      | Production frontend build (output → `dist/`) |
| `npm run preview`    | Serve the production build locally |

The Express server entry runs through `tsx` so `server.js` can import
the `.mts` voice module without a compile step.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | yes | — | Authenticates both the text chat and the voice path against Gemini. |
| `GEMINI_MODEL` | no | `gemini-3.1-flash-lite-preview` | Text-chat model. |
| `VIZ_MODEL` | no | `gemini-3-flash-preview` | Chart agent (needs `codeExecution` + function-call support). |
| `GEMINI_LIVE_MODEL` | no | `gemini-3.1-flash-live-preview` | Voice session model. |
| `GEMINI_LIVE_VOICE` | no | `Charon` | Prebuilt voice name for Gemini Live. |
| `PORT` | no | `5175` (dev), `8080` (Cloud Run) | Express listen port. |
| `LIVE_PORT` | no | `8765` | Only used by the standalone `npm run live` entry. |

`.env` is read by `dotenv` at server boot. On Cloud Run, `GEMINI_API_KEY`
is mounted from Secret Manager and the rest are set as environment
variables on the service.
