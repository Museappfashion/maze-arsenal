// src/game/gameplay-enhanced.js
import {
  updateEnemies as updateEnemiesCore,
  visibleStrengthAt,
} from "./gameplay.js";
import {
  VIEW_3D_FOV,
  VIEW_3D_MAX_DISTANCE,
} from "../config/constants.js";
import { hasLineOfSight } from "./maze.js";
import { angleDelta } from "../utils/math.js";

export * from "./gameplay.js";

const TWO_D_VISIBLE_THRESHOLD = 0.12;
const THREE_D_FOV_MARGIN = 0.08;

function enemyIsInPlayerFieldOfVision(world, enemy) {
  if (!world || !enemy) {
    return false;
  }

  if (world.viewMode !== "3d") {
    return (
      visibleStrengthAt(
        world,
        Math.floor(enemy.x),
        Math.floor(enemy.y),
      ) > TWO_D_VISIBLE_THRESHOLD
    );
  }

  const dx = enemy.x - world.player.x;
  const dy = enemy.y - world.player.y;
  const distance = Math.hypot(dx, dy);

  if (distance > VIEW_3D_MAX_DISTANCE) {
    return false;
  }

  const angleToEnemy = Math.atan2(dy, dx);
  const angularDistance = Math.abs(
    angleDelta(angleToEnemy, world.player.facing),
  );

  if (angularDistance > VIEW_3D_FOV / 2 + THREE_D_FOV_MARGIN) {
    return false;
  }

  return hasLineOfSight(
    world,
    world.player.x,
    world.player.y,
    enemy.x,
    enemy.y,
  );
}

function holdUnseenPursuitAtBaseSpeed(world) {
  for (const enemy of world.enemies ?? []) {
    if (enemy.pursuitVisionSeen) {
      continue;
    }

    if (enemyIsInPlayerFieldOfVision(world, enemy)) {
      enemy.pursuitVisionSeen = true;
      enemy.pursuitStartedAt = world.time;
      continue;
    }

    if (enemy.awake) {
      enemy.pursuitStartedAt = world.time;
    }
  }
}

export function updateEnemies(world, dt) {
  holdUnseenPursuitAtBaseSpeed(world);
  updateEnemiesCore(world, dt);
  holdUnseenPursuitAtBaseSpeed(world);
}
