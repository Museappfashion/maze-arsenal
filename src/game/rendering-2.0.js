// src/game/rendering-2.0.js
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DRAW_TILE,
} from "../config/constants-enhanced.js";
import {
  getCamera,
  getWorldRenderZoom,
  visibleStrengthAt,
} from "./gameplay-2.0.js";
import { getDiscoveredPercent } from "./maze.js";
import {
  drawWorld as drawCityConformWorld,
} from "./rendering-city-conform.js";

export * from "./rendering-city-conform.js";

const PHASE_OVERLAYS = [
  {
    vignette: 0,
    pulse: 0,
  },
  {
    vignette: 0.06,
    pulse: 0.01,
  },
  {
    vignette: 0.12,
    pulse: 0.025,
  },
  {
    vignette: 0.2,
    pulse: 0.045,
  },
];

function getWorldScreenPosition(world, x, y) {
  const camera = getCamera(world);
  const scale =
    DRAW_TILE * getWorldRenderZoom(world);

  return {
    x: (x - camera.x) * scale,
    y: (y - camera.y) * scale,
    scale,
  };
}

function pickupColor(pickup) {
  if (pickup.legendary) {
    return "#facc15";
  }

  if (
    pickup.type === "health" ||
    pickup.type === "medkit"
  ) {
    return "#22c55e";
  }

  if (pickup.type === "ammo") {
    return "#38bdf8";
  }

  if (pickup.type === "powerup") {
    return pickup.color ?? "#c084fc";
  }

  if (pickup.type === "weapon") {
    return "#fb923c";
  }

  return "#e2e8f0";
}

