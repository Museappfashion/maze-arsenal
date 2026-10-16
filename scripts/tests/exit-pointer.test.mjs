import assert from "node:assert/strict";
import test from "node:test";
import {
  getExitPointerDirection,
  POINTER_DIRECTION_STEP,
} from "../../src/features/exitPointer.js";

function worldAtBearing(angle, viewMode = "2d", facing = 0) {
  return {
    viewMode,
    player: { x: 100, y: 100, facing },
    exit: { x: 99.5 + 10 * Math.cos(angle), y: 99.5 + 10 * Math.sin(angle) },
  };
}

test("2D selects all 16 map directions independently of player facing", () => {
  for (let index = 0; index < 16; index += 1) {
    assert.equal(getExitPointerDirection(worldAtBearing(index * POINTER_DIRECTION_STEP, "2d", 1.7)), index);
  }
});

test("3D points up ahead, right, down behind, and left as the player turns", () => {
  for (const facing of [0, 0.8, Math.PI, -Math.PI + 0.1]) {
    for (const [offset, expected] of [[0, 12], [Math.PI / 2, 0], [Math.PI, 4], [-Math.PI / 2, 8]]) {
      assert.equal(getExitPointerDirection(worldAtBearing(facing + offset, "3d", facing)), expected);
    }
  }
});

test("tiny boundary jitter holds one light, larger direction changes update immediately", () => {
  const radians = degrees => degrees * Math.PI / 180;
  assert.equal(getExitPointerDirection(worldAtBearing(radians(11.4)), 0), 0);
  assert.equal(getExitPointerDirection(worldAtBearing(radians(11.1)), 0), 0);
  assert.equal(getExitPointerDirection(worldAtBearing(radians(14)), 0), 1);
  assert.equal(getExitPointerDirection(worldAtBearing(radians(180)), 0), 8);
  assert.equal(getExitPointerDirection(worldAtBearing(radians(-1)), 0), 0);
  assert.equal(getExitPointerDirection(worldAtBearing(radians(359)), 0), 0);
});

test("missing coordinates and arrival at exit have no directional light", () => {
  assert.equal(getExitPointerDirection(null), null);
  assert.equal(getExitPointerDirection({ player: {}, exit: {} }), null);
  assert.equal(getExitPointerDirection({ player: { x: 1.5, y: 1.5 }, exit: { x: 1, y: 1 } }), null);
});
