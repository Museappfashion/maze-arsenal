import { useEffect, useId, useState } from "react";
import {
  MIZ_STATE_CHANGED_EVENT,
  MIZ_TILES_PER_COIN,
  loadMizState,
} from "../services/mizEconomy.js";

const STYLES = `
  .miz-counter {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    z-index: 19;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    border: 1px solid rgba(196,181,253,.45);
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(51,55,69,.93), rgba(39,25,59,.93));
    color: #f5f3ff;
    box-shadow: 0 3px 12px rgba(0,0,0,.28);
    font-family: Inter, system-ui, sans-serif;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    user-select: none;
  }
  .miz-counter svg { width: 28px; height: 28px; flex: 0 0 auto; }
  .miz-counter-copy { display: grid; gap: 2px; }
  .miz-counter-balance { font-size: 15px; line-height: 1; font-weight: 900; }
  .miz-counter-unit { font-size: 9px; color: #ddd6fe; letter-spacing: .07em; }
  .miz-counter-progress { font-size: 10px; line-height: 1.2; color: #cbd5e1; }
  .mode-3d .miz-counter {
    top: calc(17% + 10px);
  }
  .maze-frame:has(.three-d-labyrinth-locator .labyrinth-locator) .miz-counter {
    top: max(200px, calc(17% + 10px));
  }
  .touch-mobile .maze-frame .miz-counter {
    top: max(94px, calc(env(safe-area-inset-top) + 90px));
    left: max(10px, env(safe-area-inset-left));
    padding: 5px 7px;
    gap: 5px;
  }
  .touch-mobile .miz-counter svg { width: 23px; height: 23px; }
  .touch-mobile .miz-counter-balance { font-size: 13px; }
  .touch-mobile .miz-counter-progress { font-size: 9px; }
`;

export function MizCounter() {
  const [state, setState] = useState(loadMizState);
  const gradientId = useId();

  useEffect(() => {
    const handleChange = (event) => {
      setState(event.detail?.state ?? loadMizState());
    };
    window.addEventListener(MIZ_STATE_CHANGED_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    setState(loadMizState());

    return () => {
      window.removeEventListener(MIZ_STATE_CHANGED_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <aside className="miz-counter" aria-label="Miz wallet">
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <defs>
            <radialGradient id={gradientId} cx="34%" cy="27%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="32%" stopColor="#d1d5db" />
              <stop offset="70%" stopColor="#9ca3af" />
              <stop offset="100%" stopColor="#4b5563" />
            </radialGradient>
          </defs>
          <circle cx="18" cy="18" r="16" fill={`url(#${gradientId})`} stroke="#e9d5ff" strokeWidth="1.5" />
          <circle cx="18" cy="18" r="11.5" fill="none" stroke="#6b647c" strokeWidth="1" />
          <circle cx="18" cy="18" r="8.3" fill="#59546a" stroke="#c4b5fd" strokeWidth=".8" />
          <text x="18" y="22.2" textAnchor="middle" fontFamily="Inter,system-ui,sans-serif" fontSize="12" fontWeight="900" fill="#fff">M</text>
        </svg>
        <div className="miz-counter-copy">
          <span className="miz-counter-balance" role="status" aria-live="polite" aria-atomic="true">
            {state.miz} <span className="miz-counter-unit">MIZ</span>
          </span>
          <span
            className="miz-counter-progress"
            aria-label={`${state.tileRemainder} of ${MIZ_TILES_PER_COIN} newly explored floor tiles toward the next coin`}
          >
            {state.tileRemainder}/{MIZ_TILES_PER_COIN} tiles
          </span>
        </div>
      </aside>
    </>
  );
}
