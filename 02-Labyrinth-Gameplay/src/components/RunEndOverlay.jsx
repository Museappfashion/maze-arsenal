// src/components/RunEndOverlay.jsx
export function RunEndOverlay({
  world,
  onRestart,
  onMainMenu,
}) {
  if (!world.gameOver && !world.victory) {
    return null;
  }

  const primaryLabel = world.gameOver ? "START NEW GAME" : "TRY AGAIN";

  return (
    <>
      <style>{`
        @keyframes mist-maze-restart-pulse {
          0%, 100% {
            transform: translateX(-50%) scale(1);
            box-shadow:
              0 0 18px rgba(34, 211, 238, 0.66),
              0 0 42px rgba(250, 204, 21, 0.28);
          }
          50% {
            transform: translateX(-50%) scale(1.055);
            box-shadow:
              0 0 34px rgba(34, 211, 238, 0.95),
              0 0 72px rgba(250, 204, 21, 0.5);
          }
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 42,
          pointerEvents: "none",
        }}
      >
        <button
          type="button"
          onClick={onRestart}
          style={{
            position: "absolute",
            left: "50%",
            top: "62%",
            minWidth: 265,
            padding: "17px 30px",
            border: "2px solid rgba(255,255,255,0.9)",
            borderRadius: 16,
            background:
              "linear-gradient(135deg, #facc15 0%, #67e8f9 48%, #22d3ee 100%)",
            color: "#04111d",
            font: "inherit",
            fontSize: 18,
            fontWeight: 950,
            letterSpacing: "0.075em",
            cursor: "pointer",
            pointerEvents: "auto",
            animation: "mist-maze-restart-pulse 1.25s ease-in-out infinite",
          }}
        >
          {primaryLabel}
        </button>

        <button
          type="button"
          onClick={onMainMenu}
          style={{
            position: "absolute",
            left: "50%",
            top: "73%",
            transform: "translateX(-50%)",
            minWidth: 165,
            padding: "9px 14px",
            border: "1px solid rgba(148,163,184,0.28)",
            borderRadius: 11,
            background: "rgba(15,23,42,0.72)",
            color: "#94a3b8",
            font: "inherit",
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
            pointerEvents: "auto",
            backdropFilter: "blur(5px)",
          }}
        >
          Back to main menu
        </button>
      </div>
    </>
  );
}
