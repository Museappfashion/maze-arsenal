// src/styles/levelSelectStyles.js

export const LEVEL_SELECT_STYLES = `
        html, body, #root {
          margin: 0;
          width: 100%;
          min-width: 0;
          min-height: 100%;
          background: #020617;
        }

        * {
          box-sizing: border-box;
        }

        button,
        input {
          font: inherit;
        }

        .level-select-screen {
          position: fixed;
          inset: 0;
          overflow-y: auto;
          background:
            radial-gradient(circle at 18% 0%, rgba(14, 116, 144, 0.24), transparent 34%),
            radial-gradient(circle at 82% 8%, rgba(124, 58, 237, 0.2), transparent 30%),
            linear-gradient(180deg, #07111f 0%, #020617 55%, #000 100%);
          color: #e2e8f0;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .level-select-content {
          width: 100%;
          min-height: 100vh;
          padding: clamp(22px, 4vw, 54px);
          display: grid;
          align-content: start;
          gap: clamp(24px, 4vh, 42px);
        }

        .selector-header {
          width: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
        }

        .selector-kicker {
          color: #67e8f9;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .selector-header h1,
        .leaderboard-heading-row h2 {
          margin: 7px 0 0;
          letter-spacing: -0.045em;
          color: #f8fafc;
        }

        .selector-header h1 {
          font-size: clamp(38px, 5vw, 72px);
          line-height: 0.96;
        }


        .first-page-header-actions {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 10px;
        }

        .first-page-settings-button,
        .first-page-support-button {
          min-height: 46px;
          padding: 10px 14px;
          border-radius: 14px;
          color: #f8fafc;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 160ms ease,
            filter 160ms ease;
        }

        .first-page-settings-button {
          width: 46px;
          min-width: 46px;
          padding: 0;
          border: 1px solid rgba(103, 232, 249, 0.44);
          background: rgba(8, 47, 73, 0.72);
          color: #cffafe;
          font-size: 21px;
          line-height: 1;
        }

        .first-page-support-button {
          border: 1px solid rgba(244, 114, 182, 0.58);
          background: linear-gradient(
            135deg,
            rgba(190, 24, 93, 0.68),
            rgba(131, 24, 67, 0.54)
          );
          color: #fdf2f8;
        }

        .first-page-settings-button:hover,
        .first-page-support-button:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        .first-page-expanded-panel {
          width: min(520px, 100%);
          justify-self: end;
          padding: 16px;
          border: 1px solid rgba(103, 232, 249, 0.22);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.9);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.34);
        }

        .first-page-expanded-panel.support-expanded {
          border-color: rgba(244, 114, 182, 0.24);
        }

        .settings-controls {
          display: grid;
          gap: 9px;
        }

        .settings-section-title {
          color: #67e8f9;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .settings-view-toggle {
          width: 100%;
          min-height: 42px;
          padding: 9px 12px;
          border: 1px solid rgba(167, 139, 250, 0.42);
          border-radius: 10px;
          background: rgba(76, 29, 149, 0.28);
          color: #ede9fe;
          font-weight: 900;
          cursor: pointer;
        }

        .audio-volume-controls {
          display: grid;
          gap: 8px;
          padding: 10px;
          border: 1px solid rgba(74, 222, 128, 0.22);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.72);
        }

        .audio-top-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
        }

        .audio-master-toggle,
        .audio-test-button {
          min-height: 38px;
          padding: 7px 9px;
          border-radius: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .audio-master-toggle {
          border: 1px solid rgba(74, 222, 128, 0.36);
          background: rgba(22, 101, 52, 0.22);
          color: #bbf7d0;
        }

        .audio-test-button {
          border: 1px solid rgba(103, 232, 249, 0.42);
          background: rgba(8, 145, 178, 0.22);
          color: #cffafe;
        }

        .audio-volume-row {
          display: grid;
          gap: 4px;
        }

        .audio-volume-row > span {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: #cbd5e1;
          font-size: 10px;
        }

        .audio-volume-row em {
          color: #67e8f9;
          font-style: normal;
          font-weight: 900;
        }

        .audio-volume-row input[type="range"] {
          width: 100%;
          min-height: 28px;
          margin: 0;
          accent-color: #22d3ee;
        }

        .audio-status-text {
          padding: 6px 8px;
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.72);
          color: #bae6fd;
          font-size: 10px;
          font-weight: 800;
          text-align: center;
        }

        .support-panel {
          display: grid;
          gap: 10px;
          padding: 14px;
          border: 1px solid rgba(244, 114, 182, 0.3);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.76);
        }

        .support-panel-heading {
          display: grid;
          gap: 4px;
        }

        .support-panel-heading strong {
          color: #f9a8d4;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .support-panel-heading span {
          color: #94a3b8;
          font-size: 11px;
        }

        .support-button-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .support-amount-button {
          min-height: 42px;
          padding: 7px 8px;
          border: 1px solid rgba(244, 114, 182, 0.44);
          border-radius: 10px;
          background: rgba(190, 24, 93, 0.28);
          color: #fce7f3;
          font-weight: 900;
          cursor: pointer;
        }

        .support-amount-button:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .support-setup-note {
          color: #64748b;
          font-size: 10px;
        }

        .version-beta-button {
          flex: 0 0 auto;
          min-width: 176px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(167, 139, 250, 0.35);
          background: rgba(76, 29, 149, 0.2);
          color: #e9d5ff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-weight: 850;
          cursor: pointer;
          opacity: 0.94;
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            background 160ms ease,
            box-shadow 160ms ease;
        }

        .version-beta-button:hover {
          transform: translateY(-2px);
          border-color: rgba(196, 181, 253, 0.72);
        }

        .version-beta-button.active {
          background: rgba(109, 40, 217, 0.34);
          border-color: rgba(196, 181, 253, 0.78);
          box-shadow: 0 0 30px rgba(124, 58, 237, 0.24);
          color: #f5f3ff;
        }

        .version-beta-button:focus-visible {
          outline: 3px solid #a78bfa;
          outline-offset: 4px;
        }

        .version-beta-button .beta-badge {
          padding: 4px 7px;
          border-radius: 999px;
          background: rgba(167, 139, 250, 0.18);
          border: 1px solid rgba(196, 181, 253, 0.35);
          color: #ddd6fe;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .level-choice-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: clamp(14px, 2vw, 24px);
        }

        .level-choice {
          min-width: 0;
          min-height: clamp(300px, 38vh, 410px);
          padding: 0;
          overflow: hidden;
          border-radius: 22px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.76);
          color: #f8fafc;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.24);
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease;
          display: grid;
          grid-template-rows: minmax(0, 1fr) auto;
        }

        .level-choice:hover {
          transform: translateY(-4px);
          border-color: rgba(125, 211, 252, 0.56);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.34);
        }

        .level-choice:focus-visible {
          outline: 3px solid #38bdf8;
          outline-offset: 4px;
        }

        .level-preview-wrap {
          min-height: 0;
          padding: 12px 12px 0;
        }

        .level-choice-copy {
          padding: 18px 20px 21px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.72), rgba(2, 6, 23, 0.98));
        }

        .level-choice-number {
          color: #7dd3fc;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .level-choice-name {
          margin-top: 6px;
          font-size: clamp(22px, 2.4vw, 31px);
          font-weight: 900;
          letter-spacing: -0.035em;
        }

        .level-leaderboards {
          width: 100%;
          padding: clamp(18px, 2.6vw, 28px);
          border-radius: 24px;
          background: rgba(2, 6, 23, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.16);
          box-shadow: 0 24px 72px rgba(0, 0, 0, 0.28);
        }

        .leaderboard-heading-row {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .leaderboard-heading-row h2 {
          font-size: clamp(25px, 3vw, 38px);
        }

        .leaderboard-limit {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          text-align: right;
        }

        .leaderboard-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .leaderboard-card {
          min-width: 0;
          padding: 16px;
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.13);
        }

        .leaderboard-level-title {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 7px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }

        .leaderboard-level-title span {
          color: #7dd3fc;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .leaderboard-level-title strong {
          color: #f8fafc;
          font-size: 14px;
        }

        .leaderboard-mode-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .leaderboard-mode-column {
          min-width: 0;
          padding: 10px;
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.5);
          border: 1px solid rgba(148, 163, 184, 0.09);
        }

        .leaderboard-mode-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: #64748b;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .leaderboard-mode-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 34px;
          padding: 4px 7px;
          border-radius: 999px;
          color: #e0f2fe;
          background: rgba(14, 116, 144, 0.24);
          border: 1px solid rgba(56, 189, 248, 0.28);
        }

        .leaderboard-mode-badge.mode-3d {
          color: #ede9fe;
          background: rgba(109, 40, 217, 0.24);
          border-color: rgba(167, 139, 250, 0.34);
        }

        .leaderboard-rank-medal {
          font-size: 15px;
          letter-spacing: 0;
        }

        .leaderboard-current-user {
          background: rgba(14, 165, 233, 0.12);
          border-radius: 7px;
          box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.18);
        }

        .leaderboard-name {
          display: flex;
          align-items: center;
          min-width: 0;
          gap: 5px;
        }

        .leaderboard-flag {
          flex: 0 0 auto;
          width: 18px;
          font-size: 13px;
          line-height: 1;
          text-align: center;
        }

        .leaderboard-player-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .leaderboard-your-rank {
          margin-top: 10px;
          padding: 8px 9px;
          border-radius: 9px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          background: rgba(15, 23, 42, 0.48);
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          column-gap: 8px;
          row-gap: 2px;
        }

        .leaderboard-your-rank > span {
          color: #94a3b8;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .leaderboard-your-rank > strong {
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 950;
        }

        .leaderboard-your-rank > small {
          grid-column: 1 / -1;
          color: #64748b;
          font-size: 9px;
          font-weight: 700;
        }

        .leaderboard-your-rank-active {
          border-color: rgba(56, 189, 248, 0.25);
          background: rgba(14, 116, 144, 0.12);
        }

        .leaderboard-your-rank-active > strong {
          color: #67e8f9;
        }

        .leaderboard-list {
          list-style: none;
          margin: 8px 0 0;
          padding: 0;
          display: grid;
        }

        .leaderboard-list li {
          min-width: 0;
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          gap: 6px;
          align-items: center;
          min-height: 28px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.08);
          font-variant-numeric: tabular-nums;
        }

        .leaderboard-list li:last-child {
          border-bottom: 0;
        }

        .leaderboard-rank {
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .leaderboard-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 750;
        }

        .leaderboard-time {
          justify-self: end;
          color: #f8fafc;
          font-size: 11px;
          font-weight: 850;
        }

        .leaderboard-empty {
          color: #475569;
        }

        .name-prompt-backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(2, 6, 23, 0.82);
          backdrop-filter: blur(10px);
        }

        .name-prompt-card {
          width: min(100%, 480px);
          padding: clamp(22px, 4vw, 30px);
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(124, 58, 237, 0.2), transparent 38%),
            #08111f;
          border: 1px solid rgba(148, 163, 184, 0.2);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
        }

        .name-prompt-card h2 {
          margin: 8px 0 8px;
          color: #f8fafc;
          font-size: clamp(27px, 4vw, 38px);
          letter-spacing: -0.04em;
        }

        .name-prompt-description {
          margin: 0 0 20px;
          color: #94a3b8;
          font-size: 14px;
          line-height: 1.55;
        }

        .name-prompt-mode {
          display: inline-flex;
          margin-bottom: 14px;
          padding: 5px 9px;
          border-radius: 999px;
          background: rgba(14, 116, 144, 0.18);
          border: 1px solid rgba(56, 189, 248, 0.22);
          color: #bae6fd;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .name-prompt-mode.mode-3d {
          background: rgba(109, 40, 217, 0.2);
          border-color: rgba(167, 139, 250, 0.28);
          color: #ddd6fe;
        }

        .name-prompt-label {
          display: grid;
          gap: 8px;
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .name-prompt-input {
          width: 100%;
          padding: 14px 15px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background: rgba(2, 6, 23, 0.82);
          color: #f8fafc;
          outline: none;
          text-transform: none;
          letter-spacing: normal;
          font-size: 16px;
          font-weight: 700;
        }

        .name-prompt-input::placeholder {
          color: #475569;
          font-weight: 600;
        }

        .name-prompt-input:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.12);
        }

        .name-prompt-helper {
          margin-top: 8px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.45;
        }

        .name-prompt-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }

        .name-prompt-button {
          padding: 11px 16px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          font-weight: 850;
          cursor: pointer;
        }

        .name-prompt-button.secondary {
          background: rgba(15, 23, 42, 0.72);
          color: #cbd5e1;
        }

        .name-prompt-button.primary {
          border-color: rgba(56, 189, 248, 0.35);
          background: linear-gradient(135deg, #0e7490, #2563eb);
          color: white;
          box-shadow: 0 12px 28px rgba(14, 116, 144, 0.2);
        }

        .name-prompt-button:hover {
          filter: brightness(1.08);
        }

        .name-prompt-button:focus-visible {
          outline: 3px solid #38bdf8;
          outline-offset: 3px;
        }

        @media (max-width: 1180px) {
          .leaderboard-grid {
            grid-template-columns: 1fr;
          }

          .leaderboard-mode-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .selector-header {
            align-items: flex-start;
          }

          .level-choice-grid {
            grid-template-columns: 1fr;
          }

          .level-choice {
            min-height: 340px;
          }
        }

        @media (max-width: 620px) {
          .level-select-content {
            padding: 18px;
          }

          .selector-header {
            display: grid;
          }

          .first-page-header-actions {
            display: grid;
            grid-template-columns: 46px minmax(0, 1fr);
            justify-content: stretch;
          }

          .first-page-settings-button {
            width: 46px;
          }

          .first-page-support-button,
          .version-beta-button {
            width: 100%;
          }

          .first-page-expanded-panel {
            justify-self: stretch;
          }

          .support-button-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .level-choice {
            min-height: 300px;
          }

          .leaderboard-heading-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .leaderboard-limit {
            text-align: left;
          }

          .leaderboard-mode-grid {
            grid-template-columns: 1fr;
          }

          .name-prompt-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      `;
