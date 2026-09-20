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

const ROOT_MINIMAP_ATTRIBUTE =
  "data-mist-minimap-enabled";

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
    // Storage can be unavailable in restricted browser modes.
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
    // Keep the in-memory value when storage is unavailable.
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

    html[${ROOT_MINIMAP_ATTRIBUTE}="false"]
      [data-mist-minimap-shell="1"] {
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
  persist = true,
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

  if (persist) {
    writeStoredBoolean(
      LABELS_STORAGE_KEY,
      labelsEnabled,
    );
  }
}

function applyMinimapSetting(
  world,
  enabled,
  persist = true,
) {
  minimapEnabled =
    Boolean(enabled);

  globalThis
    .__mistMazeMinimapEnabled =
    minimapEnabled;

  document
    .documentElement
    .setAttribute(
      ROOT_MINIMAP_ATTRIBUTE,
      String(
        minimapEnabled,
      ),
    );

  if (world) {
    for (
      const field of [
        "minimapOn",
        "showMinimap",
        "minimapEnabled",
      ]
    ) {
      setBooleanField(
        world,
        field,
        minimapEnabled,
      );
    }

    if (
      world.settings &&
      typeof world.settings ===
        "object"
    ) {
      for (
        const field of [
          "minimapOn",
          "showMinimap",
          "minimapEnabled",
        ]
      ) {
        setBooleanField(
          world.settings,
          field,
          minimapEnabled,
        );
      }
    }
  }

  if (persist) {
    writeStoredBoolean(
      MINIMAP_STORAGE_KEY,
      minimapEnabled,
    );
  }
}

function normalizedText(
  element,
) {
  return (
    element?.textContent
      ?.trim()
      .toLowerCase() ??
    ""
  );
}

function findSettingsRoot() {
  for (
    const heading of
    document.querySelectorAll(
      "h1, h2, h3, [role='heading']",
    )
  ) {
    if (
      normalizedText(
        heading,
      ) !== "settings"
    ) {
      continue;
    }

    let current =
      heading.parentElement;

    for (
      let depth = 0;
      current &&
      depth < 8;
      depth += 1
    ) {
      const text =
        (
          current.textContent ??
          ""
        ).toUpperCase();

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

  const viewHeadings =
    Array.from(
      settingsRoot
        .querySelectorAll(
          "h1, h2, h3, h4, strong, span, div",
        ),
    )
      .filter(
        (element) =>
          normalizedText(
            element,
          ) === "view",
      );

  for (
    const heading of
    viewHeadings
  ) {
    let current =
      heading.parentElement;

    for (
      let depth = 0;
      current &&
      depth < 5;
      depth += 1
    ) {
      const buttonLabels =
        Array.from(
          current
            .querySelectorAll(
              "button",
            ),
        )
          .map(
            (button) =>
              normalizedText(
                button,
              ),
          );

      if (
        buttonLabels.includes(
          "2d",
        ) &&
        buttonLabels.includes(
          "3d",
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

function renderButtonState(
  button,
  label,
  enabled,
) {
  button.dataset.enabled =
    String(
      Boolean(enabled),
    );

  button.setAttribute(
    "aria-pressed",
    String(
      Boolean(enabled),
    ),
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

    labelsButton.dataset.setting =
      "labels";

    labelsButton.addEventListener(
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

    const minimapButton =
      document.createElement(
        "button",
      );

    minimapButton.type =
      "button";

    minimapButton.dataset.setting =
      "minimap";

    minimapButton.addEventListener(
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

let lastWorld = null;

function synchronizeWorld() {
  const world =
    getWorld();

  if (!world) {
    lastWorld = null;
    return;
  }

  if (
    world !== lastWorld
  ) {
    lastWorld = world;

    applyLabelsSetting(
      world,
      labelsEnabled,
      false,
    );

    applyMinimapSetting(
      world,
      minimapEnabled,
      false,
    );
  }
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
    false,
  );

  applyMinimapSetting(
    getWorld(),
    minimapEnabled,
    false,
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

    document
      .documentElement
      .removeAttribute(
        ROOT_MINIMAP_ATTRIBUTE,
      );

    globalThis[
      INSTALLED_KEY
    ] = false;
  };
}
