import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { get3DWallHeight, project3DWall } from "../../src/game/materials3D.js";

test("3D building height is stable per footprint and varies across the City", () => {
  const world = { level: { themeKey: "city" } };
  const heights = new Set();
  for (let y = 0; y < 50; y += 5) for (let x = 0; x < 50; x += 5) {
    const height = get3DWallHeight(world, { mapX: x, mapY: y, side: 0 });
    heights.add(height);
    assert.equal(get3DWallHeight(world, { mapX: x + 4, mapY: y + 4, side: 1 }), height);
    assert.ok(height >= 2.8 && height <= 9.2);
  }
  assert.equal(heights.size, 5);
  world.labyrinthMode = true;
  assert.equal(get3DWallHeight(world, { mapX: 2, mapY: 2 }), 1);
});

test("tall facades retain the same ground plane and expose additional storeys upward", () => {
  const low = project3DWall(600, 330, 10, 2.8);
  const high = project3DWall(600, 330, 10, 9.2);
  assert.equal(low.bottom, 360);
  assert.equal(high.bottom, low.bottom);
  assert.ok(high.top < low.top - 300);
  assert.equal(low.height, low.bottom - low.top);
  const oldHeight = project3DWall(600, 330, 10);
  assert.equal(oldHeight.top, 300);
  assert.equal(oldHeight.bottom, 360);
});

test("City rays retain distant roofs while the nearest wall still sets collision and sprite depth", async () => {
  const server = await createServer({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom", optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const { cast3DRay } = await server.ssrLoadModule("/src/game/rendering.js?core");
    const grid = Array.from({ length: 10 }, () => Array(35).fill(0));
    for (const row of grid) for (const x of [5, 6, 15, 16, 25, 26]) row[x] = 1;
    const world = { grid, width: 35, height: 10, player: { x: 1.5, y: 5.5 }, level: { themeKey: "city" } };
    const ordinary = cast3DRay(world, 0);
    const skyline = cast3DRay(world, 0, true);
    assert.equal(ordinary.distance, 3.5);
    assert.deepEqual(skyline.map((hit) => hit.distance), [3.5, 13.5, 23.5]);
    assert.deepEqual(skyline[0], ordinary);
    const fullTurn = cast3DRay(world, Math.PI * 2, true);
    assert.deepEqual(fullTurn.map(({ wallOffset, ...hit }) => hit), skyline.map(({ wallOffset, ...hit }) => hit));
    for (let i = 0; i < skyline.length; i++) assert.ok(Math.abs(fullTurn[i].wallOffset - skyline[i].wallOffset) < 1e-9);
    assert.equal(new Set(skyline.map((hit) => get3DWallHeight(world, hit))).size > 1, true);
    assert.deepEqual(cast3DRay({ ...world, grid: grid.map((row) => row.map(() => 0)) }, 0, true), []);
    assert.equal(cast3DRay({ ...world, grid: grid.map((row) => row.map(() => 0)) }, 0).wallType, null);
    assert.equal(grid[5][5], 1, "render tracing never changes maze collision");
  } finally { await server.close(); }
});
