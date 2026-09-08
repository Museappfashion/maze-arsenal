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
    x * 127.1 + y * 311.7 + offset * 53.13,
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

function getStreetEdges(world, x, y) {
  return {
    left: !isFloorTile(world, x - 1, y),
    right: !isFloorTile(world, x + 1, y),
    up: !isFloorTile(world, x, y - 1),
    down: !isFloorTile(world, x, y + 1),
  };
}

function scanStreetDistance(world, x, y, dx, dy, maxDistance = 8) {
  let distance = 0;

  for (let step = 1; step <= maxDistance; step += 1) {
    if (!isFloorTile(world, x + dx * step, y + dy * step)) {
      break;
    }

    distance += 1;
  }

  return distance;
}

function getStreetOrientation(world, x, y) {
  const left = scanStreetDistance(world, x, y, -1, 0);
  const right = scanStreetDistance(world, x, y, 1, 0);
  const up = scanStreetDistance(world, x, y, 0, -1);
  const down = scanStreetDistance(world, x, y, 0, 1);
  const horizontal = left + right;
  const vertical = up + down;

  if (
    horizontal >= 5 &&
    vertical >= 5 &&
    Math.abs(horizontal - vertical) <= 2
  ) {
    return "intersection";
  }

  if (horizontal >= vertical) {
    return "horizontal";
  }

  return "vertical";
}


function drawSidewalkEdges(ctx, edges, sx, sy, size) {
  const band = size * 0.12;

  ctx.fillStyle = "#777b7e";

  if (edges.left) {
    ctx.fillRect(sx, sy, band, size);
  }

  if (edges.right) {
    ctx.fillRect(sx + size - band, sy, band, size);
  }

  if (edges.up) {
    ctx.fillRect(sx, sy, size, band);
  }

  if (edges.down) {
    ctx.fillRect(sx, sy + size - band, size, band);
  }

  ctx.strokeStyle = "rgba(238, 241, 243, 0.3)";
  ctx.lineWidth = Math.max(1, size * 0.018);

  if (edges.left) {
    ctx.beginPath();
    ctx.moveTo(sx + band, sy);
    ctx.lineTo(sx + band, sy + size);
    ctx.stroke();
  }

  if (edges.right) {
    ctx.beginPath();
    ctx.moveTo(sx + size - band, sy);
    ctx.lineTo(sx + size - band, sy + size);
    ctx.stroke();
  }

  if (edges.up) {
    ctx.beginPath();
    ctx.moveTo(sx, sy + band);
    ctx.lineTo(sx + size, sy + band);
    ctx.stroke();
  }

  if (edges.down) {
    ctx.beginPath();
    ctx.moveTo(sx, sy + size - band);
    ctx.lineTo(sx + size, sy + size - band);
    ctx.stroke();
  }
}


