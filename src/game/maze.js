// src/game/maze.js
import { FLOOR, PASSAGE_WIDTH, WALL } from "../config/constants.js";
import { chance, clamp, indexOfTile, shuffle, tileCenter } from "../utils/math.js";

export function createLogicalConnections(logicalCols, logicalRows, mazeConfig) { const visited = Array.from({ length: logicalRows }, () => Array(logicalCols).fill(false), );

const connections = Array.from({ length: logicalRows }, () => Array.from({ length: logicalCols }, () => ({ n: false, e: false, s: false, w: false, })), );

const active = [{ x: 0, y: 0, lastDir: null }]; visited[0][0] = true;

while (active.length) { const currentIndex = chance(mazeConfig.newestBias) ? active.length - 1 : Math.floor(Math.random() * active.length);

const current = active[currentIndex];

let directions = shuffle([
  { dx: 1, dy: 0, key: "e", opposite: "w" },
  { dx: -1, dy: 0, key: "w", opposite: "e" },
  { dx: 0, dy: 1, key: "s", opposite: "n" },
  { dx: 0, dy: -1, key: "n", opposite: "s" },
]);

if (current.lastDir && chance(mazeConfig.straightBias)) {
  directions = [
    current.lastDir,
    ...directions.filter(
      (direction) => direction.key !== current.lastDir.key,
    ),
  ];
}

let carved = false;

for (const direction of directions) {
  const nx = current.x + direction.dx;
  const ny = current.y + direction.dy;

  if (nx < 0 || ny < 0 || nx >= logicalCols || ny >= logicalRows) {
    continue;
  }

  if (visited[ny][nx]) {
    continue;
  }

  visited[ny][nx] = true;
  connections[current.y][current.x][direction.key] = true;
  connections[ny][nx][direction.opposite] = true;

  active.push({ x: nx, y: ny, lastDir: direction });
  carved = true;
  break;
}

if (!carved) {
  active.splice(currentIndex, 1);
}

}

return connections; }

export function countLogicalOpenConnections(connections, x, y) { const cell = connections[y][x]; return Number(cell.n) + Number(cell.e) + Number(cell.s) + Number(cell.w); }

export function connectLogicalCells(connections, x, y, direction) { const deltas = { n: { dx: 0, dy: -1, opposite: "s" }, e: { dx: 1, dy: 0, opposite: "w" }, s: { dx: 0, dy: 1, opposite: "n" }, w: { dx: -1, dy: 0, opposite: "e" }, };

const delta = deltas[direction]; const nx = x + delta.dx; const ny = y + delta.dy;

if (!connections[ny]?.[nx]) { return; }

connections[y][x][direction] = true; connections[ny][nx][delta.opposite] = true; }

export function carveBraids(connections, logicalCols, logicalRows, braidChance) { const deadEnds = [];

for (let y = 0; y < logicalRows; y += 1) { for (let x = 0; x < logicalCols; x += 1) { if (countLogicalOpenConnections(connections, x, y) === 1) { deadEnds.push({ x, y }); } } }

for (const tile of shuffle(deadEnds)) { if (!chance(braidChance)) { continue; }

const closedDirections = [
  { key: "e", nx: tile.x + 1, ny: tile.y },
  { key: "w", nx: tile.x - 1, ny: tile.y },
  { key: "s", nx: tile.x, ny: tile.y + 1 },
  { key: "n", nx: tile.x, ny: tile.y - 1 },
].filter(
  (direction) =>
    connections[direction.ny]?.[direction.nx] &&
    !connections[tile.y][tile.x][direction.key],
);

if (!closedDirections.length) {
  continue;
}

const choice =
  closedDirections[Math.floor(Math.random() * closedDirections.length)];
connectLogicalCells(connections, tile.x, tile.y, choice.key);

} }

export function carveExtraLoops(connections, logicalCols, logicalRows, loopChance) { for (let y = 0; y < logicalRows; y += 1) { for (let x = 0; x < logicalCols; x += 1) { if ( x + 1 < logicalCols && !connections[y][x].e && chance(loopChance) ) { connectLogicalCells(connections, x, y, "e"); }

  if (
    y + 1 < logicalRows &&
    !connections[y][x].s &&
    chance(loopChance)
  ) {
    connectLogicalCells(connections, x, y, "s");
  }
}

} }

export function logicalCellOrigin(cellX, cellY) { return { x: 1 + cellX * (PASSAGE_WIDTH + 1), y: 1 + cellY * (PASSAGE_WIDTH + 1), }; }

export function logicalCellSpawnPosition(cellX, cellY) { const origin = logicalCellOrigin(cellX, cellY); return { x: origin.x + PASSAGE_WIDTH / 2, y: origin.y + PASSAGE_WIDTH / 2, }; }

