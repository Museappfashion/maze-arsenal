// src/features/gameplayUxEnhancement.js

import {
  FLOOR,
  STEEL_WALL,
  WALL,
} from "../config/constants.js";
import {
  POWER_UPS,
} from "../config/powerUps.js";

const INSTALLED_KEY =
  "__mistMazeGameplayUxInstalled";

const STYLE_ID =
  "mist-maze-gameplay-ux-styles";

const MINIMAP_ID =
  "mist-maze-3d-minimap";

const POINTER_ID =
  "mist-maze-exit-pointer";

const SETTINGS_CLASS =
  "mist-display-settings";

const PREFS_KEY =
  "mist-maze-display-preferences-v1";

const UPDATE_MS = 75;

const DEFAULT_PREFS =
  Object.freeze({
    minimapOn: true,
    labelsOn: true,
    exitPointerOn: true,
  });

let exposedWorld =
  globalThis.__mistMazeWorld ??
  null;

let lastMinimapKey =
  "";

function normalizeAngle(angle) {
  let value = angle;

  while (value > Math.PI) {
    value -= Math.PI * 2;
  }

  while (value < -Math.PI) {
    value += Math.PI * 2;
  }

  return value;
}

function loadPrefs() {
  if (
    typeof window ===
    "undefined"
  ) {
    return {
      ...DEFAULT_PREFS,
    };
  }

  try {
    const raw =
      window.localStorage.getItem(
        PREFS_KEY,
      );

    if (!raw) {
      return {
        ...DEFAULT_PREFS,
      };
    }

    const parsed =
      JSON.parse(raw);

    return {
      minimapOn:
        parsed.minimapOn !==
        false,
      labelsOn:
        parsed.labelsOn !==
        false,
      exitPointerOn:
        parsed.exitPointerOn !==
        false,
    };
  } catch {
    return {
      ...DEFAULT_PREFS,
    };
  }
}

function savePrefs(
  prefs,
) {
  try {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify(
        prefs,
      ),
    );
  } catch {
    // Display preferences still work for the current session.
  }
}

function removeLevelZeroDemolition(
  world,
) {
  if (
    world?.levelKey !==
    "level0" ||
    !Array.isArray(
      world.pickups,
    )
  ) {
    return;
  }

  const shield =
    POWER_UPS.shield;

  for (
    const pickup of
    world.pickups
  ) {
    if (
      pickup?.type !==
        "powerup" ||
      pickup.powerUp !==
        "demolition"
    ) {
      continue;
    }

    pickup.powerUp =
      "shield";

    pickup.label =
      shield.label;

    pickup.color =
      shield.color;
  }
}

function normalizeControls(
  world,
) {
  if (
    !Array.isArray(
      world?.controls,
    )
  ) {
    return;
  }

  const filtered =
    world.controls.filter(
      (control) => {
        const text =
          String(control);

        return (
          !/^Toggle labels:/i.test(
            text,
          ) &&
          !/^Minimap:/i.test(
            text,
          )
        );
      },
    );

  if (
    !filtered.some(
      (control) =>
        String(
          control,
        ).includes(
          "Display options:",
        ),
    )
  ) {
    filtered.push(
      "Display options: use Settings for minimap, labels, and exit pointer",
    );
  }

  world.controls =
    filtered;
}

function prepareWorld(
  world,
) {
  if (
    !world ||
    typeof world !==
      "object"
  ) {
    return world;
  }

  const prefs =
    loadPrefs();

  world.minimapOn =
    prefs.minimapOn;

  if (
    !world.labyrinthMode
  ) {
    world.labelsOn =
      prefs.labelsOn;
  }

  world.exitPointerOn =
    prefs.exitPointerOn;

  removeLevelZeroDemolition(
    world,
  );

  normalizeControls(
    world,
  );

  return world;
}

