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
  LABYRINTH_LIGHT_HOTKEY_MAP,
  LABYRINTH_LIGHT_ORDER,
  LABYRINTH_LIGHTS,
  createOwnedLabyrinthLights,
} from "../config/labyrinthLights.js";
import {
  bfsDistances,
  collectFloorTiles,
  generateMaze,
  logicalCellOrigin,
} from "./maze.js";
import {
  clamp,
  indexOfTile,
  tileCenter,
} from "../utils/math.js";

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
    lastShiftAt: -Infinity,
    equippedLight: null,
    ownedLights: createOwnedLabyrinthLights(),
  };
}

function queueLabyrinthAudio(world, type, detail = {}) {
  if (!Array.isArray(world.audioEvents)) {
    world.audioEvents = [];
  }

  if (world.audioEvents.length < 48) {
    world.audioEvents.push({ type, ...detail });
  }
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

function refreshTopologyCaches(world) {
  world.floorTiles = collectFloorTiles(world);
  world.floorCount = world.floorTiles.length;
  world.distanceTimer = 0;
  world.distanceFieldDirty = true;
  world.minimapDirty = true;
}

function findNearestFloorTile(world, startX, startY) {
  const maxRadius = Math.max(world.width, world.height);

  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const dy = radius - Math.abs(dx);

      for (const sign of dy === 0 ? [1] : [-1, 1]) {
        const x = startX + dx;
        const y = startY + dy * sign;

        if (
          x > 0 &&
          y > 0 &&
          x < world.width - 1 &&
          y < world.height - 1 &&
          world.grid[y][x] === FLOOR
        ) {
          return { x, y };
        }
      }
    }
  }

  return null;
}

function carvePathToFloor(world, tileX, tileY) {
  const target = findNearestFloorTile(world, tileX, tileY);
  if (!target) {
    return;
  }

  let x = tileX;
  let y = tileY;
  world.grid[y][x] = FLOOR;

  while (x !== target.x) {
    x += Math.sign(target.x - x);
    if (x > 0 && x < world.width - 1) {
      world.grid[y][x] = FLOOR;
    }
  }

  while (y !== target.y) {
    y += Math.sign(target.y - y);
    if (y > 0 && y < world.height - 1) {
      world.grid[y][x] = FLOOR;
    }
  }
}

function preservePlayerPosition(world) {
  const player = world.player;
  const centerTileX = clamp(Math.floor(player.x), 1, world.width - 2);
  const centerTileY = clamp(Math.floor(player.y), 1, world.height - 2);
  const clearance = player.radius + 0.08;
  const minX = clamp(Math.floor(player.x - clearance), 1, world.width - 2);
  const maxX = clamp(Math.floor(player.x + clearance), 1, world.width - 2);
  const minY = clamp(Math.floor(player.y - clearance), 1, world.height - 2);
  const maxY = clamp(Math.floor(player.y + clearance), 1, world.height - 2);

  carvePathToFloor(world, centerTileX, centerTileY);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      world.grid[y][x] = FLOOR;
    }
  }
}

function preserveExitPosition(world) {
  const x = clamp(world.exit.x, 1, world.width - 2);
  const y = clamp(world.exit.y, 1, world.height - 2);
  carvePathToFloor(world, x, y);
  world.grid[y][x] = FLOOR;
}

export function markSteelWalls(world) {
  const chance = world.labyrinth.steelChance;
  world.labyrinth.steelSegments = [];

  for (let y = 0; y < world.logicalRows; y += 1) {
    for (let x = 0; x < world.logicalCols; x += 1) {
      if (x + 1 < world.logicalCols && !world.connections[y][x].e) {
        const tiles = getConnectionTiles(x, y, "e");
        if (
          tiles.every((tile) => world.grid[tile.y][tile.x] === WALL) &&
          Math.random() < chance
        ) {
          for (const tile of tiles) {
            world.grid[tile.y][tile.x] = STEEL_WALL;
          }
          world.labyrinth.steelSegments.push({
            x,
            y,
            direction: "e",
          });
        }
      }

      if (y + 1 < world.logicalRows && !world.connections[y][x].s) {
        const tiles = getConnectionTiles(x, y, "s");
        if (
          tiles.every((tile) => world.grid[tile.y][tile.x] === WALL) &&
          Math.random() < chance
        ) {
          for (const tile of tiles) {
            world.grid[tile.y][tile.x] = STEEL_WALL;
          }
          world.labyrinth.steelSegments.push({
            x,
            y,
            direction: "s",
          });
        }
      }
    }
  }
}

