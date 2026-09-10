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
  WEAPONS as WEAPON_DEFINITIONS,
} from "../config/weapons-enhanced.js";
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

function fxTileIsWall(world, x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < world.width &&
    y < world.height &&
    !fxTileIsFloor(world, x, y)
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
    drawOrbitalRuinsIdentityGuaranteed(
      ctx,
      world,
    );
    return;
  }

  if (themeKey === "jungle") {
    drawEmeraldWildsIdentityGuaranteed(
      ctx,
      world,
    );
    return;
  }

  if (themeKey === "medieval") {
    drawFallenKeepIdentityGuaranteed(
      ctx,
      world,
    );
  }
}


function getThemePropCache(world, themeKey) {
  const cacheKey =
    `${themeKey}:${world.width}x${world.height}`;
  const current =
    world.__themePropCache ?? null;

  if (current?.key === cacheKey) {
    return current;
  }

  const floorNearWalls = [];
  const openFloors = [];

  for (let y = 1; y < world.height - 1; y += 1) {
    for (let x = 1; x < world.width - 1; x += 1) {
      if (!fxTileIsFloor(world, x, y)) {
        continue;
      }

      const walls = {
        north: fxTileIsWall(world, x, y - 1),
        south: fxTileIsWall(world, x, y + 1),
        west: fxTileIsWall(world, x - 1, y),
        east: fxTileIsWall(world, x + 1, y),
      };
      const wallCount =
        Number(walls.north) +
        Number(walls.south) +
        Number(walls.west) +
        Number(walls.east);

      const candidate = {
        tileX: x,
        tileY: y,
        x: x + 0.5,
        y: y + 0.5,
        walls,
        wallCount,
      };

      openFloors.push(candidate);

      if (wallCount >= 1) {
        floorNearWalls.push(candidate);
      }
    }
  }

  const cache = {
    key: cacheKey,
    floorNearWalls,
    openFloors,
    keepStatues: selectSpreadCandidates(
      floorNearWalls.filter(
        (candidate) => candidate.wallCount >= 1,
      ),
      10,
      501,
      2.5,
    ),
    keepTorches: selectSpreadCandidates(
      floorNearWalls,
      12,
      502,
      2.2,
    ),
    keepBanners: selectSpreadCandidates(
      floorNearWalls,
      9,
      503,
      2.4,
    ),
    keepDoors: selectSpreadCandidates(
      floorNearWalls,
      8,
      504,
      2.1,
    ),
    emeraldGrowth: selectSpreadCandidates(
      floorNearWalls,
      16,
      601,
      1.8,
    ),
    emeraldWater: selectSpreadCandidates(
      openFloors.filter(
        (candidate) => candidate.wallCount <= 2,
      ),
      12,
      602,
      2.2,
    ),
    orbitalWrecks: selectSpreadCandidates(
      openFloors.filter(
        (candidate) => candidate.wallCount <= 2,
      ),
      8,
      701,
      2.5,
    ),
  };

  world.__themePropCache = cache;

  return cache;
}

function selectSpreadCandidates(
  candidates,
  count,
  salt,
  minDistance,
) {
  const ordered = [...candidates].sort(
    (left, right) =>
      fxNoise(
        right.tileX,
        right.tileY,
        salt,
      ) -
      fxNoise(
        left.tileX,
        left.tileY,
        salt,
      ),
  );
  const chosen = [];

  for (const candidate of ordered) {
    if (chosen.length >= count) {
      break;
    }

    const tooClose = chosen.some(
      (placed) =>
        Math.hypot(
          candidate.x - placed.x,
          candidate.y - placed.y,
        ) < minDistance,
    );

    if (tooClose) {
      continue;
    }

    chosen.push(candidate);
  }

  return chosen;
}

function getFacingAngle(candidate) {
  if (candidate.walls.north && !candidate.walls.south) {
    return Math.PI / 2;
  }

  if (candidate.walls.south && !candidate.walls.north) {
    return -Math.PI / 2;
  }

  if (candidate.walls.west && !candidate.walls.east) {
    return 0;
  }

  if (candidate.walls.east && !candidate.walls.west) {
    return Math.PI;
  }

  return 0;
}

function drawProjectedWorldProps(
  ctx,
  world,
  items,
  maxDistance,
  drawFn,
) {
  const projectionPlane =
    CANVAS_WIDTH /
    2 /
    Math.tan(VIEW_3D_FOV / 2);
  const projected = [];

  for (const item of items) {
    if (
      visibleStrengthAt(
        world,
        item.tileX,
        item.tileY,
      ) <= 0.08
    ) {
      continue;
    }

    const distance = Math.hypot(
      item.x - world.player.x,
      item.y - world.player.y,
    );

    if (distance > maxDistance) {
      continue;
    }

    const projection = project3DSprite(
      world,
      item.x,
      item.y,
      projectionPlane,
    );

    if (!projection) {
      continue;
    }

    projected.push({
      item,
      distance,
      projection,
    });
  }

  projected.sort(
    (left, right) =>
      right.distance - left.distance,
  );

  for (const entry of projected) {
    drawFn(
      ctx,
      world,
      entry.item,
      entry.projection,
      entry.distance,
    );
  }
}


function getKeepStatueVariant(statue) {
  const roll = fxNoise(
    statue.tileX,
    statue.tileY,
    777,
  );

  if (roll < 0.25) {
    return "sword";
  }

  if (roll < 0.5) {
    return "spear";
  }

  if (roll < 0.75) {
    return "shield";
  }

  return "halberd";
}

