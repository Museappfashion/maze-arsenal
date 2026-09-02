// src/main.jsx
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { DeveloperAnalytics } from "./components/DeveloperAnalytics.jsx";
import { installRuntimeEnhancements } from "./features/runtimeEnhancements.js";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element.");
}

const developerDashboard =
  new URLSearchParams(window.location.search).get("developer") === "1";

if (!developerDashboard) {
  installRuntimeEnhancements();
}

createRoot(rootElement).render(
  <>
    {developerDashboard ? <DeveloperAnalytics /> : <App />}
    <Analytics />
    <SpeedInsights />
  </>,
);
