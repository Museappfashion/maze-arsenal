// src/game/labyrinth-enhanced.js
import {
  FLOOR,
  STEEL_WALL,
  VIEW_3D_FOV,
  WALL,
} from "../config/constants.js";
import {
  getLabyrinthLightStrength,
} from "../config/labyrinthLights.js";
import {
  angleDelta,
  indexOfTile,
  tileCenter,
} from "../utils/math.js";
import {
  bfsDistances,
  collectFloorTiles,
  hasLineOfSight,
} from "./maze.js";
import * as core from "./labyrinth.js?core";

export * from "./labyrinth.js?core";

const VISIBLE_THRESHOLD_2D = 0.12;
const VISIBLE_THRESHOLD_3D = 0.08;

function isTrackedPickup(pickup) {
  return [
    "labyrinthLight",
    "labyrinthBreaker",
    "powerup",
  ].includes(pickup?.type);
}

function pickupIsVisible(world, pickup) {
  if (!isTrackedPickup(pickup)) {
    return false;
  }

  const lightStrength =
    getLabyrinthLightStrength(
      world,
      pickup.x,
      pickup.y,
    );

  if (world.viewMode !== "3d") {
    return lightStrength > VISIBLE_THRESHOLD_2D;
  }

  const dx = pickup.x - world.player.x;
  const dy = pickup.y - world.player.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  return (
    Math.abs(
      angleDelta(angle, world.player.facing),
    ) <= VIEW_3D_FOV / 2 + 0.08 &&
    hasLineOfSight(
      world,
      world.player.x,
      world.player.y,
      pickup.x,
      pickup.y,
    ) &&
    (
      distance <= world.labyrinth.sightRadius + 2.4 ||
      lightStrength > VISIBLE_THRESHOLD_3D
    )
  );
}

function markVisiblePickups(world) {
  for (const pickup of world.pickups ?? []) {
    if (
      !pickup.anchoredInVision &&
      pickupIsVisible(world, pickup)
    ) {
      pickup.anchoredInVision = true;
    }
  }
}

function cloneAnchoredPickups(world) {
  return (world.pickups ?? [])
    .filter((pickup) => pickup.anchoredInVision)
    .map((pickup) => ({ ...pickup }));
}

function isInterior(world, x, y) {
  return (
    x > 0 &&
    y > 0 &&
    x < world.width - 1 &&
    y < world.height - 1
  );
}

function carveConnection(world, startX, startY) {
  const floors = collectFloorTiles(world)
    .filter(
      (tile) =>
        tile.x !== startX ||
        tile.y !== startY,
    );

  if (!floors.length) {
    return;
  }

  let target = floors[0];
  let best =
    Math.abs(target.x - startX) +
    Math.abs(target.y - startY);

  for (const tile of floors.slice(1)) {
    const distance =
      Math.abs(tile.x - startX) +
      Math.abs(tile.y - startY);

    if (distance < best) {
      target = tile;
      best = distance;
    }
  }

  let x = startX;
  let y = startY;

  while (x !== target.x) {
    x += Math.sign(target.x - x);

    if (isInterior(world, x, y)) {
      world.grid[y][x] = FLOOR;
    }
  }

  while (y !== target.y) {
    y += Math.sign(target.y - y);

    if (isInterior(world, x, y)) {
      world.grid[y][x] = FLOOR;
    }
  }
}

function keepPickupWalkable(world, pickup) {
  const x = Math.floor(pickup.x);
  const y = Math.floor(pickup.y);

  if (!isInterior(world, x, y)) {
    return;
  }

  if (
    world.grid[y][x] === WALL ||
    world.grid[y][x] === STEEL_WALL
  ) {
    world.grid[y][x] = FLOOR;
  }

  const connected = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ].some(
    ([nx, ny]) =>
      isInterior(world, nx, ny) &&
      world.grid[ny][nx] === FLOOR,
  );

  if (!connected) {
    carveConnection(world, x, y);
  }
}

function findReplacementIndex(pickups, anchored) {
  if (anchored.type === "labyrinthLight") {
    return pickups.findIndex(
      (pickup) =>
        pickup.type === "labyrinthLight" &&
        pickup.lightKey === anchored.lightKey,
    );
  }

  if (anchored.type === "labyrinthBreaker") {
    return pickups.findIndex(
      (pickup) =>
        pickup.type === "labyrinthBreaker" &&
        !pickup.anchoredInVision,
    );
  }

  return -1;
}