function drawAnimatedPickupEffects(ctx, world) {
  if (world.viewMode === "3d") {
    return;
  }

  const time = world.time ?? 0;

  for (const pickup of world.pickups ?? []) {
    const tileX = Math.floor(pickup.x);
    const tileY = Math.floor(pickup.y);

    if (
      visibleStrengthAt(
        world,
        tileX,
        tileY,
      ) <= 0.18
    ) {
      continue;
    }

    const screen = getWorldScreenPosition(
      world,
      pickup.x,
      pickup.y,
    );
    const color = pickupColor(pickup);
    const pulse =
      0.5 +
      0.5 *
        Math.sin(
          time * 4.2 +
            pickup.x * 1.7 +
            pickup.y * 1.3,
        );
    const radius =
      screen.scale *
      (pickup.legendary
        ? 0.44 + pulse * 0.1
        : 0.3 + pulse * 0.06);

    ctx.save();
    ctx.translate(
      screen.x,
      screen.y +
        Math.sin(time * 3 + pickup.x) *
          screen.scale *
          0.045,
    );

    const glow = ctx.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      radius * 1.55,
    );

    glow.addColorStop(
      0,
      pickup.legendary
        ? "rgba(255,255,255,0.24)"
        : "rgba(255,255,255,0.12)",
    );
    glow.addColorStop(
      0.28,
      color,
    );
    glow.addColorStop(
      1,
      "rgba(0,0,0,0)",
    );

    ctx.globalAlpha =
      pickup.legendary ? 0.42 : 0.2;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      radius * 1.55,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.globalAlpha =
      pickup.legendary ? 0.95 : 0.62;
    ctx.strokeStyle = color;
    ctx.lineWidth =
      Math.max(
        1.4,
        screen.scale * 0.025,
      );
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      radius,
      time * 1.4,
      time * 1.4 + Math.PI * 1.55,
    );
    ctx.stroke();

    if (pickup.legendary) {
      for (let index = 0; index < 4; index += 1) {
        const angle =
          time * 1.6 +
          index * (Math.PI / 2);
        const orbitRadius =
          radius * 1.18;

        ctx.fillStyle = "#fff7cc";
        ctx.beginPath();
        ctx.arc(
          Math.cos(angle) * orbitRadius,
          Math.sin(angle) * orbitRadius,
          Math.max(1.5, screen.scale * 0.03),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

function drawCinematicParticles(ctx, world) {
  if (world.viewMode === "3d") {
    return;
  }

  for (
    const particle of
    world.__cinematic?.particles ?? []
  ) {
    const screen = getWorldScreenPosition(
      world,
      particle.x,
      particle.y,
    );
    const progress =
      particle.life /
      Math.max(0.001, particle.maxLife);

    ctx.save();
    ctx.globalAlpha =
      Math.max(0, Math.min(1, progress));
    ctx.fillStyle = particle.color;

    if (
      particle.kind === "wallImpact"
    ) {
      ctx.translate(screen.x, screen.y);
      ctx.rotate(
        Math.atan2(
          particle.vy,
          particle.vx,
        ),
      );
      ctx.fillRect(
        -screen.scale *
          particle.size *
          1.8,
        -screen.scale *
          particle.size *
          0.35,
        screen.scale *
          particle.size *
          3.6,
        screen.scale *
          particle.size *
          0.7,
      );
    } else {
      ctx.beginPath();
      ctx.arc(
        screen.x,
        screen.y,
        Math.max(
          1,
          screen.scale *
            particle.size *
            (0.65 + progress * 0.65),
        ),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawEnemyHitReactions(ctx, world) {
  if (world.viewMode === "3d") {
    return;
  }

  for (
    const reaction of
    world.__cinematic?.hitReactions ?? []
  ) {
    const screen = getWorldScreenPosition(
      world,
      reaction.x,
      reaction.y,
    );
    const progress =
      reaction.life /
      Math.max(0.001, reaction.maxLife);
    const radius =
      screen.scale *
      reaction.radius *
      (reaction.dead
        ? 1.8 - progress * 0.4
        : 1.3);

    ctx.save();
    ctx.globalAlpha =
      Math.min(
        0.9,
        progress *
          (reaction.dead ? 0.85 : 0.55),
      );
    ctx.strokeStyle =
      reaction.dead
        ? "#fecaca"
        : "#ffffff";
    ctx.lineWidth =
      reaction.dead ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(
      screen.x,
      screen.y,
      radius,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
  }
}

function drawRunEscalationOverlay(ctx, world) {
  const cinematic = world.__cinematic;

  if (!cinematic || world.labyrinthMode) {
    return;
  }

  const phaseIndex =
    Math.max(
      0,
      Math.min(
        PHASE_OVERLAYS.length - 1,
        cinematic.phaseIndex ?? 0,
      ),
    );
  const phase =
    PHASE_OVERLAYS[phaseIndex];

  if (phase.vignette > 0) {
    const vignette =
      ctx.createRadialGradient(
        CANVAS_WIDTH * 0.5,
        CANVAS_HEIGHT * 0.5,
        CANVAS_HEIGHT * 0.2,
        CANVAS_WIDTH * 0.5,
        CANVAS_HEIGHT * 0.5,
        CANVAS_WIDTH * 0.68,
      );

    vignette.addColorStop(
      0,
      "rgba(0,0,0,0)",
    );
    vignette.addColorStop(
      1,
      `rgba(14, 5, 10, ${phase.vignette})`,
    );
    ctx.fillStyle = vignette;
    ctx.fillRect(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
  }

  if (phase.pulse > 0) {
    const pulse =
      0.45 +
      0.55 *
        Math.max(
          0,
          Math.sin((world.time ?? 0) * 3.1),
        );

    ctx.fillStyle =
      `rgba(127, 29, 29, ${phase.pulse * pulse})`;
    ctx.fillRect(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
  }

  if (cinematic.damageFlash > 0) {
    const alpha =
      Math.min(
        0.18,
        cinematic.damageFlash * 0.62,
      );
    const damage =
      ctx.createRadialGradient(
        CANVAS_WIDTH * 0.5,
        CANVAS_HEIGHT * 0.5,
        CANVAS_HEIGHT * 0.25,
        CANVAS_WIDTH * 0.5,
        CANVAS_HEIGHT * 0.5,
        CANVAS_WIDTH * 0.72,
      );

    damage.addColorStop(
      0,
      "rgba(127,29,29,0)",
    );
    damage.addColorStop(
      1,
      `rgba(185,28,28,${alpha})`,
    );

    ctx.fillStyle = damage;
    ctx.fillRect(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
  }

  if (cinematic.phaseTransitionTtl > 0) {
    const alpha =
      Math.min(
        1,
        cinematic.phaseTransitionTtl / 0.55,
      );

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = "#f8fafc";
    ctx.font =
      "800 23px system-ui, sans-serif";
    ctx.fillText(
      cinematic.phaseLabel,
      CANVAS_WIDTH * 0.5,
      58,
    );
    ctx.fillStyle =
      "rgba(226,232,240,0.8)";
    ctx.font =
      "600 11px system-ui, sans-serif";
    ctx.fillText(
      `${getDiscoveredPercent(world)}% explored`,
      CANVAS_WIDTH * 0.5,
      78,
    );
    ctx.restore();
  }
}

function drawResultOverlay(ctx, world) {
  if (
    !world.victory &&
    !world.gameOver
  ) {
    return;
  }

  const explored = getDiscoveredPercent(world);
  const enemiesDefeated =
    world.__cinematic?.enemiesDefeated ?? 0;
  const centerX = CANVAS_WIDTH * 0.5;
  const titleY = CANVAS_HEIGHT * 0.31;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.shadowColor = "rgba(0, 0, 0, 0.72)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 28px system-ui, sans-serif";
  ctx.fillText("MAZE ENDED", centerX, titleY);

  ctx.shadowBlur = 5;
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.fillText(
    `${explored}% explored`,
    centerX,
    titleY + 34,
  );
  ctx.fillText(
    `${enemiesDefeated} enemies defeated`,
    centerX,
    titleY + 57,
  );

  ctx.restore();
}

export function drawWorld(ctx, world) {
  const cinematic =
    world.__cinematic ?? {};
  const shake =
    cinematic.shake ?? 0;
  const phase =
    (world.time ?? 0) * 41.3;
  const shakeX =
    Math.sin(phase) * shake;
  const shakeY =
    Math.cos(phase * 1.27) *
    shake *
    0.72;
  const kick =
    cinematic.recoilKick ?? 0;
  const roll =
    cinematic.recoilRoll ?? 0;

  ctx.save();
  ctx.translate(
    CANVAS_WIDTH * 0.5 +
      shakeX,
    CANVAS_HEIGHT * 0.5 +
      shakeY +
      kick * 0.42,
  );
  ctx.rotate(roll);
  ctx.translate(
    -CANVAS_WIDTH * 0.5,
    -CANVAS_HEIGHT * 0.5,
  );

  drawCityConformWorld(ctx, world);
  drawAnimatedPickupEffects(ctx, world);
  drawCinematicParticles(ctx, world);
  drawEnemyHitReactions(ctx, world);

  ctx.restore();

  drawRunEscalationOverlay(ctx, world);
  drawResultOverlay(ctx, world);
}
