// src/game/world-enhanced.js

import {
  getTargetEnemyCount,
} from "../config/enemyDensity.js";
import {
  markLegendaryPowerUps,
} from "../config/legendaryPowerUps.js";
import {
  applySpecialPlayerLoadout,
  SPECIAL_WEAPON_LABELS,
  shouldShowWeaponForWorld,
} from "../config/specialPlayers.js";
import {
  BLACK_SWORD_KEY,
  PORTAL_GUN_KEY,
  SWORD_GUN_KEY,
} from "../config/weapons-enhanced.js";
import {
  addEnemy,
} from "./gameplay.js?core";
import {
  createWorld as createWorldCore,
  setWorldViewMode as setWorldViewModeCore,
} from "./world.js?core";

export * from "./world.js?core";

const PRESERVED_ENEMY_KINDS =
  new Set([
    "turret",
    "warden",
  ]);

const SPECIAL_WEAPON_HOTKEYS =
  Object.freeze([
    ["0", SWORD_GUN_KEY],
    ["-", BLACK_SWORD_KEY],
    ["=", PORTAL_GUN_KEY],
  ]);

function exposeWorld(world) {
  globalThis.__mistMazeWorld =
    world;

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

function distanceFieldValue(
  world,
  x,
  y,
) {
  const tileX =
    Math.max(
      0,
      Math.min(
        world.width - 1,
        Math.floor(x),
      ),
    );

  const tileY =
    Math.max(
      0,
      Math.min(
        world.height - 1,
        Math.floor(y),
      ),
    );

  const value =
    world.distanceField[
      tileY * world.width +
        tileX
    ];

  return Number.isFinite(value)
    ? value
    : -1;
}

function sortByMazeProgress(
  world,
  items,
) {
  return [...items].sort(
    (left, right) => {
      const leftDistance =
        distanceFieldValue(
          world,
          left.x,
          left.y,
        );

      const rightDistance =
        distanceFieldValue(
          world,
          right.x,
          right.y,
        );

      return (
        leftDistance -
        rightDistance
      );
    },
  );
}

function selectEvenly(
  items,
  count,
) {
  if (count <= 0) {
    return [];
  }

  if (count >= items.length) {
    return [...items];
  }

  const step =
    items.length / count;

  return Array.from(
    { length: count },
    (_unused, index) => {
      const sourceIndex =
        Math.min(
          items.length - 1,
          Math.floor(
            (index + 0.5) *
              step,
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
  const preserved =
    sortByMazeProgress(
      world,
      world.enemies.filter(
        (enemy) =>
          PRESERVED_ENEMY_KINDS.has(
            enemy.kind,
          ),
      ),
    );

  const regular =
    sortByMazeProgress(
      world,
      world.enemies.filter(
        (enemy) =>
          !PRESERVED_ENEMY_KINDS.has(
            enemy.kind,
          ),
      ),
    );

  if (
    preserved.length >=
    targetCount
  ) {
    world.enemies =
      selectEvenly(
        preserved,
        targetCount,
      );

    return;
  }

  const regularCount =
    targetCount -
    preserved.length;

  world.enemies = [
    ...selectEvenly(
      regular,
      regularCount,
    ),
    ...preserved,
  ];
}

function getOccupiedTileKeys(
  world,
) {
  const occupied =
    new Set();

  occupied.add(
    tileKey(
      Math.floor(
        world.player.x,
      ),
      Math.floor(
        world.player.y,
      ),
    ),
  );

  for (
    const enemy of
    world.enemies
  ) {
    occupied.add(
      tileKey(
        Math.floor(enemy.x),
        Math.floor(enemy.y),
      ),
    );
  }

  for (
    const pickup of
    world.pickups ?? []
  ) {
    occupied.add(
      tileKey(
        Math.floor(pickup.x),
        Math.floor(pickup.y),
      ),
    );
  }

  return occupied;
}

function getAvailableEnemyTiles(
  world,
) {
  const occupied =
    getOccupiedTileKeys(
      world,
    );

  return sortByMazeProgress(
    world,
    (
      world.floorTiles ?? []
    ).filter((tile) => {
      if (
        occupied.has(
          tileKey(
            tile.x,
            tile.y,
          ),
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

      return (
        distanceFieldValue(
          world,
          tile.x,
          tile.y,
        ) >= 0
      );
    }),
  );
}

function getRegularEnemyTemplates(
  world,
) {
  const regularEnemies =
    sortByMazeProgress(
      world,
      world.enemies.filter(
        (enemy) =>
          !PRESERVED_ENEMY_KINDS.has(
            enemy.kind,
          ),
      ),
    );

  return regularEnemies.length
    ? regularEnemies
    : [{ kind: "scout" }];
}

function getEnemyKindForTile(
  world,
  templates,
  tile,
) {
  if (
    templates.length === 1
  ) {
    return (
      templates[0].kind ??
      "scout"
    );
  }

  const exitDistance =
    Math.max(
      1,
      distanceFieldValue(
        world,
        world.exit.x,
        world.exit.y,
      ),
    );

  const tileProgress =
    Math.max(
      0,
      Math.min(
        1,
        distanceFieldValue(
          world,
          tile.x,
          tile.y,
        ) / exitDistance,
      ),
    );

  const templateIndex =
    Math.min(
      templates.length - 1,
      Math.round(
        tileProgress *
          (templates.length - 1),
      ),
    );

  return (
    templates[
      templateIndex
    ]?.kind ?? "scout"
  );
}

function addEnemiesToTarget(
  world,
  targetCount,
) {
  const needed =
    targetCount -
    world.enemies.length;

  if (needed <= 0) {
    return;
  }

  const availableTiles =
    getAvailableEnemyTiles(
      world,
    );

  const selectedTiles =
    selectEvenly(
      availableTiles,
      Math.min(
        needed,
        availableTiles.length,
      ),
    );

  const templates =
    getRegularEnemyTemplates(
      world,
    );

  for (
    const tile of
    selectedTiles
  ) {
    addEnemy(
      world,
      tile,
      getEnemyKindForTile(
        world,
        templates,
        tile,
      ),
    );
  }
}

function enforceEnemyDensity(
  world,
) {
  if (
    !world ||
    world.labyrinthMode
  ) {
    return;
  }

  const targetCount =
    getTargetEnemyCount(
      world,
    );

  if (
    !Number.isInteger(
      targetCount,
    ) ||
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
  world.initialEnemyCount =
    world.enemies.length;
  world.minimapDirty = true;
}

function getVisibleWeaponHotkeyLabel(
  world,
) {
  const specialHotkeys =
    SPECIAL_WEAPON_HOTKEYS
      .filter(
        ([, weaponKey]) =>
          shouldShowWeaponForWorld(
            world,
            weaponKey,
          ),
      )
      .map(
        ([hotkey, weaponKey]) =>
          `${hotkey} ${
            SPECIAL_WEAPON_LABELS[
              weaponKey
            ]
          }`,
      );

  return [
    "1-9",
    ...specialHotkeys,
  ].join(" · ");
}

function applyEnhancedControls(
  world,
) {
  if (
    !world ||
    world.labyrinthMode
  ) {
    return;
  }

  const weaponHotkeys =
    getVisibleWeaponHotkeyLabel(
      world,
    );

  world.controls = (
    world.controls ?? []
  ).map((control) => {
    const text =
      String(control)
        .replace(
          "Z / X",
          "Z / X / C",
        )
        .replace(
          "maximum 2",
          "maximum 3",
        );

    if (
      text.startsWith(
        "Switch weapon:",
      )
    ) {
      return (
        `Switch weapon: ` +
        `${weaponHotkeys} ` +
        `or click the sidebar`
      );
    }

    return text;
  });
}

export function createWorld(
  ...args
) {
  const world =
    createWorldCore(...args);

  world.leaderboardEligible =
    !world.labyrinthMode;
  world.__leaderboardRunStarted =
    false;
  world.__leaderboardRunFinished =
    false;
  world.__leaderboardRunPromise =
    null;

  enforceEnemyDensity(world);

  if (!world.labyrinthMode) {
    world.player.powerUpSlots = [
      ...(
        world.player
          .powerUpSlots ?? []
      ),
      null,
    ].slice(0, 3);

    while (
      world.player
        .powerUpSlots.length <
      3
    ) {
      world.player
        .powerUpSlots.push(
          null,
        );
    }

    world.player
      .legendaryPowerUpSlots = [
      false,
      false,
      false,
    ];

    markLegendaryPowerUps(
      world,
    );
  }

  applySpecialPlayerLoadout(
    world,
  );

  exposeWorld(world);
  applyEnhancedControls(world);

  return world;
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
    world.viewMode !==
      normalized;

  if (
    changed &&
    !world.labyrinthMode
  ) {
    world.leaderboardEligible =
      false;
    world.__leaderboardRunPromise =
      null;
    world.__leaderboardRunFinished =
      true;
    world.message =
      "Leaderboard disabled for this run after switching 2D/3D";
    world.messageTtl = 2.3;
  }

  const result =
    setWorldViewModeCore(
      world,
      normalized,
    );

  exposeWorld(world);
  applyEnhancedControls(world);

  return result;
}
