// src/components/DeveloperMazeInspector.jsx
import { useEffect, useRef, useState } from "react";
import {
  FLOOR,
  LEVELS,
  STEEL_WALL,
  WALL,
} from "../config/constants.js";
import {
  LABYRINTH_LIGHT_ORDER,
  LABYRINTH_LIGHTS,
} from "../config/labyrinthLights.js";
import { ENEMY_TYPES } from "../config/enemies.js";
import {
  revealAroundPlayer,
  updateVisionCache,
  visibleStrengthAt,
} from "../game/gameplay.js";
import { mutateLabyrinth } from "../game/labyrinth.js";
import { createWorld } from "../game/world.js";
import { clamp, indexOfTile } from "../utils/math.js";

const CANVAS_SIZE = 820;
const MAX_ZOOM_STEP = 12;
const DEVELOPER_MOVE_SPEED = 8;

const MAZE_OPTIONS = [
  { key: "level1", label: "Orbital Ruins" },
  { key: "level2", label: "Emerald Wilds" },
  { key: "level3", label: "The Fallen Keep" },
  { key: "labyrinth", label: "The Shifting Dark" },
];

const THEME_COLORS = {
  space: {
    floor: "#07111f",
    wall: "#475569",
    wallAlt: "#334155",
    steel: "#94a3b8",
    grid: "rgba(148, 163, 184, 0.08)",
  },
  jungle: {
    floor: "#0b2115",
    wall: "#356342",
    wallAlt: "#294f35",
    steel: "#94a3b8",
    grid: "rgba(134, 239, 172, 0.06)",
  },
  medieval: {
    floor: "#1d1915",
    wall: "#685b4b",
    wallAlt: "#55493c",
    steel: "#9ca3af",
    grid: "rgba(231, 229, 228, 0.06)",
  },
  labyrinth: {
    floor: "#030508",
    wall: "#1f2937",
    wallAlt: "#111827",
    steel: "#64748b",
    grid: "rgba(148, 163, 184, 0.07)",
  },
};

function getViewSpan(world, zoomStep) {
  const fullSpan = Math.max(world.width, world.height);
  if (zoomStep <= 0) {
    return fullSpan;
  }

  if (zoomStep >= MAX_ZOOM_STEP) {
    return 4;
  }

  const progress = zoomStep / MAX_ZOOM_STEP;
  return fullSpan * Math.pow(4 / fullSpan, progress);
}

function getCamera(world, span, fitWholeMaze) {
  if (fitWholeMaze) {
    return {
      x: (world.width - span) / 2,
      y: (world.height - span) / 2,
    };
  }

  const centerX = world.player.x;
  const centerY = world.player.y;
  const maxX = Math.max(0, world.width - span);
  const maxY = Math.max(0, world.height - span);

  return {
    x:
      span >= world.width
        ? (world.width - span) / 2
        : clamp(centerX - span / 2, 0, maxX),
    y:
      span >= world.height
        ? (world.height - span) / 2
        : clamp(centerY - span / 2, 0, maxY),
  };
}

function getTileVisibility(world, x, y, mistEnabled) {
  if (!mistEnabled) {
    return 1;
  }

  const visible = clamp(visibleStrengthAt(world, x, y), 0, 1);
  if (world.labyrinthMode || visible > 0) {
    return visible;
  }

  const discovered =
    world.discovered[indexOfTile(world.width, x, y)] === 1;
  return discovered ? 0.18 : 0;
}

function getPickupColor(pickup) {
  if (pickup.type === "labyrinthLight") {
    return LABYRINTH_LIGHTS[pickup.lightKey]?.color ?? "#f8fafc";
  }

  if (pickup.type === "labyrinthBreaker" || pickup.type === "powerup") {
    return "#c084fc";
  }

  if (pickup.type === "weapon") {
    return "#fbbf24";
  }

  if (pickup.type === "ammo") {
    return "#60a5fa";
  }

  if (pickup.type === "medkit") {
    return "#fb7185";
  }

  return "#e2e8f0";
}

