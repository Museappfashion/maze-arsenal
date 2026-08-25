// src/components/RunEndOverlay.jsx
import { formatTime } from "../utils/math.js";

export function RunEndOverlay({ world, onTryAgain, onMainMenu }) {
  if (!world?.victory && !world?.gameOver) {
    return null;
  }

  const victory = Boolean(world.victory);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-end-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(2, 6, 23, 0.74)",
        backdropFilter: "blur(8px)",
      }}
    >
      <section
        style={{
          width: "min(92vw, 390px)",
          padding: "28px 24px 22px",
          borderRadius: 22,
          border: "1px solid rgba(148, 163, 184, 0.2)",
          background:
            "linear-gradient(180deg, rgba(15, 23, 42, 0.97), rgba(2, 6, 23, 0.98))",
          boxShadow: "0 28px 90px rgba(0, 0, 0, 0.46)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: victory ? "#67e8f9" : "#94a3b8",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {victory ? "Run complete" : "Run ended"}
        </div>
        <h2
          id="run-end-title"
          style={{
            margin: "8px 0 0",
            color: "#f8fafc",
            fontSize: 32,
            lineHeight: 1.08,
          }}
        >
          {victory ? "You escaped!" : "Try the maze again"}
        </h2>
        <div
          style={{
            marginTop: 10,
            color: "#cbd5e1",
            fontSize: 15,
          }}
        >
          {victory
            ? `Escape time ${formatTime(world.time)}`
            : `Run time ${formatTime(world.time)}`}
        </div>
        {victory &&
          !world.labyrinthMode &&
          world.leaderboardEligible === false && (
            <div
              style={{
                marginTop: 12,
                padding: "9px 11px",
                borderRadius: 10,
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.2)",
                color: "#fbbf24",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              Leaderboard score not submitted because the view mode changed
              during this run. Your existing personal best is unchanged.
            </div>
          )}
        <button
          type="button"
          onClick={onTryAgain}
          autoFocus
          style={{
            width: "100%",
            marginTop: 24,
            padding: "13px 18px",
            border: "1px solid rgba(103, 232, 249, 0.7)",
            borderRadius: 14,
            background:
              "linear-gradient(135deg, rgba(14, 165, 233, 0.96), rgba(6, 182, 212, 0.94))",
            color: "#f8fafc",
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: "0.04em",
            cursor: "pointer",
            boxShadow: "0 12px 32px rgba(8, 145, 178, 0.24)",
          }}
        >
          TRY AGAIN
        </button>
        <button
          type="button"
          onClick={onMainMenu}
          style={{
            marginTop: 9,
            padding: "7px 10px",
            border: "1px solid rgba(148, 163, 184, 0.14)",
            borderRadius: 10,
            background: "rgba(15, 23, 42, 0.34)",
            color: "#94a3b8",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            opacity: 0.82,
          }}
        >
          Back to main menu
        </button>
      </section>
    </div>
  );
}
