// src/services/progression.js
export const LEVEL_PROGRESS_STORAGE_KEY =
  "mist-maze-level-progress-v1";

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
      window.localStorage.getItem(LEVEL_PROGRESS_STORAGE_KEY),
    );

    return Number.isFinite(value)
      ? Math.max(0, Math.min(3, Math.floor(value)))
      : 0;
  } catch {
    return 0;
  }
}

export function getHighestUnlockedLevel() {
  return readHighestUnlocked();
}

export function isLevelUnlocked(levelKey) {
  if (levelKey === "labyrinth") {
    return true;
  }

  const levelNumber = LEVEL_NUMBER[levelKey];

  return (
    Number.isInteger(levelNumber) &&
    levelNumber <= readHighestUnlocked()
  );
}

export function recordLevelCompletion(levelKey) {
  const completed = LEVEL_NUMBER[levelKey];

  if (!Number.isInteger(completed)) {
    return readHighestUnlocked();
  }

  const nextHighest = Math.min(3, completed + 1);
  const previousHighest = readHighestUnlocked();

  if (nextHighest <= previousHighest) {
    return previousHighest;
  }

  try {
    window.localStorage.setItem(
      LEVEL_PROGRESS_STORAGE_KEY,
      String(nextHighest),
    );
  } catch {
    return previousHighest;
  }

  window.dispatchEvent(
    new CustomEvent("mist-maze-progression-changed", {
      detail: { highestUnlocked: nextHighest },
    }),
  );

  return nextHighest;
}
