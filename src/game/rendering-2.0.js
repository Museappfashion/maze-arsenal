// src/game/rendering-2.0.js
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DRAW_TILE,
  FLOOR,
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
    if (
      pickup.type === "ammo" ||
      pickup.type === "medkit" ||
      pickup.type === "health"
    ) {
      continue;
    }

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

function drawVictoryCelebration(ctx, world) {
  const centerX = CANVAS_WIDTH * 0.5;
  const centerY = CANVAS_HEIGHT * 0.31;
  const time =
    typeof performance !== "undefined"
      ? performance.now() / 1000
      : 0;
  const explored = getDiscoveredPercent(world);
  const enemiesDefeated =
    world.__cinematic?.enemiesDefeated ?? 0;

  ctx.save();

  const wash = ctx.createRadialGradient(
    centerX,
    centerY,
    20,
    centerX,
    centerY,
    CANVAS_HEIGHT * 0.7,
  );
  wash.addColorStop(
    0,
    "rgba(250,204,21,0.16)",
  );
  wash.addColorStop(
    0.38,
    "rgba(34,211,238,0.08)",
  );
  wash.addColorStop(
    1,
    "rgba(2,6,23,0.54)",
  );
  ctx.fillStyle = wash;
  ctx.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );

  ctx.save();
  ctx.translate(centerX, centerY - 8);
  ctx.rotate(time * 0.08);
  ctx.globalCompositeOperation = "lighter";

  for (let ray = 0; ray < 24; ray += 1) {
    const angle =
      ray * (Math.PI * 2 / 24);
    const inner = 82;
    const outer =
      165 +
      18 *
        Math.sin(
          time * 2.1 + ray * 0.73,
        );

    ctx.globalAlpha =
      0.035 +
      0.035 *
        (
          0.5 +
          0.5 *
            Math.sin(
              time * 2.8 + ray,
            )
        );
    ctx.strokeStyle =
      ray % 2 === 0
        ? "#fde047"
        : "#67e8f9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(angle) * inner,
      Math.sin(angle) * inner,
    );
    ctx.lineTo(
      Math.cos(angle) * outer,
      Math.sin(angle) * outer,
    );
    ctx.stroke();
  }

  ctx.restore();

  for (let index = 0; index < 72; index += 1) {
    const seedX = fxNoise(index, 201);
    const seedY = fxNoise(index, 202);
    const speed =
      42 + fxNoise(index, 203) * 78;
    const drift =
      (
        seedY * CANVAS_HEIGHT +
        time * speed
      ) %
      (CANVAS_HEIGHT + 70);
    const x =
      (
        seedX * CANVAS_WIDTH +
        Math.sin(
          time *
            (
              0.7 +
              fxNoise(index, 204)
            ) +
            index,
        ) *
          18
      );
    const y = drift - 35;
    const size =
      3 + fxNoise(index, 205) * 5;
    const rotation =
      time *
        (
          1.2 +
          fxNoise(index, 206) * 4
        ) +
      index;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha =
      0.42 +
      fxNoise(index, 207) * 0.42;
    ctx.fillStyle =
      index % 4 === 0
        ? "#fde047"
        : index % 4 === 1
          ? "#67e8f9"
          : index % 4 === 2
            ? "#f8fafc"
            : "#f59e0b";
    ctx.fillRect(
      -size * 0.5,
      -size * 0.25,
      size,
      size * 0.5,
    );
    ctx.restore();
  }

  const pulse =
    0.5 +
    0.5 *
      Math.sin(time * 3.2);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.shadowColor =
    "rgba(250,204,21,0.68)";
  ctx.shadowBlur =
    18 + pulse * 12;
  ctx.fillStyle = "#fff7cc";
  ctx.font =
    "950 42px system-ui, sans-serif";
  ctx.fillText(
    "LEVEL COMPLETE!",
    centerX,
    centerY - 22,
  );

  ctx.shadowColor =
    "rgba(34,211,238,0.5)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#a5f3fc";
  ctx.font =
    "850 18px system-ui, sans-serif";
  ctx.fillText(
    world.level?.subtitle ??
      world.level?.label ??
      "Maze cleared",
    centerX,
    centerY + 22,
  );

  ctx.shadowBlur = 5;
  ctx.fillStyle = "#f8fafc";
  ctx.font =
    "800 16px system-ui, sans-serif";
  ctx.fillText(
    `${explored}% explored`,
    centerX,
    centerY + 58,
  );
  ctx.fillText(
    `${enemiesDefeated} enemies defeated`,
    centerX,
    centerY + 82,
  );

  ctx.fillStyle =
    "rgba(226,232,240,0.86)";
  ctx.font =
    "750 12px system-ui, sans-serif";
  ctx.fillText(
    "EXIT SECURED",
    centerX,
    centerY + 112,
  );

  ctx.restore();
}

