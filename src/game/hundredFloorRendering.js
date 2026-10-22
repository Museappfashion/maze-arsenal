import { floorIndex, hundredFloorHintRoute, nearHundredFloorStairs } from "./hundredFloorMaze.js";

const cachedMaps = new WeakMap();

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
    const rgb = !visible ? [5, 10, 22] : world.grid[index] ? [45, 57, 78] : [142, 160, 188];
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
  ctx.strokeStyle = "#475569";
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
  ctx.fillStyle = "#fbbf24";
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
  ctx.fillStyle = "#fbbf24";
  ctx.textAlign = "right";
  ctx.fillText(world.floor === 100 ? "■ Summit" : "■ Stairs", x + size, y + size + 20);
}

export function drawHundredFloorMaze(ctx, world, width, height, expandedMap = false) {
  ctx.fillStyle = "#050a16";
  ctx.fillRect(0, 0, width, height);
  const tile = width < 500 ? 30 : 34;
  const camera = { x: world.player.x - width / tile / 2, y: world.player.y - height / tile / 2 };
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
      if (world.grid[index]) {
        ctx.fillStyle = world.theme.wall;
        ctx.fillRect(px, py, tile + 1, tile + 1);
        ctx.fillStyle = world.theme.trim;
        ctx.fillRect(px + 1, py + 1, tile - 2, 3);
        ctx.fillStyle = "rgba(0,0,0,.25)";
        ctx.fillRect(px + tile - 3, py + 3, 3, tile - 3);
        ctx.fillRect(px + 1, py + tile - 3, tile - 1, 3);
      } else {
        ctx.fillStyle = world.theme.floor;
        ctx.fillRect(px, py, tile + 1, tile + 1);
        ctx.strokeStyle = "rgba(148,163,184,.055)";
        ctx.strokeRect(px + .5, py + .5, tile, tile);
      }
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
    ctx.fillStyle = item.type === "haste" ? "#86efac" : "#c4b5fd";
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(item.type === "haste" ? "H" : "S", x, y + 4);
  }
  const sx = (world.stairs.x - camera.x) * tile;
  const sy = (world.stairs.y - camera.y) * tile;
  if (sx > -tile && sy > -tile && sx < width + tile && sy < height + tile && (world.explored[floorIndex(Math.floor(world.stairs.x), Math.floor(world.stairs.y))] || world.sonar > 0)) {
    ctx.fillStyle = "rgba(251,191,36,.2)"; ctx.fillRect(sx - tile / 2 + 1, sy - tile / 2 + 1, tile - 2, tile - 2);
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2; ctx.strokeRect(sx - tile / 2 + 2, sy - tile / 2 + 2, tile - 4, tile - 4);
    for (let step = 0; step < 4; step++) { ctx.fillStyle = "#fbbf24"; ctx.fillRect(sx - 9 + step * 2, sy + 8 - step * 5, 18 - step * 4, 2); }
  }
  const playerX = width / 2;
  const playerY = height / 2;
  ctx.shadowColor = world.haste > 0 ? "#86efac" : "#22d3ee";
  ctx.shadowBlur = 16;
  ctx.fillStyle = world.haste > 0 ? "#86efac" : "#67e8f9";
  ctx.beginPath(); ctx.arc(playerX, playerY, tile * .24, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#e0f2fe"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(playerX - 4, playerY - 3, 2, 3); ctx.fillRect(playerX + 2, playerY - 3, 2, 3);
  if (nearHundredFloorStairs(world)) {
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fef3c7";
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
