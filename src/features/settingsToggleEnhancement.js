// src/features/settingsToggleEnhancement.js

const INSTALLED_KEY =
  "__mistMazeSettingsToggleEnhancementInstalled";

const STYLE_ID =
  "mist-extra-view-settings-style";

const LABELS_STORAGE_KEY =
  "mist-maze-labels-enabled";

const MINIMAP_STORAGE_KEY =
  "mist-maze-minimap-enabled";

const POINTER_STORAGE_KEY =
  "mist-maze-pointer-enabled";

const ROOT_MINIMAP_ATTRIBUTE =
  "data-mist-minimap-enabled";

const ROOT_POINTER_ATTRIBUTE =
  "data-mist-pointer-enabled";

const listeners = new Set();

function readStoredBoolean(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }

  return fallback;
}

function writeStoredBoolean(key, value) {
  try {
    localStorage.setItem(key, String(Boolean(value)));
  } catch {
    // Keep the in-memory value when storage is unavailable.
  }
}

let labelsEnabled =
  readStoredBoolean(LABELS_STORAGE_KEY, true);

let minimapEnabled =
  readStoredBoolean(MINIMAP_STORAGE_KEY, true);

let pointerEnabled =
  readStoredBoolean(POINTER_STORAGE_KEY, true);

function getWorld() {
  return globalThis.__mistMazeWorld ?? null;
}

function setBooleanField(object, field, value) {
  if (object && typeof object === "object") {
    object[field] = Boolean(value);
  }
}

function setWorldFields(world, fields, value) {
  if (!world) {
    return;
  }

  for (const field of fields) {
    setBooleanField(world, field, value);
    setBooleanField(world.settings, field, value);
  }
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function applyLabelsSetting(
  enabled,
  { persist = true, emit = true } = {},
) {
  const nextValue = Boolean(enabled);
  const changed = labelsEnabled !== nextValue;
  labelsEnabled = nextValue;

  globalThis.__mistMazeLabelsEnabled = labelsEnabled;

  setWorldFields(
    getWorld(),
    [
      "labelsOn",
      "showLabels",
      "labelsEnabled",
      "displayLabels",
    ],
    labelsEnabled,
  );

  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle(
      "mist-labels-disabled",
      !labelsEnabled,
    );
  }

  if (persist) {
    writeStoredBoolean(LABELS_STORAGE_KEY, labelsEnabled);
  }

  if (emit && changed) {
    emitChange();
  }
}

function applyMinimapSetting(
  enabled,
  { persist = true, emit = true } = {},
) {
  const nextValue = Boolean(enabled);
  const changed = minimapEnabled !== nextValue;
  minimapEnabled = nextValue;

  globalThis.__mistMazeMinimapEnabled = minimapEnabled;

  setWorldFields(
    getWorld(),
    ["minimapOn", "showMinimap", "minimapEnabled"],
    minimapEnabled,
  );

  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(
      ROOT_MINIMAP_ATTRIBUTE,
      String(minimapEnabled),
    );
  }

  if (persist) {
    writeStoredBoolean(MINIMAP_STORAGE_KEY, minimapEnabled);
  }

  if (emit && changed) {
    emitChange();
  }
}

function applyPointerSetting(
  enabled,
  { persist = true, emit = true } = {},
) {
  const nextValue = Boolean(enabled);
  const changed = pointerEnabled !== nextValue;
  pointerEnabled = nextValue;

  globalThis.__mistMazePointerEnabled = pointerEnabled;

  setWorldFields(
    getWorld(),
    ["exitPointerOn", "pointerGuideEnabled"],
    pointerEnabled,
  );

  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(
      ROOT_POINTER_ATTRIBUTE,
      String(pointerEnabled),
    );
  }

  if (persist) {
    writeStoredBoolean(POINTER_STORAGE_KEY, pointerEnabled);
  }

  if (emit && changed) {
    emitChange();
  }
}

function ensureStyle() {
  if (
    typeof document === "undefined" ||
    document.getElementById(STYLE_ID)
  ) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .mist-extra-view-settings {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
      margin-top: 10px;
    }

    .mist-extra-view-settings button {
      min-height: 42px;
      padding: 8px 7px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      background: rgba(15, 23, 42, 0.8);
      color: #e2e8f0;
      font: inherit;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.035em;
      cursor: pointer;
      transition:
        transform 120ms ease,
        border-color 120ms ease,
        background 120ms ease;
    }

    .mist-extra-view-settings button:hover {
      transform: translateY(-1px);
      border-color: rgba(125, 211, 252, 0.55);
    }

    .mist-extra-view-settings button[data-enabled="true"] {
      border-color: rgba(56, 189, 248, 0.8);
      background: rgba(14, 116, 144, 0.35);
      color: #f0f9ff;
    }

    .mist-extra-view-settings button[data-enabled="false"] {
      border-color: rgba(100, 116, 139, 0.45);
      background: rgba(15, 23, 42, 0.72);
      color: #94a3b8;
    }

    .mist-labels-disabled .enemy-label,
    .mist-labels-disabled .pickup-label,
    .mist-labels-disabled .weapon-label,
    .mist-labels-disabled .world-label,
    .mist-labels-disabled [data-world-label="true"] {
      display: none !important;
    }

    html[${ROOT_MINIMAP_ATTRIBUTE}="false"]
      [data-mist-minimap-shell="1"] {
      display: none !important;
    }

    @media (max-width: 520px) {
      .mist-extra-view-settings {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.append(style);
}

let lastWorld = null;

function synchronizeWorld() {
  const world = getWorld();

  if (!world) {
    lastWorld = null;
    return;
  }

  if (world === lastWorld) {
    return;
  }

  lastWorld = world;
  applyLabelsSetting(labelsEnabled, { persist: false, emit: false });
  applyMinimapSetting(minimapEnabled, { persist: false, emit: false });
  applyPointerSetting(pointerEnabled, { persist: false, emit: false });
}

export function getViewSettings() {
  return {
    labelsEnabled,
    minimapEnabled,
    pointerEnabled,
  };
}

export function subscribeViewSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function areLabelsEnabled() {
  return labelsEnabled;
}

export function isMinimapEnabled() {
  return minimapEnabled;
}

export function isPointerEnabled() {
  return pointerEnabled;
}

export function setLabelsEnabled(enabled) {
  applyLabelsSetting(enabled);
}

export function setMinimapEnabled(enabled) {
  applyMinimapSetting(enabled);
}

export function setPointerEnabled(enabled) {
  applyPointerSetting(enabled);
}

export function installSettingsToggleEnhancement() {
  if (
    typeof document === "undefined" ||
    globalThis[INSTALLED_KEY]
  ) {
    return () => {};
  }

  globalThis[INSTALLED_KEY] = true;
  ensureStyle();

  applyLabelsSetting(labelsEnabled, { persist: false, emit: false });
  applyMinimapSetting(minimapEnabled, { persist: false, emit: false });
  applyPointerSetting(pointerEnabled, { persist: false, emit: false });

  const intervalId = window.setInterval(synchronizeWorld, 250);
  synchronizeWorld();

  return () => {
    window.clearInterval(intervalId);
    document.getElementById(STYLE_ID)?.remove();
    document.documentElement.classList.remove("mist-labels-disabled");
    document.documentElement.removeAttribute(ROOT_MINIMAP_ATTRIBUTE);
    document.documentElement.removeAttribute(ROOT_POINTER_ATTRIBUTE);
    globalThis[INSTALLED_KEY] = false;
  };
}
