// src/game/rendering-enhanced.js
import {
  DRAW_TILE,
} from "../config/constants.js";
import {
  isRobbienatorWeapon,
} from "../config/robbienator.js";
import {
  getCamera,
} from "./gameplay.js";
import {
  drawWorld as drawWorldCore,
} from "./rendering.js?core";

export * from "./rendering.js?core";

function drawBanana(
  ctx,
  size,
  {
    x = 0,
    y = 0,
    angle = 0,
  } = {},
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const gradient = ctx.createLinearGradient(
    -size * 0.55,
    -size * 0.25,
    size * 0.65,
    size * 0.25,
  );
  gradient.addColorStop(0, "#ca8a04");
  gradient.addColorStop(0.18, "#fde047");
  gradient.addColorStop(0.58, "#facc15");
  gradient.addColorStop(1, "#eab308");

  ctx.shadowBlur = size * 0.17;
  ctx.shadowColor =
    "rgba(250, 204, 21, 0.5)";
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "#713f12";
  ctx.lineWidth = Math.max(
    2,
    size * 0.045,
  );

  ctx.beginPath();
  ctx.moveTo(
    -size * 0.55,
    -size * 0.2,
  );
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

  ctx.shadowBlur = 0;

  ctx.fillStyle = "#713f12";
  ctx.beginPath();
  ctx.ellipse(
    -size * 0.5,
    -size * 0.27,
    size * 0.08,
    size * 0.045,
    -0.2,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(
    size * 0.62,
    -size * 0.16,
    size * 0.075,
    size * 0.042,
    0.15,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  const faceX = size * 0.12;
  const faceY = size * 0.01;
  ctx.fillStyle = "#422006";

  for (
    const eyeX of [
      faceX - size * 0.09,
      faceX + size * 0.09,
    ]
  ) {
    ctx.beginPath();
    ctx.arc(
      eyeX,
      faceY - size * 0.1,
      Math.max(2, size * 0.034),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.strokeStyle = "#422006";
  ctx.lineWidth = Math.max(
    2,
    size * 0.03,
  );
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(
    faceX,
    faceY - size * 0.01,
    size * 0.13,
    0.18,
    Math.PI - 0.18,
  );
  ctx.stroke();

  ctx.restore();
}

function draw2DRobbienator(ctx, world) {
  const camera = getCamera(world);
  const playerX =
    (world.player.x - camera.x) * DRAW_TILE;
  const playerY =
    (world.player.y - camera.y) * DRAW_TILE;
  const reach = 18;
  const x =
    playerX +
    Math.cos(world.player.facing) * reach;
  const y =
    playerY +
    Math.sin(world.player.facing) * reach;

  drawBanana(ctx, 34, {
    x,
    y,
    angle: world.player.facing - 0.12,
  });
}

function draw3DRobbienator(ctx, world) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const recoil =
    Math.max(
      0,
      Number(world.weaponKick) || 0,
    ) * 8;

  ctx.save();

  const cover = ctx.createLinearGradient(
    0,
    height * 0.73,
    0,
    height,
  );
  cover.addColorStop(
    0,
    "rgba(2,6,23,0)",
  );
  cover.addColorStop(
    0.55,
    "rgba(2,6,23,0.72)",
  );
  cover.addColorStop(
    1,
    "rgba(2,6,23,0.9)",
  );
  ctx.fillStyle = cover;
  ctx.fillRect(
    width * 0.28,
    height * 0.72,
    width * 0.44,
    height * 0.28,
  );

  drawBanana(ctx, 215, {
    x: width * 0.5,
    y: height - 46 - recoil,
    angle: -0.16,
  });

  ctx.fillStyle = "#fde68a";
  ctx.font =
    "900 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.shadowBlur = 10;
  ctx.shadowColor =
    "rgba(250,204,21,0.65)";
  ctx.fillText(
    "ROBBIENATOR",
    width * 0.5,
    height - 11,
  );

  ctx.restore();
}

export function drawWorld(ctx, world) {
  drawWorldCore(ctx, world);

  if (
    !isRobbienatorWeapon(
      world,
      world.player?.weapon,
    )
  ) {
    return;
  }

  if (world.viewMode === "3d") {
    draw3DRobbienator(ctx, world);
    return;
  }

  draw2DRobbienator(ctx, world);
}
