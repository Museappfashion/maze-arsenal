// src/config/labyrinth.js
export const LABYRINTH_DIFFICULTIES = {
  easy: {
    key: "easy",
    label: "Easy",
    sizeBonus: 0,
    mutationInterval: 9,
    mutationCount: 2,
    steelChance: 0.18,
    sightRadius: 4.2,
    routePressure: 0.72,
  },
  normal: {
    key: "normal",
    label: "Normal",
    sizeBonus: 4,
    mutationInterval: 7,
    mutationCount: 3,
    steelChance: 0.24,
    sightRadius: 3.8,
    routePressure: 0.86,
  },
  hard: {
    key: "hard",
    label: "Hard",
    sizeBonus: 8,
    mutationInterval: 5.5,
    mutationCount: 4,
    steelChance: 0.32,
    sightRadius: 3.5,
    routePressure: 1,
  },
  nightmare: {
    key: "nightmare",
    label: "Nightmare",
    sizeBonus: 12,
    mutationInterval: 4,
    mutationCount: 5,
    steelChance: 0.4,
    sightRadius: 3.15,
    routePressure: 1.14,
  },
};

export const LABYRINTH_DEFAULT_DIFFICULTY = "normal";
export const LABYRINTH_DEFAULT_MINUTES = 5;
export const LABYRINTH_MIN_MINUTES = 1;
export const LABYRINTH_MAX_MINUTES = 10;
export const LABYRINTH_BREAKER_DURATION = 10;
export const LABYRINTH_MAX_BREAKERS = 10;

export function normalizeLabyrinthOptions(options = {}) {
  const difficultyKey = Object.hasOwn(
    LABYRINTH_DIFFICULTIES,
    options.difficulty,
  )
    ? options.difficulty
    : LABYRINTH_DEFAULT_DIFFICULTY;

  const timeMinutes = Math.min(
    LABYRINTH_MAX_MINUTES,
    Math.max(
      LABYRINTH_MIN_MINUTES,
      Math.round(Number(options.timeMinutes) || LABYRINTH_DEFAULT_MINUTES),
    ),
  );

  const difficulty = LABYRINTH_DIFFICULTIES[difficultyKey];
  const baseSize = 13 + timeMinutes * 4;
  const logicalCols = baseSize + difficulty.sizeBonus;
  const logicalRows = baseSize + difficulty.sizeBonus;
  const breakerPickupCount = Math.min(
    30,
    8 + timeMinutes * 2 + Math.round(difficulty.sizeBonus / 2),
  );

  return {
    difficulty: difficultyKey,
    difficultyLabel: difficulty.label,
    timeMinutes,
    timeLimitSeconds: timeMinutes * 60,
    logicalCols,
    logicalRows,
    mutationInterval: difficulty.mutationInterval,
    mutationCount: difficulty.mutationCount,
    steelChance: difficulty.steelChance,
    sightRadius: difficulty.sightRadius,
    routePressure: difficulty.routePressure,
    breakerPickupCount,
  };
}
