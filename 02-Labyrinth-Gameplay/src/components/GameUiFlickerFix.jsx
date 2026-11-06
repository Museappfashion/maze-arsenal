// src/components/GameUiFlickerFix.jsx

import {
  useLayoutEffect,
  useRef,
} from "react";
import {
  STEEL_WALL,
  WALL,
} from "../config/constants.js";
import {
  getAmmoLabel,
  getTheme,
  getWeaponLabel,
} from "../config/presentations.js";
import {
  getLabyrinthLight,
} from "../config/labyrinthLights.js";
import {
  hasPowerUp,
} from "../game/gameplay.js";
import {
  getLabyrinthTimeRemaining,
} from "../game/labyrinth.js";
import {
  getDiscoveredPercent,
} from "../game/maze.js";
import {
  formatTime,
  indexOfTile,
} from "../utils/math.js";
import {
  getPlayerDisplayName,
} from "../utils/player.js";
import "../styles/minimapPointerFix.css";

export * from "./GameUiEnhanced.jsx";

const DIRECTION_COUNT = 16;
const DIRECTION_STEP =
  (Math.PI * 2) / DIRECTION_COUNT;

function quantizeFacing(angle) {
  const safeAngle =
    Number.isFinite(angle) ? angle : 0;

  return (
    Math.round(
      safeAngle / DIRECTION_STEP,
    ) * DIRECTION_STEP
  );
}

