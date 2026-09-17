// src/features/mizEconomyEnhancement.js

import {
  MIZ_SOUND_EVENT,
  MIZ_STATE_CHANGED_EVENT,
  addExploredTiles,
  consumeOneTimeItem,
  isCosmeticOwned,
  loadMizState,
} from "../services/mizEconomy.js";

const INSTALLED_KEY =
  "__mistMazeMizEconomyInstalled";
const STYLE_ID =
  "mist-maze-miz-counter-styles";
const HUD_ID =
  "mist-maze-miz-hud";
const VEIL_ID =
  "mist-maze-run-veil";
const CHECK_INTERVAL_MS =
  90;

const COIN_SVG = `
  <svg
    viewBox="0 0 36 36"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <radialGradient
        id="mizCoinFaceHud"
        cx="34%"
        cy="27%"
      >
        <stop
          offset="0%"
          stop-color="#f8fafc"
        />
        <stop
          offset="32%"
          stop-color="#d1d5db"
        />
        <stop
          offset="70%"
          stop-color="#9ca3af"
        />
        <stop
          offset="100%"
          stop-color="#4b5563"
        />
      </radialGradient>
    </defs>

    <circle
      class="miz-svg-rim"
      cx="18"
      cy="18"
      r="16"
      fill="url(#mizCoinFaceHud)"
      stroke="#f3f4f6"
      stroke-width="1.5"
    />

    <circle
      class="miz-svg-smoke"
      cx="18"
      cy="18"
      r="11"
      fill="rgba(109,40,217,0)"
    />

    <circle cx="18" cy="5.8" r="2" fill="#4b5563"/>
    <circle cx="26.6" cy="9.4" r="2" fill="#4b5563"/>
    <circle cx="30.2" cy="18" r="2" fill="#4b5563"/>
    <circle cx="26.6" cy="26.6" r="2" fill="#4b5563"/>
    <circle cx="18" cy="30.2" r="2" fill="#4b5563"/>
    <circle cx="9.4" cy="26.6" r="2" fill="#4b5563"/>
    <circle cx="5.8" cy="18" r="2" fill="#4b5563"/>
    <circle cx="9.4" cy="9.4" r="2" fill="#4b5563"/>

    <circle
      cx="18"
      cy="18"
      r="8.3"
      fill="rgba(31,41,55,.35)"
      stroke="rgba(255,255,255,.3)"
      stroke-width="1"
    />

    <text
      x="18"
      y="22.2"
      text-anchor="middle"
      font-family="Inter,system-ui,sans-serif"
      font-size="12"
      font-weight="900"
      fill="#fff"
    >M</text>
  </svg>
`;

const STYLES = `
  #${HUD_ID} {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 60;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px 7px 7px;
    border: 1px solid rgba(148,163,184,.18);
    border-radius: 14px;
    background: rgba(2,6,23,.74);
    color: #f8fafc;
    box-shadow:
      0 12px 30px rgba(0,0,0,.28),
      inset 0 1px 0 rgba(255,255,255,.04);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    pointer-events: none;
    transform-origin: top right;
  }

  #${HUD_ID}.miz-counter-frame {
    border-color: rgba(168,85,247,.58);
    background:
      linear-gradient(
        135deg,
        rgba(71,85,105,.84),
        rgba(76,29,149,.48)
      );
    box-shadow:
      0 12px 30px rgba(0,0,0,.3),
      0 0 18px rgba(168,85,247,.12),
      inset 0 1px 0 rgba(255,255,255,.06);
  }

  #${HUD_ID}.miz-pop {
    animation: mizCounterPop 340ms ease;
  }

  .miz-hud-coin {
    position: relative;
    width: 31px;
    height: 31px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
  }

  .miz-hud-coin svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  #${HUD_ID}.miz-violet-edge
    .miz-svg-rim {
    stroke: #c084fc;
    stroke-width: 2.4;
  }

  #${HUD_ID}.miz-smoke-face
    .miz-svg-smoke {
    fill: rgba(109,40,217,.22);
  }

  .miz-hud-number {
    min-width: 1ch;
    color: #f8fafc;
    font-size: 19px;
    line-height: 1;
    font-weight: 950;
    letter-spacing: -.04em;
  }

  .miz-orbit {
    position: absolute;
    inset: -3px;
    display: none;
    border-radius: 50%;
    animation:
      mizOrbit 3.4s linear infinite;
  }

  #${HUD_ID}.miz-orbiting-specks
    .miz-orbit {
    display: block;
  }

  .miz-orbit::before,
  .miz-orbit::after {
    content: "";
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }

  .miz-orbit::before {
    left: 50%;
    top: -1px;
    background: #c084fc;
  }

  .miz-orbit::after {
    right: -1px;
    bottom: 4px;
    background: #94a3b8;
  }

  #${VEIL_ID} {
    position: absolute;
    inset: 0;
    z-index: 52;
    pointer-events: none;
    background:
      radial-gradient(
        circle at 50% 50%,
        transparent 54%,
        rgba(71,85,105,.055) 72%,
        rgba(109,40,217,.11) 100%
      );
    box-shadow:
      inset 0 0 80px rgba(109,40,217,.08);
  }

  @keyframes mizCounterPop {
    0% {
      transform: scale(1);
    }

    38% {
      transform:
        scale(1.12)
        rotate(-1deg);
    }

    100% {
      transform: scale(1);
    }
  }

  @keyframes mizOrbit {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 560px) {
    #${HUD_ID} {
      top: 9px;
      right: 9px;
      padding: 6px 8px 6px 6px;
    }

    .miz-hud-coin {
      width: 27px;
      height: 27px;
    }

    .miz-hud-number {
      font-size: 17px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    #${HUD_ID}.miz-pop,
    .miz-orbit {
      animation: none !important;
    }
  }
`;

