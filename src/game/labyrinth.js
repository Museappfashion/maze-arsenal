// src/game/labyrinth.js
import {
  FLOOR,
  PASSAGE_WIDTH,
  STEEL_WALL,
  WALL,
} from "../config/constants.js";
import {
  LABYRINTH_BREAKER_DURATION,
  LABYRINTH_MAX_BREAKERS,
  normalizeLabyrinthOptions,
} from "../config/labyrinth.js";
import {
  bfsDistances,
  collectFloorTiles,
  logicalCellOrigin,
} from "./maze.js";
import {
  clamp,
  indexOfTile,
  tileCenter,
} from "../utils/math.js";

const MUTATION_SAFE_RADIUS = 6;

export function isLabyrinthWorld(world) {
  return Boolean(world?.labyrinthMode);
}

export function getLabyrinthTimeRemaining(world) {
  if (!isLabyrinthWorld(world)) {
    return Infinity;
  }

  return Math.max(0, world.labyrinth.timeLimitSeconds - world.time);
}

export function createLabyrinthState(options = {}) {
  const config = normalizeLabyrinthOptions(options);

  return {
    ...config,
    breakerCharges: 0,
    breakerEndsAt: -Infinity,
    nextMutationAt: config.mutationInterval,
    mutationNumber: 0,
  };
}

function chooseExitByTargetDistance(world, distances) {
  const state = world.labyrinth;
  const targetDistance =
    state.timeLimitSeconds *
    3.05 *
    state.routePressure;

  let best = null;
  let bestDelta = Infinity;

  for (const tile of world.floorTiles) {
    const distance = distances[indexOfTile(world.width, tile.x, tile.y)];

    if (distance < 20) {
      continue;
    }

    const delta = Math.abs(distance - targetDistance);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = { ...tile, distance };
    }
  }

  return best;
}

function isProtectedWall(world, x, y) {
  const playerDistance = Math.hypot(
    x + 0.5 - world.player.x,
    y + 0.5 - world.player.y,
  );
  const exitDistance = Math.hypot(
    x - world.exit.x,
    y - world.exit.y,
  );

  if (
    playerDistance < MUTATION_SAFE_RADIUS ||
    exitDistance < MUTATION_SAFE_RADIUS
  ) {
    return true;
  }

  return world.pickups.some(
    (pickup) =>
      Math.abs(pickup.x - (x + 0.5)) < 1.2 &&
      Math.abs(pickup.y - (y + 0.5)) < 1.2,
  );
}

function getConnectionTiles(cellX, cellY, direction) {
  const origin = logicalCellOrigin(cellX, cellY);
  const tiles = [];

  if (direction === "e") {
    const x = origin.x + PASSAGE_WIDTH;
    for (let offset = 0; offset < PASSAGE_WIDTH; offset += 1) {
      tiles.push({ x, y: origin.y + offset });
    }
  } else {
    const y = origin.y + PASSAGE_WIDTH;
    for (let offset = 0; offset < PASSAGE_WIDTH; offset += 1) {
      tiles.push({ x: origin.x + offset, y });
    }
  }

  return tiles;
}

function setConnectionState(world, cellX, cellY, direction, open) {
  const neighbor =
    direction === "e"
      ? { x: cellX + 1, y: cellY, opposite: "w" }
      : { x: cellX, y: cellY + 1, opposite: "n" };

  world.connections[cellY][cellX][direction] = open;
  world.connections[neighbor.y][neighbor.x][neighbor.opposite] = open;

  const tileValue = open ? FLOOR : WALL;
  for (const tile of getConnectionTiles(cellX, cellY, direction)) {
    world.grid[tile.y][tile.x] = tileValue;
  }
}

function connectionIsSteel(world, cellX, cellY, direction) {
  return getConnectionTiles(cellX, cellY, direction).some(
    ({ x, y }) => world.grid[y][x] === STEEL_WALL,
  );
}

