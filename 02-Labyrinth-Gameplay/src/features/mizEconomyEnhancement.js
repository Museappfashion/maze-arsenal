// src/features/mizEconomyEnhancement.js

import {
  MAX_AMMO,
} from "../config/ammo.js";
import {
  MIZ_SOUND_EVENT,
  MIZ_STATE_CHANGED_EVENT,
  MYST_SHOP_ITEMS,
  addExploredTiles,
  consumeOneTimeItem,
  getConsumableCount,
  isCosmeticOwned,
  loadMizState,
} from "../services/mizEconomy.js";

const INSTALLED_KEY =
  "__mistMazeMizEconomyInstalled";

const STYLE_ID =
  "mist-maze-miz-counter-styles";

const HUD_ID =
  "mist-maze-miz-hud";

const POWER_BUTTON_ID =
  "mist-maze-myst-power-button";

const POWER_PANEL_ID =
  "mist-maze-myst-power-panel";

const CHECK_INTERVAL_MS =
  90;

const STANDARD_WEAPONS =
  Object.freeze([
    "fists",
    "crowbar",
    "machete",
    "pistol",
    "revolver",
    "smg",
    "shotgun",
    "rifle",
    "dmr",
  ]);

const PRESERVED_ENEMY_KINDS =
  new Set([
    "turret",
    "warden",
  ]);

