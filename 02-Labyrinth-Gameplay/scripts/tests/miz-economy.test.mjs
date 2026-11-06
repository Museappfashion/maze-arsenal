import assert from "node:assert/strict";
import test from "node:test";
import {
  loadMizState,
  MIZ_STATE_CHANGED_EVENT,
  recordWorldExploration,
  saveMizState,
} from "../../src/services/mizEconomy.js";

test("new exploration earns coins once, including the final run frame", () => {
  saveMizState({});
  const world = { player: { discoveredFloor: 80 } };

  assert.equal(recordWorldExploration(world), null);
  assert.equal(loadMizState().lifetimeExploredTiles, 0);

  world.player.discoveredFloor += 42;
  assert.equal(recordWorldExploration(world).mizEarned, 0);
  assert.equal(loadMizState().tileRemainder, 42);

  assert.equal(recordWorldExploration(world), null);
  world.player.discoveredFloor -= 10;
  assert.equal(recordWorldExploration(world), null);
  world.player.discoveredFloor += 10;
  assert.equal(recordWorldExploration(world), null);

  world.player.discoveredFloor += 1;
  world.victory = true;
  assert.equal(recordWorldExploration(world).mizEarned, 1);
  assert.equal(loadMizState().miz, 1);
  assert.equal(loadMizState().lifetimeExploredTiles, 43);
  assert.equal(recordWorldExploration(world), null);
});

test("replays keep the wallet and remainder but do not award spawn reveals", () => {
  saveMizState({ miz: 12, tileRemainder: 40 });
  const first = { player: { discoveredFloor: 70 } };
  const replay = { player: { discoveredFloor: 100 } };

  recordWorldExploration(first);
  recordWorldExploration(replay);
  assert.equal(loadMizState().miz, 12);

  replay.player.discoveredFloor += 3;
  recordWorldExploration(replay);
  assert.equal(loadMizState().miz, 13);
  assert.equal(loadMizState().tileRemainder, 0);
});

test("new discoveries persist and notify the wallet display", () => {
  const previousWindow = globalThis.window;
  const storage = new Map();
  const events = [];
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    dispatchEvent: (event) => events.push(event),
  };

  try {
    saveMizState({});
    events.length = 0;
    const world = { player: { discoveredFloor: 10 } };
    recordWorldExploration(world);
    world.player.discoveredFloor += 90;
    recordWorldExploration(world);

    const saved = JSON.parse(storage.get("mist-maze-miz-economy-v3"));
    assert.equal(saved.miz, 2);
    assert.equal(saved.tileRemainder, 4);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, MIZ_STATE_CHANGED_EVENT);
    assert.equal(events[0].detail.state.miz, 2);
    assert.equal(events[0].detail.tilesAdded, 90);

    recordWorldExploration(world);
    assert.equal(events.length, 1);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("missing and invalid world counters do not change the wallet", () => {
  saveMizState({ miz: 7 });
  for (const world of [null, undefined, {}, { player: {} }, { player: { discoveredFloor: NaN } }]) {
    assert.equal(recordWorldExploration(world), null);
  }
  assert.equal(loadMizState().miz, 7);
});
