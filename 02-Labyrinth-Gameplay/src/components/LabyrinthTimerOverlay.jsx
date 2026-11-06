// src/components/LabyrinthTimerOverlay.jsx
import { useEffect, useRef } from "react";
import { getLabyrinthTimeRemaining } from "../game/labyrinth.js";
import { formatTime } from "../utils/math.js";

export function LabyrinthTimerOverlay({ world }) {
  const previousSecondRef = useRef(null);

  if (!world.labyrinthMode) {
    return null;
  }

  const remaining = Math.max(0, getLabyrinthTimeRemaining(world));
  const remainingSeconds = Math.ceil(remaining);
  const critical = remainingSeconds <= 10;
  const urgent = remainingSeconds <= 30;

  useEffect(() => {
    previousSecondRef.current = null;
  }, [world]);

  useEffect(() => {
    if (
      world.gameOver ||
      world.victory ||
      remainingSeconds <= 0 ||
      previousSecondRef.current === remainingSeconds
    ) {
      return;
    }

    previousSecondRef.current = remainingSeconds;

    if (Array.isArray(world.audioEvents) && world.audioEvents.length < 48) {
      world.audioEvents.push({
        type: "labyrinthTick",
        urgent,
        critical,
      });
    }
  }, [critical, remainingSeconds, urgent, world]);

  const pulse = critical
    ? 0.78 + 0.22 * Math.abs(Math.sin(world.time * Math.PI * 2))
    : 1;

  return (
    <div
      aria-label={`Labyrinth time remaining ${formatTime(remaining)}`}
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 36,
        minWidth: 146,
        padding: "8px 12px 9px",
        border: `1px solid ${
          critical
            ? "rgba(255,90,90,0.96)"
            : "rgba(248,113,113,0.66)"
        }`,
        borderRadius: 12,
        background: critical
          ? "rgba(69,10,10,0.95)"
          : "rgba(24,4,8,0.91)",
        boxShadow: urgent
          ? `0 0 ${critical ? 32 : 20}px rgba(239,68,68,${
              critical ? 0.62 : 0.34
            })`
          : "0 10px 30px rgba(0,0,0,0.36)",
        opacity: pulse,
        pointerEvents: "none",
        userSelect: "none",
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        style={{
          color: "#fca5a5",
          fontSize: 9,
          fontWeight: 950,
          letterSpacing: "0.16em",
          textAlign: "right",
        }}
      >
        TIME LEFT
      </div>
      <div
        style={{
          marginTop: 1,
          color: critical ? "#fff" : "#ff4d4d",
          fontFamily:
            '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
          fontSize: critical ? 28 : 24,
          fontWeight: 950,
          lineHeight: 1,
          letterSpacing: "-0.05em",
          textAlign: "right",
          textShadow: critical
            ? "0 0 18px rgba(255,80,80,0.95)"
            : "0 0 12px rgba(239,68,68,0.66)",
        }}
      >
        {formatTime(remaining)}
      </div>
    </div>
  );
}
