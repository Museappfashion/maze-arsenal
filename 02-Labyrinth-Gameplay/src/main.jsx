// src/main.jsx

import {
  Analytics,
} from "@vercel/analytics/react";
import {
  SpeedInsights,
} from "@vercel/speed-insights/react";
import {
  createRoot,
} from "react-dom/client";

import App from "./App.jsx";
import {
  DeveloperAnalytics,
} from "./components/DeveloperAnalytics.jsx";
import {
  installCharacterModeEnhancement,
} from "./features/characterModeEnhancement.js";
import {
  installMendelVisuals,
} from "./features/mendelVisuals.js";
import {
  installNextLevelEnhancement,
} from "./features/nextLevelEnhancement.js";
import {
  installRuntimeEnhancements,
} from "./features/runtimeEnhancements.js";
import {
  installSettingsToggleEnhancement,
} from "./features/settingsToggleEnhancement.js";
import {
  installSpecialWeaponVisibility,
} from "./features/specialWeaponVisibility.js";
import {
  installVisualPolish,
} from "./features/visualPolish.js";

const rootElement =
  document.getElementById(
    "root",
  );

if (!rootElement) {
  throw new Error(
    "Missing #root element.",
  );
}

const developerDashboard =
  new URLSearchParams(
    window.location.search,
  ).get("developer") === "1";

if (!developerDashboard) {
  /*
   * Installed before React mounts so input-key protection
   * is registered before gameplay keyboard listeners.
   */
  installCharacterModeEnhancement();

  installRuntimeEnhancements();
  installSettingsToggleEnhancement();
  installNextLevelEnhancement();
  installSpecialWeaponVisibility();

  installVisualPolish();
  installMendelVisuals();
}

createRoot(
  rootElement,
).render(
  <>
    {developerDashboard
      ? <DeveloperAnalytics />
      : <App />}

    <Analytics />
    <SpeedInsights />
  </>,
);