function drawDirectionArrow(
  ctx,
  x,
  y,
  facing,
  size,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(
    quantizeFacing(facing),
  );

  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur =
    Math.max(3, size * 0.7);

  ctx.fillStyle = "#38bdf8";
  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth =
    Math.max(1, size * 0.13);
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(
    -size * 0.62,
    -size * 0.58,
  );
  ctx.lineTo(
    -size * 0.34,
    0,
  );
  ctx.lineTo(
    -size * 0.62,
    size * 0.58,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function resizeCanvasIfNeeded(
  canvas,
  width,
  height,
) {
  if (
    canvas.width === width &&
    canvas.height === height
  ) {
    return;
  }

  canvas.width = width;
  canvas.height = height;
}

function drawLabyrinthMinimap(
  ctx,
  canvas,
  world,
  compact,
) {
  const size =
    compact
      ? 136
      : world.mobileView
        ? 176
        : 160;
  const padding = 12;
  const usable =
    size - padding * 2;

  resizeCanvasIfNeeded(
    canvas,
    size,
    size,
  );

  ctx.clearRect(
    0,
    0,
    size,
    size,
  );

  ctx.fillStyle = "#010204";
  ctx.fillRect(
    0,
    0,
    size,
    size,
  );

  ctx.strokeStyle =
    "rgba(148, 163, 184, 0.16)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    0.5,
    0.5,
    size - 1,
    size - 1,
  );

  const pointFor = (
    x,
    y,
  ) => ({
    x:
      padding +
      (x /
        Math.max(
          1,
          world.width - 1,
        )) *
        usable,
    y:
      padding +
      (y /
        Math.max(
          1,
          world.height - 1,
        )) *
        usable,
  });

  const exitPoint =
    pointFor(
      world.exit.x + 0.5,
      world.exit.y + 0.5,
    );
  const playerPoint =
    pointFor(
      world.player.x,
      world.player.y,
    );

  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#22c55e";
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(
    exitPoint.x,
    exitPoint.y,
    compact ? 4 : 5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  drawDirectionArrow(
    ctx,
    playerPoint.x,
    playerPoint.y,
    world.player.facing,
    compact ? 6 : 7,
  );
}

function drawStandardMinimap(
  ctx,
  canvas,
  world,
  compact,
) {
  const maxSize =
    compact
      ? 220
      : world.mobileView
        ? 440
        : 320;

  const scale =
    Math.max(
      1,
      Math.floor(
        maxSize /
          Math.max(
            world.width,
            world.height,
          ),
      ),
    );

  const mapWidth =
    world.width * scale;
  const mapHeight =
    world.height * scale;

  resizeCanvasIfNeeded(
    canvas,
    mapWidth,
    mapHeight,
  );

  ctx.clearRect(
    0,
    0,
    mapWidth,
    mapHeight,
  );

  const theme =
    getTheme(world);

  for (
    let y = 0;
    y < world.height;
    y += 1
  ) {
    for (
      let x = 0;
      x < world.width;
      x += 1
    ) {
      const discovered =
        world.discovered[
          indexOfTile(
            world.width,
            x,
            y,
          )
        ] === 1;

      if (!discovered) {
        ctx.fillStyle =
          theme.backdrop;
      } else if (
        world.grid[y][x] ===
        STEEL_WALL
      ) {
        ctx.fillStyle =
          theme.steelA ??
          "#7c8794";
      } else if (
        world.grid[y][x] ===
        WALL
      ) {
        ctx.fillStyle =
          theme.wallB;
      } else {
        ctx.fillStyle =
          theme.floorB;
      }

      ctx.fillRect(
        x * scale,
        y * scale,
        scale,
        scale,
      );
    }
  }

  ctx.fillStyle = "#22c55e";
  ctx.fillRect(
    world.exit.x * scale,
    world.exit.y * scale,
    Math.max(
      3,
      scale + 1,
    ),
    Math.max(
      3,
      scale + 1,
    ),
  );

  if (
    hasPowerUp(
      world,
      "sonar",
    )
  ) {
    for (
      const enemy of
        world.enemies
    ) {
      ctx.fillStyle =
        enemy.kind === "warden"
          ? "#f472b6"
          : enemy.kind === "turret"
            ? "#facc15"
            : "#ef4444";

      ctx.fillRect(
        Math.floor(
          enemy.x,
        ) * scale,
        Math.floor(
          enemy.y,
        ) * scale,
        Math.max(
          2,
          scale,
        ),
        Math.max(
          2,
          scale,
        ),
      );
    }
  }

  drawDirectionArrow(
    ctx,
    world.player.x * scale,
    world.player.y * scale,
    world.player.facing,
    Math.max(
      4.5,
      Math.min(
        8,
        scale * 2.15,
      ),
    ),
  );
}

export function MinimapPanel({
  world,
  compact = false,
}) {
  const canvasRef =
    useRef(null);

  const shouldShowMinimap =
    world.labyrinthMode ||
    world.viewMode === "3d" ||
    world.minimapOn;

  useLayoutEffect(() => {
    const canvas =
      canvasRef.current;

    if (
      !canvas ||
      !shouldShowMinimap
    ) {
      return;
    }

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    if (world.labyrinthMode) {
      drawLabyrinthMinimap(
        ctx,
        canvas,
        world,
        compact,
      );
      return;
    }

    drawStandardMinimap(
      ctx,
      canvas,
      world,
      compact,
    );
  });

  if (!shouldShowMinimap) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 16,
          background:
            "rgba(15, 23, 42, 0.9)",
          border:
            "1px solid rgba(148, 163, 184, 0.14)",
          color: "#94a3b8",
          fontSize: 13,
        }}
      >
        Minimap hidden. Press M
        to show it.
      </div>
    );
  }

  if (world.labyrinthMode) {
    return (
      <section
        className="labyrinth-locator"
        aria-label="Labyrinth locator"
      >
        <div className="labyrinth-locator-heading">
          <h2>Locator</h2>
          <span>
            No maze revealed
          </span>
        </div>

        <div className="labyrinth-locator-canvas">
          <canvas
            ref={canvasRef}
          />
        </div>

        <div className="labyrinth-locator-key">
          <span>
            <i className="locator-arrow player" />
            Blue arrow = You
          </span>
          <span>
            <i className="locator-dot exit" />
            Green = Exit
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        padding: 14,
        borderRadius: 16,
        background:
          "rgba(15, 23, 42, 0.92)",
        border:
          "1px solid rgba(148, 163, 184, 0.14)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: 12,
          alignItems:
            "baseline",
          marginBottom: 10,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
          }}
        >
          Minimap
        </h2>

        <span
          style={{
            color: "#94a3b8",
            fontSize: 12,
          }}
        >
          {getDiscoveredPercent(
            world,
          )}
          % discovered
        </span>
      </div>

      <div
        style={{
          display: "grid",
          placeItems: "center",
          width: "100%",
          overflow: "hidden",
          borderRadius: 12,
          background: "#020617",
          border:
            "1px solid rgba(148, 163, 184, 0.12)",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            maxHeight: compact
              ? 190
              : world.mobileView
                ? 420
                : 320,
            objectFit:
              "contain",
            imageRendering:
              "pixelated",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 12px",
          marginTop: 10,
          color: "#cbd5e1",
          fontSize: 12,
        }}
      >
        <span>
          Blue arrow ={" "}
          {getPlayerDisplayName(
            world,
          )}
        </span>
        <span>
          Green = Exit
        </span>
      </div>
    </section>
  );
}

