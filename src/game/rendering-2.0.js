// src/game/rendering-2.0.js
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DRAW_TILE,
  VIEW_3D_FOV,
} from "../config/constants-enhanced.js";
import {
  ENEMY_PURSUIT_MAX_SPEED_MULTIPLIER,
  ENEMY_PURSUIT_RAMP_SECONDS,
} from "../config/enemies.js";
import {
  getCamera,
  getWorldRenderZoom,
  visibleStrengthAt,
} from "./gameplay-2.0.js";
import { getDiscoveredPercent } from "./maze.js";
import {
  drawWorld as drawCityConformWorld,
  project3DSprite,
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


function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function getEnemyPursuitVisualState(world, enemy) {
  if (
    !enemy.awake ||
    !Number.isFinite(enemy.pursuitStartedAt)
  ) {
    return null;
  }

  const elapsed = Math.max(
    0,
    (world.time ?? 0) - enemy.pursuitStartedAt,
  );
  const progress = clamp01(
    elapsed / ENEMY_PURSUIT_RAMP_SECONDS,
  );
  const multiplier =
    1 +
    (
      ENEMY_PURSUIT_MAX_SPEED_MULTIPLIER - 1
    ) *
      progress;

  return {
    elapsed,
    progress,
    multiplier,
  };
}

function getPursuitColor(progress) {
  const red = Math.round(245 + 10 * progress);
  const green = Math.round(158 - 105 * progress);
  const blue = Math.round(11 - 2 * progress);

  return `rgb(${red}, ${green}, ${blue})`;
}

function drawPursuitVisuals2D(ctx, world) {
  const camera = getCamera(world);
  const scale =
    DRAW_TILE * getWorldRenderZoom(world);

  for (const enemy of world.enemies ?? []) {
    const state =
      getEnemyPursuitVisualState(world, enemy);

    if (!state || enemy.hp <= 0) {
      continue;
    }

    const tileX = Math.floor(enemy.x);
    const tileY = Math.floor(enemy.y);

    if (
      visibleStrengthAt(
        world,
        tileX,
        tileY,
      ) <= 0.12
    ) {
      continue;
    }

    const x =
      (enemy.x - camera.x) * scale;
    const y =
      (enemy.y - camera.y) * scale;
    const radius =
      Math.max(
        8,
        enemy.radius * scale,
      );
    const color =
      getPursuitColor(state.progress);
    const late =
      clamp01(
        (state.progress - 0.45) / 0.55,
      );
    const pulse =
      0.5 +
      0.5 *
        Math.sin(
          (world.time ?? 0) *
            (5 + state.progress * 5) +
            enemy.x * 1.7,
        );

    ctx.save();

    if (state.progress > 0.22) {
      const playerDx =
        world.player.x - enemy.x;
      const playerDy =
        world.player.y - enemy.y;
      const length =
        Math.max(
          0.001,
          Math.hypot(playerDx, playerDy),
        );
      const trailLength =
        radius *
        (
          0.35 +
          state.progress * 1.35
        );

      ctx.globalAlpha =
        0.08 +
        late * 0.22;
      ctx.strokeStyle = color;
      ctx.lineWidth =
        Math.max(
          2,
          radius *
            (
              0.1 +
              state.progress * 0.06
            ),
        );
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(
        x -
          (playerDx / length) *
            radius *
            0.25,
        y -
          (playerDy / length) *
            radius *
            0.25,
      );
      ctx.lineTo(
        x -
          (playerDx / length) *
            trailLength,
        y -
          (playerDy / length) *
            trailLength,
      );
      ctx.stroke();
    }

    ctx.globalCompositeOperation =
      "lighter";
    ctx.shadowColor = color;
    ctx.shadowBlur =
      5 + state.progress * 18;

    ctx.globalAlpha =
      0.1 +
      state.progress * 0.28 +
      pulse * late * 0.1;
    ctx.strokeStyle = color;
    ctx.lineWidth =
      1.2 + state.progress * 2.4;
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      radius *
        (
          1.08 +
          pulse * 0.08 * late
        ),
      0,
      Math.PI * 2,
    );
    ctx.stroke();

    const eyeOffset =
      radius * 0.26;
    const eyeY =
      y - radius * 0.12;
    const eyeRadius =
      Math.max(
        1.5,
        radius *
          (
            0.07 +
            state.progress * 0.035
          ),
      );

    ctx.globalAlpha =
      0.35 +
      state.progress * 0.65;
    ctx.fillStyle = color;

    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(
        x + side * eyeOffset,
        eyeY,
        eyeRadius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawPursuitVisuals3D(ctx, world) {
  const projectionPlane =
    CANVAS_WIDTH /
    2 /
    Math.tan(VIEW_3D_FOV / 2);

  for (const enemy of world.enemies ?? []) {
    const state =
      getEnemyPursuitVisualState(world, enemy);

    if (!state || enemy.hp <= 0) {
      continue;
    }

    const projection =
      project3DSprite(
        world,
        enemy.x,
        enemy.y,
        projectionPlane,
      );

    if (!projection) {
      continue;
    }

    const distance =
      Math.hypot(
        enemy.x - world.player.x,
        enemy.y - world.player.y,
      );

    if (distance > 10) {
      continue;
    }

    const bodyHeight =
      Math.max(
        26,
        Math.min(
          CANVAS_HEIGHT * 0.95,
          projection.scale *
            (
              enemy.radius * 2.35 +
              0.42
            ),
        ),
      );
    const centerY =
      CANVAS_HEIGHT * 0.46 -
      bodyHeight * 0.05;
    const color =
      getPursuitColor(state.progress);
    const late =
      clamp01(
        (state.progress - 0.45) / 0.55,
      );
    const pulse =
      0.5 +
      0.5 *
        Math.sin(
          (world.time ?? 0) *
            (5 + state.progress * 5),
        );
    const radius =
      Math.max(
        10,
        bodyHeight * 0.28,
      );

    ctx.save();
    ctx.globalCompositeOperation =
      "lighter";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur =
      7 + state.progress * 22;

    ctx.globalAlpha =
      0.06 +
      state.progress * 0.2 +
      pulse * late * 0.08;
    ctx.lineWidth =
      1.2 + state.progress * 2.6;
    ctx.beginPath();
    ctx.ellipse(
      projection.screenX,
      centerY,
      radius *
        (
          1.05 +
          pulse * late * 0.09
        ),
      radius * 1.22,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();

    const eyeY =
      centerY - bodyHeight * 0.07;
    const eyeOffset =
      radius * 0.28;
    const eyeRadius =
      Math.max(
        1.5,
        bodyHeight *
          (
            0.018 +
            state.progress * 0.009
          ),
      );

    ctx.globalAlpha =
      0.28 +
      state.progress * 0.7;

    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(
        projection.screenX +
          side * eyeOffset,
        eyeY,
        eyeRadius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawEnemyPursuitVisuals(ctx, world) {
  if (world.viewMode === "3d") {
    drawPursuitVisuals3D(ctx, world);
    return;
  }

  drawPursuitVisuals2D(ctx, world);
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
  drawEnemyPursuitVisuals(ctx, world);
  drawAnimatedPickupEffects(ctx, world);
  drawCinematicParticles(ctx, world);
  drawEnemyHitReactions(ctx, world);

  ctx.restore();

  drawRunEscalationOverlay(ctx, world);
  drawResultOverlay(ctx, world);
}
