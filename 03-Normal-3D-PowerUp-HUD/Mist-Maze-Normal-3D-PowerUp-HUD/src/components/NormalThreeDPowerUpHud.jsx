// src/components/NormalThreeDPowerUpHud.jsx
export function NormalThreeDPowerUpHud({
  world,
  storedPowerUps,
  activePowerUps,
}) {
  if (world.viewMode !== "3d" || world.labyrinthMode) {
    return null;
  }

  return (
    <section
      aria-label="3D power-up status"
      style={{
        position: "absolute",
        left: 14,
        bottom: 14,
        zIndex: 30,
        width: 236,
        padding: 10,
        border: "1px solid rgba(167, 139, 250, 0.34)",
        borderRadius: 12,
        background:
          "linear-gradient(145deg, rgba(30, 27, 75, 0.88), rgba(2, 6, 23, 0.88))",
        boxShadow: "0 12px 34px rgba(0, 0, 0, 0.38)",
        backdropFilter: "blur(6px)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          color: "#ddd6fe",
        }}
      >
        <strong
          style={{
            fontSize: 10,
            letterSpacing: "0.13em",
          }}
        >
          POWER-UPS
        </strong>
        <span
          style={{
            color: "#a78bfa",
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.09em",
          }}
        >
          Z / X
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 7,
          marginTop: 8,
        }}
      >
        {storedPowerUps.map((powerUp, index) => {
          const hotkey = index === 0 ? "Z" : "X";
          const color = powerUp?.color ?? "#475569";

          return (
            <div
              key={hotkey}
              style={{
                minWidth: 0,
                padding: "8px 9px",
                border: `1px solid ${
                  powerUp ? `${color}88` : "rgba(148, 163, 184, 0.14)"
                }`,
                borderRadius: 9,
                background: powerUp
                  ? `${color}18`
                  : "rgba(15, 23, 42, 0.54)",
                boxShadow: powerUp ? `0 0 13px ${color}20` : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: powerUp
                      ? `${color}30`
                      : "rgba(71, 85, 105, 0.22)",
                    border: `1px solid ${
                      powerUp ? `${color}66` : "rgba(148, 163, 184, 0.14)"
                    }`,
                    color: powerUp ? color : "#64748b",
                    fontSize: 10,
                    fontWeight: 950,
                  }}
                >
                  {hotkey}
                </span>
                <span
                  style={{
                    overflow: "hidden",
                    color: powerUp ? "#f8fafc" : "#64748b",
                    fontSize: 10,
                    fontWeight: 850,
                    lineHeight: 1.15,
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {powerUp?.label ?? "Empty"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gap: 5,
          marginTop: 7,
        }}
      >
        {activePowerUps.length > 0 ? (
          activePowerUps.map((powerUp) => (
            <div
              key={powerUp.key}
              style={{
                display: "grid",
                gridTemplateColumns: "8px minmax(0, 1fr) auto",
                alignItems: "center",
                gap: 7,
                padding: "5px 7px",
                borderRadius: 8,
                background: "rgba(15, 23, 42, 0.62)",
                border: `1px solid ${powerUp.color}44`,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: powerUp.color,
                  boxShadow: `0 0 8px ${powerUp.color}`,
                }}
              />
              <span
                style={{
                  overflow: "hidden",
                  color: "#e2e8f0",
                  fontSize: 9,
                  fontWeight: 800,
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {powerUp.label}
              </span>
              <strong
                style={{
                  color: "#f8fafc",
                  fontFamily:
                    '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                  fontSize: 9,
                }}
              >
                {powerUp.remaining.toFixed(1)}s
              </strong>
            </div>
          ))
        ) : (
          <div
            style={{
              color: "#64748b",
              fontSize: 9,
              fontWeight: 700,
            }}
          >
            No active power-up
          </div>
        )}
      </div>
    </section>
  );
}
