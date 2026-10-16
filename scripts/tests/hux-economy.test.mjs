import assert from "node:assert/strict";
import test from "node:test";
import { FARM_POWERUPS } from "../../src/config/thanksgiving.js";
import { activateThanksgivingPower, createThanksgivingWorld } from "../../src/game/thanksgiving.js";
import { isThanksgivingOpen, THANKSGIVING_DATE_LABEL, THANKSGIVING_EVENT_YEAR, thanksgivingDate } from "../../src/services/thanksgivingSeason.js";

const HUX_KEY = "mist-maze-thanksgiving-hux-v1";
const MIZ_KEY = "mist-maze-miz-economy-v3";
const emptyInventory = () => Object.fromEntries(FARM_POWERUPS.map(({ id }) => [id, 0]));
const emptyState = () => ({ hux: 0, bestRescued: 0, totalRescued: 0, inventory: emptyInventory(), cosmetics: {}, equippedCosmetic: null });
let instance = 0;
const freshEconomy = () => import(`../../src/services/huxEconomy.js?hux-test=${++instance}`);

function browserStorage(t, initial = {}) {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map(Object.entries(initial));
  const writes = [];
  const events = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { writes.push([key, value]); values.set(key, value); },
    removeItem: (key) => values.delete(key),
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage, dispatchEvent: (event) => events.push(event) } });
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else delete globalThis.localStorage;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
  });
  return { values, writes, events, storage };
}

test("a new farm wallet is empty and farming never changes the existing miz economy", async (t) => {
  const miz = { miz: 731, tileRemainder: 29, lifetimeExploredTiles: 258, lifetimeMizEarned: 6, cosmetics: { violetRim: true }, consumables: { healPulse: 2 } };
  const rawMiz = JSON.stringify(miz);
  const { values, writes, events } = browserStorage(t, { [MIZ_KEY]: rawMiz });
  const economy = await freshEconomy();
  assert.deepEqual(economy.loadHuxState(), emptyState());
  economy.earnHux(80);
  assert.equal(economy.buyFarmSupply("speed").ok, true);
  economy.recordTurkeyRescues(3, 3);
  economy.saveFarmInventory({ speed: 0, stun: 2 });
  assert.equal(values.get(MIZ_KEY), rawMiz);
  assert.ok(writes.length > 0);
  assert.ok(writes.every(([key]) => key === HUX_KEY));
  assert.ok(events.every((event) => event.type === economy.HUX_UPDATED_EVENT));
});

test("insufficient funds and unknown supplies leave the wallet and storage unchanged", async (t) => {
  const { values, writes, events } = browserStorage(t, { [HUX_KEY]: JSON.stringify({ hux: 3 }) });
  const economy = await freshEconomy();
  const before = economy.loadHuxState();
  const serialized = values.get(HUX_KEY);
  for (const id of [...FARM_POWERUPS.map((item) => item.id), "missing", "__proto__", undefined]) {
    const result = economy.buyFarmSupply(id);
    assert.equal(result.ok, false, String(id));
    assert.deepEqual(result.state, before);
  }
  assert.match(economy.buyFarmSupply("speed").message, /9 more hux/);
  assert.equal(values.get(HUX_KEY), serialized);
  assert.equal(writes.length, 0);
  assert.equal(events.length, 0);
});

test("every supply purchases for its listed price, survives reload, and stays consumed on the next run", async (t) => {
  browserStorage(t);
  const economy = await freshEconomy();
  const budget = FARM_POWERUPS.reduce((sum, item) => sum + item.price, 0);
  economy.earnHux(budget);
  let remaining = budget;
  for (const item of FARM_POWERUPS) {
    const result = economy.buyFarmSupply(item.id);
    remaining -= item.price;
    assert.equal(result.ok, true);
    assert.equal(result.state.hux, remaining);
    assert.equal(result.state.inventory[item.id], 1);
  }
  const reloaded = await freshEconomy();
  assert.equal(reloaded.loadHuxState().hux, 0);
  const world = createThanksgivingWorld({ inventory: reloaded.loadHuxState().inventory });
  for (const item of FARM_POWERUPS) {
    assert.equal(world.inventory[item.id], 1);
    assert.equal(activateThanksgivingPower(world, item.id), true);
    reloaded.saveFarmInventory(world.inventory);
  }
  const nextSession = await freshEconomy();
  assert.deepEqual(nextSession.loadHuxState().inventory, emptyInventory());
  const nextWorld = createThanksgivingWorld({ inventory: nextSession.loadHuxState().inventory });
  for (const item of FARM_POWERUPS) assert.equal(activateThanksgivingPower(nextWorld, item.id), false);
});