function drawInspector(ctx, world, settings) {
  const { mistEnabled, zoomStep } = settings;
  const span = getViewSpan(world, zoomStep);
  const fitWholeMaze = zoomStep === 0;
  const camera = getCamera(world, span, fitWholeMaze);
  const tileSize = CANVAS_SIZE / span;
  const theme =
    THEME_COLORS[world.level.themeKey] ?? THEME_COLORS.labyrinth;

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = "#010204";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const startX = Math.max(0, Math.floor(camera.x) - 1);
  const endX = Math.min(
    world.width - 1,
    Math.ceil(camera.x + span) + 1,
  );
  const startY = Math.max(0, Math.floor(camera.y) - 1);
  const endY = Math.min(
    world.height - 1,
    Math.ceil(camera.y + span) + 1,
  );

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const tile = world.grid[y][x];
      const screenX = (x - camera.x) * tileSize;
      const screenY = (y - camera.y) * tileSize;
      const visibility = getTileVisibility(
        world,
        x,
        y,
        mistEnabled,
      );

      if (tile === FLOOR) {
        ctx.fillStyle = theme.floor;
      } else if (tile === STEEL_WALL) {
        ctx.fillStyle = theme.steel;
      } else {
        ctx.fillStyle =
          (x + y) % 2 === 0 ? theme.wall : theme.wallAlt;
      }

      ctx.globalAlpha = 1;
      ctx.fillRect(
        screenX,
        screenY,
        Math.ceil(tileSize) + 0.5,
        Math.ceil(tileSize) + 0.5,
      );

      if (tileSize >= 10) {
        ctx.strokeStyle = theme.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX, screenY, tileSize, tileSize);
      }

      if (mistEnabled) {
        const fogAlpha =
          world.labyrinthMode
            ? 0.985 * (1 - visibility)
            : 0.94 * (1 - visibility);

        if (fogAlpha > 0.01) {
          ctx.fillStyle = `rgba(1, 2, 5, ${fogAlpha})`;
          ctx.fillRect(
            screenX,
            screenY,
            Math.ceil(tileSize) + 0.5,
            Math.ceil(tileSize) + 0.5,
          );
        }
      }
    }
  }

  const entityVisible = (x, y) =>
    !mistEnabled ||
    getTileVisibility(
      world,
      clamp(Math.floor(x), 0, world.width - 1),
      clamp(Math.floor(y), 0, world.height - 1),
      true,
    ) > 0.15;

  for (const pickup of world.pickups) {
    if (!entityVisible(pickup.x, pickup.y)) {
      continue;
    }

    const x = (pickup.x - camera.x) * tileSize;
    const y = (pickup.y - camera.y) * tileSize;
    const radius = clamp(tileSize * 0.22, 2.2, 8);

    ctx.globalAlpha = 1;
    ctx.fillStyle = getPickupColor(pickup);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of world.enemies) {
    if (!entityVisible(enemy.x, enemy.y)) {
      continue;
    }

    const x = (enemy.x - camera.x) * tileSize;
    const y = (enemy.y - camera.y) * tileSize;
    const radius = clamp(tileSize * 0.26, 2.4, 9);

    ctx.globalAlpha = 1;
    ctx.fillStyle =
      ENEMY_TYPES[enemy.kind]?.color ?? "#f87171";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (
    entityVisible(world.exit.x + 0.5, world.exit.y + 0.5) ||
    !mistEnabled
  ) {
    const exitX =
      (world.exit.x + 0.5 - camera.x) * tileSize;
    const exitY =
      (world.exit.y + 0.5 - camera.y) * tileSize;

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(
      exitX,
      exitY,
      clamp(tileSize * 0.3, 3, 11),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const playerX = (world.player.x - camera.x) * tileSize;
  const playerY = (world.player.y - camera.y) * tileSize;
  const playerRadius = clamp(tileSize * 0.32, 4, 12);

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#38bdf8";
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(playerX, playerY, playerRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = clamp(tileSize * 0.08, 1.5, 3);
  ctx.beginPath();
  ctx.moveTo(playerX, playerY);
  ctx.lineTo(
    playerX + Math.cos(world.player.facing) * playerRadius * 1.8,
    playerY + Math.sin(world.player.facing) * playerRadius * 1.8,
  );
  ctx.stroke();

  if (world.message && world.messageTtl > 0) {
    const boxWidth = 250;
    const boxHeight = 42;
    const boxX = (CANVAS_SIZE - boxWidth) / 2;
    const boxY = 18;

    ctx.fillStyle = "rgba(2, 6, 23, 0.88)";
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = "rgba(226, 232, 240, 0.35)";
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "800 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      world.message,
      CANVAS_SIZE / 2,
      boxY + boxHeight / 2,
    );
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}

export function DeveloperMazeInspector() {
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const keysRef = useRef({});
  const settingsRef = useRef({
    mistEnabled: false,
    zoomStep: 0,
  });
  const [levelKey, setLevelKey] = useState("level1");
  const [mazeVersion, setMazeVersion] = useState(0);
  const [mistEnabled, setMistEnabled] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const [lightKey, setLightKey] = useState("base");

  useEffect(() => {
    settingsRef.current = {
      mistEnabled,
      zoomStep,
    };
  }, [mistEnabled, zoomStep]);

  useEffect(() => {
    const world = createWorld(
      levelKey,
      "2d",
      "Developer",
      levelKey === "labyrinth"
        ? { difficulty: "normal", timeMinutes: 5 }
        : {},
    );

    world.developerMode = true;
    world.developerNoclip = true;
    world.developerInvincible = true;
    world.player.hp = world.player.maxHp;

    if (world.labyrinthMode) {
      for (const key of LABYRINTH_LIGHT_ORDER) {
        world.labyrinth.ownedLights[key] = true;
      }
      world.labyrinth.equippedLight =
        lightKey === "base" ? null : lightKey;
    }

    worldRef.current = world;
    setZoomStep(0);
  }, [levelKey, mazeVersion]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world?.labyrinthMode) {
      return;
    }

    world.labyrinth.equippedLight =
      lightKey === "base" ? null : lightKey;
    updateVisionCache(world);
  }, [lightKey]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          event.key,
        )
      ) {
        event.preventDefault();
      }
      keysRef.current[event.key] = true;
      keysRef.current[event.key.toLowerCase()] = true;
    };

    const onKeyUp = (event) => {
      keysRef.current[event.key] = false;
      keysRef.current[event.key.toLowerCase()] = false;
    };

    const clearKeys = () => {
      keysRef.current = {};
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
    };
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    let previousTime = performance.now();

    const frame = (now) => {
      const world = worldRef.current;
      const canvas = canvasRef.current;

      if (world && canvas) {
        const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
        previousTime = now;
        world.time += dt;
        world.fogPulse += dt;
        world.player.hp = world.player.maxHp;
        world.gameOver = false;

        const keys = keysRef.current;
        let moveX =
          Number(Boolean(keys.d || keys.ArrowRight)) -
          Number(Boolean(keys.a || keys.ArrowLeft));
        let moveY =
          Number(Boolean(keys.s || keys.ArrowDown)) -
          Number(Boolean(keys.w || keys.ArrowUp));

        if (moveX !== 0 || moveY !== 0) {
          const length = Math.hypot(moveX, moveY);
          moveX /= length;
          moveY /= length;
          world.player.x = clamp(
            world.player.x + moveX * DEVELOPER_MOVE_SPEED * dt,
            0.05,
            world.width - 0.05,
          );
          world.player.y = clamp(
            world.player.y + moveY * DEVELOPER_MOVE_SPEED * dt,
            0.05,
            world.height - 0.05,
          );
          world.player.facing = Math.atan2(moveY, moveX);
          updateVisionCache(world);
          revealAroundPlayer(world);
        }

        if (
          world.labyrinthMode &&
          world.time >= world.labyrinth.nextMutationAt
        ) {
          mutateLabyrinth(world);
          world.labyrinth.nextMutationAt =
            world.time + world.labyrinth.mutationInterval;
        }

        if (world.messageTtl > 0) {
          world.messageTtl = Math.max(0, world.messageTtl - dt);
        }

        const ctx = canvas.getContext("2d");
        drawInspector(ctx, world, settingsRef.current);
      } else {
        previousTime = now;
      }

      animationFrame = requestAnimationFrame(frame);
    };

    animationFrame = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const selectMaze = (key) => {
    setLevelKey(key);
    setMazeVersion((version) => version + 1);
    setLightKey("base");
  };

  const nudgePlayer = (dx, dy) => {
    const world = worldRef.current;
    if (!world) {
      return;
    }

    world.player.x = clamp(
      world.player.x + dx,
      0.05,
      world.width - 0.05,
    );
    world.player.y = clamp(
      world.player.y + dy,
      0.05,
      world.height - 0.05,
    );

    if (dx !== 0 || dy !== 0) {
      world.player.facing = Math.atan2(dy, dx);
    }

    updateVisionCache(world);
    revealAroundPlayer(world);
  };

  const selectedLevel = LEVELS[levelKey];
  const currentWorld = worldRef.current;
  const currentSpan = currentWorld
    ? getViewSpan(currentWorld, zoomStep)
    : 0;
  const zoomLabel =
    zoomStep === 0
      ? "Entire maze"
      : zoomStep === MAX_ZOOM_STEP
        ? "4 × 4 tiles"
        : `${Math.max(4, Math.round(currentSpan))} × ${Math.max(
            4,
            Math.round(currentSpan),
          )} tiles`;

  return (
    <section className="developer-maze-inspector">
      <div className="developer-maze-heading">
        <div>
          <h2>Maze Inspector</h2>
          <p>
            Developer noclip and invincibility are active inside this viewer.
          </p>
        </div>
        <div className="developer-badges">
          <span>NOCLIP</span>
          <span>INVINCIBLE</span>
        </div>
      </div>

      <div className="developer-maze-options">
        {MAZE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={levelKey === option.key ? "is-active" : ""}
            onClick={() => selectMaze(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="developer-maze-toolbar">
        <button
          type="button"
          onClick={() => setMistEnabled((enabled) => !enabled)}
        >
          {mistEnabled ? "UNMIST" : "MIST"}
        </button>
        <button
          type="button"
          disabled={zoomStep <= 0}
          onClick={() =>
            setZoomStep((step) => Math.max(0, step - 1))
          }
        >
          ZOOM −
        </button>
        <button
          type="button"
          disabled={zoomStep >= MAX_ZOOM_STEP}
          onClick={() =>
            setZoomStep((step) =>
              Math.min(MAX_ZOOM_STEP, step + 1),
            )
          }
        >
          ZOOM +
        </button>
        <button type="button" onClick={() => setZoomStep(0)}>
          FIT
        </button>

        {levelKey === "labyrinth" && (
          <label className="developer-light-select">
            LIGHT
            <select
              value={lightKey}
              onChange={(event) => setLightKey(event.target.value)}
            >
              <option value="base">Base light</option>
              {LABYRINTH_LIGHT_ORDER.map((key) => (
                <option key={key} value={key}>
                  {LABYRINTH_LIGHTS[key].label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="developer-maze-meta">
        <strong>{selectedLevel.subtitle}</strong>
        <span>{zoomLabel}</span>
        <span>WASD / arrows move through every wall</span>
      </div>

      <div className="developer-maze-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          aria-label={`${selectedLevel.subtitle} developer maze inspector`}
        />
      </div>

      <div className="developer-maze-dpad" aria-label="Maze inspector movement">
        <button type="button" onClick={() => nudgePlayer(0, -1)}>
          ↑
        </button>
        <div>
          <button type="button" onClick={() => nudgePlayer(-1, 0)}>
            ←
          </button>
          <button type="button" onClick={() => nudgePlayer(0, 1)}>
            ↓
          </button>
          <button type="button" onClick={() => nudgePlayer(1, 0)}>
            →
          </button>
        </div>
      </div>
    </section>
  );
}