function drawRoadMarks2D(ctx, world, x, y, sx, sy, size) {
  const orientation = getStreetOrientation(world, x, y);
  const left = scanStreetDistance(world, x, y, -1, 0);
  const right = scanStreetDistance(world, x, y, 1, 0);
  const up = scanStreetDistance(world, x, y, 0, -1);
  const down = scanStreetDistance(world, x, y, 0, 1);
  const dashPhase = (x + y) % 3;

  ctx.save();
  ctx.strokeStyle = "#f4c430";
  ctx.lineCap = "butt";

  if (orientation === "horizontal") {
    const centerTile = Math.abs(up - down) <= 1;

    if (centerTile && dashPhase !== 1) {
      const centerY =
        down > up
          ? sy + size * 0.93
          : sy + size * 0.07;

      ctx.lineWidth = Math.max(1.5, size * 0.026);

      ctx.beginPath();
      ctx.moveTo(sx + size * 0.08, centerY - size * 0.035);
      ctx.lineTo(sx + size * 0.92, centerY - size * 0.035);
      ctx.moveTo(sx + size * 0.08, centerY + size * 0.035);
      ctx.lineTo(sx + size * 0.92, centerY + size * 0.035);
      ctx.stroke();
    }
  } else if (orientation === "vertical") {
    const centerTile = Math.abs(left - right) <= 1;

    if (centerTile && dashPhase !== 1) {
      const centerX =
        right > left
          ? sx + size * 0.93
          : sx + size * 0.07;

      ctx.lineWidth = Math.max(1.5, size * 0.026);

      ctx.beginPath();
      ctx.moveTo(centerX - size * 0.035, sy + size * 0.08);
      ctx.lineTo(centerX - size * 0.035, sy + size * 0.92);
      ctx.moveTo(centerX + size * 0.035, sy + size * 0.08);
      ctx.lineTo(centerX + size * 0.035, sy + size * 0.92);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = "rgba(241, 245, 249, 0.38)";
    ctx.lineWidth = Math.max(1, size * 0.018);

    ctx.beginPath();
    ctx.moveTo(sx + size * 0.08, sy + size * 0.08);
    ctx.lineTo(sx + size * 0.92, sy + size * 0.08);
    ctx.moveTo(sx + size * 0.08, sy + size * 0.92);
    ctx.lineTo(sx + size * 0.92, sy + size * 0.92);
    ctx.moveTo(sx + size * 0.08, sy + size * 0.08);
    ctx.lineTo(sx + size * 0.08, sy + size * 0.92);
    ctx.moveTo(sx + size * 0.92, sy + size * 0.08);
    ctx.lineTo(sx + size * 0.92, sy + size * 0.92);
    ctx.stroke();
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
      const variation = citySeed(x, y, 1);
      const asphalt = ctx.createLinearGradient(
        sx,
        sy,
        sx + bounds.scale,
        sy + bounds.scale,
      );

      asphalt.addColorStop(
        0,
        variation > 0.58 ? "#35383a" : "#303335",
      );
      asphalt.addColorStop(0.55, "#373a3c");
      asphalt.addColorStop(1, "#292c2e");

      ctx.fillStyle = asphalt;
      ctx.fillRect(
        sx,
        sy,
        bounds.scale + 0.5,
        bounds.scale + 0.5,
      );

      ctx.fillStyle = "rgba(255,255,255,0.018)";
      for (let speck = 0; speck < 3; speck += 1) {
        ctx.fillRect(
          sx + bounds.scale * citySeed(x, y, 70 + speck),
          sy + bounds.scale * citySeed(y, x, 80 + speck),
          Math.max(1, bounds.scale * 0.012),
          Math.max(1, bounds.scale * 0.012),
        );
      }

      drawSidewalkEdges(
        ctx,
        getStreetEdges(world, x, y),
        sx,
        sy,
        bounds.scale,
      );
      drawRoadMarks2D(
        ctx,
        world,
        x,
        y,
        sx,
        sy,
        bounds.scale,
      );
      drawStreetCracks(
        ctx,
        sx,
        sy,
        bounds.scale,
        x,
        y,
      );
    }
  }

  ctx.restore();
}


