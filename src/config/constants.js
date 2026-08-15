// src/config/constants.js
export const CANVAS_WIDTH = 840;

export const CANVAS_HEIGHT = 720;

export const DRAW_TILE = 24;

export const PASSAGE_WIDTH = 4;

export const MAX_EFFECTS = 900;

export const VIEW_3D_FOV = Math.PI * 0.38;

export const VIEW_3D_RAY_WIDTH = 3;

export const VIEW_3D_MAX_DISTANCE = 28;

export const VIEW_3D_MOUSE_SENSITIVITY = 0.0025;

export const VIEW_3D_TOUCH_SENSITIVITY = 0.012;

export const MOBILE_2D_ZOOM = 1.7;

export const VIEW_3D_TURN_SPEED = 2.15;

export const FLOOR = 0;

export const WALL = 1;

export const LEVELS = {
  level1: {
    key: "level1",
    label: "Level 1",
    subtitle: "Orbital Ruins",
    themeKey: "space",
    themeLabel: "Space",
    description: "Drift through a cold orbital maze of metal decks, star-lit walls, and cosmic mist.",
    logicalCols: 17,
    logicalRows: 17,
    straightBias: 0.8,
    newestBias: 0.88,
    braidDeadEndChance: 0.08,
    extraLoopChance: 0.01,
    enemyHpMultiplier: 0.9,
    enemyDamageMultiplier: 0.9,
    enemySpeedMultiplier: 0.95,
    enemyBudgetMultiplier: 0.9,
  },
  level2: {
    key: "level2",
    label: "Level 2",
    subtitle: "Emerald Wilds",
    themeKey: "jungle",
    themeLabel: "Jungle",
    description: "Push through overgrown ruins with grass floors, vine-choked walls, and humid green mist.",
    logicalCols: 25,
    logicalRows: 25,
    straightBias: 0.68,
    newestBias: 0.74,
    braidDeadEndChance: 0.18,
    extraLoopChance: 0.035,
    enemyHpMultiplier: 1.15,
    enemyDamageMultiplier: 1.15,
    enemySpeedMultiplier: 1.05,
    enemyBudgetMultiplier: 1.2,
  },
  level3: {
    key: "level3",
    label: "Level 3",
    subtitle: "The Fallen Keep",
    themeKey: "medieval",
    themeLabel: "Medieval",
    description: "Fight through a sprawling ruined keep of stone corridors, torch smoke, and castle walls.",
    logicalCols: 33,
    logicalRows: 33,
    straightBias: 0.56,
    newestBias: 0.62,
    braidDeadEndChance: 0.32,
    extraLoopChance: 0.07,
    enemyHpMultiplier: 1.45,
    enemyDamageMultiplier: 1.35,
    enemySpeedMultiplier: 1.12,
    enemyBudgetMultiplier: 1.55,
  },
};

export const LEVEL_THEMES = {
  space: {
    label: "Space",
    backdrop: "#020611",
    floorA: "#07111f",
    floorB: "#0b1728",
    floorLine: "rgba(96, 165, 250, 0.14)",
    wallA: "#31516c",
    wallB: "#142c43",
    wallC: "#050b14",
    wallEdge: "rgba(103, 232, 249, 0.42)",
    fog: [5, 8, 20],
    mist: [147, 197, 253],
    playerGlow: "#38bdf8",
    playerAccent: "#bae6fd",
  },
  jungle: {
    label: "Jungle",
    backdrop: "#031008",
    floorA: "#163b1f",
    floorB: "#1d4724",
    floorLine: "rgba(134, 239, 172, 0.1)",
    wallA: "#405f35",
    wallB: "#253f27",
    wallC: "#0b1d11",
    wallEdge: "rgba(163, 230, 53, 0.24)",
    fog: [5, 20, 11],
    mist: [134, 239, 172],
    playerGlow: "#4ade80",
    playerAccent: "#fef3c7",
  },
  medieval: {
    label: "Medieval",
    backdrop: "#0c0907",
    floorA: "#342f2b",
    floorB: "#3e3730",
    floorLine: "rgba(253, 186, 116, 0.08)",
    wallA: "#70675e",
    wallB: "#49423d",
    wallC: "#211d1a",
    wallEdge: "rgba(253, 186, 116, 0.2)",
    fog: [22, 18, 16],
    mist: [214, 211, 209],
    playerGlow: "#f59e0b",
    playerAccent: "#e7e5e4",
  },
};

export const DEFAULT_LEVEL_KEY = "level1";
