// src/game/rendering-enhanced.js
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DRAW_TILE,
  FLOOR,
  VIEW_3D_FOV,
  VIEW_3D_MAX_DISTANCE,
} from "../config/constants.js";
import {
  LEGENDARY_GOLD,
  LEGENDARY_WHITE,
} from "../config/legendaryPowerUps.js";
import {
  hasRobbienatorLoadout,
} from "../config/robbienator.js";
import {
  hasAsherLoadout,
} from "../config/specialPlayers.js";
import {
  SWORD_GUN_KEY,
} from "../config/weapons.js";
import {
  getCamera,
  getWorldRenderZoom,
} from "./gameplay.js";
import { hasLineOfSight } from "./maze.js";
import {
  drawWorld as drawWorldCore,
} from "./rendering.js?core";
import { angleDelta } from "../utils/math.js";

export * from "./rendering.js?core";

const ROBBIE_SKINS = {
  fists: ["#38bdf8", "#0ea5e9"],
  crowbar: ["#f472b6", "#be185d"],
  pistol: ["#a78bfa", "#6d28d9"],
  revolver: ["#fb923c", "#c2410c"],
  smg: ["#4ade80", "#15803d"],
  shotgun: ["#f87171", "#b91c1c"],
  rifle: ["#22d3ee", "#0e7490"],
};

