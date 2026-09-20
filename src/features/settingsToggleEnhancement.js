// src/features/settingsToggleEnhancement.js

const INSTALLED_KEY =
  "__mistMazeSettingsToggleEnhancementInstalled";

const WRAPPER_CLASS =
  "mist-extra-view-settings";

const STYLE_ID =
  "mist-extra-view-settings-style";

const LABELS_STORAGE_KEY =
  "mist-maze-labels-enabled";

const MINIMAP_STORAGE_KEY =
  "mist-maze-minimap-enabled";

function readStoredBoolean(
  key,
  fallback,
) {
  try {
    const value =
      localStorage.getItem(
        key,
      );

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  } catch {
    // Local storage can be unavailable in restricted browser modes.
  }

  return fallback;
}

function writeStoredBoolean(
  key,
  value,
) {
  try {
    localStorage.setItem(
      key,
      String(
        Boolean(value),
      ),
    );
  } catch {
    // Keep the in-memory setting even when storage is unavailable.
  }
}

let labelsEnabled =
  readStoredBoolean(
    LABELS_STORAGE_KEY,
    true,
  );

let minimapEnabled =
  readStoredBoolean(
    MINIMAP_STORAGE_KEY,
    true,
  );

function ensureStyle() {
  if (
    document.getElementById(
      STYLE_ID,
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style",
    );

  style.id = STYLE_ID;

  style.textContent = `
    .${WRAPPER_CLASS} {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      width: 100%;
      margin-top: 12px;
    }

    .${WRAPPER_CLASS} button {
      min-height: 44px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      background: rgba(15, 23, 42, 0.8);
      color: #e2e8f0;
      font: inherit;
      font-weight: 700;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition:
        transform 120ms ease,
        border-color 120ms ease,
        background 120ms ease;
    }

    .${WRAPPER_CLASS} button:hover {
      transform: translateY(-1px);
      border-color: rgba(125, 211, 252, 0.55);
    }

    .${WRAPPER_CLASS} button[data-enabled="true"] {
      border-color: rgba(56, 189, 248, 0.8);
      background: rgba(14, 116, 144, 0.35);
      color: #f0f9ff;
    }

    .${WRAPPER_CLASS} button[data-enabled="false"] {
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
  `;

  document.head.append(
    style,
  );
}

function getWorld() {
  return (
    globalThis
      .__mistMazeWorld ??
    null
  );
}

function setBooleanField(
  object,
  field,
  value,
) {
  if (
    object &&
    typeof object ===
      "object"
  ) {
    object[field] =
      Boolean(value);
  }
}

function applyLabelsSetting(
  world,
  enabled,
) {
  labelsEnabled =
    Boolean(enabled);

  globalThis
    .__mistMazeLabelsEnabled =
    labelsEnabled;

  if (world) {
    for (
      const field of [
        "labelsOn",
        "showLabels",
        "labelsEnabled",
        "displayLabels",
      ]
    ) {
      setBooleanField(
        world,
        field,
        labelsEnabled,
      );
    }

    if (
      world.settings &&
      typeof world.settings ===
        "object"
    ) {
      for (
        const field of [
          "labelsOn",
          "showLabels",
          "labelsEnabled",
          "displayLabels",
        ]
      ) {
        setBooleanField(
          world.settings,
          field,
          labelsEnabled,
        );
      }
    }
  }

  document
    .documentElement
    .classList
    .toggle(
      "mist-labels-disabled",
      !labelsEnabled,
    );

  writeStoredBoolean(
    LABELS_STORAGE_KEY,
    labelsEnabled,
  );
}

function applyMinimapSetting(
  world,
  enabled,
) {
  minimapEnabled =
    Boolean(enabled);

  globalThis
    .__mistMazeMinimapEnabled =
    minimapEnabled;

  if (world) {
    setBooleanField(
      world,
      "minimapOn",
      minimapEnabled,
    );

    setBooleanField(
      world,
      "showMinimap",
      minimapEnabled,
    );

    if (
      world.settings &&
      typeof world.settings ===
        "object"
    ) {
      setBooleanField(
        world.settings,
        "minimapOn",
        minimapEnabled,
      );

      setBooleanField(
        world.settings,
        "showMinimap",
        minimapEnabled,
      );
    }
  }

  writeStoredBoolean(
    MINIMAP_STORAGE_KEY,
    minimapEnabled,
  );
}

function textEquals(
  element,
  value,
) {
  return (
    element?.textContent
      ?.trim()
      .toLowerCase() ===
    value.toLowerCase()
  );
}

function findSettingsRoot() {
  const headings =
    document.querySelectorAll(
      "h1, h2, h3, [role='heading']",
    );

  for (
    const heading of
    headings
  ) {
    if (
      !textEquals(
        heading,
        "settings",
      )
    ) {
      continue;
    }

    let current =
      heading.parentElement;

    for (
      let depth = 0;
      current &&
        depth < 7;
      depth += 1
    ) {
      const text =
        current.textContent ??
        "";

      if (
        text.includes(
          "AUDIO",
        ) &&
        text.includes(
          "VIEW",
        ) &&
        text.includes(
          "CONTROLS",
        )
      ) {
        return current;
      }

      current =
        current.parentElement;
    }
  }

  return null;
}

function findViewCard(
  settingsRoot,
) {
  if (!settingsRoot) {
    return null;
  }

  const candidates =
    settingsRoot.querySelectorAll(
      "section, div",
    );

  for (
    const candidate of
    candidates
  ) {
    const children =
      Array.from(
        candidate.children,
      );

    const hasViewHeading =
      children.some(
        (child) =>
          textEquals(
            child,
            "view",
          ) ||
          child
            .querySelector?.(
              "h2, h3, h4, [role='heading']",
            )
            ?.textContent
            ?.trim()
            .toLowerCase() ===
            "view",
      );

    if (!hasViewHeading) {
      continue;
    }

    const buttons =
      Array.from(
        candidate.querySelectorAll(
          "button",
        ),
      );

    const buttonLabels =
      buttons.map(
        (button) =>
          button.textContent
            ?.trim()
            .toLowerCase(),
      );

    if (
      buttonLabels.includes(
        "2d",
      ) &&
      buttonLabels.includes(
        "3d",
      )
    ) {
      return candidate;
    }
  }

  return null;
}

function renderButtonState(
  button,
  label,
  enabled,
) {
  button.dataset.enabled =
    String(
      Boolean(enabled),
    );

  button.textContent =
    `${label}: ${
      enabled
        ? "ON"
        : "OFF"
    }`;
}

function ensureSettingsControls() {
  const settingsRoot =
    findSettingsRoot();

  if (!settingsRoot) {
    return;
  }

  const viewCard =
    findViewCard(
      settingsRoot,
    );

  if (!viewCard) {
    return;
  }

  let wrapper =
    viewCard.querySelector(
      `:scope > .${WRAPPER_CLASS}`,
    );

  if (!wrapper) {
    wrapper =
      document.createElement(
        "div",
      );

    wrapper.className =
      WRAPPER_CLASS;

    const labelsButton =
      document.createElement(
        "button",
      );

    labelsButton.type =
      "button";

    labelsButton.dataset
      .setting =
      "labels";

    const minimapButton =
      document.createElement(
        "button",
      );

    minimapButton.type =
      "button";

    minimapButton.dataset
      .setting =
      "minimap";

    labelsButton
      .addEventListener(
        "click",
        () => {
          applyLabelsSetting(
            getWorld(),
            !labelsEnabled,
          );

          renderButtonState(
            labelsButton,
            "LABELS",
            labelsEnabled,
          );
        },
      );

    minimapButton
      .addEventListener(
        "click",
        () => {
          applyMinimapSetting(
            getWorld(),
            !minimapEnabled,
          );

          renderButtonState(
            minimapButton,
            "MINIMAP",
            minimapEnabled,
          );
        },
      );

    wrapper.append(
      labelsButton,
      minimapButton,
    );

    viewCard.append(
      wrapper,
    );
  }

  const labelsButton =
    wrapper.querySelector(
      '[data-setting="labels"]',
    );

  const minimapButton =
    wrapper.querySelector(
      '[data-setting="minimap"]',
    );

  if (labelsButton) {
    renderButtonState(
      labelsButton,
      "LABELS",
      labelsEnabled,
    );
  }

  if (minimapButton) {
    renderButtonState(
      minimapButton,
      "MINIMAP",
      minimapEnabled,
    );
  }
}

function synchronizeWorld() {
  const world =
    getWorld();

  if (!world) {
    return;
  }

  applyLabelsSetting(
    world,
    labelsEnabled,
  );

  applyMinimapSetting(
    world,
    minimapEnabled,
  );
}

export function areLabelsEnabled() {
  return labelsEnabled;
}

export function isMinimapEnabled() {
  return minimapEnabled;
}

export function installSettingsToggleEnhancement() {
  if (
    typeof document ===
      "undefined" ||
    globalThis[
      INSTALLED_KEY
    ]
  ) {
    return () => {};
  }

  globalThis[
    INSTALLED_KEY
  ] = true;

  ensureStyle();

  applyLabelsSetting(
    getWorld(),
    labelsEnabled,
  );

  applyMinimapSetting(
    getWorld(),
    minimapEnabled,
  );

  let frameId = 0;

  const schedule =
    () => {
      if (frameId) {
        return;
      }

      frameId =
        window
          .requestAnimationFrame(
            () => {
              frameId = 0;
              ensureSettingsControls();
            },
          );
    };

  const observer =
    new MutationObserver(
      schedule,
    );

  observer.observe(
    document.getElementById(
      "root",
    ) ??
      document.body,
    {
      childList: true,
      subtree: true,
    },
  );

  const intervalId =
    window.setInterval(
      synchronizeWorld,
      250,
    );

  schedule();

  return () => {
    observer.disconnect();

    if (frameId) {
      window
        .cancelAnimationFrame(
          frameId,
        );
    }

    window.clearInterval(
      intervalId,
    );

    document
      .getElementById(
        STYLE_ID,
      )
      ?.remove();

    document
      .documentElement
      .classList
      .remove(
        "mist-labels-disabled",
      );

    globalThis[
      INSTALLED_KEY
    ] = false;
  };
}