export function carveLogicalCell(grid, cellX, cellY) { const origin = logicalCellOrigin(cellX, cellY);

for (let dy = 0; dy < PASSAGE_WIDTH; dy += 1) { for (let dx = 0; dx < PASSAGE_WIDTH; dx += 1) { grid[origin.y + dy][origin.x + dx] = FLOOR; } } }

export function carveLogicalConnection(grid, cellX, cellY, direction) { const origin = logicalCellOrigin(cellX, cellY);

if (direction === "e") { const wallX = origin.x + PASSAGE_WIDTH; for (let dy = 0; dy < PASSAGE_WIDTH; dy += 1) { grid[origin.y + dy][wallX] = FLOOR; } }

if (direction === "s") { const wallY = origin.y + PASSAGE_WIDTH; for (let dx = 0; dx < PASSAGE_WIDTH; dx += 1) { grid[wallY][origin.x + dx] = FLOOR; } } }

export function generateMaze(logicalCols, logicalRows, mazeConfig) { const width = logicalCols * (PASSAGE_WIDTH + 1) + 1; const height = logicalRows * (PASSAGE_WIDTH + 1) + 1; const grid = Array.from({ length: height }, () => Array(width).fill(WALL));

const connections = createLogicalConnections(logicalCols, logicalRows, mazeConfig);
carveBraids(connections, logicalCols, logicalRows, mazeConfig.braidDeadEndChance);
carveExtraLoops(connections, logicalCols, logicalRows, mazeConfig.extraLoopChance);

for (let y = 0; y < logicalRows; y += 1) { for (let x = 0; x < logicalCols; x += 1) { carveLogicalCell(grid, x, y);

  if (connections[y][x].e) {
    carveLogicalConnection(grid, x, y, "e");
  }

  if (connections[y][x].s) {
    carveLogicalConnection(grid, x, y, "s");
  }
}

}

return { grid, width, height, connections, logicalCols, logicalRows }; }

export function isWalkable(world, x, y) { return ( x >= 0 && y >= 0 && x < world.width && y < world.height && world.grid[y][x] === FLOOR ); }

export function collectFloorTiles(world) { const floors = [];

for (let y = 0; y < world.height; y += 1) { for (let x = 0; x < world.width; x += 1) { if (world.grid[y][x] === FLOOR) { floors.push({ x, y }); } } }

return floors; }

export function bfsDistances(world, startTile) { const distances = new Int32Array(world.width * world.height); distances.fill(-1);

const queue = new Int32Array(world.width * world.height); let head = 0; let tail = 0;

const startIndex = indexOfTile(world.width, startTile.x, startTile.y); distances[startIndex] = 0; queue[tail] = startIndex; tail += 1;

while (head < tail) { const currentIndex = queue[head]; head += 1;

const x = currentIndex % world.width;
const y = Math.floor(currentIndex / world.width);
const baseDistance = distances[currentIndex];

const neighbors = [
  [x + 1, y],
  [x - 1, y],
  [x, y + 1],
  [x, y - 1],
];

for (const [nx, ny] of neighbors) {
  if (!isWalkable(world, nx, ny)) {
    continue;
  }

  const nextIndex = indexOfTile(world.width, nx, ny);
  if (distances[nextIndex] !== -1) {
    continue;
  }

  distances[nextIndex] = baseDistance + 1;
  queue[tail] = nextIndex;
  tail += 1;
}

}

return distances; }

export function farthestTile(world, distances) { let best = { x: 1, y: 1, distance: 0 };

for (let y = 0; y < world.height; y += 1) { for (let x = 0; x < world.width; x += 1) { const distance = distances[indexOfTile(world.width, x, y)]; if (distance > best.distance) { best = { x, y, distance }; } } }

return best; }

export function circleHitsWall(world, x, y, radius) { const minX = Math.floor(x - radius); const maxX = Math.floor(x + radius); const minY = Math.floor(y - radius); const maxY = Math.floor(y + radius);

for (let tileY = minY; tileY <= maxY; tileY += 1) { for (let tileX = minX; tileX <= maxX; tileX += 1) { if ( tileX < 0 || tileY < 0 || tileX >= world.width || tileY >= world.height ) { return true; }

  if (world.grid[tileY][tileX] === FLOOR) {
    continue;
  }

  const nearestX = clamp(x, tileX, tileX + 1);
  const nearestY = clamp(y, tileY, tileY + 1);
  const dx = x - nearestX;
  const dy = y - nearestY;

  if (dx * dx + dy * dy < radius * radius) {
    return true;
  }
}

}

return false; }

export function moveWithCollisions(world, entity, dx, dy) { if (dx !== 0) { const nextX = entity.x + dx; if (!circleHitsWall(world, nextX, entity.y, entity.radius)) { entity.x = nextX; } }

if (dy !== 0) { const nextY = entity.y + dy; if (!circleHitsWall(world, entity.x, nextY, entity.radius)) { entity.y = nextY; } } }

