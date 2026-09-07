// src/components/GameUiEnhanced.jsx
import {
  useCallback,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  SettingsControls as BaseSettingsControls,
  SidebarSettings as BaseSidebarSettings,
  TouchControls as BaseTouchControls,
  TouchJoystick,
} from "./GameUi.jsx?core";

export * from "./GameUi.jsx?core";

const WARNING_STORAGE_KEY =
  "mist-maze-mode-switch-warning-seen-v1";

function warningAlreadySeen() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(WARNING_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

function rememberWarning() {
  try {
    window.localStorage.setItem(WARNING_STORAGE_KEY, "1");
  } catch {
    // Restricted storage can be unavailable.
  }
}

function isLabyrinthScreen() {
  return Boolean(
    document.querySelector(
      [
        ".labyrinth-status-panel",
        ".labyrinth-locator",
        ".labyrinth-mobile-hud",
        ".three-d-labyrinth-locator",
      ].join(","),
    ),
  );
}

function ModeSwitchWarning({
  open,
  nextMode,
  onContinue,
  onCancel,
}) {
  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(2,6,23,0.8)",
        backdropFilter: "blur(8px)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-switch-warning-title"
        style={{
          width: "min(520px, calc(100vw - 32px))",
          padding: 24,
          borderRadius: 22,
          border: "1px solid rgba(251,191,36,0.38)",
          background:
            "linear-gradient(145deg, rgba(30,41,59,0.98), rgba(2,6,23,0.99))",
          boxShadow: "0 28px 80px rgba(0,0,0,0.55)",
          color: "#e2e8f0",
        }}
      >
        <div
          style={{
            color: "#fbbf24",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.12em",
          }}
        >
          LEADERBOARD WARNING
        </div>
        <h2
          id="mode-switch-warning-title"
          style={{ margin: "8px 0 0", fontSize: 24 }}
        >
          Switch to {nextMode.toUpperCase()}?
        </h2>
        <p
          style={{
            margin: "14px 0 0",
            color: "#cbd5e1",
            lineHeight: 1.6,
          }}
        >
          Switching between 2D and 3D makes this run
          ineligible for the leaderboard. Existing scores
          are safe.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 22,
          }}
        >
          <button type="button" onClick={onCancel}>
            STAY HERE
          </button>
          <button type="button" onClick={onContinue} autoFocus>
            SWITCH ANYWAY
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function useModeSwitchGuard(viewMode, onToggleViewMode) {
  const [open, setOpen] = useState(false);
  const nextMode = viewMode === "3d" ? "2d" : "3d";

  const requestSwitch = useCallback(() => {
    if (
      isLabyrinthScreen() ||
      warningAlreadySeen()
    ) {
      onToggleViewMode?.();
      return;
    }

    rememberWarning();
    setOpen(true);
  }, [onToggleViewMode]);

  const continueSwitch = useCallback(() => {
    setOpen(false);
    onToggleViewMode?.();
  }, [onToggleViewMode]);

  return {
    requestSwitch,
    warning: (
      <ModeSwitchWarning
        open={open}
        nextMode={nextMode}
        onContinue={continueSwitch}
        onCancel={() => setOpen(false)}
      />
    ),
  };
}

export function SettingsControls({
  viewMode,
  onToggleViewMode,
  ...props
}) {
  const { requestSwitch, warning } =
    useModeSwitchGuard(viewMode, onToggleViewMode);

  return (
    <>
      <BaseSettingsControls
        {...props}
        viewMode={viewMode}
        onToggleViewMode={requestSwitch}
      />
      {warning}
    </>
  );
}

export function SidebarSettings({
  viewMode,
  onToggleViewMode,
  ...props
}) {
  const { requestSwitch, warning } =
    useModeSwitchGuard(viewMode, onToggleViewMode);

  return (
    <>
      <BaseSidebarSettings
        {...props}
        viewMode={viewMode}
        onToggleViewMode={requestSwitch}
      />
      {warning}
    </>
  );
}

export function TouchControls({
  gameMode,
  storedPowerUps,
  onMove,
  onAim,
  onLookDelta,
  onAimStart,
  onAimEnd,
  onNextWeapon,
  onNextLight,
  labyrinthLightLabel = "Base Light",
  onPowerUp,
  labyrinthMode = false,
  labyrinthBreakers = 0,
  onBreaker,
}) {
  if (labyrinthMode) {
    return (
      <BaseTouchControls
        gameMode={gameMode}
        storedPowerUps={storedPowerUps}
        onMove={onMove}
        onAim={onAim}
        onLookDelta={onLookDelta}
        onAimStart={onAimStart}
        onAimEnd={onAimEnd}
        onNextWeapon={onNextWeapon}
        onNextLight={onNextLight}
        labyrinthLightLabel={labyrinthLightLabel}
        onPowerUp={onPowerUp}
        labyrinthMode
        labyrinthBreakers={labyrinthBreakers}
        onBreaker={onBreaker}
      />
    );
  }

  return (
    <div
      className="touch-controls"
      aria-label="Touch game controls"
    >
      <div className="touch-move-control">
        <TouchJoystick
          label="MOVE"
          onVector={onMove}
        />
      </div>

      <div className="touch-aim-control">
        <TouchJoystick
          label={gameMode === "3d" ? "LOOK" : "AIM"}
          mode={gameMode === "3d" ? "look" : "vector"}
          onVector={onAim}
          onLookDelta={onLookDelta}
          onPointerStart={onAimStart}
          onPointerEnd={onAimEnd}
        />
      </div>

      <div className="touch-action-controls">
        <button
          type="button"
          className="touch-action-button"
          aria-label="Switch to next weapon"
          onClick={onNextWeapon}
        >
          WEAPON
        </button>

        <div className="touch-power-buttons">
          {[0, 1, 2].map((slotIndex) => (
            <button
              key={slotIndex}
              type="button"
              data-mist-power-slot={slotIndex}
              className="touch-action-button touch-power-button"
              aria-label={`Use power-up slot ${slotIndex + 1}`}
              disabled={!storedPowerUps[slotIndex]}
              onClick={() => onPowerUp(slotIndex)}
            >
              P{slotIndex + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

