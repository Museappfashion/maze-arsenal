// src/components/DeveloperMazeInspector.jsx
import { useEffect, useRef, useState } from "react";
import { DRAW_TILE, LEVELS } from "../config/constants.js";
import {
  LABYRINTH_LIGHT_ORDER,
  LABYRINTH_LIGHTS,
} from "../config/labyrinthLights.js";
import { WEAPON_HOTKEY_MAP } from "../config/weapons.js";
import {
  activateStoredPowerUp,
  attack,
  computeDistanceField,
  getCamera as getGameCamera,
  getStoredPowerUps,
  revealAroundPlayer,
  selectWeapon,
  updateEffects,
  updateEnemies,
  updatePickups,
  updatePowerUps,
  updateProjectiles,
  updateVisionCache,
  visibleStrengthAt,
} from "../game/gameplay.js";
import {
  activateLabyrinthBreaker,
  mutateLabyrinth,
} from "../game/labyrinth.js";
import {
  drawEffects,
  drawEnemyBody,
  drawEnemyHealth,
  drawMazeTile,
  drawPickupBody,
  drawPlayerBody,
  drawProjectile,
} from "../game/rendering.js";
import { createWorld } from "../game/world.js";
import { clamp, indexOfTile } from "../utils/math.js";

const CANVAS_SIZE = 820;
const MAX_ZOOM_STEP = 12;
const DEVELOPER_MOVE_SPEED = 8;
const DISTANCE_REFRESH_SECONDS = 0.18;
const UI_REFRESH_SECONDS = 0.15;

const MAZE_OPTIONS = [
  { key: "level1", label: "Orbital Ruins" },
  { key: "level2", label: "Emerald Wilds" },
  { key: "level3", label: "The Fallen Keep" },
  { key: "labyrinth", label: "The Shifting Dark" },
];

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