function drawSmiley(ctx, x, y, radius, color = "#111827") {
  ctx.save();
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.arc(
    x - radius * 0.34,
    y - radius * 0.28,
    Math.max(1.5, radius * 0.12),
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.beginPath();
  ctx.arc(
    x + radius * 0.34,
    y - radius * 0.28,
    Math.max(1.5, radius * 0.12),
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, radius * 0.11);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(
    x,
    y,
    radius * 0.55,
    0.18,
    Math.PI - 0.18,
  );
  ctx.stroke();
  ctx.restore();
}

function drawBanana(ctx, size) {
  const gradient = ctx.createLinearGradient(
    -size * 0.6,
    -size * 0.25,
    size * 0.65,
    size * 0.25,
  );

  gradient.addColorStop(0, "#ca8a04");
  gradient.addColorStop(0.18, "#fde047");
  gradient.addColorStop(0.58, "#facc15");
  gradient.addColorStop(1, "#eab308");

  ctx.fillStyle = gradient;
  ctx.strokeStyle = "#713f12";
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.beginPath();
  ctx.moveTo(-size * 0.55, -size * 0.2);
  ctx.bezierCurveTo(
    -size * 0.22,
    size * 0.34,
    size * 0.36,
    size * 0.38,
    size * 0.62,
    -size * 0.14,
  );
  ctx.bezierCurveTo(
    size * 0.34,
    size * 0.09,
    -size * 0.1,
    size * 0.03,
    -size * 0.42,
    -size * 0.34,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  drawSmiley(
    ctx,
    size * 0.12,
    -size * 0.01,
    size * 0.13,
    "#422006",
  );
}

function drawPlunger(ctx, size) {
  ctx.save();

  ctx.strokeStyle = "#8b5a2b";
  ctx.lineWidth = Math.max(5, size * 0.1);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-size * 0.62, size * 0.36);
  ctx.lineTo(size * 0.35, -size * 0.28);
  ctx.stroke();

  const headX = size * 0.43;
  const headY = -size * 0.32;
  ctx.fillStyle = "#ef4444";
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = Math.max(2, size * 0.04);
  ctx.beginPath();
  ctx.ellipse(
    headX,
    headY,
    size * 0.33,
    size * 0.23,
    -0.25,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.stroke();

  drawSmiley(
    ctx,
    headX,
    headY,
    size * 0.16,
    "#450a0a",
  );
  ctx.restore();
}

function drawGenericRobbieSkin(ctx, weaponKey, size) {
  const [main, dark] =
    ROBBIE_SKINS[weaponKey] ??
    ["#fde047", "#a16207"];

  ctx.save();

  if (weaponKey === "fists") {
    for (const side of [-1, 1]) {
      ctx.fillStyle = main;
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(2, size * 0.04);
      ctx.beginPath();
      ctx.arc(
        side * size * 0.25,
        0,
        size * 0.22,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
      drawSmiley(
        ctx,
        side * size * 0.25,
        0,
        size * 0.11,
      );
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = main;
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(2, size * 0.04);

  ctx.beginPath();
  ctx.roundRect(
    -size * 0.56,
    -size * 0.18,
    size * 1.05,
    size * 0.36,
    size * 0.1,
  );
  ctx.fill();
  ctx.stroke();

  if (
    ["pistol", "revolver", "smg", "shotgun", "rifle"].includes(
      weaponKey,
    )
  ) {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.roundRect(
      -size * 0.08,
      size * 0.1,
      size * 0.2,
      size * 0.4,
      size * 0.05,
    );
    ctx.fill();
  }

  drawSmiley(
    ctx,
    size * 0.18,
    -size * 0.01,
    size * 0.13,
  );
  ctx.restore();
}

function drawRobbieSkin(ctx, weaponKey, size) {
  if (weaponKey === "machete") {
    drawPlunger(ctx, size);
    return;
  }

  if (weaponKey === "dmr") {
    drawBanana(ctx, size);
    return;
  }

  drawGenericRobbieSkin(ctx, weaponKey, size);
}

function drawSwordGun(ctx, size) {
  ctx.save();

  const blade = ctx.createLinearGradient(
    -size * 0.5,
    0,
    size * 0.6,
    0,
  );
  blade.addColorStop(0, "#64748b");
  blade.addColorStop(0.5, "#f8fafc");
  blade.addColorStop(1, "#94a3b8");

  ctx.fillStyle = blade;
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = Math.max(2, size * 0.035);
  ctx.beginPath();
  ctx.moveTo(-size * 0.62, 0);
  ctx.lineTo(size * 0.55, -size * 0.18);
  ctx.lineTo(size * 0.78, 0);
  ctx.lineTo(size * 0.55, size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(
    -size * 0.42,
    size * 0.08,
    size * 0.17,
    size * 0.42,
  );

  ctx.fillStyle = "#facc15";
  ctx.fillRect(
    -size * 0.48,
    -size * 0.25,
    size * 0.12,
    size * 0.5,
  );

  ctx.restore();
}

function playerScreenPosition(world) {
  const camera = getCamera(world);
  const zoom = getWorldRenderZoom(world);
  const scale = DRAW_TILE * zoom;

  return {
    x: (world.player.x - camera.x) * scale,
    y: (world.player.y - camera.y) * scale,
  };
}

function drawSpecialHeldWeapon2D(ctx, world) {
  const robbie =
    hasRobbienatorLoadout(world);
  const asher =
    hasAsherLoadout(world) &&
    world.player.weapon === SWORD_GUN_KEY;

  if (!robbie && !asher) {
    return;
  }

  const player = playerScreenPosition(world);
  const reach = 22;

  ctx.save();
  ctx.translate(
    player.x +
      Math.cos(world.player.facing) * reach,
    player.y +
      Math.sin(world.player.facing) * reach,
  );
  ctx.rotate(world.player.facing - 0.1);

  if (asher) {
    drawSwordGun(ctx, 42);
  } else {
    drawRobbieSkin(
      ctx,
      world.player.weapon,
      40,
    );
  }

  ctx.restore();
}

function drawSpecialHeldWeapon3D(ctx, world) {
  const robbie =
    hasRobbienatorLoadout(world);
  const asher =
    hasAsherLoadout(world) &&
    world.player.weapon === SWORD_GUN_KEY;

  if (!robbie && !asher) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.save();

  const cover = ctx.createLinearGradient(
    0,
    height * 0.72,
    0,
    height,
  );
  cover.addColorStop(0, "rgba(2,6,23,0)");
  cover.addColorStop(0.48, "rgba(2,6,23,0.74)");
  cover.addColorStop(1, "rgba(2,6,23,0.94)");

  ctx.fillStyle = cover;
  ctx.fillRect(
    width * 0.25,
    height * 0.7,
    width * 0.5,
    height * 0.3,
  );

  ctx.translate(
    width * 0.5,
    height - 70,
  );
  ctx.rotate(-0.12);

  if (asher) {
    drawSwordGun(ctx, 220);
  } else {
    drawRobbieSkin(
      ctx,
      world.player.weapon,
      205,
    );
  }

  ctx.restore();
}

function drawBladeShape(ctx, size) {
  ctx.save();
  ctx.fillStyle = "#e2e8f0";
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(-size * 0.55, 0);
  ctx.lineTo(size * 0.4, -size * 0.13);
  ctx.lineTo(size * 0.62, 0);
  ctx.lineTo(size * 0.4, size * 0.13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBladeProjectiles2D(ctx, world) {
  const camera = getCamera(world);
  const zoom = getWorldRenderZoom(world);
  const scale = DRAW_TILE * zoom;

  for (const projectile of world.projectiles ?? []) {
    if (!projectile.bladeProjectile) {
      continue;
    }

    ctx.save();
    ctx.translate(
      (projectile.x - camera.x) * scale,
      (projectile.y - camera.y) * scale,
    );
    ctx.rotate(
      Math.atan2(projectile.vy, projectile.vx),
    );
    drawBladeShape(ctx, 28);
    ctx.restore();
  }
}

function drawBladeProjectiles3D(ctx, world) {
  for (const projectile of world.projectiles ?? []) {
    if (!projectile.bladeProjectile) {
      continue;
    }

    const dx = projectile.x - world.player.x;
    const dy = projectile.y - world.player.y;
    const distance = Math.hypot(dx, dy);

    if (
      distance < 0.15 ||
      distance > VIEW_3D_MAX_DISTANCE
    ) {
      continue;
    }

    const angle = angleDelta(
      Math.atan2(dy, dx),
      world.player.facing,
    );

    if (Math.abs(angle) > VIEW_3D_FOV / 2) {
      continue;
    }

    const x =
      CANVAS_WIDTH *
      (0.5 + angle / VIEW_3D_FOV);
    const size = Math.max(
      7,
      Math.min(70, 95 / distance),
    );

    ctx.save();
    ctx.translate(x, CANVAS_HEIGHT * 0.5);
    ctx.rotate(
      Math.atan2(projectile.vy, projectile.vx) -
        world.player.facing,
    );
    drawBladeShape(ctx, size);
    ctx.restore();
  }
}

function drawLegendaryPickups2D(ctx, world) {
  const camera = getCamera(world);
  const zoom = getWorldRenderZoom(world);
  const scale = DRAW_TILE * zoom;
  const pulse =
    0.5 +
    Math.sin(world.time * 4.5) * 0.5;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const pickup of world.pickups ?? []) {
    if (!pickup.legendary) {
      continue;
    }

    const x =
      (pickup.x - camera.x) * scale;
    const y =
      (pickup.y - camera.y) * scale;
    const radius = 18 + pulse * 8;

    const glow = ctx.createRadialGradient(
      x,
      y,
      2,
      x,
      y,
      radius,
    );
    glow.addColorStop(0, "rgba(255,255,255,.75)");
    glow.addColorStop(0.25, "rgba(250,204,21,.6)");
    glow.addColorStop(1, "rgba(250,204,21,0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      radius,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.strokeStyle = LEGENDARY_GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      12 + pulse * 2,
      0,
      Math.PI * 2,
    );
    ctx.stroke();

    ctx.fillStyle = LEGENDARY_WHITE;
    ctx.font = "900 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("★", x, y - 18);
  }

  ctx.restore();
}

function drawLegendaryPickups3D(ctx, world) {
  for (const pickup of world.pickups ?? []) {
    if (
      !pickup.legendary ||
      !hasLineOfSight(
        world,
        world.player.x,
        world.player.y,
        pickup.x,
        pickup.y,
      )
    ) {
      continue;
    }

    const dx = pickup.x - world.player.x;
    const dy = pickup.y - world.player.y;
    const distance = Math.hypot(dx, dy);
    const angle = angleDelta(
      Math.atan2(dy, dx),
      world.player.facing,
    );

    if (
      distance > VIEW_3D_MAX_DISTANCE ||
      Math.abs(angle) > VIEW_3D_FOV / 2
    ) {
      continue;
    }

    const x =
      CANVAS_WIDTH *
      (0.5 + angle / VIEW_3D_FOV);
    const size =
      Math.max(
        10,
        Math.min(55, 80 / Math.max(0.5, distance)),
      );
    const y =
      CANVAS_HEIGHT *
      (0.5 + Math.min(0.2, distance * 0.006));

    ctx.save();
    ctx.strokeStyle = LEGENDARY_GOLD;
    ctx.fillStyle = LEGENDARY_WHITE;
    ctx.shadowBlur = 22;
    ctx.shadowColor = LEGENDARY_GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      size,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.font = `900 ${Math.max(14, size)}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText("★", x, y - size * 1.15);
    ctx.restore();
  }
}

function getVisibleTileBounds(world) {
  const camera = getCamera(world);
  const zoom = getWorldRenderZoom(world);
  const scale = DRAW_TILE * zoom;

  return {
    camera,
    zoom,
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

function inBounds(world, x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < world.width &&
    y < world.height
  );
}

function isFloorTile(world, x, y) {
  return inBounds(world, x, y) && world.grid[y][x] === FLOOR;
}

function citySeed(x, y, offset = 0) {
  const value = Math.sin(
    x * 127.1 + y * 311.7 + offset * 61.3,
  ) * 43758.5453123;

  return value - Math.floor(value);
}

function roadOrientation(world, x, y) {
  const left = isFloorTile(world, x - 1, y);
  const right = isFloorTile(world, x + 1, y);
  const up = isFloorTile(world, x, y - 1);
  const down = isFloorTile(world, x, y + 1);
  const horizontalScore = Number(left) + Number(right);
  const verticalScore = Number(up) + Number(down);

  if (horizontalScore > verticalScore) {
    return "horizontal";
  }

  if (verticalScore > horizontalScore) {
    return "vertical";
  }

  return horizontalScore + verticalScore >= 3
    ? "intersection"
    : "plaza";
}

function drawRoadCracks(ctx, sx, sy, size, seed) {
  ctx.save();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.34)";
  ctx.lineWidth = Math.max(1, size * 0.028);
  ctx.lineCap = "round";

  const startX = sx + size * (0.18 + seed * 0.38);
  const startY = sy + size * (0.16 + citySeed(seed, seed, 1) * 0.44);

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(
    startX + size * (citySeed(seed, seed, 2) - 0.5) * 0.3,
    startY + size * 0.12,
  );
  ctx.lineTo(
    startX + size * (citySeed(seed, seed, 3) - 0.5) * 0.5,
    startY + size * 0.32,
  );
  ctx.lineTo(
    startX + size * (citySeed(seed, seed, 4) - 0.5) * 0.7,
    startY + size * 0.54,
  );
  ctx.stroke();
  ctx.restore();
}

function drawRoadMarkings(ctx, world, x, y, sx, sy, size) {
  const orientation = roadOrientation(world, x, y);

  ctx.save();
  ctx.lineCap = "round";

  if (orientation === "horizontal") {
    ctx.strokeStyle = "rgba(250, 204, 21, 0.86)";
    ctx.lineWidth = Math.max(2, size * 0.075);

    for (let index = 0; index < 2; index += 1) {
      const x1 = sx + size * (0.14 + index * 0.34);
      const x2 = x1 + size * 0.18;

      ctx.beginPath();
      ctx.moveTo(x1, sy + size * 0.5);
      ctx.lineTo(x2, sy + size * 0.5);
      ctx.stroke();
    }

    if (!isFloorTile(world, x, y - 1)) {
      ctx.strokeStyle = "rgba(226, 232, 240, 0.3)";
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(sx, sy + size * 0.12);
      ctx.lineTo(sx + size, sy + size * 0.12);
      ctx.stroke();
    }

    if (!isFloorTile(world, x, y + 1)) {
      ctx.strokeStyle = "rgba(226, 232, 240, 0.3)";
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(sx, sy + size * 0.88);
      ctx.lineTo(sx + size, sy + size * 0.88);
      ctx.stroke();
    }
  } else if (orientation === "vertical") {
    ctx.strokeStyle = "rgba(250, 204, 21, 0.86)";
    ctx.lineWidth = Math.max(2, size * 0.075);

    for (let index = 0; index < 2; index += 1) {
      const y1 = sy + size * (0.14 + index * 0.34);
      const y2 = y1 + size * 0.18;

      ctx.beginPath();
      ctx.moveTo(sx + size * 0.5, y1);
      ctx.lineTo(sx + size * 0.5, y2);
      ctx.stroke();
    }

    if (!isFloorTile(world, x - 1, y)) {
      ctx.strokeStyle = "rgba(226, 232, 240, 0.3)";
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(sx + size * 0.12, sy);
      ctx.lineTo(sx + size * 0.12, sy + size);
      ctx.stroke();
    }

    if (!isFloorTile(world, x + 1, y)) {
      ctx.strokeStyle = "rgba(226, 232, 240, 0.3)";
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(sx + size * 0.88, sy);
      ctx.lineTo(sx + size * 0.88, sy + size);
      ctx.stroke();
    }
  } else if (orientation === "intersection") {
    ctx.strokeStyle = "rgba(241, 245, 249, 0.82)";
    ctx.lineWidth = Math.max(2, size * 0.055);

    for (let offset = 0.16; offset <= 0.68; offset += 0.17) {
      ctx.beginPath();
      ctx.moveTo(sx + size * offset, sy + size * 0.18);
      ctx.lineTo(sx + size * offset, sy + size * 0.34);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sx + size * 0.18, sy + size * offset);
      ctx.lineTo(sx + size * 0.34, sy + size * offset);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sx + size * 0.66, sy + size * offset);
      ctx.lineTo(sx + size * 0.82, sy + size * offset);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sx + size * offset, sy + size * 0.66);
      ctx.lineTo(sx + size * offset, sy + size * 0.82);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawCityRoads2D(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode === "3d"
  ) {
    return;
  }

  const {
    camera,
    scale,
    minX,
    minY,
    maxX,
    maxY,
  } = getVisibleTileBounds(world);

  ctx.save();

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!isFloorTile(world, x, y)) {
        continue;
      }

      const sx = (x - camera.x) * scale;
      const sy = (y - camera.y) * scale;
      const seed = citySeed(x, y);
      const asphalt = ctx.createLinearGradient(
        sx,
        sy,
        sx + scale,
        sy + scale,
      );

      asphalt.addColorStop(0, `rgba(31, 41, 55, ${0.96 - seed * 0.08})`);
      asphalt.addColorStop(0.5, `rgba(55, 65, 81, ${0.94 - seed * 0.08})`);
      asphalt.addColorStop(1, `rgba(17, 24, 39, ${0.98 - seed * 0.06})`);

      ctx.fillStyle = asphalt;
      ctx.fillRect(sx, sy, scale, scale);

      ctx.fillStyle = "rgba(226, 232, 240, 0.05)";
      for (let dot = 0; dot < 6; dot += 1) {
        ctx.fillRect(
          sx + scale * citySeed(x, y, dot + 1) * 0.92,
          sy + scale * citySeed(y, x, dot + 7) * 0.92,
          Math.max(1, scale * 0.03),
          Math.max(1, scale * 0.03),
        );
      }

      drawRoadCracks(ctx, sx, sy, scale, seed);
      drawRoadMarkings(ctx, world, x, y, sx, sy, scale);
    }
  }

  ctx.restore();
}

function drawBuildingWindows2D(ctx, sx, sy, size, x, y) {
  const rows = 2 + Math.floor(citySeed(x, y, 6) * 2);
  const cols = 2 + Math.floor(citySeed(x, y, 7) * 2);
  const marginX = size * 0.14;
  const marginY = size * 0.16;
  const cellW =
    (size - marginX * 2) / cols;
  const cellH =
    (size - marginY * 2) / rows;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const lit =
        citySeed(x + col, y + row, 8) > 0.58;

      ctx.fillStyle = lit
        ? "rgba(250, 204, 21, 0.38)"
        : "rgba(148, 163, 184, 0.16)";

      ctx.fillRect(
        sx + marginX + col * cellW + cellW * 0.14,
        sy + marginY + row * cellH + cellH * 0.18,
        cellW * 0.58,
        cellH * 0.42,
      );
    }
  }
}

function drawCityBuildingBlocks2D(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode === "3d"
  ) {
    return;
  }

  const {
    camera,
    scale,
    minX,
    minY,
    maxX,
    maxY,
  } = getVisibleTileBounds(world);

  ctx.save();

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (isFloorTile(world, x, y)) {
        continue;
      }

      const sx = (x - camera.x) * scale;
      const sy = (y - camera.y) * scale;
      const seed = citySeed(x, y, 2);

      ctx.fillStyle =
        seed > 0.66
          ? "#20262b"
          : seed > 0.33
            ? "#31383f"
            : "#262d34";
      ctx.fillRect(sx, sy, scale, scale);

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(
        sx + scale * 0.06,
        sy + scale * 0.08,
        scale * 0.88,
        scale * 0.1,
      );

      ctx.fillStyle = "rgba(15,23,42,0.44)";
      ctx.fillRect(
        sx + scale * 0.08,
        sy + scale * 0.2,
        scale * 0.84,
        scale * 0.72,
      );

      drawBuildingWindows2D(ctx, sx, sy, scale, x, y);

      ctx.strokeStyle = "rgba(226, 232, 240, 0.12)";
      ctx.lineWidth = Math.max(1, scale * 0.03);
      ctx.strokeRect(
        sx + scale * 0.05,
        sy + scale * 0.05,
        scale * 0.9,
        scale * 0.9,
      );

      if (isFloorTile(world, x, y + 1)) {
        ctx.fillStyle = "rgba(0,0,0,0.26)";
        ctx.fillRect(
          sx,
          sy + scale * 0.8,
          scale,
          scale * 0.2,
        );
      }
    }
  }

  ctx.restore();
}

function drawCityPlayer2D(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode === "3d"
  ) {
    return;
  }

  const player = playerScreenPosition(world);
  const angle = world.player.facing;

  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = "rgba(2, 6, 23, 0.42)";
  ctx.beginPath();
  ctx.ellipse(0, 11, 16, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(angle);

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.ellipse(-1, 1, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(0, -2, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#334155";
  ctx.fillRect(-10, -1, 20, 14);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(-2, 5, 4, 7);

  ctx.strokeStyle = "rgba(125, 211, 252, 0.66)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.lineTo(16, -5);
  ctx.stroke();

  ctx.restore();
}

function drawCityRoadPerspective3D(ctx) {
  ctx.save();

  const horizon = CANVAS_HEIGHT * 0.53;

  ctx.fillStyle = "rgba(9, 12, 16, 0.92)";
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.12, CANVAS_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH * 0.33, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.67, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.88, CANVAS_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(120, 128, 136, 0.34)";
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH * 0.26, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.33, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.12, CANVAS_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH * 0.74, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.67, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.88, CANVAS_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(250, 204, 21, 0.92)";
  ctx.lineCap = "round";

  for (let segment = 0; segment < 9; segment += 1) {
    const depthA = segment / 9;
    const depthB = (segment + 0.45) / 9;
    const y1 =
      horizon +
      (CANVAS_HEIGHT - horizon) * depthA;
    const y2 =
      horizon +
      (CANVAS_HEIGHT - horizon) * depthB;
    const widthA = 2 + depthA * 7;
    const widthB = 2 + depthB * 7;

    ctx.lineWidth = (widthA + widthB) * 0.5;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH * 0.5, y1);
    ctx.lineTo(CANVAS_WIDTH * 0.5, y2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(241, 245, 249, 0.2)";
  ctx.lineWidth = 2;
  for (let side of [0.28, 0.72]) {
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH * side, horizon);
    ctx.lineTo(
      CANVAS_WIDTH * (side < 0.5 ? 0.08 : 0.92),
      CANVAS_HEIGHT,
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawCityWallFacade3D(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode !== "3d"
  ) {
    return;
  }

  ctx.save();

  ctx.fillStyle = "rgba(4, 8, 15, 0.3)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const skylineBase = CANVAS_HEIGHT * 0.34;
  ctx.fillStyle = "rgba(15, 23, 42, 0.56)";
  ctx.beginPath();
  ctx.moveTo(0, skylineBase + 40);

  for (let x = 0; x <= CANVAS_WIDTH; x += 44) {
    const seed = citySeed(x, 0, 11);
    const height = 24 + seed * 82;
    ctx.lineTo(x, skylineBase + 40);
    ctx.lineTo(x, skylineBase - height);
    ctx.lineTo(x + 22, skylineBase - height + seed * 12);
  }

  ctx.lineTo(CANVAS_WIDTH, skylineBase + 40);
  ctx.closePath();
  ctx.fill();

  for (const side of ["left", "right"]) {
    const leftSide = side === "left";

    ctx.fillStyle = "rgba(17, 24, 39, 0.26)";
    ctx.beginPath();
    ctx.moveTo(leftSide ? 0 : CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.lineTo(leftSide ? 0 : CANVAS_WIDTH, CANVAS_HEIGHT * 0.18);
    ctx.lineTo(leftSide ? CANVAS_WIDTH * 0.26 : CANVAS_WIDTH * 0.74, CANVAS_HEIGHT * 0.35);
    ctx.lineTo(leftSide ? CANVAS_WIDTH * 0.18 : CANVAS_WIDTH * 0.82, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();

    for (let column = 0; column < 5; column += 1) {
      for (let row = 0; row < 9; row += 1) {
        const lit = citySeed(column, row, leftSide ? 3 : 9) > 0.58;
        const px = leftSide
          ? 20 + column * 26 + row * 2
          : CANVAS_WIDTH - 30 - column * 26 - row * 2;
        const py = 110 + row * 33 + column * 5;

        ctx.fillStyle = lit
          ? "rgba(250, 204, 21, 0.28)"
          : "rgba(203, 213, 225, 0.12)";
        ctx.fillRect(
          px,
          py,
          10,
          14,
        );
      }
    }
  }

  ctx.restore();
}

function drawUrbanFog(ctx, world) {
  if (world.level?.themeKey !== "city") {
    return;
  }

  ctx.save();

  if (world.viewMode === "3d") {
    const fog = ctx.createLinearGradient(
      0,
      0,
      0,
      CANVAS_HEIGHT,
    );
    fog.addColorStop(0, "rgba(130, 134, 139, 0.08)");
    fog.addColorStop(0.38, "rgba(162, 166, 171, 0.15)");
    fog.addColorStop(0.76, "rgba(114, 118, 122, 0.11)");
    fog.addColorStop(1, "rgba(96, 100, 104, 0.06)");
    ctx.fillStyle = fog;
    ctx.fillRect(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
  } else {
    for (let index = 0; index < 11; index += 1) {
      const x =
        (
          index * 131 +
          world.time * (11 + index)
        ) %
          (CANVAS_WIDTH + 320) -
        160;
      const y =
        70 +
        ((index * 89) % (CANVAS_HEIGHT - 120));

      ctx.fillStyle = "rgba(190, 194, 198, 0.045)";
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        170,
        42,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawCityPlayer3DAccent(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode !== "3d"
  ) {
    return;
  }

  ctx.save();

  const bottom = CANVAS_HEIGHT - 8;

  ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.14, bottom);
  ctx.quadraticCurveTo(
    CANVAS_WIDTH * 0.18,
    CANVAS_HEIGHT * 0.72,
    CANVAS_WIDTH * 0.31,
    CANVAS_HEIGHT * 0.8,
  );
  ctx.lineTo(CANVAS_WIDTH * 0.36, bottom);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.86, bottom);
  ctx.quadraticCurveTo(
    CANVAS_WIDTH * 0.82,
    CANVAS_HEIGHT * 0.72,
    CANVAS_WIDTH * 0.69,
    CANVAS_HEIGHT * 0.8,
  );
  ctx.lineTo(CANVAS_WIDTH * 0.64, bottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(245, 158, 11, 0.92)";
  ctx.beginPath();
  ctx.ellipse(
    CANVAS_WIDTH * 0.34,
    CANVAS_HEIGHT * 0.84,
    22,
    15,
    0.4,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(
    CANVAS_WIDTH * 0.66,
    CANVAS_HEIGHT * 0.84,
    22,
    15,
    -0.4,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.restore();
}

export function drawWorld(ctx, world) {
  drawWorldCore(ctx, world);

  if (world.level?.themeKey === "city") {
    if (world.viewMode === "3d") {
      drawCityRoadPerspective3D(ctx);
      drawCityWallFacade3D(ctx, world);
      drawUrbanFog(ctx, world);
      drawCityPlayer3DAccent(ctx, world);
    } else {
      drawCityRoads2D(ctx, world);
      drawCityBuildingBlocks2D(ctx, world);
      drawUrbanFog(ctx, world);
      drawCityPlayer2D(ctx, world);
    }
  } else {
    drawUrbanFog(ctx, world);
  }

  if (world.viewMode === "3d") {
    drawLegendaryPickups3D(ctx, world);
    drawBladeProjectiles3D(ctx, world);
    drawSpecialHeldWeapon3D(ctx, world);
  } else {
    drawLegendaryPickups2D(ctx, world);
    drawBladeProjectiles2D(ctx, world);
    drawSpecialHeldWeapon2D(ctx, world);
  }
}
