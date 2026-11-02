import { createOutdoorMesh, createOrbitalShelfMesh, drawOutdoorMeshScene } from "./outdoorGeometry3D.js";

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
      if (Math.hypot(x + .5 - px, y + .5 - py) > range) continue;
      if (world.grid[y][x] === 0) {
        if (key === "space") {
          // A quiet edge marks the translucent field only against solid
          // obstacles. Walkable neighbours never get an internal grid seam.
          const edges = (world.grid[y - 1]?.[x] !== 0 ? 1 : 0) | (world.grid[y]?.[x + 1] !== 0 ? 2 : 0) | (world.grid[y + 1]?.[x] !== 0 ? 4 : 0) | (world.grid[y]?.[x - 1] !== 0 ? 8 : 0);
          if (edges) {
            const shelf = `s${y * world.width + x}:${edges}`;
            if (!cached.cells.has(shelf)) cached.cells.set(shelf, createOrbitalShelfMesh(x, y, edges));
            meshes.push(cached.cells.get(shelf));
          }
        }
        continue;
      }
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

// The continuous gravity route follows the collision map exactly. Its faint
// translucent surface and thin boundary leave the starfield visible underfoot,
// without holes, detached pads, or grid seams between walkable neighbours.
export function orbitalPlatformSample(world, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (world.grid[ty]?.[tx] !== 0) return 0;
  const lx = x - tx, ly = y - ty, edge = .035;
  if (lx < edge && world.grid[ty]?.[tx - 1] !== 0 || lx > 1 - edge && world.grid[ty]?.[tx + 1] !== 0 || ly < edge && world.grid[ty - 1]?.[tx] !== 0 || ly > 1 - edge && world.grid[ty + 1]?.[tx] !== 0) return 2;
  return 1;
}
