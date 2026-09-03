// src/features/runtimeEnhancements.js
import {
  LABYRINTH_LIGHT_ORDER,
  LABYRINTH_LIGHTS,
} from "../config/labyrinthLights.js";
import {
  getActivePowerUps,
  getStoredPowerUps,
} from "../game/gameplay.js";
import {
  getLabyrinthTimeRemaining,
} from "../game/labyrinth.js";

const ROOT_ID = "mist-maze-runtime-enhancements";
const THROTTLE_DELAY_MS = 120;
const OVERLAY_UPDATE_MS = 25;

function getWorld() {
  return globalThis.__mistMazeWorld ?? null;
}

function getGameCanvas() {
  return document.querySelector(".maze-frame > canvas");
}

function getRoot() {
  return document.getElementById(ROOT_ID);
}

function findButton(labels) {
  const normalized = labels.map((label) => label.toUpperCase());

  return [...document.querySelectorAll("button")].find((button) => {
    const text = button.textContent?.trim().toUpperCase() ?? "";
    return normalized.some((label) => text.includes(label));
  });
}

function openThreeDSettings() {
  const gear = document.querySelector(".three-d-gear-only");

  if (gear && gear.getAttribute("aria-expanded") !== "true") {
    gear.click();
  }
}

function clickButton(labels) {
  const button = findButton(labels);

  if (!button) {
    return false;
  }

  button.click();
  return true;
}

function triggerRestart() {
  document.exitPointerLock?.();

  if (clickButton(["START NEW MAZE"])) {
    return;
  }

  openThreeDSettings();

  window.setTimeout(() => {
    clickButton(["START NEW MAZE"]);
  }, 0);
}

function triggerMainMenu() {
  document.exitPointerLock?.();

  if (clickButton(["LEVEL MENU", "CHOOSE ANOTHER LEVEL"])) {
    const root = getRoot();

    if (root) {
      root.style.display = "none";
    }
    return;
  }

  openThreeDSettings();

  window.setTimeout(() => {
    if (clickButton(["LEVEL MENU", "CHOOSE ANOTHER LEVEL"])) {
      const root = getRoot();

      if (root) {
        root.style.display = "none";
      }
    }
  }, 0);
}

function ensureRoot() {
  let root = getRoot();

  if (root) {
    return root;
  }

  root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.position = "fixed";
  root.style.zIndex = "9990";
  root.style.pointerEvents = "none";
  root.style.fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  document.body.append(root);

  return root;
}

