import { floorIndex, hundredFloorHintRoute, nearHundredFloorStairs } from "./hundredFloorMaze.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT, DRAW_TILE, LEVELS } from "../config/constants-enhanced.js";
import { drawWorld } from "./rendering-2.0.js";
import { getCamera } from "./gameplay.js";
import { getPlayerCosmeticForTheme } from "../services/characterCosmetics.js";

const cachedMaps = new WeakMap();
const renderWorlds = new WeakMap();
const floorKeys = ["level0", "level1", "level2", "level3"];

// Render the climb with the exact game renderer, including City asphalt,
// building caps, fog and survivor artwork. This adapter owns no gameplay state.
export function hundredFloorArtworkWorld(world, playerName = "") {
  let state = renderWorlds.get(world);
  if (!state || state.grid !== world.grid) {
    const level = LEVELS[floorKeys[(world.floor - 1) % floorKeys.length]];
    let floorCount = 0;
    for (const cell of world.grid) if (cell === 0) floorCount++;
    state = {
      grid: world.grid, x: world.player.x, y: world.player.y, facing: 0,
      art: {
        width: world.width, height: world.height, level: { ...level, logicalCols: 100, logicalRows: 100 },
        levelKey: level.key, viewMode: "2d", mobileView: false, labyrinthMode: false,
        grid: Array.from({ length: world.height }, (_, y) => world.grid.subarray(y * world.width, (y + 1) * world.width)),
        floorCount, enemies: [], projectiles: [], effects: [], pickups: [],
        exit: { x: Math.floor(world.stairs.x), y: Math.floor(world.stairs.y) },
        start: { x: 1, y: 1 }, labelsOn: false, minimapDirty: true,
        victory: false, gameOver: false, kills: 0, damageFlash: 0,
        message: "", messageTtl: 0, leaderboardEligible: false,
        player: { radius: .24, facing: 0, cosmetic: getPlayerCosmeticForTheme(level.themeKey), powerUps: {}, powerUpSlots: [null, null],
          weapon: "fists", ownedWeapons: { fists: true }, meleeSwing: null,
          hp: 100, maxHp: 100, ammo: 0, discoveredFloor: 0 },
      },
    };
    renderWorlds.set(world, state);
  }
  const dx = world.player.x - state.x, dy = world.player.y - state.y;
  if (Math.hypot(dx, dy) > .001) state.facing = Math.atan2(dy, dx);
  state.x = world.player.x; state.y = world.player.y;
  const art = state.art;
  art.time = world.elapsed;
  art.fogPulse = world.elapsed;
  art.playerName = playerName;
  if (!state.revealed) state.revealed = new Uint8Array(world.grid.length).fill(1);
  art.discovered = world.sonar > 0 || world.completed ? state.revealed : world.explored;
  let discoveredFloor = 0;
  for (let i = 0; i < world.grid.length; i++) if (!world.grid[i] && art.discovered[i]) discoveredFloor++;
  const mapSignature = `${world.floor}:${Math.floor(state.x)}:${Math.floor(state.y)}:${world.sonar > 0}:${discoveredFloor}`;
  if (state.mapSignature !== mapSignature) art.minimapDirty = true;
  state.mapSignature = mapSignature;
  Object.assign(art.player, {
    x: state.x, y: state.y, facing: state.facing, discoveredFloor,
    powerUps: {
      ...(world.haste > 0 ? { haste: { endsAt: world.elapsed + world.haste } } : {}),
      ...(world.sonar > 0 ? { sonar: { endsAt: world.elapsed + world.sonar } } : {}),
    },
  });
  art.pickups = world.pickups.filter((item) => !world.collected.has(item.index)).map((item) => ({
    ...item, id: item.index, type: "powerup", powerUp: item.type,
    color: item.type === "haste" ? "#4ade80" : "#22d3ee",
  }));
  return art;
}