function drawSkyscraperTile2D(ctx, world, x, y, sx, sy, size) {
  const seed = citySeed(x, y, 2);
  const heightClass = 0.72 + citySeed(x, y, 3) * 0.28;
  const roadLeft = isFloorTile(world, x - 1, y);
  const roadRight = isFloorTile(world, x + 1, y);
  const roadUp = isFloorTile(world, x, y - 1);
  const roadDown = isFloorTile(world, x, y + 1);
  const roofColor =
    seed > 0.72
      ? "#26313c"
      : seed > 0.4
        ? "#1d2833"
        : "#17212a";

  ctx.save();

  ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
  ctx.fillRect(
    sx + size * 0.07,
    sy + size * 0.09,
    size * 0.93,
    size * 0.91,
  );

  const roof = ctx.createLinearGradient(
    sx,
    sy,
    sx + size,
    sy + size,
  );
  roof.addColorStop(0, "#3b4650");
  roof.addColorStop(0.18, roofColor);
  roof.addColorStop(1, "#111820");

  ctx.fillStyle = roof;
  ctx.fillRect(
    sx + size * 0.035,
    sy + size * 0.035,
    size * 0.91,
    size * 0.91,
  );

  ctx.strokeStyle = "rgba(203, 213, 225, 0.26)";
  ctx.lineWidth = Math.max(1, size * 0.022);
  ctx.strokeRect(
    sx + size * 0.055,
    sy + size * 0.055,
    size * 0.87,
    size * 0.87,
  );

  const unitWidth = size * (0.2 + citySeed(x, y, 10) * 0.12);
  const unitHeight = size * (0.16 + citySeed(x, y, 11) * 0.09);
  const unitX =
    sx + size * (0.18 + citySeed(x, y, 12) * 0.42);
  const unitY =
    sy + size * (0.2 + citySeed(x, y, 13) * 0.38);

  ctx.fillStyle = "#59636d";
  ctx.fillRect(unitX, unitY, unitWidth, unitHeight);
  ctx.fillStyle = "#242c34";
  ctx.fillRect(
    unitX + unitWidth * 0.16,
    unitY + unitHeight * 0.18,
    unitWidth * 0.68,
    unitHeight * 0.56,
  );

  if (citySeed(x, y, 14) > 0.67) {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
    ctx.lineWidth = Math.max(1, size * 0.016);
    ctx.beginPath();
    ctx.moveTo(
      sx + size * 0.7,
      sy + size * 0.58,
    );
    ctx.lineTo(
      sx + size * 0.7,
      sy + size * (0.25 - heightClass * 0.04),
    );
    ctx.stroke();

    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(
      sx + size * 0.7,
      sy + size * (0.24 - heightClass * 0.04),
      Math.max(1, size * 0.025),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const drawFacade = (side) => {
    const band = size * 0.19;
    const windowColor = "rgba(241, 245, 249, 0.28)";
    const litColor = "rgba(250, 204, 21, 0.42)";

    if (side === "left") {
      ctx.fillStyle = "#101820";
      ctx.fillRect(sx, sy + size * 0.08, band, size * 0.84);

      for (let row = 0; row < 4; row += 1) {
        ctx.fillStyle =
          citySeed(x, y + row, 30) > 0.76
            ? litColor
            : windowColor;
        ctx.fillRect(
          sx + band * 0.28,
          sy + size * (0.18 + row * 0.17),
          band * 0.34,
          size * 0.055,
        );
      }
    } else if (side === "right") {
      ctx.fillStyle = "#0d151d";
      ctx.fillRect(
        sx + size - band,
        sy + size * 0.08,
        band,
        size * 0.84,
      );

      for (let row = 0; row < 4; row += 1) {
        ctx.fillStyle =
          citySeed(x + row, y, 31) > 0.76
            ? litColor
            : windowColor;
        ctx.fillRect(
          sx + size - band * 0.62,
          sy + size * (0.18 + row * 0.17),
          band * 0.34,
          size * 0.055,
        );
      }
    } else if (side === "up") {
      ctx.fillStyle = "#111a22";
      ctx.fillRect(sx + size * 0.08, sy, size * 0.84, band);

      for (let col = 0; col < 4; col += 1) {
        ctx.fillStyle =
          citySeed(x + col, y, 32) > 0.76
            ? litColor
            : windowColor;
        ctx.fillRect(
          sx + size * (0.17 + col * 0.17),
          sy + band * 0.28,
          size * 0.055,
          band * 0.34,
        );
      }
    } else if (side === "down") {
      ctx.fillStyle = "#0c141b";
      ctx.fillRect(
        sx + size * 0.08,
        sy + size - band,
        size * 0.84,
        band,
      );

      for (let col = 0; col < 4; col += 1) {
        ctx.fillStyle =
          citySeed(x, y + col, 33) > 0.76
            ? litColor
            : windowColor;
        ctx.fillRect(
          sx + size * (0.17 + col * 0.17),
          sy + size - band * 0.62,
          size * 0.055,
          band * 0.34,
        );
      }
    }
  };

  if (roadLeft) {
    drawFacade("left");
  }
  if (roadRight) {
    drawFacade("right");
  }
  if (roadUp) {
    drawFacade("up");
  }
  if (roadDown) {
    drawFacade("down");
  }

  ctx.restore();
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
      drawSkyscraperTile2D(
        ctx,
        world,
        x,
        y,
        sx,
        sy,
        bounds.scale,
      );
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
    const position = worldToScreen(world, pickup.x, pickup.y);
    const x = position.x;
    const y = position.y;
    const size = position.scale * 0.18;
    const color = pickup.legendary
      ? LEGENDARY_GOLD
      : pickupColor(pickup.type);

    ctx.fillStyle = "rgba(15, 23, 42, 0.28)";
    ctx.beginPath();
    ctx.ellipse(
      x,
      y + size * 1.2,
      size * 1.35,
      size * 0.75,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.fillStyle = color;

    if (pickup.type === "health") {
      ctx.fillRect(
        x - size * 0.38,
        y - size * 0.12,
        size * 0.76,
        size * 0.24,
      );
      ctx.fillRect(
        x - size * 0.12,
        y - size * 0.38,
        size * 0.24,
        size * 0.76,
      );
    } else if (pickup.type === "ammo") {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.48, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.62);
      ctx.lineTo(x + size * 0.62, y);
      ctx.lineTo(x, y + size * 0.62);
      ctx.lineTo(x - size * 0.62, y);
      ctx.closePath();
      ctx.fill();
    }

    if (pickup.legendary) {
      ctx.strokeStyle = LEGENDARY_WHITE;
      ctx.lineWidth = Math.max(1, size * 0.12);
      ctx.beginPath();
      ctx.arc(x, y, size * 0.92, 0, Math.PI * 2);
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
        dark: "#9f1239",
        eye: "#fff1f2",
      };
    case "melee":
      return {
        main: "#f97316",
        dark: "#9a3412",
        eye: "#fff7ed",
      };
    default:
      return {
        main: "#f59e0b",
        dark: "#92400e",
        eye: "#fffbeb",
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
    const position = worldToScreen(world, enemy.x, enemy.y);
    const x = position.x;
    const y = position.y;
    const radius = Math.max(
      position.scale * 0.18,
      (enemy.radius ?? 0.22) * position.scale,
    );
    const palette = enemyPalette(enemy.kind);

    ctx.fillStyle = "rgba(2, 6, 23, 0.35)";
    ctx.beginPath();
    ctx.ellipse(
      x,
      y + radius * 1.1,
      radius * 1.15,
      radius * 0.72,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.fillStyle = palette.main;
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(1, radius * 0.16);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = palette.eye;
    ctx.beginPath();
    ctx.arc(
      x - radius * 0.28,
      y - radius * 0.16,
      radius * 0.13,
      0,
      Math.PI * 2,
    );
    ctx.arc(
      x + radius * 0.28,
      y - radius * 0.16,
      radius * 0.13,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(1, radius * 0.1);
    ctx.beginPath();
    ctx.arc(
      x,
      y + radius * 0.08,
      radius * 0.38,
      0.14,
      Math.PI - 0.14,
    );
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

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(world.player.facing);

  ctx.fillStyle = "rgba(2, 6, 23, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.fillRect(-10, -1, 20, 14);

  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(-4, 4, 8, 8);

  ctx.fillStyle = "#f1c27d";
  ctx.beginPath();
  ctx.arc(0, -5, 6.5, 0, Math.PI * 2);
  ctx.fill();

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

  const horizon = CANVAS_HEIGHT * 0.56;

  ctx.fillStyle = "#3d4348";
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.18, CANVAS_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH * 0.38, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.62, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.82, CANVAS_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#70767c";
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH * 0.28, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.38, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.18, CANVAS_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH * 0.72, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.62, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.82, CANVAS_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#facc15";
  ctx.lineCap = "round";

  for (let segment = 0; segment < 8; segment += 1) {
    const start = segment / 8;
    const end = (segment + 0.34) / 8;
    const y1 = horizon + (CANVAS_HEIGHT - horizon) * start;
    const y2 = horizon + (CANVAS_HEIGHT - horizon) * end;
    const lineWidth = 2 + start * 7;

    for (const offset of [-9, 9]) {
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH * 0.5 + offset, y1);
      ctx.lineTo(CANVAS_WIDTH * 0.5 + offset, y2);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "rgba(241, 245, 249, 0.26)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.38, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.2, CANVAS_HEIGHT);
  ctx.moveTo(CANVAS_WIDTH * 0.62, horizon);
  ctx.lineTo(CANVAS_WIDTH * 0.8, CANVAS_HEIGHT);
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

  const horizon = CANVAS_HEIGHT * 0.56;
  const leftWall = [
    [0, CANVAS_HEIGHT],
    [0, CANVAS_HEIGHT * 0.08],
    [CANVAS_WIDTH * 0.38, horizon],
    [CANVAS_WIDTH * 0.18, CANVAS_HEIGHT],
  ];
  const rightWall = [
    [CANVAS_WIDTH, CANVAS_HEIGHT],
    [CANVAS_WIDTH, CANVAS_HEIGHT * 0.08],
    [CANVAS_WIDTH * 0.62, horizon],
    [CANVAS_WIDTH * 0.82, CANVAS_HEIGHT],
  ];

  for (const polygon of [leftWall, rightWall]) {
    ctx.fillStyle = "rgba(17, 24, 39, 0.24)";
    ctx.beginPath();
    ctx.moveTo(polygon[0][0], polygon[0][1]);
    for (let index = 1; index < polygon.length; index += 1) {
      ctx.lineTo(polygon[index][0], polygon[index][1]);
    }
    ctx.closePath();
    ctx.fill();
  }

  const drawWindows = (startX, direction) => {
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const x = startX + direction * (col * 28 + row * 2);
        const y = 96 + row * 30 + col * 4;
        const lit = citySeed(row, col, direction > 0 ? 41 : 42) > 0.72;

        ctx.fillStyle = lit
          ? "rgba(250, 204, 21, 0.28)"
          : "rgba(226, 232, 240, 0.12)";
        ctx.fillRect(x, y, 10, 14);
      }
    }
  };

  drawWindows(20, 1);
  drawWindows(CANVAS_WIDTH - 30, -1);

  const skylineBase = CANVAS_HEIGHT * 0.32;
  ctx.fillStyle = "rgba(30, 41, 59, 0.6)";
  ctx.beginPath();
  ctx.moveTo(0, skylineBase + 40);
  for (let x = 0; x <= CANVAS_WIDTH + 24; x += 24) {
    const seed = citySeed(x, 0, 44);
    const height = 36 + seed * 110;
    ctx.lineTo(x, skylineBase + 40);
    ctx.lineTo(x, skylineBase - height);
    ctx.lineTo(x + 12, skylineBase - height + seed * 10);
  }
  ctx.lineTo(CANVAS_WIDTH, skylineBase + 40);
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
    fog.addColorStop(0, "rgba(203, 213, 225, 0.06)");
    fog.addColorStop(0.45, "rgba(226, 232, 240, 0.12)");
    fog.addColorStop(0.85, "rgba(148, 163, 184, 0.08)");
    fog.addColorStop(1, "rgba(100, 116, 139, 0.04)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    for (let index = 0; index < 8; index += 1) {
      const x =
        (
          index * 149 +
          world.time * (10 + index)
        ) %
          (CANVAS_WIDTH + 380) -
        190;
      const y =
        80 +
        ((index * 91) % (CANVAS_HEIGHT - 150));

      ctx.fillStyle = "rgba(226, 232, 240, 0.045)";
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        210,
        38,
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
    CANVAS_WIDTH * 0.2,
    CANVAS_HEIGHT * 0.75,
    CANVAS_WIDTH * 0.31,
    CANVAS_HEIGHT * 0.83,
  );
  ctx.lineTo(CANVAS_WIDTH * 0.36, bottom);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(CANVAS_WIDTH * 0.86, bottom);
  ctx.quadraticCurveTo(
    CANVAS_WIDTH * 0.8,
    CANVAS_HEIGHT * 0.75,
    CANVAS_WIDTH * 0.69,
    CANVAS_HEIGHT * 0.83,
  );
  ctx.lineTo(CANVAS_WIDTH * 0.64, bottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(241, 194, 125, 0.94)";
  ctx.beginPath();
  ctx.ellipse(
    CANVAS_WIDTH * 0.34,
    CANVAS_HEIGHT * 0.84,
    20,
    14,
    0.3,
    0,
    Math.PI * 2,
  );
  ctx.ellipse(
    CANVAS_WIDTH * 0.66,
    CANVAS_HEIGHT * 0.84,
    20,
    14,
    -0.3,
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
