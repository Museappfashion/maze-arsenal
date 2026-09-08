// src/game/rendering-city-conform.js
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DRAW_TILE,
  FLOOR,
} from "../config/constants-enhanced.js";
import { recordLevelCompletion } from "../services/progression.js";
import {
  getActivePowerUps,
  getCamera,
  getWorldRenderZoom,
  visibleStrengthAt,
} from "./gameplay-enhanced.js";
import { drawWorld as drawEnhancedWorld } from "./rendering-enhanced.js";

export * from "./rendering-enhanced.js";

const CITY_UNDISCOVERED_GRAY = "#74777b";
const CITY_FULL_REVEAL_THRESHOLD = 0.99;
const CITY_BUILDING_HEIGHTS = [0.66, 0.92, 0.48, 0.74];

function citySeed(x, y, offset = 0) {
  const value =
    Math.sin(x * 127.1 + y * 311.7 + offset * 53.13) *
    43758.5453123;

  return value - Math.floor(value);
}

function isFloorTile(world, x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < world.width &&
    y < world.height &&
    world.grid[y][x] === FLOOR
  );
}

function getVisibleTileBounds(world) {
  const camera = getCamera(world);
  const scale = DRAW_TILE * getWorldRenderZoom(world);

  return {
    camera,
    scale,
    minX: Math.max(0, Math.floor(camera.x) - 1),
    minY: Math.max(0, Math.floor(camera.y) - 1),
    maxX: Math.min(
      world.width - 1,
      Math.ceil(camera.x + CANVAS_WIDTH / scale) + 1,
    ),
    maxY: Math.min(
      world.height - 1,
      Math.ceil(camera.y + CANVAS_HEIGHT / scale) + 1,
    ),
  };
}

function tileIsDiscovered(world, x, y) {
  const tileIndex = y * world.width + x;
  return world.discovered?.[tileIndex] === 1;
}

function tileIsInPlayerRevealArea(world, x, y) {
  return (
    visibleStrengthAt(world, x, y) >=
    CITY_FULL_REVEAL_THRESHOLD
  );
}

function drawCityUndiscoveredMask(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode === "3d"
  ) {
    return;
  }

  const bounds = getVisibleTileBounds(world);

  ctx.save();
  ctx.fillStyle = CITY_UNDISCOVERED_GRAY;

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      if (
        tileIsDiscovered(world, x, y) ||
        tileIsInPlayerRevealArea(world, x, y)
      ) {
        continue;
      }

      const screenX =
        (x - bounds.camera.x) * bounds.scale;
      const screenY =
        (y - bounds.camera.y) * bounds.scale;

      ctx.fillRect(
        Math.floor(screenX),
        Math.floor(screenY),
        Math.ceil(bounds.scale) + 1,
        Math.ceil(bounds.scale) + 1,
      );
    }
  }

  ctx.restore();
}

function drawStreetCracks(ctx, sx, sy, size, x, y) {
  if (citySeed(x, y, 18) < 0.52) {
    return;
  }

  ctx.strokeStyle = "rgba(15, 23, 42, 0.26)";
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(
    sx + size * (0.22 + citySeed(x, y, 19) * 0.4),
    sy + size * 0.16,
  );
  ctx.lineTo(
    sx + size * (0.28 + citySeed(x, y, 20) * 0.3),
    sy + size * 0.38,
  );
  ctx.lineTo(
    sx + size * (0.18 + citySeed(x, y, 21) * 0.5),
    sy + size * 0.7,
  );
  ctx.stroke();
}

function drawAsphaltTile(ctx, x, y, sx, sy, size) {
  const variation = citySeed(x, y, 1);
  const asphalt = ctx.createLinearGradient(
    sx,
    sy,
    sx + size,
    sy + size,
  );

  asphalt.addColorStop(
    0,
    variation > 0.5 ? "#3e4245" : "#393d40",
  );
  asphalt.addColorStop(0.55, "#35393c");
  asphalt.addColorStop(1, "#303437");

  ctx.fillStyle = asphalt;
  ctx.fillRect(sx, sy, size + 0.5, size + 0.5);
  drawStreetCracks(ctx, sx, sy, size, x, y);
}

function drawShortBuildingFloorGaps(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode === "3d"
  ) {
    return;
  }

  const bounds = getVisibleTileBounds(world);

  ctx.save();

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      if (isFloorTile(world, x, y)) {
        continue;
      }

      const size = bounds.scale;
      const screenX =
        (x - bounds.camera.x) * size;
      const screenY =
        (y - bounds.camera.y) * size;
      const buildingHeight =
        CITY_BUILDING_HEIGHTS[Math.abs(x + y) % 4];
      const inset = size * 0.04;
      const depth = size * buildingHeight;
      const buildingTop =
        screenY + size - depth - inset;
      const gapHeight =
        Math.max(0, buildingTop - screenY);

      if (gapHeight <= 0) {
        continue;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(
        screenX,
        screenY,
        size + 0.5,
        gapHeight,
      );
      ctx.clip();

      drawAsphaltTile(
        ctx,
        x,
        y,
        screenX,
        screenY,
        size,
      );

      ctx.restore();
    }
  }

  ctx.restore();
}

function drawCityPowerUpRing(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode === "3d"
  ) {
    return;
  }

  const activePowerUps = getActivePowerUps(world);

  if (activePowerUps.length === 0) {
    return;
  }

  const zoom = getWorldRenderZoom(world);
  const scale = DRAW_TILE * zoom;
  const camera = getCamera(world);
  const playerX =
    (world.player.x - camera.x) * scale;
  const playerY =
    (world.player.y - camera.y) * scale;
  const radius =
    world.player.radius * scale * 1.55;
  const color = activePowerUps[0].color;

  ctx.save();
  ctx.translate(playerX, playerY);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.8 * zoom;
  ctx.beginPath();
  ctx.arc(
    0,
    0,
    radius + 2 * zoom,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}

function recordCityCompletion(world) {
  if (
    world.level?.themeKey !== "city" ||
    world.labyrinthMode ||
    !world.victory ||
    world.__cityCompletionRecorded
  ) {
    return;
  }

  recordLevelCompletion(world.level.key);
  world.__cityCompletionRecorded = true;
}

export function drawWorld(ctx, world) {
  drawEnhancedWorld(ctx, world);

  if (world.level?.themeKey !== "city") {
    return;
  }

  recordCityCompletion(world);

  if (world.viewMode !== "3d") {
    drawShortBuildingFloorGaps(ctx, world);
    drawCityUndiscoveredMask(ctx, world);
    drawCityPowerUpRing(ctx, world);
  }
}
