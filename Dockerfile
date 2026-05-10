# syntax=docker/dockerfile:1.6

# ── Stage 1: install deps + build the Vite frontend ─────────────────────
FROM node:22-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build


# ── Stage 2: production runtime ─────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Cloud Run sets $PORT (default 8080); server.js honors it.
ENV PORT=8080

COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev

# Server code + assets the Express app reads from disk at runtime.
COPY server.js ./server.js
COPY server ./server
COPY src/data ./src/data

# CSV inputs the DuckDB viz agent reads at boot (filtered by .dockerignore).
COPY data ./data

# The built frontend.
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "server.js"]
