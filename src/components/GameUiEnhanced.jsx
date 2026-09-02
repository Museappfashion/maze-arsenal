// src/components/GameUiEnhanced.jsx
import {
  useCallback,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  SettingsControls as BaseSettingsControls,
  SidebarSettings as BaseSidebarSettings,
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
      window.localStorage.getItem(
        WARNING_STORAGE_KEY,
      ) === "1"
    );
  } catch {
    return false;
  }
}

function rememberWarning() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      WARNING_STORAGE_KEY,
      "1",
    );
  } catch {
    // Browser storage can be unavailable.
  }
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

function ModeSwitchWarning({
  open,
  nextMode,
  onContinue,
  onGoBack,
}) {
  if (
    !open ||
    typeof document === "undefined"
  ) {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      onPointerDown={(event) =>
        event.stopPropagation()
      }
      onClick={(event) =>
        event.stopPropagation()
      }
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(2,6,23,0.78)",
        backdropFilter: "blur(8px)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-switch-warning-title"
        style={{
          width:
            "min(520px, calc(100vw - 32px))",
          padding: 24,
          borderRadius: 22,
          border:
            "1px solid rgba(251,191,36,0.38)",
          background:
            "linear-gradient(145deg, rgba(30,41,59,0.98), rgba(2,6,23,0.99))",
          boxShadow:
            "0 28px 80px rgba(0,0,0,0.55)",
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
          Switching between 2D and 3D
          during this run makes the current
          run ineligible for the leaderboard.
          Your existing personal best is safe.
        </p>

        <p
          style={{
            margin: "10px 0 0",
            color: "#94a3b8",
            lineHeight: 1.55,
            fontSize: 13,
          }}
        >
          This warning is shown only once.
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
              border:
                "1px solid rgba(148,163,184,0.22)",
              background:
                "rgba(30,41,59,0.72)",
              color: "#cbd5e1",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            STAY HERE
          </button>

          <button
            type="button"
            onClick={onContinue}
            autoFocus
            style={{
              minHeight: 46,
              borderRadius: 13,
              border:
                "1px solid rgba(251,191,36,0.55)",
              background:
                "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#111827",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow:
                "0 10px 28px rgba(245,158,11,0.22)",
            }}
          >
            SWITCH ANYWAY
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function useModeSwitchGuard(
  viewMode,
  onToggleViewMode,
) {
  const [warningOpen, setWarningOpen] =
    useState(false);
  const nextMode =
    viewMode === "3d" ? "2d" : "3d";

  const requestSwitch = useCallback(() => {
    if (
      isLabyrinthScreen() ||
      warningAlreadySeen()
    ) {
      onToggleViewMode?.();
      return;
    }

    rememberWarning();
    setWarningOpen(true);
  }, [onToggleViewMode]);

  const continueSwitch = useCallback(() => {
    setWarningOpen(false);
    onToggleViewMode?.();
  }, [onToggleViewMode]);

  const goBack = useCallback(() => {
    setWarningOpen(false);
  }, []);

  return {
    requestSwitch,
    warning: (
      <ModeSwitchWarning
        open={warningOpen}
        nextMode={nextMode}
        onContinue={continueSwitch}
        onGoBack={goBack}
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
    useModeSwitchGuard(
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
  ...props
}) {
  const { requestSwitch, warning } =
    useModeSwitchGuard(
      viewMode,
      onToggleViewMode,
    );

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
