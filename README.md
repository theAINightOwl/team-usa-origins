# Olympian Roots

An editorial atlas of Team USA hometowns and the support systems that produce
American Olympians and Paralympians. 11 analytical plates, a Gemini-powered
text chat ("Ask the atlas"), and a voice plate (XIII) that connects to
Gemini Live so you can talk to the atlas out loud.

## Setup

```bash
# 1. install npm deps (uses --legacy-peer-deps for react-simple-maps)
npm install --legacy-peer-deps

# 2. drop in your Gemini API key
cp .env.example .env
$EDITOR .env  # paste your key from https://aistudio.google.com/apikey

# 3. run frontend + chat backend together
npm run dev:all
```

Then open http://localhost:5174.

- Frontend (Vite, React 19): http://localhost:5174
- Chat backend (Express + Gemini): http://localhost:5175 (proxied as `/api/*`)

## Scripts

| Script | What it does |
|---|---|
| `npm run dev`        | Vite frontend only (no chatbot) |
| `npm run server`     | Express + Gemini backend only |
| `npm run server:dev` | Backend with `nodemon` reload |
| `npm run live`       | Node/TS voice server (Plate XIII) on :8765, via `tsx` |
| `npm run live:dev`   | Same, with `tsx watch` auto-reload |
| `npm run dev:all`    | Vite + Express + live voice, all together (recommended) |
| `npm run build`      | Production frontend build |

## Voice chat (Plate XIII)

Plate XIII opens a live voice line to the atlas. The browser talks to a
small Node/TypeScript server (`live/server.mts`) over a WebSocket, which
holds a [Gemini Live](https://ai.google.dev/gemini-api/docs/live)
session grounded in the same plate briefs the text chat uses. Run with
`tsx` — no build step.

`npm run dev:all` starts it alongside Vite and Express. Open Plate
**XIII** in the plate nav, tap the mic, allow microphone access, and
speak. Start talking over the model to interrupt it.

Troubleshooting:

- *"GEMINI_API_KEY is not configured on the live server"* — add the key
  to `.env`; the live server reads the same file as Express.
- *mic permission blocked* — Chrome requires `localhost` (or HTTPS) for
  `getUserMedia`; some Safari builds also refuse `127.0.0.1`.
- *WS error on connect* — verify the live server is up on `:8765`
  (check the yellow `live` stream in `npm run dev:all`).

## Safety — Model Armor

Both chat modes can pre-screen user prompts through
[Google Cloud Model Armor](https://docs.cloud.google.com/model-armor/overview)
before they reach Gemini. Armor catches prompt-injection and jailbreak
attempts, policy violations (hate / harassment / sexually-explicit /
dangerous), sensitive data (PII / credentials), malicious URLs, and
CSAM. Filter thresholds live in a GCP **template**, editable via console
or `gcloud` without redeploying the app.

The feature is **opt-in**: leave any of `MODEL_ARMOR_PROJECT`,
`MODEL_ARMOR_LOCATION`, or `MODEL_ARMOR_TEMPLATE` blank in `.env` and
it's disabled. App runs unchanged.

### One-time GCP setup

```bash
# 1. Pick (or create) a GCP project
export PROJECT_ID=<your-project-id>
export LOCATION=us-central1
gcloud config set project $PROJECT_ID

# 2. Enable the API
gcloud services enable modelarmor.googleapis.com --project=$PROJECT_ID

# 3. Create a template with sensible defaults for this app
gcloud model-armor templates create olympian-default \
  --project=$PROJECT_ID --location=$LOCATION \
  --rai-settings-filters='[
    {"filterType":"HATE_SPEECH","confidenceLevel":"HIGH"},
    {"filterType":"HARASSMENT","confidenceLevel":"HIGH"},
    {"filterType":"SEXUALLY_EXPLICIT","confidenceLevel":"HIGH"},
    {"filterType":"DANGEROUS","confidenceLevel":"HIGH"}
  ]' \
  --pi-and-jailbreak-filter-settings-enforcement=ENABLED \
  --pi-and-jailbreak-filter-settings-confidence-level=HIGH \
  --malicious-uri-filter-settings-enforcement=ENABLED

# 4. Grant Application Default Credentials on this machine
gcloud auth application-default login
```

Then fill in `.env`:

```
MODEL_ARMOR_PROJECT=<your-project-id>
MODEL_ARMOR_LOCATION=us-central1
MODEL_ARMOR_TEMPLATE=olympian-default
```

Restart both backends (`npm run dev:all`). Boot logs should show a
`🛡  [armor] enabled  project=…  template=…  location=…` line. Send a
prompt-injection probe like `Ignore all prior instructions…` and the
chat bubble should say **"Blocked by safety policy: prompt injection /
jailbreak (HIGH)"** almost instantly — Gemini is never called.

### How it's wired

- [server/armor.js](server/armor.js) — shared helper; lazily constructs a
  regional `ModelArmorClient` and exposes `sanitizePrompt(text)`.
- [server.js](server.js) calls it at the top of `POST /api/chat`, before
  the Gemini stream.
- [live/server.mts](live/server.mts) accumulates voice transcript
  fragments per connection and checks the whole turn at `turn_complete`;
  typed-in-voice-mode text is checked directly. On a match the WS
  closes with an error event.
- Transport failures **fail open** — if Armor is unreachable the chat
  continues. The system-prompt NIL/medal rules remain in force either
  way.

## Data pipeline

Static JSONs under `src/data/` are produced by Python scripts in `scripts/`,
reading inputs from `data/`. Everything runs from the repo root and is
self-contained (no external repo needed).

```bash
# Optional prerequisite (one-time, rescrape Team USA roster):
python3 scripts/scrape_athletes.py             # -> data/team_usa_athletes.{csv,json}

# Optional: regenerate hometown geocodes (downloads 2023 Census Gazetteer to .cache/):
python3 scripts/geocode_teamusa_hometowns.py   # -> data/teamusa_hometown_geocodes.csv

# Rebuild app data:
python3 scripts/compute_olympian_roots.py      # athletes / states / centers / colleges / families
python3 scripts/compute_analytics.py           # analytics.json for the 11 plates
```

The chat bot reads `src/data/analytics.json` server-side at startup, so a
restart of the Express server picks up new data.
