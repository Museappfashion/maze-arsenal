// src/config/enemyDensity.js

export const TILES_PER_ENEMY_BY_LEVEL = Object.freeze({
  level0: 150,
  level1: 96,
  level2: 52,
  level3: 41,
});

// These area targets were tuned with the previous population settings. Apply
// subsequent population changes here too, so final density enforcement does
// not refill enemies removed by the encounter spawner.
const POPULATION_AT_DENSITY_BASELINE = Object.freeze({
  level2: 1.35,
  level3: 1.7,
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
  const baselinePopulation = POPULATION_AT_DENSITY_BASELINE[world.levelKey];
  const population = world.level?.enemyPopulationMultiplier;
  const populationScale = baselinePopulation && Number.isFinite(population) && population > 0
    ? population / baselinePopulation
    : 1;

  return Math.max(
    1,
    Math.round(
      totalTiles / tilesPerEnemy * populationScale,
    ),
  );
}
