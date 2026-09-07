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
} from "../config/weapons-enhanced.js";
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
    x * 127.1 + y * 311.7 + offset * 74.7,
  ) * 43758.5453123;

  return value - Math.floor(value);
}

function worldToScreen(world, x, y) {
  const camera = getCamera(world);
  const scale = DRAW_TILE * getWorldRenderZoom(world);

  return {
    x: (x - camera.x) * scale,
    y: (y - camera.y) * scale,
    scale,
  };
}

function roadOrientation(world, x, y) {
  const left = isFloorTile(world, x - 1, y);
  const right = isFloorTile(world, x + 1, y);
  const up = isFloorTile(world, x, y - 1);
  const down = isFloorTile(world, x, y + 1);
  const horizontal = Number(left) + Number(right);
  const vertical = Number(up) + Number(down);

  if (horizontal >= 1 && vertical >= 1) {
    return "intersection";
  }

  if (horizontal > vertical) {
    return "horizontal";
  }

  if (vertical > horizontal) {
    return "vertical";
  }

  return "plaza";
}

function drawStreetRoadTile2D(ctx, world, x, y, sx, sy, size) {
  const seed = citySeed(x, y, 1);
  const asphalt = ctx.createLinearGradient(
    sx,
    sy,
    sx + size,
    sy + size,
  );
  asphalt.addColorStop(0, "#33373b");
  asphalt.addColorStop(0.5, seed > 0.5 ? "#3d4145" : "#383c40");
  asphalt.addColorStop(1, "#262a2e");
  ctx.fillStyle = asphalt;
  ctx.fillRect(sx, sy, size, size);

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let index = 0; index < 5; index += 1) {
    ctx.fillRect(
      sx + size * citySeed(x, y, 10 + index) * 0.92,
      sy + size * citySeed(y, x, 20 + index) * 0.92,
      Math.max(1, size * 0.03),
      Math.max(1, size * 0.03),
    );
  }

  const orientation = roadOrientation(world, x, y);

  ctx.strokeStyle = "rgba(17, 24, 39, 0.34)";
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(sx + size * 0.14, sy + size * 0.18);
  ctx.lineTo(sx + size * 0.28, sy + size * 0.42);
  ctx.lineTo(sx + size * 0.2, sy + size * 0.72);
  ctx.stroke();

  if (orientation === "horizontal") {
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = Math.max(2, size * 0.065);
    ctx.lineCap = "round";

    for (const offset of [0.44, 0.56]) {
      for (let dash = 0; dash < 2; dash += 1) {
        const x1 = sx + size * (0.14 + dash * 0.36);
        const x2 = x1 + size * 0.16;
        ctx.beginPath();
        ctx.moveTo(x1, sy + size * offset);
        ctx.lineTo(x2, sy + size * offset);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = "rgba(241, 245, 249, 0.22)";
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.beginPath();
    ctx.moveTo(sx, sy + size * 0.14);
    ctx.lineTo(sx + size, sy + size * 0.14);
    ctx.moveTo(sx, sy + size * 0.86);
    ctx.lineTo(sx + size, sy + size * 0.86);
    ctx.stroke();
  } else if (orientation === "vertical") {
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = Math.max(2, size * 0.065);
    ctx.lineCap = "round";

    for (const offset of [0.44, 0.56]) {
      for (let dash = 0; dash < 2; dash += 1) {
        const y1 = sy + size * (0.14 + dash * 0.36);
        const y2 = y1 + size * 0.16;
        ctx.beginPath();
        ctx.moveTo(sx + size * offset, y1);
        ctx.lineTo(sx + size * offset, y2);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = "rgba(241, 245, 249, 0.22)";
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.beginPath();
    ctx.moveTo(sx + size * 0.14, sy);
    ctx.lineTo(sx + size * 0.14, sy + size);
    ctx.moveTo(sx + size * 0.86, sy);
    ctx.lineTo(sx + size * 0.86, sy + size);
    ctx.stroke();
  } else if (orientation === "intersection") {
    ctx.fillStyle = "rgba(241, 245, 249, 0.75)";
    const stripeW = size * 0.08;
    const stripeH = size * 0.18;

    for (let step = 0; step < 4; step += 1) {
      const offset = size * (0.14 + step * 0.14);

      ctx.fillRect(
        sx + offset,
        sy + size * 0.08,
        stripeW,
        stripeH,
      );
      ctx.fillRect(
        sx + offset,
        sy + size * 0.74,
        stripeW,
        stripeH,
      );
      ctx.fillRect(
        sx + size * 0.08,
        sy + offset,
        stripeH,
        stripeW,
      );
      ctx.fillRect(
        sx + size * 0.74,
        sy + offset,
        stripeH,
        stripeW,
      );
    }
  }
}

function drawCityRoads2D(ctx, world) {
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
      if (!isFloorTile(world, x, y)) {
        continue;
      }

      const sx = (x - bounds.camera.x) * bounds.scale;
      const sy = (y - bounds.camera.y) * bounds.scale;
      drawStreetRoadTile2D(ctx, world, x, y, sx, sy, bounds.scale);
    }
  }
  ctx.restore();
}

function drawSkyscraperTile2D(ctx, sx, sy, size, x, y) {
  const towerCount = 3 + Math.floor(citySeed(x, y, 2) * 2);

  ctx.fillStyle = citySeed(x, y, 3) > 0.5 ? "#1f2937" : "#111827";
  ctx.fillRect(sx, sy, size, size);

  ctx.fillStyle = "rgba(71, 85, 105, 0.6)";
  ctx.fillRect(sx, sy, size, size * 0.09);

  for (let tower = 0; tower < towerCount; tower += 1) {
    const left = sx + size * (0.05 + tower * 0.18);
    const width = size * (0.14 + citySeed(x + tower, y, 4) * 0.06);
    const top = sy + size * (0.18 + citySeed(x, y + tower, 5) * 0.12);
    const height = size * (0.64 + citySeed(x, y, 6 + tower) * 0.1);

    ctx.fillStyle = tower % 2 === 0 ? "#273342" : "#364152";
    ctx.fillRect(left, top, width, height);

    ctx.fillStyle = "rgba(148, 163, 184, 0.22)";
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const lit = citySeed(x + tower + col, y + row, 30) > 0.62;
        ctx.fillStyle = lit
          ? "rgba(250, 204, 21, 0.42)"
          : "rgba(226, 232, 240, 0.15)";
        ctx.fillRect(
          left + width * (0.16 + col * 0.38),
          top + height * (0.08 + row * 0.16),
          width * 0.17,
          height * 0.07,
        );
      }
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = Math.max(1, size * 0.02);
  for (let stripe = 1; stripe < 4; stripe += 1) {
    const px = sx + size * (stripe / 4);
    ctx.beginPath();
    ctx.moveTo(px, sy + size * 0.1);
    ctx.lineTo(px, sy + size);
    ctx.stroke();
  }
}

function drawCityBuildingBlocks2D(ctx, world) {
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

      const sx = (x - bounds.camera.x) * bounds.scale;
      const sy = (y - bounds.camera.y) * bounds.scale;
      drawSkyscraperTile2D(ctx, sx, sy, bounds.scale, x, y);
    }
  }
  ctx.restore();
}

