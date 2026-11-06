// src/components/ThreeDPowerUpOverlay.jsx
import {
  LABYRINTH_LIGHT_ORDER,
  LABYRINTH_LIGHTS,
} from "../config/labyrinthLights.js";

function NormalPowerUps({ storedPowerUps, activePowerUps }) {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#ddd6fe",
          fontSize: 9,
          fontWeight: 950,
          letterSpacing: "0.12em",
        }}
      >
        <span>POWER-UPS</span>
        <span>Z / X</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginTop: 7,
        }}
      >
        {storedPowerUps.map((powerUp, index) => (
          <div
            key={index}
            style={{
              minWidth: 0,
              padding: "7px 8px",
              borderRadius: 8,
              border: `1px solid ${
                powerUp
                  ? `${powerUp.color}77`
                  : "rgba(148,163,184,0.14)"
              }`,
              background: powerUp
                ? `${powerUp.color}18`
                : "rgba(15,23,42,0.55)",
            }}
          >
            <strong
              style={{
                color: powerUp?.color ?? "#64748b",
                fontSize: 9,
              }}
            >
              {index === 0 ? "Z" : "X"}
            </strong>
            <div
              style={{
                marginTop: 2,
                overflow: "hidden",
                color: powerUp ? "#f8fafc" : "#64748b",
                fontSize: 9,
                fontWeight: 800,
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {powerUp?.label ?? "Empty"}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 4, marginTop: 7 }}>
        {activePowerUps.length ? (
          activePowerUps.map((powerUp) => (
            <div
              key={powerUp.key}
              style={{
                display: "grid",
                gridTemplateColumns: "7px minmax(0,1fr) auto",
                alignItems: "center",
                gap: 6,
                color: "#cbd5e1",
                fontSize: 8,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: powerUp.color,
                  boxShadow: `0 0 7px ${powerUp.color}`,
                }}
              />
              <span>{powerUp.label}</span>
              <strong>{powerUp.remaining.toFixed(1)}s</strong>
            </div>
          ))
        ) : (
          <span style={{ color: "#64748b", fontSize: 8 }}>
            No active power-up
          </span>
        )}
      </div>
    </>
  );
}

function LabyrinthPowerUps({ world }) {
  const ownedLights = world.labyrinth?.ownedLights ?? {};
  const equipped = world.labyrinth?.equippedLight;

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#ddd6fe",
          fontSize: 9,
          fontWeight: 950,
          letterSpacing: "0.12em",
        }}
      >
        <span>LABYRINTH POWER-UPS</span>
        <span>
          BREAKERS {world.labyrinth?.breakerCharges ?? 0}/10
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
                borderRadius: 6,
                border: selected
                  ? `1px solid ${light.color}`
                  : "1px solid rgba(148,163,184,0.15)",
                background: owned
                  ? `${light.color}24`
                  : "rgba(15,23,42,0.56)",
                opacity: owned ? 1 : 0.27,
                boxShadow: selected ? `0 0 11px ${light.color}66` : "none",
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
          marginTop: 7,
          color: "#cbd5e1",
          fontSize: 9,
          fontWeight: 800,
        }}
      >
        Equipped:{" "}
        {equipped
          ? LABYRINTH_LIGHTS[equipped]?.label ?? "Base Light"
          : "Base Light"}
      </div>
    </>
  );
}

export function ThreeDPowerUpOverlay({
  world,
  storedPowerUps,
  activePowerUps,
}) {
  if (world.viewMode !== "3d") {
    return null;
  }

  return (
    <section
      aria-label="3D power-up status"
      style={{
        position: "absolute",
        top: world.labyrinthMode ? 82 : 70,
        right: 12,
        zIndex: 30,
        width: world.labyrinthMode ? 230 : 220,
        padding: 10,
        border: "1px solid rgba(167,139,250,0.3)",
        borderRadius: 12,
        background: "rgba(2,6,23,0.84)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        backdropFilter: "blur(5px)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {world.labyrinthMode ? (
        <LabyrinthPowerUps world={world} />
      ) : (
        <NormalPowerUps
          storedPowerUps={storedPowerUps}
          activePowerUps={activePowerUps}
        />
      )}
    </section>
  );
}