test("unused purchases survive reads and returned inventory snapshots cannot mutate saved state", async (t) => {
  browserStorage(t);
  const economy = await freshEconomy();
  economy.earnHux(100);
  economy.buyFarmSupply("teleport");
  const snapshot = economy.loadHuxState();
  snapshot.hux = 0;
  snapshot.inventory.teleport = 90;
  assert.equal(economy.loadHuxState().hux, 76);
  assert.equal(economy.loadHuxState().inventory.teleport, 1);
  const reloaded = await freshEconomy();
  assert.equal(reloaded.loadHuxState().inventory.teleport, 1);
});

test("inventory reaches 99 but a full bag refuses purchases without spending hux", async (t) => {
  const inventory = Object.fromEntries(FARM_POWERUPS.map(({ id }) => [id, 98]));
  const { writes } = browserStorage(t, { [HUX_KEY]: JSON.stringify({ hux: 1_000, inventory }) });
  const economy = await freshEconomy();
  for (const item of FARM_POWERUPS) {
    assert.equal(economy.buyFarmSupply(item.id).state.inventory[item.id], 99);
    const before = economy.loadHuxState();
    const writeCount = writes.length;
    const blocked = economy.buyFarmSupply(item.id);
    assert.equal(blocked.ok, false);
    assert.match(blocked.message, /full/);
    assert.deepEqual(blocked.state, before);
    assert.equal(writes.length, writeCount);
  }
  economy.saveFarmInventory({ speed: 500, stun: -3, teleport: 2.8, decoy: "4", camouflage: "bad", unknown: 12 });
  assert.deepEqual(economy.loadHuxState().inventory, { speed: 99, stun: 0, teleport: 2, decoy: 4, camouflage: 0 });
});

test("corn earnings and rescue records accumulate and persist across independent service instances", async (t) => {
  browserStorage(t);
  const economy = await freshEconomy();
  assert.equal(economy.earnHux(1).hux, 1);
  assert.equal(economy.earnHux(7).hux, 8);
  economy.recordTurkeyRescues(2, 2);
  economy.recordTurkeyRescues(3, 5);
  economy.recordTurkeyRescues(1, 1);
  const reloaded = await freshEconomy();
  assert.deepEqual(reloaded.loadHuxState(), { ...emptyState(), hux: 8, bestRescued: 5, totalRescued: 6 });
  for (const amount of [-5, NaN, undefined, "invalid"]) {
    reloaded.earnHux(amount);
    reloaded.recordTurkeyRescues(amount, amount);
  }
  assert.deepEqual(reloaded.loadHuxState(), { ...emptyState(), hux: 8, bestRescued: 5, totalRescued: 6 });
});

test("malformed JSON and non-object saves are safe, with corrupt fields normalized", async (t) => {
  const { values } = browserStorage(t);
  for (const raw of ["{broken", "null", "false", "23", '"text"', "[]"]) {
    values.set(HUX_KEY, raw);
    const economy = await freshEconomy();
    assert.deepEqual(economy.loadHuxState(), emptyState(), raw);
  }
  values.set(HUX_KEY, JSON.stringify({ hux: -7, bestRescued: "3.8", totalRescued: "nonsense", inventory: { speed: "2.7", stun: null, teleport: -8, decoy: 110, camouflage: {}, extra: 8 } }));
  const economy = await freshEconomy();
  assert.deepEqual(economy.loadHuxState(), { ...emptyState(), hux: 0, bestRescued: 3, totalRescued: 0, inventory: { speed: 2, stun: 0, teleport: 0, decoy: 99, camouflage: 0 } });
  values.set(HUX_KEY, JSON.stringify({ hux: 1e50, bestRescued: 1e50, totalRescued: 1e50 }));
  assert.deepEqual(economy.loadHuxState(), { ...emptyState(), hux: 1_000_000_000, bestRescued: 1_000_000_000, totalRescued: 1_000_000_000 });
  assert.equal(economy.earnHux(10).hux, 1_000_000_000);
});