function getInspectorCamera(world, span, fitWholeMaze) {
  if (fitWholeMaze) {
    return {
      x: (world.width - span) / 2,
      y: (world.height - span) / 2,
    };
  }

  const maxX = Math.max(0, world.width - span);
  const maxY = Math.max(0, world.height - span);

  return {
    x:
      span >= world.width
        ? (world.width - span) / 2
        : clamp(world.player.x - span / 2, 0, maxX),
    y:
      span >= world.height
        ? (world.height - span) / 2
        : clamp(world.player.y - span / 2, 0, maxY),
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

function isEntityVisible(world, x, y, mistEnabled) {
  if (!mistEnabled) {
    return true;
  }

  const tileX = clamp(Math.floor(x), 0, world.width - 1);
  const tileY = clamp(Math.floor(y), 0, world.height - 1);

  return getTileVisibility(world, tileX, tileY, true) > 0.15;
}

function isInsideView(entity, camera, span, margin = 1) {
  return (
    entity.x >= camera.x - margin &&
    entity.x <= camera.x + span + margin &&
    entity.y >= camera.y - margin &&
    entity.y <= camera.y + span + margin
  );
}

function drawInspectorMessage(ctx, world) {
  if (!world.message || world.messageTtl <= 0) {
    return;
  }

  const boxWidth = Math.min(
    480,
    Math.max(250, world.message.length * 9.5),
  );
  const boxHeight = 42;
  const boxX = (CANVAS_SIZE - boxWidth) / 2;
  const boxY = 18;

  ctx.save();
  ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeStyle = "rgba(226, 232, 240, 0.35)";
  ctx.strokeRect(
    boxX + 0.5,
    boxY + 0.5,
    boxWidth - 1,
    boxHeight - 1,
  );
  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    world.message,
    CANVAS_SIZE / 2,
    boxY + boxHeight / 2,
  );
  ctx.restore();
}

function drawInspector(ctx, world, settings) {
  const { mistEnabled, zoomStep } = settings;
  const span = getViewSpan(world, zoomStep);
  const fitWholeMaze = zoomStep === 0;
  const camera = getInspectorCamera(world, span, fitWholeMaze);
  const tileSize = CANVAS_SIZE / span;
  const renderScale = tileSize / DRAW_TILE;

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

  ctx.save();
  ctx.scale(renderScale, renderScale);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const screenX = (x - camera.x) * DRAW_TILE;
      const screenY = (y - camera.y) * DRAW_TILE;
      drawMazeTile(ctx, world, x, y, screenX, screenY);
    }
  }

  if (mistEnabled) {
    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const visibility = getTileVisibility(
          world,
          x,
          y,
          true,
        );
        const fogAlpha = world.labyrinthMode
          ? 0.985 * (1 - visibility)
          : 0.94 * (1 - visibility);

        if (fogAlpha <= 0.01) {
          continue;
        }

        ctx.fillStyle = `rgba(1, 2, 5, ${fogAlpha})`;
        ctx.fillRect(
          (x - camera.x) * DRAW_TILE,
          (y - camera.y) * DRAW_TILE,
          DRAW_TILE + 0.5,
          DRAW_TILE + 0.5,
        );
      }
    }
  }

  const exitVisible =
    !mistEnabled ||
    isEntityVisible(
      world,
      world.exit.x + 0.5,
      world.exit.y + 0.5,
      true,
    );

  if (exitVisible) {
    const exitX =
      (world.exit.x + 0.5 - camera.x) * DRAW_TILE;
    const exitY =
      (world.exit.y + 0.5 - camera.y) * DRAW_TILE;

    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#22c55e";
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(exitX, exitY, DRAW_TILE * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const pickup of world.pickups) {
    if (
      !isInsideView(pickup, camera, span) ||
      !isEntityVisible(world, pickup.x, pickup.y, mistEnabled)
    ) {
      continue;
    }

    const visibility = mistEnabled
      ? getTileVisibility(
          world,
          Math.floor(pickup.x),
          Math.floor(pickup.y),
          true,
        )
      : 1;

    drawPickupBody(
      ctx,
      world,
      pickup,
      (pickup.x - camera.x) * DRAW_TILE,
      (pickup.y - camera.y) * DRAW_TILE,
      visibility,
    );
  }

  for (const enemy of world.enemies) {
    if (
      !isInsideView(enemy, camera, span) ||
      !isEntityVisible(world, enemy.x, enemy.y, mistEnabled)
    ) {
      continue;
    }

    const x = (enemy.x - camera.x) * DRAW_TILE;
    const y = (enemy.y - camera.y) * DRAW_TILE;

    drawEnemyBody(ctx, world, enemy, x, y);
    drawEnemyHealth(ctx, enemy, x, y);
  }

  for (const projectile of world.projectiles) {
    if (
      !isInsideView(projectile, camera, span) ||
      !isEntityVisible(
        world,
        projectile.x,
        projectile.y,
        mistEnabled,
      )
    ) {
      continue;
    }

    drawProjectile(ctx, projectile, camera);
  }

  drawEffects(ctx, world, camera);

  const playerX = (world.player.x - camera.x) * DRAW_TILE;
  const playerY = (world.player.y - camera.y) * DRAW_TILE;
  drawPlayerBody(ctx, world, playerX, playerY);

  ctx.restore();
  drawInspectorMessage(ctx, world);
}

function setAimTarget(world, targetX, targetY) {
  const dx = targetX - world.player.x;
  const dy = targetY - world.player.y;

  if (Math.hypot(dx, dy) > 0.01) {
    world.player.facing = Math.atan2(dy, dx);
  }

  const gameCamera = getGameCamera(world);

  world.pointer.x = (targetX - gameCamera.x) * DRAW_TILE;
  world.pointer.y = (targetY - gameCamera.y) * DRAW_TILE;
  world.pointer.inside = true;
}

function setForwardAimTarget(world) {
  setAimTarget(
    world,
    world.player.x + Math.cos(world.player.facing) * 8,
    world.player.y + Math.sin(world.player.facing) * 8,
  );
}