function installWorldInterceptor() {
  const descriptor =
    Object.getOwnPropertyDescriptor(
      globalThis,
      "__mistMazeWorld",
    );

  if (
    descriptor &&
    descriptor.configurable ===
      false
  ) {
    return;
  }

  const originalGetter =
    descriptor?.get;

  const originalSetter =
    descriptor?.set;

  if (
    descriptor &&
    "value" in descriptor
  ) {
    exposedWorld =
      descriptor.value;
  } else if (
    originalGetter
  ) {
    try {
      exposedWorld =
        originalGetter.call(
          globalThis,
        );
    } catch {
      exposedWorld =
        null;
    }
  }

  Object.defineProperty(
    globalThis,
    "__mistMazeWorld",
    {
      configurable: true,
      enumerable: true,

      get() {
        if (
          originalGetter
        ) {
          try {
            return (
              originalGetter.call(
                globalThis,
              ) ??
              exposedWorld
            );
          } catch {
            return exposedWorld;
          }
        }

        return exposedWorld;
      },

      set(world) {
        exposedWorld =
          prepareWorld(
            world,
          );

        if (
          originalSetter
        ) {
          try {
            originalSetter.call(
              globalThis,
              exposedWorld,
            );
          } catch {
            // The enhanced world remains available through this interceptor.
          }
        }
      },
    },
  );

  if (exposedWorld) {
    exposedWorld =
      prepareWorld(
        exposedWorld,
      );
  }
}

function getWorld() {
  return (
    globalThis
      .__mistMazeWorld ??
    null
  );
}

function ensureStyles() {
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

  style.id =
    STYLE_ID;

  style.textContent = `
    .${SETTINGS_CLASS} {
      display: grid;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(148,163,184,.14);
    }

    .mist-display-settings-title {
      color: #94a3b8;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .mist-display-settings-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 7px;
    }

    .mist-display-toggle {
      min-height: 38px;
      padding: 7px 9px;
      border: 1px solid rgba(148,163,184,.2);
      border-radius: 10px;
      background: rgba(15,23,42,.78);
      color: #cbd5e1;
      font: inherit;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .04em;
      cursor: pointer;
    }

    .mist-display-toggle[aria-pressed="true"] {
      border-color: rgba(56,189,248,.52);
      background: rgba(8,47,73,.72);
      color: #e0f2fe;
    }

    .mist-display-toggle:disabled {
      opacity: .42;
      cursor: default;
    }

    #${MINIMAP_ID} {
      position: absolute;
      left: 14px;
      top: 14px;
      z-index: 56;
      width: 158px;
      padding: 8px;
      border: 1px solid rgba(148,163,184,.2);
      border-radius: 14px;
      background: rgba(2,6,23,.78);
      box-shadow:
        0 12px 30px rgba(0,0,0,.28),
        inset 0 1px 0 rgba(255,255,255,.035);
      backdrop-filter: blur(9px);
      -webkit-backdrop-filter: blur(9px);
      pointer-events: none;
    }

    #${MINIMAP_ID} canvas {
      width: 142px;
      height: 142px;
      display: block;
      border-radius: 8px;
      image-rendering: pixelated;
    }

    .mist-3d-minimap-key {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-top: 5px;
      color: #94a3b8;
      font-size: 8px;
      font-weight: 800;
    }

    #${POINTER_ID} {
      position: absolute;
      left: 50%;
      top: 16px;
      z-index: 58;
      transform: translateX(-50%);
      display: grid;
      justify-items: center;
      gap: 1px;
      min-width: 48px;
      padding: 6px 10px;
      border: 1px solid rgba(34,197,94,.3);
      border-radius: 12px;
      background: rgba(2,6,23,.72);
      color: #86efac;
      box-shadow: 0 10px 26px rgba(0,0,0,.24);
      pointer-events: none;
    }

    .mist-exit-arrow {
      font-size: 23px;
      line-height: 1;
      font-weight: 950;
    }

    .mist-exit-word {
      color: #86efac;
      font-size: 7px;
      font-weight: 950;
      letter-spacing: .14em;
    }

    #mist-maze-runtime-enhancements
      [data-mist-action="restart"],
    #mist-maze-runtime-enhancements
      [data-mist-action="next-level"] {
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }

    @media (max-width: 700px) {
      .mist-display-settings-grid {
        grid-template-columns: 1fr;
      }

      #${MINIMAP_ID} {
        left: 9px;
        top: 9px;
        width: 128px;
        padding: 6px;
      }

      #${MINIMAP_ID} canvas {
        width: 116px;
        height: 116px;
      }

      #${POINTER_ID} {
        top: 10px;
      }
    }
  `;

  document.head.append(
    style,
  );
}

