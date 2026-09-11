// src/game/world-enhanced.js
import {
  getTargetEnemyCount,
} from "../config/enemyDensity.js";
import {
  markLegendaryPowerUps,
} from "../config/legendaryPowerUps.js";
import {
  applySpecialPlayerLoadout,
} from "../config/specialPlayers.js";
import {
  addEnemy,
} from "./gameplay.js?core";
import {
  createWorld as createWorldCore,
  setWorldViewMode as setWorldViewModeCore,
} from "./world.js?core";

export * from "./world.js?core";

const PRESERVED_ENEMY_KINDS = new Set([
  "turret",
  "warden",
]);

function exposeWorld(world) {
  globalThis.__mistMazeWorld = world;
  return world;
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function tileDistance(a, b) {
  return (
    Math.abs(a.x - b.x) +
    Math.abs(a.y - b.y)
  );
}

function shuffleInPlace(items) {
  for (
    let index = items.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapIndex = Math.floor(
      Math.random() * (index + 1),
    );

    [items[index], items[swapIndex]] = [
      items[swapIndex],
      items[index],
    ];
  }

  return items;
}

function selectEvenly(items, count) {
  if (count <= 0) {
    return [];
  }

  if (count >= items.length) {
    return [...items];
  }

  const step = items.length / count;

  return Array.from(
    { length: count },
    (_unused, index) => {
      const sourceIndex = Math.min(
        items.length - 1,
        Math.floor(
          (index + 0.5) * step,
        ),
      );

      return items[sourceIndex];
    },
  );
}

function trimEnemiesToTarget(
  world,
  targetCount,
) {
  const preserved = world.enemies.filter(
    (enemy) =>
      PRESERVED_ENEMY_KINDS.has(
        enemy.kind,
      ),
  );
  const regular = world.enemies.filter(
    (enemy) =>
      !PRESERVED_ENEMY_KINDS.has(
        enemy.kind,
      ),
  );

  if (preserved.length >= targetCount) {
    world.enemies = selectEvenly(
      preserved,
      targetCount,
    );
    return;
  }

  const regularCount =
    targetCount - preserved.length;

  world.enemies = [
    ...selectEvenly(
      regular,
      regularCount,
    ),
    ...preserved,
  ];
}

function getOccupiedTileKeys(world) {
  const occupied = new Set();

  occupied.add(
    tileKey(
      Math.floor(world.player.x),
      Math.floor(world.player.y),
    ),
  );

  for (const enemy of world.enemies) {
    occupied.add(
      tileKey(
        Math.floor(enemy.x),
        Math.floor(enemy.y),
      ),
    );
  }

  for (const pickup of world.pickups ?? []) {
    occupied.add(
      tileKey(
        Math.floor(pickup.x),
        Math.floor(pickup.y),
      ),
    );
  }

  return occupied;
}

function getAvailableEnemyTiles(world) {
  const occupied =
    getOccupiedTileKeys(world);

  const tiles = (
    world.floorTiles ?? []
  ).filter((tile) => {
    if (
      occupied.has(
        tileKey(tile.x, tile.y),
      )
    ) {
      return false;
    }

    if (
      world.start &&
      tileDistance(
        tile,
        world.start,
      ) < 8
    ) {
      return false;
    }

    if (
      world.exit &&
      tileDistance(
        tile,
        world.exit,
      ) < 4
    ) {
      return false;
    }

    return true;
  });

  return shuffleInPlace(tiles);
}

function getRegularEnemyKindPool(world) {
  const kinds = world.enemies
    .filter(
      (enemy) =>
        !PRESERVED_ENEMY_KINDS.has(
          enemy.kind,
        ),
    )
    .map((enemy) => enemy.kind)
    .filter(Boolean);

  return kinds.length
    ? kinds
    : ["scout"];
}

function addEnemiesToTarget(
  world,
  targetCount,
) {
  const needed =
    targetCount - world.enemies.length;

  if (needed <= 0) {
    return;
  }

  const availableTiles =
    getAvailableEnemyTiles(world);
  const enemyKinds =
    getRegularEnemyKindPool(world);
  const amountToAdd = Math.min(
    needed,
    availableTiles.length,
  );

  for (
    let index = 0;
    index < amountToAdd;
    index += 1
  ) {
    const kind =
      enemyKinds[
        Math.floor(
          Math.random() *
            enemyKinds.length,
        )
      ];

    addEnemy(
      world,
      availableTiles[index],
      kind,
    );
  }
}

function enforceEnemyDensity(world) {
  if (
    !world ||
    world.labyrinthMode
  ) {
    return;
  }

  const targetCount =
    getTargetEnemyCount(world);

  if (
    !Number.isInteger(targetCount) ||
    targetCount < 1
  ) {
    return;
  }

  if (
    world.enemies.length >
    targetCount
  ) {
    trimEnemiesToTarget(
      world,
      targetCount,
    );
  } else if (
    world.enemies.length <
    targetCount
  ) {
    addEnemiesToTarget(
      world,
      targetCount,
    );
  }

  world.targetEnemyCount =
    targetCount;
  world.minimapDirty = true;
}

function applyEnhancedControls(world) {
  if (world.labyrinthMode) {
    return;
  }

  world.controls = (
    world.controls ?? []
  ).map(
    (control) =>
      String(control)
        .replace(
          "Z / X",
          "Z / X / C",
        )
        .replace(
          "maximum 2",
          "maximum 3",
        ),
  );
}

export function createWorld(...args) {
  const world = createWorldCore(...args);

  world.leaderboardEligible =
    !world.labyrinthMode;
  world.__leaderboardRunStarted = false;
  world.__leaderboardRunFinished = false;
  world.__leaderboardRunPromise = null;

  enforceEnemyDensity(world);

  if (!world.labyrinthMode) {
    applyEnhancedControls(world);

    world.player.powerUpSlots = [
      ...(world.player.powerUpSlots ?? []),
      null,
    ].slice(0, 3);

    while (
      world.player.powerUpSlots.length < 3
    ) {
      world.player.powerUpSlots.push(
        null,
      );
    }

    world.player.legendaryPowerUpSlots = [
      false,
      false,
      false,
    ];

    markLegendaryPowerUps(world);
  }

  applySpecialPlayerLoadout(world);

  return exposeWorld(world);
}

export function setWorldViewMode(
  world,
  nextViewMode,
) {
  const normalized =
    nextViewMode === "3d"
      ? "3d"
      : "2d";
  const changed =
    world?.viewMode &&
    world.viewMode !== normalized;

  if (
    changed &&
    !world.labyrinthMode
  ) {
    world.leaderboardEligible = false;
    world.__leaderboardRunPromise = null;
    world.__leaderboardRunFinished = true;
    world.message =
      "Leaderboard disabled for this run after switching 2D/3D";
    world.messageTtl = 2.3;
  }

  const result =
    setWorldViewModeCore(
      world,
      normalized,
    );

  applyEnhancedControls(world);
  exposeWorld(world);

  return result;
}
