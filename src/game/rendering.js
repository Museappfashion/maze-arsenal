// src/game/rendering.js
import { MAX_AMMO } from "../config/ammo.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH, DRAW_TILE, FLOOR, STEEL_WALL, VIEW_3D_FOV, VIEW_3D_MAX_DISTANCE, VIEW_3D_RAY_WIDTH, WALL } from "../config/constants.js";
import { ENEMY_TYPES } from "../config/enemies.js";
import { getLabyrinthEquippedLightStrength, getLabyrinthLight } from "../config/labyrinthLights.js";
import { POWER_UPS } from "../config/powerUps.js";
import { getAmmoLabel, getTheme, getWeaponLabel, isMedievalTheme } from "../config/presentations.js";
import { WORLD_LABEL_BG, WORLD_LABEL_BORDER, WORLD_LABEL_FONT, WORLD_LABEL_TEXT } from "../config/runtime.js";
import { WEAPONS } from "../config/weapons.js";
import { getActivePowerUps, getCamera, getWeaponCooldown, getWorldRenderZoom, hasPowerUp, visibleStrengthAt } from "./gameplay.js";
import { getDiscoveredPercent, hashNoise } from "./maze.js";
import { getLabyrinthTimeRemaining, labyrinthBreakerActive } from "./labyrinth.js";
import { angleDelta, clamp, formatTime, indexOfTile, lerp, normalize, tileCenter } from "../utils/math.js";
import { getPlayerDisplayName } from "../utils/player.js";

export function drawEffects(ctx, world, camera) {
  for (const effect of world.effects ?? []) {
    const x = (effect.x - camera.x) * DRAW_TILE;
    const y = (effect.y - camera.y) * DRAW_TILE;

    if (
      x < -80 ||
      y < -80 ||
      x > CANVAS_WIDTH + 80 ||
      y > CANVAS_HEIGHT + 80
    ) {
      continue;
    }

    const initialTtl =
      effect.kind === "muzzle"
        ? 0.13
        : effect.kind === "ring"
          ? 0.22
          : effect.kind === "explosion"
            ? 0.38
            : 0.55;
    const progress = clamp(effect.age / Math.max(0.001, effect.age + effect.ttl), 0, 1);
    const alpha = clamp(effect.ttl / initialTtl, 0, 1) * (effect.alpha ?? 1);

    ctx.save();

    if (effect.kind === "blood") {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, effect.size * DRAW_TILE), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    if (effect.kind === "shipDebris") {
      const radius = Math.max(2.5, effect.size * DRAW_TILE * 0.9);
      const travelAngle = Math.atan2(effect.vy ?? 0, effect.vx ?? 0);
      const spin = (effect.age ?? 0) * 7.5;

      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(travelAngle + spin);
      ctx.fillStyle = effect.color;
      ctx.fillRect(-radius * 0.65, -radius * 0.3, radius * 1.3, radius * 0.6);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-radius * 0.65, -radius * 0.3, radius * 1.3, radius * 0.6);
      ctx.restore();
      continue;
    }

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 14;
    ctx.shadowColor = effect.color;

    if (effect.kind === "muzzle") {
      const radius = effect.size * DRAW_TILE * (0.7 + progress * 0.5);
      ctx.translate(x, y);
      ctx.rotate(effect.angle ?? 0);
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.2, -radius * 0.18);
      ctx.lineTo(radius * 1.35, 0);
      ctx.lineTo(-radius * 0.2, radius * 0.18);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.kind === "ring") {
      const radius = lerp(effect.size, effect.endSize ?? effect.size * 3, progress) * DRAW_TILE;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(2, 4 * (1 - progress));
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "explosion") {
      const radius = lerp(effect.size, effect.endSize ?? effect.size * 3, progress) * DRAW_TILE;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.25, effect.colors?.[1] ?? "#facc15");
      gradient.addColorStop(0.65, effect.colors?.[0] ?? "#f97316");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(1.5, effect.size * DRAW_TILE * 0.55);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x - effect.vx * DRAW_TILE * 0.045,
        y - effect.vy * DRAW_TILE * 0.045,
      );
      ctx.stroke();
    }

    ctx.restore();
  }
}

export function drawMazeTile(ctx, world, tileX, tileY, screenX, screenY) {
  const theme = getTheme(world);
  const themeKey = world.level.themeKey;
  const noise = hashNoise(tileX * 7 + 3, tileY * 11 + 5);

  if (world.grid[tileY][tileX] === STEEL_WALL) {
    const steelAt = (x, y) =>
      x >= 0 &&
      y >= 0 &&
      x < world.width &&
      y < world.height &&
      world.grid[y][x] === STEEL_WALL;
    const leftSteel = steelAt(tileX - 1, tileY);
    const rightSteel = steelAt(tileX + 1, tileY);
    const upSteel = steelAt(tileX, tileY - 1);
    const downSteel = steelAt(tileX, tileY + 1);
    const vertical = upSteel || downSteel;

    const steelGradient = vertical
      ? ctx.createLinearGradient(screenX, screenY, screenX + DRAW_TILE, screenY)
      : ctx.createLinearGradient(screenX, screenY, screenX, screenY + DRAW_TILE);
    steelGradient.addColorStop(0, theme.steelA ?? "#8b96a3");
    steelGradient.addColorStop(0.48, theme.steelB ?? "#46515d");
    steelGradient.addColorStop(1, "#222a33");
    ctx.fillStyle = steelGradient;
    ctx.fillRect(screenX, screenY, DRAW_TILE + 1, DRAW_TILE + 1);

    ctx.strokeStyle = theme.steelEdge ?? "#d5dde7";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (!leftSteel) {
      ctx.moveTo(screenX + 1, screenY);
      ctx.lineTo(screenX + 1, screenY + DRAW_TILE);
    }
    if (!rightSteel) {
      ctx.moveTo(screenX + DRAW_TILE - 1, screenY);
      ctx.lineTo(screenX + DRAW_TILE - 1, screenY + DRAW_TILE);
    }
    if (!upSteel) {
      ctx.moveTo(screenX, screenY + 1);
      ctx.lineTo(screenX + DRAW_TILE, screenY + 1);
    }
    if (!downSteel) {
      ctx.moveTo(screenX, screenY + DRAW_TILE - 1);
      ctx.lineTo(screenX + DRAW_TILE, screenY + DRAW_TILE - 1);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(screenX + DRAW_TILE * 0.34, screenY);
      ctx.lineTo(screenX + DRAW_TILE * 0.34, screenY + DRAW_TILE);
      ctx.moveTo(screenX + DRAW_TILE * 0.66, screenY);
      ctx.lineTo(screenX + DRAW_TILE * 0.66, screenY + DRAW_TILE);
    } else {
      ctx.moveTo(screenX, screenY + DRAW_TILE * 0.34);
      ctx.lineTo(screenX + DRAW_TILE, screenY + DRAW_TILE * 0.34);
      ctx.moveTo(screenX, screenY + DRAW_TILE * 0.66);
      ctx.lineTo(screenX + DRAW_TILE, screenY + DRAW_TILE * 0.66);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  if (world.grid[tileY][tileX] === WALL) {
    const gradient = ctx.createLinearGradient(
      screenX,
      screenY,
      screenX + DRAW_TILE,
      screenY + DRAW_TILE,
    );
    gradient.addColorStop(0, theme.wallA);
    gradient.addColorStop(0.5, theme.wallB);
    gradient.addColorStop(1, theme.wallC);

    ctx.fillStyle = gradient;
    ctx.fillRect(screenX, screenY, DRAW_TILE, DRAW_TILE);

    ctx.strokeStyle = theme.wallEdge;
    ctx.lineWidth = 1.1;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, DRAW_TILE - 1, DRAW_TILE - 1);

    if (themeKey === "space") {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
      ctx.beginPath();
      ctx.moveTo(screenX + DRAW_TILE * 0.5, screenY + 2);
      ctx.lineTo(screenX + DRAW_TILE * 0.5, screenY + DRAW_TILE - 2);
      ctx.stroke();

      if (noise > 0.68) {
        ctx.fillStyle = noise > 0.86 ? "#f472b6" : "#22d3ee";
        ctx.fillRect(screenX + 4, screenY + 4, 3, 2);
      }
    } else if (themeKey === "jungle") {
      ctx.fillStyle = `rgba(74, 222, 128, ${0.1 + noise * 0.18})`;
      ctx.fillRect(screenX, screenY, DRAW_TILE, 4 + Math.floor(noise * 5));

      ctx.strokeStyle = "rgba(34, 197, 94, 0.38)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(screenX + DRAW_TILE * (0.2 + noise * 0.5), screenY);
      ctx.bezierCurveTo(
        screenX + DRAW_TILE * 0.8,
        screenY + DRAW_TILE * 0.3,
        screenX + DRAW_TILE * 0.15,
        screenY + DRAW_TILE * 0.65,
        screenX + DRAW_TILE * (0.35 + noise * 0.4),
        screenY + DRAW_TILE,
      );
      ctx.stroke();
    } else if (themeKey === "labyrinth") {
      ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screenX + 3, screenY + DRAW_TILE * 0.3);
      ctx.lineTo(screenX + DRAW_TILE - 3, screenY + DRAW_TILE * 0.34);
      ctx.moveTo(screenX + DRAW_TILE * 0.27, screenY + 3);
      ctx.lineTo(screenX + DRAW_TILE * 0.3, screenY + DRAW_TILE - 3);
      ctx.stroke();

      if (noise > 0.72) {
        ctx.fillStyle = `rgba(148, 163, 184, ${0.025 + noise * 0.04})`;
        ctx.fillRect(
          screenX + DRAW_TILE * 0.12,
          screenY + DRAW_TILE * 0.12,
          DRAW_TILE * 0.76,
          2,
        );
      }
    } else {
      ctx.strokeStyle = "rgba(28, 25, 23, 0.62)";
      ctx.lineWidth = 1;
      const mortarY = screenY + DRAW_TILE * 0.5;
      ctx.beginPath();
      ctx.moveTo(screenX, mortarY);
      ctx.lineTo(screenX + DRAW_TILE, mortarY);
      ctx.moveTo(screenX + DRAW_TILE * 0.5, screenY);
      ctx.lineTo(screenX + DRAW_TILE * 0.5, mortarY);
      ctx.moveTo(screenX + DRAW_TILE * 0.25, mortarY);
      ctx.lineTo(screenX + DRAW_TILE * 0.25, screenY + DRAW_TILE);
      ctx.stroke();

      if (noise > 0.78) {
        ctx.fillStyle = "rgba(245, 158, 11, 0.16)";
        ctx.fillRect(screenX + DRAW_TILE - 4, screenY + 4, 2, DRAW_TILE - 8);
      }
    }

    return;
  }

  const checker = (tileX + tileY) % 2 === 0;
  ctx.fillStyle = checker ? theme.floorA : theme.floorB;
  ctx.fillRect(screenX, screenY, DRAW_TILE, DRAW_TILE);

  if (themeKey === "space") {
    ctx.strokeStyle = theme.floorLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, DRAW_TILE - 1, DRAW_TILE - 1);

    ctx.fillStyle = `rgba(125, 211, 252, ${0.05 + noise * 0.08})`;
    ctx.fillRect(
      screenX + 5 + Math.floor(noise * 8),
      screenY + 6 + Math.floor(noise * 6),
      2,
      2,
    );
  } else if (themeKey === "jungle") {
    ctx.strokeStyle = theme.floorLine;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, DRAW_TILE - 1, DRAW_TILE - 1);

    const grassX = screenX + 3 + Math.floor(noise * 15);
    const grassY = screenY + DRAW_TILE - 3;
    ctx.strokeStyle = noise > 0.5 ? "#65a30d" : "#22c55e";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(grassX, grassY);
    ctx.lineTo(grassX - 2, grassY - 5 - noise * 4);
    ctx.moveTo(grassX, grassY);
    ctx.lineTo(grassX + 2, grassY - 4 - noise * 3);
    ctx.stroke();

    if (noise > 0.72) {
      ctx.fillStyle = "rgba(190, 242, 100, 0.22)";
      ctx.beginPath();
      ctx.arc(screenX + DRAW_TILE * 0.7, screenY + DRAW_TILE * 0.34, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = theme.floorLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY + DRAW_TILE * 0.5);
    ctx.lineTo(screenX + DRAW_TILE, screenY + DRAW_TILE * 0.5);
    ctx.moveTo(screenX + DRAW_TILE * 0.5, screenY);
    ctx.lineTo(screenX + DRAW_TILE * 0.5, screenY + DRAW_TILE * 0.5);
    ctx.moveTo(screenX + DRAW_TILE * 0.25, screenY + DRAW_TILE * 0.5);
    ctx.lineTo(screenX + DRAW_TILE * 0.25, screenY + DRAW_TILE);
    ctx.stroke();

    if (noise > 0.76) {
      ctx.fillStyle = "rgba(214, 211, 209, 0.08)";
      ctx.fillRect(screenX + 4, screenY + 5, 7, 2);
    }
  }
}

