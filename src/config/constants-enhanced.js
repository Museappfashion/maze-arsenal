// src/config/constants-enhanced.js
import {
  DEFAULT_LEVEL_KEY as CORE_DEFAULT_LEVEL_KEY,
  LEVELS as CORE_LEVELS,
  LEVEL_THEMES as CORE_LEVEL_THEMES,
} from "./constants.js?core";

export * from "./constants.js?core";

export const LEVEL_THEMES = {
  ...CORE_LEVEL_THEMES,
  city: {
    label: "City",
    backdrop: "#101214",
    floorA: "#252a2e",
    floorB: "#30363b",
    floorLine: "rgba(226, 232, 240, 0.08)",
    wallA: "#626970",
    wallB: "#3f464c",
    wallC: "#1a1e21",
    wallEdge: "rgba(226, 232, 240, 0.18)",
    fog: [72, 76, 80],
    mist: [190, 194, 198],
    playerGlow: "#f8fafc",
    playerAccent: "#facc15",
  },
};

export const LEVELS = {
  level0: {
    key: "level0",
    label: "Level 0",
    subtitle: "Abandoned City",
    themeKey: "city",
    themeLabel: "City",
    description:
      "Cut through deserted city blocks, narrow streets, dark building facades, and heavy urban mist.",
    logicalCols: 13,
    logicalRows: 13,
    straightBias: 0.84,
    newestBias: 0.9,
    braidDeadEndChance: 0.06,
    extraLoopChance: 0.008,
    enemyHpMultiplier: 0.75,
    enemyDamageMultiplier: 0.75,
    enemySpeedMultiplier: 0.9,
    enemyBudgetMultiplier: 0.7,
  },
  ...CORE_LEVELS,
};

export const DEFAULT_LEVEL_KEY = "level0";

void CORE_DEFAULT_LEVEL_KEY;