export function MobileHudOverlay({
  world,
  mapExpanded,
  onMapToggle,
  onSettings,
  onExitLevel,
  onFullscreen,
  onActivateBreaker,
}) {
  const labyrinthLight =
    world.labyrinthMode
      ? getLabyrinthLight(world)
      : null;

  void onActivateBreaker;

  if (world.labyrinthMode) {
    return (
      <div className="mobile-hud-overlay labyrinth-mobile-hud">
        <div className="mobile-hud-status">
          <div className="mobile-hud-chip">
            <strong>
              TIME LEFT
            </strong>
            <span>
              {formatTime(
                getLabyrinthTimeRemaining(
                  world,
                ),
              )}
            </span>
          </div>

          <div className="mobile-hud-chip">
            <strong>
              BREAKERS
            </strong>
            <span>
              {world.labyrinth.breakerCharges}/10
            </span>
          </div>

          <div className="mobile-hud-chip mobile-hud-weapon">
            <strong>
              LIGHT
            </strong>
            <span>
              {labyrinthLight?.label ??
                "Base Light"}
            </span>
          </div>

          <div className="mobile-hud-chip">
            <strong>
              DIFFICULTY
            </strong>
            <span>
              {world.labyrinth.difficultyLabel}
            </span>
          </div>
        </div>

        <div className="mobile-hud-actions">
          {world.viewMode !== "3d" && (
            <button
              type="button"
              className="mobile-settings-gear"
              aria-label="Settings"
              title="Settings"
              onClick={onSettings}
            >
              ⚙
            </button>
          )}

          <button
            type="button"
            onClick={onFullscreen}
          >
            FULL
          </button>

          <button
            type="button"
            onClick={onExitLevel}
          >
            MENU
          </button>
        </div>

        <div className="mobile-labyrinth-locator">
          <MinimapPanel
            world={world}
            compact
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-hud-overlay">
      <div className="mobile-hud-status">
        <div className="mobile-hud-chip">
          <strong>
            HP
          </strong>
          <span>
            {Math.round(
              world.player.hp,
            )}
            /
            {Math.round(
              world.player.maxHp,
            )}
          </span>
        </div>

        <div className="mobile-hud-chip">
          <strong>
            {getAmmoLabel(
              world,
            )}
          </strong>
          <span>
            {Math.floor(
              world.player.ammo,
            )}
          </span>
        </div>

        <div className="mobile-hud-chip mobile-hud-weapon">
          <strong>
            WEAPON
          </strong>
          <span>
            {getWeaponLabel(
              world,
              world.player.weapon,
            )}
          </span>
        </div>

        <div className="mobile-hud-chip">
          <strong>
            TIME
          </strong>
          <span>
            {formatTime(
              world.time,
            )}
          </span>
        </div>
      </div>

      <div className="mobile-hud-actions">
        {world.viewMode !== "3d" && (
          <button
            type="button"
            className="mobile-settings-gear"
            aria-label="Settings"
            title="Settings"
            onClick={onSettings}
          >
            ⚙
          </button>
        )}

        <button
          type="button"
          onClick={onFullscreen}
        >
          FULL
        </button>

        <button
          type="button"
          onClick={onExitLevel}
        >
          MENU
        </button>
      </div>

      <div
        className={`mobile-minimap-wrap${
          mapExpanded
            ? " expanded"
            : ""
        }`}
        role="button"
        tabIndex={0}
        aria-label={
          mapExpanded
            ? "Shrink minimap"
            : "Expand minimap"
        }
        onClick={onMapToggle}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            onMapToggle();
          }
        }}
      >
        <MinimapPanel
          world={world}
        />

        <div className="mobile-minimap-hint">
          {world.minimapOn
            ? mapExpanded
              ? "Tap map to shrink"
              : "Tap map to enlarge"
            : "Tap to turn map on"}
        </div>
      </div>
    </div>
  );
}
