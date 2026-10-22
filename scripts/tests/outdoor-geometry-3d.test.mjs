import assert from "node:assert/strict";
import test from "node:test";
import { clipOutdoorPolygon, createOutdoorMesh, createOutdoorRaster, rasterOutdoorTriangle, renderOutdoorMeshes, drawOutdoorMeshScene, clipOutdoorSprite, hasOutdoorDepth, OUTDOOR_NEAR_PLANE } from "../../src/game/outdoorGeometry3D.js";
import { orbitalPlatformSample } from "../../src/game/outdoorScenes3D.js";

test("outdoor triangles crossing the camera are clipped before perspective division", () => {
  const polygon = clipOutdoorPolygon([[-1, 0, -1], [1, 0, 1], [0, 2, 1]]);
  assert.equal(polygon.length, 4);
  assert.equal(polygon.filter((v) => v[2] === OUTDOOR_NEAR_PLANE).length, 2);
  for (const v of polygon) assert.ok(v.every(Number.isFinite) && v[2] >= OUTDOOR_NEAR_PLANE);
  assert.deepEqual(clipOutdoorPolygon([[0, 0, -.1], [1, 0, -1], [0, 1, -2]]), []);
  const edge = clipOutdoorPolygon([[0, 0, .08], [1, 0, .08], [0, 1, .08]]);
  assert.equal(edge.length, 3);
});

test("pixel depth wins over mesh order and uses perspective-correct depth", () => {
  const first = createOutdoorRaster(32, 32), second = createOutdoorRaster(32, 32);
  const near = [[2, 2, 1], [30, 2, 2], [2, 30, 4]], far = [[2, 2, 5], [30, 2, 5], [2, 30, 5]];
  rasterOutdoorTriangle(first, ...far, [0, 255, 0]); rasterOutdoorTriangle(first, ...near, [255, 0, 0]);
  rasterOutdoorTriangle(second, ...near, [255, 0, 0]); rasterOutdoorTriangle(second, ...far, [0, 255, 0]);
  assert.deepEqual(first.pixels, second.pixels);
  assert.deepEqual(first.depth, second.depth);
  const wa = 1 - 6.5 / 28 - 6.5 / 28, wb = 6.5 / 28, wc = wb;
  assert.ok(Math.abs(first.depth[8 * 32 + 8] - 1 / (wa + wb / 2 + wc / 4)) < 1e-6);
  assert.equal(first.pixels[(8 * 32 + 8) * 4], 255);
});

test("trees and asteroids remain volumetric and stable from all 32 approach directions", () => {
  for (const theme of ["jungle", "space"]) {
    const mesh = createOutdoorMesh(theme, 4, 4), target = createOutdoorRaster(160, 120);
    assert.deepEqual(mesh, createOutdoorMesh(theme, 4, 4), "world shapes do not change when turning");
    const silhouettes = new Set();
    for (let angle = 0; angle < 32; angle++) {
      const facing = angle * Math.PI / 16;
      const camera = { x: mesh.x - Math.cos(facing) * 5, y: mesh.y - Math.sin(facing) * 5, facing };
      renderOutdoorMeshes(target, [mesh], camera, { plane: 120, horizon: 75, theme });
      const count = target.depth.filter(Number.isFinite).length;
      assert.ok(count > 180 && count < target.width * target.height / 2, `${theme} angle ${angle}: bounded 3D silhouette (${count} pixels)`);
      silhouettes.add(Buffer.from(target.pixels).toString("base64"));
      for (const d of target.depth) assert.ok(d === Infinity || Number.isFinite(d) && d >= OUTDOOR_NEAR_PLANE - 1e-5);
    }
    assert.ok(silhouettes.size >= 24, "turning reveals distinct sides instead of a camera-facing cutout");
  }
});

test("close turns at a wall corner never project geometry behind the viewer over the frame", () => {
  const target = createOutdoorRaster(120, 100), mesh = createOutdoorMesh("jungle", 4, 4);
  for (let angle = 0; angle < 64; angle++) {
    const camera = { x: 3.77, y: 4.27, facing: angle * Math.PI / 32 };
    renderOutdoorMeshes(target, [mesh], camera, { plane: 95, horizon: 46 });
    for (const d of target.depth) assert.ok(d === Infinity || d >= OUTDOOR_NEAR_PLANE - 1e-5);
    if (angle === 32) assert.equal(target.depth.filter(Number.isFinite).length, 0, "looking away does not leave a projected tree strip behind");
  }
  renderOutdoorMeshes(target, [mesh], { x: 1.5, y: 4.5, facing: 0 }, { plane: 95, horizon: 46 });
  const original = Uint8ClampedArray.from(target.pixels);
  renderOutdoorMeshes(target, [mesh], { x: 1.5, y: 4.5, facing: Math.PI * 2 }, { plane: 95, horizon: 46 });
  assert.deepEqual(target.pixels, original, "a complete rotation returns to the same view");
});

test("Orbital floor leaves substantial open space below the maze with connected stepping pads", () => {
  const world = { grid: Array.from({ length: 8 }, () => Array(8).fill(0)) };
  const counts = [0, 0, 0, 0];
  for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) counts[orbitalPlatformSample(world, x / 50, y / 50)]++;
  assert.ok(counts[0] > 5000, "more than half the view between pads is actual starfield");
  assert.ok(counts[1] > 1000 && counts[2] > 100 && counts[3] > 500);
  assert.equal(orbitalPlatformSample(world, 1, 1), 1);
  assert.equal(orbitalPlatformSample(world, 1, .01), 3);
  assert.equal(orbitalPlatformSample(world, .01, .01), 0);
  assert.ok(world.grid.every((row) => row.every((tile) => tile === 0)), "visual gaps do not change collision");
});

test("outdoor sprite clipping uses actual visible pixels and never leaks into other themes", () => {
  const previousCanvas = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = class {
    getContext() { return { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }; }
  };
  try {
    const rectangles = [];
    const ctx = { save() {}, restore() {}, drawImage() {}, beginPath() { rectangles.length = 0; }, rect(...args) { rectangles.push(args); }, clip() {} };
    const world = { level: { themeKey: "space" }, player: { x: 1.5, y: 4.5, facing: 0 } };
    drawOutdoorMeshScene(ctx, world, [createOutdoorMesh("space", 4, 4)], { plane: 30, width: 40, height: 30, horizon: 15 });
    assert.equal(hasOutdoorDepth(world), true);
    clipOutdoorSprite(ctx, world, { screenX: 20, scale: 10, depth: 1 });
    assert.equal(rectangles.reduce((total, [, , w, h]) => total + w * h, 0), 1200, "a foreground pickup is fully visible");
    clipOutdoorSprite(ctx, world, { screenX: 20, scale: 10, depth: 10 });
    const visibleArea = rectangles.reduce((total, [, , w, h]) => total + w * h, 0);
    assert.ok(visibleArea > 0 && visibleArea < 1200, "only the actual asteroid silhouette covers a distant actor");
    world.level.themeKey = "city";
    assert.equal(hasOutdoorDepth(world), false);
    assert.equal(clipOutdoorSprite(ctx, world, { screenX: 20, scale: 10, depth: 10 }), false);
  } finally {
    if (previousCanvas === undefined) delete globalThis.OffscreenCanvas;
    else globalThis.OffscreenCanvas = previousCanvas;
  }
});