function mapImage(world) {
  const fullReveal = world.sonar > 0 || world.completed;
  const signature = `${world.floor}:${Math.floor(world.player.x)}:${Math.floor(world.player.y)}:${fullReveal}`;
  let cache = cachedMaps.get(world);
  if (cache?.signature === signature) return cache.canvas;
  const canvas = cache?.canvas || document.createElement("canvas");
  canvas.width = world.width;
  canvas.height = world.height;
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(world.width, world.height);
  for (let index = 0; index < world.grid.length; index++) {
    const visible = fullReveal || world.explored[index];
    const rgb = !visible ? [2, 6, 12] : world.grid[index] ? [29, 42, 57] : [100, 116, 139];
    pixels.data.set([...rgb, 255], index * 4);
  }
  context.putImageData(pixels, 0, 0);
  cache = { canvas, signature };
  cachedMaps.set(world, cache);
  return canvas;
}

function drawMap(ctx, world, x, y, size, expanded = false) {
  ctx.fillStyle = "rgba(2,6,23,.94)";
  ctx.fillRect(x - 8, y - 8, size + 16, size + 38);
  ctx.strokeStyle = "rgba(148,163,184,.3)";
  ctx.strokeRect(x - 8, y - 8, size + 16, size + 38);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mapImage(world), x, y, size, size);
  ctx.imageSmoothingEnabled = true;
  const unit = size / world.width;
  if (world.compass > 0 || world.sonar > 0) {
    ctx.beginPath();
    for (const [index, tile] of hundredFloorHintRoute(world, expanded ? 10000 : 60).entries()) {
      const px = x + (tile % world.width + .5) * unit;
      const py = y + (Math.floor(tile / world.width) + .5) * unit;
      if (!index) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = Math.max(1, unit * .5);
    ctx.stroke();
  }
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(x + world.stairs.x * unit - 3, y + world.stairs.y * unit - 3, 6, 6);
  ctx.beginPath();
  ctx.arc(x + world.player.x * unit, y + world.player.y * unit, expanded ? 5 : 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#67e8f9";
  ctx.fill();
  ctx.strokeStyle = "#020617";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = `${expanded ? 13 : 11}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillStyle = "#67e8f9";
  ctx.fillText("● You", x, y + size + 20);
  ctx.fillStyle = "#22c55e";
  ctx.textAlign = "right";
  ctx.fillText(world.floor === 100 ? "■ Summit" : "■ Stairs", x + size, y + size + 20);
}

export function drawHundredFloorMaze(ctx, world, width, height, expandedMap = false, playerName = "") {
  const art = hundredFloorArtworkWorld(world, playerName);
  ctx.save();
  ctx.scale(width / CANVAS_WIDTH, height / CANVAS_HEIGHT);
  drawWorld(ctx, art);
  const camera = getCamera(art);
  if (world.compass > 0 || world.sonar > 0) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(103,232,249,.75)";
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    for (const [index, cell] of hundredFloorHintRoute(world).entries()) {
      const x = (cell % world.width + .5 - camera.x) * DRAW_TILE;
      const y = (Math.floor(cell / world.width) + .5 - camera.y) * DRAW_TILE;
      if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (nearHundredFloorStairs(world)) {
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#dcfce7";
    ctx.fillText(world.floor === 100 ? "E · Reach the summit" : "E · Climb stairs", (world.player.x - camera.x) * DRAW_TILE, (world.player.y - camera.y) * DRAW_TILE - 30);
  }
  ctx.restore();
  if (expandedMap) {
    ctx.fillStyle = "rgba(2,6,23,.92)";
    ctx.fillRect(0, 0, width, height);
    const size = Math.max(80, Math.min(width - 40, height - 100, 680));
    const mx = (width - size) / 2;
    const my = (height - size) / 2 - 8;
    drawMap(ctx, world, mx, my, size, true);
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("Map paused · M or Close map to continue", width / 2, my - 22);
  }
}
