// src/features/runtimeEnhancements.js
import {
  activateStoredPowerUp,
  getActivePowerUps,
  getStoredPowerUps,
} from "../game/gameplay.js";
import {
  getLabyrinthTimeRemaining,
} from "../game/labyrinth.js";
import {
  isLevelUnlocked,
  recordLevelCompletion,
} from "../services/progression.js";

const ROOT_ID = "mist-maze-runtime-enhancements";
const STYLE_ID = "mist-maze-runtime-styles";
const UPDATE_MS = 50;

function getWorld() {
  return globalThis.__mistMazeWorld ?? null;
}

function getCanvas() {
  return document.querySelector(".maze-frame > canvas");
}

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);

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

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .mist-locked-level {
      position: relative !important;
      filter: saturate(.48) brightness(.72);
    }

    .mist-lock-overlay {
      position: absolute;
      inset: 0;
      z-index: 30;
      overflow: hidden;
      border-radius: inherit;
      background: rgba(2, 6, 23, .2);
      pointer-events: none;
    }

    .mist-chain {
      position: absolute;
      left: -15%;
      top: 48%;
      width: 130%;
      height: 16px;
      transform-origin: center;
      border-radius: 999px;
      background:
        repeating-linear-gradient(
          90deg,
          #1f2937 0 8px,
          #94a3b8 8px 12px,
          #334155 12px 20px,
          #cbd5e1 20px 23px
        );
      border: 2px solid rgba(15, 23, 42, .95);
      box-shadow:
        0 4px 7px rgba(0,0,0,.65),
        inset 0 2px 2px rgba(255,255,255,.22);
    }

    .mist-chain-a { transform: rotate(32deg); }
    .mist-chain-b { transform: rotate(-32deg); }

    .mist-padlock {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 62px;
      height: 52px;
      transform: translate(-50%, -38%);
      border-radius: 9px 9px 13px 13px;
      border: 3px solid #111827;
      background:
        linear-gradient(145deg, #d1d5db, #64748b 46%, #334155 72%, #cbd5e1);
      box-shadow:
        0 8px 16px rgba(0,0,0,.65),
        inset 0 2px 5px rgba(255,255,255,.42);
    }

    .mist-padlock::before {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 36px;
      width: 38px;
      height: 38px;
      transform: translateX(-50%);
      border: 8px solid #94a3b8;
      border-bottom: 0;
      border-radius: 22px 22px 0 0;
      box-shadow: inset 0 0 0 2px #334155;
    }

    .mist-padlock::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 18px;
      width: 7px;
      height: 18px;
      transform: translateX(-50%);
      border-radius: 999px;
      background: #111827;
      box-shadow: 0 0 0 2px rgba(255,255,255,.1);
    }

    .mist-city-preview {
      position: absolute;
      inset: 0;
      z-index: 8;
      overflow: hidden;
      pointer-events: none;
      background:
        linear-gradient(to top, rgba(78,83,88,.65), transparent 54%),
        linear-gradient(180deg, #454b50 0%, #71767b 38%, #555b60 100%);
    }

    .mist-city-preview::before {
      content: "";
      position: absolute;
      left: -4%;
      right: -4%;
      bottom: 19%;
      height: 58%;
      background:
        linear-gradient(90deg,
          #24282c 0 13%, transparent 13% 16%,
          #34393e 16% 31%, transparent 31% 35%,
          #1f2327 35% 49%, transparent 49% 53%,
          #30353a 53% 72%, transparent 72% 76%,
          #24292d 76% 100%);
      clip-path: polygon(
        0 28%, 11% 28%, 11% 7%, 25% 7%,
        25% 20%, 40% 20%, 40% 0,
        52% 0, 52% 24%, 67% 24%,
        67% 12%, 84% 12%, 84% 31%, 100% 31%,
        100% 100%, 0 100%
      );
      box-shadow: 0 -10px 30px rgba(0,0,0,.28);
    }

    .mist-city-preview::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          90deg,
          transparent 0 21px,
          rgba(250,204,21,.18) 21px 25px,
          transparent 25px 49px
        ),
        linear-gradient(
          180deg,
          rgba(230,233,235,.42),
          rgba(180,184,188,.1) 48%,
          rgba(150,154,158,.42)
        );
      opacity: .68;
      mix-blend-mode: screen;
    }

    .mist-city-road {
      position: absolute;
      z-index: 9;
      left: 30%;
      right: 30%;
      bottom: -12%;
      height: 48%;
      transform: perspective(180px) rotateX(58deg);
      transform-origin: bottom;
      background:
        linear-gradient(
          90deg,
          transparent 48%,
          rgba(250,204,21,.65) 48% 52%,
          transparent 52%
        ),
        #22272b;
      box-shadow: 0 0 32px rgba(200,204,208,.24);
    }

    .mist-legendary-text {
      color: #facc15 !important;
      text-shadow: 0 0 12px rgba(250,204,21,.55);
    }
  `;
  document.head.append(style);
}

function levelKeyFromCard(card) {
  const number =
    card.querySelector(".level-choice-number")
      ?.textContent?.trim() ?? "";

  if (/LEVEL\s*0/i.test(number)) {
    return "level0";
  }

  if (/LEVEL\s*1/i.test(number)) {
    return "level1";
  }

  if (/LEVEL\s*2/i.test(number)) {
    return "level2";
  }

  if (/LEVEL\s*3/i.test(number)) {
    return "level3";
  }

  const text = card.textContent ?? "";

  if (/LABYRINTH/i.test(text)) {
    return "labyrinth";
  }

  return null;
}

function ensureCityPreview(card) {
  if (card.querySelector(".mist-city-preview")) {
    return;
  }

  const preview =
    card.querySelector(".level-preview-wrap");

  if (!preview) {
    return;
  }

  const city = document.createElement("div");
  city.className = "mist-city-preview";

  const road = document.createElement("div");
  road.className = "mist-city-road";

  preview.style.position = "relative";
  preview.append(city, road);
}

function ensureLockOverlay(card) {
  if (card.querySelector(".mist-lock-overlay")) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "mist-lock-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="mist-chain mist-chain-a"></div>
    <div class="mist-chain mist-chain-b"></div>
    <div class="mist-padlock"></div>
  `;
  card.append(overlay);
}