test("unavailable browser storage keeps a usable session wallet and supply bag", async (t) => {
  const { storage, events } = browserStorage(t);
  storage.getItem = () => { throw new Error("Storage blocked"); };
  storage.setItem = () => { throw new Error("Quota exceeded"); };
  const economy = await freshEconomy();
  economy.earnHux(40);
  assert.equal(economy.buyFarmSupply("stun").ok, true);
  economy.recordTurkeyRescues(2, 2);
  assert.deepEqual(economy.loadHuxState(), { ...emptyState(), hux: 24, bestRescued: 2, totalRescued: 2, inventory: { ...emptyInventory(), stun: 1 } });
  assert.equal(events.length, 3);
});

test("a write-only storage failure preserves new earnings beyond the old saved balance", async (t) => {
  const { storage, values } = browserStorage(t, { [HUX_KEY]: JSON.stringify({ hux: 30 }) });
  storage.setItem = () => { throw new Error("Quota exceeded"); };
  const economy = await freshEconomy();
  economy.earnHux(10);
  assert.equal(economy.loadHuxState().hux, 40);
  assert.equal(economy.buyFarmSupply("stun").state.hux, 24);
  assert.equal(economy.loadHuxState().inventory.stun, 1);
  assert.equal(JSON.parse(values.get(HUX_KEY)).hux, 30);
});

test("session fallback observes external changes and persists when storage becomes writable again", async (t) => {
  const { storage, values } = browserStorage(t);
  const write = storage.setItem;
  storage.setItem = () => { throw new Error("Quota exceeded"); };
  const economy = await freshEconomy();
  economy.earnHux(12);
  assert.equal(economy.loadHuxState().hux, 12);
  values.set(HUX_KEY, JSON.stringify({ hux: 50 }));
  assert.equal(economy.loadHuxState().hux, 50);
  economy.earnHux(5);
  assert.equal(economy.loadHuxState().hux, 55);
  storage.removeItem(HUX_KEY);
  assert.deepEqual(economy.loadHuxState(), emptyState());
  economy.earnHux(7);
  storage.setItem = write;
  economy.earnHux(3);
  assert.equal(JSON.parse(values.get(HUX_KEY)).hux, 10);
  const reloaded = await freshEconomy();
  assert.equal(reloaded.loadHuxState().hux, 10);
});

test("clearing or corrupting saved data resets a live wallet instead of resurrecting old hux", async (t) => {
  const { values, storage } = browserStorage(t);
  const economy = await freshEconomy();
  economy.earnHux(100);
  economy.buyFarmSupply("speed");
  storage.removeItem(HUX_KEY);
  assert.deepEqual(economy.loadHuxState(), emptyState());
  assert.equal(economy.earnHux(1).hux, 1);
  assert.deepEqual(economy.loadHuxState().inventory, emptyInventory());
  economy.earnHux(100);
  values.set(HUX_KEY, "{corrupted");
  assert.deepEqual(economy.loadHuxState(), emptyState());
  assert.equal(economy.earnHux(2).hux, 2);
});

test("U.S. Thanksgiving is the fourth Thursday and the 2026 event includes November 26", () => {
  assert.equal(THANKSGIVING_EVENT_YEAR, 2026);
  assert.equal(THANKSGIVING_DATE_LABEL, "November 26, 2026");
  for (const [year, day] of [[2024, 28], [2025, 27], [2026, 26], [2027, 25], [2028, 23], [2029, 22], [2030, 28]]) {
    const date = thanksgivingDate(year);
    assert.equal(date.getFullYear(), year);
    assert.equal(date.getMonth(), 10);
    assert.equal(date.getDate(), day);
    assert.equal(date.getDay(), 4);
  }
  assert.equal(isThanksgivingOpen(new Date(2026, 9, 11)), true);
  assert.equal(isThanksgivingOpen(new Date(2026, 10, 26, 0, 0, 0)), true);
  assert.equal(isThanksgivingOpen(new Date(2026, 10, 26, 23, 59, 59, 999)), true);
  assert.equal(isThanksgivingOpen(new Date(2026, 10, 27, 0, 0, 0)), false);
});