function drawResultOverlay(ctx, world) {
  if (
    !world.victory &&
    !world.gameOver
  ) {
    return;
  }

  if (world.victory) {
    drawVictoryCelebration(ctx, world);
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
    const pulse =
      0.5 +
      0.5 *
        Math.sin(
          (world.time ?? 0) *
            (4 + state.progress * 4) +
            enemy.x * 1.7,
        );

    ctx.save();

    /*
     * Keep the ramp visual on the enemy itself.
     * The overlay stays inside the normal body radius,
     * so it cannot read as an external aura or halo.
     */
    ctx.globalAlpha =
      0.04 +
      state.progress * 0.28 +
      pulse * state.progress * 0.05;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      radius * 0.72,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    const eyeOffset =
      radius * 0.24;
    const eyeY =
      y - radius * 0.12;
    const eyeRadius =
      Math.max(
        1.25,
        radius *
          (
            0.055 +
            state.progress * 0.035
          ),
      );

    ctx.globalAlpha =
      0.3 +
      state.progress * 0.7;
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

    if (state.progress >= 0.65) {
      const stripeAlpha =
        (state.progress - 0.65) /
        0.35;

      ctx.globalAlpha =
        0.12 +
        stripeAlpha * 0.26;
      ctx.strokeStyle = color;
      ctx.lineWidth =
        Math.max(
          1,
          radius * 0.055,
        );
      ctx.lineCap = "round";

      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(
          x + side * radius * 0.18,
          y - radius * 0.48,
        );
        ctx.lineTo(
          x + side * radius * 0.3,
          y + radius * 0.44,
        );
        ctx.stroke();
      }
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
    const bodyWidth =
      bodyHeight *
      (
        enemy.kind === "warden"
          ? 0.72
          : enemy.kind === "brute"
            ? 0.66
            : 0.56
      );
    const centerX =
      projection.screenX;
    const centerY =
      CANVAS_HEIGHT * 0.46 -
      bodyHeight * 0.05;
    const color =
      getPursuitColor(state.progress);
    const pulse =
      0.5 +
      0.5 *
        Math.sin(
          (world.time ?? 0) *
            (4 + state.progress * 4),
        );

    ctx.save();

    /*
     * Tint only the inner projected enemy body.
     * No shadowBlur, outer ellipse, aura, or pursuit halo.
     */
    ctx.globalAlpha =
      0.035 +
      state.progress * 0.23 +
      pulse * state.progress * 0.045;
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.ellipse(
      centerX,
      centerY,
      bodyWidth * 0.28,
      bodyHeight * 0.33,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    const eyeY =
      centerY - bodyHeight * 0.075;
    const eyeOffset =
      bodyWidth * 0.13;
    const eyeRadius =
      Math.max(
        1.4,
        bodyHeight *
          (
            0.014 +
            state.progress * 0.009
          ),
      );

    ctx.globalAlpha =
      0.28 +
      state.progress * 0.72;
    ctx.fillStyle = color;

    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(
        centerX + side * eyeOffset,
        eyeY,
        eyeRadius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    if (state.progress >= 0.65) {
      const stripeAlpha =
        (state.progress - 0.65) /
        0.35;

      ctx.globalAlpha =
        0.1 +
        stripeAlpha * 0.22;
      ctx.strokeStyle = color;
      ctx.lineWidth =
        Math.max(
          1,
          bodyWidth * 0.035,
        );
      ctx.lineCap = "round";

      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(
          centerX +
            side * bodyWidth * 0.12,
          centerY - bodyHeight * 0.25,
        );
        ctx.lineTo(
          centerX +
            side * bodyWidth * 0.18,
          centerY + bodyHeight * 0.24,
        );
        ctx.stroke();
      }
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


const WORLD_IDENTITY_KEYS = new Set([
  "space",
  "jungle",
  "medieval",
]);

function fxNoise(a, b = 0, c = 0) {
  const value =
    Math.sin(
      a * 127.1 +
      b * 311.7 +
      c * 74.7,
    ) * 43758.5453123;

  return value - Math.floor(value);
}

function fxVisibleBounds(world) {
  const camera = getCamera(world);
  const scale =
    DRAW_TILE * getWorldRenderZoom(world);

  return {
    camera,
    scale,
    minX: Math.max(
      0,
      Math.floor(camera.x) - 1,
    ),
    minY: Math.max(
      0,
      Math.floor(camera.y) - 1,
    ),
    maxX: Math.min(
      world.width - 1,
      Math.ceil(
        camera.x +
          CANVAS_WIDTH / scale,
      ) + 1,
    ),
    maxY: Math.min(
      world.height - 1,
      Math.ceil(
        camera.y +
          CANVAS_HEIGHT / scale,
      ) + 1,
    ),
  };
}

function fxTileIsFloor(world, x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < world.width &&
    y < world.height &&
    world.grid?.[y]?.[x] === FLOOR
  );
}

function fxTileVisible(world, x, y) {
  return (
    visibleStrengthAt(world, x, y) >
    0.1
  );
}

function drawOrbitalStarfield(ctx, world) {
  const time = world.time ?? 0;
  const px = world.player.x ?? 0;
  const py = world.player.y ?? 0;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let index = 0; index < 88; index += 1) {
    const depth =
      0.28 + fxNoise(index, 4) * 0.72;
    const x =
      (
        fxNoise(index, 1) *
          (CANVAS_WIDTH + 140) -
        px * depth * 5 +
        time * depth * 1.2
      ) %
      (CANVAS_WIDTH + 140);
    const y =
      (
        fxNoise(index, 2) *
          (CANVAS_HEIGHT + 100) -
        py * depth * 3
      ) %
      (CANVAS_HEIGHT + 100);
    const screenX =
      (x + CANVAS_WIDTH + 140) %
        (CANVAS_WIDTH + 140) -
      70;
    const screenY =
      (y + CANVAS_HEIGHT + 100) %
        (CANVAS_HEIGHT + 100) -
      50;
    const twinkle =
      0.5 +
      0.5 *
        Math.sin(
          time *
            (0.8 + depth * 1.6) +
            index,
        );

    ctx.globalAlpha =
      0.08 +
      depth * 0.16 +
      twinkle * 0.08;
    ctx.fillStyle =
      index % 7 === 0
        ? "#bde9ff"
        : "#ffffff";
    ctx.beginPath();
    ctx.arc(
      screenX,
      screenY,
      0.7 + depth * 1.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

function drawOrbitalNebulaAndPlanet(ctx, world) {
  const time = world.time ?? 0;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const nebula = ctx.createRadialGradient(
    CANVAS_WIDTH * 0.12,
    CANVAS_HEIGHT * 0.18,
    0,
    CANVAS_WIDTH * 0.12,
    CANVAS_HEIGHT * 0.18,
    CANVAS_WIDTH * 0.48,
  );
  nebula.addColorStop(
    0,
    "rgba(34,211,238,0.09)",
  );
  nebula.addColorStop(
    0.42,
    "rgba(99,102,241,0.055)",
  );
  nebula.addColorStop(
    1,
    "rgba(0,0,0,0)",
  );

  ctx.fillStyle = nebula;
  ctx.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );

  const planetX =
    CANVAS_WIDTH * 0.91 +
    Math.sin(time * 0.015) * 8;
  const planetY =
    CANVAS_HEIGHT * 0.12;
  const planetRadius =
    Math.min(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    ) * 0.105;

  const planet =
    ctx.createRadialGradient(
      planetX - planetRadius * 0.32,
      planetY - planetRadius * 0.35,
      planetRadius * 0.12,
      planetX,
      planetY,
      planetRadius,
    );
  planet.addColorStop(
    0,
    "rgba(224,242,254,0.28)",
  );
  planet.addColorStop(
    0.48,
    "rgba(56,189,248,0.14)",
  );
  planet.addColorStop(
    1,
    "rgba(15,23,42,0.03)",
  );

  ctx.globalAlpha = 0.46;
  ctx.fillStyle = planet;
  ctx.beginPath();
  ctx.arc(
    planetX,
    planetY,
    planetRadius,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.restore();
}

function drawOrbitalDebris(ctx, world) {
  const time = world.time ?? 0;

  ctx.save();

  for (let index = 0; index < 18; index += 1) {
    const speed =
      5 + fxNoise(index, 11) * 13;
    const x =
      (
        fxNoise(index, 12) *
          (CANVAS_WIDTH + 180) +
        time * speed
      ) %
        (CANVAS_WIDTH + 180) -
      90;
    const y =
      fxNoise(index, 13) *
      CANVAS_HEIGHT;
    const size =
      2 + fxNoise(index, 14) * 7;
    const angle =
      time *
        (0.15 +
          fxNoise(index, 15) * 0.45) +
      index;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha =
      0.12 +
      fxNoise(index, 16) * 0.18;
    ctx.fillStyle =
      index % 4 === 0
        ? "#94a3b8"
        : "#475569";
    ctx.fillRect(
      -size,
      -size * 0.32,
      size * 2,
      size * 0.64,
    );
    ctx.restore();
  }

  ctx.restore();
}

function drawOrbitalMeteor(ctx, world) {
  const time = world.time ?? 0;
  const cycle = time % 17;

  if (cycle > 1.15) {
    return;
  }

  const progress = cycle / 1.15;
  const x =
    CANVAS_WIDTH * 1.08 -
    progress * CANVAS_WIDTH * 1.24;
  const y =
    CANVAS_HEIGHT * 0.11 +
    progress * CANVAS_HEIGHT * 0.28;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const trail = ctx.createLinearGradient(
    x,
    y,
    x + 145,
    y - 70,
  );
  trail.addColorStop(
    0,
    "rgba(255,255,255,0.9)",
  );
  trail.addColorStop(
    0.2,
    "rgba(125,211,252,0.58)",
  );
  trail.addColorStop(
    1,
    "rgba(56,189,248,0)",
  );

  ctx.strokeStyle = trail;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 145, y - 70);
  ctx.stroke();

  ctx.restore();
}

function drawOrbitalWreckageSparks2D(
  ctx,
  world,
) {
  const bounds = fxVisibleBounds(world);
  const time = world.time ?? 0;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (
    let y = bounds.minY;
    y <= bounds.maxY;
    y += 1
  ) {
    for (
      let x = bounds.minX;
      x <= bounds.maxX;
      x += 1
    ) {
      if (
        fxTileIsFloor(world, x, y) ||
        !fxTileVisible(world, x, y) ||
        fxNoise(x, y, 71) > 0.085
      ) {
        continue;
      }

      const phase =
        (
          time * 2.2 +
          fxNoise(x, y, 72) * 8
        ) %
        5;

      if (phase > 0.32) {
        continue;
      }

      const sx =
        (x + 0.5 - bounds.camera.x) *
        bounds.scale;
      const sy =
        (y + 0.5 - bounds.camera.y) *
        bounds.scale;

      for (let index = 0; index < 5; index += 1) {
        const angle =
          -Math.PI * 0.8 +
          fxNoise(
            x * 13 + index,
            y,
            73,
          ) *
            Math.PI *
            0.6;
        const length =
          bounds.scale *
          (
            0.08 +
            fxNoise(
              x,
              y * 17 + index,
              74,
            ) *
              0.22
          );

        ctx.globalAlpha =
          0.35 +
          fxNoise(index, x, y) * 0.55;
        ctx.strokeStyle =
          index % 2
            ? "#fbbf24"
            : "#e0f2fe";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(
          sx + Math.cos(angle) * length,
          sy + Math.sin(angle) * length,
        );
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

function drawOrbitalHolographicPickups(
  ctx,
  world,
) {
  if (world.viewMode === "3d") {
    return;
  }

  const time = world.time ?? 0;

  for (const pickup of world.pickups ?? []) {
    if (
      pickup.type !== "weapon" ||
      visibleStrengthAt(
        world,
        Math.floor(pickup.x),
        Math.floor(pickup.y),
      ) <= 0.15
    ) {
      continue;
    }

    const screen =
      getWorldScreenPosition(
        world,
        pickup.x,
        pickup.y,
      );
    const radius =
      screen.scale * 0.34;
    const spin = time * 1.25;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.globalCompositeOperation =
      "lighter";
    ctx.strokeStyle =
      "rgba(103,232,249,0.78)";
    ctx.fillStyle =
      "rgba(34,211,238,0.08)";
    ctx.lineWidth = 1.4;
    ctx.rotate(spin);

    ctx.beginPath();
    for (let side = 0; side < 6; side += 1) {
      const angle =
        side * (Math.PI / 3);
      const x =
        Math.cos(angle) * radius;
      const y =
        Math.sin(angle) * radius;

      if (side === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.rotate(-spin);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle =
      "rgba(207,250,254,0.7)";

    for (let line = -2; line <= 2; line += 1) {
      ctx.fillRect(
        -radius * 0.55,
        line * radius * 0.22,
        radius * 1.1,
        1,
      );
    }

    ctx.restore();
  }
}

function drawOrbitalEngineEffects(ctx, world) {
  const time = world.time ?? 0;

  if (world.viewMode === "3d") {
    const pulse =
      0.7 +
      Math.sin(time * 12) * 0.18;
    const glow =
      ctx.createRadialGradient(
        CANVAS_WIDTH * 0.5,
        CANVAS_HEIGHT * 0.94,
        2,
        CANVAS_WIDTH * 0.5,
        CANVAS_HEIGHT * 0.94,
        82,
      );

    glow.addColorStop(
      0,
      `rgba(255,255,255,${0.25 * pulse})`,
    );
    glow.addColorStop(
      0.22,
      `rgba(34,211,238,${0.22 * pulse})`,
    );
    glow.addColorStop(
      1,
      "rgba(14,116,144,0)",
    );

    ctx.save();
    ctx.globalCompositeOperation =
      "lighter";
    ctx.fillStyle = glow;
    ctx.fillRect(
      CANVAS_WIDTH * 0.36,
      CANVAS_HEIGHT * 0.78,
      CANVAS_WIDTH * 0.28,
      CANVAS_HEIGHT * 0.22,
    );
    ctx.restore();
    return;
  }

  const player =
    getWorldScreenPosition(
      world,
      world.player.x,
      world.player.y,
    );
  const facing = world.player.facing ?? 0;
  const backX =
    player.x -
    Math.cos(facing) *
      player.scale *
      0.28;
  const backY =
    player.y -
    Math.sin(facing) *
      player.scale *
      0.28;
  const plume =
    player.scale *
    (
      0.18 +
      0.05 * Math.sin(time * 15)
    );

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(backX, backY);
  ctx.rotate(facing + Math.PI);

  const gradient =
    ctx.createLinearGradient(
      0,
      0,
      plume * 2.7,
      0,
    );
  gradient.addColorStop(
    0,
    "rgba(255,255,255,0.72)",
  );
  gradient.addColorStop(
    0.28,
    "rgba(34,211,238,0.58)",
  );
  gradient.addColorStop(
    1,
    "rgba(37,99,235,0)",
  );

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, -plume * 0.42);
  ctx.lineTo(plume * 2.7, 0);
  ctx.lineTo(0, plume * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawOrbitalEnemyExhaust(ctx, world) {
  if (world.viewMode === "3d") {
    return;
  }

  for (const enemy of world.enemies ?? []) {
    if (
      enemy.hp <= 0 ||
      visibleStrengthAt(
        world,
        Math.floor(enemy.x),
        Math.floor(enemy.y),
      ) <= 0.12
    ) {
      continue;
    }

    const screen =
      getWorldScreenPosition(
        world,
        enemy.x,
        enemy.y,
      );
    const dx =
      world.player.x - enemy.x;
    const dy =
      world.player.y - enemy.y;
    const length =
      Math.max(
        0.001,
        Math.hypot(dx, dy),
      );
    const ux = dx / length;
    const uy = dy / length;
    const startX =
      screen.x -
      ux * enemy.radius * screen.scale;
    const startY =
      screen.y -
      uy * enemy.radius * screen.scale;

    ctx.save();
    ctx.globalCompositeOperation =
      "lighter";
    ctx.strokeStyle =
      "rgba(56,189,248,0.26)";
    ctx.lineWidth =
      Math.max(
        1.2,
        screen.scale * 0.025,
      );
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(
      startX - ux * screen.scale * 0.22,
      startY - uy * screen.scale * 0.22,
    );
    ctx.stroke();
    ctx.restore();
  }
}

function drawOrbitalProjectileTrails(ctx, world) {
  if (world.viewMode === "3d") {
    return;
  }

  for (const projectile of world.projectiles ?? []) {
    if (projectile.owner !== "player") {
      continue;
    }

    const screen =
      getWorldScreenPosition(
        world,
        projectile.x,
        projectile.y,
      );
    const speed =
      Math.max(
        0.001,
        Math.hypot(
          projectile.vx ?? 0,
          projectile.vy ?? 0,
        ),
      );
    const ux =
      (projectile.vx ?? 0) / speed;
    const uy =
      (projectile.vy ?? 0) / speed;
    const trail =
      screen.scale * 0.35;

    ctx.save();
    ctx.globalCompositeOperation =
      "lighter";

    const gradient =
      ctx.createLinearGradient(
        screen.x,
        screen.y,
        screen.x - ux * trail,
        screen.y - uy * trail,
      );
    gradient.addColorStop(
      0,
      "rgba(255,255,255,0.75)",
    );
    gradient.addColorStop(
      0.25,
      "rgba(103,232,249,0.55)",
    );
    gradient.addColorStop(
      1,
      "rgba(59,130,246,0)",
    );

    ctx.strokeStyle = gradient;
    ctx.lineWidth =
      Math.max(
        1.5,
        screen.scale * 0.025,
      );
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(
      screen.x - ux * trail,
      screen.y - uy * trail,
    );
    ctx.stroke();
    ctx.restore();
  }
}

function drawOrbitalRuinsIdentity(ctx, world) {
  drawOrbitalStarfield(ctx, world);
  drawOrbitalNebulaAndPlanet(ctx, world);
  drawOrbitalDebris(ctx, world);
  drawOrbitalMeteor(ctx, world);

  if (world.viewMode !== "3d") {
    drawOrbitalWreckageSparks2D(
      ctx,
      world,
    );
  }

  drawOrbitalHolographicPickups(
    ctx,
    world,
  );
  drawOrbitalEnemyExhaust(ctx, world);
  drawOrbitalProjectileTrails(ctx, world);
  drawOrbitalEngineEffects(ctx, world);
}

function drawEmeraldSunShafts(ctx, world) {
  const time = world.time ?? 0;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let index = 0; index < 4; index += 1) {
    const center =
      CANVAS_WIDTH *
      (
        0.12 +
        index * 0.25 +
        Math.sin(
          time * 0.08 + index,
        ) *
          0.018
      );
    const width =
      CANVAS_WIDTH *
      (
        0.09 +
        fxNoise(index, 31) * 0.06
      );

    const gradient =
      ctx.createLinearGradient(
        center,
        0,
        center + width * 0.32,
        CANVAS_HEIGHT,
      );
    gradient.addColorStop(
      0,
      "rgba(254,249,195,0.12)",
    );
    gradient.addColorStop(
      0.55,
      "rgba(190,242,100,0.045)",
    );
    gradient.addColorStop(
      1,
      "rgba(255,255,255,0)",
    );

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(
      center - width * 0.3,
      0,
    );
    ctx.lineTo(
      center + width * 0.3,
      0,
    );
    ctx.lineTo(
      center + width,
      CANVAS_HEIGHT,
    );
    ctx.lineTo(
      center - width * 0.65,
      CANVAS_HEIGHT,
    );
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawEmeraldPollenAndFireflies(
  ctx,
  world,
) {
  const time = world.time ?? 0;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let index = 0; index < 42; index += 1) {
    const baseX =
      fxNoise(index, 40) *
      CANVAS_WIDTH;
    const baseY =
      fxNoise(index, 41) *
      CANVAS_HEIGHT;
    const x =
      (
        baseX +
        Math.sin(
          time *
            (
              0.35 +
              fxNoise(index, 42) * 0.55
            ) +
            index,
        ) *
          24
      ) %
      CANVAS_WIDTH;
    const y =
      (
        baseY -
        time *
          (
            3 +
            fxNoise(index, 43) * 8
          )
      ) %
      CANVAS_HEIGHT;
    const sy =
      (y + CANVAS_HEIGHT) %
      CANVAS_HEIGHT;
    const firefly =
      index % 7 === 0;
    const pulse =
      0.5 +
      0.5 *
        Math.sin(
          time * 3.1 + index,
        );

    ctx.globalAlpha =
      firefly
        ? 0.18 + pulse * 0.38
        : 0.08 + pulse * 0.1;
    ctx.fillStyle =
      firefly
        ? "#d9f99d"
        : "#fef9c3";
    ctx.beginPath();
    ctx.arc(
      x,
      sy,
      firefly ? 2.1 : 1.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

function drawEmeraldLeaves(ctx, world) {
  const time = world.time ?? 0;

  ctx.save();

  for (let index = 0; index < 16; index += 1) {
    const speed =
      10 + fxNoise(index, 51) * 16;
    const x =
      (
        fxNoise(index, 52) *
          (CANVAS_WIDTH + 120) +
        time * speed
      ) %
        (CANVAS_WIDTH + 120) -
      60;
    const y =
      (
        fxNoise(index, 53) *
          (CANVAS_HEIGHT + 100) +
        Math.sin(time * 0.7 + index) * 35
      ) %
      (CANVAS_HEIGHT + 100);
    const size =
      3 + fxNoise(index, 54) * 5;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(
      time *
        (
          0.3 +
          fxNoise(index, 55) * 0.8
        ) +
        index,
    );
    ctx.globalAlpha =
      0.1 +
      fxNoise(index, 56) * 0.2;
    ctx.fillStyle =
      index % 3 === 0
        ? "#84cc16"
        : "#22c55e";
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      size,
      size * 0.42,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawEmeraldWallVines2D(ctx, world) {
  const bounds = fxVisibleBounds(world);
  const time = world.time ?? 0;

  ctx.save();

  for (
    let y = bounds.minY;
    y <= bounds.maxY;
    y += 1
  ) {
    for (
      let x = bounds.minX;
      x <= bounds.maxX;
      x += 1
    ) {
      if (
        fxTileIsFloor(world, x, y) ||
        !fxTileVisible(world, x, y) ||
        fxNoise(x, y, 60) > 0.18
      ) {
        continue;
      }

      const sx =
        (x - bounds.camera.x) *
        bounds.scale;
      const sy =
        (y - bounds.camera.y) *
        bounds.scale;
      const sway =
        Math.sin(
          time * 0.75 +
          x * 0.8 +
          y,
        ) *
        bounds.scale *
        0.035;

      ctx.strokeStyle =
        "rgba(22,101,52,0.46)";
      ctx.lineWidth =
        Math.max(
          1.5,
          bounds.scale * 0.035,
        );
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(
        sx + bounds.scale * 0.18,
        sy - 2,
      );
      ctx.bezierCurveTo(
        sx +
          bounds.scale * 0.55 +
          sway,
        sy + bounds.scale * 0.26,
        sx +
          bounds.scale * 0.12 -
          sway,
        sy + bounds.scale * 0.62,
        sx +
          bounds.scale * 0.42 +
          sway,
        sy + bounds.scale * 1.02,
      );
      ctx.stroke();

      ctx.fillStyle =
        "rgba(132,204,22,0.42)";

      for (let leaf = 0; leaf < 3; leaf += 1) {
        const ly =
          sy +
          bounds.scale *
            (0.22 + leaf * 0.24);
        const lx =
          sx +
          bounds.scale *
            (
              0.3 +
              Math.sin(
                leaf + x,
              ) *
                0.12
            );

        ctx.beginPath();
        ctx.ellipse(
          lx,
          ly,
          bounds.scale * 0.07,
          bounds.scale * 0.028,
          leaf % 2
            ? -0.7
            : 0.7,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

function drawEmeraldWaterReflections2D(
  ctx,
  world,
) {
  const bounds = fxVisibleBounds(world);
  const time = world.time ?? 0;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (
    let y = bounds.minY;
    y <= bounds.maxY;
    y += 1
  ) {
    for (
      let x = bounds.minX;
      x <= bounds.maxX;
      x += 1
    ) {
      if (
        !fxTileIsFloor(world, x, y) ||
        !fxTileVisible(world, x, y) ||
        fxNoise(x, y, 63) > 0.095
      ) {
        continue;
      }

      const sx =
        (x - bounds.camera.x) *
        bounds.scale;
      const sy =
        (y - bounds.camera.y) *
        bounds.scale;
      const ripple =
        Math.sin(
          time * 2 +
          x * 1.4 +
          y * 0.8,
        );

      ctx.globalAlpha =
        0.09 + 0.04 * ripple;
      ctx.strokeStyle =
        "#bfdbfe";
      ctx.lineWidth = 1;

      for (
        let line = 0;
        line < 3;
        line += 1
      ) {
        const py =
          sy +
          bounds.scale *
            (
              0.28 +
              line * 0.18
            );
        const width =
          bounds.scale *
          (
            0.35 +
            line * 0.12
          );

        ctx.beginPath();
        ctx.moveTo(
          sx +
            bounds.scale * 0.5 -
            width * 0.5 +
            ripple * 3,
          py,
        );
        ctx.lineTo(
          sx +
            bounds.scale * 0.5 +
            width * 0.5 +
            ripple * 3,
          py,
        );
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

function drawEmeraldFleeingInsects(ctx, world) {
  if (world.viewMode === "3d") {
    return;
  }

  const player =
    getWorldScreenPosition(
      world,
      world.player.x,
      world.player.y,
    );
  const time = world.time ?? 0;

  ctx.save();

  for (let index = 0; index < 10; index += 1) {
    const angle =
      index * 2.399 +
      time * 0.25;
    const radius =
      player.scale *
      (
        0.9 +
        fxNoise(index, 67) * 1.8
      );
    const flee =
      1 +
      0.28 *
        Math.max(
          0,
          Math.sin(
            time * 1.7 +
            index,
          ),
        );
    const x =
      player.x +
      Math.cos(angle) *
        radius *
        flee;
    const y =
      player.y +
      Math.sin(angle) *
        radius *
        flee;

    ctx.globalAlpha =
      0.18 +
      fxNoise(index, 68) * 0.24;
    ctx.fillStyle = "#172554";
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      1.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.strokeStyle =
      "rgba(226,232,240,0.25)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 1);
    ctx.lineTo(x + 3, y + 1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEmeraldWeather(ctx, world) {
  const time = world.time ?? 0;

  if (time < 45) {
    return;
  }

  const cycle = (time - 45) % 74;

  if (cycle > 14) {
    return;
  }

  const intensity =
    Math.sin(
      Math.min(
        Math.PI,
        (cycle / 14) * Math.PI,
      ),
    );

  ctx.save();
  ctx.strokeStyle =
    `rgba(186,230,253,${0.08 + intensity * 0.13})`;
  ctx.lineWidth = 1;

  for (let index = 0; index < 58; index += 1) {
    const x =
      (
        fxNoise(index, 80) *
          CANVAS_WIDTH +
        time * 70
      ) %
      (CANVAS_WIDTH + 80);
    const y =
      (
        fxNoise(index, 81) *
          CANVAS_HEIGHT +
        time *
          (
            150 +
            fxNoise(index, 82) * 90
          )
      ) %
      (CANVAS_HEIGHT + 60);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 7, y + 19);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEmeraldWildsIdentity(ctx, world) {
  drawEmeraldSunShafts(ctx, world);
  drawEmeraldPollenAndFireflies(
    ctx,
    world,
  );
  drawEmeraldLeaves(ctx, world);

  if (world.viewMode !== "3d") {
    drawEmeraldWallVines2D(ctx, world);
    drawEmeraldWaterReflections2D(
      ctx,
      world,
    );
    drawEmeraldFleeingInsects(
      ctx,
      world,
    );
  }

  drawEmeraldWeather(ctx, world);
}

function drawKeepDust(ctx, world) {
  const time = world.time ?? 0;

  ctx.save();

  for (let index = 0; index < 34; index += 1) {
    const x =
      fxNoise(index, 90) *
        CANVAS_WIDTH +
      Math.sin(
        time * 0.18 + index,
      ) *
        11;
    const y =
      (
        fxNoise(index, 91) *
          CANVAS_HEIGHT +
        time *
          (
            5 +
            fxNoise(index, 92) * 9
          )
      ) %
      CANVAS_HEIGHT;

    ctx.globalAlpha =
      0.05 +
      fxNoise(index, 93) * 0.12;
    ctx.fillStyle = "#e7e5e4";
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      0.8 +
        fxNoise(index, 94) * 1.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

function drawKeepTorch(
  ctx,
  x,
  y,
  scale,
  phase,
) {
  const flicker =
    0.78 +
    0.22 *
      Math.sin(phase * 7.2) *
      Math.sin(phase * 3.1);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const glow = ctx.createRadialGradient(
    x,
    y,
    0,
    x,
    y,
    scale * 0.72,
  );
  glow.addColorStop(
    0,
    `rgba(254,240,138,${0.26 * flicker})`,
  );
  glow.addColorStop(
    0.28,
    `rgba(251,146,60,${0.2 * flicker})`,
  );
  glow.addColorStop(
    1,
    "rgba(127,29,29,0)",
  );

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(
    x,
    y,
    scale * 0.72,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(
    x,
    y - scale * 0.14 * flicker,
  );
  ctx.quadraticCurveTo(
    x + scale * 0.07,
    y,
    x,
    y + scale * 0.12,
  );
  ctx.quadraticCurveTo(
    x - scale * 0.07,
    y,
    x,
    y - scale * 0.14 * flicker,
  );
  ctx.fill();

  ctx.globalAlpha = 0.66;
  ctx.fillStyle = "#fef3c7";
  ctx.beginPath();
  ctx.arc(
    x,
    y,
    scale * 0.035,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.restore();
}

function drawFallenKeepWallDetails2D(
  ctx,
  world,
) {
  const bounds = fxVisibleBounds(world);
  const time = world.time ?? 0;

  ctx.save();

  for (
    let y = bounds.minY;
    y <= bounds.maxY;
    y += 1
  ) {
    for (
      let x = bounds.minX;
      x <= bounds.maxX;
      x += 1
    ) {
      if (
        fxTileIsFloor(world, x, y) ||
        !fxTileVisible(world, x, y)
      ) {
        continue;
      }

      const sx =
        (x - bounds.camera.x) *
        bounds.scale;
      const sy =
        (y - bounds.camera.y) *
        bounds.scale;
      const seed =
        fxNoise(x, y, 100);

      if (seed < 0.2) {
        ctx.strokeStyle =
          "rgba(41,37,36,0.38)";
        ctx.lineWidth =
          Math.max(
            1,
            bounds.scale * 0.018,
          );
        ctx.beginPath();
        ctx.moveTo(
          sx + bounds.scale * 0.2,
          sy + bounds.scale * 0.16,
        );
        ctx.lineTo(
          sx + bounds.scale * 0.44,
          sy + bounds.scale * 0.38,
        );
        ctx.lineTo(
          sx + bounds.scale * 0.3,
          sy + bounds.scale * 0.58,
        );
        ctx.lineTo(
          sx + bounds.scale * 0.55,
          sy + bounds.scale * 0.82,
        );
        ctx.stroke();
      }

      if (
        seed > 0.78 &&
        seed < 0.85
      ) {
        const centerX =
          sx + bounds.scale * 0.5;
        const centerY =
          sy + bounds.scale * 0.46;
        const sway =
          Math.sin(
            time * 0.85 + x + y,
          ) *
          bounds.scale *
          0.035;

        ctx.fillStyle =
          "rgba(127,29,29,0.52)";
        ctx.beginPath();
        ctx.moveTo(
          centerX -
            bounds.scale * 0.2,
          sy + bounds.scale * 0.1,
        );
        ctx.lineTo(
          centerX +
            bounds.scale * 0.2,
          sy + bounds.scale * 0.1,
        );
        ctx.lineTo(
          centerX +
            bounds.scale * 0.16 +
            sway,
          centerY +
            bounds.scale * 0.3,
        );
        ctx.lineTo(
          centerX + sway,
          centerY +
            bounds.scale * 0.21,
        );
        ctx.lineTo(
          centerX -
            bounds.scale * 0.16 +
            sway,
          centerY +
            bounds.scale * 0.3,
        );
        ctx.closePath();
        ctx.fill();
      }

      if (
        seed > 0.52 &&
        seed < 0.62
      ) {
        ctx.fillStyle =
          "rgba(28,25,23,0.5)";

        for (let hole = 0; hole < 3; hole += 1) {
          const hx =
            sx +
            bounds.scale *
              (
                0.24 +
                fxNoise(
                  x + hole,
                  y,
                  102,
                ) *
                  0.5
              );
          const hy =
            sy +
            bounds.scale *
              (
                0.2 +
                fxNoise(
                  x,
                  y + hole,
                  103,
                ) *
                  0.58
              );

          ctx.beginPath();
          ctx.ellipse(
            hx,
            hy,
            bounds.scale * 0.022,
            bounds.scale * 0.045,
            0.3,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }

      if (seed > 0.9) {
        drawKeepTorch(
          ctx,
          sx + bounds.scale * 0.5,
          sy + bounds.scale * 0.46,
          bounds.scale,
          time + x * 0.7 + y,
        );

        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.moveTo(
          sx + bounds.scale * 0.5,
          sy + bounds.scale * 0.46,
        );
        ctx.lineTo(
          sx + bounds.scale * 1.18,
          sy + bounds.scale * 0.1,
        );
        ctx.lineTo(
          sx + bounds.scale * 1.1,
          sy + bounds.scale * 0.88,
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  ctx.restore();
}

function drawFallenKeepFloorProps2D(
  ctx,
  world,
) {
  const bounds = fxVisibleBounds(world);
  const time = world.time ?? 0;

  ctx.save();

  for (
    let y = bounds.minY;
    y <= bounds.maxY;
    y += 1
  ) {
    for (
      let x = bounds.minX;
      x <= bounds.maxX;
      x += 1
    ) {
      if (
        !fxTileIsFloor(world, x, y) ||
        !fxTileVisible(world, x, y)
      ) {
        continue;
      }

      const seed =
        fxNoise(x, y, 111);
      const sx =
        (x - bounds.camera.x) *
        bounds.scale;
      const sy =
        (y - bounds.camera.y) *
        bounds.scale;
      const cx =
        sx + bounds.scale * 0.5;
      const cy =
        sy + bounds.scale * 0.5;

      if (
        seed > 0.94 &&
        seed < 0.97
      ) {
        ctx.strokeStyle =
          "rgba(120,53,15,0.64)";
        ctx.fillStyle =
          "rgba(68,64,60,0.72)";
        ctx.lineWidth =
          Math.max(
            1,
            bounds.scale * 0.025,
          );
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          bounds.scale * 0.13,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle =
          "rgba(168,162,158,0.72)";
        ctx.fillRect(
          cx - bounds.scale * 0.04,
          cy - bounds.scale * 0.2,
          bounds.scale * 0.08,
          bounds.scale * 0.28,
        );
      }

      if (
        seed > 0.885 &&
        seed < 0.905
      ) {
        const flicker =
          0.7 +
          Math.sin(
            time * 8 + x + y,
          ) *
            0.2;

        ctx.fillStyle =
          "rgba(231,229,228,0.65)";
        ctx.fillRect(
          cx - bounds.scale * 0.018,
          cy,
          bounds.scale * 0.036,
          bounds.scale * 0.12,
        );
        ctx.fillStyle =
          `rgba(253,186,116,${0.65 * flicker})`;
        ctx.beginPath();
        ctx.arc(
          cx,
          cy - bounds.scale * 0.025,
          bounds.scale * 0.025,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      if (
        seed > 0.82 &&
        seed < 0.835
      ) {
        ctx.strokeStyle =
          "rgba(120,53,15,0.58)";
        ctx.lineWidth =
          Math.max(
            2,
            bounds.scale * 0.045,
          );
        ctx.lineCap = "round";

        for (let plank = 0; plank < 3; plank += 1) {
          const offset =
            (plank - 1) *
            bounds.scale *
            0.1;

          ctx.beginPath();
          ctx.moveTo(
            cx -
              bounds.scale * 0.27,
            cy + offset,
          );
          ctx.lineTo(
            cx +
              bounds.scale * 0.27,
            cy + offset +
              Math.sin(plank) *
                bounds.scale *
                0.035,
          );
          ctx.stroke();
        }
      }
    }
  }

  ctx.restore();
}

function drawFallenKeepRats(ctx, world) {
  if (world.viewMode === "3d") {
    return;
  }

  const player =
    getWorldScreenPosition(
      world,
      world.player.x,
      world.player.y,
    );
  const time = world.time ?? 0;

  ctx.save();

  for (let index = 0; index < 3; index += 1) {
    const loop =
      (
        time *
          (
            0.55 +
            index * 0.16
          ) +
        index * 2.1
      ) %
      (Math.PI * 2);
    const radius =
      player.scale *
      (1.8 + index * 0.48);
    const x =
      player.x +
      Math.cos(loop) *
        radius;
    const y =
      player.y +
      Math.sin(loop * 0.72) *
        radius *
        0.65;

    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      4,
      2.3,
      loop,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.strokeStyle =
      "rgba(28,25,23,0.32)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x - 7,
      y - 3,
      x - 11,
      y + 2,
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawFallenKeepTorchAtmosphere3D(
  ctx,
  world,
) {
  if (world.viewMode !== "3d") {
    return;
  }

  const time = world.time ?? 0;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (const side of [-1, 1]) {
    const x =
      CANVAS_WIDTH *
      (
        0.5 +
        side * 0.37
      );
    const y =
      CANVAS_HEIGHT * 0.42;
    const flicker =
      0.78 +
      Math.sin(
        time * 7 +
        side,
      ) *
        0.16;
    const glow =
      ctx.createRadialGradient(
        x,
        y,
        0,
        x,
        y,
        CANVAS_WIDTH * 0.2,
      );

    glow.addColorStop(
      0,
      `rgba(251,146,60,${0.13 * flicker})`,
    );
    glow.addColorStop(
      0.38,
      `rgba(245,158,11,${0.05 * flicker})`,
    );
    glow.addColorStop(
      1,
      "rgba(0,0,0,0)",
    );

    ctx.fillStyle = glow;
    ctx.fillRect(
      x - CANVAS_WIDTH * 0.22,
      y - CANVAS_HEIGHT * 0.3,
      CANVAS_WIDTH * 0.44,
      CANVAS_HEIGHT * 0.6,
    );
  }

  ctx.restore();
}

function drawFallenKeepIdentity(ctx, world) {
  drawKeepDust(ctx, world);

  if (world.viewMode === "3d") {
    drawFallenKeepTorchAtmosphere3D(
      ctx,
      world,
    );
    return;
  }

  drawFallenKeepWallDetails2D(
    ctx,
    world,
  );
  drawFallenKeepFloorProps2D(
    ctx,
    world,
  );
  drawFallenKeepRats(ctx, world);
}

function drawWorldIdentityEffects(ctx, world) {
  const themeKey =
    world.level?.themeKey;

  if (!WORLD_IDENTITY_KEYS.has(themeKey)) {
    return;
  }

  if (themeKey === "space") {
    drawOrbitalRuinsIdentity(
      ctx,
      world,
    );
    return;
  }

  if (themeKey === "jungle") {
    drawEmeraldWildsIdentity(
      ctx,
      world,
    );
    return;
  }

  if (themeKey === "medieval") {
    drawFallenKeepIdentity(
      ctx,
      world,
    );
  }
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
  drawWorldIdentityEffects(ctx, world);
  drawEnemyPursuitVisuals(ctx, world);
  drawAnimatedPickupEffects(ctx, world);
  drawCinematicParticles(ctx, world);
  drawEnemyHitReactions(ctx, world);

  ctx.restore();

  drawRunEscalationOverlay(ctx, world);
  drawResultOverlay(ctx, world);
}