function removeLockOverlay(card) {
  card
    .querySelector(".mist-lock-overlay")
    ?.remove();
}

function decorateLevelCards() {
  for (
    const card of document.querySelectorAll(".level-choice")
  ) {
    const levelKey = levelKeyFromCard(card);

    if (!levelKey) {
      continue;
    }

    if (levelKey === "level0") {
      ensureCityPreview(card);
    }

    const unlocked = isLevelUnlocked(levelKey);

    card.classList.toggle(
      "mist-locked-level",
      !unlocked,
    );
    card.setAttribute(
      "aria-disabled",
      unlocked ? "false" : "true",
    );

    if (unlocked) {
      removeLockOverlay(card);
    } else {
      ensureLockOverlay(card);
    }
  }
}

function interceptLockedLevel(event) {
  const card = event.target.closest?.(".level-choice");

  if (!card) {
    return;
  }

  const levelKey = levelKeyFromCard(card);

  if (
    levelKey &&
    !isLevelUnlocked(levelKey)
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

function patchWeaponHotkeyBadge(world) {
  if (
    !world?.player?.asherMode ||
    world.labyrinthMode
  ) {
    return;
  }

  for (const heading of document.querySelectorAll("h2")) {
    if (heading.textContent?.trim() !== "Weapons") {
      continue;
    }

    const section = heading.closest("section");
    const buttons = section
      ? [...section.querySelectorAll("button")]
      : [];

    const swordButton = buttons.find((button) =>
      /Sword Gun/i.test(button.textContent ?? ""),
    );

    if (!swordButton) {
      continue;
    }

    const badge = [...swordButton.querySelectorAll("div")]
      .find((element) =>
        ["•", "0"].includes(
          element.textContent?.trim(),
        ),
      );

    if (badge) {
      badge.textContent = "0";
    }
  }
}

function patchChargeBasedActivePowerUps(world) {
  if (!world || world.labyrinthMode) {
    return;
  }

  const persistentLabels = new Map();

  for (const [key, state] of Object.entries(
    world.player?.powerUps ?? {},
  )) {
    if (!state?.legendary) {
      continue;
    }

    if (key === "breaker") {
      persistentLabels.set(
        "Wall Breaker",
        `${Math.max(0, state.charges ?? 0)} uses`,
      );
      continue;
    }

    if (key === "demolition") {
      persistentLabels.set(
        "Demolition",
        `${Math.max(0, state.charges ?? 0)} uses`,
      );
      continue;
    }

    if (key === "regen") {
      persistentLabels.set(
        "Regeneration",
        `${Math.ceil(
          Math.max(0, state.legendaryHealRemaining ?? 0),
        )} HP`,
      );
    }
  }

  if (!persistentLabels.size) {
    return;
  }

  for (const heading of document.querySelectorAll("h2")) {
    if (heading.textContent?.trim() !== "Active Power-ups") {
      continue;
    }

    const section = heading.closest("section");

    if (!section) {
      continue;
    }

    for (const row of section.querySelectorAll("div")) {
      const text = row.textContent ?? "";

      for (const [label, remaining] of persistentLabels) {
        if (!text.includes(label)) {
          continue;
        }

        const candidates = [...row.querySelectorAll("div")]
          .filter((element) =>
            /(?:Infinity|\d+\.\d+)s/.test(
              element.textContent?.trim() ?? "",
            ),
          );

        const timer = candidates.at(-1);

        if (timer) {
          timer.textContent = remaining;
        }
      }
    }
  }
}

function patchDesktopPowerHolder() {
  for (const heading of document.querySelectorAll("h2")) {
    if (
      heading.textContent?.trim() !==
      "Power-up Holder"
    ) {
      continue;
    }

    const section = heading.closest("section");

    if (!section) {
      continue;
    }

    const labels = [...section.querySelectorAll("span")];
    const maxLabel = labels.find(
      (span) =>
        span.textContent?.trim() === "MAX 2",
    );

    if (maxLabel) {
      maxLabel.textContent = "MAX 3";
    }

    for (const paragraph of section.querySelectorAll("p")) {
      if (/both slots/i.test(paragraph.textContent ?? "")) {
        paragraph.textContent = (paragraph.textContent ?? "")
          .replace(/both slots/gi, "all three slots")
          .replace(/2 slots/gi, "3 slots");
      }
    }

    const grid = [...section.querySelectorAll("div")]
      .find(
        (div) =>
          div.children.length >= 3 &&
          [...div.children].every(
            (child) => child.tagName === "BUTTON",
          ),
      );

    if (!grid) {
      continue;
    }

    grid.style.gridTemplateColumns =
      "repeat(3, minmax(0, 1fr))";

    const hotkeys = ["Z", "X", "C"];

    [...grid.children].forEach((button, index) => {
      const candidates = [...button.querySelectorAll("span")];
      const keyBadge = candidates.find(
        (span) =>
          ["Z", "X"].includes(
            span.textContent?.trim(),
          ),
      );

      if (keyBadge && hotkeys[index]) {
        keyBadge.textContent = hotkeys[index];
      }
    });
  }
}

function patchTouchPowerSlot(world) {
  const container =
    document.querySelector(".touch-power-buttons");

  if (
    !container ||
    world?.labyrinthMode
  ) {
    return;
  }

  let button =
    container.querySelector(
      '[data-mist-power-slot="2"]',
    );

  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className =
      "touch-action-button touch-power-button";
    button.dataset.mistPowerSlot = "2";
    button.setAttribute(
      "aria-label",
      "Use power-up slot 3",
    );
    button.textContent = "P3";
    button.addEventListener("click", () => {
      const currentWorld = getWorld();

      if (currentWorld) {
        activateStoredPowerUp(
          currentWorld,
          2,
        );
      }
    });
    container.append(button);
  }

  button.disabled =
    !world?.player?.powerUpSlots?.[2];
}

function handleKeyboardPowerSlot(event) {
  if (
    event.repeat ||
    event.defaultPrevented ||
    String(event.key).toLowerCase() !== "c"
  ) {
    return;
  }

  const target = event.target;

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable
  ) {
    return;
  }

  const world = getWorld();

  if (
    !world ||
    world.labyrinthMode ||
    world.gameOver ||
    world.victory
  ) {
    return;
  }

  event.preventDefault();
  activateStoredPowerUp(world, 2);
}

