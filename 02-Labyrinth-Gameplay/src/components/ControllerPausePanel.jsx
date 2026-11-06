import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "../styles/controllerControls.css";

const focusableSelector =
  'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]';

/** Parent owns the simulation pause and clears held gameplay input. */
export function ControllerPausePanel({
  open,
  onResume,
  onExit,
  onInventory,
  world,
  children,
  controllerConnected = false,
}) {
  const panel = useRef(null);
  const resume = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    resume.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const labyrinth = Boolean(world?.labyrinthMode);
  const bindings = [
    ["Left stick", "Move"],
    ["Right stick", world?.viewMode === "3d" ? "Look around" : "Aim"],
    ["R2 / RT", labyrinth ? "Wall Breaker" : "Attack"],
    ["L1–R1 / LB–RB", labyrinth ? "Previous / next light" : "Previous / next weapon"],
    ...(!labyrinth ? [
      ["Square / X", "Use power-up slot 1"],
      ["Triangle / Y", "Use power-up slot 2"],
      ["Cross / A", "Use power-up slot 3"],
    ] : []),
    ["Circle / B", "Scroll down the in-game sidebar"],
    ["D-pad Up", "Toggle minimap"],
    ["L2 / LT", "Return to level selection"],
    ["Options / Menu", "Pause / resume"],
  ];

  const keys = (event) => {
    // Keyboard actions in this dialog must not reach the maze beneath it.
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onResume();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [...(panel.current?.querySelectorAll(focusableSelector) ?? [])]
      .filter((element) => element.getClientRects().length && !element.closest("[hidden],[inert]"));
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const content = (
    <div className="controller-pause-overlay">
      <section
        ref={panel}
        className="controller-pause-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="controller-pause-title"
        aria-describedby="controller-pause-navigation"
        onKeyDown={keys}
        onKeyUp={(event) => event.stopPropagation()}
        data-controller-menu="true"
      >
        <header className="controller-pause-header">
          <div>
            <div className="controller-pause-kicker">{world?.level?.label ?? "Mist Maze"}</div>
            <h2 id="controller-pause-title">Paused</h2>
          </div>
          {controllerConnected && <span className="controller-pause-connected">Controller connected</span>}
        </header>

        <div className="controller-pause-actions">
          <button ref={resume} type="button" className="controller-resume-button" onClick={onResume}>Resume</button>
          {!labyrinth && onInventory && <button type="button" onClick={onInventory}>Purchased powers</button>}
          <button type="button" onClick={onExit}>Return to level selection</button>
        </div>

        <div className="controller-pause-content">
          {children && <section className="controller-pause-settings" aria-label="Game settings">
            <h3>Settings</h3>
            {children}
          </section>}
          <section className="controller-pause-bindings" aria-label="Controller buttons">
            <h3>Controller buttons</h3>
            <dl>{bindings.map(([button, action]) => <div key={button}>
              <dt>{button}</dt><dd>{action}</dd>
            </div>)}</dl>
          </section>
        </div>

        <p id="controller-pause-navigation" className="controller-pause-navigation">
          D-pad: navigate menus · Cross / A: select · Options / Menu: resume
        </p>
      </section>
    </div>
  );

  return typeof document === "undefined" ? content : createPortal(content, document.body);
}