function drawKeepStatueWeapon2D(
  ctx,
  variant,
  size,
) {
  ctx.strokeStyle = "#cbd5e1";
  ctx.fillStyle = "#94a3b8";
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (variant === "sword") {
    ctx.beginPath();
    ctx.moveTo(size * 0.24, -size * 0.44);
    ctx.lineTo(size * 0.24, size * 0.1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size * 0.16, -size * 0.35);
    ctx.lineTo(size * 0.32, -size * 0.52);
    ctx.stroke();

    ctx.strokeStyle = "#9ca3af";
    ctx.beginPath();
    ctx.moveTo(size * 0.14, -size * 0.08);
    ctx.lineTo(size * 0.34, -size * 0.08);
    ctx.stroke();
    return;
  }

  if (variant === "spear") {
    ctx.beginPath();
    ctx.moveTo(size * 0.24, -size * 0.58);
    ctx.lineTo(size * 0.24, size * 0.14);
    ctx.stroke();

    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(size * 0.24, -size * 0.72);
    ctx.lineTo(size * 0.34, -size * 0.56);
    ctx.lineTo(size * 0.24, -size * 0.48);
    ctx.lineTo(size * 0.14, -size * 0.56);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (variant === "shield") {
    ctx.fillStyle = "#64748b";
    ctx.strokeStyle = "#d1d5db";
    ctx.beginPath();
    ctx.moveTo(size * 0.24, -size * 0.24);
    ctx.lineTo(size * 0.38, -size * 0.16);
    ctx.lineTo(size * 0.34, size * 0.06);
    ctx.lineTo(size * 0.24, size * 0.18);
    ctx.lineTo(size * 0.14, size * 0.06);
    ctx.lineTo(size * 0.1, -size * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#475569";
    ctx.beginPath();
    ctx.moveTo(size * 0.24, -size * 0.18);
    ctx.lineTo(size * 0.24, size * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.15, -size * 0.04);
    ctx.lineTo(size * 0.33, -size * 0.04);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(size * 0.24, -size * 0.62);
  ctx.lineTo(size * 0.24, size * 0.12);
  ctx.stroke();

  ctx.strokeStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(size * 0.08, -size * 0.42);
  ctx.lineTo(size * 0.38, -size * 0.56);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.1, -size * 0.28);
  ctx.lineTo(size * 0.4, -size * 0.42);
  ctx.stroke();
}

function drawKeepStatueShape2D(
  ctx,
  x,
  y,
  size,
  angle = 0,
  variant = "sword",
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const pedestalHeight = size * 0.18;
  const bodyTop = -size * 0.62;
  const bodyBottom = size * 0.18;

  ctx.fillStyle = "#4b5563";
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = Math.max(1.5, size * 0.045);

  ctx.fillRect(
    -size * 0.34,
    size * 0.16,
    size * 0.68,
    pedestalHeight,
  );
  ctx.strokeRect(
    -size * 0.34,
    size * 0.16,
    size * 0.68,
    pedestalHeight,
  );

  ctx.fillRect(
    -size * 0.24,
    bodyBottom - size * 0.02,
    size * 0.48,
    size * 0.08,
  );

  ctx.fillStyle = "#6b7280";
  ctx.beginPath();
  ctx.moveTo(-size * 0.22, bodyBottom);
  ctx.lineTo(-size * 0.18, -size * 0.08);
  ctx.lineTo(-size * 0.28, bodyTop + size * 0.2);
  ctx.lineTo(-size * 0.15, bodyTop + size * 0.08);
  ctx.lineTo(-size * 0.08, -size * 0.04);
  ctx.lineTo(-size * 0.05, bodyBottom);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(size * 0.22, bodyBottom);
  ctx.lineTo(size * 0.18, -size * 0.08);
  ctx.lineTo(size * 0.28, bodyTop + size * 0.2);
  ctx.lineTo(size * 0.15, bodyTop + size * 0.08);
  ctx.lineTo(size * 0.08, -size * 0.04);
  ctx.lineTo(size * 0.05, bodyBottom);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-size * 0.34, bodyTop + size * 0.18);
  ctx.lineTo(-size * 0.14, bodyTop + size * 0.26);
  ctx.lineTo(-size * 0.12, bodyTop + size * 0.4);
  ctx.lineTo(-size * 0.26, bodyTop + size * 0.36);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(size * 0.34, bodyTop + size * 0.18);
  ctx.lineTo(size * 0.14, bodyTop + size * 0.26);
  ctx.lineTo(size * 0.12, bodyTop + size * 0.4);
  ctx.lineTo(size * 0.26, bodyTop + size * 0.36);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(
    -size * 0.2,
    bodyTop + size * 0.16,
    size * 0.4,
    size * 0.44,
  );
  ctx.strokeRect(
    -size * 0.2,
    bodyTop + size * 0.16,
    size * 0.4,
    size * 0.44,
  );

  ctx.beginPath();
  ctx.moveTo(-size * 0.08, bodyTop + size * 0.16);
  ctx.lineTo(0, bodyTop - size * 0.02);
  ctx.lineTo(size * 0.08, bodyTop + size * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(
    0,
    bodyTop - size * 0.08,
    size * 0.14,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#9ca3af";
  ctx.beginPath();
  ctx.moveTo(0, bodyTop + size * 0.18);
  ctx.lineTo(0, bodyBottom - size * 0.04);
  ctx.stroke();

  drawKeepStatueWeapon2D(
    ctx,
    variant,
    size,
  );

  ctx.restore();
}

function drawKeepGuaranteedStatues2D(
  ctx,
  world,
  props,
) {
  for (const statue of props.keepStatues) {
    if (
      visibleStrengthAt(
        world,
        statue.tileX,
        statue.tileY,
      ) <= 0.1
    ) {
      continue;
    }

    const screen =
      getWorldScreenPosition(
        world,
        statue.x,
        statue.y,
      );
    const size = screen.scale * 0.64;

    drawKeepStatueShape2D(
      ctx,
      screen.x,
      screen.y + screen.scale * 0.02,
      size,
      getFacingAngle(statue),
    );
  }
}


function drawKeepProjectedStatues3D(
  ctx,
  world,
  props,
) {
  drawProjectedWorldProps(
    ctx,
    world,
    props.keepStatues,
    13,
    (
      localCtx,
      localWorld,
      statue,
      projection,
      distance,
    ) => {
      const variant =
        getKeepStatueVariant(statue);
      const height = Math.max(
        84,
        Math.min(
          CANVAS_HEIGHT * 0.95,
          projection.scale * 1.7,
        ),
      );
      const width = height * 0.46;
      const baseY =
        CANVAS_HEIGHT * 0.8 +
        Math.min(
          CANVAS_HEIGHT * 0.12,
          projection.scale * 0.045,
        );
      const alpha =
        0.96 - Math.min(0.42, distance * 0.022);

      localCtx.save();
      localCtx.translate(
        projection.screenX,
        baseY,
      );
      localCtx.globalAlpha = alpha;

      localCtx.fillStyle = "#5b6472";
      localCtx.strokeStyle = "#d1d5db";
      localCtx.lineWidth = Math.max(
        1.2,
        width * 0.045,
      );

      localCtx.fillRect(
        -width * 0.38,
        -height * 0.08,
        width * 0.76,
        height * 0.14,
      );
      localCtx.strokeRect(
        -width * 0.38,
        -height * 0.08,
        width * 0.76,
        height * 0.14,
      );

      localCtx.fillRect(
        -width * 0.24,
        -height * 0.02,
        width * 0.48,
        height * 0.08,
      );

      localCtx.beginPath();
      localCtx.moveTo(-width * 0.24, 0);
      localCtx.lineTo(-width * 0.18, -height * 0.36);
      localCtx.lineTo(-width * 0.3, -height * 0.56);
      localCtx.lineTo(-width * 0.16, -height * 0.66);
      localCtx.lineTo(-width * 0.08, -height * 0.28);
      localCtx.lineTo(-width * 0.05, 0);
      localCtx.closePath();
      localCtx.fill();

      localCtx.beginPath();
      localCtx.moveTo(width * 0.24, 0);
      localCtx.lineTo(width * 0.18, -height * 0.36);
      localCtx.lineTo(width * 0.3, -height * 0.56);
      localCtx.lineTo(width * 0.16, -height * 0.66);
      localCtx.lineTo(width * 0.08, -height * 0.28);
      localCtx.lineTo(width * 0.05, 0);
      localCtx.closePath();
      localCtx.fill();

      localCtx.beginPath();
      localCtx.moveTo(-width * 0.34, -height * 0.54);
      localCtx.lineTo(-width * 0.14, -height * 0.46);
      localCtx.lineTo(-width * 0.12, -height * 0.28);
      localCtx.lineTo(-width * 0.26, -height * 0.34);
      localCtx.closePath();
      localCtx.fill();

      localCtx.beginPath();
      localCtx.moveTo(width * 0.34, -height * 0.54);
      localCtx.lineTo(width * 0.14, -height * 0.46);
      localCtx.lineTo(width * 0.12, -height * 0.28);
      localCtx.lineTo(width * 0.26, -height * 0.34);
      localCtx.closePath();
      localCtx.fill();

      localCtx.fillRect(
        -width * 0.22,
        -height * 0.64,
        width * 0.44,
        height * 0.36,
      );
      localCtx.strokeRect(
        -width * 0.22,
        -height * 0.64,
        width * 0.44,
        height * 0.36,
      );

      localCtx.beginPath();
      localCtx.moveTo(-width * 0.08, -height * 0.64);
      localCtx.lineTo(0, -height * 0.78);
      localCtx.lineTo(width * 0.08, -height * 0.64);
      localCtx.closePath();
      localCtx.fill();
      localCtx.stroke();

      localCtx.beginPath();
      localCtx.arc(
        0,
        -height * 0.84,
        width * 0.16,
        0,
        Math.PI * 2,
      );
      localCtx.fill();
      localCtx.stroke();

      localCtx.strokeStyle = "#9ca3af";
      localCtx.beginPath();
      localCtx.moveTo(0, -height * 0.62);
      localCtx.lineTo(0, -height * 0.08);
      localCtx.stroke();

      localCtx.strokeStyle = "#cbd5e1";
      localCtx.fillStyle = "#94a3b8";
      localCtx.lineCap = "round";
      localCtx.lineJoin = "round";

      if (variant === "sword") {
        localCtx.beginPath();
        localCtx.moveTo(width * 0.26, -height * 0.74);
        localCtx.lineTo(width * 0.26, -height * 0.14);
        localCtx.stroke();

        localCtx.beginPath();
        localCtx.moveTo(width * 0.19, -height * 0.64);
        localCtx.lineTo(width * 0.34, -height * 0.82);
        localCtx.stroke();

        localCtx.strokeStyle = "#9ca3af";
        localCtx.beginPath();
        localCtx.moveTo(width * 0.16, -height * 0.44);
        localCtx.lineTo(width * 0.36, -height * 0.44);
        localCtx.stroke();
      } else if (variant === "spear") {
        localCtx.beginPath();
        localCtx.moveTo(width * 0.26, -height * 1.02);
        localCtx.lineTo(width * 0.26, -height * 0.08);
        localCtx.stroke();

        localCtx.fillStyle = "#e2e8f0";
        localCtx.beginPath();
        localCtx.moveTo(width * 0.26, -height * 1.12);
        localCtx.lineTo(width * 0.36, -height * 0.98);
        localCtx.lineTo(width * 0.26, -height * 0.9);
        localCtx.lineTo(width * 0.16, -height * 0.98);
        localCtx.closePath();
        localCtx.fill();
      } else if (variant === "shield") {
        localCtx.fillStyle = "#64748b";
        localCtx.beginPath();
        localCtx.moveTo(width * 0.22, -height * 0.56);
        localCtx.lineTo(width * 0.38, -height * 0.48);
        localCtx.lineTo(width * 0.34, -height * 0.22);
        localCtx.lineTo(width * 0.22, -height * 0.08);
        localCtx.lineTo(width * 0.1, -height * 0.22);
        localCtx.lineTo(width * 0.06, -height * 0.48);
        localCtx.closePath();
        localCtx.fill();
        localCtx.stroke();

        localCtx.strokeStyle = "#475569";
        localCtx.beginPath();
        localCtx.moveTo(width * 0.22, -height * 0.5);
        localCtx.lineTo(width * 0.22, -height * 0.12);
        localCtx.stroke();
        localCtx.beginPath();
        localCtx.moveTo(width * 0.12, -height * 0.32);
        localCtx.lineTo(width * 0.32, -height * 0.32);
        localCtx.stroke();
      } else {
        localCtx.beginPath();
        localCtx.moveTo(width * 0.26, -height * 1.02);
        localCtx.lineTo(width * 0.26, -height * 0.12);
        localCtx.stroke();

        localCtx.strokeStyle = "#e2e8f0";
        localCtx.beginPath();
        localCtx.moveTo(width * 0.08, -height * 0.76);
        localCtx.lineTo(width * 0.4, -height * 0.92);
        localCtx.stroke();
        localCtx.beginPath();
        localCtx.moveTo(width * 0.1, -height * 0.58);
        localCtx.lineTo(width * 0.42, -height * 0.74);
        localCtx.stroke();
      }

      localCtx.restore();
    },
  );
}


function drawKeepProjectedTorches3D(
  ctx,
  world,
  props,
) {
  drawProjectedWorldProps(
    ctx,
    world,
    props.keepTorches,
    13,
    (
      localCtx,
      localWorld,
      torch,
      projection,
      distance,
    ) => {
      const height = Math.max(
        26,
        Math.min(
          CANVAS_HEIGHT * 0.34,
          projection.scale * 0.55,
        ),
      );
      const baseY =
        CANVAS_HEIGHT * 0.57 +
        Math.min(
          CANVAS_HEIGHT * 0.08,
          projection.scale * 0.03,
        );
      const flicker =
        0.75 +
        0.25 *
          Math.sin(
            (localWorld.time ?? 0) * 7 +
              torch.tileX +
              torch.tileY,
          );

      localCtx.save();
      localCtx.translate(
        projection.screenX,
        baseY,
      );
      localCtx.globalCompositeOperation =
        "lighter";

      const glow =
        localCtx.createRadialGradient(
          0,
          -height * 0.8,
          0,
          0,
          -height * 0.8,
          height * 1.2,
        );
      glow.addColorStop(
        0,
        `rgba(251,191,36,${0.2 * flicker})`,
      );
      glow.addColorStop(
        0.4,
        `rgba(249,115,22,${0.12 * flicker})`,
      );
      glow.addColorStop(
        1,
        "rgba(0,0,0,0)",
      );

      localCtx.fillStyle = glow;
      localCtx.beginPath();
      localCtx.arc(
        0,
        -height * 0.8,
        height * 1.2,
        0,
        Math.PI * 2,
      );
      localCtx.fill();

      localCtx.globalCompositeOperation =
        "source-over";
      localCtx.strokeStyle = "#78350f";
      localCtx.lineWidth = Math.max(
        1,
        height * 0.08,
      );
      localCtx.beginPath();
      localCtx.moveTo(0, -height * 0.2);
      localCtx.lineTo(0, -height * 0.72);
      localCtx.stroke();

      localCtx.fillStyle = "#f97316";
      localCtx.beginPath();
      localCtx.moveTo(0, -height * 1.02);
      localCtx.quadraticCurveTo(
        height * 0.1,
        -height * 0.84,
        0,
        -height * 0.7,
      );
      localCtx.quadraticCurveTo(
        -height * 0.1,
        -height * 0.84,
        0,
        -height * 1.02,
      );
      localCtx.fill();

      localCtx.restore();
    },
  );
}

function drawKeepProjectedBanners3D(
  ctx,
  world,
  props,
) {
  drawProjectedWorldProps(
    ctx,
    world,
    props.keepBanners,
    12,
    (
      localCtx,
      localWorld,
      banner,
      projection,
      distance,
    ) => {
      const height = Math.max(
        34,
        Math.min(
          CANVAS_HEIGHT * 0.42,
          projection.scale * 0.62,
        ),
      );
      const width = height * 0.32;
      const baseY =
        CANVAS_HEIGHT * 0.56 +
        Math.min(
          CANVAS_HEIGHT * 0.1,
          projection.scale * 0.03,
        );
      const sway =
        Math.sin(
          (localWorld.time ?? 0) * 1.3 +
            banner.tileX,
        ) *
        width *
        0.12;

      localCtx.save();
      localCtx.translate(
        projection.screenX,
        baseY,
      );
      localCtx.globalAlpha =
        0.72 - Math.min(0.3, distance * 0.02);
      localCtx.fillStyle = "#7f1d1d";
      localCtx.beginPath();
      localCtx.moveTo(-width * 0.5, -height);
      localCtx.lineTo(width * 0.5, -height);
      localCtx.lineTo(
        width * 0.36 + sway,
        -height * 0.35,
      );
      localCtx.lineTo(
        sway,
        -height * 0.52,
      );
      localCtx.lineTo(
        -width * 0.36 + sway,
        -height * 0.35,
      );
      localCtx.closePath();
      localCtx.fill();
      localCtx.restore();
    },
  );
}

function drawOrbitalProjectedWeaponPickups3D(
  ctx,
  world,
) {
  const weaponPickups =
    (world.pickups ?? []).filter(
      (pickup) => pickup.type === "weapon",
    );

  drawProjectedWorldProps(
    ctx,
    world,
    weaponPickups.map((pickup) => ({
      ...pickup,
      tileX: Math.floor(pickup.x),
      tileY: Math.floor(pickup.y),
    })),
    14,
    (
      localCtx,
      localWorld,
      pickup,
      projection,
      distance,
    ) => {
      const radius = Math.max(
        12,
        Math.min(
          CANVAS_HEIGHT * 0.12,
          projection.scale * 0.16,
        ),
      );
      const centerY =
        CANVAS_HEIGHT * 0.58 -
        radius * 0.2 +
        Math.sin(
          (localWorld.time ?? 0) * 3 +
            pickup.x,
        ) *
          radius *
          0.08;

      localCtx.save();
      localCtx.translate(
        projection.screenX,
        centerY,
      );
      localCtx.globalCompositeOperation =
        "lighter";
      localCtx.strokeStyle =
        "rgba(103,232,249,0.9)";
      localCtx.lineWidth = Math.max(
        1.4,
        radius * 0.08,
      );
      localCtx.rotate(
        (localWorld.time ?? 0) * 1.1,
      );

      localCtx.beginPath();
      for (let side = 0; side < 6; side += 1) {
        const angle =
          side * (Math.PI / 3);
        const x =
          Math.cos(angle) * radius;
        const y =
          Math.sin(angle) * radius;

        if (side === 0) {
          localCtx.moveTo(x, y);
        } else {
          localCtx.lineTo(x, y);
        }
      }
      localCtx.closePath();
      localCtx.stroke();

      localCtx.rotate(
        -(localWorld.time ?? 0) * 1.1,
      );
      localCtx.globalAlpha = 0.5;

      for (let line = -2; line <= 2; line += 1) {
        localCtx.fillStyle =
          "rgba(207,250,254,0.7)";
        localCtx.fillRect(
          -radius * 0.6,
          line * radius * 0.2,
          radius * 1.2,
          1,
        );
      }

      localCtx.restore();
    },
  );
}

function drawOrbitalWreckPanels2D(
  ctx,
  world,
  props,
) {
  for (const wreck of props.orbitalWrecks) {
    if (
      visibleStrengthAt(
        world,
        wreck.tileX,
        wreck.tileY,
      ) <= 0.08
    ) {
      continue;
    }

    const screen =
      getWorldScreenPosition(
        world,
        wreck.x,
        wreck.y,
      );
    const size = screen.scale * 0.32;
    const angle =
      (world.time ?? 0) * 0.24 +
      wreck.tileX;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#64748b";
    ctx.fillRect(
      -size,
      -size * 0.22,
      size * 2,
      size * 0.44,
    );
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      -size,
      -size * 0.22,
      size * 2,
      size * 0.44,
    );
    ctx.restore();
  }
}

function drawEmeraldProjectedGrowth3D(
  ctx,
  world,
  props,
) {
  drawProjectedWorldProps(
    ctx,
    world,
    props.emeraldGrowth,
    13,
    (
      localCtx,
      localWorld,
      growth,
      projection,
      distance,
    ) => {
      const height = Math.max(
        34,
        Math.min(
          CANVAS_HEIGHT * 0.42,
          projection.scale * 0.62,
        ),
      );
      const width = height * 0.54;
      const baseY =
        CANVAS_HEIGHT * 0.69 +
        Math.min(
          CANVAS_HEIGHT * 0.08,
          projection.scale * 0.025,
        );
      const sway =
        Math.sin(
          (localWorld.time ?? 0) * 0.9 +
            growth.tileX,
        ) *
        width *
        0.08;

      localCtx.save();
      localCtx.translate(
        projection.screenX,
        baseY,
      );
      localCtx.globalAlpha =
        0.68 - Math.min(0.3, distance * 0.02);
      localCtx.strokeStyle = "#166534";
      localCtx.lineWidth = Math.max(
        1,
        width * 0.06,
      );
      localCtx.beginPath();
      localCtx.moveTo(0, 0);
      localCtx.bezierCurveTo(
        -width * 0.15,
        -height * 0.2,
        width * 0.12 + sway,
        -height * 0.55,
        sway,
        -height,
      );
      localCtx.stroke();

      localCtx.fillStyle = "#84cc16";
      for (let index = 0; index < 5; index += 1) {
        const py =
          -height *
          (0.24 + index * 0.16);
        const px =
          Math.sin(index + growth.tileY) *
          width *
          0.18;
        localCtx.beginPath();
        localCtx.ellipse(
          px,
          py,
          width * 0.18,
          width * 0.07,
          index % 2 ? -0.75 : 0.75,
          0,
          Math.PI * 2,
        );
        localCtx.fill();
      }

      localCtx.restore();
    },
  );
}

function drawEmeraldProjectedWater3D(
  ctx,
  world,
  props,
) {
  drawProjectedWorldProps(
    ctx,
    world,
    props.emeraldWater,
    11,
    (
      localCtx,
      localWorld,
      patch,
      projection,
      distance,
    ) => {
      const width = Math.max(
        16,
        Math.min(
          CANVAS_WIDTH * 0.12,
          projection.scale * 0.22,
        ),
      );
      const centerY =
        CANVAS_HEIGHT * 0.82 -
        Math.min(
          CANVAS_HEIGHT * 0.12,
          projection.scale * 0.02,
        );
      const ripple =
        Math.sin(
          (localWorld.time ?? 0) * 2 +
            patch.tileX +
            patch.tileY,
        );

      localCtx.save();
      localCtx.translate(
        projection.screenX,
        centerY,
      );
      localCtx.globalAlpha =
        0.16 - Math.min(0.06, distance * 0.005);
      localCtx.strokeStyle = "#bfdbfe";
      localCtx.lineWidth = 1.1;

      for (let line = 0; line < 3; line += 1) {
        const y = line * 4;
        localCtx.beginPath();
        localCtx.moveTo(
          -width * 0.6 + ripple * 1.4,
          y,
        );
        localCtx.lineTo(
          width * 0.6 + ripple * 1.4,
          y,
        );
        localCtx.stroke();
      }

      localCtx.restore();
    },
  );
}

function drawEmeraldInsects3D(ctx, world) {
  const time = world.time ?? 0;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let index = 0; index < 12; index += 1) {
    const angle =
      index * 2.1 + time * 1.4;
    const radius =
      34 + (index % 4) * 11;
    const x =
      CANVAS_WIDTH * 0.5 +
      Math.cos(angle) * radius;
    const y =
      CANVAS_HEIGHT * 0.78 +
      Math.sin(angle * 1.2) * radius * 0.22;
    ctx.globalAlpha =
      0.08 +
      (index % 3) * 0.03;
    ctx.fillStyle =
      index % 4 === 0
        ? "#d9f99d"
        : "#111827";
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawOrbitalRuinsIdentityGuaranteed(
  ctx,
  world,
) {
  drawOrbitalRuinsIdentity(ctx, world);

  const props = getThemePropCache(
    world,
    "space",
  );

  if (world.viewMode === "3d") {
    drawOrbitalProjectedWeaponPickups3D(
      ctx,
      world,
    );
    return;
  }

  drawOrbitalWreckPanels2D(
    ctx,
    world,
    props,
  );
}

function drawEmeraldWildsIdentityGuaranteed(
  ctx,
  world,
) {
  drawEmeraldWildsIdentity(ctx, world);

  if (world.viewMode !== "3d") {
    return;
  }

  const props = getThemePropCache(
    world,
    "jungle",
  );
  drawEmeraldProjectedGrowth3D(
    ctx,
    world,
    props,
  );
  drawEmeraldProjectedWater3D(
    ctx,
    world,
    props,
  );
  drawEmeraldInsects3D(ctx, world);
}

function drawFallenKeepIdentityGuaranteed(
  ctx,
  world,
) {
  drawFallenKeepIdentity(ctx, world);

  const props = getThemePropCache(
    world,
    "medieval",
  );

  if (world.viewMode === "3d") {
    drawKeepProjectedStatues3D(
      ctx,
      world,
      props,
    );
    drawKeepProjectedTorches3D(
      ctx,
      world,
      props,
    );
    drawKeepProjectedBanners3D(
      ctx,
      world,
      props,
    );
    return;
  }

  drawKeepGuaranteedStatues2D(
    ctx,
    world,
    props,
  );
}


function getVisualPassCache(world) {
  if (!world.__visualPassCache) {
    world.__visualPassCache = {
      wallMarks: [],
      initializedAt: world.time ?? 0,
    };
  }

  return world.__visualPassCache;
}

function pushWallMark(
  world,
  x,
  y,
  kind = "stone",
) {
  const cache = getVisualPassCache(world);

  cache.wallMarks.push({
    x,
    y,
    kind,
    createdAt: world.time ?? 0,
    ttl: kind === "orbital" ? 12 : 9,
  });

  if (cache.wallMarks.length > 90) {
    cache.wallMarks.splice(
      0,
      cache.wallMarks.length - 90,
    );
  }
}

function updateVisualPassCache(world) {
  const cache = getVisualPassCache(world);
  const now = world.time ?? 0;

  cache.wallMarks = cache.wallMarks.filter(
    (mark) => now - mark.createdAt <= mark.ttl,
  );

  for (const particle of world.wallImpactParticles ?? []) {
    if (particle.__visualPassSeen) {
      continue;
    }

    particle.__visualPassSeen = true;

    pushWallMark(
      world,
      particle.x,
      particle.y,
      world.level?.themeKey === "space"
        ? "orbital"
        : world.level?.themeKey === "city"
          ? "city"
          : world.level?.themeKey === "jungle"
            ? "jungle"
            : "stone",
    );
  }
}

function tileMaterialShade(world) {
  const themeKey = world.level?.themeKey;

  if (themeKey === "space") {
    return {
      floorBase: "#081528",
      floorAlt: "#0d2038",
      wallBase: "#56657c",
      wallAlt: "#3a4558",
      crack: "rgba(203,213,225,0.18)",
      edge: "rgba(255,255,255,0.06)",
    };
  }

  if (themeKey === "jungle") {
    return {
      floorBase: "#314228",
      floorAlt: "#3b4d30",
      wallBase: "#47633f",
      wallAlt: "#304928",
      crack: "rgba(20,83,45,0.22)",
      edge: "rgba(250,250,200,0.04)",
    };
  }

  if (themeKey === "medieval") {
    return {
      floorBase: "#3d342d",
      floorAlt: "#473c33",
      wallBase: "#6f655c",
      wallAlt: "#554d46",
      crack: "rgba(24,24,27,0.26)",
      edge: "rgba(255,245,220,0.05)",
    };
  }

  if (themeKey === "city") {
    return {
      floorBase: "#484b52",
      floorAlt: "#555962",
      wallBase: "#6c7280",
      wallAlt: "#5b606d",
      crack: "rgba(17,24,39,0.26)",
      edge: "rgba(255,255,255,0.04)",
    };
  }

  return {
    floorBase: "#2f3b46",
    floorAlt: "#394754",
    wallBase: "#5b6872",
    wallAlt: "#47545e",
    crack: "rgba(15,23,42,0.2)",
    edge: "rgba(255,255,255,0.04)",
  };
}

function drawMaterialSurfaces2D(ctx, world) {
  if (world.viewMode === "3d") {
    return;
  }

  const bounds = fxVisibleBounds(world);
  const theme = tileMaterialShade(world);

  ctx.save();

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      if (visibleStrengthAt(world, x, y) <= 0.05) {
        continue;
      }

      const screenX =
        (x - bounds.camera.x) *
        bounds.scale;
      const screenY =
        (y - bounds.camera.y) *
        bounds.scale;
      const isFloor = fxTileIsFloor(world, x, y);
      const n = fxNoise(x, y, 910);
      const fill =
        isFloor
          ? n > 0.5
            ? theme.floorBase
            : theme.floorAlt
          : n > 0.5
            ? theme.wallBase
            : theme.wallAlt;

      ctx.globalAlpha = 0.22;
      ctx.fillStyle = fill;
      ctx.fillRect(
        screenX,
        screenY,
        bounds.scale,
        bounds.scale,
      );

      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = theme.crack;
      ctx.lineWidth = Math.max(
        1,
        bounds.scale * 0.014,
      );

      if (isFloor) {
        if (n > 0.62) {
          ctx.beginPath();
          ctx.moveTo(
            screenX + bounds.scale * 0.18,
            screenY + bounds.scale * 0.24,
          );
          ctx.lineTo(
            screenX + bounds.scale * 0.48,
            screenY + bounds.scale * 0.42,
          );
          ctx.lineTo(
            screenX + bounds.scale * 0.72,
            screenY + bounds.scale * 0.3,
          );
          ctx.stroke();
        }

        if (world.level?.themeKey === "space" && n > 0.56) {
          ctx.globalAlpha = 0.1;
          ctx.strokeStyle =
            "rgba(56,189,248,0.18)";
          ctx.beginPath();
          ctx.moveTo(
            screenX + bounds.scale * 0.16,
            screenY + bounds.scale * 0.72,
          );
          ctx.lineTo(
            screenX + bounds.scale * 0.82,
            screenY + bounds.scale * 0.72,
          );
          ctx.stroke();
        }

        if (world.level?.themeKey === "city" && n > 0.58) {
          ctx.globalAlpha = 0.08;
          ctx.strokeStyle =
            "rgba(191,219,254,0.16)";
          ctx.beginPath();
          ctx.moveTo(
            screenX + bounds.scale * 0.2,
            screenY + bounds.scale * 0.62,
          );
          ctx.lineTo(
            screenX + bounds.scale * 0.8,
            screenY + bounds.scale * 0.62,
          );
          ctx.stroke();
        }
      } else {
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = theme.edge;
        ctx.strokeRect(
          screenX + 1,
          screenY + 1,
          bounds.scale - 2,
          bounds.scale - 2,
        );

        if (n > 0.55) {
          ctx.globalAlpha = 0.14;
          ctx.strokeStyle = theme.crack;
          ctx.beginPath();
          ctx.moveTo(
            screenX + bounds.scale * 0.2,
            screenY + bounds.scale * 0.16,
          );
          ctx.lineTo(
            screenX + bounds.scale * 0.76,
            screenY + bounds.scale * 0.66,
          );
          ctx.stroke();
        }
      }
    }
  }

  ctx.restore();
}

function drawWallMarks2D(ctx, world) {
  if (world.viewMode === "3d") {
    return;
  }

  const cache = getVisualPassCache(world);

  ctx.save();

  for (const mark of cache.wallMarks) {
    const tileX = Math.floor(mark.x);
    const tileY = Math.floor(mark.y);

    if (visibleStrengthAt(world, tileX, tileY) <= 0.05) {
      continue;
    }

    const screen = getWorldScreenPosition(
      world,
      mark.x,
      mark.y,
    );
    const age =
      (world.time ?? 0) - mark.createdAt;
    const alpha = Math.max(
      0,
      1 - age / mark.ttl,
    );

    ctx.globalAlpha = 0.3 * alpha;

    if (mark.kind === "orbital") {
      ctx.fillStyle = "rgba(147,197,253,0.7)";
      ctx.fillRect(
        screen.x - screen.scale * 0.1,
        screen.y - 1,
        screen.scale * 0.2,
        2,
      );
      continue;
    }

    if (mark.kind === "city") {
      ctx.fillStyle = "rgba(15,23,42,0.7)";
      ctx.beginPath();
      ctx.arc(
        screen.x,
        screen.y,
        Math.max(2, screen.scale * 0.08),
        0,
        Math.PI * 2,
      );
      ctx.fill();
      continue;
    }

    ctx.strokeStyle =
      mark.kind === "jungle"
        ? "rgba(20,83,45,0.65)"
        : "rgba(30,30,30,0.72)";
    ctx.lineWidth = Math.max(
      1,
      screen.scale * 0.03,
    );
    ctx.beginPath();
    ctx.moveTo(
      screen.x - screen.scale * 0.08,
      screen.y - screen.scale * 0.03,
    );
    ctx.lineTo(
      screen.x + screen.scale * 0.08,
      screen.y + screen.scale * 0.03,
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawOrbitalCruiserLandmark2D(
  ctx,
  world,
) {
  if (
    world.viewMode === "3d" ||
    world.level?.themeKey !== "space"
  ) {
    return;
  }

  const props = getThemePropCache(world, "space");

  if (!props.orbitalWrecks?.length) {
    return;
  }

  const wreck = props.orbitalWrecks[0];
  const screen = getWorldScreenPosition(
    world,
    wreck.x,
    wreck.y,
  );
  const size = screen.scale * 1.45;

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(0.28);
  ctx.globalAlpha = 0.5;

  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.moveTo(-size * 0.75, -size * 0.16);
  ctx.lineTo(size * 0.68, -size * 0.32);
  ctx.lineTo(size * 0.86, 0);
  ctx.lineTo(size * 0.2, size * 0.22);
  ctx.lineTo(-size * 0.62, size * 0.26);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.stroke();

  ctx.strokeStyle = "rgba(56,189,248,0.45)";
  ctx.beginPath();
  ctx.moveTo(-size * 0.32, -size * 0.02);
  ctx.lineTo(size * 0.18, -size * 0.08);
  ctx.stroke();

  ctx.restore();
}

function drawJungleLandmark2D(ctx, world) {
  if (
    world.viewMode === "3d" ||
    world.level?.themeKey !== "jungle"
  ) {
    return;
  }

  const props = getThemePropCache(world, "jungle");

  if (!props.emeraldGrowth?.length) {
    return;
  }

  const tree = props.emeraldGrowth[0];
  const screen = getWorldScreenPosition(
    world,
    tree.x,
    tree.y,
  );
  const size = screen.scale * 1.18;

  ctx.save();
  ctx.translate(screen.x, screen.y + screen.scale * 0.08);
  ctx.globalAlpha = 0.5;

  ctx.fillStyle = "#4d3321";
  ctx.fillRect(
    -size * 0.12,
    -size * 0.55,
    size * 0.24,
    size * 0.72,
  );

  ctx.fillStyle = "#3f6212";
  for (const [lx, ly, r] of [
    [0, -0.68, 0.28],
    [-0.2, -0.46, 0.25],
    [0.22, -0.44, 0.24],
    [0.02, -0.3, 0.26],
  ]) {
    ctx.beginPath();
    ctx.arc(
      size * lx,
      size * ly,
      size * r,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

function drawKeepLandmark2D(ctx, world) {
  if (
    world.viewMode === "3d" ||
    world.level?.themeKey !== "medieval"
  ) {
    return;
  }

  const props = getThemePropCache(world, "medieval");

  if (!props.keepStatues?.length) {
    return;
  }

  const statue = props.keepStatues[0];
  const screen = getWorldScreenPosition(
    world,
    statue.x,
    statue.y,
  );

  ctx.save();
  ctx.globalAlpha = 0.4;
  drawKeepStatueShape2D(
    ctx,
    screen.x,
    screen.y + screen.scale * 0.28,
    screen.scale * 1.18,
    getFacingAngle(statue),
    "shield",
  );
  ctx.restore();
}

function drawCityStorefrontEdges2D(
  ctx,
  world,
) {
  if (
    world.viewMode === "3d" ||
    world.level?.themeKey !== "city"
  ) {
    return;
  }

  const bounds = fxVisibleBounds(world);

  ctx.save();

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      if (
        fxTileIsFloor(world, x, y) ||
        visibleStrengthAt(world, x, y) <= 0.08 ||
        fxNoise(x, y, 931) > 0.16
      ) {
        continue;
      }

      const sx =
        (x - bounds.camera.x) * bounds.scale;
      const sy =
        (y - bounds.camera.y) * bounds.scale;

      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(
        sx + bounds.scale * 0.16,
        sy + bounds.scale * 0.18,
        bounds.scale * 0.68,
        bounds.scale * 0.44,
      );

      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        sx + bounds.scale * 0.16,
        sy + bounds.scale * 0.18,
        bounds.scale * 0.68,
        bounds.scale * 0.44,
      );
    }
  }

  ctx.restore();
}

function drawWeaponAnimationOverlay(ctx, world) {
  const weaponKey = world.player?.weapon;
  const definition =
    WEAPON_DEFINITIONS?.[weaponKey];

  if (!definition) {
    return;
  }

  const time = world.time ?? 0;
  const pulse = Math.max(
    0,
    1 - (time - (world.player?.lastAttackTime ?? -99)) * 7,
  );

  if (pulse <= 0) {
    return;
  }

  ctx.save();

  if (world.viewMode === "3d") {
    const baseX = CANVAS_WIDTH * 0.58;
    const baseY = CANVAS_HEIGHT * 0.86;
    const kick = pulse * 22;

    ctx.translate(baseX - kick, baseY + kick * 0.12);
    ctx.rotate(-pulse * 0.06);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#111827";

    if (weaponKey === "smg") {
      ctx.fillRect(-30, -8, 78, 16);
      ctx.fillRect(12, 8, 10, 18);
      ctx.fillStyle = "rgba(103,232,249,0.5)";
      ctx.fillRect(42, -4, 12, 8);
      ctx.fillRect(42, 4, 12, 8);
    } else if (weaponKey === "shotgun") {
      ctx.fillRect(-40, -10, 98, 20);
      ctx.fillRect(-8, 8, 14, 22);
    } else if (weaponKey === "bow") {
      ctx.strokeStyle = "rgba(180,83,9,0.65)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 28, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(226,232,240,0.5)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(10, -24);
      ctx.lineTo(10, 24);
      ctx.stroke();
    } else {
      ctx.fillRect(-28, -8, 76, 16);
      ctx.fillRect(4, 8, 10, 18);
    }

    ctx.restore();
    return;
  }

  const player = getWorldScreenPosition(
    world,
    world.player.x,
    world.player.y,
  );
  const facing = world.player.facing ?? 0;
  const offset =
    player.scale * (0.3 + pulse * 0.08);

  ctx.translate(
    player.x + Math.cos(facing) * offset,
    player.y + Math.sin(facing) * offset,
  );
  ctx.rotate(facing + pulse * 0.12);
  ctx.globalAlpha = 0.58;
  ctx.fillStyle = "#0f172a";

  if (weaponKey === "smg") {
    ctx.fillRect(
      -player.scale * 0.05,
      -player.scale * 0.03,
      player.scale * 0.34,
      player.scale * 0.06,
    );
    ctx.fillStyle = "rgba(103,232,249,0.58)";
    ctx.fillRect(
      player.scale * 0.22,
      -player.scale * 0.018,
      player.scale * 0.08,
      player.scale * 0.016,
    );
    ctx.fillRect(
      player.scale * 0.22,
      player.scale * 0.002,
      player.scale * 0.08,
      player.scale * 0.016,
    );
  } else if (weaponKey === "shotgun") {
    ctx.fillRect(
      -player.scale * 0.06,
      -player.scale * 0.035,
      player.scale * 0.4,
      player.scale * 0.07,
    );
  } else if (weaponKey === "bow") {
    ctx.strokeStyle = "rgba(180,83,9,0.75)";
    ctx.lineWidth = Math.max(
      2,
      player.scale * 0.03,
    );
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      player.scale * 0.12,
      -1.1,
      1.1,
    );
    ctx.stroke();
  } else {
    ctx.fillRect(
      -player.scale * 0.05,
      -player.scale * 0.03,
      player.scale * 0.28,
      player.scale * 0.06,
    );
  }

  ctx.restore();
}

function drawMaterialSurfacesAndLandmarks(
  ctx,
  world,
) {
  drawMaterialSurfaces2D(ctx, world);
  drawOrbitalCruiserLandmark2D(ctx, world);
  drawJungleLandmark2D(ctx, world);
  drawKeepLandmark2D(ctx, world);
  drawCityStorefrontEdges2D(ctx, world);
  drawWallMarks2D(ctx, world);
}

export function drawWorld(ctx, world) {
  updateVisualPassCache(world);
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
  drawMaterialSurfacesAndLandmarks(ctx, world);
  drawWorldIdentityEffects(ctx, world);
  drawEnemyPursuitVisuals(ctx, world);
  drawAnimatedPickupEffects(ctx, world);
  drawWeaponAnimationOverlay(ctx, world);
  drawCinematicParticles(ctx, world);
  drawEnemyHitReactions(ctx, world);

  ctx.restore();

  drawRunEscalationOverlay(ctx, world);
  drawResultOverlay(ctx, world);
}
