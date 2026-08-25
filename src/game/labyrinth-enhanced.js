// src/game/labyrinth-enhanced.js
import {
  updateLabyrinth as updateLabyrinthCore,
} from "./labyrinth.js";
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
  collectFloorTiles,
  hasLineOfSight,
} from "./maze.js";
import { angleDelta } from "../utils/math.js";

export * from "./labyrinth.js";

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

  const lightStrength = getLabyrinthLightStrength(
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
    angleDelta(angleToPickup, world.player.facing),
  );

  if (angularDistance > VIEW_3D_FOV / 2 + THREE_D_FOV_MARGIN) {
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

function findReplacementIndex(pickups, anchoredPickup) {
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

function carvePathToNearestFloor(world, startX, startY) {
  const existingFloors = collectFloorTiles(world).filter(
    (tile) => tile.x !== startX || tile.y !== startY,
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

  if (currentTile === WALL || currentTile === STEEL_WALL) {
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
    carvePathToNearestFloor(world, tileX, tileY);
  }
}

function restoreAnchoredPickups(world, anchoredPickups) {
  if (!anchoredPickups.length) {
    return;
  }

  const nextPickups = [...(world.pickups ?? [])];

  for (const anchoredPickup of anchoredPickups) {
    const replacementIndex = findReplacementIndex(
      nextPickups,
      anchoredPickup,
    );

    if (replacementIndex >= 0) {
      nextPickups.splice(replacementIndex, 1);
    }

    keepPickupTileWalkable(world, anchoredPickup);
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

export function updateLabyrinth(world) {
  if (!world?.labyrinthMode) {
    updateLabyrinthCore(world);
    return;
  }

  anchorVisiblePickups(world);

  const anchoredPickups = cloneAnchoredPickups(world);
  const previousMutationNumber =
    world.labyrinth.mutationNumber;

  updateLabyrinthCore(world);

  if (
    world.labyrinth.mutationNumber !== previousMutationNumber
  ) {
    restoreAnchoredPickups(world, anchoredPickups);
  }
}