function stopLegacyDisplayKeys(
  event,
) {
  if (!getWorld()) {
    return;
  }

  const key =
    event.key?.toLowerCase();

  if (
    key !== "m" &&
    key !== "l"
  ) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
}

function updatePreference(
  key,
  value,
) {
  const prefs =
    loadPrefs();

  prefs[key] =
    Boolean(value);

  savePrefs(
    prefs,
  );

  const world =
    getWorld();

  if (!world) {
    return;
  }

  if (
    key ===
    "minimapOn"
  ) {
    world.minimapOn =
      prefs.minimapOn;
  } else if (
    key ===
    "labelsOn" &&
    !world.labyrinthMode
  ) {
    world.labelsOn =
      prefs.labelsOn;
  } else if (
    key ===
    "exitPointerOn"
  ) {
    world.exitPointerOn =
      prefs.exitPointerOn;
  }
}

function createToggle(
  setting,
  label,
) {
  const button =
    document.createElement(
      "button",
    );

  button.type =
    "button";

  button.className =
    "mist-display-toggle";

  button.dataset
    .mistDisplaySetting =
    setting;

  button.dataset
    .mistDisplayLabel =
    label;

  button.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      const world =
        getWorld();

      if (!world) {
        return;
      }

      const current =
        setting ===
          "labelsOn"
          ? world.labelsOn
          : setting ===
              "minimapOn"
            ? world.minimapOn
            : world
                .exitPointerOn;

      updatePreference(
        setting,
        !current,
      );

      updateSettingsBlocks();
    },
  );

  return button;
}

function ensureSettingsBlocks() {
  if (
    !document.querySelector(
      ".maze-game-root",
    )
  ) {
    return;
  }

  for (
    const container of
    document.querySelectorAll(
      ".settings-controls",
    )
  ) {
    if (
      container.querySelector(
        `.${SETTINGS_CLASS}`,
      )
    ) {
      continue;
    }

    const block =
      document.createElement(
        "section",
      );

    block.className =
      SETTINGS_CLASS;

    const title =
      document.createElement(
        "div",
      );

    title.className =
      "mist-display-settings-title";

    title.textContent =
      "DISPLAY";

    const grid =
      document.createElement(
        "div",
      );

    grid.className =
      "mist-display-settings-grid";

    grid.append(
      createToggle(
        "minimapOn",
        "MINIMAP",
      ),
      createToggle(
        "labelsOn",
        "LABELS",
      ),
      createToggle(
        "exitPointerOn",
        "EXIT POINTER",
      ),
    );

    block.append(
      title,
      grid,
    );

    container.append(
      block,
    );
  }
}

function updateSettingsBlocks() {
  const world =
    getWorld();

  if (!world) {
    return;
  }

  for (
    const button of
    document.querySelectorAll(
      "[data-mist-display-setting]",
    )
  ) {
    const setting =
      button.dataset
        .mistDisplaySetting;

    const label =
      button.dataset
        .mistDisplayLabel ??
      "OPTION";

    let enabled =
      false;

    if (
      setting ===
      "minimapOn"
    ) {
      enabled =
        Boolean(
          world.minimapOn,
        );
    } else if (
      setting ===
      "labelsOn"
    ) {
      enabled =
        Boolean(
          world.labelsOn,
        );

      button.disabled =
        Boolean(
          world.labyrinthMode,
        );
    } else if (
      setting ===
      "exitPointerOn"
    ) {
      enabled =
        Boolean(
          world
            .exitPointerOn,
        );
    }

    button.setAttribute(
      "aria-pressed",
      String(enabled),
    );

    button.textContent =
      `${label} ${
        enabled
          ? "ON"
          : "OFF"
      }`;
  }
}

