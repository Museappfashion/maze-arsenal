// src/config/characterProfiles.js

import {
  getWorldPlayerName,
  normalizePlayerName,
} from "./specialPlayers.js";

export const MENDEL_LEVEL_NAMES =
  Object.freeze({
    level1: "Under 770",
    level2: "Jungle",
    level3: "The Trail",
  });

export function isMendelName(
  playerName,
) {
  return (
    normalizePlayerName(
      playerName,
    ) === "mendel"
  );
}

export function isMendelWorld(
  world,
) {
  return (
    isMendelName(
      getWorldPlayerName(
        world,
      ),
    )
  );
}

function setLevelDisplayName(
  level,
  displayName,
) {
  return {
    ...level,
    name: displayName,
    label: displayName,
    title: displayName,
    displayName,
  };
}

export function applyCharacterWorldProfile(
  world,
) {
  if (
    !world?.level ||
    world.labyrinthMode ||
    !isMendelWorld(world)
  ) {
    return world;
  }

  if (
    world
      .__characterProfileApplied ===
    "mendel"
  ) {
    return world;
  }

  const levelKey =
    world.level.key;

  const displayName =
    MENDEL_LEVEL_NAMES[
      levelKey
    ];

  if (!displayName) {
    world
      .__characterProfileApplied =
      "mendel";

    return world;
  }

  world.__originalLevelThemeKey =
    world.level.themeKey;

  if (
    levelKey === "level1"
  ) {
    world.level =
      setLevelDisplayName(
        {
          ...world.level,
          themeKey:
            "labyrinth",
        },
        displayName,
      );

    world
      .__mendelVisualTheme =
      "under770";
  } else if (
    levelKey === "level2"
  ) {
    world.level =
      setLevelDisplayName(
        {
          ...world.level,
          themeKey:
            "jungle",
        },
        displayName,
      );

    world
      .__mendelVisualTheme =
      "jungle";
  } else if (
    levelKey === "level3"
  ) {
    /*
     * Switching away from the medieval theme prevents
     * Fallen Keep identity props such as statues/torches
     * from being dispatched for Mendel.
     */
    world.level =
      setLevelDisplayName(
        {
          ...world.level,
          themeKey:
            "jungle",
        },
        displayName,
      );

    world
      .__mendelVisualTheme =
      "trail";
  }

  world.levelName =
    displayName;

  world.levelLabel =
    displayName;

  world
    .__characterProfileApplied =
    "mendel";

  delete world
    .__visualPolishCache;

  delete world
    .__mendelVisualCache;

  return world;
}