function formatTimerSecond(seconds) {
  const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const remainingSeconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function getDisplayedTimerSecond(world) {
  return Math.max(
    0,
    Math.ceil(getLabyrinthTimeRemaining(world)),
  );
}

function createTimer(world, displayedSecond) {
  if (
    !world.labyrinthMode ||
    world.gameOver ||
    world.victory
  ) {
    return "";
  }

  return `
    <div
      aria-label="Time remaining ${formatTimerSecond(displayedSecond)}"
      style="
        position:absolute;
        top:16px;
        right:18px;
        color:#ff3434;
        font-family:SFMono-Regular,Consolas,Liberation Mono,monospace;
        font-size:28px;
        font-weight:300;
        font-variant-numeric:tabular-nums;
        line-height:1;
        letter-spacing:.035em;
        opacity:.96;
        white-space:nowrap;
        pointer-events:none;
        user-select:none;
      "
    >${formatTimerSecond(displayedSecond)}</div>
  `;
}

function normalPowerUpHtml(world) {
  const stored = getStoredPowerUps(world);
  const active = getActivePowerUps(world);

  const slots = [0, 1]
    .map((index) => {
      const powerUp = stored[index];
      const hotkey = index === 0 ? "Z" : "X";
      const color = powerUp?.color ?? "#475569";

      return `
        <div
          style="
            min-width:0;
            padding:7px 8px;
            border-radius:8px;
            border:1px solid ${
              powerUp
                ? `${color}77`
                : "rgba(148,163,184,.14)"
            };
            background:${
              powerUp
                ? `${color}18`
                : "rgba(15,23,42,.55)"
            };
          "
        >
          <strong
            style="
              color:${powerUp?.color ?? "#64748b"};
              font-size:9px;
            "
          >${hotkey}</strong>
          <div
            style="
              margin-top:2px;
              overflow:hidden;
              color:${powerUp ? "#f8fafc" : "#64748b"};
              font-size:9px;
              font-weight:800;
              text-overflow:ellipsis;
              white-space:nowrap;
            "
          >${powerUp?.label ?? "Empty"}</div>
        </div>
      `;
    })
    .join("");

  const activeRows = active.length
    ? active
        .map(
          (powerUp) => `
            <div
              style="
                display:grid;
                grid-template-columns:7px minmax(0,1fr) auto;
                align-items:center;
                gap:6px;
                color:#cbd5e1;
                font-size:8px;
              "
            >
              <span
                style="
                  width:7px;
                  height:7px;
                  border-radius:999px;
                  background:${powerUp.color};
                  box-shadow:0 0 7px ${powerUp.color};
                "
              ></span>
              <span>${powerUp.label}</span>
              <strong>${powerUp.remaining.toFixed(1)}s</strong>
            </div>
          `,
        )
        .join("")
    : '<span style="color:#64748b;font-size:8px">No active power-up</span>';

  return `
    <div
      style="
        display:flex;
        justify-content:space-between;
        color:#ddd6fe;
        font-size:9px;
        font-weight:950;
        letter-spacing:.12em;
      "
    >
      <span>POWER-UPS</span>
      <span>Z / X</span>
    </div>
    <div
      style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:6px;
        margin-top:7px;
      "
    >${slots}</div>
    <div
      style="
        display:grid;
        gap:4px;
        margin-top:7px;
      "
    >${activeRows}</div>
  `;
}

function labyrinthPowerUpHtml(world) {
  const owned = world.labyrinth?.ownedLights ?? {};
  const equipped = world.labyrinth?.equippedLight;

  const lights = LABYRINTH_LIGHT_ORDER
    .map((key) => {
      const light = LABYRINTH_LIGHTS[key];
      const hasLight = Boolean(owned[key]);
      const selected = equipped === key;

      return `
        <div
          title="${light.label}"
          style="
            height:20px;
            display:grid;
            place-items:center;
            border-radius:6px;
            border:${
              selected
                ? `1px solid ${light.color}`
                : "1px solid rgba(148,163,184,.15)"
            };
            background:${
              hasLight
                ? `${light.color}24`
                : "rgba(15,23,42,.56)"
            };
            opacity:${hasLight ? 1 : 0.27};
            box-shadow:${
              selected
                ? `0 0 11px ${light.color}66`
                : "none"
            };
          "
        >
          <span
            style="
              width:8px;
              height:8px;
              border-radius:999px;
              background:${hasLight ? light.color : "#475569"};
              box-shadow:${
                hasLight
                  ? `0 0 7px ${light.color}`
                  : "none"
              };
            "
          ></span>
        </div>
      `;
    })
    .join("");

  const equippedLabel = equipped
    ? LABYRINTH_LIGHTS[equipped]?.label ?? "Base Light"
    : "Base Light";

  return `
    <div
      style="
        display:flex;
        justify-content:space-between;
        gap:8px;
        color:#ddd6fe;
        font-size:8px;
        font-weight:950;
        letter-spacing:.09em;
      "
    >
      <span>LABYRINTH POWER-UPS</span>
      <span>BREAKERS ${world.labyrinth?.breakerCharges ?? 0}/10</span>
    </div>
    <div
      style="
        display:grid;
        grid-template-columns:repeat(5,1fr);
        gap:5px;
        margin-top:8px;
      "
    >${lights}</div>
    <div
      style="
        margin-top:7px;
        color:#cbd5e1;
        font-size:9px;
        font-weight:800;
      "
    >Equipped: ${equippedLabel}</div>
  `;
}

function createPowerUpHud(world) {
  if (world.viewMode !== "3d") {
    return "";
  }

  return `
    <section
      style="
        position:absolute;
        top:${world.labyrinthMode ? 58 : 70}px;
        right:12px;
        width:${world.labyrinthMode ? 230 : 220}px;
        padding:10px;
        border:1px solid rgba(167,139,250,.3);
        border-radius:12px;
        background:rgba(2,6,23,.84);
        box-shadow:0 12px 32px rgba(0,0,0,.35);
        backdrop-filter:blur(5px);
      "
    >
      ${
        world.labyrinthMode
          ? labyrinthPowerUpHtml(world)
          : normalPowerUpHtml(world)
      }
    </section>
  `;
}

function createEndOverlay(world) {
  if (!world.gameOver && !world.victory) {
    return "";
  }

  const primary = world.gameOver
    ? "START NEW GAME"
    : "TRY AGAIN";

  return `
    <div
      style="
        position:absolute;
        inset:0;
        display:grid;
        place-items:center;
        pointer-events:none;
      "
    >
      <div
        style="
          display:grid;
          justify-items:center;
          gap:14px;
          margin-top:120px;
        "
      >
        <button
          type="button"
          data-mist-action="restart"
          style="
            min-width:270px;
            padding:17px 30px;
            border:2px solid rgba(255,255,255,.92);
            border-radius:16px;
            background:linear-gradient(135deg,#facc15 0%,#67e8f9 48%,#22d3ee 100%);
            color:#04111d;
            font:inherit;
            font-size:18px;
            font-weight:950;
            letter-spacing:.075em;
            cursor:pointer;
            pointer-events:auto;
            box-shadow:0 0 30px rgba(34,211,238,.75),0 0 58px rgba(250,204,21,.34);
          "
        >${primary}</button>

        <button
          type="button"
          data-mist-action="menu"
          style="
            min-width:170px;
            padding:9px 14px;
            border:1px solid rgba(148,163,184,.25);
            border-radius:11px;
            background:rgba(15,23,42,.74);
            color:#94a3b8;
            font:inherit;
            font-size:11px;
            font-weight:800;
            cursor:pointer;
            pointer-events:auto;
          "
        >Back to main menu</button>
      </div>
    </div>
  `;
}

function bindEndOverlayActions(root) {
  root
    .querySelector('[data-mist-action="restart"]')
    ?.addEventListener("click", triggerRestart, { once: true });

  root
    .querySelector('[data-mist-action="menu"]')
    ?.addEventListener("click", triggerMainMenu, { once: true });
}

function positionRoot(root, rect) {
  root.style.display = "block";
  root.style.left = `${rect.left}px`;
  root.style.top = `${rect.top}px`;
  root.style.width = `${rect.width}px`;
  root.style.height = `${rect.height}px`;
}

function resetOverlayForWorld(state, world) {
  state.world = world;
  state.terminalWorld = null;
  state.lastMarkup = "";
  state.lastTimerWorld = world;
  state.lastTimerSecond = world?.labyrinthMode
    ? getDisplayedTimerSecond(world)
    : null;
}

function queueTimerTick(world, displayedSecond, state) {
  if (
    !world.labyrinthMode ||
    world.gameOver ||
    world.victory
  ) {
    state.lastTimerWorld = world;
    state.lastTimerSecond = null;
    return;
  }

  if (state.lastTimerWorld !== world) {
    state.lastTimerWorld = world;
    state.lastTimerSecond = displayedSecond;
    return;
  }

  if (state.lastTimerSecond === null) {
    state.lastTimerSecond = displayedSecond;
    return;
  }

  if (state.lastTimerSecond === displayedSecond) {
    return;
  }

  state.lastTimerSecond = displayedSecond;
  world.audioEvents ??= [];

  if (world.audioEvents.length < 48) {
    world.audioEvents.push({
      type: "labyrinthTick",
      second: displayedSecond,
    });
  }
}

function updateOverlay(root, state) {
  const world = getWorld();
  const canvas = getGameCanvas();

  if (world && state.world !== world) {
    resetOverlayForWorld(state, world);
  }

  if (state.terminalWorld === world && world) {
    if (canvas) {
      const terminalRect = canvas.getBoundingClientRect();

      if (terminalRect.width > 0 && terminalRect.height > 0) {
        positionRoot(root, terminalRect);
      }
    }

    return;
  }

  if (!world || !canvas) {
    root.style.display = "none";
    return;
  }

  const rect = canvas.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    root.style.display = "none";
    return;
  }

  positionRoot(root, rect);

  const displayedSecond = world.labyrinthMode
    ? getDisplayedTimerSecond(world)
    : null;

  queueTimerTick(world, displayedSecond, state);

  const markup = [
    createTimer(world, displayedSecond),
    createPowerUpHud(world),
    createEndOverlay(world),
  ].join("");

  if (markup !== state.lastMarkup) {
    root.innerHTML = markup;
    state.lastMarkup = markup;
    bindEndOverlayActions(root);
  }

  if (world.gameOver || world.victory) {
    state.terminalWorld = world;
  }
}

