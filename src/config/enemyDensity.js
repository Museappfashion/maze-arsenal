// src/config/enemyDensity.js

export const TILES_PER_ENEMY_BY_LEVEL = Object.freeze({
  level0: 150,
  level1: 96,
  level2: 52,
  level3: 41,
});

export function getTargetEnemyCount(world) {
  const tilesPerEnemy =
    TILES_PER_ENEMY_BY_LEVEL[world?.levelKey];

  if (
    !Number.isFinite(tilesPerEnemy) ||
    tilesPerEnemy <= 0 ||
    !Number.isFinite(world?.width) ||
    !Number.isFinite(world?.height)
  ) {
    return null;
  }

  const totalTiles =
    world.width * world.height;

  return Math.max(
    1,
    Math.round(
      totalTiles / tilesPerEnemy,
    ),
  );
}
