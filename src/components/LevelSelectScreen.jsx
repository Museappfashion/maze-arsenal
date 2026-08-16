// src/components/LevelSelectScreen.jsx
import { useEffect, useRef, useState } from "react";
import { LEVEL_SELECT_STYLES } from "../styles/levelSelectStyles.js";
import { SettingsControls, SupportButtons } from "./GameUi.jsx";
import { LEVELS } from "../config/constants.js";
import {
  LABYRINTH_DEFAULT_DIFFICULTY,
  LABYRINTH_DEFAULT_MINUTES,
  LABYRINTH_DIFFICULTIES,
  LABYRINTH_MAX_MINUTES,
  LABYRINTH_MIN_MINUTES,
} from "../config/labyrinth.js";
import { LEADERBOARD_LIMIT, countryCodeToFlag, normalizeLevelLeaderboards } from "../services/leaderboard.js";
import { formatLeaderboardTime } from "../utils/math.js";
import { PLAYER_NAME_LIMIT, getPlayerDisplayName, sanitizePlayerName } from "../utils/player.js";

export const LEVEL_PREVIEW_THEMES = {
  space: {
    background: "#020611",
    floor: "#07111f",
    floorAlt: "#0b1728",
    wall: "#31516c",
    wallDark: "#142c43",
    edge: "#67e8f9",
    glow: "#38bdf8",
  },
  jungle: {
    background: "#031008",
    floor: "#163b1f",
    floorAlt: "#1d4724",
    wall: "#405f35",
    wallDark: "#253f27",
    edge: "#a3e635",
    glow: "#4ade80",
  },
  medieval: {
    background: "#0c0907",
    floor: "#342f2b",
    floorAlt: "#3e3730",
    wall: "#70675e",
    wallDark: "#49423d",
    edge: "#fdba74",
    glow: "#f59e0b",
  },
  labyrinth: {
    background: "#010204",
    floor: "#07090c",
    floorAlt: "#0b0e12",
    wall: "#242a31",
    wallDark: "#11151a",
    edge: "#94a3b8",
    glow: "#c084fc",
  },
};

