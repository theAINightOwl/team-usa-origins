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
      // Forward Plate XIII voice WebSocket to the Python live server.
      "/live": {
        target: "ws://127.0.0.1:8765",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