function formatTimer(seconds) {
  const safe = Math.max(
    0,
    Math.ceil(Number(seconds) || 0),
  );
  const minutes =
    String(Math.floor(safe / 60))
      .padStart(2, "0");
  const remaining =
    String(safe % 60)
      .padStart(2, "0");

  return `${minutes}:${remaining}`;
}

function timerSecond(world) {
  return Math.max(
    0,
    Math.ceil(
      getLabyrinthTimeRemaining(world),
    ),
  );
}

function queueTimerTick(world, second, state) {
  if (
    !world.labyrinthMode ||
    world.gameOver ||
    world.victory
  ) {
    state.timerWorld = world;
    state.lastTimerSecond = null;
    return;
  }

  if (state.timerWorld !== world) {
    state.timerWorld = world;
    state.lastTimerSecond = second;
    return;
  }

  if (state.lastTimerSecond === null) {
    state.lastTimerSecond = second;
    return;
  }

  if (state.lastTimerSecond === second) {
    return;
  }

  state.lastTimerSecond = second;
  world.audioEvents ??= [];

  if (world.audioEvents.length < 48) {
    world.audioEvents.push({
      type: "labyrinthTick",
      second,
    });
  }
}

function timerHtml(world, second) {
  if (
    !world.labyrinthMode ||
    world.gameOver ||
    world.victory
  ) {
    return "";
  }

  return `
    <div style="
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
    ">${formatTimer(second)}</div>
  `;
}

