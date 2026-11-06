// src/components/LabyrinthGameplayOverlay.jsx
import { useEffect, useRef } from "react";
import {
  LABYRINTH_LIGHT_ORDER,
  LABYRINTH_LIGHTS,
} from "../config/labyrinthLights.js";
import { getLabyrinthTimeRemaining } from "../game/labyrinth.js";
import { formatTime } from "../utils/math.js";

function queueTimerTick(world, remainingSeconds) {
  if (!Array.isArray(world.audioEvents) || remainingSeconds <= 0) {
    return;
  }

  if (world.audioEvents.length >= 48) {
    return;
  }

  world.audioEvents.push({
    type: "labyrinthTick",
    urgent: remainingSeconds <= 30,
    critical: remainingSeconds <= 10,
  });
}

function LabyrinthTimer({ world, gameMode }) {
  const remaining = getLabyrinthTimeRemaining(world);
  const remainingSeconds = Math.max(0, Math.ceil(remaining));
  const previousSecondRef = useRef(null);

  useEffect(() => {
    previousSecondRef.current = null;
  }, [world]);

  useEffect(() => {
    if (
      !world.labyrinthMode ||
      world.gameOver ||
      world.victory ||
      previousSecondRef.current === remainingSeconds
    ) {
      return;
    }

    previousSecondRef.current = remainingSeconds;
    queueTimerTick(world, remainingSeconds);
  }, [remainingSeconds, world]);

  if (!world.labyrinthMode) {
    return null;
  }

  const critical = remainingSeconds <= 10;
  const urgent = remainingSeconds <= 30;
  const pulse = critical
    ? 0.76 + 0.24 * Math.abs(Math.sin(world.time * Math.PI * 2))
    : 1;

  return (
    <div
      aria-live={critical ? "assertive" : "off"}
      aria-label={`Labyrinth time remaining ${formatTime(remaining)}`}
      style={{
        position: "absolute",
        top: 14,
        right: gameMode === "3d" ? 66 : 14,
        zIndex: 32,
        display: "grid",
        justifyItems: "end",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          minWidth: 142,
          padding: "8px 12px 9px",
          border: `1px solid ${
            critical
              ? "rgba(255, 90, 90, 0.95)"
              : "rgba(248, 113, 113, 0.66)"
          }`,
          borderRadius: 12,
          background: critical
            ? "rgba(69, 10, 10, 0.94)"
            : "rgba(24, 4, 8, 0.90)",
          boxShadow: urgent
            ? `0 0 ${critical ? 30 : 20}px rgba(239, 68, 68, ${
                critical ? 0.58 : 0.32
              })`
            : "0 10px 30px rgba(0, 0, 0, 0.34)",
          opacity: pulse,
          backdropFilter: "blur(5px)",
        }}
      >
        <div
          style={{
            color: "#fca5a5",
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.16em",
            textAlign: "right",
          }}
        >
          TIME LEFT
        </div>
        <div
          style={{
            marginTop: 1,
            color: critical ? "#ffffff" : "#ff4d4d",
            fontFamily:
              '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
            fontSize: critical ? 27 : 24,
            fontWeight: 950,
            lineHeight: 1,
            letterSpacing: "-0.05em",
            textAlign: "right",
            textShadow: critical
              ? "0 0 18px rgba(255, 80, 80, 0.95)"
              : "0 0 12px rgba(239, 68, 68, 0.66)",
          }}
        >
          {formatTime(remaining)}
        </div>
      </div>
    </div>
  );
}