function buildPickupCandidates(world, distances, used) {
  const exitDistance = Math.max(
    1,
    distances[indexOfTile(world.width, world.exit.x, world.exit.y)],
  );

  const candidates = world.floorTiles
    .filter((tile) => {
      const key = indexOfTile(world.width, tile.x, tile.y);
      const distance = distances[key];
      return (
        !used.has(key) &&
        distance > 8 &&
        distance >= 0 &&
        distance < exitDistance * 0.98
      );
    })
    .sort(
      (a, b) =>
        distances[indexOfTile(world.width, a.x, a.y)] -
        distances[indexOfTile(world.width, b.x, b.y)],
    );

  if (candidates.length) {
    return candidates;
  }

  return world.floorTiles.filter(
    (tile) => !used.has(indexOfTile(world.width, tile.x, tile.y)),
  );
}

function chooseProgressionTile(candidates, index, count, used, world) {
  if (!candidates.length) {
    return null;
  }

  const progress = (index + 1) / (count + 1);
  const targetIndex = Math.min(
    candidates.length - 1,
    Math.floor(progress * candidates.length),
  );
  const spread = Math.max(3, Math.floor(candidates.length / Math.max(4, count)));
  const jitter = Math.floor((Math.random() - 0.5) * spread * 2);

  const startIndex = clamp(
    targetIndex + jitter,
    0,
    candidates.length - 1,
  );

  for (let offset = 0; offset < candidates.length; offset += 1) {
    const candidateIndex = (startIndex + offset) % candidates.length;
    const tile = candidates[candidateIndex];
    const key = indexOfTile(world.width, tile.x, tile.y);

    if (!used.has(key)) {
      used.add(key);
      return tile;
    }
  }

  return null;
}

export function placeLabyrinthLights(
  world,
  distances,
  used,
  lightKeys = LABYRINTH_LIGHT_ORDER,
) {
  const keys = lightKeys.filter((key) => LABYRINTH_LIGHTS[key]);
  const candidates = buildPickupCandidates(world, distances, used);

  keys.forEach((lightKey, index) => {
    const tile = chooseProgressionTile(
      candidates,
      index,
      keys.length,
      used,
      world,
    );

    if (!tile) {
      return;
    }

    const light = LABYRINTH_LIGHTS[lightKey];
    const center = tileCenter(tile);
    world.pickups.push({
      id: `labyrinth-light-${lightKey}-${world.nextId++}`,
      type: "labyrinthLight",
      lightKey,
      label: light.label,
      x: center.x,
      y: center.y,
      radius: 0.28,
      color: light.color,
    });
  });
}