export function drawExitPortal(ctx, world, camera) {
  const tileIndex = indexOfTile(world.width, world.exit.x, world.exit.y);
  const known =
    world.discovered[tileIndex] === 1 ||
    visibleStrengthAt(world, world.exit.x, world.exit.y) > 0.12;

  if (!known) {
    return;
  }

  const center = tileCenter(world.exit);
  const x = (center.x - camera.x) * DRAW_TILE;
  const y = (center.y - camera.y) * DRAW_TILE;
  const pulse = 0.5 + 0.5 * Math.sin(world.time * 4.2);
  const radius = DRAW_TILE * (0.42 + pulse * 0.08);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 22;
  ctx.shadowColor = "#22c55e";

  const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
  gradient.addColorStop(0, "#dcfce7");
  gradient.addColorStop(0.28, "#4ade80");
  gradient.addColorStop(0.72, "rgba(34, 197, 94, 0.55)");
  gradient.addColorStop(1, "rgba(34, 197, 94, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#86efac";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, DRAW_TILE * (0.28 + pulse * 0.05), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawEnemyEyes(ctx, radius, color = "#ffffff", separation = 0.3) {
  ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      radius * 0.42,
      side * radius * separation,
      Math.max(1.2, radius * 0.12),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

export function drawSpaceEnemy(ctx, enemy, radius, aimAngle) {
  const cyan = "#67e8f9";
  const purple = "#c084fc";
  const dark = "#111827";
  const metal = "#64748b";

  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = Math.max(1.2, radius * 0.12);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (enemy.kind === "turret") {
    ctx.save();
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#172554";
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.strokeStyle = cyan;
    ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.fillStyle = "#1e3a8a";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = cyan;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(aimAngle);
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = Math.max(3, radius * 0.34);
    ctx.beginPath();
    ctx.moveTo(radius * 0.25, 0);
    ctx.lineTo(radius * 1.72, 0);
    ctx.stroke();
    ctx.strokeStyle = cyan;
    ctx.lineWidth = Math.max(1, radius * 0.12);
    ctx.beginPath();
    ctx.moveTo(radius * 0.7, 0);
    ctx.lineTo(radius * 1.75, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (enemy.kind === "skitter") {
    ctx.strokeStyle = cyan;
    ctx.lineWidth = Math.max(1.5, radius * 0.14);
    for (const side of [-1, 1]) {
      for (const xDirection of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(xDirection * radius * 0.3, side * radius * 0.25);
        ctx.lineTo(xDirection * radius * 1.08, side * radius * 0.82);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#312e81";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.8, radius * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = purple;
    ctx.stroke();
    ctx.save();
    ctx.rotate(aimAngle);
    drawEnemyEyes(ctx, radius * 0.72, cyan, 0.28);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.rotate(aimAngle);

  if (enemy.kind === "charger") {
    ctx.fillStyle = "#7c3aed";
    ctx.beginPath();
    ctx.moveTo(radius * 1.3, 0);
    ctx.lineTo(-radius * 0.72, -radius * 0.72);
    ctx.lineTo(-radius * 0.42, 0);
    ctx.lineTo(-radius * 0.72, radius * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = cyan;
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(radius * 0.22, 0, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "spitter") {
    ctx.fillStyle = "#14532d";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.74, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#86efac";
    ctx.stroke();

    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(radius * 0.46, 0, radius * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dcfce7";
    ctx.beginPath();
    ctx.arc(radius * 0.55, 0, radius * 0.11, 0, Math.PI * 2);
    ctx.fill();

    for (const side of [-1, 1]) {
      ctx.strokeStyle = "#4ade80";
      ctx.beginPath();
      ctx.moveTo(-radius * 0.45, side * radius * 0.4);
      ctx.lineTo(-radius * 0.9, side * radius * 0.7);
      ctx.stroke();
    }
  } else if (enemy.kind === "brute") {
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.rect(
      -radius * 0.92,
      -radius * 0.78,
      radius * 1.84,
      radius * 1.56,
    );
    ctx.fill();
    ctx.strokeStyle = "#a78bfa";
    ctx.stroke();

    ctx.fillStyle = metal;
    ctx.fillRect(-radius * 0.25, -radius, radius * 0.5, radius * 2);
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath();
    ctx.arc(radius * 0.5, 0, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "warden") {
    ctx.fillStyle = dark;
    ctx.beginPath();
    for (let index = 0; index < 8; index += 1) {
      const angle = index * (Math.PI / 4);
      const pointRadius = index % 2 === 0 ? radius * 1.08 : radius * 0.78;
      const px = Math.cos(angle) * pointRadius;
      const py = Math.sin(angle) * pointRadius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = purple;
    ctx.lineWidth = Math.max(1.5, radius * 0.13);
    ctx.stroke();

    ctx.fillStyle = "#581c87";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0abfc";
    ctx.beginPath();
    ctx.arc(radius * 0.2, 0, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = enemy.kind === "crawler" ? "#4338ca" : "#1d4ed8";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.92, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = cyan;
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(-radius * 0.35, 0, radius * 0.38, 0, Math.PI * 2);
    ctx.fill();
    drawEnemyEyes(ctx, radius, "#f8fafc", 0.28);
  }

  ctx.restore();
}

export function drawJungleEnemy(ctx, enemy, radius, aimAngle) {
  const leaf = "#4d7c0f";
  const brightLeaf = "#a3e635";
  const bark = "#713f12";
  const poison = "#86efac";
  const outline = "#ecfccb";

  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1.2, radius * 0.11);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (enemy.kind === "turret") {
    ctx.fillStyle = bark;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fde68a";
    ctx.stroke();

    for (let index = 0; index < 6; index += 1) {
      const angle = index * (Math.PI / 3);
      ctx.fillStyle = index % 2 ? "#65a30d" : leaf;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(angle) * radius * 0.85,
        Math.sin(angle) * radius * 0.85,
        radius * 0.42,
        radius * 0.18,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.save();
    ctx.rotate(aimAngle);
    ctx.fillStyle = "#a16207";
    ctx.fillRect(radius * 0.1, -radius * 0.17, radius * 1.55, radius * 0.34);
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.moveTo(radius * 1.72, 0);
    ctx.lineTo(radius * 1.44, -radius * 0.22);
    ctx.lineTo(radius * 1.44, radius * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  if (enemy.kind === "skitter") {
    ctx.strokeStyle = "#365314";
    ctx.lineWidth = Math.max(1.6, radius * 0.14);
    for (const side of [-1, 1]) {
      for (const xDirection of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(xDirection * radius * 0.2, side * radius * 0.25);
        ctx.lineTo(xDirection * radius * 1.02, side * radius * 0.82);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.78, radius * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#facc15";
    ctx.stroke();

    ctx.strokeStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.52);
    ctx.lineTo(0, radius * 0.52);
    ctx.stroke();
    return;
  }

  ctx.save();
  ctx.rotate(aimAngle);

  if (enemy.kind === "charger") {
    ctx.fillStyle = "#713f12";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fde68a";
    ctx.stroke();

    ctx.fillStyle = "#422006";
    ctx.beginPath();
    ctx.arc(radius * 0.66, 0, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#fafaf9";
    ctx.lineWidth = Math.max(1.5, radius * 0.13);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(radius * 0.82, side * radius * 0.28);
      ctx.lineTo(radius * 1.28, side * radius * 0.45);
      ctx.stroke();
    }
  } else if (enemy.kind === "spitter") {
    ctx.fillStyle = "#166534";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = brightLeaf;
    ctx.stroke();

    for (let index = 0; index < 5; index += 1) {
      const angle = index * ((Math.PI * 2) / 5);
      ctx.fillStyle = index % 2 ? "#4d7c0f" : "#65a30d";
      ctx.beginPath();
      ctx.ellipse(
        -Math.cos(angle) * radius * 0.72,
        -Math.sin(angle) * radius * 0.72,
        radius * 0.38,
        radius * 0.16,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.fillStyle = poison;
    ctx.beginPath();
    ctx.arc(radius * 0.4, 0, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#052e16";
    ctx.beginPath();
    ctx.arc(radius * 0.5, 0, radius * 0.13, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "brute") {
    ctx.fillStyle = "#3f6212";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.94, radius * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#bef264";
    ctx.stroke();

    ctx.fillStyle = "#713f12";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(-radius * 0.2, side * radius * 0.72, radius * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#d9f99d";
    ctx.beginPath();
    ctx.arc(radius * 0.44, 0, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "warden") {
    ctx.fillStyle = "#14532d";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = Math.max(1.5, radius * 0.13);
    ctx.stroke();

    for (let index = 0; index < 8; index += 1) {
      const angle = index * (Math.PI / 4);
      ctx.fillStyle = index % 2 ? "#65a30d" : "#84cc16";
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(angle) * radius * 0.92,
        Math.sin(angle) * radius * 0.92,
        radius * 0.42,
        radius * 0.16,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(radius * 0.25, 0, radius * 0.17, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "crawler") {
    ctx.fillStyle = "#365314";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.02, radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a3e635";
    ctx.stroke();

    ctx.fillStyle = "#1a2e05";
    for (const offset of [-0.45, 0, 0.45]) {
      ctx.beginPath();
      ctx.arc(offset * radius, 0, radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    drawEnemyEyes(ctx, radius * 0.9, "#fef08a", 0.28);
  } else {
    ctx.fillStyle = "#4d7c0f";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.88, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d9f99d";
    ctx.stroke();

    ctx.fillStyle = "#713f12";
    ctx.beginPath();
    ctx.arc(-radius * 0.2, 0, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    drawEnemyEyes(ctx, radius, "#fef9c3", 0.28);
  }

  ctx.restore();
}

export function drawMedievalEnemy(ctx, enemy, radius, aimAngle) {
  const iron = "#78716c";
  const darkIron = "#292524";
  const leather = "#78350f";
  const bone = "#f5f5f4";
  const red = "#b91c1c";

  ctx.strokeStyle = "#e7e5e4";
  ctx.lineWidth = Math.max(1.2, radius * 0.11);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (enemy.kind === "turret") {
    ctx.fillStyle = "#44403c";
    ctx.fillRect(-radius * 0.92, -radius * 0.92, radius * 1.84, radius * 1.84);
    ctx.strokeStyle = "#d6d3d1";
    ctx.strokeRect(-radius * 0.92, -radius * 0.92, radius * 1.84, radius * 1.84);

    ctx.save();
    ctx.rotate(aimAngle);
    ctx.strokeStyle = leather;
    ctx.lineWidth = Math.max(3, radius * 0.24);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.8, -radius * 0.7);
    ctx.quadraticCurveTo(radius * 0.2, 0, -radius * 0.8, radius * 0.7);
    ctx.stroke();

    ctx.strokeStyle = bone;
    ctx.lineWidth = Math.max(1.3, radius * 0.1);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.6, 0);
    ctx.lineTo(radius * 1.65, 0);
    ctx.stroke();

    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.moveTo(radius * 1.72, 0);
    ctx.lineTo(radius * 1.42, -radius * 0.19);
    ctx.lineTo(radius * 1.42, radius * 0.19);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  if (enemy.kind === "skitter") {
    ctx.strokeStyle = "#57534e";
    ctx.lineWidth = Math.max(1.5, radius * 0.14);
    for (const side of [-1, 1]) {
      for (const xDirection of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(xDirection * radius * 0.2, side * radius * 0.2);
        ctx.lineTo(xDirection * radius * 1.05, side * radius * 0.82);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.72, radius * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = red;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(radius * 0.3, side * radius * 0.18, radius * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  ctx.save();
  ctx.rotate(aimAngle);

  if (enemy.kind === "charger") {
    ctx.fillStyle = darkIron;
    ctx.beginPath();
    ctx.moveTo(radius * 1.18, 0);
    ctx.lineTo(radius * 0.35, -radius * 0.72);
    ctx.lineTo(-radius * 0.78, -radius * 0.65);
    ctx.lineTo(-radius * 0.88, radius * 0.65);
    ctx.lineTo(radius * 0.35, radius * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#d6d3d1";
    ctx.stroke();

    ctx.fillStyle = red;
    ctx.fillRect(-radius * 0.55, -radius * 0.12, radius * 0.95, radius * 0.24);
    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.moveTo(radius * 1.35, 0);
    ctx.lineTo(radius * 0.92, -radius * 0.2);
    ctx.lineTo(radius * 0.92, radius * 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === "spitter") {
    ctx.fillStyle = "#3f3f46";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a3a3a3";
    ctx.stroke();

    ctx.fillStyle = "#365314";
    ctx.beginPath();
    ctx.arc(radius * 0.42, 0, radius * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#bef264";
    ctx.beginPath();
    ctx.arc(radius * 0.5, 0, radius * 0.13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#7f1d1d";
    ctx.beginPath();
    ctx.moveTo(-radius * 0.65, -radius * 0.65);
    ctx.lineTo(0, -radius * 1.18);
    ctx.lineTo(radius * 0.65, -radius * 0.65);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === "brute") {
    ctx.fillStyle = "#57534e";
    ctx.beginPath();
    ctx.rect(
      -radius * 0.9,
      -radius * 0.82,
      radius * 1.8,
      radius * 1.64,
    );
    ctx.fill();
    ctx.strokeStyle = "#d6d3d1";
    ctx.stroke();

    ctx.fillStyle = leather;
    ctx.fillRect(-radius * 0.16, -radius * 0.82, radius * 0.32, radius * 1.64);

    ctx.fillStyle = bone;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(radius * 0.35, side * radius * 0.45);
      ctx.lineTo(radius * 0.95, side * radius * 0.72);
      ctx.lineTo(radius * 0.72, side * radius * 0.22);
      ctx.closePath();
      ctx.fill();
    }
  } else if (enemy.kind === "warden") {
    ctx.fillStyle = "#292524";
    ctx.beginPath();
    for (let index = 0; index < 6; index += 1) {
      const angle = -Math.PI / 2 + index * (Math.PI / 3);
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = Math.max(1.5, radius * 0.13);
    ctx.stroke();

    ctx.fillStyle = "#7f1d1d";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(-radius * 0.42, -radius * 0.68);
    ctx.lineTo(-radius * 0.12, -radius * 1.06);
    ctx.lineTo(radius * 0.08, -radius * 0.68);
    ctx.lineTo(radius * 0.36, -radius * 1.02);
    ctx.lineTo(radius * 0.52, -radius * 0.56);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === "crawler") {
    ctx.fillStyle = "#44403c";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a8a29e";
    ctx.stroke();

    ctx.strokeStyle = "#78716c";
    ctx.lineWidth = Math.max(1.2, radius * 0.11);
    for (const offset of [-0.42, 0, 0.42]) {
      ctx.beginPath();
      ctx.moveTo(offset * radius, -radius * 0.62);
      ctx.lineTo(offset * radius, radius * 0.62);
      ctx.stroke();
    }
    drawEnemyEyes(ctx, radius, red, 0.27);
  } else {
    ctx.fillStyle = "#3f6212";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.86, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d6d3d1";
    ctx.stroke();

    ctx.fillStyle = leather;
    ctx.beginPath();
    ctx.arc(-radius * 0.28, 0, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.3, -radius * 0.58);
    ctx.lineTo(-radius * 0.52, -radius * 0.98);
    ctx.lineTo(-radius * 0.06, -radius * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-radius * 0.3, radius * 0.58);
    ctx.lineTo(-radius * 0.52, radius * 0.98);
    ctx.lineTo(-radius * 0.06, radius * 0.66);
    ctx.closePath();
    ctx.fill();
    drawEnemyEyes(ctx, radius, "#fef08a", 0.28);
  }

  ctx.restore();
}

export function drawEnemyBody(ctx, world, enemy, x, y) {
  const config = ENEMY_TYPES[enemy.kind];
  const radius = enemy.radius * DRAW_TILE;
  const aimAngle = Math.atan2(
    world.player.y - enemy.y,
    world.player.x - enemy.x,
  );
  const themeKey = world.level.themeKey;

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowBlur = enemy.awake ? 13 : 6;
  ctx.shadowColor =
    themeKey === "space"
      ? "#a78bfa"
      : themeKey === "jungle"
        ? "#84cc16"
        : "#ef4444";

  if (themeKey === "space") {
    drawSpaceEnemy(ctx, enemy, radius, aimAngle);
  } else if (themeKey === "jungle") {
    drawJungleEnemy(ctx, enemy, radius, aimAngle);
  } else {
    drawMedievalEnemy(ctx, enemy, radius, aimAngle);
  }

  ctx.restore();
}

export function drawEnemyHealth(ctx, enemy, x, y) {
  const width = 30;
  const height = 5;
  const top = y - enemy.radius * DRAW_TILE - 11;
  const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);

  ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
  ctx.fillRect(x - width / 2 - 1, top - 1, width + 2, height + 2);

  ctx.fillStyle =
    ratio > 0.55 ? "#4ade80" : ratio > 0.25 ? "#facc15" : "#ef4444";
  ctx.fillRect(x - width / 2, top, width * ratio, height);
}

export function drawProjectile(ctx, projectile, camera) {
  const x = (projectile.x - camera.x) * DRAW_TILE;
  const y = (projectile.y - camera.y) * DRAW_TILE;
  const velocity = normalize(projectile.vx, projectile.vy);
  const trailLength = projectile.owner === "player" ? 12 : 9;

  ctx.save();

  if (projectile.isArrow) {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    const arrowLength = 18;

    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowBlur = 6;
    ctx.shadowColor = projectile.color ?? "#d6a85f";
    ctx.strokeStyle = projectile.color ?? "#d6a85f";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(-arrowLength * 0.7, 0);
    ctx.lineTo(arrowLength * 0.45, 0);
    ctx.stroke();

    ctx.fillStyle = "#d1d5db";
    ctx.beginPath();
    ctx.moveTo(arrowLength * 0.62, 0);
    ctx.lineTo(arrowLength * 0.38, -3.2);
    ctx.lineTo(arrowLength * 0.38, 3.2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-arrowLength * 0.62, 0);
    ctx.lineTo(-arrowLength * 0.78, -4);
    ctx.moveTo(-arrowLength * 0.62, 0);
    ctx.lineTo(-arrowLength * 0.78, 4);
    ctx.stroke();

    ctx.restore();
    return;
  }

  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 14;
  ctx.shadowColor = projectile.color;

  ctx.strokeStyle = projectile.color;
  ctx.lineWidth = projectile.owner === "player" ? 3 : 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - velocity.x * trailLength, y - velocity.y * trailLength);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, projectile.owner === "player" ? 2.8 : 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawMedievalBowShape(ctx, weaponKey, size, wood, metal, glow) {
  const profiles = {
    pistol: { limb: 0.58, depth: 0.34, arrow: 0.82, layers: 1 },
    revolver: { limb: 0.72, depth: 0.4, arrow: 0.9, layers: 1 },
    smg: { limb: 0.52, depth: 0.3, arrow: 0.78, layers: 2 },
    shotgun: { limb: 0.68, depth: 0.46, arrow: 0.86, layers: 3 },
    rifle: { limb: 0.82, depth: 0.38, arrow: 1.0, layers: 1 },
    dmr: { limb: 0.94, depth: 0.42, arrow: 1.08, layers: 1 },
  };
  const profile = profiles[weaponKey] ?? profiles.rifle;

  ctx.save();
  ctx.strokeStyle = wood;
  ctx.lineWidth = Math.max(2, size * 0.075);
  ctx.beginPath();
  ctx.moveTo(-size * 0.02, -size * profile.limb);
  ctx.quadraticCurveTo(
    size * profile.depth,
    -size * 0.26,
    size * 0.08,
    0,
  );
  ctx.quadraticCurveTo(
    size * profile.depth,
    size * 0.26,
    -size * 0.02,
    size * profile.limb,
  );
  ctx.stroke();

  ctx.strokeStyle = "#e7e5e4";
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(-size * 0.02, -size * profile.limb);
  ctx.lineTo(-size * 0.22, 0);
  ctx.lineTo(-size * 0.02, size * profile.limb);
  ctx.stroke();

  ctx.strokeStyle = metal;
  ctx.lineWidth = Math.max(1.5, size * 0.04);
  ctx.beginPath();
  ctx.moveTo(-size * 0.34, 0);
  ctx.lineTo(size * profile.arrow, 0);
  ctx.stroke();

  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(size * (profile.arrow + 0.12), 0);
  ctx.lineTo(size * profile.arrow, -size * 0.08);
  ctx.lineTo(size * profile.arrow, size * 0.08);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#fef3c7";
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(-size * 0.28, 0);
  ctx.lineTo(-size * 0.4, -size * 0.1);
  ctx.moveTo(-size * 0.28, 0);
  ctx.lineTo(-size * 0.4, size * 0.1);
  ctx.stroke();

  if (profile.layers > 1) {
    ctx.strokeStyle = glow;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = Math.max(1, size * 0.025);
    for (let layer = 1; layer < profile.layers; layer += 1) {
      const offset = (layer - (profile.layers - 1) / 2) * size * 0.1;
      ctx.beginPath();
      ctx.moveTo(-size * 0.2, offset);
      ctx.lineTo(size * profile.arrow * 0.92, offset);
      ctx.stroke();
    }
  }

  if (weaponKey === "dmr") {
    ctx.strokeStyle = glow;
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.beginPath();
    ctx.arc(size * 0.18, -size * 0.12, size * 0.09, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawWeaponShape(ctx, world, weaponKey, size) {
  const themeKey = world.level.themeKey;
  const metal =
    themeKey === "space"
      ? "#cbd5e1"
      : themeKey === "jungle"
        ? "#94a3b8"
        : "#a8a29e";
  const darkMetal =
    themeKey === "space"
      ? "#475569"
      : themeKey === "jungle"
        ? "#334155"
        : "#44403c";
  const wood =
    themeKey === "jungle"
      ? "#854d0e"
      : themeKey === "medieval"
        ? "#78350f"
        : "#64748b";
  const glow =
    themeKey === "space"
      ? "#22d3ee"
      : themeKey === "jungle"
        ? "#84cc16"
        : "#f59e0b";

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = themeKey === "space" ? size * 0.22 : 0;
  ctx.shadowColor = glow;

  if (weaponKey === "fists") {
    ctx.fillStyle = metal;
    ctx.strokeStyle = darkMetal;
    ctx.lineWidth = Math.max(1, size * 0.07);

    for (const y of [-size * 0.18, size * 0.18]) {
      ctx.beginPath();
      ctx.arc(size * 0.12, y, size * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      for (let index = 0; index < 3; index += 1) {
        ctx.beginPath();
        ctx.arc(
          size * (0.23 + index * 0.09),
          y - size * 0.04,
          size * 0.055,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  } else if (weaponKey === "crowbar") {
    ctx.strokeStyle = wood;
    ctx.lineWidth = size * 0.2;
    ctx.beginPath();
    ctx.moveTo(-size * 0.18, 0);
    ctx.lineTo(size * 0.58, 0);
    ctx.stroke();

    ctx.fillStyle = themeKey === "space" ? metal : "#92400e";
    ctx.beginPath();
    ctx.ellipse(size * 0.68, 0, size * 0.24, size * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = darkMetal;
    ctx.lineWidth = Math.max(1, size * 0.055);
    ctx.stroke();
  } else if (weaponKey === "machete") {
    ctx.fillStyle = wood;
    ctx.fillRect(-size * 0.28, -size * 0.08, size * 0.34, size * 0.16);

    ctx.fillStyle = metal;
    ctx.strokeStyle = darkMetal;
    ctx.lineWidth = Math.max(1, size * 0.055);
    ctx.beginPath();
    ctx.moveTo(size * 0.02, -size * 0.11);
    ctx.lineTo(size * 0.78, -size * 0.18);
    ctx.lineTo(size * 0.9, 0);
    ctx.lineTo(size * 0.72, size * 0.12);
    ctx.lineTo(size * 0.02, size * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (themeKey === "space") {
      ctx.strokeStyle = glow;
      ctx.lineWidth = Math.max(1, size * 0.045);
      ctx.beginPath();
      ctx.moveTo(size * 0.12, -size * 0.08);
      ctx.lineTo(size * 0.75, -size * 0.13);
      ctx.stroke();
    }
  } else if (
    themeKey === "medieval" &&
    WEAPONS[weaponKey]?.type === "ranged"
  ) {
    drawMedievalBowShape(ctx, weaponKey, size, wood, metal, glow);
  } else if (weaponKey === "pistol") {
    ctx.fillStyle = metal;
    ctx.fillRect(-size * 0.08, -size * 0.13, size * 0.66, size * 0.24);
    ctx.fillStyle = darkMetal;
    ctx.beginPath();
    ctx.moveTo(size * 0.1, size * 0.09);
    ctx.lineTo(size * 0.34, size * 0.09);
    ctx.lineTo(size * 0.22, size * 0.52);
    ctx.lineTo(size * 0.02, size * 0.46);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = glow;
    ctx.fillRect(size * 0.58, -size * 0.07, size * 0.13, size * 0.12);
  } else if (weaponKey === "revolver") {
    ctx.fillStyle = metal;
    ctx.fillRect(size * 0.08, -size * 0.1, size * 0.62, size * 0.18);

    ctx.fillStyle = darkMetal;
    ctx.beginPath();
    ctx.arc(size * 0.12, 0, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.stroke();

    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(-size * 0.02, size * 0.12);
    ctx.lineTo(size * 0.18, size * 0.12);
    ctx.lineTo(size * 0.04, size * 0.52);
    ctx.lineTo(-size * 0.15, size * 0.44);
    ctx.closePath();
    ctx.fill();
  } else if (weaponKey === "smg") {
    ctx.fillStyle = darkMetal;
    ctx.fillRect(-size * 0.18, -size * 0.2, size * 0.65, size * 0.38);
    ctx.fillStyle = metal;
    ctx.fillRect(size * 0.4, -size * 0.1, size * 0.46, size * 0.16);
    ctx.fillStyle = darkMetal;
    ctx.beginPath();
    ctx.moveTo(size * 0.04, size * 0.15);
    ctx.lineTo(size * 0.25, size * 0.15);
    ctx.lineTo(size * 0.16, size * 0.5);
    ctx.lineTo(-size * 0.03, size * 0.46);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(1, size * 0.09);
    ctx.beginPath();
    ctx.moveTo(-size * 0.17, 0);
    ctx.lineTo(-size * 0.48, size * 0.18);
    ctx.stroke();
  } else if (weaponKey === "shotgun") {
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(-size * 0.42, -size * 0.17);
    ctx.lineTo(size * 0.05, -size * 0.12);
    ctx.lineTo(size * 0.08, size * 0.12);
    ctx.lineTo(-size * 0.46, size * 0.24);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(2, size * 0.13);
    for (const y of [-size * 0.07, size * 0.07]) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.02, y);
      ctx.lineTo(size * 0.92, y);
      ctx.stroke();
    }

    ctx.fillStyle = darkMetal;
    ctx.fillRect(size * 0.16, -size * 0.17, size * 0.2, size * 0.34);
  } else if (weaponKey === "rifle" || weaponKey === "dmr") {
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(-size * 0.48, -size * 0.16);
    ctx.lineTo(size * 0.05, -size * 0.1);
    ctx.lineTo(size * 0.08, size * 0.12);
    ctx.lineTo(-size * 0.5, size * 0.24);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = darkMetal;
    ctx.fillRect(-size * 0.02, -size * 0.16, size * 0.48, size * 0.3);

    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(2, size * 0.11);
    ctx.beginPath();
    ctx.moveTo(size * 0.35, -size * 0.02);
    ctx.lineTo(size * 0.98, -size * 0.02);
    ctx.stroke();

    ctx.fillStyle = darkMetal;
    ctx.beginPath();
    ctx.moveTo(size * 0.08, size * 0.11);
    ctx.lineTo(size * 0.28, size * 0.11);
    ctx.lineTo(size * 0.18, size * 0.48);
    ctx.lineTo(size * 0.02, size * 0.42);
    ctx.closePath();
    ctx.fill();

    if (weaponKey === "dmr") {
      ctx.fillStyle = metal;
      ctx.fillRect(size * 0.02, -size * 0.32, size * 0.38, size * 0.1);
      ctx.beginPath();
      ctx.arc(size * 0.36, -size * 0.27, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export function drawPlayerBody(ctx, world, x, y) {
  const player = world.player;
  const collisionRadius = player.radius * DRAW_TILE;
  const radius = collisionRadius * 1.55;
  const activePowerUps = getActivePowerUps(world);
  const theme = getTheme(world);
  const themeKey = world.level.themeKey;
  const pulse = 0.5 + Math.sin(world.time * 5) * 0.5;
  const beaconRadius = radius + 5 + pulse * 2;

  ctx.save();
  ctx.translate(x, y);

  ctx.shadowBlur = 22;
  ctx.shadowColor = activePowerUps[0]?.color ?? theme.playerGlow;

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = theme.playerGlow;
  ctx.beginPath();
  ctx.arc(0, 0, beaconRadius + 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, beaconRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = activePowerUps[0]?.color ?? theme.playerGlow;
  ctx.lineWidth = 4.5;
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.arc(0, 0, beaconRadius - 2.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.rotate(player.facing);

  if (activePowerUps.length > 0) {
    ctx.strokeStyle = activePowerUps[0].color;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  const outline = "#020617";
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(2.2, radius * 0.24);

  if (themeKey === "space") {
    // Twin animated engines make this read as a spaceship instead of an arrow.
    ctx.save();
    ctx.globalAlpha = 0.72 + pulse * 0.25;
    for (const engineY of [-radius * 0.34, radius * 0.34]) {
      const flame = ctx.createLinearGradient(-radius * 1.65, 0, -radius * 0.72, 0);
      flame.addColorStop(0, "rgba(34, 211, 238, 0)");
      flame.addColorStop(0.42, "#22d3ee");
      flame.addColorStop(1, "#f8fafc");
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(-radius * (1.42 + pulse * 0.2), engineY);
      ctx.lineTo(-radius * 0.7, engineY - radius * 0.13);
      ctx.lineTo(-radius * 0.7, engineY + radius * 0.13);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Swept wings.
    ctx.fillStyle = "#075985";
    ctx.beginPath();
    ctx.moveTo(radius * 0.42, -radius * 0.18);
    ctx.lineTo(-radius * 0.48, -radius * 1.05);
    ctx.lineTo(-radius * 0.82, -radius * 0.94);
    ctx.lineTo(-radius * 0.48, -radius * 0.25);
    ctx.lineTo(-radius * 0.48, radius * 0.25);
    ctx.lineTo(-radius * 0.82, radius * 0.94);
    ctx.lineTo(-radius * 0.48, radius * 1.05);
    ctx.lineTo(radius * 0.42, radius * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Armored central fuselage and pointed nose.
    const hull = ctx.createLinearGradient(-radius, -radius, radius, radius);
    hull.addColorStop(0, "#e2e8f0");
    hull.addColorStop(0.52, "#94a3b8");
    hull.addColorStop(1, "#475569");
    ctx.fillStyle = hull;
    ctx.strokeStyle = outline;
    ctx.beginPath();
    ctx.moveTo(radius * 1.5, 0);
    ctx.bezierCurveTo(
      radius * 0.72,
      -radius * 0.55,
      -radius * 0.65,
      -radius * 0.48,
      -radius * 0.92,
      -radius * 0.28,
    );
    ctx.lineTo(-radius * 0.92, radius * 0.28);
    ctx.bezierCurveTo(
      -radius * 0.65,
      radius * 0.48,
      radius * 0.72,
      radius * 0.55,
      radius * 1.5,
      0,
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Two engine pods at the rear.
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = Math.max(1.2, radius * 0.12);
    for (const engineY of [-radius * 0.34, radius * 0.34]) {
      ctx.beginPath();
      ctx.ellipse(-radius * 0.73, engineY, radius * 0.3, radius * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Glass cockpit.
    const glass = ctx.createRadialGradient(
      radius * 0.42,
      -radius * 0.14,
      0,
      radius * 0.34,
      0,
      radius * 0.62,
    );
    glass.addColorStop(0, "#ecfeff");
    glass.addColorStop(0.35, "#22d3ee");
    glass.addColorStop(1, "#164e63");
    ctx.fillStyle = glass;
    ctx.strokeStyle = "#cffafe";
    ctx.beginPath();
    ctx.ellipse(radius * 0.38, 0, radius * 0.52, radius * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hull panel lines and nose beacon.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = Math.max(1, radius * 0.08);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.24, -radius * 0.38);
    ctx.lineTo(-radius * 0.24, radius * 0.38);
    ctx.stroke();

    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(radius * 1.18, 0, radius * 0.11, 0, Math.PI * 2);
    ctx.fill();
  } else if (themeKey === "jungle") {
    // Boots and backpack establish the explorer silhouette from overhead.
    ctx.fillStyle = "#3f2a16";
    for (const legY of [-radius * 0.3, radius * 0.3]) {
      ctx.beginPath();
      ctx.ellipse(-radius * 0.72, legY, radius * 0.38, radius * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#78350f";
    ctx.strokeStyle = outline;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.52, 0, radius * 0.54, radius * 0.64, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = Math.max(1, radius * 0.1);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.72, -radius * 0.52);
    ctx.lineTo(-radius * 0.72, radius * 0.52);
    ctx.stroke();

    // Khaki shirt, arms, and satchel strap.
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, radius * 0.22);
    ctx.fillStyle = "#4d7c0f";
    for (const armY of [-radius * 0.58, radius * 0.58]) {
      ctx.beginPath();
      ctx.ellipse(0, armY, radius * 0.62, radius * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const shirt = ctx.createLinearGradient(-radius, 0, radius, 0);
    shirt.addColorStop(0, "#365314");
    shirt.addColorStop(1, "#65a30d");
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.05, 0, radius * 0.78, radius * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#d6b06f";
    ctx.lineWidth = Math.max(1.2, radius * 0.13);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.42, -radius * 0.5);
    ctx.lineTo(radius * 0.28, radius * 0.5);
    ctx.stroke();

    // Face and unmistakable wide-brimmed expedition hat.
    ctx.fillStyle = "#c68642";
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(1.6, radius * 0.15);
    ctx.beginPath();
    ctx.arc(radius * 0.52, 0, radius * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#d6b06f";
    ctx.beginPath();
    ctx.ellipse(radius * 0.5, 0, radius * 0.58, radius * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#a16207";
    ctx.beginPath();
    ctx.ellipse(radius * 0.5, 0, radius * 0.36, radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#713f12";
    ctx.lineWidth = Math.max(1.2, radius * 0.11);
    ctx.beginPath();
    ctx.moveTo(radius * 0.5, -radius * 0.43);
    ctx.lineTo(radius * 0.5, radius * 0.43);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(radius * 0.86, 0, radius * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else if (themeKey === "labyrinth") {
    const body = ctx.createRadialGradient(
      radius * 0.3,
      -radius * 0.18,
      0,
      0,
      0,
      radius,
    );
    body.addColorStop(0, "#d1d5db");
    body.addColorStop(0.45, "#64748b");
    body.addColorStop(1, "#111827");
    ctx.fillStyle = body;
    ctx.strokeStyle = "#020617";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.7, radius * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.arc(radius * 0.56, 0, radius * 0.31, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#020617";
    ctx.beginPath();
    ctx.arc(radius * 0.68, -radius * 0.1, radius * 0.055, 0, Math.PI * 2);
    ctx.arc(radius * 0.68, radius * 0.1, radius * 0.055, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = Math.max(2, radius * 0.18);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-radius * 0.28, -radius * 0.34);
    ctx.lineTo(-radius * 0.72, -radius * 0.62);
    ctx.moveTo(-radius * 0.28, radius * 0.34);
    ctx.lineTo(-radius * 0.72, radius * 0.62);
    ctx.stroke();
  } else {
    // A red cape and steel boots create a readable knight silhouette.
    ctx.fillStyle = "#991b1b";
    ctx.strokeStyle = outline;
    ctx.beginPath();
    ctx.moveTo(radius * 0.2, -radius * 0.48);
    ctx.lineTo(-radius * 1.05, -radius * 0.72);
    ctx.lineTo(-radius * 0.82, 0);
    ctx.lineTo(-radius * 1.05, radius * 0.72);
    ctx.lineTo(radius * 0.2, radius * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#57534e";
    for (const legY of [-radius * 0.3, radius * 0.3]) {
      ctx.beginPath();
      ctx.ellipse(-radius * 0.68, legY, radius * 0.38, radius * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const armor = ctx.createLinearGradient(-radius, -radius, radius, radius);
    armor.addColorStop(0, "#f5f5f4");
    armor.addColorStop(0.5, "#a8a29e");
    armor.addColorStop(1, "#57534e");
    ctx.fillStyle = armor;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.05, 0, radius * 0.76, radius * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rounded pauldrons.
    ctx.fillStyle = "#d6d3d1";
    ctx.strokeStyle = outline;
    for (const shoulderY of [-radius * 0.62, radius * 0.62]) {
      ctx.beginPath();
      ctx.arc(-radius * 0.02, shoulderY, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Helmet, visor, and red plume.
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.moveTo(radius * 0.1, -radius * 0.18);
    ctx.quadraticCurveTo(-radius * 0.58, -radius * 0.46, -radius * 0.9, -radius * 0.08);
    ctx.quadraticCurveTo(-radius * 0.38, radius * 0.05, radius * 0.22, radius * 0.08);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#d6d3d1";
    ctx.strokeStyle = outline;
    ctx.beginPath();
    ctx.ellipse(radius * 0.48, 0, radius * 0.5, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#44403c";
    ctx.beginPath();
    ctx.roundRect?.(
      radius * 0.34,
      -radius * 0.38,
      radius * 0.36,
      radius * 0.76,
      radius * 0.08,
    );
    if (typeof ctx.roundRect === "function") {
      ctx.fill();
    } else {
      ctx.fillRect(radius * 0.34, -radius * 0.38, radius * 0.36, radius * 0.76);
    }

    ctx.strokeStyle = "#e7e5e4";
    ctx.lineWidth = Math.max(1.2, radius * 0.1);
    for (const offset of [-0.2, 0, 0.2]) {
      ctx.beginPath();
      ctx.moveTo(radius * 0.38, radius * offset);
      ctx.lineTo(radius * 0.67, radius * offset);
      ctx.stroke();
    }

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(radius * 0.98, 0);
    ctx.lineTo(radius * 0.72, -radius * 0.12);
    ctx.lineTo(radius * 0.72, radius * 0.12);
    ctx.closePath();
    ctx.fill();

    // Heraldic shield on the off hand.
    ctx.fillStyle = "#b91c1c";
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = Math.max(1.4, radius * 0.13);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.1, radius * 0.5);
    ctx.quadraticCurveTo(radius * 0.35, radius * 0.66, radius * 0.18, radius * 1.04);
    ctx.quadraticCurveTo(-radius * 0.18, radius * 0.9, -radius * 0.35, radius * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#fef3c7";
    ctx.lineWidth = Math.max(1, radius * 0.09);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.08, radius * 0.57);
    ctx.lineTo(-radius * 0.08, radius * 0.88);
    ctx.moveTo(-radius * 0.23, radius * 0.7);
    ctx.lineTo(radius * 0.08, radius * 0.7);
    ctx.stroke();
  }

  if (world.labyrinthMode) {
    ctx.restore();
    return;
  }

  const swing = player.meleeSwing;
  const swingElapsed = swing ? world.time - swing.startedAt : Infinity;
  const swingActive = Boolean(
    swing && swingElapsed >= 0 && swingElapsed < swing.duration,
  );
  const swingWeaponKey = swingActive ? swing.weaponKey : player.weapon;
  const swingWeapon = WEAPONS[swingWeaponKey];

  if (swingActive && swingWeapon?.type === "melee") {
    const progress = clamp(swingElapsed / swing.duration, 0, 1);
    const eased = 0.5 - Math.cos(progress * Math.PI) * 0.5;
    const directionOffset = angleDelta(swing.directionAngle, player.facing);

    if (swingWeaponKey === "fists") {
      const thrust = Math.sin(progress * Math.PI);
      ctx.save();
      ctx.rotate(directionOffset);
      ctx.globalAlpha = 0.5 * (1 - progress);
      ctx.strokeStyle = theme.playerGlow;
      ctx.lineWidth = Math.max(2, radius * 0.22);
      ctx.lineCap = "round";
      for (const streakY of [-radius * 0.2, radius * 0.2]) {
        ctx.beginPath();
        ctx.moveTo(radius * 0.32, streakY);
        ctx.lineTo(radius * (0.82 + thrust * 0.52), streakY);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.translate(radius * (0.42 + thrust * 0.72), 0);
      drawWeaponShape(ctx, world, swingWeaponKey, radius * 1.35);
      ctx.restore();
    } else {
      const startAngle = -1.12;
      const currentAngle = lerp(startAngle, 0.98, eased);

      // The bright curved trail makes the direction and reach of the swing visible.
      ctx.save();
      ctx.rotate(directionOffset);
      ctx.globalAlpha = 0.58 * (1 - progress * 0.45);
      ctx.strokeStyle = theme.playerGlow;
      ctx.lineWidth = Math.max(3, radius * 0.36);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.25, startAngle, currentAngle);
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, radius * 0.09);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.rotate(directionOffset + currentAngle);
      ctx.translate(radius * 0.42, 0);
      drawWeaponShape(ctx, world, swingWeaponKey, radius * 1.4);
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.translate(radius * 0.5, radius * 0.5);
    drawWeaponShape(ctx, world, player.weapon, radius * 1.2);
    ctx.restore();
  }

  ctx.restore();
}

export function drawVignette(ctx, world) {
  const labyrinth = Boolean(world?.labyrinthMode);
  const pulse = labyrinth
    ? 0.04 + 0.025 * Math.sin((world?.time ?? 0) * 2.15)
    : 0;
  const gradient = ctx.createRadialGradient(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT * (labyrinth ? 0.47 : 0.5),
    CANVAS_HEIGHT * (labyrinth ? 0.08 : 0.18),
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    CANVAS_HEIGHT * (labyrinth ? 0.66 : 0.72),
  );
  gradient.addColorStop(
    0,
    labyrinth ? `rgba(0, 0, 0, ${0.04 + pulse})` : "rgba(0,0,0,0)",
  );
  gradient.addColorStop(
    labyrinth ? 0.48 : 0.72,
    labyrinth ? "rgba(0, 0, 0, 0.2)" : "rgba(0,0,0,0.08)",
  );
  gradient.addColorStop(
    1,
    labyrinth ? `rgba(0, 0, 0, ${0.86 + pulse})` : "rgba(0,0,0,0.52)",
  );
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (labyrinth) {
    const flicker =
      0.018 +
      0.018 * Math.max(0, Math.sin(world.time * 7.1)) +
      0.012 * Math.max(0, Math.sin(world.time * 13.7));
    ctx.fillStyle = `rgba(99, 102, 241, ${flicker})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}

export function drawTile(ctx, x, y, size, fill, stroke = null) { ctx.fillStyle = fill; ctx.fillRect(x, y, size, size);

if (stroke) { ctx.strokeStyle = stroke; ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1); } }

export function drawWorldLabel( ctx, text, x, y, { textColor = WORLD_LABEL_TEXT, bgColor = WORLD_LABEL_BG, borderColor = WORLD_LABEL_BORDER, } = {}, ) { if (!text) { return; }

ctx.save(); ctx.font = WORLD_LABEL_FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";

const paddingX = 6; const height = 18; const width = Math.ceil(ctx.measureText(text).width) + paddingX * 2; const left = Math.round(x - width / 2); const top = Math.round(y - height / 2);

ctx.fillStyle = bgColor; ctx.fillRect(left, top, width, height);

ctx.strokeStyle = borderColor; ctx.lineWidth = 1; ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);

ctx.fillStyle = textColor; ctx.fillText(text, Math.round(x), Math.round(y) + 0.5); ctx.restore(); }

export function drawFog(ctx, world, camera, startX, endX, startY, endY) {
  const theme = getTheme(world);
  const [fogR, fogG, fogB] = theme.fog;
  const [mistR, mistG, mistB] = theme.mist;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const screenX = Math.floor((x - camera.x) * DRAW_TILE);
      const screenY = Math.floor((y - camera.y) * DRAW_TILE);
      const visible = visibleStrengthAt(world, x, y);
      const discovered = world.discovered[indexOfTile(world.width, x, y)] === 1;

      let alpha = world.labyrinthMode ? 0.985 : 0.92;
      if (world.labyrinthMode) {
        if (discovered) {
          alpha = lerp(0.72, 0.07, visible);
        } else if (visible > 0) {
          alpha = lerp(0.9, 0.12, visible);
        }
      } else if (discovered) {
        alpha = lerp(0.34, 0.02, visible);
      } else if (visible > 0) {
        alpha = lerp(0.72, 0.08, visible);
      }

      ctx.fillStyle = `rgba(${fogR}, ${fogG}, ${fogB}, ${alpha})`;
      ctx.fillRect(screenX, screenY, DRAW_TILE + 1, DRAW_TILE + 1);

      if (!discovered && alpha > 0.35) {
        const puff = hashNoise(x, y);
        const pulse =
          0.18 + 0.08 * Math.sin(world.fogPulse * 1.1 + puff * Math.PI * 2);
        const mistAlpha =
          pulse * alpha * (world.level.themeKey === "jungle" ? 0.28 : 0.2);

        ctx.fillStyle = `rgba(${mistR}, ${mistG}, ${mistB}, ${mistAlpha})`;
        ctx.beginPath();

        if (world.level.themeKey === "jungle") {
          ctx.ellipse(
            screenX + DRAW_TILE * (0.3 + puff * 0.4),
            screenY + DRAW_TILE * (0.45 + puff * 0.15),
            DRAW_TILE * 0.42,
            DRAW_TILE * 0.2,
            puff * 0.6,
            0,
            Math.PI * 2,
          );
        } else if (world.level.themeKey === "medieval") {
          ctx.arc(
            screenX + DRAW_TILE * (0.3 + puff * 0.4),
            screenY + DRAW_TILE * (0.35 + puff * 0.25),
            DRAW_TILE * (0.26 + puff * 0.12),
            0,
            Math.PI * 2,
          );
        } else {
          ctx.arc(
            screenX + DRAW_TILE * (0.3 + puff * 0.4),
            screenY + DRAW_TILE * (0.4 + puff * 0.2),
            DRAW_TILE * 0.34,
            0,
            Math.PI * 2,
          );
        }

        ctx.fill();
      }
    }
  }
}

export function getPickupLabel(pickup) { if (pickup.type === "weapon") { return pickup.label ?? WEAPONS[pickup.weapon]?.label ?? "Weapon"; }

if (pickup.type === "ammo") { return `${pickup.label ?? "Ammo"} +${pickup.amount}`; }

if (pickup.type === "medkit") { return `${pickup.label ?? "Medkit"} +${pickup.amount}`; }

if (pickup.type === "powerup") { return pickup.label ?? POWER_UPS[pickup.powerUp]?.label ?? "Power-up"; }

return pickup.label ?? "Pickup"; }

export function drawEntityLabels(ctx, world, camera) { if (!world.labelsOn) { return; }

const exitIndex = indexOfTile(world.width, world.exit.x, world.exit.y); const exitVisible = visibleStrengthAt(world, world.exit.x, world.exit.y); const exitDiscovered = world.discovered[exitIndex] === 1;

if (exitDiscovered || exitVisible > 0.12) { const exitCenter = tileCenter(world.exit); const exitX = (exitCenter.x - camera.x) * DRAW_TILE; const exitY = (exitCenter.y - camera.y) * DRAW_TILE;

drawWorldLabel(ctx, "EXIT", exitX, exitY - DRAW_TILE * 0.65, {
  textColor: "#bbf7d0",
  bgColor: "rgba(20, 83, 45, 0.88)",
  borderColor: "rgba(134, 239, 172, 0.45)",
});

}

for (const enemy of world.enemies) { if ( enemy.x < camera.x - 1 || enemy.x > camera.x + CANVAS_WIDTH / DRAW_TILE + 1 || enemy.y < camera.y - 1 || enemy.y > camera.y + CANVAS_HEIGHT / DRAW_TILE + 1 ) { continue; }

const visibility = visibleStrengthAt(
  world,
  Math.floor(enemy.x),
  Math.floor(enemy.y),
);

if (visibility <= 0.12) {
  continue;
}

const x = (enemy.x - camera.x) * DRAW_TILE;
const y = (enemy.y - camera.y) * DRAW_TILE;
const label = `${enemy.label ?? ENEMY_TYPES[enemy.kind].label} ${enemy.hp}/${enemy.maxHp}`;

drawWorldLabel(ctx, label, x, y - enemy.radius * DRAW_TILE - 22, {
  textColor: "#fee2e2",
  bgColor: "rgba(69, 10, 10, 0.84)",
  borderColor: "rgba(248, 113, 113, 0.35)",
});

}

const playerX = (world.player.x - camera.x) * DRAW_TILE; const playerY = (world.player.y - camera.y) * DRAW_TILE;

drawWorldLabel(
  ctx,
  world.labyrinthMode
    ? `${getPlayerDisplayName(world).toUpperCase()} • RUNNER`
    : `${getPlayerDisplayName(world).toUpperCase()} • ${getWeaponLabel(world, world.player.weapon)}`,
  playerX,
  playerY - world.player.radius * DRAW_TILE - 22,
  {
    textColor: "#e0f2fe",
    bgColor: "rgba(8, 47, 73, 0.88)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
); }

export function drawPickups(ctx, world, camera) {
  for (const pickup of world.pickups) {
    if (
      pickup.x < camera.x - 1 ||
      pickup.x > camera.x + CANVAS_WIDTH / DRAW_TILE + 1 ||
      pickup.y < camera.y - 1 ||
      pickup.y > camera.y + CANVAS_HEIGHT / DRAW_TILE + 1
    ) {
      continue;
    }

    const tileX = Math.floor(pickup.x);
    const tileY = Math.floor(pickup.y);
    const visibility = visibleStrengthAt(world, tileX, tileY);
    const discovered =
      world.discovered[indexOfTile(world.width, tileX, tileY)] === 1;

    if (!discovered && visibility <= 0.12) {
      continue;
    }

    const x = (pickup.x - camera.x) * DRAW_TILE;
    const baseY = (pickup.y - camera.y) * DRAW_TILE;
    const bob = Math.sin(world.time * 4 + pickup.x * 1.7 + pickup.y) * 2.2;
    const y = baseY + bob;
    const color =
      pickup.type === "weapon"
        ? "#fbbf24"
        : pickup.type === "ammo"
          ? "#60a5fa"
          : pickup.type === "medkit"
            ? "#f43f5e"
            : pickup.color ?? "#a78bfa";

    ctx.save();
    ctx.globalAlpha = visibility > 0.12 ? 1 : 0.62;
    ctx.shadowBlur = pickup.type === "powerup" || pickup.type === "labyrinthBreaker" || pickup.type === "labyrinthLight" ? 24 : 14;
    ctx.shadowColor = color;

    if (pickup.type === "powerup" || pickup.type === "labyrinthBreaker") {
      const radius = DRAW_TILE * 0.28;
      ctx.translate(x, y);
      ctx.rotate(world.time * 1.25 + pickup.x);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(radius, 0);
      ctx.lineTo(0, radius);
      ctx.lineTo(-radius, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (pickup.type === "labyrinthBreaker") {
        ctx.rotate(-(world.time * 1.25 + pickup.x));
        ctx.fillStyle = "#f3e8ff";
        ctx.font = `900 ${Math.max(10, DRAW_TILE * 0.27)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("10", 0, 0);
        ctx.rotate(world.time * 1.25 + pickup.x);
      }

      ctx.globalAlpha *= 0.58;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (1.45 + 0.14 * Math.sin(world.time * 5)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.translate(-x, -y);
      ctx.rotate(-(world.time * 1.25 + pickup.x));
    } else if (pickup.type === "labyrinthLight") {
      const size = DRAW_TILE * 0.58;
      ctx.translate(x, y);
      ctx.fillStyle = "#111827";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.globalAlpha *= 0.92;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha *= 0.62;
      ctx.beginPath();
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = (ray / 8) * Math.PI * 2;
        ctx.moveTo(Math.cos(angle) * size * 0.38, Math.sin(angle) * size * 0.38);
        ctx.lineTo(Math.cos(angle) * size * 0.56, Math.sin(angle) * size * 0.56);
      }
      ctx.stroke();
    } else if (pickup.type === "medkit") {
      const size = DRAW_TILE * 0.48;
      ctx.fillStyle = "#fff1f2";
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.fillStyle = color;
      ctx.fillRect(x - 2, y - size * 0.34, 4, size * 0.68);
      ctx.fillRect(x - size * 0.34, y - 2, size * 0.68, 4);
    } else if (pickup.type === "ammo") {
      if (isMedievalTheme(world)) {
        ctx.strokeStyle = "#d6a85f";
        ctx.fillStyle = "#d1d5db";
        ctx.lineWidth = 1.7;
        for (let offset = -1; offset <= 1; offset += 1) {
          const arrowX = x + offset * 4;
          ctx.beginPath();
          ctx.moveTo(arrowX, y + 7);
          ctx.lineTo(arrowX, y - 6);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(arrowX, y - 9);
          ctx.lineTo(arrowX - 2.5, y - 5);
          ctx.lineTo(arrowX + 2.5, y - 5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = "#92400e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 7, y + 1);
        ctx.lineTo(x + 7, y + 1);
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        for (let offset = -1; offset <= 1; offset += 1) {
          ctx.fillRect(x + offset * 4 - 1.5, y - 6, 3, 12);
          ctx.fillStyle = offset === 0 ? "#dbeafe" : color;
        }
      }
    } else {
      ctx.translate(x, y);
      ctx.rotate(-0.45);
      drawWeaponShape(ctx, world, pickup.weapon, DRAW_TILE * 0.62);
      ctx.rotate(0.45);
      ctx.translate(-x, -y);
    }

    ctx.restore();

    if (world.labelsOn) {
      drawWorldLabel(ctx, getPickupLabel(pickup), x, y - DRAW_TILE * 0.66, {
        textColor: "#f8fafc",
        bgColor:
          pickup.type === "powerup"
            ? "rgba(76, 29, 149, 0.88)"
            : "rgba(15, 23, 42, 0.88)",
        borderColor: `${color}88`,
      });
    }
  }
}

export function ensureMinimapCache(world) { const maxPanel = 170; const scale = Math.max( 1, Math.floor(maxPanel / Math.max(world.width, world.height)), ); const mapWidth = world.width * scale; const mapHeight = world.height * scale;

if (typeof document === "undefined") { return { canvas: null, scale, mapWidth, mapHeight }; }

if (!world.minimapCanvas) { world.minimapCanvas = document.createElement("canvas"); world.minimapDirty = true; }

const canvas = world.minimapCanvas; if (canvas.width !== mapWidth || canvas.height !== mapHeight) { canvas.width = mapWidth; canvas.height = mapHeight; world.minimapDirty = true; }

if (world.minimapDirty) { const mapCtx = canvas.getContext("2d"); mapCtx.clearRect(0, 0, mapWidth, mapHeight);

for (let y = 0; y < world.height; y += 1) {
  for (let x = 0; x < world.width; x += 1) {
    const discovered = world.discovered[indexOfTile(world.width, x, y)] === 1;

    const theme = getTheme(world);
    if (!discovered) {
      mapCtx.fillStyle = theme.backdrop;
    } else if (world.grid[y][x] === STEEL_WALL) {
      mapCtx.fillStyle = theme.steelA ?? "#7c8794";
    } else if (world.grid[y][x] === WALL) {
      mapCtx.fillStyle = theme.wallB;
    } else {
      mapCtx.fillStyle = theme.floorB;
    }

    mapCtx.fillRect(x * scale, y * scale, scale, scale);
  }
}

world.minimapDirty = false;

}

return { canvas, scale, mapWidth, mapHeight }; }

export function drawMinimap(ctx, world) { if (!world.minimapOn) { return; }

const { canvas, scale, mapWidth, mapHeight } = ensureMinimapCache(world); const panelX = CANVAS_WIDTH - mapWidth - 16; const panelY = 16;

ctx.fillStyle = "rgba(6, 10, 18, 0.78)"; ctx.fillRect(panelX - 10, panelY - 10, mapWidth + 20, mapHeight + 52);

if (canvas) { ctx.drawImage(canvas, panelX, panelY); }

const exitMapX = panelX + world.exit.x * scale; const exitMapY = panelY + world.exit.y * scale; const playerMapX = panelX + Math.floor(world.player.x) * scale; const playerMapY = panelY + Math.floor(world.player.y) * scale;

ctx.fillStyle = "#22c55e";
ctx.fillRect(exitMapX, exitMapY, scale, scale);

if (hasPowerUp(world, "sonar")) {
  const markerSize = Math.max(2, scale + 1);

  for (const enemy of world.enemies) {
    const enemyMapX = panelX + Math.floor(enemy.x) * scale;
    const enemyMapY = panelY + Math.floor(enemy.y) * scale;

    ctx.fillStyle =
      enemy.kind === "warden"
        ? "#f472b6"
        : enemy.kind === "turret"
          ? "#facc15"
          : "#ef4444";
    ctx.fillRect(enemyMapX, enemyMapY, markerSize, markerSize);
  }
}

ctx.fillStyle = "#38bdf8";
ctx.fillRect(playerMapX, playerMapY, scale + 1, scale + 1);

if (world.labelsOn) { ctx.font = "10px sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#bbf7d0"; ctx.fillText("EXIT", exitMapX + 4, exitMapY - 2);

ctx.fillStyle = "#bae6fd";
ctx.fillText(getPlayerDisplayName(world).toUpperCase(), playerMapX + 4, playerMapY + 10);

}

ctx.fillStyle = "#e5eefb";
ctx.font = "12px sans-serif";
const discoveredPercent = getDiscoveredPercent(world);
ctx.fillText(
  `Map ${world.width}×${world.height} ${discoveredPercent}%`,
  panelX - 1,
  panelY + mapHeight + 18,
);
ctx.fillText(
  hasPowerUp(world, "sonar")
    ? `Blue = ${getPlayerDisplayName(world)} Red = Enemies`
    : `Blue = ${getPlayerDisplayName(world)} Green = Exit`,
  panelX - 1,
  panelY + mapHeight + 36,
);
}

export function drawHud(ctx, world, hud) { ctx.fillStyle = "rgba(8, 12, 22, 0.8)"; ctx.fillRect(0, 0, CANVAS_WIDTH, 84); ctx.fillStyle = "rgba(8, 12, 22, 0.7)"; ctx.fillRect(0, CANVAS_HEIGHT - 74, CANVAS_WIDTH, 74);

ctx.fillStyle = "#f8fafc"; ctx.font = "16px sans-serif"; ctx.fillText(`Health ${Math.round(hud.hp)} / ${Math.round(hud.maxHp)}`, 18, 28); ctx.fillText(`${getAmmoLabel(world)} ${Math.floor(hud.ammo)} / ${MAX_AMMO}`, 18, 52); ctx.fillText(`Weapon ${hud.weapon}`, 220, 28); ctx.fillText(`Kills ${hud.kills}`, 220, 52); ctx.fillText(`Time ${formatTime(hud.time)}`, 350, 28); ctx.fillText(`Discovered ${hud.discovered}%`, 350, 52);

if (hud.powerUps.length > 0) { let x = 520; for (const powerUp of hud.powerUps) { ctx.fillStyle = powerUp.color; ctx.fillRect(x, 18, 120, 22); ctx.fillStyle = "#0f172a"; ctx.font = "12px sans-serif"; ctx.fillText(`${powerUp.short} ${powerUp.remaining.toFixed(1)}s`, x + 8, 33, ); x += 126; if (x > CANVAS_WIDTH - 120) { break; } } }

ctx.fillStyle = "#cbd5e1"; ctx.font = "13px sans-serif"; const controlsText = hud.controls.join(" • "); ctx.fillText(controlsText, 18, CANVAS_HEIGHT - 32);

if (hud.victory) { ctx.fillStyle = "#22c55e"; ctx.font = "bold 18px sans-serif"; ctx.fillText("Exit reached.", 18, CANVAS_HEIGHT - 52); } else if (hud.gameOver) { ctx.fillStyle = "#f87171"; ctx.font = "bold 18px sans-serif"; ctx.fillText(`${getPlayerDisplayName(world)} fell in the maze.`, 18, CANVAS_HEIGHT - 52); } }

export function drawLabyrinthShiftPulse(ctx, world) {
  if (!world.labyrinthMode) {
    return;
  }

  const age = world.time - world.labyrinth.lastShiftAt;
  if (age < 0 || age > 0.72) {
    return;
  }

  const progress = age / 0.72;
  const pulse = Math.sin(progress * Math.PI);
  ctx.save();
  ctx.fillStyle = `rgba(148, 163, 184, ${pulse * 0.2})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = `rgba(226, 232, 240, ${pulse * 0.34})`;
  ctx.lineWidth = 2;
  const offset = progress * 48;
  for (let x = -80; x < CANVAS_WIDTH + 80; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x + offset, 0);
    ctx.lineTo(x - 34 + offset, CANVAS_HEIGHT);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWorld2D(ctx, world) {
  const zoom = getWorldRenderZoom(world);
  const visibleWidth = CANVAS_WIDTH / (DRAW_TILE * zoom);
  const visibleHeight = CANVAS_HEIGHT / (DRAW_TILE * zoom);
  const camera = getCamera(world);
  const startX = Math.max(0, Math.floor(camera.x) - 1);
  const endX = Math.min(
    world.width - 1,
    Math.ceil(camera.x + visibleWidth) + 1,
  );
  const startY = Math.max(0, Math.floor(camera.y) - 1);
  const endY = Math.min(
    world.height - 1,
    Math.ceil(camera.y + visibleHeight) + 1,
  );

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = getTheme(world).backdrop;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();
  ctx.scale(zoom, zoom);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const screenX = Math.floor((x - camera.x) * DRAW_TILE);
      const screenY = Math.floor((y - camera.y) * DRAW_TILE);
      drawMazeTile(ctx, world, x, y, screenX, screenY);
    }
  }

  drawFog(ctx, world, camera, startX, endX, startY, endY);
  drawExitPortal(ctx, world, camera);
  drawPickups(ctx, world, camera);

  for (const enemy of world.enemies) {
    if (
      enemy.x < camera.x - 1 ||
      enemy.x > camera.x + visibleWidth + 1 ||
      enemy.y < camera.y - 1 ||
      enemy.y > camera.y + visibleHeight + 1
    ) {
      continue;
    }

    const visibility = visibleStrengthAt(
      world,
      Math.floor(enemy.x),
      Math.floor(enemy.y),
    );

    if (visibility <= 0.12) {
      continue;
    }

    const x = (enemy.x - camera.x) * DRAW_TILE;
    const y = (enemy.y - camera.y) * DRAW_TILE;
    drawEnemyBody(ctx, world, enemy, x, y);
    drawEnemyHealth(ctx, enemy, x, y);
  }

  for (const projectile of world.projectiles) {
    if (
      projectile.x < camera.x - 1 ||
      projectile.x > camera.x + visibleWidth + 1 ||
      projectile.y < camera.y - 1 ||
      projectile.y > camera.y + visibleHeight + 1
    ) {
      continue;
    }

    drawProjectile(ctx, projectile, camera);
  }

  drawEffects(ctx, world, camera);

  const playerX = (world.player.x - camera.x) * DRAW_TILE;
  const playerY = (world.player.y - camera.y) * DRAW_TILE;
  drawPlayerBody(ctx, world, playerX, playerY);
  drawEntityLabels(ctx, world, camera);
  ctx.restore();

  if (world.damageFlash > 0) {
    ctx.fillStyle = `rgba(239, 68, 68, ${world.damageFlash * 0.28})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  drawVignette(ctx, world);
  drawLabyrinthShiftPulse(ctx, world);

  if (world.messageTtl > 0 && world.message) {
    const width = Math.min(560, Math.max(200, world.message.length * 9.5));
    ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
    ctx.fillRect((CANVAS_WIDTH - width) / 2, CANVAS_HEIGHT - 60, width, 40);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.38)";
    ctx.strokeRect(
      (CANVAS_WIDTH - width) / 2 + 0.5,
      CANVAS_HEIGHT - 59.5,
      width - 1,
      39,
    );
    ctx.fillStyle = "#f8fafc";
    ctx.font = "600 17px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(world.message, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 34);
    ctx.textAlign = "left";
  }

  if (world.gameOver || world.victory) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.shadowBlur = 24;
    ctx.shadowColor = world.victory ? "#22c55e" : "#ef4444";
    ctx.fillStyle = world.victory ? "#4ade80" : "#fb7185";
    ctx.font = "800 46px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      world.victory
        ? world.labyrinthMode
          ? "LABYRINTH ESCAPED"
          : "MAZE ESCAPED"
        : world.labyrinthMode
          ? "TIME EXPIRED"
          : "GAME OVER",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 32,
    );
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText(
      world.victory
        ? world.labyrinthMode
          ? `Escaped with ${formatTime(getLabyrinthTimeRemaining(world))} remaining`
          : `Finished in ${formatTime(world.time)}`
        : world.labyrinthMode
          ? "The Labyrinth keeps you."
          : `${getPlayerDisplayName(world)} survived ${formatTime(world.time)}`,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 10,
    );
    ctx.textAlign = "left";
  }
}

export function cast3DRay(world, angle) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  let mapX = Math.floor(world.player.x);
  let mapY = Math.floor(world.player.y);

  const deltaDistX =
    Math.abs(dirX) < 0.000001 ? Infinity : Math.abs(1 / dirX);
  const deltaDistY =
    Math.abs(dirY) < 0.000001 ? Infinity : Math.abs(1 / dirY);
  const stepX = dirX < 0 ? -1 : 1;
  const stepY = dirY < 0 ? -1 : 1;
  let sideDistX =
    dirX < 0
      ? (world.player.x - mapX) * deltaDistX
      : (mapX + 1 - world.player.x) * deltaDistX;
  let sideDistY =
    dirY < 0
      ? (world.player.y - mapY) * deltaDistY
      : (mapY + 1 - world.player.y) * deltaDistY;
  let side = 0;
  let distance = 0;

  for (let step = 0; step < 96; step += 1) {
    if (sideDistX < sideDistY) {
      mapX += stepX;
      distance = sideDistX;
      sideDistX += deltaDistX;
      side = 0;
    } else {
      mapY += stepY;
      distance = sideDistY;
      sideDistY += deltaDistY;
      side = 1;
    }

    if (
      distance > VIEW_3D_MAX_DISTANCE ||
      mapX < 0 ||
      mapY < 0 ||
      mapX >= world.width ||
      mapY >= world.height
    ) {
      break;
    }

    const wallType = world.grid[mapY][mapX];
    if (wallType !== FLOOR) {
      const hitX = world.player.x + dirX * distance;
      const hitY = world.player.y + dirY * distance;
      const wallOffset =
        side === 0 ? hitY - Math.floor(hitY) : hitX - Math.floor(hitX);

      return {
        distance,
        mapX,
        mapY,
        side,
        wallOffset,
        wallType,
      };
    }
  }

  return {
    distance: VIEW_3D_MAX_DISTANCE,
    mapX,
    mapY,
    side,
    wallOffset: 0,
    wallType: null,
  };
}

export function draw3DEnvironment(ctx, world, zBuffer) {
  const theme = getTheme(world);
  const horizon = CANVAS_HEIGHT * 0.46;
  const ceiling = ctx.createLinearGradient(0, 0, 0, horizon);
  ceiling.addColorStop(0, theme.backdrop);
  ceiling.addColorStop(1, theme.wallC);
  ctx.fillStyle = ceiling;
  ctx.fillRect(0, 0, CANVAS_WIDTH, horizon);

  const floor = ctx.createLinearGradient(0, horizon, 0, CANVAS_HEIGHT);
  floor.addColorStop(0, theme.floorB);
  floor.addColorStop(1, theme.backdrop);
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizon, CANVAS_WIDTH, CANVAS_HEIGHT - horizon);

  ctx.strokeStyle = theme.floorLine;
  ctx.lineWidth = 1;

  for (let row = 0; row < 9; row += 1) {
    const t = row / 8;
    const y =
      horizon + 14 + t * t * (CANVAS_HEIGHT - horizon - 20);
    ctx.globalAlpha = 0.16 + t * 0.16;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.12;
  for (let x = -CANVAS_WIDTH; x <= CANVAS_WIDTH * 2; x += 96) {
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, horizon);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const projectionPlane =
    CANVAS_WIDTH / 2 / Math.tan(VIEW_3D_FOV / 2);
  const rayCount = Math.ceil(CANVAS_WIDTH / VIEW_3D_RAY_WIDTH);

  for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
    const screenX =
      rayIndex * VIEW_3D_RAY_WIDTH + VIEW_3D_RAY_WIDTH / 2;
    const cameraX =
      (screenX - CANVAS_WIDTH / 2) / projectionPlane;
    const angleOffset = Math.atan(cameraX);
    const rayAngle = world.player.facing + angleOffset;
    const hit = cast3DRay(world, rayAngle);
    const perpendicularDistance = Math.max(
      0.08,
      hit.distance * Math.cos(angleOffset),
    );
    zBuffer[rayIndex] = perpendicularDistance;

    const wallHeight = Math.min(
      CANVAS_HEIGHT * 2.4,
      projectionPlane / perpendicularDistance,
    );
    const wallTop = horizon - wallHeight / 2;
    const wallBottom = horizon + wallHeight / 2;
    const darknessDistance = world.labyrinthMode
      ? Math.max(6, world.labyrinth.sightRadius * 2.15)
      : VIEW_3D_MAX_DISTANCE;
    const baseDistanceFade = clamp(
      1 - perpendicularDistance / darknessDistance,
      world.labyrinthMode ? 0.025 : 0.12,
      1,
    );
    const equippedLightFade = world.labyrinthMode
      ? getLabyrinthEquippedLightStrength(
          world,
          hit.mapX + 0.5,
          hit.mapY + 0.5,
        )
      : 0;
    const distanceFade = Math.max(baseDistanceFade, equippedLightFade);
    const sideShade = hit.side === 1 ? 0.76 : 1;
    const cellNoise =
      0.82 + hashNoise(hit.mapX, hit.mapY) * 0.18;

    const steelWall = hit.wallType === STEEL_WALL;
    ctx.globalAlpha =
      distanceFade *
      sideShade *
      (steelWall ? 0.96 : cellNoise);
    ctx.fillStyle = steelWall
      ? hit.side === 1
        ? theme.steelB ?? "#46515d"
        : theme.steelA ?? "#7c8794"
      : hit.side === 1
        ? theme.wallB
        : theme.wallA;
    ctx.fillRect(
      rayIndex * VIEW_3D_RAY_WIDTH,
      wallTop,
      VIEW_3D_RAY_WIDTH + 1,
      wallBottom - wallTop,
    );

    if (steelWall) {
      const brace =
        hit.wallOffset < 0.055 ||
        hit.wallOffset > 0.945 ||
        (hit.wallOffset > 0.46 && hit.wallOffset < 0.54);
      if (brace) {
        ctx.globalAlpha = distanceFade * 0.72;
        ctx.fillStyle = theme.steelEdge ?? "#d5dde7";
        ctx.fillRect(
          rayIndex * VIEW_3D_RAY_WIDTH,
          wallTop,
          VIEW_3D_RAY_WIDTH + 1,
          wallBottom - wallTop,
        );
      }
    } else if (
      perpendicularDistance < 10 &&
      hit.wallOffset < 0.055
    ) {
      ctx.globalAlpha = distanceFade * 0.32;
      ctx.fillStyle = theme.wallEdge;
      ctx.fillRect(
        rayIndex * VIEW_3D_RAY_WIDTH,
        wallTop,
        1,
        wallBottom - wallTop,
      );
    }

    if (
      world.level.themeKey === "jungle" &&
      hashNoise(hit.mapX * 5 + rayIndex, hit.mapY * 7) > 0.92
    ) {
      ctx.globalAlpha = distanceFade * 0.18;
      ctx.fillStyle = "#84cc16";
      ctx.fillRect(
        rayIndex * VIEW_3D_RAY_WIDTH,
        wallTop,
        1,
        Math.min(70, wallBottom - wallTop),
      );
    } else if (
      world.level.themeKey === "space" &&
      hit.wallOffset > 0.46 &&
      hit.wallOffset < 0.52
    ) {
      ctx.globalAlpha = distanceFade * 0.28;
      ctx.fillStyle = "#67e8f9";
      ctx.fillRect(
        rayIndex * VIEW_3D_RAY_WIDTH,
        wallTop,
        1,
        wallBottom - wallTop,
      );
    } else if (
      world.level.themeKey === "medieval" &&
      hit.wallOffset > 0.47 &&
      hit.wallOffset < 0.53
    ) {
      ctx.globalAlpha = distanceFade * 0.15;
      ctx.fillStyle = "#d6d3d1";
      ctx.fillRect(
        rayIndex * VIEW_3D_RAY_WIDTH,
        wallTop,
        1,
        wallBottom - wallTop,
      );
    }
  }

  ctx.globalAlpha = 1;
  return projectionPlane;
}

export function project3DSprite(world, x, y, projectionPlane) {
  const dx = x - world.player.x;
  const dy = y - world.player.y;
  const distance = Math.hypot(dx, dy);
  const angleToSprite = Math.atan2(dy, dx);
  const relativeAngle = angleDelta(
    angleToSprite,
    world.player.facing,
  );
  const depth = distance * Math.cos(relativeAngle);

  if (
    distance < 0.08 ||
    distance > VIEW_3D_MAX_DISTANCE + 1 ||
    depth <= 0.05 ||
    Math.abs(relativeAngle) > VIEW_3D_FOV * 0.62
  ) {
    return null;
  }

  return {
    distance,
    depth,
    relativeAngle,
    screenX:
      CANVAS_WIDTH / 2 +
      Math.tan(relativeAngle) * projectionPlane,
    scale: projectionPlane / depth,
  };
}

export function is3DSpriteVisible(projection, zBuffer) {
  const centerRay = clamp(
    Math.floor(projection.screenX / VIEW_3D_RAY_WIDTH),
    0,
    zBuffer.length - 1,
  );
  const sampleRadius = 2;
  let farthestVisibleDepth = 0;

  for (
    let rayIndex = Math.max(0, centerRay - sampleRadius);
    rayIndex <= Math.min(zBuffer.length - 1, centerRay + sampleRadius);
    rayIndex += 1
  ) {
    farthestVisibleDepth = Math.max(
      farthestVisibleDepth,
      zBuffer[rayIndex] ?? VIEW_3D_MAX_DISTANCE,
    );
  }

  return projection.depth < farthestVisibleDepth + 0.28;
}

export function draw3DExit(ctx, projection) {
  const height = clamp(
    projection.scale * 0.9,
    28,
    CANVAS_HEIGHT * 1.25,
  );
  const width = height * 0.48;
  const baseY =
    CANVAS_HEIGHT * 0.46 + height * 0.5;

  ctx.save();
  ctx.translate(
    projection.screenX,
    baseY - height * 0.5,
  );
  ctx.shadowBlur = clamp(
    34 - projection.distance,
    8,
    34,
  );
  ctx.shadowColor = "#22c55e";
  ctx.globalAlpha = clamp(
    1 - projection.distance / VIEW_3D_MAX_DISTANCE,
    0.35,
    1,
  );
  ctx.strokeStyle = "#86efac";
  ctx.lineWidth = clamp(height * 0.045, 2, 8);
  ctx.beginPath();
  ctx.ellipse(
    0,
    0,
    width * 0.46,
    height * 0.45,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.fillStyle = "rgba(34, 197, 94, 0.22)";
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#dcfce7";
  ctx.font = `800 ${clamp(
    height * 0.1,
    11,
    20,
  )}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("EXIT", 0, -height * 0.57);
  ctx.restore();
}

export function get3DEnemyAttackState(world, enemy) {
  const elapsed = world.time - (enemy.lastAttackAt ?? -Infinity);
  const duration = enemy.attackStyle === "contact" ? 0.46 : 0.34;

  if (elapsed < 0 || elapsed > duration) {
    return { active: false, pulse: 0, style: enemy.attackStyle };
  }

  const progress = clamp(elapsed / duration, 0, 1);
  return {
    active: true,
    pulse: Math.sin(progress * Math.PI),
    style: enemy.attackStyle,
  };
}

export function draw3DEnemyAttackEffect(ctx, world, enemy, width, height, attack) {
  if (!attack.active) {
    return;
  }

  const themeKey = world.level.themeKey;
  const effectColor =
    themeKey === "space"
      ? "#67e8f9"
      : themeKey === "jungle"
        ? "#bef264"
        : "#fbbf24";

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.45 + attack.pulse * 0.5;
  ctx.shadowBlur = 20;
  ctx.shadowColor = effectColor;

  if (attack.style === "contact") {
    ctx.strokeStyle = effectColor;
    ctx.lineWidth = clamp(width * 0.055, 2, 8);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(
        side * width * 0.06,
        0,
        width * (0.5 + attack.pulse * 0.15),
        -1.05 + side * 0.18,
        0.72 + side * 0.18,
      );
      ctx.stroke();
    }
  } else {
    const muzzleX = enemy.kind === "turret" ? 0 : width * 0.3;
    const muzzleY = -height * 0.25;
    ctx.translate(muzzleX, muzzleY);
    ctx.fillStyle = "#fff7ed";

    for (let spike = 0; spike < 8; spike += 1) {
      const angle = (Math.PI * 2 * spike) / 8;
      const inner = width * 0.045;
      const outer = width * (0.14 + attack.pulse * 0.08);
      ctx.beginPath();
      ctx.moveTo(
        Math.cos(angle - 0.18) * inner,
        Math.sin(angle - 0.18) * inner,
      );
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.lineTo(
        Math.cos(angle + 0.18) * inner,
        Math.sin(angle + 0.18) * inner,
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = effectColor;
    ctx.beginPath();
    ctx.arc(0, 0, width * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function draw3DThemedEnemy(ctx, world, enemy, width, height, attack) {
  const theme = getTheme(world);
  const radius = Math.min(width * 0.43, height * 0.3);

  ctx.save();
  ctx.save();
  ctx.translate(0, -height * 0.1);
  ctx.scale(1.08, 1.08);

  const facingTowardCamera = -Math.PI / 2;
  if (world.level.themeKey === "space") {
    drawSpaceEnemy(ctx, enemy, radius, facingTowardCamera);
  } else if (world.level.themeKey === "jungle") {
    drawJungleEnemy(ctx, enemy, radius, facingTowardCamera);
  } else {
    drawMedievalEnemy(ctx, enemy, radius, facingTowardCamera);
  }

  ctx.restore();

  if (enemy.kind === "warden") {
    ctx.strokeStyle = theme.playerAccent;
    ctx.lineWidth = clamp(width * 0.025, 1, 4);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(0, -height * 0.1, radius * 1.18, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function draw3DEnemy(ctx, world, enemy, projection) {
  const enemyType = ENEMY_TYPES[enemy.kind];
  const bodyHeight = clamp(
    projection.scale * (enemy.radius * 2.35 + 0.42),
    26,
    CANVAS_HEIGHT * 0.95,
  );
  const bodyWidth =
    bodyHeight *
    (enemy.kind === "warden"
      ? 0.72
      : enemy.kind === "brute"
        ? 0.66
        : 0.56);
  const baseY = CANVAS_HEIGHT * 0.46 + bodyHeight * 0.43;
  const bobPhase = enemy.x * 1.7 + enemy.y * 2.3;
  const bob =
    Math.sin(world.time * 4 + bobPhase) *
    Math.min(4, bodyHeight * 0.025);
  const attack = get3DEnemyAttackState(world, enemy);
  const hitAge = world.time - (enemy.lastHitAt ?? -Infinity);
  const hitPulse =
    hitAge >= 0 && hitAge < 0.18
      ? 1 - hitAge / 0.18
      : 0;
  const color =
    enemy.color ?? enemyType.color ?? "#ef4444";

  ctx.save();
  ctx.translate(
    projection.screenX,
    baseY - bodyHeight * 0.48 + bob,
  );

  const attackScale =
    attack.style === "contact"
      ? 1 + attack.pulse * 0.14
      : 1 + attack.pulse * 0.045;
  ctx.translate(
    0,
    attack.style === "ranged"
      ? attack.pulse * bodyHeight * 0.025
      : 0,
  );
  ctx.scale(attackScale, attackScale);

  ctx.globalAlpha = clamp(
    1 - projection.distance / VIEW_3D_MAX_DISTANCE,
    0.38,
    1,
  );

  ctx.fillStyle = "rgba(2, 6, 23, 0.55)";
  ctx.beginPath();
  ctx.ellipse(
    0,
    bodyHeight * 0.45,
    bodyWidth * 0.5,
    bodyHeight * 0.075,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.shadowBlur = clamp(24 - projection.distance, 4, 24);
  ctx.shadowColor = hitPulse > 0 ? "#ffffff" : color;

  draw3DThemedEnemy(
    ctx,
    world,
    enemy,
    bodyWidth,
    bodyHeight,
    attack,
  );

  if (hitPulse > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = hitPulse * 0.38;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(
      0,
      -bodyHeight * 0.08,
      bodyWidth * 0.5,
      bodyHeight * 0.34,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  draw3DEnemyAttackEffect(
    ctx,
    world,
    enemy,
    bodyWidth,
    bodyHeight,
    attack,
  );

  ctx.shadowBlur = 0;
  ctx.globalAlpha = clamp(
    1 - projection.distance / VIEW_3D_MAX_DISTANCE,
    0.48,
    1,
  );

  const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
  const barWidth = bodyWidth * 0.96;
  const barY = -bodyHeight * 0.61;
  ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
  ctx.fillRect(-barWidth / 2, barY, barWidth, 6);
  ctx.fillStyle =
    hpRatio > 0.45
      ? "#4ade80"
      : hpRatio > 0.2
        ? "#facc15"
        : "#fb7185";
  ctx.fillRect(-barWidth / 2, barY, barWidth * hpRatio, 6);

  if (world.labelsOn && bodyHeight > 34) {
    ctx.fillStyle = "#f8fafc";
    ctx.font = `800 ${clamp(
      bodyHeight * 0.075,
      10,
      15,
    )}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.shadowBlur = 4;
    ctx.shadowColor = "#020617";
    ctx.fillText(
      enemy.label ?? enemyType.label,
      0,
      -bodyHeight * 0.69,
    );
  }

  ctx.restore();
}

export function get3DPickupColor(pickup) {
  if (pickup.type === "weapon") return "#fbbf24";
  if (pickup.type === "ammo") return "#60a5fa";
  if (pickup.type === "medkit") return "#f43f5e";
  return pickup.color ?? "#a78bfa";
}

export function draw3DPickup(ctx, world, pickup, projection) {
  const size = clamp(
    projection.scale * 0.24,
    8,
    92,
  );
  const y =
    CANVAS_HEIGHT * 0.46 +
    size * 1.2 +
    Math.sin(world.time * 4 + pickup.x) * 4;
  const color = get3DPickupColor(pickup);

  ctx.save();
  ctx.translate(projection.screenX, y);
  ctx.globalAlpha = clamp(
    1 - projection.distance / VIEW_3D_MAX_DISTANCE,
    0.38,
    1,
  );
  ctx.shadowBlur = clamp(size * 0.5, 6, 24);
  ctx.shadowColor = color;
  ctx.fillStyle = color;

  if (pickup.type === "labyrinthLight") {
    ctx.fillStyle = "#111827";
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, size * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha *= 0.58;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  } else if (pickup.type === "medkit") {
    ctx.fillStyle = "#fff1f2";
    ctx.fillRect(
      -size * 0.42,
      -size * 0.42,
      size * 0.84,
      size * 0.84,
    );
    ctx.fillStyle = color;
    ctx.fillRect(
      -size * 0.08,
      -size * 0.31,
      size * 0.16,
      size * 0.62,
    );
    ctx.fillRect(
      -size * 0.31,
      -size * 0.08,
      size * 0.62,
      size * 0.16,
    );
  } else if (pickup.type === "ammo") {
    if (isMedievalTheme(world)) {
      ctx.strokeStyle = "#d6a85f";
      ctx.fillStyle = "#d1d5db";
      ctx.lineWidth = Math.max(1.5, size * 0.06);

      for (let offset = -1; offset <= 1; offset += 1) {
        const arrowX = offset * size * 0.18;
        ctx.beginPath();
        ctx.moveTo(arrowX, size * 0.42);
        ctx.lineTo(arrowX, -size * 0.32);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(arrowX, -size * 0.48);
        ctx.lineTo(arrowX - size * 0.08, -size * 0.3);
        ctx.lineTo(arrowX + size * 0.08, -size * 0.3);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = "#92400e";
      ctx.lineWidth = Math.max(2, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(-size * 0.34, size * 0.08);
      ctx.lineTo(size * 0.34, size * 0.08);
      ctx.stroke();
    } else {
      for (let offset = -1; offset <= 1; offset += 1) {
        ctx.fillRect(
          offset * size * 0.19 - size * 0.06,
          -size * 0.42,
          size * 0.12,
          size * 0.84,
        );
      }
    }
  } else {
    ctx.rotate(world.time * 0.7);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.5);
    ctx.lineTo(size * 0.42, 0);
    ctx.lineTo(0, size * 0.5);
    ctx.lineTo(-size * 0.42, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.shadowBlur = 0;

  if (world.labelsOn && size > 13) {
    if (
      pickup.type !== "medkit" &&
      pickup.type !== "ammo" &&
      pickup.type !== "labyrinthLight"
    ) {
      ctx.rotate(-world.time * 0.7);
    }
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 ${clamp(
      size * 0.28,
      9,
      13,
    )}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(
      getPickupLabel(pickup),
      0,
      -size * 0.72,
    );
  }

  ctx.restore();
}

export function draw3DProjectile(ctx, projectile, projection) {
  const size = clamp(
    projection.scale * 0.055,
    3,
    20,
  );

  ctx.save();
  ctx.globalAlpha = clamp(
    1 - projection.distance / VIEW_3D_MAX_DISTANCE,
    0.35,
    1,
  );

  if (projectile.isArrow) {
    const centerY = CANVAS_HEIGHT * 0.46;
    const arrowLength = clamp(size * 3.8, 12, 54);

    ctx.shadowBlur = size * 0.8;
    ctx.shadowColor = projectile.color ?? "#d6a85f";
    ctx.strokeStyle = projectile.color ?? "#d6a85f";
    ctx.lineWidth = Math.max(1.5, size * 0.35);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(projection.screenX - arrowLength * 0.45, centerY);
    ctx.lineTo(projection.screenX + arrowLength * 0.4, centerY);
    ctx.stroke();

    ctx.fillStyle = "#d1d5db";
    ctx.beginPath();
    ctx.moveTo(projection.screenX + arrowLength * 0.58, centerY);
    ctx.lineTo(projection.screenX + arrowLength * 0.34, centerY - size * 0.6);
    ctx.lineTo(projection.screenX + arrowLength * 0.34, centerY + size * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    return;
  }

  ctx.shadowBlur = size * 1.8;
  ctx.shadowColor =
    projectile.color ?? "#fde047";
  ctx.fillStyle =
    projectile.color ?? "#fde047";
  ctx.beginPath();
  ctx.arc(
    projection.screenX,
    CANVAS_HEIGHT * 0.46,
    size,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

export function draw3DEffect(ctx, effect, projection) {
  const initialTtl =
    effect.kind === "ring"
      ? 0.22
      : effect.kind === "explosion"
        ? 0.38
        : effect.kind === "spark"
          ? 0.34
          : effect.kind === "shipDebris"
            ? 0.82
            : 0.55;
  const progress = clamp(
    effect.age / Math.max(0.001, effect.age + effect.ttl),
    0,
    1,
  );
  const alpha =
    clamp(effect.ttl / initialTtl, 0, 1) *
    (effect.alpha ?? 1) *
    clamp(1 - projection.distance / VIEW_3D_MAX_DISTANCE, 0.35, 1);
  const baseY =
    CANVAS_HEIGHT * 0.46 +
    clamp(projection.scale * 0.18, 2, CANVAS_HEIGHT * 0.28);
  const size = clamp(
    projection.scale * Math.max(0.035, effect.size ?? 0.1),
    2,
    72,
  );

  ctx.save();
  ctx.translate(projection.screenX, baseY);
  ctx.globalAlpha = alpha;

  if (effect.kind === "shipDebris") {
    const travelAngle = Math.atan2(effect.vy ?? 0, effect.vx ?? 0);
    const spin = (effect.age ?? 0) * 8.5;
    const width = Math.max(5, size * 2.4);
    const height = Math.max(2.5, size * 0.72);

    ctx.rotate(travelAngle + spin);
    ctx.fillStyle = effect.color;
    ctx.fillRect(-width / 2, -height / 2, width, height);

    ctx.strokeStyle = "rgba(226, 232, 240, 0.8)";
    ctx.lineWidth = Math.max(1, size * 0.12);
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    ctx.fillStyle = "rgba(56, 189, 248, 0.55)";
    ctx.fillRect(-width * 0.18, -height * 0.38, width * 0.36, height * 0.76);
  } else if (effect.kind === "spark") {
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = effect.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = effect.color;
    ctx.lineWidth = Math.max(1.5, size * 0.3);
    ctx.beginPath();
    ctx.moveTo(-size * 1.2, size * 0.35);
    ctx.lineTo(size * 1.2, -size * 0.35);
    ctx.stroke();
  } else if (effect.kind === "ring") {
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = Math.max(1.5, 4 * (1 - progress));
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      clamp(
        projection.scale *
          lerp(effect.size, effect.endSize ?? effect.size * 3, progress),
        3,
        90,
      ),
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  } else if (effect.kind === "explosion") {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = effect.color;
    ctx.shadowBlur = 18;
    ctx.shadowColor = effect.color;
    ctx.beginPath();
    ctx.arc(0, 0, size * (1.5 + progress * 2.4), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function draw3DSprites(
  ctx,
  world,
  zBuffer,
  projectionPlane,
) {
  const sprites = [];
  const exitProjection = project3DSprite(
    world,
    world.exit.x + 0.5,
    world.exit.y + 0.5,
    projectionPlane,
  );

  if (
    exitProjection &&
    (
      !world.labyrinthMode ||
      exitProjection.distance <= world.labyrinth.sightRadius + 3.2 ||
      getLabyrinthEquippedLightStrength(
        world,
        world.exit.x + 0.5,
        world.exit.y + 0.5,
      ) > 0.08
    )
  ) {
    sprites.push({
      type: "exit",
      projection: exitProjection,
    });
  }

  for (const enemy of world.enemies) {
    const projection = project3DSprite(
      world,
      enemy.x,
      enemy.y,
      projectionPlane,
    );

    if (projection) {
      sprites.push({
        type: "enemy",
        entity: enemy,
        projection,
      });
    }
  }

  for (const pickup of world.pickups) {
    const projection = project3DSprite(
      world,
      pickup.x,
      pickup.y,
      projectionPlane,
    );

    if (
      projection &&
      (
        !world.labyrinthMode ||
        projection.distance <= world.labyrinth.sightRadius + 2.4 ||
        getLabyrinthEquippedLightStrength(
          world,
          pickup.x,
          pickup.y,
        ) > 0.08
      )
    ) {
      sprites.push({
        type: "pickup",
        entity: pickup,
        projection,
      });
    }
  }

  for (const projectile of world.projectiles) {
    const projection = project3DSprite(
      world,
      projectile.x,
      projectile.y,
      projectionPlane,
    );

    if (projection) {
      sprites.push({
        type: "projectile",
        entity: projectile,
        projection,
      });
    }
  }

  for (const effect of world.effects ?? []) {
    if (
      !["shipDebris", "spark", "ring", "explosion"].includes(effect.kind)
    ) {
      continue;
    }

    const projection = project3DSprite(
      world,
      effect.x,
      effect.y,
      projectionPlane,
    );

    if (projection) {
      sprites.push({
        type: "effect",
        entity: effect,
        projection,
      });
    }
  }

  sprites.sort(
    (a, b) =>
      b.projection.distance -
      a.projection.distance,
  );

  for (const sprite of sprites) {
    if (
      !is3DSpriteVisible(
        sprite.projection,
        zBuffer,
      )
    ) {
      continue;
    }

    if (sprite.type === "exit") {
      draw3DExit(ctx, sprite.projection);
    } else if (sprite.type === "enemy") {
      draw3DEnemy(
        ctx,
        world,
        sprite.entity,
        sprite.projection,
      );
    } else if (sprite.type === "pickup") {
      draw3DPickup(
        ctx,
        world,
        sprite.entity,
        sprite.projection,
      );
    } else if (sprite.type === "effect") {
      draw3DEffect(
        ctx,
        sprite.entity,
        sprite.projection,
      );
    } else {
      draw3DProjectile(
        ctx,
        sprite.entity,
        sprite.projection,
      );
    }
  }
}

export function draw3DMedievalBow(ctx, world, recoil, theme) {
  const profiles = {
    pistol: { width: 190, height: 150, thickness: 10 },
    revolver: { width: 218, height: 170, thickness: 12 },
    smg: { width: 176, height: 138, thickness: 9 },
    shotgun: { width: 236, height: 162, thickness: 13 },
    rifle: { width: 250, height: 188, thickness: 12 },
    dmr: { width: 272, height: 202, thickness: 13 },
  };
  const profile = profiles[world.player.weapon] ?? profiles.rifle;
  const stringPull = 22 + recoil * 26;
  const centerY = -96;

  ctx.save();
  ctx.translate(0, centerY);

  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = profile.thickness;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-profile.width / 2, 20);
  ctx.quadraticCurveTo(
    -profile.width * 0.28,
    -profile.height,
    0,
    -profile.height * 0.72,
  );
  ctx.quadraticCurveTo(
    profile.width * 0.28,
    -profile.height,
    profile.width / 2,
    20,
  );
  ctx.stroke();

  ctx.strokeStyle = theme.playerAccent;
  ctx.lineWidth = 2.4;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(-profile.width / 2, 20);
  ctx.lineTo(0, -stringPull);
  ctx.lineTo(profile.width / 2, 20);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#d6a85f";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -stringPull + 12);
  ctx.lineTo(0, -profile.height - 62);
  ctx.stroke();

  ctx.fillStyle = "#d1d5db";
  ctx.beginPath();
  ctx.moveTo(0, -profile.height - 82);
  ctx.lineTo(-9, -profile.height - 58);
  ctx.lineTo(9, -profile.height - 58);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#fef3c7";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -stringPull + 8);
  ctx.lineTo(-11, -stringPull + 22);
  ctx.moveTo(0, -stringPull + 8);
  ctx.lineTo(11, -stringPull + 22);
  ctx.stroke();

  if (world.player.weapon === "shotgun") {
    ctx.strokeStyle = theme.playerGlow;
    ctx.globalAlpha = 0.58;
    ctx.lineWidth = 2;
    for (const offset of [-8, 8]) {
      ctx.beginPath();
      ctx.moveTo(offset, -stringPull + 8);
      ctx.lineTo(offset, -profile.height - 48);
      ctx.stroke();
    }
  }

  if (world.player.weapon === "dmr") {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = theme.playerGlow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(30, -profile.height * 0.72, 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function draw3DLabyrinthLight(ctx, world) {
  const light = getLabyrinthLight(world);
  if (!light) {
    return;
  }

  const pulse = 0.88 + Math.sin(world.time * 3.2) * 0.04;
  const x = CANVAS_WIDTH * 0.77;
  const y = CANVAS_HEIGHT + 18;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18);
  ctx.shadowBlur = 22;
  ctx.shadowColor = light.color;

  if (
    ["flashlight", "headlamp", "floodlight", "searchlight", "twinBeam", "prismLamp"].includes(
      light.key,
    )
  ) {
    ctx.fillStyle = "#111827";
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-36, -112, 72, 104, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.ellipse(0, -112, 42, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = light.color;
    ctx.globalAlpha = 0.88 * pulse;
    ctx.beginPath();
    ctx.ellipse(0, -114, 27, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (light.key === "glowstick") {
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -112);
    ctx.lineTo(0, -24);
    ctx.stroke();

    ctx.strokeStyle = light.color;
    ctx.globalAlpha = 0.9 * pulse;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, -106);
    ctx.lineTo(0, -30);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#111827";
    ctx.strokeStyle = "#78716c";
    ctx.lineWidth = 4;
    ctx.fillRect(-40, -104, 80, 88);
    ctx.strokeRect(-40, -104, 80, 88);

    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(0, -104, 30, Math.PI, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = light.color;
    ctx.globalAlpha = 0.82 * pulse;
    ctx.beginPath();
    ctx.arc(0, -60, light.key === "candle" ? 14 : 24, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function draw3DWeapon(ctx, world) {
  if (world.labyrinthMode) {
    draw3DLabyrinthLight(ctx, world);
    return;
  }

  const theme = getTheme(world);
  const weapon = WEAPONS[world.player.weapon];
  const recoil = clamp(
    (world.player.nextAttackAt - world.time) /
      Math.max(
        0.08,
        getWeaponCooldown(world, weapon),
      ),
    0,
    1,
  );
  const bob =
    Math.sin(world.time * 7) *
    (world.gameOver || world.victory ? 0 : 3);
  const centerX = CANVAS_WIDTH / 2;
  const baseY =
    CANVAS_HEIGHT + recoil * 24 + bob;

  ctx.save();
  ctx.translate(centerX, baseY);

  if (weapon.type === "melee") {
    const isFists =
      world.player.weapon === "fists";

    if (isFists) {
      ctx.fillStyle = theme.playerGlow;
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.ellipse(
        -92,
        -46,
        52,
        72,
        -0.28,
        0,
        Math.PI * 2,
      );
      ctx.ellipse(
        92,
        -46,
        52,
        72,
        0.28,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      ctx.fillStyle = theme.playerAccent;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(
        -86,
        -58,
        26,
        34,
        -0.28,
        0,
        Math.PI * 2,
      );
      ctx.ellipse(
        86,
        -58,
        26,
        34,
        0.28,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else {
      ctx.rotate(-0.18 - recoil * 0.22);
      ctx.fillStyle = theme.wallA;
      ctx.fillRect(-20, -230, 40, 210);
      ctx.fillStyle = theme.playerGlow;
      ctx.fillRect(-10, -245, 20, 180);
      ctx.fillStyle = theme.playerAccent;
      ctx.fillRect(-52, -78, 104, 18);
    }
  } else if (isMedievalTheme(world)) {
    draw3DMedievalBow(ctx, world, recoil, theme);
  } else {
    const gunWidth =
      world.player.weapon === "shotgun" ||
      world.player.weapon === "rifle" ||
      world.player.weapon === "dmr"
        ? 190
        : world.player.weapon === "smg"
          ? 150
          : 118;
    const gunHeight = gunWidth * 0.36;

    ctx.fillStyle = theme.wallB;
    ctx.beginPath();
    ctx.roundRect(
      -gunWidth / 2,
      -gunHeight - 50,
      gunWidth,
      gunHeight,
      16,
    );
    ctx.fill();

    ctx.fillStyle = theme.wallA;
    ctx.fillRect(
      -gunWidth * 0.34,
      -gunHeight - 36,
      gunWidth * 0.68,
      gunHeight * 0.42,
    );
    ctx.fillStyle = theme.playerGlow;
    ctx.fillRect(
      -gunWidth * 0.08,
      -gunHeight - 58,
      gunWidth * 0.16,
      14,
    );
    ctx.fillStyle = theme.playerAccent;
    ctx.globalAlpha = 0.82;
    ctx.fillRect(
      -gunWidth * 0.28,
      -gunHeight - 29,
      gunWidth * 0.56,
      5,
    );

    if (world.player.weapon === "dmr") {
      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.arc(
        0,
        -gunHeight - 62,
        24,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.strokeStyle = theme.playerGlow;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function draw3DOverlay(ctx, world) {
  const theme = getTheme(world);

  if (world.labyrinthMode) {
    const remaining = getLabyrinthTimeRemaining(world);
    const breakerActive = labyrinthBreakerActive(world);
    const breakerRemaining = breakerActive
      ? Math.max(0, world.labyrinth.breakerEndsAt - world.time)
      : 0;

    const light = getLabyrinthLight(world);

    ctx.fillStyle = "rgba(1, 3, 7, 0.78)";
    ctx.fillRect(14, 14, 330, 104);
    ctx.strokeStyle = "rgba(192, 132, 252, 0.3)";
    ctx.strokeRect(14.5, 14.5, 329, 103);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "900 18px system-ui, sans-serif";
    ctx.fillText(`TIME ${formatTime(remaining)}`, 28, 42);

    ctx.fillStyle = "#d8b4fe";
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.fillText(
      `BREAKERS ${world.labyrinth.breakerCharges}/10`,
      190,
      42,
    );

    ctx.fillStyle = "#94a3b8";
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.fillText(
      `${world.labyrinth.difficultyLabel.toUpperCase()} · ${world.logicalCols}×${world.logicalRows}`,
      28,
      68,
    );

    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(
      `LIGHT ${(light?.label ?? "Base Light").toUpperCase()}`,
      190,
      68,
    );

    if (breakerActive) {
      ctx.fillStyle = "#e9d5ff";
      ctx.fillText(
        `WALL BREAKER ${breakerRemaining.toFixed(1)}s`,
        28,
        94,
      );
    }
  } else {
    const weaponLabel = getWeaponLabel(
      world,
      world.player.weapon,
    );

    ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
    ctx.fillRect(14, 14, 286, 78);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.24)";
    ctx.strokeRect(14.5, 14.5, 285, 77);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "800 17px system-ui, sans-serif";
    ctx.fillText(
      `${Math.round(world.player.hp)} HP`,
      28,
      39,
    );
    ctx.fillText(
      `${Math.floor(world.player.ammo)} ${getAmmoLabel(world).toUpperCase()}`,
      126,
      39,
    );
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.fillText(weaponLabel, 28, 64);
    ctx.fillText(formatTime(world.time), 216, 64);

    const crosshairSize = 8;
    const crosshairGap = 5;
    const crosshairY = CANVAS_HEIGHT * 0.46;

    ctx.strokeStyle = theme.playerAccent;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(
      CANVAS_WIDTH / 2 - crosshairGap - crosshairSize,
      crosshairY,
    );
    ctx.lineTo(CANVAS_WIDTH / 2 - crosshairGap, crosshairY);
    ctx.moveTo(CANVAS_WIDTH / 2 + crosshairGap, crosshairY);
    ctx.lineTo(
      CANVAS_WIDTH / 2 + crosshairGap + crosshairSize,
      crosshairY,
    );
    ctx.moveTo(
      CANVAS_WIDTH / 2,
      crosshairY - crosshairGap - crosshairSize,
    );
    ctx.lineTo(CANVAS_WIDTH / 2, crosshairY - crosshairGap);
    ctx.moveTo(CANVAS_WIDTH / 2, crosshairY + crosshairGap);
    ctx.lineTo(
      CANVAS_WIDTH / 2,
      crosshairY + crosshairGap + crosshairSize,
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  if (world.messageTtl > 0 && world.message) {
    const width = Math.min(
      560,
      Math.max(
        210,
        world.message.length * 9.5,
      ),
    );
    ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
    ctx.fillRect(
      (CANVAS_WIDTH - width) / 2,
      CANVAS_HEIGHT - 68,
      width,
      40,
    );
    ctx.strokeStyle =
      "rgba(167, 139, 250, 0.46)";
    ctx.strokeRect(
      (CANVAS_WIDTH - width) / 2 + 0.5,
      CANVAS_HEIGHT - 67.5,
      width - 1,
      39,
    );
    ctx.fillStyle = "#f8fafc";
    ctx.font =
      "700 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      world.message,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT - 42,
    );
    ctx.textAlign = "left";
  }

  if (world.damageFlash > 0) {
    const flash = clamp(world.damageFlash, 0, 1);
    const damageAge = world.time - (world.lastDamageAt ?? -Infinity);
    const edgeGradient = ctx.createRadialGradient(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT * 0.46,
      90,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT * 0.46,
      CANVAS_WIDTH * 0.72,
    );

    edgeGradient.addColorStop(0, "rgba(239, 68, 68, 0)");
    edgeGradient.addColorStop(
      1,
      `rgba(127, 29, 29, ${flash * 0.76})`,
    );
    ctx.fillStyle = edgeGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (damageAge >= 0 && damageAge < 0.75) {
      const alpha = (1 - damageAge / 0.75) * flash;
      const direction = world.damageDirection ?? 0;
      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT * 0.46;
      const radius = 92;

      ctx.save();
      ctx.translate(
        centerX + Math.sin(direction) * radius,
        centerY - Math.cos(direction) * radius * 0.62,
      );
      ctx.rotate(-direction);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fecaca";
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(-10, 5);
      ctx.lineTo(0, 0);
      ctx.lineTo(10, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = flash * 0.3;
    ctx.fillStyle = "#fb7185";
    for (let drop = 0; drop < 6; drop += 1) {
      const seed = hashNoise(
        Math.floor((world.lastDamageAt ?? 0) * 100) + drop * 9,
        drop * 13,
      );
      const x = drop % 2 === 0 ? seed * 40 : CANVAS_WIDTH - seed * 40;
      const y = seed * CANVAS_HEIGHT;
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + seed * 6, 8 + seed * 11, seed, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawVignette(ctx, world);

  if (world.gameOver || world.victory) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
    ctx.fillRect(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    ctx.shadowBlur = 24;
    ctx.shadowColor = world.victory
      ? "#22c55e"
      : "#ef4444";
    ctx.fillStyle = world.victory
      ? "#4ade80"
      : "#fb7185";
    ctx.font =
      "800 46px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      world.victory
        ? world.labyrinthMode
          ? "LABYRINTH ESCAPED"
          : "MAZE ESCAPED"
        : world.labyrinthMode
          ? "TIME EXPIRED"
          : "GAME OVER",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 32,
    );
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e2e8f0";
    ctx.font =
      "18px system-ui, sans-serif";
    ctx.fillText(
      world.victory
        ? world.labyrinthMode
          ? `Escaped with ${formatTime(getLabyrinthTimeRemaining(world))} remaining`
          : `Finished in ${formatTime(world.time)}`
        : world.labyrinthMode
          ? "The Labyrinth keeps you."
          : `${getPlayerDisplayName(world)} survived ${formatTime(world.time)}`,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 10,
    );
    ctx.textAlign = "left";
  }
}

export function drawWorld3D(ctx, world) {
  ctx.clearRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );

  const rayCount = Math.ceil(
    CANVAS_WIDTH / VIEW_3D_RAY_WIDTH,
  );
  const zBuffer = new Float32Array(rayCount);
  zBuffer.fill(VIEW_3D_MAX_DISTANCE);

  const shake = clamp(world.damageKick ?? 0, 0, 1);
  const shakeX = Math.sin(world.time * 97) * shake * 9;
  const shakeY = Math.cos(world.time * 83) * shake * 6;

  ctx.save();
  ctx.translate(shakeX, shakeY);
  const projectionPlane = draw3DEnvironment(
    ctx,
    world,
    zBuffer,
  );
  draw3DSprites(
    ctx,
    world,
    zBuffer,
    projectionPlane,
  );
  draw3DWeapon(ctx, world);
  ctx.restore();

  draw3DOverlay(ctx, world);
  drawLabyrinthShiftPulse(ctx, world);
}

export function drawWorld(ctx, world) {
  if (world.viewMode === "3d") {
    drawWorld3D(ctx, world);
    return;
  }

  drawWorld2D(ctx, world);
}
