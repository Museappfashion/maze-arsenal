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

function drawCityBuildings2D(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode === "3d"
  ) {
    return;
  }

  const camera = getCamera(world);
  const zoom = getWorldRenderZoom(world);
  const scale = DRAW_TILE * zoom;
  const minX = Math.max(0, Math.floor(camera.x) - 1);
  const minY = Math.max(0, Math.floor(camera.y) - 1);
  const maxX = Math.min(
    world.width - 1,
    Math.ceil(camera.x + CANVAS_WIDTH / scale) + 1,
  );
  const maxY = Math.min(
    world.height - 1,
    Math.ceil(camera.y + CANVAS_HEIGHT / scale) + 1,
  );

  ctx.save();

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (world.grid[y][x] === FLOOR) {
        continue;
      }

      const sx = (x - camera.x) * scale;
      const sy = (y - camera.y) * scale;
      const seed = (x * 17 + y * 31) % 7;

      ctx.strokeStyle = "rgba(226,232,240,.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        sx + 2,
        sy + 2,
        scale - 4,
        scale - 4,
      );

      if (seed % 2 === 0) {
        ctx.fillStyle =
          seed % 4 === 0
            ? "rgba(250,204,21,.22)"
            : "rgba(148,163,184,.16)";

        ctx.fillRect(
          sx + scale * 0.2,
          sy + scale * 0.25,
          scale * 0.18,
          scale * 0.2,
        );
        ctx.fillRect(
          sx + scale * 0.62,
          sy + scale * 0.25,
          scale * 0.18,
          scale * 0.2,
        );
      }
    }
  }

  ctx.restore();
}

function drawCityFacade3D(ctx, world) {
  if (
    world.level?.themeKey !== "city" ||
    world.viewMode !== "3d"
  ) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.16;

  for (let x = 18; x < CANVAS_WIDTH; x += 36) {
    const perspective =
      Math.abs(x - CANVAS_WIDTH / 2) /
      (CANVAS_WIDTH / 2);
    const top =
      110 + perspective * 90;
    const bottom =
      CANVAS_HEIGHT - 120 - perspective * 35;

    for (let y = top; y < bottom; y += 42) {
      const lit =
        ((x * 3 + y * 5) % 11) < 4;

      ctx.fillStyle = lit
        ? "rgba(250,204,21,.48)"
        : "rgba(203,213,225,.2)";

      ctx.fillRect(
        x,
        y,
        9,
        15,
      );
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
    fog.addColorStop(0, "rgba(150,154,158,.12)");
    fog.addColorStop(0.5, "rgba(165,169,173,.19)");
    fog.addColorStop(1, "rgba(105,109,113,.12)");
    ctx.fillStyle = fog;
    ctx.fillRect(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    ctx.restore();
    return;
  }

  for (let index = 0; index < 9; index += 1) {
    const x =
      (
        index * 137 +
        world.time * (12 + index)
      ) %
        (CANVAS_WIDTH + 260) -
      130;
    const y =
      80 +
      ((index * 91) % (CANVAS_HEIGHT - 160));

    ctx.fillStyle = "rgba(180,184,188,.055)";
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      150,
      52,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

export function drawWorld(ctx, world) {
  drawWorldCore(ctx, world);
  drawCityBuildings2D(ctx, world);
  drawCityFacade3D(ctx, world);
  drawUrbanFog(ctx, world);

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