export function ThemedPlayerPreview({ themeKey }) {
  if (themeKey === "space") {
    return (
      <g transform="translate(57 165)">
        <path
          d="M-9 -16 L14 -6 L24 0 L14 6 L-9 16 L-5 7 L-18 11 L-14 0 L-18 -11 L-5 -7 Z"
          fill="#94a3b8"
          stroke="#e2e8f0"
          strokeWidth="2"
        />
        <ellipse cx="6" cy="0" rx="7" ry="5" fill="#22d3ee" stroke="#cffafe" strokeWidth="1.5" />
        <path d="M-15 -5 L-25 -9 L-19 -2 Z" fill="#22d3ee" opacity="0.9" />
        <path d="M-15 5 L-25 9 L-19 2 Z" fill="#22d3ee" opacity="0.9" />
        <circle cx="19" cy="0" r="2" fill="#fde047" />
      </g>
    );
  }

  if (themeKey === "jungle") {
    return (
      <g transform="translate(57 165)">
        <ellipse cx="-5" cy="0" rx="12" ry="14" fill="#78350f" stroke="#1c1917" strokeWidth="2" />
        <ellipse cx="1" cy="0" rx="13" ry="11" fill="#4d7c0f" stroke="#1c1917" strokeWidth="2" />
        <circle cx="10" cy="0" r="7" fill="#c68642" stroke="#1c1917" strokeWidth="2" />
        <ellipse cx="10" cy="0" rx="13" ry="5" fill="#a16207" stroke="#1c1917" strokeWidth="2" />
        <ellipse cx="10" cy="-1" rx="7" ry="5" fill="#ca8a04" />
        <path d="M-2 -9 L13 8" stroke="#d6b06f" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }

  if (themeKey === "labyrinth") {
    return (
      <g transform="translate(57 165)">
        <circle cx="0" cy="0" r="16" fill="#030712" stroke="#94a3b8" strokeWidth="2" />
        <circle cx="6" cy="-3" r="5" fill="#e5e7eb" />
        <path d="M-10 12 L-18 24 M4 13 L9 26" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
        <path d="M-11 -4 L-22 5 M10 -2 L21 6" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
        <circle cx="6" cy="-3" r="10" fill="#c084fc" opacity="0.13" />
      </g>
    );
  }

  return (
    <g transform="translate(57 165)">
      <ellipse cx="-3" cy="0" rx="12" ry="14" fill="#57534e" stroke="#1c1917" strokeWidth="2" />
      <path
        d="M2 -12 L14 -8 L18 0 L14 8 L2 12 L-3 0 Z"
        fill="#78716c"
        stroke="#e7e5e4"
        strokeWidth="2"
      />
      <circle cx="10" cy="0" r="8" fill="#a8a29e" stroke="#1c1917" strokeWidth="2" />
      <path d="M10 -8 L10 8" stroke="#e7e5e4" strokeWidth="2" />
      <path d="M5 -3 L15 -3" stroke="#292524" strokeWidth="2" />
      <path d="M-1 -12 L-10 0 L-1 12" fill="#7f1d1d" stroke="#fecaca" strokeWidth="1.5" />
    </g>
  );
}

export function LevelPreview({ level }) {
  const theme = LEVEL_PREVIEW_THEMES[level.themeKey] ?? LEVEL_PREVIEW_THEMES.space;
  const gridLines = Array.from({ length: 9 }, (_, index) => 24 + index * 44);

  return (
    <svg
      viewBox="0 0 420 220"
      role="img"
      aria-label={`${level.label} ${level.subtitle} themed maze preview`}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        minHeight: 0,
        borderRadius: 16,
      }}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="420" height="220" fill={theme.background} />
      <rect x="16" y="16" width="388" height="188" rx="18" fill={theme.floor} />

      {gridLines.map((position) => (
        <g key={position} opacity="0.18">
          <line x1={position} y1="16" x2={position} y2="204" stroke={theme.edge} strokeWidth="1" />
          <line x1="16" y1={position / 2} x2="404" y2={position / 2} stroke={theme.edge} strokeWidth="1" />
        </g>
      ))}

      <g fill={theme.wall} stroke={theme.edge} strokeWidth="1.5">
        <rect x="16" y="16" width="388" height="22" rx="4" />
        <rect x="16" y="182" width="388" height="22" rx="4" />
        <rect x="16" y="16" width="22" height="188" rx="4" />
        <rect x="382" y="16" width="22" height="188" rx="4" />
        <rect x="92" y="38" width="22" height="103" rx="4" />
        <rect x="92" y="119" width="102" height="22" rx="4" />
        <rect x="172" y="38" width="22" height="62" rx="4" />
        <rect x="172" y="78" width="126" height="22" rx="4" />
        <rect x="276" y="78" width="22" height="84" rx="4" />
        <rect x="276" y="140" width="89" height="22" rx="4" />
        <rect x="343" y="38" width="22" height="102" rx="4" />
      </g>

      <g opacity="0.32" fill={theme.wallDark}>
        <rect x="23" y="23" width="374" height="8" rx="3" />
        <rect x="99" y="45" width="8" height="88" rx="3" />
        <rect x="179" y="45" width="8" height="47" rx="3" />
        <rect x="283" y="85" width="8" height="69" rx="3" />
        <rect x="350" y="45" width="8" height="87" rx="3" />
      </g>

      <circle cx="57" cy="165" r="27" fill={theme.glow} opacity="0.12" />
      <circle cx="57" cy="165" r="21" fill="none" stroke={theme.glow} strokeWidth="2" opacity="0.85" />
      <ThemedPlayerPreview themeKey={level.themeKey} />

      {level.themeKey === "space" && (
        <>
          <circle cx="322" cy="52" r="1.7" fill="#ffffff" opacity="0.9" />
          <circle cx="248" cy="174" r="1.2" fill="#bae6fd" opacity="0.8" />
          <circle cx="145" cy="58" r="1.3" fill="#ffffff" opacity="0.8" />
        </>
      )}

      {level.themeKey === "jungle" && (
        <>
          <circle cx="141" cy="161" r="8" fill="#166534" opacity="0.8" />
          <circle cx="154" cy="168" r="6" fill="#15803d" opacity="0.75" />
          <circle cx="322" cy="116" r="7" fill="#166534" opacity="0.8" />
        </>
      )}

      {level.themeKey === "medieval" && (
        <>
          <circle cx="145" cy="162" r="5" fill="#f59e0b" opacity="0.85" />
          <circle cx="145" cy="162" r="10" fill="#f59e0b" opacity="0.12" />
          <circle cx="326" cy="53" r="5" fill="#f59e0b" opacity="0.85" />
          <circle cx="326" cy="53" r="10" fill="#f59e0b" opacity="0.12" />
        </>
      )}

      {level.themeKey === "labyrinth" && (
        <>
          <rect x="92" y="80" width="22" height="42" fill="#7c8794" opacity="0.85" />
          <rect x="276" y="119" width="22" height="43" fill="#7c8794" opacity="0.85" />
          <path d="M96 84 L110 98 M96 98 L110 112" stroke="#d5dde7" strokeWidth="2" opacity="0.7" />
          <path d="M280 124 L294 138 M280 138 L294 152" stroke="#d5dde7" strokeWidth="2" opacity="0.7" />
          <circle cx="336" cy="168" r="12" fill="#c084fc" opacity="0.16" />
        </>
      )}
    </svg>
  );
}