function ThreeDLabyrinthPowerUps({ world }) {
  if (!world.labyrinthMode || world.viewMode !== "3d") {
    return null;
  }

  const ownedLights = world.labyrinth.ownedLights ?? {};
  const equipped = world.labyrinth.equippedLight;
  const ownedCount = LABYRINTH_LIGHT_ORDER.reduce(
    (count, key) => count + (ownedLights[key] ? 1 : 0),
    0,
  );

  return (
    <div
      aria-label="Labyrinth power-ups"
      style={{
        position: "absolute",
        top: 84,
        right: 14,
        zIndex: 30,
        width: 190,
        padding: 10,
        border: "1px solid rgba(196, 181, 253, 0.30)",
        borderRadius: 12,
        background: "rgba(2, 6, 23, 0.82)",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.34)",
        backdropFilter: "blur(5px)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          color: "#ddd6fe",
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: "0.12em",
        }}
      >
        <span>POWER-UPS</span>
        <span>
          LIGHTS {ownedCount}/{LABYRINTH_LIGHT_ORDER.length}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 5,
          marginTop: 8,
        }}
      >
        {LABYRINTH_LIGHT_ORDER.map((key) => {
          const light = LABYRINTH_LIGHTS[key];
          const owned = Boolean(ownedLights[key]);
          const selected = equipped === key;

          return (
            <div
              key={key}
              title={owned ? light.label : `${light.label} not collected`}
              style={{
                height: 20,
                display: "grid",
                placeItems: "center",
                border: selected
                  ? `1px solid ${light.color}`
                  : "1px solid rgba(148, 163, 184, 0.15)",
                borderRadius: 6,
                background: owned
                  ? `${light.color}24`
                  : "rgba(15, 23, 42, 0.56)",
                opacity: owned ? 1 : 0.28,
                boxShadow: selected
                  ? `0 0 12px ${light.color}66`
                  : "none",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: owned ? light.color : "#475569",
                  boxShadow: owned ? `0 0 7px ${light.color}` : "none",
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 8,
          color: "#cbd5e1",
          fontSize: 10,
          fontWeight: 800,
        }}
      >
        <span>
          Equipped:{" "}
          {equipped ? LABYRINTH_LIGHTS[equipped]?.label ?? "Base Light" : "Base Light"}
        </span>
        <span style={{ color: "#d8b4fe" }}>
          Breakers {world.labyrinth.breakerCharges}/10
        </span>
      </div>
    </div>
  );
}

function GameOverRestartButton({ world, onRestart }) {
  if (!world.gameOver) {
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes mist-maze-restart-pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            box-shadow:
              0 0 18px rgba(34, 211, 238, 0.62),
              0 0 44px rgba(250, 204, 21, 0.28);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.055);
            box-shadow:
              0 0 30px rgba(34, 211, 238, 0.92),
              0 0 68px rgba(250, 204, 21, 0.48);
          }
        }

        .mist-maze-start-new-game:hover {
          filter: brightness(1.13) saturate(1.14);
        }

        .mist-maze-start-new-game:active {
          animation: none;
          transform: translate(-50%, -50%) scale(0.98);
        }
      `}</style>
      <button
        type="button"
        className="mist-maze-start-new-game"
        onClick={onRestart}
        style={{
          position: "absolute",
          left: "50%",
          top: "62%",
          zIndex: 45,
          minWidth: 250,
          padding: "16px 28px",
          border: "2px solid rgba(255, 255, 255, 0.88)",
          borderRadius: 16,
          background:
            "linear-gradient(135deg, #facc15 0%, #67e8f9 48%, #22d3ee 100%)",
          color: "#04111d",
          font: "inherit",
          fontSize: 18,
          fontWeight: 950,
          letterSpacing: "0.08em",
          cursor: "pointer",
          textShadow: "0 1px 0 rgba(255, 255, 255, 0.42)",
          animation: "mist-maze-restart-pulse 1.25s ease-in-out infinite",
          pointerEvents: "auto",
        }}
      >
        START NEW GAME
      </button>
    </>
  );
}

export function LabyrinthGameplayOverlay({
  world,
  gameMode,
  onRestart,
}) {
  return (
    <>
      <LabyrinthTimer world={world} gameMode={gameMode} />
      <ThreeDLabyrinthPowerUps world={world} />
      <GameOverRestartButton world={world} onRestart={onRestart} />
    </>
  );
}
