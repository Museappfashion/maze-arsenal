import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTROLLER_PREFERENCES_KEY,
  DEFAULT_CONTROLLER_PREFERENCES,
  loadControllerPreferences,
  normalizeControllerPreferences,
  saveControllerPreferences,
} from "../../src/input/controllerPreferences.js";
import { createBaseControllerSession, emptyControllerInput } from "../../src/input/baseControllerSession.js";

const defaults = { deadzone: 0.18, sensitivity: 1 };
const approx = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

function withStorage(storage, run) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try { return run(); }
  finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
}

test("missing, corrupt, or wrong-shape saved controller preferences gracefully load defaults", () => {
  assert.deepEqual(DEFAULT_CONTROLLER_PREFERENCES, defaults);
  for (const saved of [null, "", "not JSON", "{", "null", "[]", "123", "true", '"settings"', "{}", '{"deadzone":"0.1","sensitivity":false}']) {
    withStorage({ getItem: (key) => { assert.equal(key, CONTROLLER_PREFERENCES_KEY); return saved; } }, () => {
      assert.deepEqual(loadControllerPreferences(), defaults);
    });
  }
  withStorage(undefined, () => assert.deepEqual(loadControllerPreferences(), defaults));
  withStorage({ getItem() { throw new Error("Storage access denied"); } }, () => {
    assert.deepEqual(loadControllerPreferences(), defaults);
  });
});

test("controller preference values clamp to supported ranges and invalid individual values use defaults", () => {
  assert.deepEqual(normalizeControllerPreferences({ deadzone: -1, sensitivity: 100 }), { deadzone: 0.05, sensitivity: 2 });
  assert.deepEqual(normalizeControllerPreferences({ deadzone: 10, sensitivity: -5 }), { deadzone: 0.4, sensitivity: 0.25 });
  assert.deepEqual(normalizeControllerPreferences({ deadzone: 0.05, sensitivity: 0.25 }), { deadzone: 0.05, sensitivity: 0.25 });
  assert.deepEqual(normalizeControllerPreferences({ deadzone: 0.4, sensitivity: 2 }), { deadzone: 0.4, sensitivity: 2 });
  assert.deepEqual(normalizeControllerPreferences({ deadzone: 0.27, sensitivity: 1.35, unrelated: 9 }), { deadzone: 0.27, sensitivity: 1.35 });
  for (const invalid of [undefined, null, NaN, Infinity, -Infinity, "0.25", true, {}, []]) {
    assert.deepEqual(normalizeControllerPreferences({ deadzone: invalid, sensitivity: invalid }), defaults);
  }
  assert.deepEqual(normalizeControllerPreferences(null), defaults);
  assert.deepEqual(normalizeControllerPreferences({ deadzone: NaN, sensitivity: 1.5 }), { deadzone: 0.18, sensitivity: 1.5 });
  assert.deepEqual(normalizeControllerPreferences({ deadzone: 0.12, sensitivity: Infinity }), { deadzone: 0.12, sensitivity: 1 });
});

test("save and reload persist only the controller namespace and return independent normalized values", () => {
  const values = new Map([
    ["mist-maze-miz-economy-v3", "unchanged wallet"],
    ["mist-maze-thanksgiving-hux-v1", "unchanged farm"],
  ]);
  const writes = [];
  withStorage({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { writes.push(key); values.set(key, value); },
  }, () => {
    const saved = saveControllerPreferences({ deadzone: 0.11, sensitivity: 1.65, playerName: "Do not persist" });
    assert.equal(CONTROLLER_PREFERENCES_KEY, "mist-maze-controller-settings-v1");
    assert.deepEqual(writes, [CONTROLLER_PREFERENCES_KEY]);
    assert.deepEqual(JSON.parse(values.get(CONTROLLER_PREFERENCES_KEY)), { deadzone: 0.11, sensitivity: 1.65 });
    assert.deepEqual(loadControllerPreferences(), saved);
    saved.deadzone = 0.4;
    assert.deepEqual(loadControllerPreferences(), { deadzone: 0.11, sensitivity: 1.65 });
    assert.equal(values.get("mist-maze-miz-economy-v3"), "unchanged wallet");
    assert.equal(values.get("mist-maze-thanksgiving-hux-v1"), "unchanged farm");
    assert.deepEqual(saveControllerPreferences({ deadzone: -10, sensitivity: 9 }), { deadzone: 0.05, sensitivity: 2 });
    assert.deepEqual(loadControllerPreferences(), { deadzone: 0.05, sensitivity: 2 });
  });
});

