# Olympian Roots live voice server

Tiny Node/TypeScript server that bridges the browser to the Gemini Live
API for Plate XIII ("Ask the atlas, out loud"). Ported from
`gemini_live_toy_ts/` and re-pointed at this app's plate briefs as the
system prompt.

## Run

```bash
npm install --legacy-peer-deps   # from olympian-roots root
npm run live                     # tsx live/server.mts → ws://127.0.0.1:8765/live
```

`npm run dev:all` starts it alongside the Vite frontend and the Express
chat backend. Vite proxies the browser's `/live` WebSocket to this
server (see `vite.config.js`).

Reads `GEMINI_API_KEY`, `GEMINI_LIVE_MODEL`, `GEMINI_LIVE_VOICE`, and
`LIVE_PORT` from `olympian-roots/.env`.
