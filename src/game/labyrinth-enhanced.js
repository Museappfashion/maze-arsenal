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
  initializeLabyrinth as initializeLabyrinthCore,
  updateLabyrinth as updateLabyrinthCore,
} from "./labyrinth.js?core";
import {
  bfsDistances,
  collectFloorTiles,
  hasLineOfSight,
} from "./maze.js";

export * from "./labyrinth.js?core";

const VISIBLE_THRESHOLD_2D = 0.12;
const VISIBLE_THRESHOLD_3D = 0.08;
const THREE_D_FOV_MARGIN = 0.08;

function isTrackedLabyrinthPickup(pickup) {
  return [
    "labyrinthLight",
    "labyrinthBreaker",
    "powerup",
  ].includes(pickup?.type);
}

function pickupIsInFieldOfVision(world, pickup) {
  if (!isTrackedLabyrinthPickup(pickup)) {
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
  const angleToPickup = Math.atan2(dy, dx);
  const angularDistance = Math.abs(
    angleDelta(
      angleToPickup,
      world.player.facing,
    ),
  );

  if (
    angularDistance >
    VIEW_3D_FOV / 2 + THREE_D_FOV_MARGIN
  ) {
    return false;
  }

  if (
    !hasLineOfSight(
      world,
      world.player.x,
      world.player.y,
      pickup.x,
      pickup.y,
    )
  ) {
    return false;
  }

  return (
    distance <= world.labyrinth.sightRadius + 2.4 ||
    lightStrength > VISIBLE_THRESHOLD_3D
  );
}

function anchorVisiblePickups(world) {
  for (const pickup of world.pickups ?? []) {
    if (
      !pickup.anchoredInVision &&
      pickupIsInFieldOfVision(world, pickup)
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

function findReplacementIndex(
  pickups,
  anchoredPickup,
) {
  if (anchoredPickup.type === "labyrinthLight") {
    return pickups.findIndex(
      (pickup) =>
        pickup.type === "labyrinthLight" &&
        pickup.lightKey === anchoredPickup.lightKey,
    );
  }

  if (anchoredPickup.type === "labyrinthBreaker") {
    return pickups.findIndex(
      (pickup) =>
        pickup.type === "labyrinthBreaker" &&
        !pickup.anchoredInVision,
    );
  }

  if (anchoredPickup.type === "powerup") {
    return pickups.findIndex(
      (pickup) =>
        pickup.type === "powerup" &&
        pickup.powerUp === anchoredPickup.powerUp,
    );
  }

  return -1;
}

function isInteriorTile(world, x, y) {
  return (
    x > 0 &&
    y > 0 &&
    x < world.width - 1 &&
    y < world.height - 1
  );
}

function carvePathToNearestFloor(
  world,
  startX,
  startY,
) {
  const existingFloors = collectFloorTiles(world)
    .filter(
      (tile) =>
        tile.x !== startX ||
        tile.y !== startY,
    );

  if (!existingFloors.length) {
    return;
  }

  let nearest = existingFloors[0];
  let nearestDistance =
    Math.abs(nearest.x - startX) +
    Math.abs(nearest.y - startY);

  for (const tile of existingFloors.slice(1)) {
    const distance =
      Math.abs(tile.x - startX) +
      Math.abs(tile.y - startY);

    if (distance < nearestDistance) {
      nearest = tile;
      nearestDistance = distance;
    }
  }

  let x = startX;
  let y = startY;

  while (x !== nearest.x) {
    x += Math.sign(nearest.x - x);

    if (isInteriorTile(world, x, y)) {
      world.grid[y][x] = FLOOR;
    }
  }

  while (y !== nearest.y) {
    y += Math.sign(nearest.y - y);

    if (isInteriorTile(world, x, y)) {
      world.grid[y][x] = FLOOR;
    }
  }
}

function keepPickupTileWalkable(world, pickup) {
  const tileX = Math.floor(pickup.x);
  const tileY = Math.floor(pickup.y);

  if (!isInteriorTile(world, tileX, tileY)) {
    return;
  }

  const currentTile = world.grid[tileY][tileX];

  if (
    currentTile === WALL ||
    currentTile === STEEL_WALL
  ) {
    world.grid[tileY][tileX] = FLOOR;
  }

  const neighbors = [
    [tileX + 1, tileY],
    [tileX - 1, tileY],
    [tileX, tileY + 1],
    [tileX, tileY - 1],
  ];

  const connected = neighbors.some(
    ([x, y]) =>
      isInteriorTile(world, x, y) &&
      world.grid[y][x] === FLOOR,
  );

  if (!connected) {
    carvePathToNearestFloor(
      world,
      tileX,
      tileY,
    );
  }
}

function restoreAnchoredPickups(
  world,
  anchoredPickups,
) {
  if (!anchoredPickups.length) {
    return;
  }

  const nextPickups = [...(world.pickups ?? [])];

  for (const anchoredPickup of anchoredPickups) {
    const replacementIndex =
      findReplacementIndex(
        nextPickups,
        anchoredPickup,
      );

    if (replacementIndex >= 0) {
      nextPickups.splice(replacementIndex, 1);
    }

    keepPickupTileWalkable(
      world,
      anchoredPickup,
    );
    nextPickups.push({
      ...anchoredPickup,
      anchoredInVision: true,
    });
  }

  world.pickups = nextPickups;
  world.floorTiles = collectFloorTiles(world);
  world.floorCount = world.floorTiles.length;
  world.minimapDirty = true;
  world.distanceFieldDirty = true;
}

function interleavePickups(pickups) {
  const lights = pickups.filter(
    (pickup) => pickup.type === "labyrinthLight",
  );
  const breakers = pickups.filter(
    (pickup) => pickup.type === "labyrinthBreaker",
  );
  const plan = [];
  let lightIndex = 0;
  let breakerIndex = 0;

  while (
    lightIndex < lights.length ||
    breakerIndex < breakers.length
  ) {
    const lightProgress =
      lights.length > 0
        ? lightIndex / lights.length
        : Infinity;
    const breakerProgress =
      breakers.length > 0
        ? breakerIndex / breakers.length
        : Infinity;

    if (
      lightIndex < lights.length &&
      (
        breakerIndex >= breakers.length ||
        lightProgress <= breakerProgress
      )
    ) {
      plan.push(lights[lightIndex]);
      lightIndex += 1;
    } else {
      plan.push(breakers[breakerIndex]);
      breakerIndex += 1;
    }
  }

  return plan;
}

function chooseCandidate(
  candidates,
  targetIndex,
  used,
) {
  for (
    let offset = 0;
    offset < candidates.length;
    offset += 1
  ) {
    for (const direction of [1, -1]) {
      const index =
        targetIndex + offset * direction;

      if (
        index < 0 ||
        index >= candidates.length
      ) {
        continue;
      }

      const candidate = candidates[index];

      if (!used.has(candidate.key)) {
        used.add(candidate.key);
        return candidate;
      }
    }
  }

  return null;
}

function redistributeUnanchoredPickups(world) {
  if (!world?.labyrinthMode) {
    return;
  }

  const pickups = world.pickups ?? [];
  const movable = pickups.filter(
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

  const stationary = pickups.filter(
    (pickup) => !movable.includes(pickup),
  );

  const playerTile = {
    x: Math.floor(world.player.x),
    y: Math.floor(world.player.y),
  };
  const distances = bfsDistances(
    world,
    playerTile,
  );
  const used = new Set();

  used.add(
    indexOfTile(
      world.width,
      playerTile.x,
      playerTile.y,
    ),
  );
  used.add(
    indexOfTile(
      world.width,
      world.exit.x,
      world.exit.y,
    ),
  );

  for (const pickup of stationary) {
    used.add(
      indexOfTile(
        world.width,
        Math.floor(pickup.x),
        Math.floor(pickup.y),
      ),
    );
  }

  const candidates = collectFloorTiles(world)
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

  const plan = interleavePickups(movable);
  const redistributed = [];

  for (
    let index = 0;
    index < plan.length;
    index += 1
  ) {
    const progress =
      (index + 0.5) / plan.length;
    const targetIndex = Math.min(
      candidates.length - 1,
      Math.floor(
        progress * candidates.length,
      ),
    );
    const tile = chooseCandidate(
      candidates,
      targetIndex,
      used,
    );

    if (!tile) {
      redistributed.push(plan[index]);
      continue;
    }

    const center = tileCenter(tile);

    redistributed.push({
      ...plan[index],
      x: center.x,
      y: center.y,
    });
  }

  world.pickups = [
    ...stationary,
    ...redistributed,
  ];
  world.floorTiles = collectFloorTiles(world);
  world.floorCount = world.floorTiles.length;
  world.minimapDirty = true;
  world.distanceFieldDirty = true;
}

export function initializeLabyrinth(world) {
  initializeLabyrinthCore(world);
  redistributeUnanchoredPickups(world);

  if (typeof globalThis !== "undefined") {
    globalThis.__mistMazeWorld = world;
  }
}

export function updateLabyrinth(world) {
  if (!world?.labyrinthMode) {
    updateLabyrinthCore(world);
    return;
  }

  anchorVisiblePickups(world);

  const anchoredPickups =
    cloneAnchoredPickups(world);
  const previousMutationNumber =
    world.labyrinth.mutationNumber;

  updateLabyrinthCore(world);

  if (
    world.labyrinth.mutationNumber !==
    previousMutationNumber
  ) {
    restoreAnchoredPickups(
      world,
      anchoredPickups,
    );
    redistributeUnanchoredPickups(world);
  }

  if (typeof globalThis !== "undefined") {
    globalThis.__mistMazeWorld = world;
  }
}