function restoreAnchoredPickups(world, anchored) {
  const next = [...(world.pickups ?? [])];

  for (const pickup of anchored) {
    const replacement =
      findReplacementIndex(next, pickup);

    if (replacement >= 0) {
      next.splice(replacement, 1);
    }

    keepPickupWalkable(world, pickup);
    next.push({
      ...pickup,
      anchoredInVision: true,
    });
  }

  world.pickups = next;
  world.floorTiles = collectFloorTiles(world);
  world.floorCount = world.floorTiles.length;
  world.minimapDirty = true;
  world.distanceFieldDirty = true;
}

function interleave(itemsA, itemsB) {
  const result = [];
  let a = 0;
  let b = 0;

  while (
    a < itemsA.length ||
    b < itemsB.length
  ) {
    const aProgress =
      itemsA.length
        ? a / itemsA.length
        : Infinity;
    const bProgress =
      itemsB.length
        ? b / itemsB.length
        : Infinity;

    if (
      a < itemsA.length &&
      (
        b >= itemsB.length ||
        aProgress <= bProgress
      )
    ) {
      result.push(itemsA[a]);
      a += 1;
    } else {
      result.push(itemsB[b]);
      b += 1;
    }
  }

  return result;
}

function redistributePickups(world) {
  if (!world.labyrinthMode) {
    return;
  }

  const movable = (world.pickups ?? []).filter(
    (pickup) =>
      !pickup.anchoredInVision &&
      (
        pickup.type === "labyrinthLight" ||
        pickup.type === "labyrinthBreaker"
      ),
  );

  if (!movable.length) {
    return;
  }

  const stationary = world.pickups.filter(
    (pickup) => !movable.includes(pickup),
  );
  const playerTile = {
    x: Math.floor(world.player.x),
    y: Math.floor(world.player.y),
  };
  const distances =
    bfsDistances(world, playerTile);
  const used = new Set([
    indexOfTile(
      world.width,
      playerTile.x,
      playerTile.y,
    ),
    indexOfTile(
      world.width,
      world.exit.x,
      world.exit.y,
    ),
  ]);

  for (const pickup of stationary) {
    used.add(
      indexOfTile(
        world.width,
        Math.floor(pickup.x),
        Math.floor(pickup.y),
      ),
    );
  }

  const candidates =
    collectFloorTiles(world)
      .map((tile) => {
        const key = indexOfTile(
          world.width,
          tile.x,
          tile.y,
        );

        return {
          ...tile,
          key,
          distance: distances[key],
        };
      })
      .filter(
        (tile) =>
          tile.distance >= 4 &&
          !used.has(tile.key),
      )
      .sort(
        (a, b) =>
          a.distance - b.distance,
      );

  if (!candidates.length) {
    return;
  }

  const plan = interleave(
    movable.filter(
      (pickup) =>
        pickup.type === "labyrinthLight",
    ),
    movable.filter(
      (pickup) =>
        pickup.type === "labyrinthBreaker",
    ),
  );
  const relocated = [];

  for (
    let index = 0;
    index < plan.length;
    index += 1
  ) {
    const target = Math.min(
      candidates.length - 1,
      Math.floor(
        ((index + 0.5) / plan.length) *
          candidates.length,
      ),
    );

    let chosen = null;

    for (
      let offset = 0;
      offset < candidates.length;
      offset += 1
    ) {
      for (const direction of [1, -1]) {
        const candidateIndex =
          target + offset * direction;

        if (
          candidateIndex < 0 ||
          candidateIndex >= candidates.length
        ) {
          continue;
        }

        const candidate =
          candidates[candidateIndex];

        if (!used.has(candidate.key)) {
          chosen = candidate;
          used.add(candidate.key);
          break;
        }
      }

      if (chosen) {
        break;
      }
    }

    if (!chosen) {
      relocated.push(plan[index]);
      continue;
    }

    const center = tileCenter(chosen);

    relocated.push({
      ...plan[index],
      x: center.x,
      y: center.y,
    });
  }

  world.pickups = [
    ...stationary,
    ...relocated,
  ];
  world.minimapDirty = true;
  world.distanceFieldDirty = true;
}

export function initializeLabyrinth(world) {
  core.initializeLabyrinth(world);
  redistributePickups(world);
}

export function updateLabyrinth(world) {
  if (!world?.labyrinthMode) {
    core.updateLabyrinth(world);
    return;
  }

  markVisiblePickups(world);

  const anchored =
    cloneAnchoredPickups(world);
  const mutationNumber =
    world.labyrinth.mutationNumber;

  core.updateLabyrinth(world);

  if (
    world.labyrinth.mutationNumber !==
    mutationNumber
  ) {
    restoreAnchoredPickups(
      world,
      anchored,
    );
    redistributePickups(world);
  }
}
