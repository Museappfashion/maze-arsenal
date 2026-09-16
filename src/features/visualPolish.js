// src/features/visualPolish.js
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DRAW_TILE,
  FLOOR,
  VIEW_3D_FOV,
} from "../config/constants.js";
import {
  getCamera,
  getWorldRenderZoom,
  visibleStrengthAt,
} from "../game/gameplay.js";
import { hasLineOfSight } from "../game/maze.js";

const STYLE_ID = "mist-visual-polish-style";
const CANVAS_ID = "mist-visual-polish-canvas";
const INSTALLED_KEY = "__mistMazeVisualPolishInstalled";

const THEME_GLOW = {
  city: [245, 158, 11],
  space: [34, 211, 238],
  jungle: [132, 204, 22],
  medieval: [251, 146, 60],
  labyrinth: [129, 140, 248],
};

const CSS = `
  #${CANVAS_ID} {
    position: absolute;
    inset: 0;
    z-index: 4;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .maze-frame {
    isolation: isolate;
    border: 1px solid rgba(148,163,184,.16);
    box-shadow:
      0 28px 80px rgba(0,0,0,.38),
      inset 0 0 0 1px rgba(255,255,255,.025);
  }
  .maze-frame > canvas:not(#${CANVAS_ID}) {
    filter: saturate(1.05) contrast(1.03);
  }
  .sidebar-tools-card,
  .three-d-sidebar-card,
  .three-d-settings-popover,
  .mobile-2d-tools-sidebar,
  .mobile-hud-chip {
    backdrop-filter: blur(14px) saturate(1.08);
    -webkit-backdrop-filter: blur(14px) saturate(1.08);
    box-shadow:
      0 14px 34px rgba(0,0,0,.24),
      inset 0 1px 0 rgba(255,255,255,.04);
  }
  .sidebar-tools-card button,
  .three-d-settings-popover button,
  .three-d-sidebar-actions button,
  .mobile-hud-actions button {
    transition:
      transform 120ms ease,
      box-shadow 120ms ease,
      border-color 120ms ease;
  }
  .sidebar-tools-card button:hover,
  .three-d-settings-popover button:hover,
  .three-d-sidebar-actions button:hover,
  .mobile-hud-actions button:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 22px rgba(0,0,0,.22);
  }
  @media (prefers-reduced-motion: reduce) {
    .sidebar-tools-card button,
    .three-d-settings-popover button,
    .three-d-sidebar-actions button,
    .mobile-hud-actions button {
      transition: none;
    }
  }
`;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hash(x, y, salt = 0) {
  let n =
    Math.imul(x + 31 + salt * 17, 374761393) ^
    Math.imul(y + 73 + salt * 29, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}

function normalizeAngle(angle) {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

function isFloor(world, x, y) {
  return Boolean(
    x >= 0 &&
      y >= 0 &&
      x < world.width &&
      y < world.height &&
      world.grid?.[y]?.[x] === FLOOR,
  );
}

function wallCount(world, x, y) {
  return (
    Number(!isFloor(world, x + 1, y)) +
    Number(!isFloor(world, x - 1, y)) +
    Number(!isFloor(world, x, y + 1)) +
    Number(!isFloor(world, x, y - 1))
  );
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function selectSpaced(candidates, count, salt, spacing) {
  const ordered = [...candidates].sort(
    (a, b) => hash(b.x, b.y, salt) - hash(a.x, a.y, salt),
  );
  const chosen = [];
  for (const item of ordered) {
    if (chosen.length >= count) break;
    if (chosen.some((other) => manhattan(item, other) < spacing)) continue;
    chosen.push({
      ...item,
      seed: Math.floor(hash(item.x, item.y, salt + 99) * 100000),
    });
  }
  return chosen;
}

function buildCache(world) {
  const theme = world.level?.themeKey ?? "city";
  const all = (world.floorTiles ?? [])
    .filter((tile) => {
      if (
        tile.x <= 1 ||
        tile.y <= 1 ||
        tile.x >= world.width - 2 ||
        tile.y >= world.height - 2
      ) {
        return false;
      }
      if (world.start && manhattan(tile, world.start) < 9) return false;
      if (world.exit && manhattan(tile, world.exit) < 6) return false;
      return true;
    })
    .map((tile) => ({
      ...tile,
      xCenter: tile.x + 0.5,
      yCenter: tile.y + 0.5,
      walls: wallCount(world, tile.x, tile.y),
    }));

  const nearWall = all.filter((tile) => tile.walls >= 1);
  const open = all.filter((tile) => tile.walls <= 1);

  const cache = {
    key: `${theme}:${world.width}x${world.height}`,
    theme,
    cityCars: [],
    citySigns: [],
    cityLamps: [],
    spaceDebris: [],
    spaceBeacons: [],
    junglePlants: [],
    jungleLogs: [],
    jungleWater: [],
    keepStatues: [],
    keepTorches: [],
    keepRubble: [],
    runes: [],
    monoliths: [],
  };

  if (theme === "city") {
    cache.cityCars = selectSpaced(open, 10, 101, 6);
    cache.citySigns = selectSpaced(nearWall, 12, 102, 5);
    cache.cityLamps = selectSpaced(nearWall, 9, 103, 6);
  } else if (theme === "space") {
    cache.spaceDebris = selectSpaced(open, 18, 201, 5);
    cache.spaceBeacons = selectSpaced(nearWall, 8, 202, 7);
  } else if (theme === "jungle") {
    cache.junglePlants = selectSpaced(nearWall, 22, 301, 4);
    cache.jungleLogs = selectSpaced(open, 6, 302, 9);
    cache.jungleWater = selectSpaced(open, 10, 303, 7);
  } else if (theme === "medieval") {
    cache.keepStatues = selectSpaced(nearWall, 14, 401, 6);
    cache.keepTorches = selectSpaced(nearWall, 14, 402, 5);
    cache.keepRubble = selectSpaced(open, 14, 403, 5);
  } else if (theme === "labyrinth") {
    cache.runes = selectSpaced(nearWall, 16, 501, 5);
    cache.monoliths = selectSpaced(open, 7, 502, 9);
  }

  world.__visualPolishCache = cache;
  return cache;
}

function getCache(world) {
  const key =
    `${world.level?.themeKey ?? "city"}:${world.width}x${world.height}`;
  return world.__visualPolishCache?.key === key
    ? world.__visualPolishCache
    : buildCache(world);
}

function occupied(world, prop) {
  const same = (entity) =>
    entity &&
    Math.floor(entity.x) === prop.x &&
    Math.floor(entity.y) === prop.y;

  return (
    same(world.player) ||
    [world.enemies, world.pickups, world.projectiles].some((group) =>
      (group ?? []).some(same),
    )
  );
}

function screen2D(world, x, y) {
  const camera = getCamera(world);
  const scale = DRAW_TILE * getWorldRenderZoom(world);
  return {
    x: (x - camera.x) * scale,
    y: (y - camera.y) * scale,
    scale,
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height,
  );
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shadowEllipse(ctx, width, height, y = 0) {
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.ellipse(0, y, width, height, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpaceDebris(ctx, size, seed, time, alpha = 1) {
  ctx.save();
  ctx.rotate(
    (seed % 2 ? 1 : -1) *
      (time * 0.025 + seed * 0.001),
  );
  ctx.globalAlpha *= alpha;

  shadowEllipse(
    ctx,
    size * 0.82,
    size * 0.24,
    size * 0.24,
  );

  const rock = ctx.createRadialGradient(
    -size * 0.22,
    -size * 0.28,
    size * 0.05,
    0,
    0,
    size,
  );
  rock.addColorStop(0, "#b6c2cf");
  rock.addColorStop(0.25, "#64748b");
  rock.addColorStop(0.62, "#334155");
  rock.addColorStop(1, "#111827");

  ctx.fillStyle = rock;
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = Math.max(1, size * 0.026);

  ctx.beginPath();

  for (let point = 0; point < 11; point += 1) {
    const angle =
      (point / 11) *
      Math.PI *
      2;
    const noise =
      0.74 +
      hash(seed, point, 41) *
        0.28;
    const radius = size * noise;
    const x =
      Math.cos(angle) *
      radius;
    const y =
      Math.sin(angle) *
      radius *
      (0.66 +
        hash(seed, point, 42) *
          0.12);

    if (point === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const craterCount =
    4 + (seed % 3);

  for (
    let crater = 0;
    crater < craterCount;
    crater += 1
  ) {
    const cx =
      (hash(seed, crater, 51) -
        0.5) *
      size *
      0.95;
    const cy =
      (hash(seed, crater, 52) -
        0.5) *
      size *
      0.58;
    const radius =
      size *
      (0.07 +
        hash(seed, crater, 53) *
          0.11);

    ctx.fillStyle =
      "rgba(15,23,42,.38)";
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      radius,
      radius * 0.58,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.strokeStyle =
      "rgba(226,232,240,.16)";
    ctx.stroke();
  }

  if (seed % 4 === 0) {
    ctx.strokeStyle =
      "rgba(56,189,248,.35)";
    ctx.lineWidth =
      Math.max(
        1,
        size * 0.015,
      );
    ctx.beginPath();
    ctx.moveTo(
      -size * 0.38,
      size * 0.08,
    );
    ctx.lineTo(
      size * 0.34,
      -size * 0.16,
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawBeacon(ctx, size, seed, time) {
  ctx.save();

  ctx.rotate(
    (seed % 2 ? 1 : -1) *
      (time * 0.08 + seed * 0.002),
  );

  shadowEllipse(
    ctx,
    size * 0.74,
    size * 0.18,
    size * 0.2,
  );

  const panel = ctx.createLinearGradient(
    -size,
    -size,
    size,
    size,
  );
  panel.addColorStop(0, "#2563eb");
  panel.addColorStop(0.5, "#172554");
  panel.addColorStop(1, "#020617");

  ctx.fillStyle = panel;
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = Math.max(1, size * 0.025);

  ctx.beginPath();
  ctx.moveTo(
    -size * 0.72,
    -size * 0.34,
  );
  ctx.lineTo(
    size * 0.64,
    -size * 0.2,
  );
  ctx.lineTo(
    size * 0.5,
    size * 0.34,
  );
  ctx.lineTo(
    -size * 0.66,
    size * 0.22,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle =
    "rgba(147,197,253,.58)";
  ctx.lineWidth =
    Math.max(
      1,
      size * 0.012,
    );

  for (
    let line = -2;
    line <= 2;
    line += 1
  ) {
    ctx.beginPath();
    ctx.moveTo(
      -size * 0.6,
      line * size * 0.1,
    );
    ctx.lineTo(
      size * 0.52,
      line * size * 0.07,
    );
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(
    -size * 0.2,
    -size * 0.28,
  );
  ctx.lineTo(
    -size * 0.12,
    size * 0.26,
  );
  ctx.moveTo(
    size * 0.22,
    -size * 0.24,
  );
  ctx.lineTo(
    size * 0.18,
    size * 0.29,
  );
  ctx.stroke();

  ctx.strokeStyle = "#64748b";
  ctx.lineWidth =
    Math.max(
      1,
      size * 0.02,
    );
  ctx.beginPath();
  ctx.moveTo(
    size * 0.55,
    -size * 0.08,
  );
  ctx.lineTo(
    size * 0.82,
    -size * 0.24,
  );
  ctx.moveTo(
    size * 0.52,
    size * 0.08,
  );
  ctx.lineTo(
    size * 0.78,
    size * 0.28,
  );
  ctx.stroke();

  ctx.restore();
}

function drawPlant(ctx, size, seed, time) {
  ctx.save();
  shadowEllipse(ctx, size * 0.55, size * 0.18, size * 0.23);
  const sway = Math.sin(time * 0.7 + seed * 0.13) * size * 0.04;
  const colors = ["#166534", "#15803d", "#3f6212", "#4d7c0f", "#65a30d"];
  ctx.strokeStyle = "#365314";
  ctx.lineWidth = Math.max(1, size * 0.035);

  for (let i = 0; i < 8; i += 1) {
    const angle = -Math.PI * 0.9 + i * 0.26 + (seed % 5) * 0.03;
    const length = size * (0.5 + hash(seed, i, 17) * 0.28);
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(sway * (i / 8), 0);
    ctx.fillStyle = colors[(i + seed) % colors.length];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(
      length * 0.2,
      -size * 0.12,
      length * 0.72,
      -size * 0.1,
      length,
      0,
    );
    ctx.bezierCurveTo(
      length * 0.72,
      size * 0.1,
      length * 0.2,
      size * 0.12,
      0,
      0,
    );
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(190,242,100,.3)";
    ctx.lineWidth = Math.max(0.7, size * 0.015);
    ctx.beginPath();
    ctx.moveTo(length * 0.12, 0);
    ctx.lineTo(length * 0.82, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawIdol(ctx, size, seed) {
  ctx.save();

  ctx.rotate(
    (seed % 2 ? 1 : -1) *
      (0.16 +
        (seed % 5) * 0.035),
  );

  shadowEllipse(
    ctx,
    size * 0.82,
    size * 0.2,
    size * 0.2,
  );

  const bark = ctx.createLinearGradient(
    -size,
    0,
    size,
    0,
  );
  bark.addColorStop(0, "#2f241b");
  bark.addColorStop(0.4, "#5c3d24");
  bark.addColorStop(1, "#3f2d1e");

  ctx.fillStyle = bark;
  ctx.strokeStyle = "#1c1917";
  ctx.lineWidth =
    Math.max(
      1,
      size * 0.025,
    );

  roundedRect(
    ctx,
    -size * 0.72,
    -size * 0.18,
    size * 1.44,
    size * 0.36,
    size * 0.15,
  );
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#7c5a35";
  ctx.lineWidth =
    Math.max(
      1,
      size * 0.014,
    );

  for (
    let line = -2;
    line <= 2;
    line += 1
  ) {
    ctx.beginPath();
    ctx.moveTo(
      -size * 0.56,
      line * size * 0.045,
    );
    ctx.lineTo(
      size * 0.5,
      line * size * 0.03,
    );
    ctx.stroke();
  }

  ctx.fillStyle = "#65a30d";

  for (
    let moss = 0;
    moss < 5;
    moss += 1
  ) {
    ctx.beginPath();
    ctx.arc(
      -size * 0.42 +
        moss * size * 0.22,
      -size * 0.16 +
        (moss % 2) *
          size *
          0.04,
      size * 0.07,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.strokeStyle = "#3f6212";
  ctx.lineWidth =
    Math.max(
      1,
      size * 0.025,
    );
  ctx.beginPath();
  ctx.moveTo(
    -size * 0.54,
    -size * 0.08,
  );
  ctx.bezierCurveTo(
    -size * 0.34,
    -size * 0.34,
    -size * 0.08,
    -size * 0.26,
    size * 0.12,
    -size * 0.18,
  );
  ctx.stroke();

  ctx.restore();
}

function drawWater(ctx, size, seed, time) {
  ctx.save();
  const shimmer = 0.5 + Math.sin(time * 1.7 + seed) * 0.18;
  const water = ctx.createRadialGradient(0, 0, size * 0.08, 0, 0, size);
  water.addColorStop(
    0,
    `rgba(34,197,94,${0.16 + shimmer * 0.07})`,
  );
  water.addColorStop(0.55, "rgba(6,95,70,.2)");
  water.addColorStop(1, "rgba(6,78,59,0)");
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(110,231,183,.42)";
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (let ring = 0; ring < 3; ring += 1) {
    const phase = (time * 0.32 + ring / 3 + (seed % 7) * 0.07) % 1;
    ctx.globalAlpha = 0.5 * (1 - phase);
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      size * (0.28 + phase * 0.62),
      size * (0.12 + phase * 0.26),
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawStatue(ctx, size, seed, alpha = 1) {
  const variant = seed % 4;
  ctx.save();
  ctx.globalAlpha *= alpha;
  shadowEllipse(ctx, size * 0.42, size * 0.13, size * 0.38);

  const stone = ctx.createLinearGradient(
    -size * 0.4,
    -size * 0.8,
    size * 0.35,
    size * 0.3,
  );
  stone.addColorStop(0, "#a8a29e");
  stone.addColorStop(0.3, "#78716c");
  stone.addColorStop(0.66, "#57534e");
  stone.addColorStop(1, "#292524");
  ctx.fillStyle = stone;
  ctx.strokeStyle = "#d6d3d1";
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.lineJoin = "round";

  ctx.fillRect(-size * 0.36, size * 0.2, size * 0.72, size * 0.14);
  ctx.strokeRect(-size * 0.36, size * 0.2, size * 0.72, size * 0.14);
  ctx.fillRect(-size * 0.25, size * 0.1, size * 0.5, size * 0.1);
  ctx.strokeRect(-size * 0.25, size * 0.1, size * 0.5, size * 0.1);

  ctx.beginPath();
  ctx.moveTo(-size * 0.2, size * 0.11);
  ctx.lineTo(-size * 0.24, -size * 0.18);
  ctx.lineTo(-size * 0.3, -size * 0.5);
  ctx.lineTo(-size * 0.16, -size * 0.66);
  ctx.lineTo(-size * 0.08, -size * 0.28);
  ctx.lineTo(-size * 0.04, size * 0.1);
  ctx.lineTo(size * 0.04, size * 0.1);
  ctx.lineTo(size * 0.08, -size * 0.28);
  ctx.lineTo(size * 0.16, -size * 0.66);
  ctx.lineTo(size * 0.3, -size * 0.5);
  ctx.lineTo(size * 0.24, -size * 0.18);
  ctx.lineTo(size * 0.2, size * 0.11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillRect(-size * 0.17, -size * 0.51, size * 0.34, size * 0.42);
  ctx.strokeRect(-size * 0.17, -size * 0.51, size * 0.34, size * 0.42);

  ctx.beginPath();
  ctx.arc(0, -size * 0.65, size * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-size * 0.1, -size * 0.55);
  ctx.lineTo(0, -size * 0.78);
  ctx.lineTo(size * 0.1, -size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(231,229,228,.72)";
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.48);
  ctx.lineTo(0, -size * 0.17);
  ctx.moveTo(-size * 0.08, -size * 0.34);
  ctx.lineTo(size * 0.08, -size * 0.34);
  ctx.stroke();

  ctx.strokeStyle = "rgba(41,37,36,.55)";
  ctx.beginPath();
  ctx.moveTo(-size * 0.08, -size * 0.5);
  ctx.lineTo(-size * 0.02, -size * 0.38);
  ctx.lineTo(-size * 0.07, -size * 0.25);
  ctx.stroke();

  ctx.strokeStyle = "#d6d3d1";
  ctx.fillStyle = "#78716c";
  ctx.lineWidth = Math.max(1.2, size * 0.035);

  if (variant === 0) {
    ctx.beginPath();
    ctx.moveTo(size * 0.25, -size * 0.58);
    ctx.lineTo(size * 0.25, size * 0.07);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.15, -size * 0.42);
    ctx.lineTo(size * 0.34, -size * 0.58);
    ctx.stroke();
  } else if (variant === 1) {
    ctx.beginPath();
    ctx.moveTo(size * 0.25, -size * 0.76);
    ctx.lineTo(size * 0.25, size * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.25, -size * 0.84);
    ctx.lineTo(size * 0.34, -size * 0.7);
    ctx.lineTo(size * 0.25, -size * 0.63);
    ctx.lineTo(size * 0.16, -size * 0.7);
    ctx.closePath();
    ctx.fill();
  } else if (variant === 2) {
    ctx.beginPath();
    ctx.moveTo(size * 0.16, -size * 0.36);
    ctx.lineTo(size * 0.38, -size * 0.28);
    ctx.lineTo(size * 0.34, size * 0.02);
    ctx.lineTo(size * 0.25, size * 0.13);
    ctx.lineTo(size * 0.14, size * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(size * 0.25, -size * 0.8);
    ctx.lineTo(size * 0.25, size * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.06, -size * 0.55);
    ctx.lineTo(size * 0.4, -size * 0.68);
    ctx.moveTo(size * 0.08, -size * 0.38);
    ctx.lineTo(size * 0.4, -size * 0.52);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTorch(ctx, size, seed, time) {
  const flicker =
    0.82 +
    Math.sin(time * 9.2 + seed) * 0.08 +
    Math.sin(time * 15.7 + seed * 0.3) * 0.05;

  ctx.save();
  const glow = ctx.createRadialGradient(
    0,
    -size * 0.28,
    0,
    0,
    -size * 0.28,
    size * 1.1,
  );
  glow.addColorStop(0, `rgba(251,146,60,${0.3 * flicker})`);
  glow.addColorStop(0.4, `rgba(245,158,11,${0.12 * flicker})`);
  glow.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -size * 0.28, size * 1.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#57534e";
  ctx.lineWidth = Math.max(1.5, size * 0.09);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.32);
  ctx.lineTo(0, -size * 0.13);
  ctx.stroke();

  const flame = ctx.createLinearGradient(0, -size * 0.62, 0, -size * 0.12);
  flame.addColorStop(0, "#fef3c7");
  flame.addColorStop(0.42, "#fbbf24");
  flame.addColorStop(1, "#ea580c");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.62 * flicker);
  ctx.bezierCurveTo(
    -size * 0.22,
    -size * 0.4,
    -size * 0.15,
    -size * 0.16,
    0,
    -size * 0.12,
  );
  ctx.bezierCurveTo(
    size * 0.17,
    -size * 0.2,
    size * 0.2,
    -size * 0.42,
    0,
    -size * 0.62 * flicker,
  );
  ctx.fill();
  ctx.restore();
}

function drawRubble(ctx, size, seed) {
  ctx.save();
  shadowEllipse(ctx, size * 0.65, size * 0.18, size * 0.14);
  const colors = ["#57534e", "#78716c", "#44403c", "#a8a29e"];
  for (let i = 0; i < 7; i += 1) {
    const x = (hash(seed, i, 61) - 0.5) * size * 0.9;
    const y = (hash(seed, i, 62) - 0.3) * size * 0.18;
    const r = size * (0.09 + hash(seed, i, 63) * 0.12);
    ctx.fillStyle = colors[(i + seed) % colors.length];
    ctx.strokeStyle = "#292524";
    ctx.lineWidth = Math.max(0.7, size * 0.012);
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x - r * 0.35, y - r * 0.7);
    ctx.lineTo(x + r * 0.8, y - r * 0.45);
    ctx.lineTo(x + r, y + r * 0.35);
    ctx.lineTo(x - r * 0.5, y + r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (seed % 2 === 0) {
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.beginPath();
    ctx.arc(size * 0.12, -size * 0.02, size * 0.22, -2.4, 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCar(ctx, size, seed) {
  ctx.save();
  ctx.rotate((seed % 4) * (Math.PI / 2) + (seed % 3 - 1) * 0.06);
  shadowEllipse(ctx, size * 0.75, size * 0.28, size * 0.12);

  const palettes = [
    ["#7f1d1d", "#450a0a"],
    ["#334155", "#0f172a"],
    ["#1e3a8a", "#172554"],
    ["#3f3f46", "#18181b"],
  ];
  const colors = palettes[seed % palettes.length];
  const body = ctx.createLinearGradient(-size, 0, size, 0);
  body.addColorStop(0, colors[0]);
  body.addColorStop(1, colors[1]);

  ctx.fillStyle = body;
  ctx.strokeStyle = "#71717a";
  ctx.lineWidth = Math.max(1, size * 0.025);
  roundedRect(
    ctx,
    -size * 0.72,
    -size * 0.3,
    size * 1.44,
    size * 0.6,
    size * 0.16,
  );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#111827";
  roundedRect(
    ctx,
    -size * 0.28,
    -size * 0.25,
    size * 0.56,
    size * 0.5,
    size * 0.1,
  );
  ctx.fill();

  ctx.strokeStyle = "rgba(191,219,254,.7)";
  ctx.lineWidth = Math.max(1, size * 0.016);
  ctx.beginPath();
  ctx.moveTo(-size * 0.19, -size * 0.18);
  ctx.lineTo(size * 0.08, size * 0.02);
  ctx.lineTo(-size * 0.04, size * 0.17);
  ctx.moveTo(size * 0.08, size * 0.02);
  ctx.lineTo(size * 0.21, -size * 0.14);
  ctx.stroke();

  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(size * 0.61, -size * 0.2, size * 0.08, size * 0.14);
  ctx.fillRect(size * 0.61, size * 0.06, size * 0.08, size * 0.14);
  ctx.fillStyle = "#7f1d1d";
  ctx.fillRect(-size * 0.69, -size * 0.2, size * 0.07, size * 0.14);
  ctx.fillRect(-size * 0.69, size * 0.06, size * 0.07, size * 0.14);
  ctx.restore();
}

function drawSign(ctx, size, seed, time) {
  const flicker =
    seed % 4 === 0
      ? 0.55 + 0.45 * Math.max(0, Math.sin(time * 5 + seed))
      : 1;
  const color = seed % 2 === 0 ? [56, 189, 248] : [244, 63, 94];

  ctx.save();
  ctx.strokeStyle = "#52525b";
  ctx.lineWidth = Math.max(1, size * 0.055);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.44);
  ctx.lineTo(0, -size * 0.25);
  ctx.stroke();

  ctx.shadowColor = `rgb(${color.join(",")})`;
  ctx.shadowBlur = size * 0.22 * flicker;
  ctx.fillStyle = `rgba(${color.join(",")},${0.3 * flicker})`;
  ctx.strokeStyle = `rgba(${color.join(",")},${0.9 * flicker})`;
  ctx.lineWidth = Math.max(1, size * 0.035);
  roundedRect(
    ctx,
    -size * 0.42,
    -size * 0.52,
    size * 0.84,
    size * 0.34,
    size * 0.07,
  );
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(255,255,255,${0.55 * flicker})`;
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.beginPath();
  ctx.moveTo(-size * 0.25, -size * 0.36);
  ctx.lineTo(size * 0.2, -size * 0.36);
  ctx.stroke();
  ctx.restore();
}

function drawLamp(ctx, size, seed, time) {
  const pulse = 0.88 + Math.sin(time * 1.3 + seed) * 0.04;
  ctx.save();
  const glow = ctx.createRadialGradient(
    0,
    -size * 0.35,
    0,
    0,
    -size * 0.35,
    size * 1.2,
  );
  glow.addColorStop(0, `rgba(251,191,36,${0.18 * pulse})`);
  glow.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -size * 0.35, size * 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3f3f46";
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.lineTo(0, -size * 0.34);
  ctx.lineTo(size * 0.2, -size * 0.34);
  ctx.stroke();

  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "#f59e0b";
  ctx.shadowBlur = size * 0.16;
  ctx.beginPath();
  ctx.arc(size * 0.22, -size * 0.34, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRune(ctx, size, seed, time) {
  const pulse = 0.55 + 0.25 * Math.sin(time * 1.8 + seed);
  ctx.save();
  ctx.rotate((seed % 8) * (Math.PI / 4));
  ctx.strokeStyle = `rgba(129,140,248,${0.42 + pulse * 0.22})`;
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.shadowColor = "#818cf8";
  ctx.shadowBlur = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.38);
  ctx.lineTo(size * 0.3, 0);
  ctx.lineTo(0, size * 0.38);
  ctx.lineTo(-size * 0.3, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-size * 0.2, 0);
  ctx.lineTo(size * 0.2, 0);
  ctx.moveTo(0, -size * 0.26);
  ctx.lineTo(0, size * 0.26);
  ctx.stroke();
  ctx.restore();
}

function drawMonolith(ctx, size, seed, time) {
  ctx.save();
  shadowEllipse(ctx, size * 0.42, size * 0.14, size * 0.28);
  const stone = ctx.createLinearGradient(
    -size * 0.3,
    -size,
    size * 0.3,
    size,
  );
  stone.addColorStop(0, "#312e81");
  stone.addColorStop(0.45, "#1e1b4b");
  stone.addColorStop(1, "#09090b");
  ctx.fillStyle = stone;
  ctx.strokeStyle = "rgba(165,180,252,.5)";
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(-size * 0.24, size * 0.24);
  ctx.lineTo(-size * 0.18, -size * 0.48);
  ctx.lineTo(0, -size * 0.72);
  ctx.lineTo(size * 0.2, -size * 0.46);
  ctx.lineTo(size * 0.24, size * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawRune(ctx, size * 0.45, seed, time);
  ctx.restore();
}

function draw2D(ctx, world, cache) {
  const time = world.time ?? 0;

  const paint = (prop, threshold, fn) => {
    if (occupied(world, prop)) return;
    if (visibleStrengthAt(world, prop.x, prop.y) < threshold) return;

    const screen = screen2D(world, prop.xCenter, prop.yCenter);
    if (
      screen.x < -screen.scale * 2 ||
      screen.y < -screen.scale * 2 ||
      screen.x > CANVAS_WIDTH + screen.scale * 2 ||
      screen.y > CANVAS_HEIGHT + screen.scale * 2
    ) {
      return;
    }

    ctx.save();
    ctx.translate(screen.x, screen.y);
    fn(screen.scale, prop);
    ctx.restore();
  };

  if (cache.theme === "space") {
    for (const p of cache.spaceDebris) {
      paint(p, 0.12, (s, item) =>
        drawSpaceDebris(
          ctx,
          s * (item.seed % 5 === 0 ? 0.72 : 0.5),
          item.seed,
          time,
          item.seed % 5 === 0 ? 0.95 : 0.82,
        ),
      );
    }
    for (const p of cache.spaceBeacons) {
      paint(p, 0.16, (s, item) =>
        drawBeacon(ctx, s * 0.46, item.seed, time),
      );
    }
  } else if (cache.theme === "jungle") {
    for (const p of cache.jungleWater) {
      paint(p, 0.1, (s, item) =>
        drawWater(ctx, s * 0.75, item.seed, time),
      );
    }
    for (const p of cache.junglePlants) {
      paint(p, 0.11, (s, item) =>
        drawPlant(ctx, s * 0.56, item.seed, time),
      );
    }
    for (const p of cache.jungleLogs) {
      paint(p, 0.15, (s, item) =>
        drawIdol(ctx, s * 0.62, item.seed),
      );
    }
  } else if (cache.theme === "medieval") {
    for (const p of cache.keepRubble) {
      paint(p, 0.1, (s, item) =>
        drawRubble(ctx, s * 0.58, item.seed),
      );
    }
    for (const p of cache.keepStatues) {
      paint(p, 0.14, (s, item) =>
        drawStatue(ctx, s * 0.68, item.seed, 0.9),
      );
    }
    for (const p of cache.keepTorches) {
      paint(p, 0.14, (s, item) =>
        drawTorch(ctx, s * 0.44, item.seed, time),
      );
    }
  } else if (cache.theme === "city") {
    for (const p of cache.cityCars) {
      paint(p, 0.12, (s, item) =>
        drawCar(ctx, s * 0.62, item.seed),
      );
    }
    for (const p of cache.citySigns) {
      paint(p, 0.12, (s, item) =>
        drawSign(ctx, s * 0.5, item.seed, time),
      );
    }
    for (const p of cache.cityLamps) {
      paint(p, 0.12, (s, item) =>
        drawLamp(ctx, s * 0.46, item.seed, time),
      );
    }
  } else if (cache.theme === "labyrinth") {
    for (const p of cache.runes) {
      paint(p, 0.06, (s, item) =>
        drawRune(ctx, s * 0.38, item.seed, time),
      );
    }
    for (const p of cache.monoliths) {
      paint(p, 0.08, (s, item) =>
        drawMonolith(ctx, s * 0.6, item.seed, time),
      );
    }
  }
}

function project3D(world, prop) {
  const x = prop.xCenter ?? prop.x + 0.5;
  const y = prop.yCenter ?? prop.y + 0.5;
  const dx = x - world.player.x;
  const dy = y - world.player.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 0.7 || distance > 12.5) return null;

  const angle = Math.atan2(dy, dx);
  const relative = normalizeAngle(angle - (world.player.facing ?? 0));
  if (Math.abs(relative) > VIEW_3D_FOV * 0.58) return null;

  if (
    !hasLineOfSight(
      world,
      world.player.x,
      world.player.y,
      x,
      y,
    )
  ) {
    return null;
  }

  const depth = distance * Math.cos(relative);
  if (depth <= 0.08) return null;

  const plane = CANVAS_WIDTH / 2 / Math.tan(VIEW_3D_FOV / 2);
  return {
    distance,
    screenX: CANVAS_WIDTH / 2 + Math.tan(relative) * plane,
    scale: plane / depth,
  };
}

function propList3D(cache) {
  const tagged = (items, type) => items.map((item) => ({ ...item, type }));

  if (cache.theme === "space") {
    return [
      ...tagged(cache.spaceDebris, "spaceDebris"),
      ...tagged(cache.spaceBeacons, "spaceBeacon"),
    ];
  }
  if (cache.theme === "jungle") {
    return [
      ...tagged(cache.junglePlants, "plant"),
      ...tagged(cache.jungleLogs, "log"),
    ];
  }
  if (cache.theme === "medieval") {
    return [
      ...tagged(cache.keepStatues, "statue"),
      ...tagged(cache.keepTorches, "torch"),
    ];
  }
  if (cache.theme === "city") {
    return [
      ...tagged(cache.citySigns, "sign"),
      ...tagged(cache.cityLamps, "lamp"),
    ];
  }
  if (cache.theme === "labyrinth") {
    return [
      ...tagged(cache.monoliths, "monolith"),
      ...tagged(cache.runes, "rune"),
    ];
  }
  return [];
}

function draw3D(ctx, world, cache) {
  const time = world.time ?? 0;
  const props = propList3D(cache)
    .map((prop) => ({ prop, projection: project3D(world, prop) }))
    .filter((entry) => entry.projection)
    .sort((a, b) => b.projection.distance - a.projection.distance)
    .slice(0, 18);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT * 0.77);
  ctx.clip();

  for (const { prop, projection } of props) {
    const fade = clamp(1 - projection.distance / 15, 0.28, 0.94);
    const y =
      CANVAS_HEIGHT * 0.66 +
      Math.min(CANVAS_HEIGHT * 0.09, projection.scale * 0.024);

    ctx.save();
    ctx.translate(projection.screenX, y);
    ctx.globalAlpha = fade;

    if (prop.type === "spaceDebris") {
      drawSpaceDebris(
        ctx,
        clamp(projection.scale * 0.18, 16, 120),
        prop.seed,
        time * 0.35,
        0.9,
      );
    } else if (prop.type === "spaceBeacon") {
      drawBeacon(
        ctx,
        clamp(projection.scale * 0.15, 14, 92),
        prop.seed,
        time,
      );
    } else if (prop.type === "plant") {
      drawPlant(
        ctx,
        clamp(projection.scale * 0.22, 18, 120),
        prop.seed,
        time,
      );
    } else if (prop.type === "log") {
      drawIdol(
        ctx,
        clamp(projection.scale * 0.21, 22, 135),
        prop.seed,
      );
    } else if (prop.type === "statue") {
      drawStatue(
        ctx,
        clamp(projection.scale * 0.25, 28, 160),
        prop.seed,
        0.88,
      );
    } else if (prop.type === "torch") {
      drawTorch(
        ctx,
        clamp(projection.scale * 0.16, 16, 100),
        prop.seed,
        time,
      );
    } else if (prop.type === "sign") {
      drawSign(
        ctx,
        clamp(projection.scale * 0.17, 18, 105),
        prop.seed,
        time,
      );
    } else if (prop.type === "lamp") {
      drawLamp(
        ctx,
        clamp(projection.scale * 0.18, 18, 110),
        prop.seed,
        time,
      );
    } else if (prop.type === "monolith") {
      drawMonolith(
        ctx,
        clamp(projection.scale * 0.22, 22, 135),
        prop.seed,
        time,
      );
    } else if (prop.type === "rune") {
      drawRune(
        ctx,
        clamp(projection.scale * 0.12, 12, 72),
        prop.seed,
        time,
      );
    }

    ctx.restore();
  }

  ctx.restore();
}

function drawAtmosphere(ctx, world) {
  const theme =
    world.level?.themeKey ??
    "city";
  const glow =
    THEME_GLOW[theme] ??
    THEME_GLOW.city;
  const time =
    world.time ?? 0;

  ctx.save();

  const topGlow =
    ctx.createRadialGradient(
      CANVAS_WIDTH * 0.5,
      CANVAS_HEIGHT * 0.18,
      0,
      CANVAS_WIDTH * 0.5,
      CANVAS_HEIGHT * 0.18,
      CANVAS_WIDTH * 0.72,
    );
  topGlow.addColorStop(
    0,
    `rgba(${glow.join(",")},.04)`,
  );
  topGlow.addColorStop(
    1,
    `rgba(${glow.join(",")},0)`,
  );
  ctx.fillStyle = topGlow;
  ctx.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );

  if (theme === "space") {
    for (
      let i = 0;
      i < 34;
      i += 1
    ) {
      const x =
        hash(i, 10, 812) *
        CANVAS_WIDTH;
      const y =
        hash(i, 12, 813) *
        CANVAS_HEIGHT;
      const twinkle =
        0.35 +
        0.65 *
          Math.max(
            0,
            Math.sin(
              time *
                (0.35 +
                  (i % 5) *
                    0.12) +
              i,
            ),
          );

      ctx.fillStyle =
        `rgba(224,242,254,${0.08 + twinkle * 0.11})`;
      const starSize =
        i % 7 === 0 ? 2 : 1;
      ctx.fillRect(
        x,
        y,
        starSize,
        starSize,
      );
    }

    const planetGlow =
      ctx.createRadialGradient(
        CANVAS_WIDTH * 0.92,
        CANVAS_HEIGHT * 0.08,
        0,
        CANVAS_WIDTH * 0.92,
        CANVAS_HEIGHT * 0.08,
        CANVAS_WIDTH * 0.28,
      );
    planetGlow.addColorStop(
      0,
      "rgba(96,165,250,.09)",
    );
    planetGlow.addColorStop(
      0.4,
      "rgba(59,130,246,.04)",
    );
    planetGlow.addColorStop(
      1,
      "rgba(59,130,246,0)",
    );
    ctx.fillStyle =
      planetGlow;
    ctx.fillRect(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
  }

  if (theme === "jungle") {
    for (
      let i = 0;
      i < 9;
      i += 1
    ) {
      const x =
        (
          hash(i, 8, 901) *
            CANVAS_WIDTH +
          time *
            (4 + i * 0.35)
        ) %
        CANVAS_WIDTH;
      const y =
        hash(i, 9, 902) *
        CANVAS_HEIGHT *
        0.85;

      ctx.globalAlpha =
        0.06 +
        0.08 *
          Math.max(
            0,
            Math.sin(
              time * 1.2 +
              i,
            ),
          );
      ctx.fillStyle =
        "#bef264";
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        1.2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;

  const vignette =
    ctx.createRadialGradient(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_HEIGHT * 0.18,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_HEIGHT * 0.74,
    );
  vignette.addColorStop(
    0,
    "rgba(0,0,0,0)",
  );
  vignette.addColorStop(
    0.72,
    "rgba(0,0,0,.015)",
  );
  vignette.addColorStop(
    1,
    "rgba(0,0,0,.12)",
  );
  ctx.fillStyle = vignette;
  ctx.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );

  ctx.restore();
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

function ensureCanvas(frame, base) {
  let overlay = frame.querySelector(`#${CANVAS_ID}`);
  if (!overlay) {
    overlay = document.createElement("canvas");
    overlay.id = CANVAS_ID;
    overlay.setAttribute("aria-hidden", "true");
    frame.append(overlay);
  }

  const width = base.width || CANVAS_WIDTH;
  const height = base.height || CANVAS_HEIGHT;
  if (overlay.width !== width || overlay.height !== height) {
    overlay.width = width;
    overlay.height = height;
  }
  return overlay;
}

function paint() {
  const world = globalThis.__mistMazeWorld;
  if (!world) return;

  const frame = document.querySelector(".maze-frame");
  const base = frame?.querySelector(
    `:scope > canvas:not(#${CANVAS_ID})`,
  );

  if (
    !(frame instanceof HTMLElement) ||
    !(base instanceof HTMLCanvasElement)
  ) {
    return;
  }

  const overlay = ensureCanvas(frame, base);
  const ctx = overlay.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.save();
  ctx.scale(
    overlay.width / CANVAS_WIDTH,
    overlay.height / CANVAS_HEIGHT,
  );

  const cache = getCache(world);
  if (world.viewMode === "3d") {
    draw3D(ctx, world, cache);
  } else {
    draw2D(ctx, world, cache);
  }
  drawAtmosphere(ctx, world);
  ctx.restore();
}

export function installVisualPolish() {
  if (
    typeof document === "undefined" ||
    globalThis[INSTALLED_KEY]
  ) {
    return () => {};
  }

  globalThis[INSTALLED_KEY] = true;
  ensureStyle();

  let active = true;
  let frameId = 0;

  const loop = () => {
    if (!active) return;
    paint();
    frameId = window.requestAnimationFrame(loop);
  };

  frameId = window.requestAnimationFrame(loop);

  return () => {
    active = false;
    if (frameId) window.cancelAnimationFrame(frameId);
    document.getElementById(CANVAS_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    globalThis[INSTALLED_KEY] = false;
  };
}
