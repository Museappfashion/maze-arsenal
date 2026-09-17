// src/features/mizEconomyEnhancement.js

import {
  MIZ_STATE_CHANGED_EVENT,
  MIZ_TILES_PER_COIN,
  MYST_SHOP_ITEMS,
  addExploredTiles,
  applyMystPurchasesToWorld,
  getTilesUntilNextMiz,
  isItemOwned,
  loadMizState,
  purchaseMystItem,
} from "../services/mizEconomy.js";

const INSTALLED_KEY = "__mistMazeMizEconomyInstalled";
const STYLE_ID = "mist-maze-miz-economy-styles";
const HUD_ID = "mist-maze-miz-hud";
const SHOP_ID = "mist-maze-myst-shop";
const CHECK_INTERVAL_MS = 90;

const COIN_SVG = `
  <svg viewBox="0 0 36 36" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="mizCoinFace" cx="34%" cy="27%">
        <stop offset="0%" stop-color="#f8fafc" />
        <stop offset="30%" stop-color="#d1d5db" />
        <stop offset="68%" stop-color="#9ca3af" />
        <stop offset="100%" stop-color="#4b5563" />
      </radialGradient>
    </defs>
    <circle cx="18" cy="18" r="16" fill="url(#mizCoinFace)" stroke="#f3f4f6" stroke-width="1.5"/>
    <circle cx="18" cy="5.8" r="2" fill="#4b5563"/>
    <circle cx="26.6" cy="9.4" r="2" fill="#4b5563"/>
    <circle cx="30.2" cy="18" r="2" fill="#4b5563"/>
    <circle cx="26.6" cy="26.6" r="2" fill="#4b5563"/>
    <circle cx="18" cy="30.2" r="2" fill="#4b5563"/>
    <circle cx="9.4" cy="26.6" r="2" fill="#4b5563"/>
    <circle cx="5.8" cy="18" r="2" fill="#4b5563"/>
    <circle cx="9.4" cy="9.4" r="2" fill="#4b5563"/>
    <circle cx="18" cy="18" r="8.3" fill="rgba(31,41,55,.35)" stroke="rgba(255,255,255,.3)" stroke-width="1"/>
    <text x="18" y="22.2" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="12" font-weight="900" fill="#fff">M</text>
  </svg>
`;