function installRafThrottle() {
  if (
    typeof window === "undefined" ||
    window.__mistMazeRafThrottleInstalled
  ) {
    return;
  }

  window.__mistMazeRafThrottleInstalled = true;

  const nativeRequest = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  const delayedIds = new Set();

  window.requestAnimationFrame = (callback) => {
    const world = getWorld();

    if (!world?.gameOver && !world?.victory) {
      return nativeRequest(callback);
    }

    const id = window.setTimeout(() => {
      delayedIds.delete(id);
      callback(performance.now());
    }, THROTTLE_DELAY_MS);

    delayedIds.add(id);
    return id;
  };

  window.cancelAnimationFrame = (id) => {
    if (delayedIds.has(id)) {
      delayedIds.delete(id);
      window.clearTimeout(id);
      return;
    }

    nativeCancel(id);
  };
}

export function installRuntimeEnhancements() {
  if (
    typeof document === "undefined" ||
    globalThis.__mistMazeRuntimeInstalled
  ) {
    return;
  }

  globalThis.__mistMazeRuntimeInstalled = true;
  installRafThrottle();

  const root = ensureRoot();
  const state = {
    world: null,
    terminalWorld: null,
    lastMarkup: "",
    lastTimerWorld: null,
    lastTimerSecond: null,
  };

  const update = () => updateOverlay(root, state);

  window.setInterval(update, OVERLAY_UPDATE_MS);
  window.addEventListener("resize", update, { passive: true });
  window.addEventListener("scroll", update, { passive: true });

  update();
}