function ensureThreeDMinimap() {
  const world =
    getWorld();

  const frame =
    document.querySelector(
      ".maze-frame",
    );

  const shouldShow =
    Boolean(
      frame &&
      world &&
      world.viewMode ===
        "3d" &&
      !world.labyrinthMode &&
      world.minimapOn,
    );

  let panel =
    document.getElementById(
      MINIMAP_ID,
    );

  if (!shouldShow) {
    panel?.remove();
    lastMinimapKey =
      "";
    return;
  }

  if (!panel) {
    panel =
      document.createElement(
        "aside",
      );

    panel.id =
      MINIMAP_ID;

    panel.setAttribute(
      "aria-label",
      "3D minimap",
    );

    panel.innerHTML = `
      <canvas
        width="142"
        height="142"
        aria-hidden="true"
      ></canvas>
      <div class="mist-3d-minimap-key">
        <span>YOU</span>
        <span>EXIT</span>
      </div>
    `;

    frame.append(
      panel,
    );
  }

  drawThreeDMinimap(
    panel,
    world,
  );
}

function minimapDrawKey(
  world,
) {
  return [
    world.levelKey,
    world.width,
    world.height,
    Math.floor(
      world.player.x,
    ),
    Math.floor(
      world.player.y,
    ),
    world.player
      .discoveredFloor,
    world.minimapDirty
      ? 1
      : 0,
  ].join(":");
}

function drawThreeDMinimap(
  panel,
  world,
) {
  const key =
    minimapDrawKey(
      world,
    );

  if (
    key ===
    lastMinimapKey
  ) {
    return;
  }

  lastMinimapKey =
    key;

  const canvas =
    panel.querySelector(
      "canvas",
    );

  const ctx =
    canvas?.getContext(
      "2d",
    );

  if (!ctx) {
    return;
  }

  const size =
    canvas.width;

  const scale =
    Math.min(
      size /
        Math.max(
          1,
          world.width,
        ),
      size /
        Math.max(
          1,
          world.height,
        ),
    );

  const mapWidth =
    world.width *
    scale;

  const mapHeight =
    world.height *
    scale;

  const offsetX =
    (size -
      mapWidth) /
    2;

  const offsetY =
    (size -
      mapHeight) /
    2;

  ctx.clearRect(
    0,
    0,
    size,
    size,
  );

  ctx.fillStyle =
    "#020617";

  ctx.fillRect(
    0,
    0,
    size,
    size,
  );

  for (
    let y = 0;
    y < world.height;
    y += 1
  ) {
    for (
      let x = 0;
      x < world.width;
      x += 1
    ) {
      const index =
        y *
          world.width +
        x;

      if (
        world.discovered?.[
          index
        ] !== 1
      ) {
        continue;
      }

      const tile =
        world.grid?.[
          y
        ]?.[
          x
        ];

      if (
        tile ===
        STEEL_WALL
      ) {
        ctx.fillStyle =
          "#94a3b8";
      } else if (
        tile ===
        WALL
      ) {
        ctx.fillStyle =
          "#334155";
      } else if (
        tile ===
        FLOOR
      ) {
        ctx.fillStyle =
          "#111827";
      } else {
        continue;
      }

      ctx.fillRect(
        offsetX +
          x *
            scale,
        offsetY +
          y *
            scale,
        Math.max(
          1,
          scale,
        ),
        Math.max(
          1,
          scale,
        ),
      );
    }
  }

  if (world.exit) {
    ctx.fillStyle =
      "#22c55e";

    ctx.fillRect(
      offsetX +
        world.exit.x *
          scale,
      offsetY +
        world.exit.y *
          scale,
      Math.max(
        3,
        scale +
          1,
      ),
      Math.max(
        3,
        scale +
          1,
      ),
    );
  }

  ctx.fillStyle =
    "#38bdf8";

  ctx.beginPath();

  ctx.arc(
    offsetX +
      world.player.x *
        scale,
    offsetY +
      world.player.y *
        scale,
    Math.max(
      2.5,
      scale +
        0.5,
    ),
    0,
    Math.PI * 2,
  );

  ctx.fill();
}

