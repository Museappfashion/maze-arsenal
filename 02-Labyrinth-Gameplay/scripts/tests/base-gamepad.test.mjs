import assert from "node:assert/strict";
import test from "node:test";
import { createGamepadReader } from "../../src/input/baseGamepad.js";

function pad({ index = 0, id = "Test standard pad", mapping = "standard", connected = true, axes = [0, 0, 0, 0], held = {} } = {}) {
  return {
    index, id, mapping, connected, axes,
    buttons: Array.from({ length: 17 }, (_, button) => {
      const value = held[button] ?? 0;
      return { value, pressed: value > 0 };
    }),
  };
}
const approx = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const neutral = (reader, value = pad(), time = 0) => reader.poll([value], time);

test("unsupported, absent, sparse, and disconnected gamepads safely produce neutral input", () => {
  const reader = createGamepadReader();
  for (const pads of [undefined, null, [], [null], [pad({ mapping: "" })], [pad({ mapping: "vendor" })], [pad({ connected: false })]]) {
    const result = reader.poll(pads, 0);
    assert.equal(result.connected, false);
    assert.equal(result.index, null);
    assert.deepEqual(result.move, { x: 0, y: 0 });
    assert.deepEqual(result.look, { x: 0, y: 0 });
    assert.ok(Object.values(result.down).every((down) => !down));
    assert.deepEqual(result.pressed, []);
    assert.deepEqual(result.repeat, []);
  }
  const sparse = []; sparse[3] = pad({ index: 3 });
  const result = reader.poll(sparse, 1);
  assert.equal(result.connected, true);
  assert.equal(result.index, 3);
});

test("connection and reset require released controls before a held confirm can activate slot three", () => {
  const reader = createGamepadReader();
  for (const time of [0, 16, 1000]) {
    const result = reader.poll([pad({ held: { 0: 1, 7: 1 } })], time);
    assert.equal(result.connected, true);
    assert.equal(result.down.confirm, false);
    assert.equal(result.down.attack, false);
    assert.deepEqual(result.pressed, []);
  }
  neutral(reader, pad(), 1010);
  let result = reader.poll([pad({ held: { 0: 1 } })], 1020);
  assert.deepEqual(result.pressed, ["confirm"]);
  assert.equal(result.down.confirm, true);
  assert.deepEqual(reader.poll([pad({ held: { 0: 1 } })], 2000).pressed, []);
  reader.reset();
  result = reader.poll([pad({ held: { 0: 1 } })], 2010);
  assert.equal(result.down.confirm, false);
  neutral(reader, pad(), 2020);
  assert.deepEqual(reader.poll([pad({ held: { 0: 1 } })], 2030).pressed, ["confirm"]);
});

test("drifting or held sticks cannot bypass the initial neutral gate", () => {
  const reader = createGamepadReader();
  let result = reader.poll([pad({ axes: [1, 0, 0, 0] })], 0);
  assert.deepEqual(result.move, { x: 0, y: 0 });
  assert.deepEqual(reader.poll([pad({ held: { 0: 1 } })], 10).pressed, []);
  neutral(reader, pad({ axes: [0.05, 0, 0, 0] }), 20);
  result = reader.poll([pad({ axes: [1, 0, 0, 0] })], 30);
  assert.deepEqual(result.move, { x: 1, y: 0 });
});

test("standard indices map every proposed base-game action without synthetic keyboard input", () => {
  const mapping = { confirm: 0, sidebar: 1, power1: 2, power2: 3, previous: 4, next: 5, exit: 6, attack: 7, menu: 9, up: 12, down: 13, left: 14, right: 15 };
  for (const [name, index] of Object.entries(mapping)) {
    const reader = createGamepadReader(); neutral(reader);
    const result = reader.poll([pad({ held: { [index]: 1 } })], 10);
    assert.deepEqual(result.pressed, [name]);
    assert.deepEqual(Object.keys(result.down).filter((key) => result.down[key]), [name]);
  }
});

test("analog triggers require 0.55 even when the browser reports pressed below that value", () => {
  const reader = createGamepadReader(); neutral(reader);
  let result = reader.poll([pad({ held: { 6: 0.54, 7: 0.54 } })], 10);
  assert.equal(result.down.exit, false);
  assert.equal(result.down.attack, false);
  result = reader.poll([pad({ held: { 6: 0.55, 7: 0.55 } })], 20);
  assert.deepEqual(result.pressed, ["exit", "attack"]);
  assert.deepEqual(reader.poll([pad({ held: { 6: 1, 7: 1 } })], 30).pressed, []);
  neutral(reader, pad(), 40);
  assert.deepEqual(reader.poll([pad({ held: { 7: 1 } })], 50).pressed, ["attack"]);
});