const STYLES = `
  #${HUD_ID} {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 60;
    display: grid;
    grid-template-columns: 36px minmax(0, auto);
    align-items: center;
    gap: 9px;
    min-width: 132px;
    padding: 9px 12px 9px 9px;
    border: 1px solid rgba(196,181,253,.34);
    border-radius: 16px;
    background:
      radial-gradient(circle at 20% 20%, rgba(168,85,247,.16), transparent 58%),
      rgba(2,6,23,.84);
    color: #f8fafc;
    box-shadow:
      0 16px 38px rgba(0,0,0,.32),
      inset 0 1px 0 rgba(255,255,255,.05);
    backdrop-filter: blur(12px) saturate(1.08);
    -webkit-backdrop-filter: blur(12px) saturate(1.08);
    pointer-events: none;
    transform-origin: top right;
  }

  #${HUD_ID}.miz-pop {
    animation: mizCounterPop 340ms ease;
  }

  .miz-hud-coin,
  .myst-price-coin,
  .myst-wallet-coin {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
  }

  .miz-hud-coin {
    width: 36px;
    height: 36px;
  }

  .miz-hud-coin svg,
  .myst-wallet-coin svg,
  .myst-price-coin svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .miz-hud-copy {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .miz-hud-line {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .miz-hud-balance {
    font-size: 20px;
    font-weight: 950;
    letter-spacing: -.04em;
    line-height: 1;
  }

  .miz-hud-label {
    color: #c4b5fd;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .miz-hud-progress {
    color: #94a3b8;
    font-size: 9px;
    font-weight: 800;
    white-space: nowrap;
  }

  .miz-hud-earned {
    position: absolute;
    right: 8px;
    bottom: -4px;
    color: #faf5ff;
    font-size: 12px;
    font-weight: 950;
    text-shadow: 0 0 8px rgba(168,85,247,.9), 0 2px 6px rgba(0,0,0,.8);
    opacity: 0;
  }

  .miz-hud-earned.show {
    animation: mizEarnFloat 900ms ease forwards;
  }

  #${SHOP_ID} {
    width: 100%;
    display: grid;
    gap: 20px;
    padding: clamp(18px, 2.8vw, 28px);
    border-radius: 24px;
    border: 1px solid rgba(168,85,247,.24);
    background:
      radial-gradient(circle at 14% 0%, rgba(148,163,184,.13), transparent 28%),
      radial-gradient(circle at 84% 12%, rgba(168,85,247,.16), transparent 30%),
      linear-gradient(180deg, rgba(9,9,20,.96), rgba(2,6,23,.96));
    color: #e2e8f0;
    box-shadow: 0 24px 72px rgba(0,0,0,.28);
  }

  .myst-shop-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 20px;
    align-items: start;
  }

  .myst-shop-kicker {
    color: #c084fc;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: .18em;
    text-transform: uppercase;
  }

  .myst-shop-title {
    margin: 6px 0 0;
    color: #f8fafc;
    font-size: clamp(26px, 3vw, 40px);
    line-height: 1;
    font-weight: 950;
    letter-spacing: -.045em;
  }

  .myst-shop-subtitle {
    max-width: 760px;
    margin: 10px 0 0;
    color: #94a3b8;
    font-size: 13px;
    line-height: 1.5;
  }

  .myst-wallet {
    display: grid;
    justify-items: end;
    gap: 6px;
  }

  .myst-wallet-main {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 10px 13px;
    border: 1px solid rgba(203,213,225,.18);
    border-radius: 15px;
    background: rgba(15,23,42,.76);
  }

  .myst-wallet-coin {
    width: 28px;
    height: 28px;
  }

  .myst-wallet-number {
    color: #f8fafc;
    font-size: 25px;
    line-height: 1;
    font-weight: 950;
    letter-spacing: -.045em;
  }

  .myst-wallet-label {
    color: #c4b5fd;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .myst-wallet-progress {
    color: #64748b;
    font-size: 10px;
    font-weight: 800;
  }

  .myst-shopkeeper-row {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr);
    gap: 20px;
    align-items: center;
  }

  .myst-entity {
    position: relative;
    width: 170px;
    height: 170px;
    justify-self: center;
    filter: drop-shadow(0 14px 26px rgba(0,0,0,.34));
  }

  .myst-core,
  .myst-ring {
    position: absolute;
    left: 50%;
    top: 50%;
    border-radius: 50%;
  }

  .myst-core {
    width: 72px;
    height: 72px;
    margin: -36px;
    background:
      radial-gradient(circle at 38% 34%, #f8fafc 0 7%, #c4b5fd 19%, #8b5cf6 48%, #64748b 73%, rgba(71,85,105,.08) 100%);
    box-shadow:
      0 0 30px rgba(168,85,247,.26),
      0 0 60px rgba(148,163,184,.14);
    animation: mystCorePulse 3.2s ease-in-out infinite;
  }

  .myst-core::before,
  .myst-core::after {
    content: "";
    position: absolute;
    top: 28px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f8fafc;
    box-shadow: 0 0 9px rgba(255,255,255,.7);
  }

  .myst-core::before { left: 19px; }
  .myst-core::after { right: 19px; }

  .myst-ring {
    border-style: solid;
    border-color: rgba(196,181,253,.42);
  }

  .myst-ring.one {
    width: 140px;
    height: 62px;
    margin: -31px -70px;
    border-width: 5px;
    transform: rotate(-18deg);
    animation: mystRingOne 5.4s linear infinite;
  }

  .myst-ring.two {
    width: 84px;
    height: 152px;
    margin: -76px -42px;
    border-width: 4px;
    border-color: rgba(148,163,184,.38);
    transform: rotate(27deg);
    animation: mystRingTwo 7s linear infinite;
  }

  .myst-ring.three {
    width: 112px;
    height: 112px;
    margin: -56px;
    border-width: 2px;
    border-style: dashed;
    border-color: rgba(168,85,247,.36);
    animation: mystRingThree 9s linear infinite;
  }

  .myst-dialogue {
    display: grid;
    gap: 10px;
  }

  .myst-name {
    color: #e9d5ff;
    font-size: 18px;
    font-weight: 950;
  }

  .myst-quote {
    max-width: 760px;
    color: #cbd5e1;
    font-size: 13px;
    line-height: 1.55;
  }

  .myst-rule {
    padding: 11px 13px;
    border: 1px solid rgba(148,163,184,.14);
    border-radius: 13px;
    background: rgba(15,23,42,.62);
    color: #d8b4fe;
    font-size: 11px;
    font-weight: 850;
  }

  .myst-shop-message {
    min-height: 18px;
    color: #c4b5fd;
    font-size: 11px;
    font-weight: 850;
  }

  .myst-items {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .myst-item {
    min-width: 0;
    display: grid;
    gap: 10px;
    padding: 15px;
    border: 1px solid rgba(148,163,184,.13);
    border-radius: 17px;
    background: rgba(15,23,42,.68);
  }

  .myst-item-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .myst-item-rarity {
    color: #a78bfa;
    font-size: 8px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .myst-item-name {
    margin-top: 4px;
    color: #f8fafc;
    font-size: 14px;
    line-height: 1.15;
    font-weight: 950;
  }

  .myst-price {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #e2e8f0;
    font-size: 12px;
    font-weight: 950;
    white-space: nowrap;
  }

  .myst-price-coin {
    width: 16px;
    height: 16px;
  }

  .myst-item-description {
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.42;
  }

  .myst-item-effect {
    min-height: 44px;
    color: #e9d5ff;
    font-size: 11px;
    line-height: 1.4;
  }

  .myst-buy {
    width: 100%;
    min-height: 40px;
    margin-top: auto;
    padding: 8px 10px;
    border: 1px solid rgba(168,85,247,.3);
    border-radius: 11px;
    background: linear-gradient(135deg, rgba(88,28,135,.82), rgba(76,29,149,.66));
    color: #faf5ff;
    font: inherit;
    font-size: 11px;
    font-weight: 950;
    cursor: pointer;
  }

  .myst-buy:disabled {
    opacity: .42;
    cursor: not-allowed;
  }

  @keyframes mizCounterPop {
    0% { transform: scale(1); }
    38% { transform: scale(1.1) rotate(-1deg); }
    100% { transform: scale(1); }
  }

  @keyframes mizEarnFloat {
    0% { opacity: 0; transform: translateY(4px) scale(.9); }
    18% { opacity: 1; transform: translateY(-3px) scale(1); }
    100% { opacity: 0; transform: translateY(-28px) scale(1.04); }
  }

  @keyframes mystCorePulse {
    0%, 100% { transform: scale(.96); filter: brightness(.96); }
    50% { transform: scale(1.06); filter: brightness(1.12); }
  }

  @keyframes mystRingOne {
    from { transform: rotate(-18deg); }
    to { transform: rotate(342deg); }
  }

  @keyframes mystRingTwo {
    from { transform: rotate(27deg); }
    to { transform: rotate(-333deg); }
  }

  @keyframes mystRingThree {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 1250px) {
    .myst-items {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 820px) {
    .myst-shop-head,
    .myst-shopkeeper-row {
      grid-template-columns: 1fr;
    }

    .myst-wallet {
      justify-items: start;
    }

    .myst-items {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 560px) {
    #${HUD_ID} {
      top: 9px;
      right: 9px;
      min-width: 112px;
      padding: 7px 9px 7px 7px;
    }

    .miz-hud-coin {
      width: 30px;
      height: 30px;
    }

    .myst-items {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .myst-core,
    .myst-ring,
    #${HUD_ID}.miz-pop,
    .miz-hud-earned.show {
      animation: none !important;
    }
  }
`;

