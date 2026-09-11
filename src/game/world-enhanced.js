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
  createWorld as createWorldCore,
  setWorldViewMode as setWorldViewModeCore,
} from "./world.js?core";

export * from "./world.js?core";

const SPECIAL_WEAPON_HOTKEYS = Object.freeze([
  ["0", "swordGun"],
  ["-", "blackSword"],
  ["=", "portalGun"],
]);

function exposeWorld(world) {
  globalThis.__mistMazeWorld = world;
  return world;
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function distanceBetweenTiles(a, b) {
  return (
    Math.abs(a.x - b.x) +
    Math.abs(a.y - b.y)
  );
}

function selectEvenlyDistributedEnemies(
  enemies,
  targetCount,
) {
  if (targetCount >= enemies.length) {
    return [...enemies];
  }

  if (targetCount <= 0) {
    return [];
  }

  const step = enemies.length / targetCount;

  return Array.from(
    { length: targetCount },
    (_unused, index) => {
      const sourceIndex = Math.min(
        enemies.length - 1,
        Math.floor(
          (index + 0.5) * step,
        ),
      );

      return enemies[sourceIndex];
    },
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

function getAvailableEnemyTiles(world) {
  const occupied = new Set();

  occupied.add(
    tileKey(
      Math.floor(world.player.x),
      Math.floor(world.player.y),
    ),
  );

  for (const enemy of world.enemies ?? []) {
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

  const candidates = (
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
      distanceBetweenTiles(
        tile,
        world.start,
      ) < 8
    ) {
      return false;
    }

    if (
      world.exit &&
      distanceBetweenTiles(
        tile,
        world.exit,
      ) < 3
    ) {
      return false;
    }

    return true;
  });

  return shuffleInPlace(candidates);
}

function cloneEnemyAtTile(
  world,
  sourceEnemy,
  tile,
) {
  return {
    ...sourceEnemy,
    id: `enemy-${world.nextId++}`,
    x: tile.x + 0.5,
    y: tile.y + 0.5,
    hp: sourceEnemy.maxHp,
    maxHp: sourceEnemy.maxHp,
    awake: false,
    pursuitStartedAt: null,
    nextAttackAt: 0,
    nextContactAt: 0,
    lastAttackAt: -Infinity,
    attackStyle: null,
    lastHitAt: -Infinity,
    orbitDir:
      Math.random() < 0.5 ? 1 : -1,
  };
}

function addEnemiesToTarget(
  world,
  targetCount,
) {
  const sourceEnemies = [
    ...(world.enemies ?? []),
  ];

  if (!sourceEnemies.length) {
    return;
  }

  const availableTiles =
    getAvailableEnemyTiles(world);
  const needed =
    targetCount - sourceEnemies.length;
  const amountToAdd = Math.min(
    needed,
    availableTiles.length,
  );

  for (
    let index = 0;
    index < amountToAdd;
    index += 1
  ) {
    const sourceEnemy =
      sourceEnemies[
        Math.floor(
          Math.random() *
            sourceEnemies.length,
        )
      ];
    const tile = availableTiles[index];

    world.enemies.push(
      cloneEnemyAtTile(
        world,
        sourceEnemy,
        tile,
      ),
    );
  }
}

function rebalanceEnemyDensity(world) {
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
    world.enemies =
      selectEvenlyDistributedEnemies(
        world.enemies,
        targetCount,
      );
    return;
  }

  if (
    world.enemies.length <
    targetCount
  ) {
    addEnemiesToTarget(
      world,
      targetCount,
    );
  }
}

function getWeaponHotkeyLabel(world) {
  const specialWeaponLabels =
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
    ...specialWeaponLabels,
  ].join(" · ");
}

function applyEnhancedControls(world) {
  if (world.labyrinthMode) {
    return;
  }

  const weaponHotkeyLabel =
    getWeaponHotkeyLabel(world);

  world.controls = (
    world.controls ?? []
  ).map((control) => {
    const text = String(control)
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
        `${weaponHotkeyLabel} ` +
        `or click the sidebar`
      );
    }

    return text;
  });
}

export function createWorld(...args) {
  const world = createWorldCore(...args);

  world.leaderboardEligible =
    !world.labyrinthMode;
  world.__leaderboardRunStarted = false;
  world.__leaderboardRunFinished = false;
  world.__leaderboardRunPromise = null;

  rebalanceEnemyDensity(world);

  if (!world.labyrinthMode) {
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

  exposeWorld(world);
  applyEnhancedControls(world);

  return result;
}
