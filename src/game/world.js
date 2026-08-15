// src/game/world.js
import { CANVAS_HEIGHT, CANVAS_WIDTH, DEFAULT_LEVEL_KEY, LEVELS } from "../config/constants.js";
import { WEAPON_HOTKEY_LABEL } from "../config/weapons.js";
import { computeDistanceField, placeEnemies, placePowerUps, placeProgressionItems, revealAroundPlayer, setMessage, updateVisionCache } from "./gameplay.js";
import { bfsDistances, collectFloorTiles, farthestTile, generateMaze } from "./maze.js";
import { createOwnedWeapons, indexOfTile } from "../utils/math.js";
import { sanitizePlayerName } from "../utils/player.js";

export function getControlsForViewMode(viewMode) {
  if (viewMode === "3d") {
    return [
      "Move: W / S",
      "Strafe: A / D",
      "Turn: mouse or ← / →",
      "Attack: left mouse, Space, or Enter",
      `Switch weapon: ${WEAPON_HOTKEY_LABEL} or click the sidebar`,
      "Use stored power-up: Z / X",
      "Power-up holder: maximum 2",
      "Toggle labels: L",
      "Minimap: M",
      "New maze: START NEW MAZE in sidebar",
      "Esc: unlock mouse / choose level",
    ];
  }

  return [
    "Move: WASD, arrow keys, or touch joystick",
    "Attack: Space, Enter, left mouse, or touch ATTACK",
    `Switch weapon: ${WEAPON_HOTKEY_LABEL} or click the sidebar`,
    "Use stored power-up: Z / X",
    "Power-up holder: maximum 2",
    "Toggle labels: L",
    "Minimap: M",
    "New maze: START NEW MAZE in sidebar",
  ];
}

export function setWorldViewMode(world, viewMode) {
  const normalizedViewMode =
    viewMode === "3d" ? "3d" : "2d";

  world.viewMode = normalizedViewMode;
  world.controls = getControlsForViewMode(
    normalizedViewMode,
  );

  if (normalizedViewMode === "3d") {
    world.minimapOn = true;
  }
  world.pointer.down = false;
  world.pointer.inside = false;

  setMessage(
    world,
    normalizedViewMode === "3d"
      ? "3D Beta enabled"
      : "2D view enabled",
    1.4,
  );
}

export function createWorld(levelKey = DEFAULT_LEVEL_KEY, viewMode = "2d", playerName = "") {
const level = LEVELS[levelKey] ?? LEVELS[DEFAULT_LEVEL_KEY];
const maze = generateMaze(level.logicalCols, level.logicalRows, level);
const world = { ...maze, levelKey: level.key, level, playerName: sanitizePlayerName(playerName), floorTiles: [], floorCount: 0, pickups: [], projectiles: [], enemies: [], effects: [], nextId: 1, time: 0, fogPulse: 0, message: "", messageTtl: 0, victory: false, gameOver: false, kills: 0, minimapOn: true, labelsOn: true, viewMode: viewMode === "3d" ? "3d" : "2d", runMode: viewMode === "3d" ? "3d" : "2d", controls: getControlsForViewMode(viewMode), pointer: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, down: false, inside: false, }, discovered: new Uint8Array(maze.width * maze.height), distanceField: new Int32Array(maze.width * maze.height), distanceTimer: 0, distanceFieldDirty: true, minimapCanvas: null, minimapDirty: true, damageFlash: 0, damageKick: 0, damageDirection: 0, lastDamageAt: -Infinity, lastFullPowerUpNoticeAt: -Infinity, audioEvents: [], vision: { sightBonus: 0, facingX: 1, facingY: 0, }, player: { x: 1.5, y: 1.5, radius: 0.24, speed: 4.1, baseMaxHp: 100, maxHp: 100, hp: 100, ammo: 26, weapon: "fists", ownedWeapons: createOwnedWeapons(), facing: 0, nextAttackAt: 0, meleeSwing: null, powerUps: {}, powerUpSlots: [null, null], discoveredFloor: 0, }, lastPlayerTile: { x: 1, y: 1 }, };

world.floorTiles = collectFloorTiles(world); world.floorCount = world.floorTiles.length;

const startTile = { x: 1, y: 1 }; const firstDistances = bfsDistances(world, startTile); const exit = farthestTile(world, firstDistances);

world.start = startTile; world.exit = exit; world.player.x = startTile.x + 0.5; world.player.y = startTile.y + 0.5; world.lastPlayerTile = { x: startTile.x, y: startTile.y };

const distancesFromStart = bfsDistances(world, startTile); const used = new Set(); used.add(indexOfTile(world.width, startTile.x, startTile.y)); used.add(indexOfTile(world.width, exit.x, exit.y));

placeProgressionItems(world, distancesFromStart, used); placePowerUps(world, distancesFromStart, used); placeEnemies(world, distancesFromStart, used); updateVisionCache(world); revealAroundPlayer(world); computeDistanceField(world);

return world; }