function powerHudHtml(world) {
  if (world.viewMode !== "3d") {
    return "";
  }

  const stored = getStoredPowerUps(world);
  const active = getActivePowerUps(world);

  if (world.labyrinthMode) {
    const lightCount =
      Object.values(
        world.labyrinth?.ownedLights ?? {},
      ).filter(Boolean).length;

    return `
      <section style="
        position:absolute;
        top:54px;
        right:12px;
        width:205px;
        padding:9px 10px;
        border:1px solid rgba(167,139,250,.25);
        border-radius:10px;
        background:rgba(2,6,23,.78);
        color:#cbd5e1;
        font-size:9px;
        backdrop-filter:blur(4px);
      ">
        <strong style="color:#ddd6fe">LABYRINTH POWER</strong>
        <div style="margin-top:5px">
          LIGHTS ${lightCount} · BREAKERS ${
            world.labyrinth?.breakerCharges ?? 0
          }/10
        </div>
      </section>
    `;
  }

  const slotHtml = [0, 1, 2]
    .map((index) => {
      const power = stored[index];
      const legendary = power?.legendary;

      return `
        <div style="
          padding:6px;
          border-radius:7px;
          border:1px solid ${
            legendary
              ? "rgba(250,204,21,.8)"
              : power
                ? `${power.color}66`
                : "rgba(148,163,184,.14)"
          };
          background:rgba(15,23,42,.65);
          min-width:0;
        ">
          <strong style="
            color:${
              legendary
                ? "#facc15"
                : power?.color ?? "#64748b"
            };
            font-size:8px;
          ">${["Z", "X", "C"][index]}</strong>
          <div style="
            color:${power ? "#f8fafc" : "#64748b"};
            font-size:8px;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
          ">${power?.label ?? "Empty"}</div>
        </div>
      `;
    })
    .join("");

  const activeHtml = active.length
    ? active
        .map(
          (power) => `
            <div style="
              display:flex;
              justify-content:space-between;
              gap:6px;
              color:${power.legendary ? "#facc15" : "#cbd5e1"};
              font-size:8px;
            ">
              <span>${power.label}</span>
              <strong>${
                power.key === "regen" &&
                power.legendary &&
                Number.isFinite(power.healingRemaining)
                  ? `${Math.ceil(power.healingRemaining)} HP`
                  : Number.isFinite(power.remaining)
                    ? `${power.remaining.toFixed(1)}s`
                    : `${power.charges ?? "∞"} uses`
              }</strong>
            </div>
          `,
        )
        .join("")
    : '<div style="color:#64748b;font-size:8px">No active power-up</div>';

  return `
    <section style="
      position:absolute;
      top:70px;
      right:12px;
      width:220px;
      padding:9px;
      border:1px solid rgba(167,139,250,.25);
      border-radius:10px;
      background:rgba(2,6,23,.8);
      backdrop-filter:blur(4px);
    ">
      <div style="
        color:#ddd6fe;
        font-size:8px;
        font-weight:950;
        letter-spacing:.12em;
      ">POWER-UPS · Z / X / C</div>
      <div style="
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:5px;
        margin-top:6px;
      ">${slotHtml}</div>
      <div style="
        display:grid;
        gap:3px;
        margin-top:6px;
      ">${activeHtml}</div>
    </section>
  `;
}

function findButton(labels) {
  const normalized =
    labels.map(
      (label) => label.toUpperCase(),
    );

  return [...document.querySelectorAll("button")]
    .find((button) => {
      const text =
        button.textContent
          ?.trim()
          .toUpperCase() ?? "";

      return normalized.some(
        (label) =>
          text.includes(label),
      );
    });
}

function openThreeDSettings() {
  const gear =
    document.querySelector(".three-d-gear-only");

  if (
    gear &&
    gear.getAttribute("aria-expanded") !== "true"
  ) {
    gear.click();
  }
}

function clickRestartControl() {
  const button = findButton(["START NEW MAZE"]);

  if (button) {
    button.click();
    return;
  }

  openThreeDSettings();

  window.setTimeout(
    () =>
      findButton(["START NEW MAZE"])?.click(),
    0,
  );
}

