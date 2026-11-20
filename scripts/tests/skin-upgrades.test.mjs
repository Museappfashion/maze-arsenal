import assert from "node:assert/strict";
import test from "node:test";
import { COSMETIC_UPGRADE_PRICE, MAX_COSMETIC_UPGRADES, getCosmeticUpgradeLevel } from "../../src/config/cosmeticPerks.js";
import { buyCharacterCosmetic, getPlayerCosmeticUpgradeForTheme, loadCharacterCosmeticState, setCharacterCosmeticEquipped, upgradeCharacterCosmetic } from "../../src/services/characterCosmetics.js";
import { HUX_STORAGE_KEY, loadHuxState } from "../../src/services/huxEconomy.js";
import { addExploredTiles, consumeOneTimeItem, loadMizState, purchaseMystItem, saveMizState } from "../../src/services/mizEconomy.js";
import { createWorld, setWorldViewMode } from "../../src/game/world.js";

const MIZ_STORAGE_KEY = "mist-maze-miz-economy-v3";
const SKINS = ["turkey", "alien", "shadowWisp", "emberSpirit", "crystalGuardian"];
const owned = (...keys) => Object.fromEntries(keys.map(key => [key, true]));

async function withBrowser(run) {
  const keys = ["window", "localStorage", "CustomEvent"];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const data = new Map([[HUX_STORAGE_KEY, JSON.stringify({ hux: 75000, cosmetics: {}, inventory: {} })]]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
  const events = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: { localStorage: storage, dispatchEvent: event => { events.push(event); return true; } } });
  if (typeof globalThis.CustomEvent !== "function") Object.defineProperty(globalThis, "CustomEvent", { configurable: true, writable: true, value: class extends Event { constructor(type, options) { super(type); this.detail = options?.detail; } } });
  try {
    saveMizState({ legacyTurkeyMigrated: true });
    loadHuxState();
    return await run({ data, storage, events });
  } finally {
    for (const key of keys) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test("each of five owned skins has three independent upgrades costing exactly 10000 MIZ each", async () => withBrowser(() => {
  assert.equal(COSMETIC_UPGRADE_PRICE, 10000); assert.equal(MAX_COSMETIC_UPGRADES, 3);
  saveMizState({ miz: 180000, cosmetics: owned(...SKINS), equippedCharacter: "alien", legacyTurkeyMigrated: true });
  const originalHux = loadHuxState();
  let spent = 0;
  for (const skin of SKINS) for (let level = 1; level <= 3; level++) {
    const before = loadMizState(), result = upgradeCharacterCosmetic(skin);
    assert.equal(result.ok, true, `${skin} upgrade ${level}`); assert.ok(result.message);
    spent += 10000;
    assert.equal(result.state.miz, 180000 - spent);
    assert.equal(result.state.cosmeticUpgrades[skin], level);
    assert.equal(result.state.equippedCharacter, "alien", "upgrading another skin does not equip it");
    assert.deepEqual(result.state.cosmetics, before.cosmetics, "buff upgrades do not repurchase or remove skins");
    for (const other of SKINS.filter(key => key !== skin)) assert.equal(result.state.cosmeticUpgrades[other], before.cosmeticUpgrades[other], `${other}'s upgrades stay independent`);
    assert.deepEqual(loadHuxState(), originalHux, "including Turkey upgrades never charge hux");
  }
  assert.deepEqual(loadMizState().cosmeticUpgrades, Object.fromEntries(SKINS.map(key => [key, 3])));
}));

test("unknown, non-character, unowned, unaffordable and maxed upgrades reject without spending", async () => withBrowser(() => {
  for (const scenario of [
    { key: "unknownSkin", cosmetics: owned("alien"), miz: 50000 },
    { key: "violetCoinEdge", cosmetics: owned("violetCoinEdge"), miz: 50000 },
    { key: "alien", cosmetics: {}, miz: 50000 },
    { key: "alien", cosmetics: owned("alien"), miz: 9999 },
    { key: "alien", cosmetics: owned("alien"), miz: 50000, cosmeticUpgrades: { alien: 3 } },
    { key: "alien", cosmetics: owned("alien"), miz: 0, cosmeticUpgrades: { alien: 3 } },
  ]) {
    saveMizState({ ...scenario, legacyTurkeyMigrated: true });
    const before = loadMizState(), hux = loadHuxState(), result = upgradeCharacterCosmetic(scenario.key);
    assert.equal(result.ok, false); assert.ok(result.message);
    assert.deepEqual(loadMizState(), before, "failed transactions preserve the complete MIZ wallet");
    assert.deepEqual(loadHuxState(), hux);
  }
  saveMizState({ miz: 10000, cosmetics: owned("alien"), legacyTurkeyMigrated: true });
  assert.equal(upgradeCharacterCosmetic("alien").ok, true);
  assert.equal(loadMizState().miz, 0, "the exact price is sufficient");
  assert.equal(upgradeCharacterCosmetic("alien").ok, false);
  assert.equal(loadMizState().cosmeticUpgrades.alien, 1, "an empty wallet cannot gain another tier");
}));

test("legacy Turkey ownership in the hux wallet permits MIZ upgrades without another skin charge", async () => withBrowser(({ data }) => {
  data.set(HUX_STORAGE_KEY, JSON.stringify({ hux: 357, cosmetics: { turkey: true }, equippedCosmetic: "turkey", inventory: {} }));
  saveMizState({ miz: 20000, cosmetics: {}, legacyTurkeyMigrated: false });
  const result = upgradeCharacterCosmetic("turkey");
  assert.equal(result.ok, true); assert.equal(result.state.miz, 10000);
  assert.equal(result.state.cosmeticUpgrades.turkey, 1); assert.equal(result.state.cosmetics.turkey, true);
  assert.equal(result.state.equippedCharacter, "turkey"); assert.equal(result.state.legacyTurkeyMigrated, true);
  assert.equal(loadHuxState().hux, 357);
  loadCharacterCosmeticState();
  assert.equal(loadMizState().cosmeticUpgrades.turkey, 1, "repeated legacy migration preserves the paid tier");
}));

test("upgrade levels sanitize to bounded integers for owned characters and legacy saves default to none", async () => withBrowser(() => {
  for (const [raw, expected] of [[undefined, 0], [null, 0], ["2", 0], [NaN, 0], [Infinity, 0], [-1, 0], [0, 0], [1.9, 1], [2.9, 2], [3, 3], [999, 3]]) assert.equal(getCosmeticUpgradeLevel(raw), expected);
  const sanitized = saveMizState({ cosmetics: owned(...SKINS, "violetCoinEdge"), cosmeticUpgrades: { turkey: 1.9, alien: 99, shadowWisp: "2", emberSpirit: -1, crystalGuardian: Infinity, violetCoinEdge: 3, unknownSkin: 3 } });
  assert.deepEqual(sanitized.cosmeticUpgrades, { turkey: 1, alien: 3 });
  assert.deepEqual(saveMizState({ cosmetics: owned("alien"), cosmeticUpgrades: { alien: 2, turkey: 3 } }).cosmeticUpgrades, { alien: 2 }, "unowned skins cannot carry spendable tiers");
  assert.deepEqual(saveMizState({ miz: 42, cosmetics: owned("alien") }).cosmeticUpgrades, {}, "existing wallets need no migration purchase");
}));

test("paid levels survive storage reload, exploration, power purchases and equipping or buying other skins", async () => withBrowser(async ({ data }) => {
  saveMizState({ miz: 50000, cosmetics: owned("alien"), equippedCharacter: "alien", legacyTurkeyMigrated: true });
  assert.equal(upgradeCharacterCosmetic("alien").ok, true);
  assert.equal(purchaseMystItem("healPulse").ok, true);
  assert.equal(consumeOneTimeItem("healPulse").consumed, true);
  assert.equal(purchaseMystItem("violetCoinEdge").ok, true);
  addExploredTiles(43);
  assert.equal(buyCharacterCosmetic("emberSpirit").ok, true);
  assert.equal(setCharacterCosmeticEquipped(null).ok, true);
  assert.equal(setCharacterCosmeticEquipped("alien").ok, true);
  assert.deepEqual(loadMizState().cosmeticUpgrades, { alien: 1 });
  assert.deepEqual(JSON.parse(data.get(MIZ_STORAGE_KEY)).cosmeticUpgrades, { alien: 1 });
  const freshEconomyModule = await import("../../src/services/mizEconomy.js?skin-upgrade-storage-reload");
  assert.deepEqual(freshEconomyModule.loadMizState().cosmeticUpgrades, { alien: 1 }, "a new module instance reads the paid upgrade from storage");
  assert.equal(loadHuxState().hux, 75000);
}));

test("theme upgrade lookup only exposes the owned equipped skin on supported maze themes", async () => withBrowser(() => {
  for (const skin of SKINS) {
    const state = { cosmetics: owned(skin), equippedCharacter: skin, cosmeticUpgrades: { [skin]: 2 } };
    for (const theme of ["city", "space", "jungle", "medieval"]) assert.equal(getPlayerCosmeticUpgradeForTheme(theme, state), 2);
    for (const theme of [undefined, "labyrinth", "cube", "farm", "unknown"]) assert.equal(getPlayerCosmeticUpgradeForTheme(theme, state), 0);
    assert.equal(getPlayerCosmeticUpgradeForTheme("city", { ...state, cosmetics: {} }), 0);
    assert.equal(getPlayerCosmeticUpgradeForTheme("city", { ...state, equippedCharacter: null }), 0);
    assert.equal(getPlayerCosmeticUpgradeForTheme("city", { ...state, equippedCharacter: "unknownSkin" }), 0);
  }
}));

test("world creation snapshots the equipped skin and tier so later purchases and view changes do not alter an active run", async () => withBrowser(() => {
  saveMizState({ miz: 50000, cosmetics: owned("alien", "turkey"), equippedCharacter: "alien", cosmeticUpgrades: { alien: 1, turkey: 3 }, legacyTurkeyMigrated: true });
  const active = createWorld("level0", "2d", "Upgrade test");
  assert.equal(active.player.cosmetic, "alien"); assert.equal(active.player.cosmeticUpgradeLevel, 1);
  assert.equal(upgradeCharacterCosmetic("alien").ok, true);
  setWorldViewMode(active, "3d");
  assert.equal(active.player.cosmetic, "alien"); assert.equal(active.player.cosmeticUpgradeLevel, 1);
  const next = createWorld("level0", "2d", "Upgrade test");
  assert.equal(next.player.cosmetic, "alien"); assert.equal(next.player.cosmeticUpgradeLevel, 2);
  assert.equal(setCharacterCosmeticEquipped("turkey").ok, true);
  assert.equal(active.player.cosmetic, "alien"); assert.equal(active.player.cosmeticUpgradeLevel, 1);
  const turkey = createWorld("level0", "2d", "Upgrade test");
  assert.equal(turkey.player.cosmetic, "turkey"); assert.equal(turkey.player.cosmeticUpgradeLevel, 3);
}));
