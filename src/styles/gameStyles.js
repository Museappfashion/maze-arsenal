// src/styles/gameStyles.js
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../config/constants.js";

export const GAME_STYLES = `
    html, body, #root {
      margin: 0;
      width: 100%;
      min-width: 0;
      height: 100%;
      overflow: hidden;
    }

    * {
      box-sizing: border-box;
    }

    .maze-game-shell {
      width: 100vw;
      height: 100vh;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
      background: #020617;
    }

    .maze-stage {
      min-width: 0;
      min-height: 0;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #08111f;
    }

    .maze-frame {
      width: min(100%, calc(100vh * ${CANVAS_WIDTH / CANVAS_HEIGHT}));
      aspect-ratio: ${CANVAS_WIDTH} / ${CANVAS_HEIGHT};
      max-height: 100vh;
      overflow: hidden;
      background: #08111f;
      border-right: 1px solid rgba(148, 163, 184, 0.16);
    }

    .maze-frame canvas {
      width: 100%;
      height: 100%;
    }


    .maze-frame {
      position: relative;
    }

    .maze-stage,
    .maze-frame canvas {
      touch-action: none;
    }

    .touch-controls {
      position: absolute;
      inset: 0;
      z-index: 8;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }

    .touch-move-control,
    .touch-aim-control,
    .touch-action-controls {
      position: absolute;
      pointer-events: auto;
    }

    .touch-move-control {
      left: max(12px, env(safe-area-inset-left));
      bottom: max(12px, env(safe-area-inset-bottom));
    }

    .touch-aim-control {
      right: max(12px, env(safe-area-inset-right));
      bottom: max(12px, env(safe-area-inset-bottom));
    }

    .touch-joystick {
      position: relative;
      width: 124px;
      height: 124px;
      border-radius: 999px;
      touch-action: none;
      background: rgba(2, 6, 23, 0.46);
      border: 2px solid rgba(226, 232, 240, 0.36);
      box-shadow:
        inset 0 0 28px rgba(15, 23, 42, 0.72),
        0 8px 28px rgba(0, 0, 0, 0.24);
      backdrop-filter: blur(3px);
    }

    .touch-joystick::before,
    .touch-joystick::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      background: rgba(226, 232, 240, 0.16);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    .touch-joystick::before {
      width: 2px;
      height: 72%;
    }

    .touch-joystick::after {
      width: 72%;
      height: 2px;
    }

    .touch-joystick-knob {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 50px;
      height: 50px;
      margin-left: -25px;
      margin-top: -25px;
      border-radius: 999px;
      background: rgba(56, 189, 248, 0.72);
      border: 2px solid rgba(224, 242, 254, 0.86);
      box-shadow: 0 0 18px rgba(56, 189, 248, 0.36);
      pointer-events: none;
    }

    .touch-joystick-label {
      position: absolute;
      left: 50%;
      bottom: 7px;
      transform: translateX(-50%);
      color: rgba(248, 250, 252, 0.82);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.12em;
      pointer-events: none;
    }

    .touch-action-controls {
      right: max(18px, env(safe-area-inset-right));
      bottom: calc(max(12px, env(safe-area-inset-bottom)) + 136px);
      display: grid;
      justify-items: end;
      gap: 7px;
    }

    .touch-action-button {
      min-width: 58px;
      min-height: 44px;
      padding: 8px 10px;
      border: 1px solid rgba(226, 232, 240, 0.42);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.76);
      color: #f8fafc;
      font: inherit;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.04em;
      touch-action: none;
      box-shadow: 0 7px 22px rgba(0, 0, 0, 0.24);
      backdrop-filter: blur(3px);
    }

    .touch-action-button:active {
      transform: scale(0.94);
      background: rgba(30, 41, 59, 0.94);
    }

    .touch-attack-button {
      min-width: 72px;
      min-height: 58px;
      border-color: rgba(251, 113, 133, 0.7);
      background: rgba(159, 18, 57, 0.72);
      color: #fff1f2;
    }

    .touch-power-buttons {
      display: flex;
      gap: 7px;
    }

    .touch-power-button {
      min-width: 44px;
      min-height: 40px;
      padding: 6px;
      border-color: rgba(196, 181, 253, 0.55);
      background: rgba(76, 29, 149, 0.62);
    }

    .touch-action-button:disabled {
      opacity: 0.36;
      filter: grayscale(0.7);
    }

    .maze-sidebar {
      min-width: 0;
      height: 100vh;
      overflow-y: auto;
      padding: 14px;
      display: grid;
      align-content: start;
      gap: 14px;
      background: rgba(2, 6, 23, 0.98);
      border-left: 1px solid rgba(148, 163, 184, 0.12);
      scrollbar-gutter: stable;
    }

    @media (max-width: 900px) {
      html, body, #root {
        overflow: auto;
      }

      .maze-game-shell {
        height: auto;
        min-height: 100vh;
        grid-template-columns: 1fr;
      }

      .maze-stage {
        min-height: 58vh;
      }

      .maze-frame {
        width: min(100%, calc(58vh * ${CANVAS_WIDTH / CANVAS_HEIGHT}));
        max-height: 58vh;
        border-right: 0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.16);
      }


      .touch-joystick {
        width: 104px;
        height: 104px;
      }

      .touch-joystick-knob {
        width: 44px;
        height: 44px;
        margin-left: -22px;
        margin-top: -22px;
      }

      .touch-action-controls {
        bottom: calc(max(10px, env(safe-area-inset-bottom)) + 112px);
      }

      .touch-action-button {
        min-width: 52px;
        min-height: 40px;
      }

      .touch-attack-button {
        min-width: 66px;
        min-height: 52px;
      }

      .maze-sidebar {
        height: auto;
        overflow: visible;
        border-left: 0;
      }
    }


    .support-panel {
      display: grid;
      gap: 9px;
      padding: 12px;
      border: 1px solid rgba(244, 114, 182, 0.28);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.9);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.26);
    }

    .support-panel.compact {
      gap: 6px;
      padding: 7px;
      border-radius: 11px;
      background: rgba(2, 6, 23, 0.84);
      backdrop-filter: blur(5px);
    }

    .support-panel-heading {
      display: grid;
      gap: 3px;
    }

    .support-panel-heading strong {
      color: #f9a8d4;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.08em;
    }

    .support-panel-heading span {
      color: #94a3b8;
      font-size: 10px;
      line-height: 1.35;
    }

    .support-button-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
    }

    .support-amount-button {
      min-width: 0;
      min-height: 38px;
      padding: 6px 7px;
      border: 1px solid rgba(244, 114, 182, 0.44);
      border-radius: 10px;
      background: linear-gradient(
        135deg,
        rgba(190, 24, 93, 0.38),
        rgba(131, 24, 67, 0.28)
      );
      color: #fce7f3;
      font: inherit;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.03em;
      cursor: pointer;
      touch-action: manipulation;
    }

    .support-amount-button:hover:not(:disabled) {
      filter: brightness(1.12);
    }

    .support-amount-button:active:not(:disabled) {
      transform: scale(0.95);
    }

    .support-amount-button:disabled {
      cursor: not-allowed;
      opacity: 0.38;
    }

    .support-panel.compact .support-panel-heading strong {
      font-size: 7px;
      text-align: center;
    }

    .support-panel.compact .support-amount-button {
      min-height: 32px;
      padding: 5px;
      font-size: 8px;
    }

    .support-setup-note {
      color: #64748b;
      font-size: 9px;
      line-height: 1.35;
    }

    .mobile-support-panel {
      position: absolute;
      left: 50%;
      bottom: max(10px, env(safe-area-inset-bottom));
      z-index: 12;
      width: min(250px, 46vw);
      transform: translateX(-50%);
      pointer-events: auto;
    }

    .touch-mobile.mode-3d .mobile-support-panel {
      display: none;
    }



    .settings-controls {
      display: grid;
      gap: 8px;
      padding-top: 4px;
    }

    .settings-section-title {
      color: #67e8f9;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.12em;
    }

    .settings-view-toggle {
      width: 100%;
      min-height: 36px;
      padding: 7px 9px;
      border: 1px solid rgba(167, 139, 250, 0.4);
      border-radius: 9px;
      background: rgba(76, 29, 149, 0.24);
      color: #ede9fe;
      font: inherit;
      font-size: 9px;
      font-weight: 900;
      cursor: pointer;
      touch-action: manipulation;
    }

    .game-support-widget {
      position: absolute;
      right: 12px;
      top: max(12px, env(safe-area-inset-top));
      z-index: 18;
      pointer-events: auto;
    }

    .game-support-toggle {
      min-height: 40px;
      padding: 8px 13px;
      border: 1px solid rgba(244, 114, 182, 0.68);
      border-radius: 11px;
      background: linear-gradient(
        135deg,
        rgba(190, 24, 93, 0.92),
        rgba(131, 24, 67, 0.88)
      );
      color: #fdf2f8;
      font: inherit;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.06em;
      cursor: pointer;
      touch-action: manipulation;
      box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.35),
        0 0 18px rgba(244, 114, 182, 0.18);
    }

    .game-support-toggle:active {
      transform: scale(0.96);
    }

    .game-support-popover {
      position: absolute;
      top: calc(100% + 7px);
      right: 0;
      width: min(290px, 72vw);
      padding-top: 8px;
    }

    .game-support-close {
      position: absolute;
      top: 13px;
      right: 6px;
      z-index: 2;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(226, 232, 240, 0.28);
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.94);
      color: #f8fafc;
      font: inherit;
      font-size: 20px;
      line-height: 24px;
      cursor: pointer;
      touch-action: manipulation;
    }

    .game-support-popover .support-panel {
      padding-top: 14px;
      background: rgba(2, 6, 23, 0.97);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.52);
    }

    .touch-mobile .game-support-widget {
      right: max(8px, env(safe-area-inset-right));
      top: max(54px, calc(env(safe-area-inset-top) + 50px));
    }

    .touch-mobile .game-support-toggle {
      min-height: 34px;
      padding: 6px 9px;
      font-size: 8px;
    }

    .touch-mobile.mode-3d .game-support-widget {
      right: max(8px, env(safe-area-inset-right));
      top: max(8px, env(safe-area-inset-top));
    }

    .game-audio-volume-panel {
      position: absolute;
      right: 12px;
      bottom: 12px;
      z-index: 14;
      width: 170px;
      pointer-events: auto;
    }

    .audio-volume-controls {
      display: grid;
      gap: 7px;
      padding: 9px;
      border: 1px solid rgba(74, 222, 128, 0.28);
      border-radius: 12px;
      background: rgba(2, 6, 23, 0.86);
      box-shadow: 0 8px 26px rgba(0, 0, 0, 0.34);
      backdrop-filter: blur(5px);
    }

    .audio-top-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
    }

    .audio-master-toggle,
    .audio-test-button {
      width: 100%;
      min-height: 32px;
      padding: 5px 6px;
      border-radius: 8px;
      font: inherit;
      font-size: 7px;
      font-weight: 900;
      letter-spacing: 0.04em;
      cursor: pointer;
      touch-action: manipulation;
    }

    .audio-master-toggle {
      border: 1px solid rgba(74, 222, 128, 0.4);
      background: rgba(22, 101, 52, 0.28);
      color: #bbf7d0;
    }

    .audio-test-button {
      border: 1px solid rgba(103, 232, 249, 0.48);
      background: rgba(8, 145, 178, 0.3);
      color: #cffafe;
    }

    .audio-test-button:active,
    .audio-master-toggle:active {
      transform: scale(0.96);
    }

    .audio-status-text {
      margin-top: 5px;
      padding: 4px 6px;
      border-radius: 7px;
      background: rgba(2, 6, 23, 0.84);
      color: #bae6fd;
      font-size: 7px;
      font-weight: 800;
      text-align: center;
      line-height: 1.25;
    }

    .audio-volume-row {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .audio-volume-row > span {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      color: #cbd5e1;
      font-size: 7px;
      letter-spacing: 0.06em;
    }

    .audio-volume-row strong {
      color: #e2e8f0;
    }

    .audio-volume-row em {
      color: #67e8f9;
      font-style: normal;
      font-weight: 900;
    }

    .audio-volume-row input[type="range"] {
      width: 100%;
      min-height: 24px;
      margin: 0;
      accent-color: #22d3ee;
      cursor: pointer;
      touch-action: none;
    }

    .touch-mobile .game-audio-volume-panel {
      left: max(10px, env(safe-area-inset-left));
      right: auto;
      top: max(92px, calc(env(safe-area-inset-top) + 88px));
      bottom: auto;
      width: clamp(136px, 29vw, 172px);
    }

    .touch-mobile.mode-3d .game-audio-volume-panel {
      left: max(8px, env(safe-area-inset-left));
      top: max(60px, calc(env(safe-area-inset-top) + 56px));
      width: clamp(132px, 24vw, 164px);
    }


    .sidebar-tools-card {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid rgba(103, 232, 249, 0.2);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.88);
    }

    .sidebar-tools-card.compact {
      gap: 7px;
      padding: 8px;
      border-radius: 11px;
      background: rgba(2, 6, 23, 0.84);
    }

    .sidebar-tools-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 42px;
      gap: 8px;
    }

    .sidebar-new-maze-button,
    .sidebar-settings-gear {
      min-height: 42px;
      border-radius: 10px;
      font: inherit;
      font-weight: 900;
      cursor: pointer;
      touch-action: manipulation;
    }

    .sidebar-new-maze-button {
      min-width: 0;
      padding: 8px 10px;
      border: 1px solid rgba(34, 211, 238, 0.5);
      background: linear-gradient(
        135deg,
        rgba(8, 145, 178, 0.48),
        rgba(14, 116, 144, 0.28)
      );
      color: #ecfeff;
      font-size: 9px;
      letter-spacing: 0.04em;
    }

    .sidebar-settings-gear {
      width: 42px;
      padding: 0;
      border: 1px solid rgba(103, 232, 249, 0.42);
      background: rgba(8, 47, 73, 0.82);
      color: #cffafe;
      font-size: 20px;
      line-height: 1;
    }

    .sidebar-new-maze-button:active,
    .sidebar-settings-gear:active,
    .mobile-settings-gear:active {
      transform: scale(0.96);
    }

    .sidebar-tools-card.compact .sidebar-tools-actions {
      grid-template-columns: minmax(0, 1fr) 36px;
      gap: 6px;
    }

    .sidebar-tools-card.compact .sidebar-new-maze-button,
    .sidebar-tools-card.compact .sidebar-settings-gear {
      min-height: 36px;
    }

    .sidebar-tools-card.compact .sidebar-settings-gear {
      width: 36px;
      font-size: 17px;
    }

    .sidebar-tools-card.compact .sidebar-new-maze-button {
      font-size: 8px;
    }

    .mobile-2d-tools-sidebar {
      display: none;
    }

    .touch-mobile.mode-2d .mobile-2d-tools-sidebar {
      position: fixed;
      top: max(8px, env(safe-area-inset-top));
      right: max(8px, env(safe-area-inset-right));
      z-index: 19;
      display: block;
      width: min(300px, 74vw);
      max-height: calc(100dvh - 16px);
      overflow-y: auto;
      padding: 8px;
      border: 1px solid rgba(103, 232, 249, 0.24);
      border-radius: 14px;
      background: rgba(2, 6, 23, 0.97);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.48);
      pointer-events: auto;
    }

    .mobile-hud-actions .mobile-settings-gear {
      min-width: 36px;
      width: 36px;
      padding: 0;
      border-color: rgba(103, 232, 249, 0.48);
      background: rgba(8, 47, 73, 0.88);
      color: #cffafe;
      font-size: 18px;
      line-height: 1;
    }

    .mobile-3d-sidebar {
      display: none;
    }

    .desktop-3d-sticky {
      position: sticky;
      top: 0;
      z-index: 5;
      padding-bottom: 4px;
      background: rgba(2, 6, 23, 0.98);
    }

    .three-d-status-sidebar-content {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .three-d-status-sidebar-content > section {
      margin: 0;
    }

    .three-d-sidebar-card {
      padding: 10px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.92);
      color: #e2e8f0;
    }

    .three-d-sidebar-title {
      margin-bottom: 8px;
      color: #67e8f9;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.12em;
    }

    .three-d-vitals-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .three-d-vital {
      min-width: 0;
      padding: 7px;
      border-radius: 9px;
      background: rgba(2, 6, 23, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.14);
    }

    .three-d-vital-wide {
      grid-column: 1 / -1;
    }

    .three-d-vital strong {
      display: block;
      color: #94a3b8;
      font-size: 7px;
      letter-spacing: 0.09em;
    }

    .three-d-vital span {
      display: block;
      margin-top: 2px;
      overflow: hidden;
      color: #f8fafc;
      font-size: 11px;
      font-weight: 900;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .three-d-power-slots {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .three-d-power-slots button {
      min-width: 0;
      min-height: 48px;
      padding: 6px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 9px;
      background: rgba(2, 6, 23, 0.72);
      color: #e2e8f0;
      text-align: left;
      touch-action: manipulation;
    }

    .three-d-power-slots button:disabled {
      opacity: 0.48;
    }

    .three-d-power-slots strong {
      display: block;
      color: #c4b5fd;
      font-size: 8px;
    }

    .three-d-power-slots span {
      display: block;
      margin-top: 2px;
      overflow: hidden;
      font-size: 9px;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .three-d-active-powers {
      display: grid;
      gap: 4px;
      margin-top: 7px;
    }

    .three-d-active-powers > div:not(.three-d-no-power) {
      display: grid;
      grid-template-columns: 8px minmax(0, 1fr) auto;
      gap: 5px;
      align-items: center;
      color: #cbd5e1;
      font-size: 8px;
    }

    .three-d-active-powers strong {
      color: #f8fafc;
    }

    .three-d-power-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
    }

    .three-d-no-power {
      color: #64748b;
      font-size: 8px;
    }

    .three-d-sidebar-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .three-d-sidebar-actions button {
      min-height: 34px;
      padding: 6px;
      border: 1px solid rgba(148, 163, 184, 0.26);
      border-radius: 9px;
      background: rgba(30, 41, 59, 0.86);
      color: #e2e8f0;
      font: inherit;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.03em;
      touch-action: manipulation;
    }

    .three-d-sidebar-actions .three-d-start-button {
      grid-column: 1 / -1;
      min-height: 40px;
      border-color: rgba(34, 211, 238, 0.54);
      background: linear-gradient(
        135deg,
        rgba(8, 145, 178, 0.52),
        rgba(14, 116, 144, 0.32)
      );
      color: #ecfeff;
    }


    .mobile-hud-overlay,
    .mobile-rotate-prompt {
      display: none;
    }

    .touch-mobile {
      width: 100vw !important;
      height: 100dvh !important;
      overflow: hidden !important;
      background: #000 !important;
    }

    .touch-mobile .maze-game-shell {
      width: 100vw;
      height: 100dvh;
      grid-template-columns: 1fr;
      overflow: hidden;
      background: #000;
    }

    .touch-mobile .maze-stage {
      width: 100vw;
      height: 100dvh;
      min-height: 0;
      overflow: hidden;
      background: #000;
    }

    .touch-mobile .maze-frame {
      width: 100vw;
      height: 100dvh;
      max-width: none;
      max-height: none;
      aspect-ratio: auto;
      border: 0;
      overflow: hidden;
      background: #000;
    }

    .touch-mobile .maze-frame > canvas {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      filter: contrast(1.16) saturate(1.08) brightness(1.04);
      background: #000;
    }


    .touch-mobile.mode-3d .maze-game-shell {
      grid-template-columns: minmax(0, 1fr) clamp(164px, 27vw, 220px);
    }

    .touch-mobile.mode-3d .maze-stage {
      width: 100%;
      height: 100dvh;
    }

    .touch-mobile.mode-3d .maze-frame {
      width: 100%;
      height: 100dvh;
    }

    .touch-mobile.mode-3d .mobile-hud-overlay {
      display: none;
    }

    .touch-mobile.mode-3d .mobile-3d-sidebar {
      display: block;
      height: 100dvh;
      padding:
        max(7px, env(safe-area-inset-top))
        max(7px, env(safe-area-inset-right))
        max(7px, env(safe-area-inset-bottom))
        7px;
      overflow-y: auto;
      background: rgba(2, 6, 23, 0.98);
      border-left: 1px solid rgba(103, 232, 249, 0.22);
      scrollbar-width: thin;
    }

    .touch-mobile.mode-3d .mobile-3d-sidebar .three-d-status-sidebar-content {
      gap: 6px;
    }

    .touch-mobile.mode-3d .mobile-3d-sidebar section {
      padding: 7px !important;
      border-radius: 10px !important;
    }

    .touch-mobile.mode-3d .mobile-3d-sidebar h2 {
      font-size: 11px !important;
    }

    .touch-mobile.mode-3d .mobile-3d-sidebar canvas {
      max-height: 25vh !important;
    }

    .touch-mobile.mode-3d .touch-aim-control {
      right: max(8px, env(safe-area-inset-right));
    }

    .touch-mobile.mode-3d .touch-action-controls {
      right: max(8px, env(safe-area-inset-right));
    }


    .touch-mobile .maze-sidebar {
      display: none;
    }

    .touch-mobile .mobile-hud-overlay {
      position: absolute;
      inset: 0;
      z-index: 7;
      display: block;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .mobile-hud-status {
      position: absolute;
      top: max(8px, env(safe-area-inset-top));
      left: max(10px, env(safe-area-inset-left));
      display: flex;
      gap: 6px;
      max-width: 60vw;
      pointer-events: none;
    }

    .mobile-hud-chip {
      display: grid;
      gap: 1px;
      min-width: 58px;
      max-width: 128px;
      padding: 5px 7px;
      border: 1px solid rgba(226, 232, 240, 0.3);
      border-radius: 10px;
      background: rgba(2, 6, 23, 0.76);
      color: #f8fafc;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
      backdrop-filter: blur(4px);
    }

    .mobile-hud-chip strong {
      color: #94a3b8;
      font-size: 8px;
      line-height: 1;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .mobile-hud-chip span {
      overflow: hidden;
      font-size: 11px;
      font-weight: 900;
      line-height: 1.15;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mobile-hud-weapon {
      min-width: 90px;
    }

    .mobile-hud-actions {
      position: absolute;
      top: max(50px, calc(env(safe-area-inset-top) + 46px));
      left: max(10px, env(safe-area-inset-left));
      display: flex;
      gap: 6px;
      pointer-events: auto;
    }

    .mobile-hud-actions button {
      min-width: 46px;
      min-height: 34px;
      padding: 6px 8px;
      border: 1px solid rgba(226, 232, 240, 0.32);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.82);
      color: #e2e8f0;
      font: inherit;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.05em;
      touch-action: manipulation;
      box-shadow: 0 5px 16px rgba(0, 0, 0, 0.24);
      backdrop-filter: blur(4px);
    }

    .mobile-hud-actions button:active {
      transform: scale(0.95);
    }

    .mobile-minimap-wrap {
      position: absolute;
      top: max(8px, env(safe-area-inset-top));
      right: max(10px, env(safe-area-inset-right));
      width: clamp(128px, 28vw, 176px);
      max-height: 58vh;
      overflow: auto;
      border-radius: 16px;
      pointer-events: auto;
      touch-action: manipulation;
      transition:
        width 160ms ease,
        transform 160ms ease;
      scrollbar-width: none;
    }

    .mobile-minimap-wrap::-webkit-scrollbar {
      display: none;
    }

    .mobile-minimap-wrap.expanded {
      width: min(44vw, 300px);
    }

    .mobile-minimap-wrap > section,
    .mobile-minimap-wrap > div:first-child {
      margin: 0 !important;
      padding: 8px !important;
      border-radius: 12px !important;
      background: rgba(2, 6, 23, 0.9) !important;
      backdrop-filter: blur(4px);
    }

    .mobile-minimap-wrap canvas {
      max-height: 32vh !important;
    }

    .mobile-minimap-wrap.expanded canvas {
      max-height: 48vh !important;
    }

    .mobile-minimap-hint {
      margin-top: 4px;
      padding: 4px 7px;
      border-radius: 999px;
      background: rgba(2, 6, 23, 0.78);
      color: #bae6fd;
      font-size: 8px;
      font-weight: 900;
      text-align: center;
      letter-spacing: 0.04em;
    }

    .touch-mobile .touch-controls {
      z-index: 9;
    }

    .touch-mobile .touch-joystick {
      border-color: rgba(226, 232, 240, 0.52);
      background: rgba(2, 6, 23, 0.38);
    }

    .touch-mobile .touch-joystick-knob {
      background: rgba(34, 211, 238, 0.78);
      box-shadow:
        0 0 20px rgba(34, 211, 238, 0.52),
        inset 0 0 8px rgba(255, 255, 255, 0.2);
    }

    .touch-mobile .mobile-rotate-prompt {
      display: none;
    }

    @media (orientation: portrait) and (pointer: coarse) {
      .touch-mobile .mobile-rotate-prompt {
        position: absolute;
        left: 50%;
        top: 50%;
        z-index: 20;
        display: grid;
        width: min(82vw, 330px);
        gap: 6px;
        padding: 18px 20px;
        transform: translate(-50%, -50%);
        border: 1px solid rgba(103, 232, 249, 0.52);
        border-radius: 18px;
        background: rgba(2, 6, 23, 0.92);
        color: #f8fafc;
        text-align: center;
        pointer-events: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
      }

      .mobile-rotate-close {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 34px;
        height: 34px;
        padding: 0;
        border: 1px solid rgba(226, 232, 240, 0.28);
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.9);
        color: #f8fafc;
        font: inherit;
        font-size: 24px;
        font-weight: 700;
        line-height: 30px;
        cursor: pointer;
        touch-action: manipulation;
      }

      .mobile-rotate-close:active {
        transform: scale(0.92);
      }

      .mobile-rotate-icon {
        color: #67e8f9;
        font-size: 36px;
        line-height: 1;
      }

      .mobile-rotate-prompt strong {
        font-size: 18px;
      }

      .mobile-rotate-prompt span {
        color: #cbd5e1;
        font-size: 12px;
      }
    }

    @media (orientation: landscape) and (pointer: coarse) {
      .touch-mobile .touch-joystick {
        width: min(25vh, 112px);
        height: min(25vh, 112px);
      }

      .touch-mobile .touch-joystick-knob {
        width: min(10vh, 46px);
        height: min(10vh, 46px);
      }

      .touch-mobile .touch-action-controls {
        right: max(14px, env(safe-area-inset-right));
        bottom: calc(
          max(8px, env(safe-area-inset-bottom)) + min(27vh, 124px)
        );
      }

      .touch-mobile .touch-action-button {
        min-height: 36px;
      }

      .touch-mobile .touch-attack-button {
        min-height: 44px;
      }
    }

  `;
