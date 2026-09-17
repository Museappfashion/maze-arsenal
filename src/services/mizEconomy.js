// src/services/mizEconomy.js
import { MAX_AMMO } from "../config/ammo.js";

export const MIZ_TILES_PER_COIN = 43;
export const MIZ_STATE_CHANGED_EVENT = "mist-maze-miz-state-changed";

const STORAGE_KEY = "mist-maze-miz-economy-v1";

export const MYST_SHOP_ITEMS = Object.freeze([
  Object.freeze({
    key: "fieldWrap",
    name: "Reinforced Field Wrap",
    price: 18,
    rarity: "Common",
    description: "Waxed medical cloth, clean gauze, and a compact trauma dressing.",
    effectLabel: "+15 starting and maximum HP",
  }),
  Object.freeze({
    key: "ammoSatchel",
    name: "Canvas Ammo Satchel",
    price: 24,
    rarity: "Common",
    description: "A weathered shoulder bag with organized loops for spare ammunition.",
    effectLabel: "+14 starting ammo",
  }),
  Object.freeze({
    key: "crowbarRig",
    name: "Crowbar Carry Rig",
    price: 32,
    rarity: "Uncommon",
    description: "A leather-and-canvas back sling with a restored steel crowbar.",
    effectLabel: "Start combat mazes with the Crowbar unlocked",
  }),
  Object.freeze({
    key: "trailBoots",
    name: "Trail Boots",
    price: 46,
    rarity: "Uncommon",
    description: "Light boots with reinforced toes and high-grip soles.",
    effectLabel: "+6% movement speed",
  }),
  Object.freeze({
    key: "pistolCase",
    name: "Sealed Pistol Case",
    price: 68,
    rarity: "Rare",
    description: "A foam-lined hard case containing a maintained sidearm and one spare box.",
    effectLabel: "Start combat mazes with the Pistol unlocked and +8 ammo",
  }),
]);

const DEFAULT_STATE = Object.freeze({
  miz: 0,
  tileRemainder: 0,
  lifetimeExploredTiles: 0,
  lifetimeMizEarned: 0,
  owned: {},
});

let memoryState = { ...DEFAULT_STATE, owned: {} };

function nonNegativeInt(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function sanitizeState(value) {
  const allowed = new Set(MYST_SHOP_ITEMS.map((item) => item.key));
  const owned =
    value?.owned && typeof value.owned === "object"
      ? Object.fromEntries(
          Object.entries(value.owned)
            .filter(([key, isOwned]) => allowed.has(key) && Boolean(isOwned))
            .map(([key]) => [key, true]),
        )
      : {};

  return {
    miz: nonNegativeInt(value?.miz),
    tileRemainder: Math.min(
      MIZ_TILES_PER_COIN - 1,
      nonNegativeInt(value?.tileRemainder),
    ),
    lifetimeExploredTiles: nonNegativeInt(value?.lifetimeExploredTiles),
    lifetimeMizEarned: nonNegativeInt(value?.lifetimeMizEarned),
    owned,
  };
}

function dispatchState(state, detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MIZ_STATE_CHANGED_EVENT, {
      detail: { state, ...detail },
    }),
  );
}

export function loadMizState() {
  if (typeof window === "undefined") return sanitizeState(memoryState);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) memoryState = sanitizeState(JSON.parse(raw));
  } catch {
    // Use memoryState when browser storage is unavailable.
  }
  return sanitizeState(memoryState);
}

export function saveMizState(nextState, detail = {}) {
  memoryState = sanitizeState(nextState);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
    } catch {
      // Persistence is optional; in-memory state still works.
    }
  }
  const saved = sanitizeState(memoryState);
  dispatchState(saved, detail);
  return saved;
}

export function addExploredTiles(tileCount) {
  const tiles = nonNegativeInt(tileCount);
  const current = loadMizState();

  if (!tiles) {
    return { state: current, mizEarned: 0, tilesAdded: 0 };
  }

  const progress = current.tileRemainder + tiles;
  const mizEarned = Math.floor(progress / MIZ_TILES_PER_COIN);

  const state = saveMizState(
    {
      ...current,
      miz: current.miz + mizEarned,
      tileRemainder: progress % MIZ_TILES_PER_COIN,
      lifetimeExploredTiles: current.lifetimeExploredTiles + tiles,
      lifetimeMizEarned: current.lifetimeMizEarned + mizEarned,
    },
    { reason: "tiles", mizEarned, tilesAdded: tiles },
  );

  return { state, mizEarned, tilesAdded: tiles };
}

export function getTilesUntilNextMiz(state = loadMizState()) {
  return MIZ_TILES_PER_COIN - nonNegativeInt(state.tileRemainder);
}

export function isItemOwned(itemKey, state = loadMizState()) {
  return Boolean(state.owned?.[itemKey]);
}

export function purchaseMystItem(itemKey) {
  const item = MYST_SHOP_ITEMS.find((candidate) => candidate.key === itemKey);
  const current = loadMizState();

  if (!item) {
    return { ok: false, error: "Myst cannot find that item.", state: current, item: null };
  }
  if (isItemOwned(itemKey, current)) {
    return { ok: false, error: "You already own that object.", state: current, item };
  }
  if (current.miz < item.price) {
    return {
      ok: false,
      error: `You need ${item.price - current.miz} more miz.`,
      state: current,
      item,
    };
  }

  const state = saveMizState(
    {
      ...current,
      miz: current.miz - item.price,
      owned: { ...current.owned, [itemKey]: true },
    },
    { reason: "purchase", itemKey },
  );

  return { ok: true, error: "", state, item };
}

function addHp(world, amount) {
  world.player.baseMaxHp = Math.max(1, Number(world.player.baseMaxHp) || 100) + amount;
  world.player.maxHp = Math.max(
    world.player.baseMaxHp,
    (Number(world.player.maxHp) || 100) + amount,
  );
  world.player.hp = Math.min(
    world.player.maxHp,
    (Number(world.player.hp) || 0) + amount,
  );
}

function addAmmo(world, amount) {
  world.player.ammo = Math.min(
    MAX_AMMO,
    Math.max(0, Math.floor((Number(world.player.ammo) || 0) + amount)),
  );
}

function unlockWeapon(world, weaponKey) {
  world.player.ownedWeapons ??= {};
  world.player.ownedWeapons[weaponKey] = true;
}

export function applyMystPurchasesToWorld(world, state = loadMizState()) {
  if (!world?.player || world.__mystPurchasesApplied) return false;
  world.__mystPurchasesApplied = true;

  let changed = false;

  if (!world.labyrinthMode && isItemOwned("fieldWrap", state)) {
    addHp(world, 15);
    changed = true;
  }
  if (!world.labyrinthMode && isItemOwned("ammoSatchel", state)) {
    addAmmo(world, 14);
    changed = true;
  }
  if (!world.labyrinthMode && isItemOwned("crowbarRig", state)) {
    unlockWeapon(world, "crowbar");
    changed = true;
  }
  if (isItemOwned("trailBoots", state)) {
    world.player.speed = Math.max(0.1, (Number(world.player.speed) || 0) * 1.06);
    changed = true;
  }
  if (!world.labyrinthMode && isItemOwned("pistolCase", state)) {
    unlockWeapon(world, "pistol");
    addAmmo(world, 8);
    changed = true;
  }

  if (changed && !world.labyrinthMode) {
    world.leaderboardEligible = false;
    world.message = "Myst gear equipped — leaderboard disabled for this run";
    world.messageTtl = 2.6;
  }

  return changed;
}
