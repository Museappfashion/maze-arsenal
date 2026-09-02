// src/game/gameplay-enhanced.js
import {
  VIEW_3D_FOV,
  VIEW_3D_MAX_DISTANCE,
} from "../config/constants.js";
import {
  GLOBAL_LEADERBOARD_ENABLED,
  startGlobalLeaderboardRun,
} from "../services/leaderboard-enhanced.js";
import { angleDelta } from "../utils/math.js";
import {
  updateEnemies as updateEnemiesCore,
  updatePlayer as updatePlayerCore,
  visibleStrengthAt,
} from "./gameplay.js?core";
import { hasLineOfSight } from "./maze.js";

export * from "./gameplay.js?core";

const TWO_D_VISIBLE_THRESHOLD = 0.12;
const THREE_D_FOV_MARGIN = 0.08;

function exposeWorld(world) {
  if (typeof globalThis !== "undefined") {
    globalThis.__mistMazeWorld = world;
  }
}

function ensureLeaderboardRunStarted(world) {
  if (
    !GLOBAL_LEADERBOARD_ENABLED ||
    !world ||
    world.__leaderboardRunStarted ||
    world.labyrinthMode ||
    world.leaderboardEligible === false ||
    world.level?.leaderboard === false ||
    world.gameOver ||
    world.victory
  ) {
    return;
  }

  world.__leaderboardRunStarted = true;
  world.__leaderboardRunPromise =
    startGlobalLeaderboardRun(
      world.level.key,
      world.runMode,
    ).catch((error) => {
      console.warn(
        "Leaderboard run start failed:",
        error,
      );
      return null;
    });
}

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
    angleDelta(
      angleToEnemy,
      world.player.facing,
    ),
  );

  if (
    angularDistance >
    VIEW_3D_FOV / 2 + THREE_D_FOV_MARGIN
  ) {
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

export function updatePlayer(world, keys, dt) {
  ensureLeaderboardRunStarted(world);
  const result = updatePlayerCore(world, keys, dt);
  exposeWorld(world);
  return result;
}

export function updateEnemies(world, dt) {
  holdUnseenPursuitAtBaseSpeed(world);
  updateEnemiesCore(world, dt);
  holdUnseenPursuitAtBaseSpeed(world);
  exposeWorld(world);
}
