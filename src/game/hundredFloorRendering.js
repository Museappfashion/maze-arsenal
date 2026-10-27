import { floorIndex, hundredFloorHintRoute, nearHundredFloorStairs } from "./hundredFloorMaze.js";
import { DRAW_TILE, LEVEL_THEMES } from "../config/constants.js";
import { drawMazeTile, drawPickupBody, drawPlayerBody } from "./rendering.js?core";

const cachedMaps = new WeakMap();
const renderWorlds = new WeakMap();
const floorThemes = ["city", "space", "jungle", "medieval"];

// Adapt the large floor's compact saved grid to the main game's existing art.
// Keeping art shared means this mode follows later changes to maze tiles and powers.
function mazeArtworkWorld(world) {
  let state = renderWorlds.get(world);
  if (!state || state.grid !== world.grid) {
    const themeKey = floorThemes[(world.floor - 1) % floorThemes.length];
    state = { grid: world.grid, x: world.player.x, y: world.player.y, facing: 0,
      art: { width: world.width, height: world.height, level: { themeKey },
        grid: Array.from({ length: world.height }, (_, y) => world.grid.subarray(y * world.width, (y + 1) * world.width)),
        labyrinthMode: true, player: { radius: .2, facing: 0, powerUps: {}, weapon: "fists" } } };
    renderWorlds.set(world, state);
  }
  const dx = world.player.x - state.x, dy = world.player.y - state.y;
  if (Math.hypot(dx, dy) > .001) state.facing = Math.atan2(dy, dx);
  state.x = world.player.x; state.y = world.player.y;
  Object.assign(state.art.player, { x: state.x, y: state.y, facing: state.facing,
    powerUps: world.haste > 0 ? { haste: { endsAt: world.elapsed + world.haste } } : {} });
  state.art.time = world.elapsed;
  return state.art;
}

function drawClimbPlayer(ctx, art, x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  if (art.level.themeKey === "city") {
    // The same survivor body and white locator ring as Abandoned City.
    ctx.shadowColor = "#f8fafc"; ctx.shadowBlur = 13;
    ctx.strokeStyle = "rgba(248,250,252,.85)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.rotate(art.player.facing + Math.PI / 2);
    ctx.fillStyle = "#111827"; ctx.fillRect(-10, -1, 20, 14);
    ctx.fillStyle = "#1d4ed8"; ctx.fillRect(-4, 4, 8, 8);
    ctx.fillStyle = "#f1c27d"; ctx.beginPath(); ctx.arc(0, -5, 6.5, 0, Math.PI * 2); ctx.fill();
  } else drawPlayerBody(ctx, art, 0, 0);
  ctx.restore();
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

export function drawHundredFloorMaze(ctx, world, width, height, expandedMap = false) {
  const art = mazeArtworkWorld(world);
  ctx.fillStyle = LEVEL_THEMES[art.level.themeKey]?.backdrop ?? "#08111f";
  ctx.fillRect(0, 0, width, height);
  const tile = width < 500 ? DRAW_TILE * 1.25 : DRAW_TILE;
  const camera = {
    x: Math.max(0, Math.min(world.width - width / tile, world.player.x - width / tile / 2)),
    y: Math.max(0, Math.min(world.height - height / tile, world.player.y - height / tile / 2)),
  };
  const firstX = Math.max(0, Math.floor(camera.x));
  const firstY = Math.max(0, Math.floor(camera.y));
  const lastX = Math.min(world.width - 1, Math.ceil(camera.x + width / tile));
  const lastY = Math.min(world.height - 1, Math.ceil(camera.y + height / tile));
  for (let y = firstY; y <= lastY; y++) {
    for (let x = firstX; x <= lastX; x++) {
      const index = floorIndex(x, y);
      if (!world.explored[index] && world.sonar <= 0) continue;
      const px = Math.round((x - camera.x) * tile);
      const py = Math.round((y - camera.y) * tile);
      const nearby = Math.hypot(x + .5 - world.player.x, y + .5 - world.player.y) < 7;
      ctx.globalAlpha = nearby ? 1 : .5;
      ctx.save();
      ctx.translate(px, py); ctx.scale(tile / DRAW_TILE, tile / DRAW_TILE);
      drawMazeTile(ctx, art, x, y, 0, 0);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  if (world.compass > 0 || world.sonar > 0) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(103,232,249,.75)";
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    for (const [index, cell] of hundredFloorHintRoute(world).entries()) {
      const x = (cell % world.width + .5 - camera.x) * tile;
      const y = (Math.floor(cell / world.width) + .5 - camera.y) * tile;
      if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const item of world.pickups) {
    if (world.collected.has(item.index) || (!world.explored[item.index] && world.sonar <= 0) || item.x < firstX || item.x > lastX + 1 || item.y < firstY || item.y > lastY + 1) continue;
    const x = (item.x - camera.x) * tile;
    const y = (item.y - camera.y) * tile;
    ctx.save(); ctx.translate(x, y); ctx.scale(tile / DRAW_TILE, tile / DRAW_TILE);
    drawPickupBody(ctx, art, { ...item, type: "powerup", color: item.type === "haste" ? "#4ade80" : "#22d3ee" }, 0, 0);
    ctx.restore();
  }
  const sx = (world.stairs.x - camera.x) * tile;
  const sy = (world.stairs.y - camera.y) * tile;
  if (sx > -tile && sy > -tile && sx < width + tile && sy < height + tile && (world.explored[floorIndex(Math.floor(world.stairs.x), Math.floor(world.stairs.y))] || world.sonar > 0)) {
    const pulse = .5 + Math.sin(world.elapsed * 4.2) * .5;
    ctx.save(); ctx.translate(sx, sy); ctx.shadowBlur = 22; ctx.shadowColor = "#22c55e";
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, tile * .65);
    glow.addColorStop(0, "#dcfce7"); glow.addColorStop(.3, "#4ade80"); glow.addColorStop(1, "rgba(34,197,94,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, tile * .65, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#86efac"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, tile * (.3 + pulse * .05), 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = "#ecfdf5";
    for (let step = 0; step < 4; step++) ctx.fillRect(-8 + step * 1.5, 7 - step * 4, 16 - step * 3, 1.5);
    ctx.restore();
  }
  const playerX = (world.player.x - camera.x) * tile;
  const playerY = (world.player.y - camera.y) * tile;
  drawClimbPlayer(ctx, art, playerX, playerY, tile / DRAW_TILE);
  if (nearHundredFloorStairs(world)) {
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#dcfce7";
    ctx.fillText(world.floor === 100 ? "E · Reach the summit" : "E · Climb stairs", playerX, playerY - 30);
  }
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
  } else {
    const size = width < 500 ? 100 : 144;
    drawMap(ctx, world, width - size - 20, 20, size);
  }
}