export function hasLineOfSight(world, x1, y1, x2, y2) { const dx = x2 - x1; const dy = y2 - y1; const steps = Math.ceil(Math.hypot(dx, dy) * 10);

for (let step = 1; step < steps; step += 1) { const t = step / steps; const x = x1 + dx * t; const y = y1 + dy * t; const tileX = Math.floor(x); const tileY = Math.floor(y);

if (!isWalkable(world, tileX, tileY)) {
  return false;
}

}

return true; }

export function hashNoise(x, y) { const n = ((x * 374761393) ^ (y * 668265263)) >>> 0; return (n % 1000) / 1000; }

export function getDiscoveredPercent(world) {
  return clamp(
    Math.round(
      (world.player.discoveredFloor / Math.max(1, world.floorCount)) * 100,
    ),
    0,
    100,
  );
}

export function findSpawnTile(world, distances, minDistance, maxDistance, used) { const candidates = [];

for (const tile of world.floorTiles) { const key = indexOfTile(world.width, tile.x, tile.y); const distance = distances[key];

if (used.has(key)) {
  continue;
}

if (distance < minDistance || distance > maxDistance) {
  continue;
}

candidates.push(tile);

}

if (!candidates.length) { for (const tile of world.floorTiles) { const key = indexOfTile(world.width, tile.x, tile.y); if (!used.has(key)) { candidates.push(tile); } } }

if (!candidates.length) { return world.floorTiles[0] ?? world.start ?? { x: 1, y: 1 }; }

const chosen = candidates[Math.floor(Math.random() * candidates.length)]; used.add(indexOfTile(world.width, chosen.x, chosen.y)); return chosen; }

export function findTileNearPercent(world, distances, percent, spread, used) { const maxDistance = world.exit.distance; const target = Math.floor(maxDistance * percent);

return findSpawnTile( world, distances, Math.max(4, target - spread), target + spread, used, ); }

export function isTileSeparated(tile, reservedTiles, minimumSpacing) {
  if (!reservedTiles?.length || minimumSpacing <= 0) {
    return true;
  }

  return reservedTiles.every((reservedTile) => {
    const distance =
      Math.abs(tile.x - reservedTile.x) +
      Math.abs(tile.y - reservedTile.y);

    return distance >= minimumSpacing;
  });
}

export function findNearbyOpenTiles(
  world,
  originTile,
  radius,
  used,
  minDistance = 1,
  reservedTiles = [],
  minimumSpacing = 0,
) {
  const candidates = [];

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = originTile.x + dx;
      const y = originTile.y + dy;
      const distance = Math.abs(dx) + Math.abs(dy);

      if (distance < minDistance || distance > radius) {
        continue;
      }

      if (!isWalkable(world, x, y)) {
        continue;
      }

      const tile = { x, y };
      const key = indexOfTile(world.width, x, y);

      if (used.has(key)) {
        continue;
      }

      if (!isTileSeparated(tile, reservedTiles, minimumSpacing)) {
        continue;
      }

      candidates.push(tile);
    }
  }

  if (!candidates.length) {
    return null;
  }

  const tile = candidates[Math.floor(Math.random() * candidates.length)];
  used.add(indexOfTile(world.width, tile.x, tile.y));
  return tile;
}

export function findSpacedSpawnTile(
  world,
  distances,
  minDistance,
  maxDistance,
  used,
  reservedTiles,
  minimumSpacing,
) {
  const spacingAttempts = [
    minimumSpacing,
    Math.max(3, Math.floor(minimumSpacing * 0.7)),
    0,
  ];

  for (const spacing of spacingAttempts) {
    const candidates = [];

    for (const tile of world.floorTiles) {
      const key = indexOfTile(world.width, tile.x, tile.y);
      const distance = distances[key];

      if (used.has(key)) {
        continue;
      }

      if (distance < minDistance || distance > maxDistance) {
        continue;
      }

      if (!isTileSeparated(tile, reservedTiles, spacing)) {
        continue;
      }

      candidates.push(tile);
    }

    if (candidates.length) {
      const tile = candidates[Math.floor(Math.random() * candidates.length)];
      used.add(indexOfTile(world.width, tile.x, tile.y));
      return tile;
    }
  }

  return findSpawnTile(
    world,
    distances,
    minDistance,
    maxDistance,
    used,
  );
}

export function addPickup(world, tile, pickup) { const position = tileCenter(tile);

world.pickups.push({ id: `pickup-${world.nextId++}`, x: position.x, y: position.y, radius: 0.22, ...pickup, }); }

export function spawnProjectile(world, projectile) { world.projectiles.push({ id: `projectile-${world.nextId++}`, radius: 0.09, ttl: 1.25, piercesLeft: 0, hitIds: new Set(), ...projectile, }); }
