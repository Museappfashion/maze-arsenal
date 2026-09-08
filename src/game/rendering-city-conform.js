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
} from "./gameplay-enhanced.js";
import { drawWorld as drawEnhancedWorld } from "./rendering-enhanced.js";

export * from "./rendering-enhanced.js";

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
      const sx = (x - bounds.camera.x) * size;
      const sy = (y - bounds.camera.y) * size;
      const buildingHeight =
        CITY_BUILDING_HEIGHTS[Math.abs(x + y) % 4];
      const inset = size * 0.04;
      const depth = size * buildingHeight;
      const topY = sy + size - depth - inset;
      const gapHeight = Math.max(0, topY - sy);

      if (gapHeight <= 0) {
        continue;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, sy, size + 0.5, gapHeight);
      ctx.clip();
      drawAsphaltTile(ctx, x, y, sx, sy, size);
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawStrongGrayCityFog(ctx, world) {
  if (world.level?.themeKey !== "city") {
    return;
  }

  ctx.save();

  for (let layer = 0; layer < 3; layer += 1) {
    const baseAlpha = [0.11, 0.15, 0.19][layer];
    const cloudCount = [8, 10, 12][layer];
    const speed = [4.5, 7.5, 10.5][layer];

    for (let index = 0; index < cloudCount; index += 1) {
      const drift = (world.time ?? 0) * speed + index * 83;
      const x =
        ((drift + layer * 140) % (CANVAS_WIDTH + 420)) - 210;
      const y =
        42 +
        ((index * 67 + layer * 31) %
          Math.max(140, CANVAS_HEIGHT - 84));
      const width =
        180 + (index % 4) * 50 + layer * 22;
      const height =
        28 + (index % 3) * 10 + layer * 8;

      ctx.fillStyle =
        layer === 0
          ? `rgba(198, 202, 206, ${baseAlpha})`
          : layer === 1
            ? `rgba(166, 170, 174, ${baseAlpha})`
            : `rgba(132, 136, 140, ${baseAlpha})`;

      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        width,
        height,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(
        x + width * 0.28,
        y + height * 0.16,
        width * 0.66,
        height * 0.88,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(
        x - width * 0.24,
        y - height * 0.08,
        width * 0.58,
        height * 0.78,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  const veil = ctx.createLinearGradient(
    0,
    0,
    0,
    CANVAS_HEIGHT,
  );

  veil.addColorStop(0, "rgba(184, 188, 192, 0.10)");
  veil.addColorStop(0.5, "rgba(142, 146, 150, 0.16)");
  veil.addColorStop(1, "rgba(112, 116, 120, 0.13)");

  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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
  const x = (world.player.x - camera.x) * scale;
  const y = (world.player.y - camera.y) * scale;
  const radius = world.player.radius * scale * 1.55;
  const color = activePowerUps[0].color;

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowBlur = 22 * zoom;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.8 * zoom;
  ctx.globalAlpha = 1;
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
  drawShortBuildingFloorGaps(ctx, world);
  drawStrongGrayCityFog(ctx, world);
  drawCityPowerUpRing(ctx, world);
}
