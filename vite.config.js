import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
    proxy: {
      // Forward chatbot calls to the Express backend (server.js).
      "/api": {
        target: "http://localhost:5175",
        changeOrigin: true,
      },
      // Plate XIII voice WebSocket now co-hosts with the Express api on
      // the same port; one Cloud Run revision serves both /api/* and /live.
      "/live": {
        target: "ws://127.0.0.1:5175",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