let activeWorld = null;
let lastDiscoveredFloor =
  0;
let audioContext = null;

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

  style.textContent =
    STYLES;

  document.head.append(
    style,
  );
}

function getAudioContext() {
  if (audioContext) {
    return audioContext;
  }

  const AudioContextClass =
    window.AudioContext ??
    window.webkitAudioContext;

  if (
    !AudioContextClass
  ) {
    return null;
  }

  audioContext =
    new AudioContextClass();

  return audioContext;
}

async function unlockAudio() {
  const context =
    getAudioContext();

  if (
    context?.state ===
    "suspended"
  ) {
    try {
      await context.resume();
    } catch {
      return;
    }
  }
}

function playTone(
  frequency,
  startOffset,
  duration,
  gain,
  type = "sine",
) {
  const context =
    getAudioContext();

  if (
    !context ||
    context.state !==
      "running"
  ) {
    return;
  }

  const oscillator =
    context.createOscillator();

  const volume =
    context.createGain();

  const start =
    context.currentTime +
    startOffset;

  const end =
    start +
    duration;

  oscillator.type =
    type;

  oscillator.frequency.value =
    frequency;

  volume.gain.setValueAtTime(
    0.0001,
    start,
  );

  volume.gain.exponentialRampToValueAtTime(
    gain,
    start + 0.012,
  );

  volume.gain.exponentialRampToValueAtTime(
    0.0001,
    end,
  );

  oscillator.connect(
    volume,
  );

  volume.connect(
    context.destination,
  );

  oscillator.start(
    start,
  );

  oscillator.stop(
    end + 0.02,
  );
}

function playCoinSound(
  enhanced = false,
) {
  void unlockAudio().then(
    () => {
      playTone(
        660,
        0,
        0.085,
        0.05,
        "triangle",
      );

      playTone(
        880,
        0.065,
        0.11,
        0.045,
      );

      if (enhanced) {
        playTone(
          1174.66,
          0.13,
          0.16,
          0.04,
        );

        playTone(
          1567.98,
          0.2,
          0.18,
          0.03,
        );
      }
    },
  );
}

function playPurchaseSound() {
  void unlockAudio().then(
    () => {
      playTone(
        392,
        0,
        0.09,
        0.035,
        "triangle",
      );

      playTone(
        523.25,
        0.055,
        0.11,
        0.04,
        "triangle",
      );

      playTone(
        659.25,
        0.11,
        0.15,
        0.035,
      );
    },
  );
}

function playErrorSound() {
  void unlockAudio().then(
    () => {
      playTone(
        180,
        0,
        0.11,
        0.035,
        "square",
      );

      playTone(
        145,
        0.075,
        0.13,
        0.03,
        "square",
      );
    },
  );
}

function bindAudioUnlock() {
  const unlock = () => {
    void unlockAudio();
  };

  window.addEventListener(
    "pointerdown",
    unlock,
    {
      once: true,
      capture: true,
    },
  );

  window.addEventListener(
    "keydown",
    unlock,
    {
      once: true,
      capture: true,
    },
  );
}

function getDiscoveredFloor(
  world,
) {
  const value =
    Number(
      world?.player
        ?.discoveredFloor,
    );

  return Number.isFinite(
    value,
  )
    ? Math.max(
        0,
        Math.floor(value),
      )
    : 0;
}

function getHudClasses(
  state,
) {
  const classes = [];

  if (
    isCosmeticOwned(
      "violetCoinEdge",
      state,
    )
  ) {
    classes.push(
      "miz-violet-edge",
    );
  }

  if (
    isCosmeticOwned(
      "smokeCoinFace",
      state,
    )
  ) {
    classes.push(
      "miz-smoke-face",
    );
  }

  if (
    isCosmeticOwned(
      "mystCounterFrame",
      state,
    )
  ) {
    classes.push(
      "miz-counter-frame",
    );
  }

  if (
    isCosmeticOwned(
      "orbitingSpecks",
      state,
    )
  ) {
    classes.push(
      "miz-orbiting-specks",
    );
  }

  return classes;
}

