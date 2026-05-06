import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AppV2 from "./AppV2.jsx";
import "./styles.css";

// Tiny path-based switch — no router dependency. Vite's dev server returns
// index.html for unknown paths, so /v2 hits this entry and we pick the right
// top-level component.
const path = (typeof window !== "undefined" ? window.location.pathname : "/").replace(/\/+$/, "") || "/";
const Root = path === "/v2" ? AppV2 : App;

createRoot(document.getElementById("root")).render(<Root />);
