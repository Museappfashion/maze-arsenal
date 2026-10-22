import { createOutdoorMesh, drawOutdoorMeshScene } from "./outdoorGeometry3D.js";

const sceneCache = new WeakMap();

function outdoorMeshes(world) {
  const key = world.level.themeKey;
  let cached = sceneCache.get(world);
  if (!cached || cached.grid !== world.grid || cached.key !== key) {
    cached = { grid: world.grid, key, cells: new Map() };
    sceneCache.set(world, cached);
  }
  const meshes = [];
  const px = world.player.x, py = world.player.y;
  // Consult the current map so destroyed walls disappear immediately.
  const range = 24;
  for (let y = Math.max(0, Math.floor(py - range)); y <= Math.min(world.height - 1, Math.ceil(py + range)); y++) {
    for (let x = Math.max(0, Math.floor(px - range)); x <= Math.min(world.width - 1, Math.ceil(px + range)); x++) {
      if (world.grid[y][x] === 0 || Math.hypot(x + .5 - px, y + .5 - py) > range) continue;
      if (![world.grid[y]?.[x - 1], world.grid[y]?.[x + 1], world.grid[y - 1]?.[x], world.grid[y + 1]?.[x]].includes(0)) continue;
      const cell = y * world.width + x;
      if (!cached.cells.has(cell)) cached.cells.set(cell, createOutdoorMesh(key, x, y));
      meshes.push(cached.cells.get(cell));
    }
  }
  return meshes;
}

export function drawOutdoorWalls3D(ctx, world, plane, width, height, horizon) {
  if (world.labyrinthMode || !["jungle", "space"].includes(world.level.themeKey)) return;
  drawOutdoorMeshScene(ctx, world, outdoorMeshes(world), { plane, width, height, horizon });
}

// Separated stepping platforms joined by thin energy bridges. The spaces
// between them show the starfield, rather than a continuous planetary surface.
// This is visual only: the original maze remains the movement/collision map.
export function orbitalPlatformSample(world, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (world.grid[ty]?.[tx] !== 0) return 0;
  const lx = ((x % 2) + 2) % 2, ly = ((y % 2) + 2) % 2;
  const edge = .47 + Math.sin(ly * 8 + Math.floor(x / 2)) * .025;
  if (lx > edge && lx < 2 - edge && ly > .47 && ly < 1.53) return Math.min(lx - edge, 2 - edge - lx, ly - .47, 1.53 - ly) < .055 ? 2 : 1;
  return Math.abs(lx - 1) < .13 || Math.abs(ly - 1) < .13 ? 3 : 0;
}
