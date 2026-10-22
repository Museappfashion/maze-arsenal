import assert from "node:assert/strict";
import test from "node:test";

test("active play unlocks, per-name persistence, and single-credit special rewards", async (t) => {
  const values = new Map();
  const originalWindow = globalThis.window, originalDocument = globalThis.document;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  globalThis.window = { localStorage: storage, dispatchEvent() {} };
  globalThis.document = { hidden: false };
  try {
    const progress = await import("../../src/services/playerProgress.js");
    const miz = await import("../../src/services/mizEconomy.js");
    const hux = await import("../../src/services/huxEconomy.js");
    await t.test("1h / 2h boundaries count actual frames and persist separately per player", async () => {
      for (let i = 0; i < 3599; i++) progress.recordActivePlay("Scout A", 1);
      assert.equal(progress.getPlayerProgress("Scout A").towerDefense, false);
      progress.recordActivePlay("Scout A", 1);
      assert.equal(progress.getPlayerProgress(" scout a ").towerDefense, true);
      assert.equal(progress.getPlayerProgress("Scout B").towerDefense, false);
      for (let i = 0; i < 3599; i++) progress.recordActivePlay("Scout A", 1);
      assert.equal(progress.getPlayerProgress("Scout A").hundredFloor, false);
      progress.recordActivePlay("Scout A", 1);
      progress.flushPlayerProgress();
      const reloaded = await import("../../src/services/playerProgress.js?reload-test");
      assert.equal(reloaded.getPlayerProgress("Scout A").playedSeconds, 7200);
      assert.equal(reloaded.getPlayerProgress("Scout A").hundredFloor, true);
    });
    await t.test("hidden tabs and invalid deltas earn nothing; resumed frames are bounded", () => {
      globalThis.document.hidden = true;
      progress.recordActivePlay("Hidden", 3600);
      assert.equal(progress.getPlayerProgress("Hidden").playedSeconds, 0);
      globalThis.document.hidden = false;
      for (const delta of [NaN, Infinity, -1, 0]) progress.recordActivePlay("Hidden", delta);
      assert.equal(progress.getPlayerProgress("Hidden").playedSeconds, 0);
      progress.recordActivePlay("Hidden", 3600);
      assert.equal(progress.getPlayerProgress("Hidden").playedSeconds, 1);
    });
    await t.test("special name adds 1m MIZ / 10k hux once, preserves inventory, unlocks both instantly", async () => {
      miz.saveMizState({ miz: 321, cosmetics: { alien: true }, consumables: { nullPulse: 2 }, legacyTurkeyMigrated: true });
      hux.earnHux(123);
      hux.saveFarmInventory({ speed: 2 });
      progress.selectProgressPlayer("oibougvovo");
      assert.equal(miz.loadMizState().miz, 321);
      const state = progress.selectProgressPlayer("oibougvovov");
      assert.equal(state.towerDefense, true); assert.equal(state.hundredFloor, true);
      assert.equal(state.playedSeconds, 0);
      assert.equal(miz.loadMizState().miz, 1000321);
      assert.equal(hux.loadHuxState().hux, 10123);
      assert.equal(miz.loadMizState().cosmetics.alien, true);
      assert.equal(miz.loadMizState().consumables.nullPulse, 2);
      assert.equal(hux.loadHuxState().inventory.speed, 2);
      progress.selectProgressPlayer("Other player");
      progress.selectProgressPlayer(" OIBOUGVOVOV ");
      const reloaded = await import("../../src/services/playerProgress.js?gift-reload");
      reloaded.selectProgressPlayer("oibougvovov");
      assert.equal(miz.loadMizState().miz, 1000321);
      assert.equal(hux.loadHuxState().hux, 10123);
      assert.equal(reloaded.getLastPlayerName(), "oibougvovov");
    });
    await t.test("unavailable storage retains progress in the session", () => {
      progress.flushPlayerProgress();
      const oldSet = storage.setItem;
      storage.setItem = () => { throw new Error("Quota"); };
      for (let i = 0; i < 11; i++) progress.recordActivePlay("Offline", 1);
      progress.flushPlayerProgress();
      assert.equal(progress.getPlayerProgress("Offline").playedSeconds, 11);
      storage.setItem = oldSet;
      progress.recordActivePlay("Offline", 1); progress.flushPlayerProgress();
      assert.equal(progress.getPlayerProgress("Offline").playedSeconds, 12);
    });
  } finally {
    globalThis.window = originalWindow; globalThis.document = originalDocument;
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage); else delete globalThis.localStorage;
  }
});