function pickupColor(type) {
  switch (type) {
    case "health":
      return "#22c55e";
    case "ammo":
      return "#f59e0b";
    case "weapon":
      return "#94a3b8";
    case "power":
      return "#8b5cf6";
    default:
      return "#e2e8f0";
  }
}

function drawCityPickups2D(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode === "3d"
  ) {
    return;
  }

  ctx.save();

  for (const pickup of world.pickups ?? []) {
    const { x, y, scale } = worldToScreen(world, pickup.x, pickup.y);
    const color = pickup.legendary
      ? LEGENDARY_GOLD
      : pickupColor(pickup.type);
    const size = scale * 0.18;

    ctx.fillStyle = "rgba(15, 23, 42, 0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y + size * 1.2, size * 1.4, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;

    if (pickup.type === "health") {
      ctx.fillRect(x - size * 0.35, y - size * 0.12, size * 0.7, size * 0.24);
      ctx.fillRect(x - size * 0.12, y - size * 0.35, size * 0.24, size * 0.7);
    } else if (pickup.type === "ammo") {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.6);
      ctx.lineTo(x + size * 0.6, y);
      ctx.lineTo(x, y + size * 0.6);
      ctx.lineTo(x - size * 0.6, y);
      ctx.closePath();
      ctx.fill();
    }

    if (pickup.legendary) {
      ctx.strokeStyle = LEGENDARY_WHITE;
      ctx.lineWidth = Math.max(1, size * 0.12);
      ctx.beginPath();
      ctx.arc(x, y, size * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function enemyPalette(kind) {
  switch (kind) {
    case "turret":
      return {
        main: "#fb7185",
        dark: "#881337",
        eye: "#fef2f2",
      };
    case "melee":
      return {
        main: "#ef4444",
        dark: "#7f1d1d",
        eye: "#fee2e2",
      };
    default:
      return {
        main: "#f97316",
        dark: "#7c2d12",
        eye: "#fff7ed",
      };
  }
}

function drawCityEnemies2D(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode === "3d"
  ) {
    return;
  }

  ctx.save();

  for (const enemy of world.enemies ?? []) {
    const { x, y, scale } = worldToScreen(world, enemy.x, enemy.y);
    const radius = Math.max(
      scale * 0.18,
      (enemy.radius ?? 0.22) * scale,
    );
    const palette = enemyPalette(enemy.kind);

    ctx.fillStyle = "rgba(2, 6, 23, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 1.1, radius * 1.1, radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.main;
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(1, radius * 0.18);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = palette.eye;
    ctx.beginPath();
    ctx.arc(x - radius * 0.34, y - radius * 0.16, radius * 0.16, 0, Math.PI * 2);
    ctx.arc(x + radius * 0.34, y - radius * 0.16, radius * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(1, radius * 0.12);
    ctx.beginPath();
    ctx.arc(x, y + radius * 0.1, radius * 0.42, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
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

  ctx.fillStyle = "rgba(2, 6, 23, 0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 11, 17, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(angle);

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(0, 2, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f1c27d";
  ctx.beginPath();
  ctx.arc(0, -6, 6.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#475569";
  ctx.fillRect(-10, -1, 20, 14);

  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(-3, 3, 6, 8);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(18, -4);
  ctx.stroke();

  ctx.restore();
}

function drawCityRoadPerspective3D(ctx) {
  ctx.save();

  const horizon = CANVAS_HEIGHT * 0.54;

  ctx.fillStyle = "#2f3438";
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.17, CANVAS_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH * 0.36, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.64, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.83, CANVAS_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#62686e";
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH * 0.28, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.36, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.17, CANVAS_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH * 0.72, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.64, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.83, CANVAS_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#facc15";
  ctx.lineCap = "round";

  for (let segment = 0; segment < 8; segment += 1) {
    const start = segment / 8;
    const end = (segment + 0.38) / 8;
    const y1 = horizon + (CANVAS_HEIGHT - horizon) * start;
    const y2 = horizon + (CANVAS_HEIGHT - horizon) * end;
    ctx.lineWidth = 2 + start * 8;

    for (const offset of [-10, 10]) {
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH * 0.5 + offset, y1);
      ctx.lineTo(CANVAS_WIDTH * 0.5 + offset, y2);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "rgba(241,245,249,0.26)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.36, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.18, CANVAS_HEIGHT);
  ctx.moveTo(CANVAS_WIDTH * 0.64, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.82, CANVAS_HEIGHT);
  ctx.stroke();

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

  const horizon = CANVAS_HEIGHT * 0.54;
  const sidePolys = [
    [
      [0, CANVAS_HEIGHT],
      [0, CANVAS_HEIGHT * 0.1],
      [CANVAS_WIDTH * 0.34, horizon],
      [CANVAS_WIDTH * 0.18, CANVAS_HEIGHT],
    ],
    [
      [CANVAS_WIDTH, CANVAS_HEIGHT],
      [CANVAS_WIDTH, CANVAS_HEIGHT * 0.1],
      [CANVAS_WIDTH * 0.66, horizon],
      [CANVAS_WIDTH * 0.82, CANVAS_HEIGHT],
    ],
  ];

  for (const polygon of sidePolys) {
    ctx.fillStyle = "rgba(17, 24, 39, 0.24)";
    ctx.beginPath();
    ctx.moveTo(polygon[0][0], polygon[0][1]);
    for (let index = 1; index < polygon.length; index += 1) {
      ctx.lineTo(polygon[index][0], polygon[index][1]);
    }
    ctx.closePath();
    ctx.fill();
  }

  const drawWindowBank = (startX, dir) => {
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const px = startX + dir * (col * 24 + row * 1.5);
        const py = 92 + row * 30 + col * 4;
        const lit = citySeed(row, col, dir > 0 ? 51 : 52) > 0.58;

        ctx.fillStyle = lit
          ? "rgba(250, 204, 21, 0.32)"
          : "rgba(226, 232, 240, 0.12)";
        ctx.fillRect(px, py, 9, 13);
      }
    }
  };

  drawWindowBank(18, 1);
  drawWindowBank(CANVAS_WIDTH - 28, -1);

  const skylineY = CANVAS_HEIGHT * 0.3;
  ctx.fillStyle = "rgba(30, 41, 59, 0.62)";
  ctx.beginPath();
  ctx.moveTo(0, skylineY + 50);
  for (let x = 0; x <= CANVAS_WIDTH + 30; x += 30) {
    const seed = citySeed(x, 0, 60);
    const height = 30 + seed * 95;
    ctx.lineTo(x, skylineY + 50);
    ctx.lineTo(x, skylineY - height);
    ctx.lineTo(x + 14, skylineY - height + seed * 8);
  }
  ctx.lineTo(CANVAS_WIDTH, skylineY + 50);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawUrbanFog(ctx, world) {
  if (world.level?.themeKey !== "city") {
    return;
  }

  ctx.save();

  if (world.viewMode === "3d") {
    const fog = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    fog.addColorStop(0, "rgba(161, 161, 170, 0.08)");
    fog.addColorStop(0.4, "rgba(212, 212, 216, 0.14)");
    fog.addColorStop(0.8, "rgba(148, 163, 184, 0.1)");
    fog.addColorStop(1, "rgba(100, 116, 139, 0.05)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    for (let index = 0; index < 10; index += 1) {
      const x =
        (
          index * 137 +
          world.time * (14 + index)
        ) %
          (CANVAS_WIDTH + 340) -
        170;
      const y = 60 + ((index * 83) % (CANVAS_HEIGHT - 120));

      ctx.fillStyle = "rgba(226, 232, 240, 0.05)";
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        180,
        34,
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
  ctx.fillStyle = "rgba(17, 24, 39, 0.92)";
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.16, bottom);
  ctx.quadraticCurveTo(
    CANVAS_WIDTH * 0.2,
    CANVAS_HEIGHT * 0.74,
    CANVAS_WIDTH * 0.31,
    CANVAS_HEIGHT * 0.82,
  );
  ctx.lineTo(CANVAS_WIDTH * 0.36, bottom);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.84, bottom);
  ctx.quadraticCurveTo(
    CANVAS_WIDTH * 0.8,
    CANVAS_HEIGHT * 0.74,
    CANVAS_WIDTH * 0.69,
    CANVAS_HEIGHT * 0.82,
  );
  ctx.lineTo(CANVAS_WIDTH * 0.64, bottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(241, 194, 125, 0.95)";
  ctx.beginPath();
  ctx.ellipse(CANVAS_WIDTH * 0.34, CANVAS_HEIGHT * 0.84, 20, 14, 0.3, 0, Math.PI * 2);
  ctx.ellipse(CANVAS_WIDTH * 0.66, CANVAS_HEIGHT * 0.84, 20, 14, -0.3, 0, Math.PI * 2);
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
      drawCityPickups2D(ctx, world);
      drawCityEnemies2D(ctx, world);
      drawUrbanFog(ctx, world);
      drawCityPlayer2D(ctx, world);
    }
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
