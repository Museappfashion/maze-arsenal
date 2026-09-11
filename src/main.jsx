// src/main.jsx
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { DeveloperAnalytics } from "./components/DeveloperAnalytics.jsx";
import { installNextLevelEnhancement } from "./features/nextLevelEnhancement.js";
import { installRuntimeEnhancements } from "./features/runtimeEnhancements.js";
import { installSpecialWeaponVisibility } from "./features/specialWeaponVisibility.js";

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element.");
}

const developerDashboard =
  new URLSearchParams(
    window.location.search,
  ).get("developer") === "1";

if (!developerDashboard) {
  installRuntimeEnhancements();
  installNextLevelEnhancement();
  installSpecialWeaponVisibility();
}

createRoot(rootElement).render(
  <>
    {developerDashboard
      ? <DeveloperAnalytics />
      : <App />}
    <Analytics />
    <SpeedInsights />
  </>,
);