function clickMenuControl() {
  const button =
    findButton([
      "LEVEL MENU",
      "CHOOSE ANOTHER LEVEL",
    ]);

  if (button) {
    button.click();
    return;
  }

  openThreeDSettings();

  window.setTimeout(
    () =>
      findButton([
        "LEVEL MENU",
        "CHOOSE ANOTHER LEVEL",
      ])?.click(),
    0,
  );
}

function endOverlayHtml(world, state) {
  if (
    (!world.gameOver && !world.victory) ||
    state.hiddenTerminalWorld === world
  ) {
    return "";
  }

  const primary =
    world.gameOver
      ? "START NEW GAME"
      : "TRY AGAIN";

  return `
    <div style="
      position:absolute;
      inset:0;
      display:grid;
      place-items:center;
      pointer-events:none;
    ">
      <div style="
        display:grid;
        justify-items:center;
        gap:12px;
        margin-top:145px;
      ">
        <button
          type="button"
          data-mist-action="restart"
          style="
            min-width:270px;
            padding:17px 30px;
            border:2px solid rgba(255,255,255,.92);
            border-radius:16px;
            background:linear-gradient(135deg,#facc15,#67e8f9 52%,#22d3ee);
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

function bindOverlayActions(root, world, state) {
  root
    .querySelector('[data-mist-action="restart"]')
    ?.addEventListener(
      "click",
      () => {
        state.hiddenTerminalWorld = world;
        state.lastMarkup = "";
        root.innerHTML = "";
        document.exitPointerLock?.();
        clickRestartControl();
      },
      { once: true },
    );

  root
    .querySelector('[data-mist-action="menu"]')
    ?.addEventListener(
      "click",
      () => {
        state.hiddenTerminalWorld = world;
        state.lastMarkup = "";
        root.innerHTML = "";
        document.exitPointerLock?.();
        clickMenuControl();
      },
      { once: true },
    );
}

function processVictory(world, state) {
  if (
    !world.victory ||
    world.labyrinthMode ||
    state.progressWorlds.has(world)
  ) {
    return;
  }

  state.progressWorlds.add(world);
  recordLevelCompletion(world.level.key);
  decorateLevelCards();
}

function updateOverlay(root, state) {
  decorateLevelCards();
  patchDesktopPowerHolder();

  const world = getWorld();

  patchTouchPowerSlot(world);
  patchWeaponHotkeyBadge(world);
  patchChargeBasedActivePowerUps(world);

  if (world) {
    processVictory(world, state);
  }

  const canvas = getCanvas();

  if (!world || !canvas) {
    root.style.display = "none";
    return;
  }

  if (state.world !== world) {
    state.world = world;
    state.hiddenTerminalWorld = null;
    state.lastMarkup = "";
    state.timerWorld = world;
    state.lastTimerSecond =
      world.labyrinthMode
        ? timerSecond(world)
        : null;
  }

  const rect = canvas.getBoundingClientRect();

  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    root.style.display = "none";
    return;
  }

  root.style.display = "block";
  root.style.left = `${rect.left}px`;
  root.style.top = `${rect.top}px`;
  root.style.width = `${rect.width}px`;
  root.style.height = `${rect.height}px`;

  const second =
    world.labyrinthMode
      ? timerSecond(world)
      : null;

  queueTimerTick(
    world,
    second,
    state,
  );

  const markup = [
    timerHtml(world, second),
    powerHudHtml(world),
    endOverlayHtml(world, state),
  ].join("");

  if (markup !== state.lastMarkup) {
    root.innerHTML = markup;
    state.lastMarkup = markup;
    bindOverlayActions(
      root,
      world,
      state,
    );
  }
}

export function installRuntimeEnhancements() {
  if (
    typeof document === "undefined" ||
    globalThis.__mistMazeRuntimeInstalled
  ) {
    return;
  }

  globalThis.__mistMazeRuntimeInstalled = true;

  ensureStyles();
  const root = ensureRoot();
  const state = {
    world: null,
    hiddenTerminalWorld: null,
    lastMarkup: "",
    timerWorld: null,
    lastTimerSecond: null,
    progressWorlds: new WeakSet(),
  };

  document.addEventListener(
    "click",
    interceptLockedLevel,
    true,
  );
  window.addEventListener(
    "keydown",
    handleKeyboardPowerSlot,
    true,
  );
  window.addEventListener(
    "mist-maze-progression-changed",
    decorateLevelCards,
  );
  window.setInterval(
    () => updateOverlay(root, state),
    UPDATE_MS,
  );

  updateOverlay(root, state);
}
