// src/components/GameUiEnhanced.jsx
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
  SettingsControls as BaseSettingsControls,
  SidebarSettings as BaseSidebarSettings,
} from "./GameUi.jsx";

export * from "./GameUi.jsx";

let warningShownForCurrentGame = false;
let lifecycleTrackingInstalled = false;

function resetModeSwitchWarning() {
  warningShownForCurrentGame = false;
}

function isLabyrinthScreen() {
  if (typeof document === "undefined") {
    return false;
  }

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

function installGameLifecycleTracking() {
  if (
    lifecycleTrackingInstalled ||
    typeof document === "undefined" ||
    typeof MutationObserver === "undefined"
  ) {
    return;
  }

  lifecycleTrackingInstalled = true;
  let gameRootPresent = Boolean(
    document.querySelector(".maze-game-root"),
  );

  const observer = new MutationObserver(() => {
    const nextGameRootPresent = Boolean(
      document.querySelector(".maze-game-root"),
    );

    if (nextGameRootPresent && !gameRootPresent) {
      resetModeSwitchWarning();
    }

    gameRootPresent = nextGameRootPresent;
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target?.closest?.("button");

      if (!button) {
        return;
      }

      const label = button.textContent?.trim().toUpperCase() ?? "";

      if (label.includes("START NEW MAZE")) {
        resetModeSwitchWarning();
      }
    },
    true,
  );
}

if (typeof document !== "undefined") {
  installGameLifecycleTracking();
}

function ModeSwitchWarning({
  open,
  nextMode,
  onContinue,
  onGoBack,
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
        background: "rgba(2, 6, 23, 0.78)",
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
          border: "1px solid rgba(251, 191, 36, 0.38)",
          background:
            "linear-gradient(145deg, rgba(30,41,59,0.98), rgba(2,6,23,0.99))",
          boxShadow: "0 28px 80px rgba(0,0,0,0.55)",
          color: "#e2e8f0",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            color: "#fbbf24",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Leaderboard warning
        </div>

        <h2
          id="mode-switch-warning-title"
          style={{
            margin: "8px 0 0",
            fontSize: 24,
            lineHeight: 1.15,
          }}
        >
          Switch to {nextMode.toUpperCase()}?
        </h2>

        <p
          style={{
            margin: "14px 0 0",
            color: "#cbd5e1",
            lineHeight: 1.65,
            fontSize: 15,
          }}
        >
          Switching between 2D and 3D during this run makes the
          current run ineligible for the leaderboard. Your existing
          personal best is safe.
        </p>

        <p
          style={{
            margin: "10px 0 0",
            color: "#94a3b8",
            lineHeight: 1.55,
            fontSize: 13,
          }}
        >
          This warning appears only on the first switch attempt of
          each game.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 22,
          }}
        >
          <button
            type="button"
            onClick={onGoBack}
            style={{
              minHeight: 46,
              borderRadius: 13,
              border: "1px solid rgba(148,163,184,0.22)",
              background: "rgba(30,41,59,0.72)",
              color: "#cbd5e1",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            GO BACK
          </button>

          <button
            type="button"
            onClick={onContinue}
            autoFocus
            style={{
              minHeight: 46,
              borderRadius: 13,
              border: "1px solid rgba(251,191,36,0.55)",
              background:
                "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#111827",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 10px 28px rgba(245,158,11,0.22)",
            }}
          >
            CONTINUE ANYWAY
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function useModeSwitchGuard(viewMode, onToggleViewMode) {
  const [warningOpen, setWarningOpen] = useState(false);
  const nextMode = viewMode === "3d" ? "2d" : "3d";

  const requestSwitch = useCallback(() => {
    if (
      warningShownForCurrentGame ||
      isLabyrinthScreen()
    ) {
      onToggleViewMode?.();
      return;
    }

    warningShownForCurrentGame = true;
    setWarningOpen(true);
  }, [onToggleViewMode]);

  const continueSwitch = useCallback(() => {
    setWarningOpen(false);
    onToggleViewMode?.();
  }, [onToggleViewMode]);

  const goBack = useCallback(() => {
    setWarningOpen(false);
  }, []);

  const warning = (
    <ModeSwitchWarning
      open={warningOpen}
      nextMode={nextMode}
      onContinue={continueSwitch}
      onGoBack={goBack}
    />
  );

  return {
    requestSwitch,
    warning,
  };
}

export function SettingsControls({
  viewMode,
  onToggleViewMode,
  ...props
}) {
  const { requestSwitch, warning } = useModeSwitchGuard(
    viewMode,
    onToggleViewMode,
  );

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
  onStart,
  ...props
}) {
  const { requestSwitch, warning } = useModeSwitchGuard(
    viewMode,
    onToggleViewMode,
  );

  const handleStart = useCallback(() => {
    resetModeSwitchWarning();
    onStart?.();
  }, [onStart]);

  return (
    <>
      <BaseSidebarSettings
        {...props}
        viewMode={viewMode}
        onToggleViewMode={requestSwitch}
        onStart={handleStart}
      />
      {warning}
    </>
  );
}