const POWER_ITEMS =
  Object.freeze(
    MYST_SHOP_ITEMS.filter(
      (item) =>
        item.kind ===
        "oneTime",
    ),
  );

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

    <circle
      class="miz-svg-double-rim"
      cx="18"
      cy="18"
      r="13.4"
      fill="none"
      stroke="rgba(255,255,255,0)"
      stroke-width="1"
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
      class="miz-svg-letter"
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
  }

  #${HUD_ID}.miz-pulse-aura {
    animation:
      mizAuraPulse
      2.7s
      ease-in-out
      infinite;
  }

  #${HUD_ID}.miz-pop {
    animation:
      mizCounterPop
      340ms
      ease;
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

  .miz-hud-number {
    min-width: 1ch;
    color: #f8fafc;
    font-size: 19px;
    line-height: 1;
    font-weight: 950;
    letter-spacing: -.04em;
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

  #${HUD_ID}.miz-engraved-m
    .miz-svg-letter {
    fill: #faf5ff;
    stroke: #7e22ce;
    stroke-width: .7px;
    paint-order: stroke fill;
  }

  #${HUD_ID}.miz-frosted
    .miz-hud-coin svg {
    filter:
      brightness(1.12)
      saturate(.72);
  }

  #${HUD_ID}.miz-double-rim
    .miz-svg-double-rim {
    stroke: rgba(216,180,254,.72);
  }

  #${HUD_ID}.miz-shadow-halo
    .miz-hud-coin {
    filter:
      drop-shadow(
        0 0 8px
        rgba(129,140,248,.38)
      );
  }

  .miz-orbit {
    position: absolute;
    inset: -3px;
    display: none;
    border-radius: 50%;
    animation:
      mizOrbit
      3.4s
      linear
      infinite;
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

  .miz-star-glint {
    position: absolute;
    right: -4px;
    top: -4px;
    display: none;
    width: 9px;
    height: 9px;
    color: #f8fafc;
    font-size: 10px;
    line-height: 1;
    animation:
      mizGlint
      2.2s
      ease-in-out
      infinite;
  }

  #${HUD_ID}.miz-star-glint-owned
    .miz-star-glint {
    display: block;
  }

  #${POWER_BUTTON_ID} {
    position: absolute;
    top: 62px;
    right: 14px;
    z-index: 62;
    min-width: 42px;
    min-height: 38px;
    padding: 7px 10px;
    border: 1px solid rgba(168,85,247,.34);
    border-radius: 12px;
    background: rgba(30,27,75,.84);
    color: #ede9fe;
    font: inherit;
    font-size: 12px;
    font-weight: 950;
    cursor: pointer;
    box-shadow: 0 10px 24px rgba(0,0,0,.24);
  }

  #${POWER_BUTTON_ID}:disabled {
    display: none;
  }

  #${POWER_PANEL_ID} {
    position: absolute;
    top: 106px;
    right: 14px;
    z-index: 64;
    width: min(420px, calc(100% - 28px));
    max-height: min(440px, 70%);
    overflow-y: auto;
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid rgba(168,85,247,.3);
    border-radius: 14px;
    background:
      radial-gradient(
        circle at 92% 0%,
        rgba(168,85,247,.14),
        transparent 32%
      ),
      rgba(2,6,23,.96);
    box-shadow: 0 20px 50px rgba(0,0,0,.42);
    pointer-events: auto;
  }

  #${POWER_PANEL_ID}[hidden] {
    display: none;
  }

  .myst-power-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .myst-power-title {
    color: #f8fafc;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .myst-power-close {
    width: 32px;
    height: 32px;
    border: 1px solid rgba(148,163,184,.2);
    border-radius: 9px;
    background: rgba(15,23,42,.82);
    color: #cbd5e1;
    font: inherit;
    cursor: pointer;
  }

  .myst-power-status {
    min-height: 15px;
    color: #c4b5fd;
    font-size: 10px;
    font-weight: 800;
  }

  .myst-power-list {
    display: grid;
    gap: 8px;
  }

  .myst-power-item {
    display: grid;
    grid-template-columns:
      minmax(0,1fr)
      auto;
    gap: 9px;
    align-items: center;
    padding: 10px;
    border: 1px solid rgba(148,163,184,.13);
    border-radius: 11px;
    background: rgba(15,23,42,.68);
  }

  .myst-power-name {
    color: #f8fafc;
    font-size: 11px;
    font-weight: 900;
  }

  .myst-power-effect {
    margin-top: 3px;
    color: #94a3b8;
    font-size: 9px;
    line-height: 1.35;
  }

  .myst-power-use {
    min-width: 70px;
    min-height: 36px;
    border: 1px solid rgba(168,85,247,.34);
    border-radius: 9px;
    background: rgba(88,28,135,.68);
    color: #faf5ff;
    font: inherit;
    font-size: 10px;
    font-weight: 950;
    cursor: pointer;
  }

  .myst-power-use:disabled {
    opacity: .42;
    cursor: not-allowed;
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

  @keyframes mizGlint {
    0%, 70%, 100% {
      opacity: .2;
      transform: scale(.7) rotate(0deg);
    }
    82% {
      opacity: 1;
      transform: scale(1.25) rotate(90deg);
    }
  }

  @keyframes mizAuraPulse {
    0%, 100% {
      box-shadow:
        0 12px 30px rgba(0,0,0,.28),
        0 0 0 rgba(168,85,247,0);
    }
    50% {
      box-shadow:
        0 12px 30px rgba(0,0,0,.28),
        0 0 18px rgba(168,85,247,.2);
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

    #${POWER_BUTTON_ID} {
      top: 53px;
      right: 9px;
    }

    #${POWER_PANEL_ID} {
      top: 97px;
      right: 9px;
      width: calc(100% - 18px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    #${HUD_ID}.miz-pop,
    #${HUD_ID}.miz-pulse-aura,
    .miz-orbit,
    .miz-star-glint {
      animation: none !important;
    }
  }
`;

let activeWorld = null;
let lastDiscoveredFloor = 0;
let audioContext = null;
let powerPanelOpen = false;
let powerStatus = "";
let powerStatusTimer = 0;

function ensureStyles() {
  if (
    typeof document ===
      "undefined" ||
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

  if (!AudioContextClass) {
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

function playCoinSound() {
  void unlockAudio().then(
    () => {
      playTone(
        660,
        0,
        0.09,
        0.055,
        "triangle",
      );

      playTone(
        880,
        0.07,
        0.11,
        0.05,
      );
    },
  );
}

function playPurchaseSound() {
  void unlockAudio().then(
    () => {
      playTone(
        392,
        0,
        0.1,
        0.04,
        "triangle",
      );

      playTone(
        523.25,
        0.06,
        0.12,
        0.045,
        "triangle",
      );

      playTone(
        659.25,
        0.12,
        0.16,
        0.04,
      );
    },
  );
}

function playActivateSound() {
  void unlockAudio().then(
    () => {
      playTone(
        523.25,
        0,
        0.08,
        0.045,
        "triangle",
      );

      playTone(
        783.99,
        0.05,
        0.11,
        0.05,
        "sine",
      );

      playTone(
        1046.5,
        0.11,
        0.14,
        0.04,
        "sine",
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
        0.12,
        0.04,
        "square",
      );

      playTone(
        145,
        0.08,
        0.14,
        0.035,
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

  const map =
    Object.freeze({
      violetCoinEdge:
        "miz-violet-edge",
      smokeCoinFace:
        "miz-smoke-face",
      mystCounterFrame:
        "miz-counter-frame",
      orbitingSpecks:
        "miz-orbiting-specks",
      starGlint:
        "miz-star-glint-owned",
      engravedM:
        "miz-engraved-m",
      frostedCoin:
        "miz-frosted",
      shadowHalo:
        "miz-shadow-halo",
      doubleRim:
        "miz-double-rim",
      pulseAura:
        "miz-pulse-aura",
    });

  for (
    const [
      key,
      className,
    ] of
    Object.entries(map)
  ) {
    if (
      isCosmeticOwned(
        key,
        state,
      )
    ) {
      classes.push(
        className,
      );
    }
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

    hud.id =
      HUD_ID;

    hud.innerHTML = `
      <span class="miz-hud-coin">
        ${COIN_SVG}
        <span class="miz-orbit"></span>
        <span class="miz-star-glint">✦</span>
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

function getTotalPowerCount(
  state,
) {
  return POWER_ITEMS.reduce(
    (
      total,
      item,
    ) =>
      total +
      getConsumableCount(
        item.key,
        state,
      ),
    0,
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}

function canActivatePower(
  itemKey,
  world,
) {
  if (!world?.player) {
    return {
      ok: false,
      reason:
        "No active maze.",
    };
  }

  if (
    itemKey ===
    "healPulse"
  ) {
    return {
      ok:
        world.player.hp <
        world.player.maxHp,
      reason:
        "Health is already full.",
    };
  }

  if (
    itemKey ===
    "ammoPulse"
  ) {
    if (world.labyrinthMode) {
      return {
        ok: false,
        reason:
          "No ammo in the Labyrinth.",
      };
    }

    return {
      ok:
        world.player.ammo <
        MAX_AMMO,
      reason:
        "Ammo is already full.",
    };
  }

  if (
    itemKey ===
    "nullPulse"
  ) {
    return {
      ok:
        (
          world.projectiles ??
          []
        ).length > 0,
      reason:
        "No active projectiles.",
    };
  }

  if (
    itemKey ===
    "velocityBloom"
  ) {
    return {
      ok:
        !world
          .__mystVelocityActive,
      reason:
        "Velocity Bloom is already active.",
    };
  }

  if (
    itemKey ===
    "mapFlash"
  ) {
    return {
      ok:
        getDiscoveredFloor(
          world,
        ) <
        (
          world.floorCount ??
          Infinity
        ),
      reason:
        "The maze is already revealed.",
    };
  }

  if (
    itemKey ===
    "arsenalKey"
  ) {
    if (world.labyrinthMode) {
      return {
        ok: false,
        reason:
          "Weapons are disabled in the Labyrinth.",
      };
    }

    const owned =
      world.player
        .ownedWeapons ??
      {};

    return {
      ok:
        STANDARD_WEAPONS.some(
          (key) =>
            !owned[key],
        ),
      reason:
        "All standard weapons are already unlocked.",
    };
  }

  if (
    itemKey ===
    "purgeOrb"
  ) {
    const targets =
      (
        world.enemies ??
        []
      ).filter(
        (enemy) =>
          !PRESERVED_ENEMY_KINDS.has(
            enemy.kind,
          ),
      );

    return {
      ok:
        targets.length > 0,
      reason:
        "No standard enemies remain.",
    };
  }

  if (
    itemKey ===
    "phoenixSpark"
  ) {
    return {
      ok:
        Boolean(
          world.gameOver &&
          !world.victory,
        ),
      reason:
        "Phoenix Spark can only be used after defeat.",
    };
  }

  if (
    itemKey ===
    "exitFold"
  ) {
    return {
      ok:
        Boolean(
          world.exit &&
          !world.victory,
        ),
      reason:
        "No exit is available.",
    };
  }

  return {
    ok: true,
    reason: "",
  };
}

function disableLeaderboard(
  world,
) {
  if (
    !world ||
    world.labyrinthMode
  ) {
    return;
  }

  world.leaderboardEligible =
    false;

  world.runMode =
    "invalid";
}

function activatePowerEffect(
  itemKey,
  world,
) {
  if (
    itemKey ===
    "healPulse"
  ) {
    world.player.hp =
      world.player.maxHp;

    return "Health restored.";
  }

  if (
    itemKey ===
    "ammoPulse"
  ) {
    world.player.ammo =
      MAX_AMMO;

    return "Ammo refilled.";
  }

  if (
    itemKey ===
    "nullPulse"
  ) {
    world.projectiles =
      [];

    world.damageFlash =
      0;

    return "Projectiles cleared.";
  }

  if (
    itemKey ===
    "velocityBloom"
  ) {
    const originalSpeed =
      world.player.speed;

    world
      .__mystVelocityActive =
      true;

    world.player.speed =
      originalSpeed *
      1.25;

    window.setTimeout(
      () => {
        if (
          world
            .__mystVelocityActive
        ) {
          world.player.speed =
            originalSpeed;

          world
            .__mystVelocityActive =
            false;
        }
      },
      30000,
    );

    return "Velocity Bloom active for 30 seconds.";
  }

  if (
    itemKey ===
    "vitalBloom"
  ) {
    world.player.maxHp =
      Math.max(
        1,
        world.player.maxHp +
          50,
      );

    world.player.hp =
      Math.min(
        world.player.maxHp,
        world.player.hp +
          50,
      );

    return "Vital reserve increased for this run.";
  }

  if (
    itemKey ===
    "mapFlash"
  ) {
    world.discovered?.fill(
      1,
    );

    world.player
      .discoveredFloor =
      world.floorCount ??
      world.player
        .discoveredFloor;

    lastDiscoveredFloor =
      getDiscoveredFloor(
        world,
      );

    world.minimapDirty =
      true;

    return "Maze revealed.";
  }

  if (
    itemKey ===
    "arsenalKey"
  ) {
    world.player
      .ownedWeapons ??= {};

    for (
      const weaponKey of
      STANDARD_WEAPONS
    ) {
      world.player
        .ownedWeapons[
          weaponKey
        ] = true;
    }

    return "Standard arsenal unlocked for this run.";
  }

  if (
    itemKey ===
    "purgeOrb"
  ) {
    const player =
      world.player;

    const targets =
      (
        world.enemies ??
        []
      )
        .filter(
          (enemy) =>
            !PRESERVED_ENEMY_KINDS.has(
              enemy.kind,
            ),
        )
        .sort(
          (
            left,
            right,
          ) => {
            const leftDistance =
              Math.hypot(
                left.x -
                  player.x,
                left.y -
                  player.y,
              );

            const rightDistance =
              Math.hypot(
                right.x -
                  player.x,
                right.y -
                  player.y,
              );

            return (
              leftDistance -
              rightDistance
            );
          },
        )
        .slice(
          0,
          8,
        );

    const ids =
      new Set(
        targets.map(
          (enemy) =>
            enemy.id,
        ),
      );

    world.enemies =
      (
        world.enemies ??
        []
      ).filter(
        (enemy) =>
          !ids.has(
            enemy.id,
          ),
      );

    world.kills =
      (
        Number(
          world.kills,
        ) || 0
      ) +
      targets.length;

    world.minimapDirty =
      true;

    return `${targets.length} enemies removed.`;
  }

  if (
    itemKey ===
    "phoenixSpark"
  ) {
    world.gameOver =
      false;

    world.player.hp =
      Math.max(
        1,
        Math.ceil(
          world.player.maxHp *
            0.5,
        ),
      );

    world.projectiles =
      [];

    world.damageFlash =
      0;

    return "Revived at 50% health.";
  }

  if (
    itemKey ===
    "exitFold"
  ) {
    world.player.x =
      world.exit.x +
      0.5;

    world.player.y =
      world.exit.y +
      0.5;

    world.lastPlayerTile = {
      x: world.exit.x,
      y: world.exit.y,
    };

    return "Folded to the exit.";
  }

  return "Power activated.";
}

function setPowerStatus(
  message,
) {
  powerStatus =
    message;

  if (powerStatusTimer) {
    window.clearTimeout(
      powerStatusTimer,
    );
  }

  powerStatusTimer =
    window.setTimeout(
      () => {
        powerStatus =
          "";

        renderPowerControls();
      },
      2600,
    );
}

function activatePower(
  itemKey,
) {
  const world =
    globalThis
      .__mistMazeWorld ??
    null;

  const state =
    loadMizState();

  if (
    getConsumableCount(
      itemKey,
      state,
    ) <= 0
  ) {
    setPowerStatus(
      "You do not own that power.",
    );

    playErrorSound();

    return;
  }

  const availability =
    canActivatePower(
      itemKey,
      world,
    );

  if (!availability.ok) {
    setPowerStatus(
      availability.reason,
    );

    playErrorSound();

    return;
  }

  const consumed =
    consumeOneTimeItem(
      itemKey,
    );

  if (
    !consumed.consumed
  ) {
    setPowerStatus(
      "Power could not be consumed.",
    );

    playErrorSound();

    return;
  }

  const message =
    activatePowerEffect(
      itemKey,
      world,
    );

  disableLeaderboard(
    world,
  );

  world.message =
    message;

  world.messageTtl =
    1.8;

  setPowerStatus(
    message,
  );

  playActivateSound();

  renderPowerControls(
    consumed.state,
  );
}

function ensurePowerControls() {
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
        POWER_BUTTON_ID,
      )
      ?.remove();

    document
      .getElementById(
        POWER_PANEL_ID,
      )
      ?.remove();

    return null;
  }

  let button =
    mazeFrame.querySelector(
      `#${POWER_BUTTON_ID}`,
    );

  if (!button) {
    button =
      document.createElement(
        "button",
      );

    button.id =
      POWER_BUTTON_ID;

    button.type =
      "button";

    button.setAttribute(
      "aria-label",
      "Myst powers",
    );

    button.addEventListener(
      "click",
      () => {
        powerPanelOpen =
          !powerPanelOpen;

        renderPowerControls();
      },
    );

    mazeFrame.append(
      button,
    );
  }

  let panel =
    mazeFrame.querySelector(
      `#${POWER_PANEL_ID}`,
    );

  if (!panel) {
    panel =
      document.createElement(
        "section",
      );

    panel.id =
      POWER_PANEL_ID;

    panel.hidden =
      true;

    panel.addEventListener(
      "click",
      (event) => {
        const target =
          event.target;

        if (
          !(target instanceof
            Element)
        ) {
          return;
        }

        if (
          target.closest(
            "[data-myst-power-close]",
          )
        ) {
          powerPanelOpen =
            false;

          renderPowerControls();

          return;
        }

        const useButton =
          target.closest(
            "[data-myst-power-use]",
          );

        if (
          useButton instanceof
            HTMLButtonElement
        ) {
          const itemKey =
            useButton.dataset
              .mystPowerUse;

          if (itemKey) {
            activatePower(
              itemKey,
            );
          }
        }
      },
    );

    mazeFrame.append(
      panel,
    );
  }

  return {
    button,
    panel,
  };
}

function renderPowerControls(
  state =
    loadMizState(),
) {
  const controls =
    ensurePowerControls();

  if (!controls) {
    return;
  }

  const total =
    getTotalPowerCount(
      state,
    );

  controls.button.disabled =
    total <= 0;

  controls.button.textContent =
    `✦ ${total}`;

  if (
    total <= 0
  ) {
    powerPanelOpen =
      false;
  }

  controls.panel.hidden =
    !powerPanelOpen;

  if (
    !powerPanelOpen
  ) {
    return;
  }

  const world =
    globalThis
      .__mistMazeWorld ??
    null;

  const ownedItems =
    POWER_ITEMS.filter(
      (item) =>
        getConsumableCount(
          item.key,
          state,
        ) > 0,
    );

  const itemMarkup =
    ownedItems.map(
      (item) => {
        const count =
          getConsumableCount(
            item.key,
            state,
          );

        const availability =
          canActivatePower(
            item.key,
            world,
          );

        return `
          <article class="myst-power-item">
            <div>
              <div class="myst-power-name">
                ${escapeHtml(
                  item.name,
                )} ×${count}
              </div>
              <div class="myst-power-effect">
                ${escapeHtml(
                  item.effectLabel,
                )}
              </div>
            </div>
            <button
              type="button"
              class="myst-power-use"
              data-myst-power-use="${escapeHtml(
                item.key,
              )}"
              ${
                availability.ok
                  ? ""
                  : "disabled"
              }
              title="${escapeHtml(
                availability.ok
                  ? "Activate power"
                  : availability.reason,
              )}"
            >
              USE
            </button>
          </article>
        `;
      },
    ).join("");

  controls.panel.innerHTML = `
    <div class="myst-power-head">
      <div class="myst-power-title">
        Myst Powers
      </div>
      <button
        type="button"
        class="myst-power-close"
        data-myst-power-close
        aria-label="Close Myst powers"
      >
        ×
      </button>
    </div>
    <div class="myst-power-status">
      ${escapeHtml(
        powerStatus,
      )}
    </div>
    <div class="myst-power-list">
      ${itemMarkup}
    </div>
  `;
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

  powerPanelOpen =
    false;

  renderPowerControls(
    loadMizState(),
  );
}

function processWorld() {
  const world =
    globalThis
      .__mistMazeWorld ??
    null;

  if (!world) {
    activeWorld =
      null;

    lastDiscoveredFloor =
      0;

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

    if (powerPanelOpen) {
      renderPowerControls();
    }

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
    playCoinSound();
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

      renderPowerControls(
        state,
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
        "activate"
      ) {
        playActivateSound();
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

  updateHud(
    loadMizState(),
  );

  renderPowerControls(
    loadMizState(),
  );
}
