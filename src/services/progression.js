// src/services/progression.js

export const LEVEL_PROGRESS_STORAGE_KEY =
  "mist-maze-level-progress-v1";

export const PROGRESSION_CHANGED_EVENT =
  "mist-maze-progression-changed";

export const COMBAT_LEVEL_ORDER = Object.freeze([
  "level0",
  "level1",
  "level2",
  "level3",
]);

const LEVEL_NUMBER = Object.freeze(
  Object.fromEntries(
    COMBAT_LEVEL_ORDER.map((levelKey, index) => [
      levelKey,
      index,
    ]),
  ),
);

const MAX_UNLOCKED_LEVEL =
  COMBAT_LEVEL_ORDER.length - 1;

function normalizeHighestUnlocked(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      MAX_UNLOCKED_LEVEL,
      Math.floor(value),
    ),
  );
}

function readHighestUnlocked() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const stored =
      window.localStorage.getItem(
        LEVEL_PROGRESS_STORAGE_KEY,
      );

    if (stored === null) {
      return 0;
    }

    return normalizeHighestUnlocked(
      Number(stored),
    );
  } catch {
    return 0;
  }
}

function writeHighestUnlocked(
  highestUnlocked,
  source,
) {
  const normalized =
    normalizeHighestUnlocked(
      highestUnlocked,
    );

  if (typeof window === "undefined") {
    return normalized;
  }

  try {
    window.localStorage.setItem(
      LEVEL_PROGRESS_STORAGE_KEY,
      String(normalized),
    );
  } catch {
    return readHighestUnlocked();
  }

  window.dispatchEvent(
    new CustomEvent(
      PROGRESSION_CHANGED_EVENT,
      {
        detail: {
          highestUnlocked: normalized,
          source,
        },
      },
    ),
  );

  return normalized;
}

export function getHighestUnlockedLevel() {
  return readHighestUnlocked();
}

export function getLevelNumber(levelKey) {
  const levelNumber =
    LEVEL_NUMBER[levelKey];

  return Number.isInteger(levelNumber)
    ? levelNumber
    : null;
}

export function isLevelUnlocked(levelKey) {
  if (levelKey === "labyrinth") {
    return true;
  }

  const levelNumber =
    getLevelNumber(levelKey);

  return (
    levelNumber !== null &&
    levelNumber <= readHighestUnlocked()
  );
}

export function getNextLevelKey(levelKey) {
  const levelNumber =
    getLevelNumber(levelKey);

  if (levelNumber === null) {
    return null;
  }

  return (
    COMBAT_LEVEL_ORDER[
      levelNumber + 1
    ] ?? null
  );
}

export function getPreviousLevelKey(levelKey) {
  const levelNumber =
    getLevelNumber(levelKey);

  if (
    levelNumber === null ||
    levelNumber <= 0
  ) {
    return null;
  }

  return (
    COMBAT_LEVEL_ORDER[
      levelNumber - 1
    ] ?? null
  );
}

export function recordLevelCompletion(levelKey) {
  const completedLevel =
    getLevelNumber(levelKey);

  if (completedLevel === null) {
    return readHighestUnlocked();
  }

  const previousHighest =
    readHighestUnlocked();

  const nextHighest =
    normalizeHighestUnlocked(
      completedLevel + 1,
    );

  if (nextHighest <= previousHighest) {
    return previousHighest;
  }

  return writeHighestUnlocked(
    nextHighest,
    "level-completion",
  );
}

/**
 * Compatibility export for developer tools only.
 * There is no player-facing unlock-all control.
 */
export function unlockAllLevels() {
  return writeHighestUnlocked(
    MAX_UNLOCKED_LEVEL,
    "developer-unlock",
  );
}