test("denied controller storage still returns usable session settings and does not mutate defaults", () => {
  withStorage({ setItem() { throw new Error("Storage quota exceeded"); } }, () => {
    assert.deepEqual(saveControllerPreferences({ deadzone: 0.09, sensitivity: 1.2 }), { deadzone: 0.09, sensitivity: 1.2 });
  });
  withStorage(undefined, () => {
    assert.deepEqual(saveControllerPreferences({ deadzone: 0.2, sensitivity: 0.75 }), { deadzone: 0.2, sensitivity: 0.75 });
    const loaded = loadControllerPreferences(); loaded.deadzone = 0.4;
    assert.deepEqual(loadControllerPreferences(), defaults);
    assert.deepEqual(DEFAULT_CONTROLLER_PREFERENCES, defaults);
  });
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Storage disabled"); } });
  try {
    assert.deepEqual(loadControllerPreferences(), defaults);
    assert.deepEqual(saveControllerPreferences({ deadzone: 0.08, sensitivity: 1.1 }), { deadzone: 0.08, sensitivity: 1.1 });
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});

function pad(held = [], axes = [0, 0, 0, 0]) {
  return {
    index: 0, id: "Preference test controller", mapping: "standard", connected: true, axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i), value: held.includes(i) ? 1 : 0 })),
  };
}

test("changing session deadzone requires neutral release, changes drift output, and never spends a held face button", () => {
  let context = { enabled: true, playing: true, paused: false, deadzone: 0.18, world: { levelKey: "level0", labyrinthMode: false } };
  const powers = [];
  const session = createBaseControllerSession({ getContext: () => context, onPower: (slot) => powers.push(slot) });
  let now = 0;
  const tick = (held = [], axes = [0, 0, 0, 0]) => session.tick([pad(held, axes)], now += 16);
  tick();
  assert.deepEqual(tick([], [0.1, 0.1, 0.1, 0.1]), emptyControllerInput());

  context = { ...context, deadzone: 0.05 };
  assert.deepEqual(tick([0], [0.1, 0.1, 0.1, 0.1]), emptyControllerInput());
  assert.deepEqual(tick([0]), emptyControllerInput());
  assert.deepEqual(powers, []);
  // Releasing the button with the stick still outside the new deadzone must
  // not unlock gameplay; the entire controller must first return to neutral.
  assert.deepEqual(tick([], [0.1, 0.1, 0.1, 0.1]), emptyControllerInput());
  tick();
  const lowerZone = tick([], [0.1, 0.1, 0.1, 0.1]);
  const component = (Math.hypot(0.1, 0.1) - 0.05) / 0.95 * Math.SQRT1_2;
  approx(lowerZone.move.x, component); approx(lowerZone.move.y, component);
  approx(lowerZone.look.x, component); approx(lowerZone.look.y, component);
  tick([0]); tick([0]);
  assert.deepEqual(powers, [2]);

  context = { ...context, deadzone: 0.4 };
  assert.deepEqual(tick([0]), emptyControllerInput());
  assert.deepEqual(tick([0], [0.1, 0.1, 0.1, 0.1]), emptyControllerInput());
  assert.deepEqual(powers, [2]);
  tick();
  assert.deepEqual(tick([], [0.1, 0.1, 0.1, 0.1]), emptyControllerInput());
  tick([0]); tick([0]);
  assert.deepEqual(powers, [2, 2]);
});