test("radial deadzones remove drift, rescale smooth movement, and normalize diagonals", () => {
  const reader = createGamepadReader(); neutral(reader);
  let result = reader.poll([pad({ axes: [0.1, 0.1, -0.18, 0] })], 10);
  assert.deepEqual(result.move, { x: 0, y: 0 });
  assert.deepEqual(result.look, { x: 0, y: 0 });
  result = reader.poll([pad({ axes: [0.59, 0, -1, 1] })], 20);
  approx(result.move.x, 0.5); approx(result.move.y, 0);
  approx(result.look.x, -Math.SQRT1_2); approx(result.look.y, Math.SQRT1_2);
  approx(Math.hypot(result.look.x, result.look.y), 1);
  result = reader.poll([pad({ axes: [-1, -1, NaN, Infinity] })], 30);
  approx(result.move.x, -Math.SQRT1_2); approx(result.move.y, -Math.SQRT1_2);
  assert.deepEqual(result.look, { x: 0, y: 0 });
  const custom = createGamepadReader({ deadzone: 0.4 }); neutral(custom);
  approx(custom.poll([pad({ axes: [0.7, 0, 0, 0] })], 10).move.x, 0.5);
});

test("only the D-pad repeats, after 350 ms then every 130 ms, without bursts after slow frames", () => {
  const reader = createGamepadReader(); neutral(reader);
  const held = pad({ held: { 0: 1, 2: 1, 4: 1, 7: 1, 12: 1, 15: 1 } });
  assert.deepEqual(reader.poll([held], 100).pressed, ["confirm", "power1", "previous", "attack", "up", "right"]);
  assert.deepEqual(reader.poll([held], 449).repeat, []);
  assert.deepEqual(reader.poll([held], 450).repeat, ["up", "right"]);
  assert.deepEqual(reader.poll([held], 579).repeat, []);
  let result = reader.poll([held], 580);
  assert.deepEqual(result.repeat, ["up", "right"]);
  assert.deepEqual(result.pressed, []);
  assert.deepEqual(reader.poll([held], 10000).repeat, ["up", "right"]);
  assert.deepEqual(reader.poll([held], 10001).repeat, []);
  neutral(reader, pad(), 10020);
  result = reader.poll([held], 10030);
  assert.ok(result.pressed.includes("up"));
  assert.deepEqual(result.repeat, []);
  assert.deepEqual(reader.poll([held], 10379).repeat, []);
  assert.deepEqual(reader.poll([held], 10380).repeat, ["up", "right"]);
});

test("the selected controller stays active until disconnected and a replacement is neutral-gated", () => {
  const reader = createGamepadReader();
  const second = pad({ index: 2, id: "Second pad" });
  reader.poll([null, null, second], 0);
  let result = reader.poll([pad({ held: { 0: 1 } }), null, pad({ index: 2, id: "Second pad", held: { 2: 1 } })], 10);
  assert.equal(result.index, 2);
  assert.deepEqual(result.pressed, ["power1"]);
  result = reader.poll([pad({ held: { 0: 1 } })], 20);
  assert.equal(result.index, 0);
  assert.equal(result.down.confirm, false);
  neutral(reader, pad(), 30);
  assert.deepEqual(reader.poll([pad({ held: { 0: 1 } })], 40).pressed, ["confirm"]);
  reader.poll([], 50);
  assert.equal(reader.poll([pad({ held: { 0: 1 } })], 60).down.confirm, false);
});

test("a replacement at the same index, backward time, and mutation of returned snapshots do not leak stale state", () => {
  const reader = createGamepadReader(); neutral(reader);
  const original = reader.poll([pad({ held: { 12: 1 } })], 1000);
  original.down.up = false;
  original.pressed.push("attack");
  assert.deepEqual(reader.poll([pad({ held: { 12: 1 } })], 1010).pressed, []);
  assert.deepEqual(reader.poll([pad({ held: { 12: 1 } })], 10).repeat, []);
  assert.deepEqual(reader.poll([pad({ held: { 12: 1 } })], 359).repeat, []);
  assert.deepEqual(reader.poll([pad({ held: { 12: 1 } })], 360).repeat, ["up"]);
  let result = reader.poll([pad({ id: "Replacement", held: { 0: 1 } })], 400);
  assert.equal(result.id, "Replacement");
  assert.deepEqual(result.pressed, []);
  assert.equal(result.down.confirm, false);
  reader.poll([pad({ id: "Replacement" })], 410);
  result = reader.poll([pad({ id: "Replacement", held: { 0: 1 } })], 420);
  assert.deepEqual(result.pressed, ["confirm"]);
});