function getExitArrow(
  world,
) {
  const dx =
    (
      world.exit.x +
      0.5
    ) -
    world.player.x;

  const dy =
    (
      world.exit.y +
      0.5
    ) -
    world.player.y;

  if (
    world.viewMode ===
    "3d"
  ) {
    const targetAngle =
      Math.atan2(
        dy,
        dx,
      );

    const relative =
      normalizeAngle(
        targetAngle -
        (
          world.player
            .facing ??
          0
        ),
      );

    if (
      Math.abs(
        relative,
      ) <=
      Math.PI /
        4
    ) {
      return "↑";
    }

    if (
      Math.abs(
        relative,
      ) >=
      (
        Math.PI *
        3
      ) /
        4
    ) {
      return "↓";
    }

    return (
      relative > 0
        ? "→"
        : "←"
    );
  }

  if (
    Math.abs(dx) >
    Math.abs(dy)
  ) {
    return (
      dx > 0
        ? "→"
        : "←"
    );
  }

  return (
    dy > 0
      ? "↓"
      : "↑"
  );
}

function ensureExitPointer() {
  const world =
    getWorld();

  const frame =
    document.querySelector(
      ".maze-frame",
    );

  const shouldShow =
    Boolean(
      frame &&
      world &&
      world.exit &&
      world.exitPointerOn &&
      !world.victory &&
      !world.gameOver,
    );

  let pointer =
    document.getElementById(
      POINTER_ID,
    );

  if (!shouldShow) {
    pointer?.remove();
    return;
  }

  if (!pointer) {
    pointer =
      document.createElement(
        "div",
      );

    pointer.id =
      POINTER_ID;

    pointer.setAttribute(
      "aria-label",
      "Direction to exit",
    );

    pointer.innerHTML = `
      <span class="mist-exit-arrow">↑</span>
      <span class="mist-exit-word">EXIT</span>
    `;

    frame.append(
      pointer,
    );
  }

  const arrow =
    pointer.querySelector(
      ".mist-exit-arrow",
    );

  if (arrow) {
    arrow.textContent =
      getExitArrow(
        world,
      );
  }
}

function enforceEndButtons() {
  const world =
    getWorld();

  if (
    !world ||
    (
      !world.gameOver &&
      !world.victory
    )
  ) {
    return;
  }

  const restart =
    document.querySelector(
      '#mist-maze-runtime-enhancements [data-mist-action="restart"]',
    );

  if (
    restart instanceof
      HTMLButtonElement
  ) {
    restart.textContent =
      "PLAY NEW GAME";
  }

  const next =
    document.querySelector(
      '#mist-maze-runtime-enhancements [data-mist-action="next-level"]',
    );

  if (
    next instanceof
      HTMLButtonElement
  ) {
    next.textContent =
      "PLAY NEXT GAME";
  }
}

function refresh() {
  const world =
    getWorld();

  if (
    world &&
    !world.__mistUxPrepared
  ) {
    prepareWorld(
      world,
    );

    world.__mistUxPrepared =
      true;
  }

  ensureSettingsBlocks();
  updateSettingsBlocks();
  ensureThreeDMinimap();
  ensureExitPointer();
  enforceEndButtons();
}

export function installGameplayUxEnhancement() {
  if (
    typeof window ===
      "undefined" ||
    typeof document ===
      "undefined" ||
    globalThis[
      INSTALLED_KEY
    ]
  ) {
    return;
  }

  globalThis[
    INSTALLED_KEY
  ] = true;

  ensureStyles();
  installWorldInterceptor();

  window.addEventListener(
    "keydown",
    stopLegacyDisplayKeys,
    true,
  );

  window.setInterval(
    refresh,
    UPDATE_MS,
  );

  refresh();
}