export function LeaderboardModeList({
  entries,
  levelKey,
  mode,
  userRank = null,
  status = "local",
}) {
  const getRankDisplay = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return String(index + 1).padStart(2, "0");
  };

  return (
    <div className="leaderboard-mode-column">
      <div className="leaderboard-mode-title">
        <span className={`leaderboard-mode-badge mode-${mode}`}>
          {mode === "3d" ? "3D" : "2D"}
        </span>
        <span>Top {LEADERBOARD_LIMIT}</span>
      </div>

      <ol className="leaderboard-list">
        {Array.from({ length: LEADERBOARD_LIMIT }, (_, index) => {
          const entry = entries[index];

          return (
            <li
              className={entry?.isCurrentUser ? "leaderboard-current-user" : ""}
              key={`${levelKey}-${mode}-${entry?.completedAt ?? index}-${index}`}
            >
              <span
                className={`leaderboard-rank ${
                  index < 3 ? "leaderboard-rank-medal" : ""
                }`}
                aria-label={`Rank ${index + 1}`}
              >
                {getRankDisplay(index)}
              </span>
              <span
                className={
                  entry
                    ? "leaderboard-name"
                    : "leaderboard-name leaderboard-empty"
                }
                title={entry?.playerName ?? ""}
              >
                {entry ? (
                  <>
                    <span
                      className="leaderboard-flag"
                      title={entry.countryCode || "Country unavailable"}
                    >
                      {countryCodeToFlag(entry.countryCode)}
                    </span>
                    <span className="leaderboard-player-name">
                      {getPlayerDisplayName(entry.playerName)}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span
                className={
                  entry
                    ? "leaderboard-time"
                    : "leaderboard-time leaderboard-empty"
                }
              >
                {entry ? formatLeaderboardTime(entry.time) : "--:--.--"}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className={`leaderboard-your-rank ${
          userRank ? "leaderboard-your-rank-active" : ""
        }`}
      >
        <span>Your global rank</span>
        <strong>
          {status === "online" && userRank?.rank
            ? `#${userRank.rank}`
            : status === "connecting"
              ? "…"
              : "—"}
        </strong>
        {status === "online" && userRank?.bestTime ? (
          <small>Best {formatLeaderboardTime(userRank.bestTime)}</small>
        ) : (
          <small>{status === "online" ? "Finish a run to rank" : "Online only"}</small>
        )}
      </div>
    </div>
  );
}

export function LeaderboardPanel({
  leaderboards,
  userRanks,
  status = "local",
}) {
  const levels = Object.values(LEVELS).filter((level) => level.leaderboard !== false);

  return (
    <section className="level-leaderboards" aria-labelledby="leaderboard-title">
      <div className="leaderboard-heading-row">
        <div>
          <div className="selector-kicker">
            {status === "online"
              ? "Global records"
              : status === "connecting"
                ? "Connecting to global records"
                : status === "offline"
                  ? "Cached global records"
                  : "Local records"}
          </div>
          <h2 id="leaderboard-title">Fastest escapes</h2>
        </div>
        <div className="leaderboard-limit">
          {status === "online"
            ? `Worldwide top ${LEADERBOARD_LIMIT} — separate 2D and 3D lists`
            : status === "connecting"
              ? "Loading worldwide scores…"
              : status === "offline"
                ? "Offline — showing the last cached scores"
                : `Separate top ${LEADERBOARD_LIMIT} lists for 2D and 3D`}
        </div>
      </div>

      <div className="leaderboard-grid">
        {levels.map((level) => {
          const levelBoards = normalizeLevelLeaderboards(
            leaderboards[level.key],
          );

          return (
            <article className="leaderboard-card" key={level.key}>
              <div className="leaderboard-level-title">
                <span>{level.label}</span>
                <strong>{level.subtitle}</strong>
              </div>

              <div className="leaderboard-mode-grid">
                <LeaderboardModeList
                  entries={levelBoards["2d"]}
                  levelKey={level.key}
                  mode="2d"
                  userRank={userRanks?.[level.key]?.["2d"] ?? null}
                  status={status}
                />
                <LeaderboardModeList
                  entries={levelBoards["3d"]}
                  levelKey={level.key}
                  mode="3d"
                  userRank={userRanks?.[level.key]?.["3d"] ?? null}
                  status={status}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function LevelSelectScreen({
  onSelectLevel,
  leaderboards,
  leaderboardStatus = "local",
  userRanks,
  viewMode,
  onViewModeChange,
  initialPlayerName = "",
  audioEnabled,
  musicVolume,
  sfxVolume,
  onToggleAudio,
  onTestSound,
  onMusicVolumeChange,
  onSfxVolumeChange,
  audioStatus,
}) {
  const levels = Object.values(LEVELS);
  const [pendingLevelKey, setPendingLevelKey] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [labyrinthDifficulty, setLabyrinthDifficulty] = useState(
    LABYRINTH_DEFAULT_DIFFICULTY,
  );
  const [labyrinthMinutes, setLabyrinthMinutes] = useState(
    LABYRINTH_DEFAULT_MINUTES,
  );
  const [draftPlayerName, setDraftPlayerName] = useState(
    sanitizePlayerName(initialPlayerName),
  );
  const pendingLevel = pendingLevelKey
    ? LEVELS[pendingLevelKey]
    : null;

  const openStartPrompt = (levelKey) => {
    setDraftPlayerName(sanitizePlayerName(initialPlayerName));

    if (LEVELS[levelKey]?.labyrinthMode) {
      setLabyrinthDifficulty(LABYRINTH_DEFAULT_DIFFICULTY);
      setLabyrinthMinutes(LABYRINTH_DEFAULT_MINUTES);
    }

    setPendingLevelKey(levelKey);
  };

  const cancelStartPrompt = () => {
    setPendingLevelKey(null);
  };

  const confirmStart = (event) => {
    event?.preventDefault();

    if (!pendingLevelKey) {
      return;
    }

    onSelectLevel(
      pendingLevelKey,
      viewMode,
      sanitizePlayerName(draftPlayerName),
      pendingLevel?.labyrinthMode
        ? {
            difficulty: labyrinthDifficulty,
            timeMinutes: labyrinthMinutes,
          }
        : {},
    );
    setPendingLevelKey(null);
  };

  return (
    <div className="level-select-screen">
      <style>{LEVEL_SELECT_STYLES}</style>

      <main className="level-select-content">
        <header className="selector-header">
          <div>
            <div className="selector-kicker">Mist Maze</div>
            <h1>Choose your level</h1>
          </div>

          <div className="first-page-header-actions">
            <button
              type="button"
              className="first-page-settings-button"
              aria-label="Settings"
              title="Settings"
              aria-expanded={settingsOpen}
              onClick={() => {
                setSettingsOpen((open) => !open);
                setSupportOpen(false);
              }}
            >
              ⚙
            </button>
            <button
              type="button"
              className="first-page-support-button"
              aria-expanded={supportOpen}
              onClick={() => {
                setSupportOpen((open) => !open);
                setSettingsOpen(false);
              }}
            >
              ♥ SUPPORT MIST MAZE
            </button>
          </div>
        </header>

        {settingsOpen && (
          <section className="first-page-expanded-panel">
            <SettingsControls
              viewMode={viewMode}
              onToggleViewMode={() =>
                onViewModeChange(viewMode === "3d" ? "2d" : "3d")
              }
              audioEnabled={audioEnabled}
              musicVolume={musicVolume}
              sfxVolume={sfxVolume}
              onToggleAudio={onToggleAudio}
              onTestSound={onTestSound}
              onMusicVolumeChange={onMusicVolumeChange}
              onSfxVolumeChange={onSfxVolumeChange}
              audioStatus={audioStatus}
            />
          </section>
        )}

        {supportOpen && (
          <section className="first-page-expanded-panel support-expanded">
            <SupportButtons />
          </section>
        )}

        <section className="level-choice-grid" aria-label="Level selection">
          {levels.map((level) => (
            <button
              key={level.key}
              type="button"
              className="level-choice"
              onClick={() => openStartPrompt(level.key)}
            >
              <div className="level-preview-wrap">
                <LevelPreview level={level} />
              </div>
              <div className="level-choice-copy">
                <div className="level-choice-number">{level.label}</div>
                <div className="level-choice-name">{level.subtitle}</div>
                {level.labyrinthMode && (
                  <div className="level-choice-special">
                    Timed · shifting walls · no combat
                  </div>
                )}
              </div>
            </button>
          ))}
        </section>

        <LeaderboardPanel
          leaderboards={leaderboards}
          userRanks={userRanks}
          status={leaderboardStatus}
        />
      </main>

      {pendingLevel && (
        <div
          className="name-prompt-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelStartPrompt();
            }
          }}
        >
          <form
            className="name-prompt-card"
            onSubmit={confirmStart}
            role="dialog"
            aria-modal="true"
            aria-labelledby="name-prompt-title"
          >
            <div className="selector-kicker">Ready to escape?</div>
            <h2 id="name-prompt-title">
              {pendingLevel.label}: {pendingLevel.subtitle}
            </h2>
            <div
              className={`name-prompt-mode${
                viewMode === "3d" ? " mode-3d" : ""
              }`}
            >
              {pendingLevel.labyrinthMode
                ? viewMode === "3d"
                  ? "3D Labyrinth"
                  : "2D Labyrinth"
                : viewMode === "3d"
                  ? "3D leaderboard"
                  : "2D leaderboard"}
            </div>

            {pendingLevel.labyrinthMode ? (
              <>
                <p className="name-prompt-description">
                  Choose the darkness and your time limit. More time creates a
                  larger, harder Labyrinth.
                </p>

                <fieldset className="labyrinth-option-group">
                  <legend>Difficulty</legend>
                  <div className="labyrinth-difficulty-grid">
                    {Object.values(LABYRINTH_DIFFICULTIES).map((difficulty) => (
                      <button
                        key={difficulty.key}
                        type="button"
                        className={`labyrinth-choice-button${
                          labyrinthDifficulty === difficulty.key ? " active" : ""
                        }`}
                        onClick={() => setLabyrinthDifficulty(difficulty.key)}
                      >
                        {difficulty.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="labyrinth-time-control">
                  <span>
                    Time limit
                    <strong>{labyrinthMinutes} min</strong>
                  </span>
                  <input
                    type="range"
                    min={LABYRINTH_MIN_MINUTES}
                    max={LABYRINTH_MAX_MINUTES}
                    step="1"
                    value={labyrinthMinutes}
                    onChange={(event) =>
                      setLabyrinthMinutes(Number(event.target.value))
                    }
                  />
                  <div className="labyrinth-time-scale">
                    <span>1 min</span>
                    <span>10 min</span>
                  </div>
                </label>

                <div className="labyrinth-warning">
                  No enemies · no weapons · no ammo · no medkits · no normal
                  power-ups. Find the exit before time expires. Purple Wall
                  Breakers last 10 seconds and stack up to 10. Silver steel
                  walls cannot be smashed.
                </div>
              </>
            ) : (
              <>
                <p className="name-prompt-description">
                  Enter a name for the leaderboard, or leave it blank to play as
                  “You”.
                </p>

                <label className="name-prompt-label">
                  Player name — optional
                  <input
                    className="name-prompt-input"
                    type="text"
                    value={draftPlayerName}
                    maxLength={PLAYER_NAME_LIMIT}
                    autoFocus
                    autoComplete="nickname"
                    placeholder="Leave blank to use You"
                    onChange={(event) =>
                      setDraftPlayerName(event.target.value)
                    }
                  />
                </label>
                <div className="name-prompt-helper">
                  Your result will be saved to this level’s separate{" "}
                  {viewMode === "3d" ? "3D" : "2D"} top-ten leaderboard.
                </div>
              </>
            )}

            <div className="name-prompt-actions">
              <button
                type="button"
                className="name-prompt-button secondary"
                onClick={cancelStartPrompt}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="name-prompt-button primary"
              >
                {pendingLevel.labyrinthMode
                  ? `Enter Labyrinth — ${labyrinthMinutes} min`
                  : `Start as ${getPlayerDisplayName(draftPlayerName)}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
