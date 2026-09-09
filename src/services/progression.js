// src/services/progression.js
export const LEVEL_PROGRESS_STORAGE_KEY =
  "mist-maze-level-progress-v1";

const MAX_UNLOCKED_LEVEL = 3;

const LEVEL_NUMBER = {
  level0: 0,
  level1: 1,
  level2: 2,
  level3: 3,
};

function readHighestUnlocked() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const value = Number(
      window.localStorage.getItem(
        LEVEL_PROGRESS_STORAGE_KEY,
      ),
    );

    return Number.isFinite(value)
      ? Math.max(
          0,
          Math.min(
            MAX_UNLOCKED_LEVEL,
            Math.floor(value),
          ),
        )
      : 0;
  } catch {
    return 0;
  }
}

function writeHighestUnlocked(
  highestUnlocked,
  source,
) {
  if (typeof window === "undefined") {
    return readHighestUnlocked();
  }

  const normalized = Math.max(
    0,
    Math.min(
      MAX_UNLOCKED_LEVEL,
      Math.floor(highestUnlocked),
    ),
  );

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
      "mist-maze-progression-changed",
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

export function isLevelUnlocked(levelKey) {
  if (levelKey === "labyrinth") {
    return true;
  }

  const levelNumber =
    LEVEL_NUMBER[levelKey];

  return (
    Number.isInteger(levelNumber) &&
    levelNumber <= readHighestUnlocked()
  );
}

export function unlockAllLevels() {
  return writeHighestUnlocked(
    MAX_UNLOCKED_LEVEL,
    "skip-button",
  );
}

export function recordLevelCompletion(levelKey) {
  const completed =
    LEVEL_NUMBER[levelKey];

  if (!Number.isInteger(completed)) {
    return readHighestUnlocked();
  }

  const nextHighest = Math.min(
    MAX_UNLOCKED_LEVEL,
    completed + 1,
  );
  const previousHighest =
    readHighestUnlocked();

  if (nextHighest <= previousHighest) {
    return previousHighest;
  }

  return writeHighestUnlocked(
    nextHighest,
    "level-completion",
  );
}