test("the advertised harvest expires in 2026 and never reopens automatically next year", () => {
  for (const date of [new Date(2026, 11, 1), new Date(2027, 0, 1), new Date(2027, 10, 1), new Date(2027, 10, 25), new Date(2030, 10, 28)]) {
    assert.equal(isThanksgivingOpen(date), false, date.toString());
  }
});

test("Turkey Disguise costs exactly 1000 hux once and preserves farm progress and MIZ", async (t) => {
  const rawMiz = JSON.stringify({ miz: 123 });
  const { values, writes } = browserStorage(t, { [MIZ_KEY]: rawMiz, [HUX_KEY]: JSON.stringify({ hux: 1000, bestRescued: 8, totalRescued: 15, inventory: { speed: 3 } }) });
  const economy = await freshEconomy();
  const result = economy.buyTurkeyCosmetic();
  assert.equal(result.ok, true);
  assert.equal(result.state.hux, 0);
  assert.deepEqual(result.state.cosmetics, { turkey: true });
  assert.equal(result.state.equippedCosmetic, "turkey");
  assert.equal(result.state.bestRescued, 8);
  assert.equal(result.state.totalRescued, 15);
  assert.equal(result.state.inventory.speed, 3);
  const writeCount = writes.length;
  assert.equal(economy.buyTurkeyCosmetic().ok, false);
  assert.equal(writes.length, writeCount, "repeat purchase never spends again");
  assert.equal(values.get(MIZ_KEY), rawMiz);
  const reloaded = await freshEconomy();
  assert.deepEqual(reloaded.loadHuxState(), result.state);
});

test("unowned cosmetic cannot be equipped or bought with insufficient hux", async (t) => {
  const { writes } = browserStorage(t, { [HUX_KEY]: JSON.stringify({ hux: 999 }) });
  const economy = await freshEconomy();
  const before = economy.loadHuxState();
  assert.equal(economy.buyTurkeyCosmetic().ok, false);
  assert.equal(economy.setTurkeyCosmeticEquipped(true).ok, false);
  assert.deepEqual(economy.loadHuxState(), before);
  assert.equal(writes.length, 0);
});

test("equipping and unequipping survive reload and gameplay saves without consuming the unlock", async (t) => {
  browserStorage(t);
  const economy = await freshEconomy();
  economy.earnHux(1100);
  economy.buyTurkeyCosmetic();
  economy.buyFarmSupply("speed");
  economy.saveFarmInventory({ speed: 0 });
  economy.recordTurkeyRescues(1, 1);
  economy.earnHux(4);
  assert.equal(economy.loadHuxState().cosmetics.turkey, true);
  assert.equal(economy.loadHuxState().equippedCosmetic, "turkey");
  const remaining = economy.loadHuxState().hux;
  assert.equal(economy.setTurkeyCosmeticEquipped(false).state.equippedCosmetic, null);
  const reloaded = await freshEconomy();
  assert.equal(reloaded.loadHuxState().cosmetics.turkey, true);
  assert.equal(reloaded.loadHuxState().equippedCosmetic, null);
  assert.equal(reloaded.setTurkeyCosmeticEquipped(true).state.equippedCosmetic, "turkey");
  assert.equal(reloaded.loadHuxState().hux, remaining);
});

test("turkey appears only on its three supported themes and cannot equip from malformed ownership", async (t) => {
  const { values } = browserStorage(t);
  const economy = await freshEconomy();
  economy.earnHux(1000);
  economy.buyTurkeyCosmetic();
  for (const theme of ["space", "jungle", "medieval"]) assert.equal(economy.getPlayerCosmeticForTheme(theme), "turkey");
  for (const theme of ["city", "labyrinth", "farm", "unknown", undefined]) assert.equal(economy.getPlayerCosmeticForTheme(theme), null);
  economy.setTurkeyCosmeticEquipped(false);
  assert.equal(economy.getPlayerCosmeticForTheme("space"), null);
  values.set(HUX_KEY, JSON.stringify({ hux: 35, cosmetics: { turkey: "true" }, equippedCosmetic: "turkey" }));
  assert.deepEqual(economy.loadHuxState(), { ...emptyState(), hux: 35 });
  assert.equal(economy.getPlayerCosmeticForTheme("space"), null);
});