function ensureHud() {
  const mazeFrame =
    document.querySelector(
      ".maze-frame",
    );

  if (
    !(mazeFrame instanceof
      HTMLElement)
  ) {
    document
      .getElementById(
        HUD_ID,
      )
      ?.remove();

    return null;
  }

  let hud =
    mazeFrame.querySelector(
      `#${HUD_ID}`,
    );

  if (!hud) {
    hud =
      document.createElement(
        "aside",
      );

    hud.id = HUD_ID;

    hud.innerHTML = `
      <span class="miz-hud-coin">
        ${COIN_SVG}
        <span class="miz-orbit"></span>
      </span>
      <span class="miz-hud-number">0</span>
    `;

    mazeFrame.append(
      hud,
    );
  }

  return hud;
}

function updateHud(
  state,
  shouldPop = false,
) {
  const hud =
    ensureHud();

  if (!hud) {
    return;
  }

  hud.className =
    getHudClasses(
      state,
    ).join(" ");

  hud.setAttribute(
    "aria-label",
    `Miz: ${state.miz}`,
  );

  const number =
    hud.querySelector(
      ".miz-hud-number",
    );

  if (number) {
    number.textContent =
      String(state.miz);
  }

  if (shouldPop) {
    hud.classList.remove(
      "miz-pop",
    );

    void hud.offsetWidth;

    hud.classList.add(
      "miz-pop",
    );

    window.setTimeout(
      () => {
        hud.classList.remove(
          "miz-pop",
        );
      },
      420,
    );
  }
}

function removeRunVeil() {
  document
    .getElementById(
      VEIL_ID,
    )
    ?.remove();
}

function installRunVeil() {
  const mazeFrame =
    document.querySelector(
      ".maze-frame",
    );

  if (
    !(mazeFrame instanceof
      HTMLElement) ||
    document.getElementById(
      VEIL_ID,
    )
  ) {
    return;
  }

  const veil =
    document.createElement(
      "div",
    );

  veil.id =
    VEIL_ID;

  veil.setAttribute(
    "aria-hidden",
    "true",
  );

  mazeFrame.append(
    veil,
  );
}

function registerWorld(
  world,
) {
  activeWorld =
    world;

  lastDiscoveredFloor =
    getDiscoveredFloor(
      world,
    );

  removeRunVeil();

  const veil =
    consumeOneTimeItem(
      "mistVeil",
    );

  if (veil.consumed) {
    window.setTimeout(
      installRunVeil,
      0,
    );
  }
}

function processWorld() {
  const world =
    globalThis
      .__mistMazeWorld ??
    null;

  if (!world) {
    activeWorld = null;
    lastDiscoveredFloor =
      0;
    removeRunVeil();
    return;
  }

  if (
    world !==
    activeWorld
  ) {
    registerWorld(
      world,
    );
  }

  const discoveredFloor =
    getDiscoveredFloor(
      world,
    );

  if (
    discoveredFloor <
    lastDiscoveredFloor
  ) {
    lastDiscoveredFloor =
      discoveredFloor;
    return;
  }

  const newlyExplored =
    discoveredFloor -
    lastDiscoveredFloor;

  lastDiscoveredFloor =
    discoveredFloor;

  if (
    newlyExplored <= 0
  ) {
    updateHud(
      loadMizState(),
    );
    return;
  }

  const result =
    addExploredTiles(
      newlyExplored,
    );

  updateHud(
    result.state,
    result.mizEarned > 0,
  );

  if (
    result.mizEarned > 0
  ) {
    playCoinSound(
      result.enhancedChime,
    );
  }
}

export function installMizEconomyEnhancement() {
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
  bindAudioUnlock();

  window.addEventListener(
    MIZ_STATE_CHANGED_EVENT,
    (event) => {
      const state =
        event.detail?.state ??
        loadMizState();

      updateHud(
        state,
        event.detail?.reason ===
          "tiles" &&
          (
            event.detail
              ?.mizEarned ??
            0
          ) > 0,
      );
    },
  );

  window.addEventListener(
    MIZ_SOUND_EVENT,
    (event) => {
      const sound =
        event.detail?.sound;

      if (
        sound ===
        "purchase"
      ) {
        playPurchaseSound();
      } else if (
        sound ===
        "error"
      ) {
        playErrorSound();
      }
    },
  );

  window.setInterval(
    processWorld,
    CHECK_INTERVAL_MS,
  );

  processWorld();
}