export function DeveloperMazeInspector() {
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const keysRef = useRef({});
  const distanceRefreshRef = useRef(0);
  const uiRefreshRef = useRef(0);
  const settingsRef = useRef({
    mistEnabled: false,
    zoomStep: 0,
  });

  const [levelKey, setLevelKey] = useState("level1");
  const [mazeVersion, setMazeVersion] = useState(0);
  const [mistEnabled, setMistEnabled] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const [lightKey, setLightKey] = useState("base");
  const [, setUiRevision] = useState(0);

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
    world.pointer.inside = false;
    world.pointer.down = false;

    if (world.labyrinthMode) {
      for (const key of LABYRINTH_LIGHT_ORDER) {
        world.labyrinth.ownedLights[key] = true;
      }

      world.labyrinth.equippedLight =
        lightKey === "base" ? null : lightKey;
    }

    computeDistanceField(world);
    updateVisionCache(world);
    revealAroundPlayer(world);

    worldRef.current = world;
    distanceRefreshRef.current = 0;
    uiRefreshRef.current = 0;
    setZoomStep(0);
    setUiRevision((revision) => revision + 1);
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
      const world = worldRef.current;

      if (!world) {
        return;
      }

      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          " ",
        ].includes(event.key)
      ) {
        event.preventDefault();
      }

      keysRef.current[event.key] = true;
      keysRef.current[event.key.toLowerCase()] = true;

      if (world.labyrinthMode) {
        if (
          !event.repeat &&
          ["b", "B", " ", "Enter"].includes(event.key)
        ) {
          activateLabyrinthBreaker(world);
        }
        return;
      }

      if (["z", "Z"].includes(event.key)) {
        activateStoredPowerUp(world, 0);
      } else if (["x", "X"].includes(event.key)) {
        activateStoredPowerUp(world, 1);
      }

      const directWeapon = WEAPON_HOTKEY_MAP[event.key];

      if (directWeapon) {
        selectWeapon(world, directWeapon);
      }

      if (
        !event.repeat &&
        [" ", "Enter"].includes(event.key)
      ) {
        setForwardAimTarget(world);
        attack(world);
      }
    };

    const onKeyUp = (event) => {
      keysRef.current[event.key] = false;
      keysRef.current[event.key.toLowerCase()] = false;
    };

    const clearKeys = () => {
      keysRef.current = {};
      const world = worldRef.current;

      if (world) {
        world.pointer.down = false;
      }
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
      const dt = Math.min(
        0.05,
        Math.max(0, (now - previousTime) / 1000),
      );
      previousTime = now;

      if (world && canvas) {
        world.time += dt;
        world.fogPulse += dt;
        world.player.hp = Math.max(
          world.player.hp,
          world.player.maxHp,
        );
        world.gameOver = false;
        world.victory = false;

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

          if (!world.pointer.inside) {
            world.player.facing = Math.atan2(moveY, moveX);
          }

          world.distanceFieldDirty = true;
          updateVisionCache(world);
          revealAroundPlayer(world);
        }

        updatePickups(world, dt);

        if (world.labyrinthMode) {
          if (world.time >= world.labyrinth.nextMutationAt) {
            mutateLabyrinth(world);
            world.labyrinth.nextMutationAt =
              world.time + world.labyrinth.mutationInterval;
            computeDistanceField(world);
          }
        } else {
          updatePowerUps(world, dt);

          distanceRefreshRef.current += dt;
          if (
            world.distanceFieldDirty ||
            distanceRefreshRef.current >= DISTANCE_REFRESH_SECONDS
          ) {
            computeDistanceField(world);
            distanceRefreshRef.current = 0;
          }

          if (
            keys[" "] ||
            keys.Enter ||
            world.pointer.down
          ) {
            if (!world.pointer.inside) {
              setForwardAimTarget(world);
            }
            attack(world);
          }

          updateEnemies(world, dt);
          updateProjectiles(world, dt);
        }

        updateEffects(world, dt);
        updateVisionCache(world);
        revealAroundPlayer(world);

        if (world.messageTtl > 0) {
          world.messageTtl = Math.max(
            0,
            world.messageTtl - dt,
          );

          if (world.messageTtl === 0) {
            world.message = "";
          }
        }

        if (world.audioEvents?.length) {
          world.audioEvents.length = 0;
        }

        uiRefreshRef.current += dt;
        if (uiRefreshRef.current >= UI_REFRESH_SECONDS) {
          uiRefreshRef.current = 0;
          setUiRevision((revision) => revision + 1);
        }

        const ctx = canvas.getContext("2d");
        drawInspector(ctx, world, settingsRef.current);
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

    world.pointer.inside = false;
    world.distanceFieldDirty = true;
    updateVisionCache(world);
    revealAroundPlayer(world);
  };

  const aimFromPointerEvent = (event) => {
    const world = worldRef.current;
    const canvas = canvasRef.current;

    if (!world || !canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const canvasX =
      ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE;
    const canvasY =
      ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE;
    const span = getViewSpan(
      world,
      settingsRef.current.zoomStep,
    );
    const camera = getInspectorCamera(
      world,
      span,
      settingsRef.current.zoomStep === 0,
    );

    setAimTarget(
      world,
      camera.x + (canvasX / CANVAS_SIZE) * span,
      camera.y + (canvasY / CANVAS_SIZE) * span,
    );
  };

  const handleCanvasPointerMove = (event) => {
    aimFromPointerEvent(event);
  };

  const handleCanvasPointerDown = (event) => {
    const world = worldRef.current;

    if (!world) {
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    aimFromPointerEvent(event);
    world.pointer.down = true;

    if (!world.labyrinthMode) {
      attack(world);
    }
  };

  const handleCanvasPointerUp = (event) => {
    const world = worldRef.current;

    if (!world) {
      return;
    }

    world.pointer.down = false;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleCanvasPointerLeave = () => {
    const world = worldRef.current;

    if (!world) {
      return;
    }

    world.pointer.down = false;
    world.pointer.inside = false;
  };

  const attackForward = () => {
    const world = worldRef.current;

    if (!world || world.labyrinthMode) {
      return;
    }

    setForwardAimTarget(world);
    attack(world);
  };

  const usePowerUp = (slotIndex) => {
    const world = worldRef.current;

    if (!world || world.labyrinthMode) {
      return;
    }

    activateStoredPowerUp(world, slotIndex);
    setUiRevision((revision) => revision + 1);
  };

  const currentWorld = worldRef.current;
  const selectedLevel = LEVELS[levelKey];
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
  const storedPowerUps =
    currentWorld && !currentWorld.labyrinthMode
      ? getStoredPowerUps(currentWorld)
      : [];

  return (
    <section className="developer-maze-inspector">
      <div className="developer-maze-heading">
        <div>
          <h2>Maze Inspector</h2>
          <p>
            Noclip and invincibility are active. Enemies, combat, pickups,
            and power-ups use normal-game behavior.
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

        {!currentWorld?.labyrinthMode && (
          <>
            <button type="button" onClick={attackForward}>
              ATTACK
            </button>
            <button type="button" onClick={() => usePowerUp(0)}>
              {storedPowerUps[0]?.label ?? "POWER-UP 1"} (Z)
            </button>
            <button type="button" onClick={() => usePowerUp(1)}>
              {storedPowerUps[1]?.label ?? "POWER-UP 2"} (X)
            </button>
          </>
        )}

        {levelKey === "labyrinth" && (
          <>
            <button
              type="button"
              onClick={() =>
                activateLabyrinthBreaker(worldRef.current)
              }
            >
              BREAKER (B)
            </button>
            <label className="developer-light-select">
              LIGHT
              <select
                value={lightKey}
                onChange={(event) =>
                  setLightKey(event.target.value)
                }
              >
                <option value="base">Base light</option>
                {LABYRINTH_LIGHT_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {LABYRINTH_LIGHTS[key].label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      <div className="developer-maze-meta">
        <strong>{selectedLevel.subtitle}</strong>
        <span>{zoomLabel}</span>
        <span>WASD / arrows = noclip movement</span>
        {!currentWorld?.labyrinthMode && (
          <>
            <span>Mouse / click = aim and attack</span>
            <span>Space = attack</span>
            <span>Z / X = stored power-ups</span>
            <span>
              HP {Math.round(currentWorld?.player.hp ?? 0)} /{" "}
              {Math.round(currentWorld?.player.maxHp ?? 0)}
            </span>
            <span>Kills {currentWorld?.kills ?? 0}</span>
          </>
        )}
      </div>

      <div className="developer-maze-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          aria-label={`${selectedLevel.subtitle} developer maze inspector`}
          onPointerMove={handleCanvasPointerMove}
          onPointerDown={handleCanvasPointerDown}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          onPointerLeave={handleCanvasPointerLeave}
        />
      </div>

      <div
        className="developer-maze-dpad"
        aria-label="Maze inspector movement"
      >
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