function connectionIsProtected(world, cellX, cellY, direction) {
  return getConnectionTiles(cellX, cellY, direction).some(
    ({ x, y }) => isProtectedWall(world, x, y),
  );
}

function getMutationCandidates(world, open) {
  const candidates = [];

  for (let y = 0; y < world.logicalRows; y += 1) {
    for (let x = 0; x < world.logicalCols; x += 1) {
      if (x + 1 < world.logicalCols) {
        const isOpen = world.connections[y][x].e;
        if (
          isOpen === open &&
          !connectionIsProtected(world, x, y, "e") &&
          (open || !connectionIsSteel(world, x, y, "e"))
        ) {
          candidates.push({ x, y, direction: "e" });
        }
      }

      if (y + 1 < world.logicalRows) {
        const isOpen = world.connections[y][x].s;
        if (
          isOpen === open &&
          !connectionIsProtected(world, x, y, "s") &&
          (open || !connectionIsSteel(world, x, y, "s"))
        ) {
          candidates.push({ x, y, direction: "s" });
        }
      }
    }
  }

  return candidates;
}

function randomCandidate(candidates) {
  if (!candidates.length) {
    return null;
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function canStillReachExit(world) {
  const playerTile = {
    x: clamp(Math.floor(world.player.x), 0, world.width - 1),
    y: clamp(Math.floor(world.player.y), 0, world.height - 1),
  };
  const distances = bfsDistances(world, playerTile);
  return (
    distances[indexOfTile(world.width, world.exit.x, world.exit.y)] >= 0
  );
}

function mutateOnce(world) {
  const closed = randomCandidate(getMutationCandidates(world, false));
  if (closed) {
    setConnectionState(
      world,
      closed.x,
      closed.y,
      closed.direction,
      true,
    );
  }

  const opens = getMutationCandidates(world, true);

  for (let attempt = 0; attempt < Math.min(24, opens.length); attempt += 1) {
    const candidate = opens[Math.floor(Math.random() * opens.length)];

    if (
      closed &&
      candidate.x === closed.x &&
      candidate.y === closed.y &&
      candidate.direction === closed.direction
    ) {
      continue;
    }

    setConnectionState(
      world,
      candidate.x,
      candidate.y,
      candidate.direction,
      false,
    );

    if (canStillReachExit(world)) {
      return true;
    }

    setConnectionState(
      world,
      candidate.x,
      candidate.y,
      candidate.direction,
      true,
    );
  }

  return Boolean(closed);
}

function refreshTopologyCaches(world) {
  world.floorTiles = collectFloorTiles(world);
  world.floorCount = world.floorTiles.length;
  world.distanceTimer = 0;
  world.distanceFieldDirty = true;
  world.minimapDirty = true;
}

export function mutateLabyrinth(world) {
  if (!isLabyrinthWorld(world) || world.gameOver || world.victory) {
    return false;
  }

  let changed = false;

  for (let index = 0; index < world.labyrinth.mutationCount; index += 1) {
    changed = mutateOnce(world) || changed;
  }

  if (changed) {
    refreshTopologyCaches(world);
    world.labyrinth.mutationNumber += 1;
    world.message = "The Labyrinth shifts...";
    world.messageTtl = 1.35;
  }

  return changed;
}

export function markSteelWalls(world) {
  const chance = world.labyrinth.steelChance;

  for (let y = 1; y < world.height - 1; y += 1) {
    for (let x = 1; x < world.width - 1; x += 1) {
      if (world.grid[y][x] !== WALL) {
        continue;
      }

      const clusteredNoise =
        (
          Math.sin(x * 0.37 + y * 0.19) +
          Math.cos(x * 0.17 - y * 0.31) +
          2
        ) / 4;

      if (clusteredNoise < chance * 1.7 && Math.random() < chance) {
        world.grid[y][x] = STEEL_WALL;
      }
    }
  }
}

export function placeLabyrinthBreakers(world, distances, used) {
  const count = world.labyrinth.breakerPickupCount;
  const candidates = world.floorTiles
    .filter((tile) => {
      const key = indexOfTile(world.width, tile.x, tile.y);
      const distance = distances[key];

      return (
        !used.has(key) &&
        distance > 18 &&
        distance < world.exit.distance * 0.97
      );
    })
    .sort(
      (a, b) =>
        distances[indexOfTile(world.width, a.x, a.y)] -
        distances[indexOfTile(world.width, b.x, b.y)],
    );

  if (!candidates.length) {
    return;
  }

  for (let index = 0; index < count; index += 1) {
    const progress = (index + 1) / (count + 1);
    const targetIndex = Math.min(
      candidates.length - 1,
      Math.floor(progress * candidates.length),
    );
    const jitter = Math.floor(
      (Math.random() - 0.5) * Math.max(4, candidates.length / count),
    );
    const tile =
      candidates[
        clamp(targetIndex + jitter, 0, candidates.length - 1)
      ];

    const key = indexOfTile(world.width, tile.x, tile.y);
    if (used.has(key)) {
      continue;
    }

    used.add(key);
    const center = tileCenter(tile);
    world.pickups.push({
      id: `labyrinth-breaker-${world.nextId++}`,
      type: "labyrinthBreaker",
      label: "10s Wall Breaker",
      x: center.x,
      y: center.y,
      radius: 0.28,
      color: "#c084fc",
    });
  }
}

export function initializeLabyrinth(world) {
  const distances = bfsDistances(world, world.start);
  const exit = chooseExitByTargetDistance(world, distances);

  if (exit) {
    world.exit = exit;
  }

  markSteelWalls(world);

  const used = new Set([
    indexOfTile(world.width, world.start.x, world.start.y),
    indexOfTile(world.width, world.exit.x, world.exit.y),
  ]);

  placeLabyrinthBreakers(world, distances, used);
  refreshTopologyCaches(world);
}

export function collectLabyrinthBreaker(world) {
  if (!isLabyrinthWorld(world)) {
    return false;
  }

  if (world.labyrinth.breakerCharges >= LABYRINTH_MAX_BREAKERS) {
    world.message = "Wall Breakers full — maximum 10";
    world.messageTtl = 1.1;
    return false;
  }

  world.labyrinth.breakerCharges += 1;
  world.message =
    `Wall Breaker stored — ${world.labyrinth.breakerCharges}/${LABYRINTH_MAX_BREAKERS}`;
  world.messageTtl = 1.15;
  return true;
}

export function activateLabyrinthBreaker(world) {
  if (!isLabyrinthWorld(world)) {
    return false;
  }

  if (world.labyrinth.breakerCharges <= 0) {
    world.message = "No Wall Breakers stored";
    world.messageTtl = 0.9;
    return false;
  }

  world.labyrinth.breakerCharges -= 1;
  world.labyrinth.breakerEndsAt =
    Math.max(world.time, world.labyrinth.breakerEndsAt) +
    LABYRINTH_BREAKER_DURATION;
  world.message =
    `Wall Breaker active — ${LABYRINTH_BREAKER_DURATION}s`;
  world.messageTtl = 1.1;
  return true;
}

export function labyrinthBreakerActive(world) {
  return (
    isLabyrinthWorld(world) &&
    world.labyrinth.breakerEndsAt > world.time
  );
}

export function updateLabyrinth(world) {
  if (!isLabyrinthWorld(world) || world.victory || world.gameOver) {
    return;
  }

  if (getLabyrinthTimeRemaining(world) <= 0) {
    world.gameOver = true;
    world.message = "Time expired. The Labyrinth keeps you.";
    world.messageTtl = 99;
    return;
  }

  if (world.time >= world.labyrinth.nextMutationAt) {
    mutateLabyrinth(world);
    world.labyrinth.nextMutationAt =
      world.time + world.labyrinth.mutationInterval;
  }
}