let activeWorld = null;
let lastDiscoveredFloor = 0;
let audioContext = null;
let shopMessage = "";
let shopMessageTimer = 0;

function ensureStyles() {
  if (
    typeof document === "undefined" ||
    document.getElementById(STYLE_ID)
  ) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.append(style);
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

  audioContext = new AudioContextClass();
  return audioContext;
}

async function unlockAudio() {
  const context = getAudioContext();

  if (context?.state === "suspended") {
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
  const context = getAudioContext();

  if (!context || context.state !== "running") {
    return;
  }

  const oscillator = context.createOscillator();
  const volume = context.createGain();
  const start = context.currentTime + startOffset;
  const end = start + duration;

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(
    gain,
    start + 0.012,
  );
  volume.gain.exponentialRampToValueAtTime(
    0.0001,
    end,
  );

  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

function playMizEarnedSound(count = 1) {
  void unlockAudio().then(() => {
    playTone(660, 0, 0.09, 0.055, "triangle");
    playTone(880, 0.07, 0.11, 0.05);

    if (count > 1) {
      playTone(1100, 0.15, 0.12, 0.045);
    }
  });
}

function playPurchaseSound() {
  void unlockAudio().then(() => {
    playTone(392, 0, 0.1, 0.04, "triangle");
    playTone(523.25, 0.06, 0.12, 0.045, "triangle");
    playTone(659.25, 0.12, 0.16, 0.04);
  });
}

function playErrorSound() {
  void unlockAudio().then(() => {
    playTone(180, 0, 0.12, 0.04, "square");
    playTone(145, 0.08, 0.14, 0.035, "square");
  });
}

function bindAudioUnlock() {
  const unlock = () => {
    void unlockAudio();
  };

  window.addEventListener(
    "pointerdown",
    unlock,
    { once: true, capture: true },
  );

  window.addEventListener(
    "keydown",
    unlock,
    { once: true, capture: true },
  );
}

function getDiscoveredFloor(world) {
  const value =
    Number(
      world?.player?.discoveredFloor,
    );

  return Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function registerWorld(world) {
  activeWorld = world;

  // Starting visibility becomes the baseline, preventing restart farming.
  lastDiscoveredFloor =
    getDiscoveredFloor(world);

  applyMystPurchasesToWorld(world);
}

function ensureHud() {
  const mazeFrame =
    document.querySelector(".maze-frame");

  if (
    !(mazeFrame instanceof HTMLElement)
  ) {
    document.getElementById(HUD_ID)?.remove();
    return null;
  }

  let hud = mazeFrame.querySelector(`#${HUD_ID}`);

  if (!hud) {
    hud = document.createElement("aside");
    hud.id = HUD_ID;
    hud.setAttribute("aria-label", "Miz balance");
    hud.innerHTML = `
      <div class="miz-hud-coin">${COIN_SVG}</div>
      <div class="miz-hud-copy">
        <div class="miz-hud-line">
          <span class="miz-hud-balance">0</span>
          <span class="miz-hud-label">Miz</span>
        </div>
        <div class="miz-hud-progress">43 tiles to next miz</div>
      </div>
      <div class="miz-hud-earned">+1</div>
    `;
    mazeFrame.append(hud);
  }

  return hud;
}

function updateHud(state, mizEarned = 0) {
  const hud = ensureHud();

  if (!hud) {
    return;
  }

  const balance =
    hud.querySelector(".miz-hud-balance");
  const progress =
    hud.querySelector(".miz-hud-progress");
  const earned =
    hud.querySelector(".miz-hud-earned");

  if (balance) {
    balance.textContent = String(state.miz);
  }

  if (progress) {
    progress.textContent =
      `${getTilesUntilNextMiz(state)} tiles to next miz`;
  }

  if (mizEarned > 0 && earned) {
    earned.textContent = `+${mizEarned}`;

    hud.classList.remove("miz-pop");
    earned.classList.remove("show");

    void hud.offsetWidth;

    hud.classList.add("miz-pop");
    earned.classList.add("show");

    window.setTimeout(() => {
      hud.classList.remove("miz-pop");
      earned.classList.remove("show");
    }, 950);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getItemMarkup(item, state) {
  const owned = isItemOwned(item.key, state);
  const canAfford = state.miz >= item.price;

  let buttonLabel = "Buy from Myst";

  if (owned) {
    buttonLabel = "Owned";
  } else if (!canAfford) {
    buttonLabel =
      `Need ${item.price - state.miz} more miz`;
  }

  return `
    <article class="myst-item">
      <div class="myst-item-top">
        <div>
          <div class="myst-item-rarity">${escapeHtml(item.rarity)}</div>
          <div class="myst-item-name">${escapeHtml(item.name)}</div>
        </div>
        <div class="myst-price">
          <span class="myst-price-coin">${COIN_SVG}</span>
          ${item.price}
        </div>
      </div>

      <div class="myst-item-description">
        ${escapeHtml(item.description)}
      </div>

      <div class="myst-item-effect">
        ${escapeHtml(item.effectLabel)}
      </div>

      <button
        type="button"
        class="myst-buy"
        data-miz-buy="${escapeHtml(item.key)}"
        ${owned || !canAfford ? "disabled" : ""}
      >
        ${escapeHtml(buttonLabel)}
      </button>
    </article>
  `;
}

function setShopMessage(message) {
  shopMessage = message;

  if (shopMessageTimer) {
    window.clearTimeout(shopMessageTimer);
  }

  shopMessageTimer =
    window.setTimeout(() => {
      shopMessage = "";
      renderShop(loadMizState());
    }, 3200);
}

function renderShop(state = loadMizState()) {
  const shop = document.getElementById(SHOP_ID);

  if (!shop) {
    return;
  }

  shop.innerHTML = `
    <div class="myst-shop-head">
      <div>
        <div class="myst-shop-kicker">Myst's Store</div>
        <h2 class="myst-shop-title">Trade miz with Myst</h2>
        <p class="myst-shop-subtitle">
          Myst drifts between maze layers carrying practical objects.
          Miz are gray eight-pit coins stamped with an M.
          Every ${MIZ_TILES_PER_COIN} newly explored floor tiles earns one miz.
        </p>
      </div>

      <div class="myst-wallet">
        <div class="myst-wallet-main">
          <span class="myst-wallet-coin">${COIN_SVG}</span>
          <span class="myst-wallet-number">${state.miz}</span>
          <span class="myst-wallet-label">Miz</span>
        </div>
        <div class="myst-wallet-progress">
          ${getTilesUntilNextMiz(state)} tiles until next miz ·
          ${state.lifetimeMizEarned} earned total
        </div>
      </div>
    </div>

    <div class="myst-shopkeeper-row">
      <div
        class="myst-entity"
        role="img"
        aria-label="Myst, a swirling gray and purple entity"
      >
        <div class="myst-ring one"></div>
        <div class="myst-ring two"></div>
        <div class="myst-ring three"></div>
        <div class="myst-core"></div>
      </div>

      <div class="myst-dialogue">
        <div class="myst-name">MYST</div>
        <div class="myst-quote">
          “The maze remembers where you have been.
          I remember what it owes you.”
        </div>
        <div class="myst-rule">
          Explore naturally. Partial progress carries between runs,
          so every 43 tiles eventually becomes one miz.
          Purchased objects are permanent.
        </div>
        <div class="myst-shop-message" aria-live="polite">
          ${escapeHtml(shopMessage)}
        </div>
      </div>
    </div>

    <div class="myst-items">
      ${MYST_SHOP_ITEMS
        .map((item) => getItemMarkup(item, state))
        .join("")}
    </div>
  `;
}

function bindShopEvents(shop) {
  if (shop.dataset.mizEventsBound === "true") {
    return;
  }

  shop.dataset.mizEventsBound = "true";

  shop.addEventListener("click", (event) => {
    const button =
      event.target.closest("[data-miz-buy]");

    if (
      !(button instanceof HTMLButtonElement)
    ) {
      return;
    }

    const itemKey = button.dataset.mizBuy;

    if (!itemKey) {
      return;
    }

    const result = purchaseMystItem(itemKey);

    if (result.ok) {
      setShopMessage(`${result.item.name} is yours.`);
      playPurchaseSound();
    } else {
      setShopMessage(result.error);
      playErrorSound();
    }

    renderShop(result.state);
  });
}

function ensureShop() {
  const levelGrid =
    document.querySelector(".level-choice-grid");

  if (
    !(levelGrid instanceof HTMLElement)
  ) {
    return null;
  }

  let shop = document.getElementById(SHOP_ID);

  if (!shop) {
    shop = document.createElement("section");
    shop.id = SHOP_ID;
    shop.setAttribute("aria-label", "Myst's Store");

    const leaderboard =
      document.querySelector(".level-leaderboards");

    if (leaderboard?.parentElement) {
      leaderboard.parentElement.insertBefore(
        shop,
        leaderboard,
      );
    } else {
      levelGrid.insertAdjacentElement(
        "afterend",
        shop,
      );
    }

    bindShopEvents(shop);
    renderShop(loadMizState());
  }

  return shop;
}

function processWorld() {
  const world =
    globalThis.__mistMazeWorld ?? null;

  if (!world) {
    activeWorld = null;
    lastDiscoveredFloor = 0;
    return;
  }

  if (world !== activeWorld) {
    registerWorld(world);
  }

  const discoveredFloor = getDiscoveredFloor(world);

  if (discoveredFloor < lastDiscoveredFloor) {
    lastDiscoveredFloor = discoveredFloor;
    return;
  }

  const newlyExplored =
    discoveredFloor - lastDiscoveredFloor;

  lastDiscoveredFloor = discoveredFloor;

  if (newlyExplored <= 0) {
    updateHud(loadMizState());
    return;
  }

  const result = addExploredTiles(newlyExplored);

  updateHud(result.state, result.mizEarned);

  if (result.mizEarned > 0) {
    playMizEarnedSound(result.mizEarned);

    if (!world.gameOver && !world.victory) {
      world.message =
        result.mizEarned === 1
          ? "Miz earned — 43 explored tiles"
          : `${result.mizEarned} miz earned`;
      world.messageTtl = 1.35;
    }
  }
}

function refreshUi() {
  ensureShop();
  updateHud(loadMizState());
}

export function installMizEconomyEnhancement() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    globalThis[INSTALLED_KEY]
  ) {
    return;
  }

  globalThis[INSTALLED_KEY] = true;

  ensureStyles();
  bindAudioUnlock();

  window.addEventListener(
    MIZ_STATE_CHANGED_EVENT,
    (event) => {
      const state =
        event.detail?.state ??
        loadMizState();

      updateHud(state);

      if (document.getElementById(SHOP_ID)) {
        renderShop(state);
      }
    },
  );

  window.setInterval(() => {
    processWorld();
    refreshUi();
  }, CHECK_INTERVAL_MS);

  processWorld();
  refreshUi();
}
