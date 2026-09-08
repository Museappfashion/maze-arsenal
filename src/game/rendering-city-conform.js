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

const CITY_MIST_COLOR = [170, 175, 181];
const CITY_BUILDING_TEMPLATES = [
  {
    fill: "#d9d9d9",
    roof: "#f3f4f6",
    shadow: "#9ca3af",
    height: 0.66,
  },
  {
    fill: "#171717",
    roof: "#404040",
    shadow: "#0a0a0a",
    height: 0.92,
  },
  {
    fill: "#8a8a8a",
    roof: "#b1b1b1",
    shadow: "#5a5a5a",
    height: 0.48,
  },
  {
    fill: "#c7c7c7",
    roof: "#e5e7eb",
    shadow: "#8f8f8f",
    height: 0.74,
  },
];

function citySeed(x, y, offset = 0) {
  const value =
    Math.sin(x * 127.1 + y * 311.7 + offset * 53.13) *
    43758.5453123;

  return value - Math.floor(value);
}

function wallTileFacadeIndex(x, y) {
  return Math.abs(x + y) % 4;
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

function isWallTile(world, x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < world.width &&
    y < world.height &&
    !isFloorTile(world, x, y)
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

function getCityMistAlpha(visibleStrength) {
  // Undiscovered City stays completely hidden.
  if (visibleStrength <= 0.78) {
    return 1;
  }

  // Only feather the very edge of the player's reveal radius.
  if (visibleStrength >= 0.98) {
    return 0;
  }

  const edgeProgress =
    (visibleStrength - 0.78) / (0.98 - 0.78);

  return 1 - edgeProgress;
}

function drawCityUndiscoveredMist(ctx, world) {
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
      if (tileIsDiscovered(world, x, y)) {
        continue;
      }

      const visibleStrength = visibleStrengthAt(world, x, y);
      const alpha = getCityMistAlpha(visibleStrength);

      if (alpha <= 0.01) {
        continue;
      }

      const screenX =
        (x - bounds.camera.x) * bounds.scale;
      const screenY =
        (y - bounds.camera.y) * bounds.scale;
      const width = Math.ceil(bounds.scale) + 1;
      const height = Math.ceil(bounds.scale) + 1;

      const noise =
        Math.round((citySeed(x, y, 77) - 0.5) * 12);
      const red = 168 + noise;
      const green = 173 + noise;
      const blue = 179 + noise;

      if (alpha >= 0.999) {
        ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      } else {
        ctx.fillStyle =
          `rgba(${red}, ${green}, ${blue}, ${alpha})`;
      }

      ctx.fillRect(
        Math.floor(screenX),
        Math.floor(screenY),
        width,
        height,
      );

      if (alpha >= 0.999) {
        const haze = citySeed(x, y, 91);
        const hazeTone =
          haze > 0.5
            ? "rgba(255, 255, 255, 0.035)"
            : "rgba(71, 85, 105, 0.035)";

        ctx.fillStyle = hazeTone;
        ctx.fillRect(
          Math.floor(screenX),
          Math.floor(screenY),
          width,
          height,
        );
      }
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

function drawCityOutwardBuildingCaps(ctx, world) {
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
      if (!isWallTile(world, x, y)) {
        continue;
      }

      const size = bounds.scale;
      const screenX =
        (x - bounds.camera.x) * size;
      const screenY =
        (y - bounds.camera.y) * size;
      const template =
        CITY_BUILDING_TEMPLATES[
          wallTileFacadeIndex(x, y)
        ];
      const inset = size * 0.04;
      const width = size - inset * 2;
      const depth = size * template.height;
      const topY = screenY + size - depth - inset;
      const roofHeight = Math.max(2, size * 0.085);
      const hasWallAbove = isWallTile(world, x, y - 1);

      if (hasWallAbove) {
        ctx.fillStyle = template.fill;
        ctx.fillRect(
          screenX + inset,
          screenY,
          width,
          Math.max(0, topY - screenY + roofHeight),
        );

        ctx.strokeStyle = "rgba(17, 24, 39, 0.22)";
        ctx.lineWidth = Math.max(1, size * 0.016);
        ctx.beginPath();
        ctx.moveTo(screenX + inset, screenY + 0.5);
        ctx.lineTo(screenX + inset, topY + depth);
        ctx.moveTo(screenX + inset + width, screenY + 0.5);
        ctx.lineTo(screenX + inset + width, topY + depth);
        ctx.stroke();
        continue;
      }

      if (topY > screenY) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          screenX,
          screenY,
          size + 0.5,
          Math.max(0, topY - screenY),
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

      ctx.fillStyle = template.roof;
      ctx.fillRect(
        screenX + inset,
        topY,
        width,
        roofHeight,
      );
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
  ctx.shadowBlur = 22 * zoom;
  ctx.shadowColor = color;
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
    drawCityOutwardBuildingCaps(ctx, world);
    drawCityUndiscoveredMist(ctx, world);
    drawCityPowerUpRing(ctx, world);
  }
}
