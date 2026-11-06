// src/components/ModeSwitchWarning.jsx
export function ModeSwitchWarning({
  fromMode,
  toMode,
  onConfirm,
  onCancel,
}) {
  const fromLabel = fromMode === "3d" ? "3D" : "2D";
  const toLabel = toMode === "3d" ? "3D" : "2D";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-switch-warning-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(2, 6, 23, 0.72)",
        backdropFilter: "blur(7px)",
      }}
    >
      <section
        style={{
          width: "min(92vw, 430px)",
          padding: "25px 23px 21px",
          borderRadius: 20,
          border: "1px solid rgba(245, 158, 11, 0.34)",
          background:
            "linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.99))",
          boxShadow: "0 26px 80px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          style={{
            color: "#fbbf24",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Leaderboard warning
        </div>
        <h2
          id="mode-switch-warning-title"
          style={{
            margin: "8px 0 0",
            color: "#f8fafc",
            fontSize: 24,
            lineHeight: 1.15,
          }}
        >
          Switch from {fromLabel} to {toLabel}?
        </h2>
        <p
          style={{
            margin: "12px 0 0",
            color: "#cbd5e1",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          Switching view mode during an active run makes this run ineligible
          for the leaderboard. Your existing personal best will not be deleted.
          This warning is shown only on your first confirmed switch.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            style={{
              padding: "11px 13px",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: 12,
              background: "rgba(15, 23, 42, 0.55)",
              color: "#cbd5e1",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            STAY IN {fromLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "11px 13px",
              border: "1px solid rgba(245, 158, 11, 0.5)",
              borderRadius: 12,
              background: "rgba(217, 119, 6, 0.9)",
              color: "#fff7ed",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            SWITCH ANYWAY
          </button>
        </div>
      </section>
    </div>
  );
}