export function placeLabyrinthBreakers(
  world,
  distances,
  used,
  requestedCount = world.labyrinth.breakerPickupCount,
) {
  const count = Math.max(0, Math.round(requestedCount));
  const candidates = buildPickupCandidates(world, distances, used);

  for (let index = 0; index < count; index += 1) {
    const tile = chooseProgressionTile(
      candidates,
      index,
      count,
      used,
      world,
    );

    if (!tile) {
      break;
    }

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

function placeLabyrinthPickups(
  world,
  distances,
  breakerCount,
  lightKeys,
) {
  const playerTileX = clamp(Math.floor(world.player.x), 0, world.width - 1);
  const playerTileY = clamp(Math.floor(world.player.y), 0, world.height - 1);
  const used = new Set([
    indexOfTile(world.width, playerTileX, playerTileY),
    indexOfTile(world.width, world.exit.x, world.exit.y),
  ]);

  placeLabyrinthLights(world, distances, used, lightKeys);
  placeLabyrinthBreakers(world, distances, used, breakerCount);
}

function getUncollectedLightKeys(world) {
  return LABYRINTH_LIGHT_ORDER.filter(
    (key) => !world.labyrinth.ownedLights[key],
  );
}

function regenerateLabyrinth(world) {
  const breakerCount = world.pickups.filter(
    (pickup) => pickup.type === "labyrinthBreaker",
  ).length;
  const uncollectedLightKeys = getUncollectedLightKeys(world);
  const nextMaze = generateMaze(
    world.logicalCols,
    world.logicalRows,
    world.level,
  );

  world.grid = nextMaze.grid;
  world.width = nextMaze.width;
  world.height = nextMaze.height;
  world.connections = nextMaze.connections;
  world.logicalCols = nextMaze.logicalCols;
  world.logicalRows = nextMaze.logicalRows;

  preservePlayerPosition(world);
  preserveExitPosition(world);
  markSteelWalls(world);
  refreshTopologyCaches(world);

  const playerTile = {
    x: clamp(Math.floor(world.player.x), 0, world.width - 1),
    y: clamp(Math.floor(world.player.y), 0, world.height - 1),
  };
  const distances = bfsDistances(world, playerTile);
  const exitIndex = indexOfTile(world.width, world.exit.x, world.exit.y);
  const exitDistance = distances[exitIndex];

  if (exitDistance < 0) {
    preserveExitPosition(world);
    refreshTopologyCaches(world);
  }

  const finalDistances = bfsDistances(world, playerTile);
  world.exit = {
    ...world.exit,
    distance: Math.max(0, finalDistances[exitIndex]),
  };
  world.pickups = [];
  placeLabyrinthPickups(
    world,
    finalDistances,
    breakerCount,
    uncollectedLightKeys,
  );

  world.distanceField = new Int32Array(world.width * world.height);
  world.discovered = new Uint8Array(world.width * world.height);
  world.player.discoveredFloor = 0;
  world.lastPlayerTile = playerTile;
  refreshTopologyCaches(world);
}

export function mutateLabyrinth(world) {
  if (!isLabyrinthWorld(world) || world.gameOver || world.victory) {
    return false;
  }

  regenerateLabyrinth(world);
  world.labyrinth.mutationNumber += 1;
  world.labyrinth.lastShiftAt = world.time;
  world.message = "the labyrinth shifts";
  world.messageTtl = 1.6;
  queueLabyrinthAudio(world, "labyrinthShift");
  return true;
}

export function initializeLabyrinth(world) {
  const distances = bfsDistances(world, world.start);
  const exit = chooseExitByTargetDistance(world, distances);

  if (exit) {
    world.exit = exit;
  }

  markSteelWalls(world);
  refreshTopologyCaches(world);

  const initialDistances = bfsDistances(world, world.start);
  placeLabyrinthPickups(
    world,
    initialDistances,
    world.labyrinth.breakerPickupCount,
    LABYRINTH_LIGHT_ORDER,
  );
  refreshTopologyCaches(world);
}

export function collectLabyrinthLight(world, lightKey) {
  if (!isLabyrinthWorld(world) || !LABYRINTH_LIGHTS[lightKey]) {
    return false;
  }

  if (world.labyrinth.ownedLights[lightKey]) {
    return false;
  }

  world.labyrinth.ownedLights[lightKey] = true;
  if (!world.labyrinth.equippedLight) {
    world.labyrinth.equippedLight = lightKey;
  }

  const light = LABYRINTH_LIGHTS[lightKey];
  const index = LABYRINTH_LIGHT_ORDER.indexOf(lightKey);
  const hotkey = index === 9 ? "0" : String(index + 1);

  world.message =
    `${light.label} found — ${hotkey} selects it`;
  world.messageTtl = 1.4;
  queueLabyrinthAudio(world, "pickupLight", { lightKey });
  return true;
}

export function selectLabyrinthLight(world, lightKey) {
  if (
    !isLabyrinthWorld(world) ||
    !LABYRINTH_LIGHTS[lightKey] ||
    !world.labyrinth.ownedLights[lightKey]
  ) {
    return false;
  }

  world.labyrinth.equippedLight = lightKey;
  world.message = `${LABYRINTH_LIGHTS[lightKey].label} equipped`;
  world.messageTtl = 0.9;
  queueLabyrinthAudio(world, "lightSelect", { lightKey });
  return true;
}

export function selectLabyrinthLightByHotkey(world, key) {
  const lightKey = LABYRINTH_LIGHT_HOTKEY_MAP[key];
  return lightKey ? selectLabyrinthLight(world, lightKey) : false;
}

export function selectNextLabyrinthLight(world) {
  if (!isLabyrinthWorld(world)) {
    return false;
  }

  const owned = LABYRINTH_LIGHT_ORDER.filter(
    (key) => world.labyrinth.ownedLights[key],
  );

  if (!owned.length) {
    world.message = "No light tools collected";
    world.messageTtl = 0.9;
    return false;
  }

  const currentIndex = owned.indexOf(world.labyrinth.equippedLight);
  const nextKey = owned[(currentIndex + 1 + owned.length) % owned.length];
  return selectLabyrinthLight(world, nextKey);
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
