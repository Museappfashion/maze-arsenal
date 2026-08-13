// src/App.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAME_STYLES } from "./styles/gameStyles.js";
import { MazeAudioEngine, queueSfx } from "./audio/MazeAudioEngine.js";
import { MinimapPanel, MobileHudOverlay, SettingsControls, ThreeDStatusSidebar, TouchControls, mergeInputKeys, selectNextOwnedWeapon } from "./components/GameUi.jsx";
import { LevelSelectScreen } from "./components/LevelSelectScreen.jsx";
import { StatCard } from "./components/StatCard.jsx";
import { MAX_AMMO } from "./config/ammo.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH, DEFAULT_LEVEL_KEY, GRAPHICS_VERSION, LEVELS, PASSAGE_WIDTH, VIEW_3D_MOUSE_SENSITIVITY, VIEW_3D_TOUCH_SENSITIVITY } from "./config/constants.js";
import { getAmmoLabel, getWeaponLabel, getWeaponPresentation } from "./config/presentations.js";
import { DISTANCE_FIELD_INTERVAL, HUD_REFRESH_INTERVAL } from "./config/runtime.js";
import { WEAPONS, WEAPON_HOTKEY_MAP, WEAPON_ORDER } from "./config/weapons.js";
import { activateStoredPowerUp, attack, computeDistanceField, getActivePowerUps, getStoredPowerUps, revealAroundPlayer, selectWeapon, setMessage, toggleLabels, updateEffects, updateEnemies, updatePickups, updatePlayer, updatePowerUps, updateProjectiles, updateVisionCache } from "./game/gameplay.js";
import { getDiscoveredPercent } from "./game/maze.js";
import { drawWorld } from "./game/rendering.js";
import { createWorld, setWorldViewMode } from "./game/world.js";
import { GLOBAL_LEADERBOARD_ENABLED, addLeaderboardTime, createEmptyUserRanks, detectCountryCode, fetchGlobalLeaderboards, loadLeaderboards, saveLeaderboards, submitGlobalLeaderboardTime } from "./services/leaderboard.js";
import { clamp, formatTime } from "./utils/math.js";
import { getPlayerDisplayName, sanitizePlayerName } from "./utils/player.js";

export default function App() {
const canvasRef = useRef(null);
const worldRef = useRef(createWorld(DEFAULT_LEVEL_KEY));
const keysRef = useRef({});
const touchKeysRef = useRef({});
const frameRef = useRef(0);
const lastTimeRef = useRef(0);
const hudAccumulatorRef = useRef(0);
const recordedVictoryRef = useRef(false);
const audioRef = useRef(null);
const [audioEnabled, setAudioEnabled] = useState(true);
const [musicVolume, setMusicVolume] = useState(0.75);
const [sfxVolume, setSfxVolume] = useState(0.85);
const [selectedLevel, setSelectedLevel] = useState(null);
const [selectionMode, setSelectionMode] = useState("2d");
const [gameMode, setGameMode] = useState("2d");
const [playerName, setPlayerName] = useState("");
const [leaderboards, setLeaderboards] = useState(() => loadLeaderboards());
const [userRanks, setUserRanks] = useState(() => createEmptyUserRanks());
const [leaderboardStatus, setLeaderboardStatus] = useState(
  GLOBAL_LEADERBOARD_ENABLED ? "connecting" : "local",
);
const [touchControlsEnabled, setTouchControlsEnabled] = useState(false);
const [mobileMapExpanded, setMobileMapExpanded] = useState(false);
const [rotatePromptDismissed, setRotatePromptDismissed] = useState(false);
const [settingsOpen, setSettingsOpen] = useState(false);
const [audioStatus, setAudioStatus] = useState("Tap TEST SOUND to verify audio");
const [, setRevision] = useState(0);

const forceRefresh = useCallback(() => { setRevision((value) => value + 1); }, []);


useEffect(() => {
  const coarsePointerQuery =
    typeof window !== "undefined"
      ? window.matchMedia?.("(pointer: coarse)")
      : null;

  const updateTouchCapability = () => {
    const hasTouchPoints =
      typeof navigator !== "undefined" &&
      navigator.maxTouchPoints > 0;
    const hasCoarsePointer = Boolean(coarsePointerQuery?.matches);

    setTouchControlsEnabled(Boolean(hasTouchPoints || hasCoarsePointer));
  };

  updateTouchCapability();
  coarsePointerQuery?.addEventListener?.(
    "change",
    updateTouchCapability,
  );

  return () => {
    coarsePointerQuery?.removeEventListener?.(
      "change",
      updateTouchCapability,
    );
  };
}, []);

useEffect(() => {
  const world = worldRef.current;
  world.mobileView = touchControlsEnabled;

  if (!touchControlsEnabled) {
    setMobileMapExpanded(false);
  }

  forceRefresh();
}, [forceRefresh, gameMode, selectedLevel, touchControlsEnabled]);

const clearTouchInput = useCallback(() => {
  touchKeysRef.current = {};
  const world = worldRef.current;
  world.pointer.down = false;
}, []);

const handleTouchMove = useCallback((x, y) => {
  const deadZone = 0.28;
  const touchKeys = touchKeysRef.current;

  touchKeys.w = y < -deadZone;
  touchKeys.s = y > deadZone;
  touchKeys.a = x < -deadZone;
  touchKeys.d = x > deadZone;
}, []);

const handleTouchAim = useCallback((x, y) => {
  if (Math.hypot(x, y) < 0.18) {
    return;
  }

  const world = worldRef.current;
  world.player.facing = Math.atan2(y, x);
  world.pointer.inside = false;
}, []);

const handleTouchLook = useCallback((deltaX) => {
  if (!Number.isFinite(deltaX) || deltaX === 0) {
    return;
  }

  const world = worldRef.current;
  world.player.facing += deltaX * VIEW_3D_TOUCH_SENSITIVITY;
  world.pointer.inside = false;
}, []);

const handleTouchAttackStart = useCallback(() => {
  touchKeysRef.current[" "] = true;
  attack(worldRef.current);
}, []);

const handleTouchAttackEnd = useCallback(() => {
  touchKeysRef.current[" "] = false;
}, []);

const handleTouchNextWeapon = useCallback(() => {
  if (selectNextOwnedWeapon(worldRef.current)) {
    forceRefresh();
  }
}, [forceRefresh]);

const handleTouchPowerUp = useCallback(
  (slotIndex) => {
    activateStoredPowerUp(worldRef.current, slotIndex);
    forceRefresh();
  },
  [forceRefresh],
);


const handleMobileMapToggle = useCallback(() => {
  const world = worldRef.current;

  if (!world.minimapOn) {
    world.minimapOn = true;
    setMessage(world, "Minimap on", 1);
    setMobileMapExpanded(true);
    forceRefresh();
    return;
  }

  setMobileMapExpanded((current) => !current);
}, [forceRefresh]);

const handleMobileFullscreen = useCallback(async () => {
  if (typeof document === "undefined") {
    return;
  }

  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    }

    await window.screen?.orientation?.lock?.("landscape");
  } catch {
    // Browser support varies; the CSS layout still uses the full viewport.
  }
}, []);



const refreshGlobalLeaderboards = useCallback(async ({ silent = false } = {}) => {
  if (!GLOBAL_LEADERBOARD_ENABLED) {
    setLeaderboardStatus("local");
    return false;
  }

  if (!silent) {
    setLeaderboardStatus("connecting");
  }

  try {
    const globalState = await fetchGlobalLeaderboards();

    if (globalState) {
      setLeaderboards(globalState.leaderboards);
      setUserRanks(globalState.userRanks);
      saveLeaderboards(globalState.leaderboards);
    }

    setLeaderboardStatus("online");
    return true;
  } catch (error) {
    console.warn("Global leaderboard sync failed:", error);
    setLeaderboardStatus("offline");
    return false;
  }
}, []);

const recordLeaderboardScore = useCallback(
  (world) => {
    const completedTime = world.time;
    const levelKey = world.level.key;
    const mode = world.runMode;
    const runPlayerName = world.playerName;

    setLeaderboards((currentLeaderboards) => {
      const nextLeaderboards = addLeaderboardTime(
        currentLeaderboards,
        levelKey,
        mode,
        completedTime,
        runPlayerName,
      );
      saveLeaderboards(nextLeaderboards);
      return nextLeaderboards;
    });

    if (!GLOBAL_LEADERBOARD_ENABLED) {
      return;
    }

    void (async () => {
      try {
        const countryCode = await detectCountryCode();

        await submitGlobalLeaderboardTime(
          levelKey,
          mode,
          completedTime,
          runPlayerName,
          countryCode,
        );
        await refreshGlobalLeaderboards({ silent: true });
      } catch (error) {
        console.warn("Global leaderboard submission failed:", error);
        setLeaderboardStatus("offline");
      }
    })();
  },
  [refreshGlobalLeaderboards],
);

const getAudioEngine = useCallback(() => {
  if (!audioRef.current) {
    audioRef.current = new MazeAudioEngine();
  }

  return audioRef.current;
}, []);

const startLevelAudio = useCallback((world) => {
  const audio = getAudioEngine();
  audio.setMusicVolume(musicVolume);
  audio.setSfxVolume(sfxVolume);
  audio.setEnabled(audioEnabled);

  if (!audioEnabled) {
    return;
  }

  setAudioStatus("Starting sound…");

  void audio.startMusic(world.level.themeKey).then((started) => {
    setAudioStatus(
      started
        ? "Sound ready"
        : "Tap TEST SOUND to enable audio",
    );
  });
}, [
  audioEnabled,
  getAudioEngine,
  musicVolume,
  sfxVolume,
]);

useEffect(() => {
  if (!audioEnabled || typeof window === "undefined") {
    return undefined;
  }

  const unlockAudio = () => {
    const audio = getAudioEngine();
    audio.setEnabled(true);

    void audio.unlock().then((running) => {
      if (!running) {
        return;
      }

      setAudioStatus("Sound ready");

      if (
        selectedLevel &&
        (!audio.currentTheme || !audio.scheduler)
      ) {
        void audio.startMusic(worldRef.current.level.themeKey);
      }
    });
  };

  const pointerOptions = { capture: true, passive: true };

  window.addEventListener("pointerdown", unlockAudio, pointerOptions);
  window.addEventListener("touchend", unlockAudio, pointerOptions);
  window.addEventListener("keydown", unlockAudio, true);

  return () => {
    window.removeEventListener("pointerdown", unlockAudio, pointerOptions);
    window.removeEventListener("touchend", unlockAudio, pointerOptions);
    window.removeEventListener("keydown", unlockAudio, true);
  };
}, [audioEnabled, getAudioEngine, selectedLevel]);

const handleMusicVolumeChange = useCallback(
  (nextVolume) => {
    const normalizedVolume = clamp(Number(nextVolume) || 0, 0, 1);
    setMusicVolume(normalizedVolume);

    const audio = getAudioEngine();
    audio.setMusicVolume(normalizedVolume);

    if (audioEnabled) {
      void audio.unlock();
    }
  },
  [audioEnabled, getAudioEngine],
);

const handleSfxVolumeChange = useCallback(
  (nextVolume) => {
    const normalizedVolume = clamp(Number(nextVolume) || 0, 0, 1);
    setSfxVolume(normalizedVolume);

    const audio = getAudioEngine();
    audio.setSfxVolume(normalizedVolume);

    if (audioEnabled) {
      void audio.unlock();
    }
  },
  [audioEnabled, getAudioEngine],
);

useEffect(() => {
  const audio = getAudioEngine();
  audio.setMusicVolume(musicVolume);
  audio.setSfxVolume(sfxVolume);
}, [getAudioEngine, musicVolume, sfxVolume]);

const handleTestSound = useCallback(() => {
  const audio = getAudioEngine();

  setAudioEnabled(true);
  audio.setEnabled(true);
  audio.setMusicVolume(musicVolume);
  audio.setSfxVolume(Math.max(0.35, sfxVolume));
  setAudioStatus("Testing sound…");

  void audio.playTestSound().then((played) => {
    if (!played) {
      setAudioStatus("Audio blocked — tap TEST SOUND again");
      return;
    }

    setAudioStatus("Sound working ✓");

    if (selectedLevel) {
      void audio.startMusic(worldRef.current.level.themeKey);
    }
  });
}, [
  getAudioEngine,
  musicVolume,
  selectedLevel,
  sfxVolume,
]);

const toggleAudio = useCallback(() => {
  const nextEnabled = !audioEnabled;
  setAudioEnabled(nextEnabled);

  const audio = getAudioEngine();
  audio.setEnabled(nextEnabled);

  if (nextEnabled) {
    audio.setMusicVolume(musicVolume);
    audio.setSfxVolume(sfxVolume);
    setAudioStatus("Starting sound…");

    void audio.unlock().then((running) => {
      if (!running) {
        setAudioStatus("Tap TEST SOUND to enable audio");
        return;
      }

      setAudioStatus("Sound ready");

      if (selectedLevel) {
        void audio.startMusic(worldRef.current.level.themeKey);
      }
    });
  } else {
    setAudioStatus("Muted");
  }
}, [
  audioEnabled,
  getAudioEngine,
  musicVolume,
  selectedLevel,
  sfxVolume,
]);

const returnToLevelSelect = useCallback(() => {
  if (
    typeof document !== "undefined" &&
    document.pointerLockElement
  ) {
    document.exitPointerLock?.();
  }

  audioRef.current?.stopMusic();
  keysRef.current = {};
  clearTouchInput();
  setSelectedLevel(null);
}, [clearTouchInput]);

useEffect(() => {
  return () => {
    audioRef.current?.destroy();
  };
}, []);

useEffect(() => {
  if (!GLOBAL_LEADERBOARD_ENABLED) {
    return undefined;
  }

  void refreshGlobalLeaderboards();

  if (selectedLevel) {
    return undefined;
  }

  const intervalId = window.setInterval(() => {
    void refreshGlobalLeaderboards({ silent: true });
  }, 15000);

  return () => {
    window.clearInterval(intervalId);
  };
}, [refreshGlobalLeaderboards, selectedLevel]);

const startLevel = useCallback((levelKey, requestedViewMode = selectionMode, requestedPlayerName = "") => {
  const nextViewMode = requestedViewMode === "3d" ? "3d" : "2d";
  const nextPlayerName = sanitizePlayerName(requestedPlayerName);
  const nextWorld = createWorld(levelKey, nextViewMode, nextPlayerName);
  worldRef.current = nextWorld;
  startLevelAudio(nextWorld);
  keysRef.current = {};
  clearTouchInput();
  lastTimeRef.current = 0;
  hudAccumulatorRef.current = 0;
  recordedVictoryRef.current = false;
  setGameMode(nextViewMode);
  setSelectionMode(nextViewMode);
  setPlayerName(nextPlayerName);
  setSelectedLevel(levelKey);
  forceRefresh();
}, [clearTouchInput, forceRefresh, selectionMode, startLevelAudio]);

const resetWorld = useCallback(() => {
  if (!selectedLevel) {
    return;
  }

  const nextWorld = createWorld(selectedLevel, gameMode, playerName);
  worldRef.current = nextWorld;
  startLevelAudio(nextWorld);
  keysRef.current = {};
  clearTouchInput();
  lastTimeRef.current = 0;
  hudAccumulatorRef.current = 0;
  recordedVictoryRef.current = false;
  forceRefresh();
}, [clearTouchInput, forceRefresh, gameMode, playerName, selectedLevel, startLevelAudio]);

const switchGameMode = useCallback(() => {
  const nextViewMode = gameMode === "3d" ? "2d" : "3d";

  if (
    typeof document !== "undefined" &&
    document.pointerLockElement
  ) {
    document.exitPointerLock?.();
  }

  setWorldViewMode(worldRef.current, nextViewMode);
  keysRef.current = {};
  clearTouchInput();
  setGameMode(nextViewMode);
  setSelectionMode(nextViewMode);
  forceRefresh();
}, [clearTouchInput, forceRefresh, gameMode]);

useEffect(() => {
if (!selectedLevel) {
  return undefined;
}

const handleKeyDown = (event) => { const world = worldRef.current; const key = event.key;

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(key)) {
    event.preventDefault();
  }

  keysRef.current[key] = true;
  keysRef.current[key.toLowerCase()] = true;

  if (key === " " || key === "Enter") {
    attack(world);
  }

  if (key === "z" || key === "Z") {
    activateStoredPowerUp(world, 0);
  }

  if (key === "x" || key === "X") {
    activateStoredPowerUp(world, 1);
  }

  const directWeapon = WEAPON_HOTKEY_MAP[key];
  if (directWeapon) {
    selectWeapon(world, directWeapon);
  }

  if (key === "m" || key === "M") {
    if (world.viewMode === "3d") {
      world.minimapOn = true;
      setMessage(world, "Minimap stays on in 3D", 1);
    } else {
      world.minimapOn = !world.minimapOn;
      setMessage(world, world.minimapOn ? "Minimap on" : "Minimap off", 1);
    }
  }

  if (key === "l" || key === "L") {
    toggleLabels(world);
  }

  if (key === "n" || key === "N") {
    event.preventDefault();
    resetWorld();
    return;
  }

  if (key === "Escape") {
    if (
      typeof document !== "undefined" &&
      document.pointerLockElement
    ) {
      return;
    }

    returnToLevelSelect();
  }
};

const handleKeyUp = (event) => {
  const key = event.key;
  keysRef.current[key] = false;
  keysRef.current[key.toLowerCase()] = false;
};

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);

return () => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
};

}, [resetWorld, returnToLevelSelect, selectedLevel]);

useEffect(() => {
if (!selectedLevel) {
  return undefined;
}

const canvas = canvasRef.current;
if (!canvas) { return undefined; }

let rect = canvas.getBoundingClientRect();

const refreshRect = () => {
  rect = canvas.getBoundingClientRect();
};

const handlePointerMove = (event) => {
  const world = worldRef.current;

  if (world.viewMode === "3d") {
    if (document.pointerLockElement === canvas) {
      world.player.facing +=
        event.movementX *
        VIEW_3D_MOUSE_SENSITIVITY;
      world.pointer.inside = false;
    }
    return;
  }

  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  world.pointer.x =
    (event.clientX - rect.left) * scaleX;
  world.pointer.y =
    (event.clientY - rect.top) * scaleY;
  world.pointer.inside = true;
};

const handlePointerDown = (event) => {
  const world = worldRef.current;

  if (world.viewMode === "3d") {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
      setMessage(
        world,
        "Mouse locked — move to look, Esc to release",
        1.8,
      );
      forceRefresh();
      return;
    }

    world.pointer.down = true;
    attack(world);
    return;
  }

  handlePointerMove(event);
  world.pointer.down = true;
  world.pointer.inside = true;
  attack(world);
};

const handlePointerUp = () => {
  worldRef.current.pointer.down = false;
};

const handlePointerLeave = () => {
  if (worldRef.current.viewMode === "2d") {
    worldRef.current.pointer.inside = false;
    worldRef.current.pointer.down = false;
  }
};

const handlePointerLockChange = () => {
  const world = worldRef.current;
  world.pointer.down = false;
  world.pointer.inside = false;

  if (world.viewMode === "3d") {
    setMessage(
      world,
      document.pointerLockElement === canvas
        ? "Mouse look active"
        : "Mouse released — click the maze to look",
      1.2,
    );
    forceRefresh();
  }
};

refreshRect();
window.addEventListener("resize", refreshRect);
document.addEventListener(
  "mousemove",
  handlePointerMove,
);
canvas.addEventListener(
  "mousedown",
  handlePointerDown,
);
window.addEventListener(
  "mouseup",
  handlePointerUp,
);
canvas.addEventListener(
  "mouseleave",
  handlePointerLeave,
);
document.addEventListener(
  "pointerlockchange",
  handlePointerLockChange,
);

return () => {
  document.removeEventListener(
    "mousemove",
    handlePointerMove,
  );
  canvas.removeEventListener(
    "mousedown",
    handlePointerDown,
  );
  window.removeEventListener(
    "mouseup",
    handlePointerUp,
  );
  window.removeEventListener(
    "resize",
    refreshRect,
  );
  canvas.removeEventListener(
    "mouseleave",
    handlePointerLeave,
  );
  document.removeEventListener(
    "pointerlockchange",
    handlePointerLockChange,
  );
};

}, [forceRefresh, gameMode, selectedLevel]);

useEffect(() => {
if (!selectedLevel) {
  return undefined;
}

const ctx = canvasRef.current?.getContext("2d");
if (!ctx) { return undefined; }

const loop = (timestamp) => {
  if (!lastTimeRef.current) {
    lastTimeRef.current = timestamp;
  }

  const dt = Math.min(0.033, (timestamp - lastTimeRef.current) / 1000);
  lastTimeRef.current = timestamp;

  const world = worldRef.current;

  if (!world.gameOver && !world.victory) {
    world.time += dt;
    world.fogPulse += dt;

    updatePowerUps(world, dt);
    updatePlayer(
      world,
      mergeInputKeys(keysRef.current, touchKeysRef.current),
      dt,
    );
    updateVisionCache(world);
    updatePickups(world, dt);

    if (world.distanceFieldDirty) {
      world.distanceTimer += dt;
      if (world.distanceTimer >= DISTANCE_FIELD_INTERVAL) {
        computeDistanceField(world);
        world.distanceTimer = 0;
      }
    }

    updateEnemies(world, dt);
    updateProjectiles(world, dt);
    revealAroundPlayer(world);

    const exitDistance = Math.hypot(
      world.player.x - (world.exit.x + 0.5),
      world.player.y - (world.exit.y + 0.5),
    );

    if (exitDistance <= world.player.radius + 0.33) {
      world.victory = true;
      queueSfx(world, "victory");
      setMessage(world, "Escape complete!", 99);

      if (!recordedVictoryRef.current) {
        recordedVictoryRef.current = true;
        recordLeaderboardScore(world);
      }
    }
  }

  if (world.audioEvents?.length) {
    const audioEvents = world.audioEvents.splice(0, world.audioEvents.length);
    audioRef.current?.playEvents(audioEvents, world.level.themeKey);
  }

  updateEffects(world, dt);

  if (world.messageTtl > 0) {
    world.messageTtl = Math.max(0, world.messageTtl - dt);
    if (world.messageTtl === 0) {
      world.message = "";
    }
  }

  drawWorld(ctx, world);

  hudAccumulatorRef.current += dt;
  if (hudAccumulatorRef.current >= HUD_REFRESH_INTERVAL) {
    hudAccumulatorRef.current = 0;
    forceRefresh();
  }

  frameRef.current = requestAnimationFrame(loop);
};

frameRef.current = requestAnimationFrame(loop);

return () => {
  cancelAnimationFrame(frameRef.current);
};

}, [forceRefresh, recordLeaderboardScore, selectedLevel]);

const legend = useMemo( () => [ { label: getPlayerDisplayName(playerName), color: "#38bdf8" }, { label: "Exit", color: "#22c55e" }, { label: "Weapon", color: "#fbbf24" }, { label: LEVELS[selectedLevel]?.themeKey === "medieval" ? "Arrows" : "Ammo", color: "#60a5fa" }, { label: "Medkit", color: "#f43f5e" }, { label: "Power-up", color: "#a78bfa" }, ], [playerName, selectedLevel], );

if (!selectedLevel) {
  return (
    <LevelSelectScreen
      onSelectLevel={startLevel}
      leaderboards={leaderboards}
      leaderboardStatus={leaderboardStatus}
      userRanks={userRanks}
      viewMode={selectionMode}
      onViewModeChange={setSelectionMode}
      initialPlayerName={playerName}
      audioEnabled={audioEnabled}
      musicVolume={musicVolume}
      sfxVolume={sfxVolume}
      onToggleAudio={toggleAudio}
      onTestSound={handleTestSound}
      onMusicVolumeChange={handleMusicVolumeChange}
      onSfxVolumeChange={handleSfxVolumeChange}
      audioStatus={audioStatus}
    />
  );
}

const world = worldRef.current;
const activePowerUps = getActivePowerUps(world);
const storedPowerUps = getStoredPowerUps(world);

return (
<div
  className={`maze-game-root${touchControlsEnabled ? " touch-mobile" : ""} mode-${gameMode}`}
  style={{
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "radial-gradient(circle at top, #0f172a 0%, #020617 50%, #000000 100%)",
    color: "#e2e8f0",
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }}
>
  <style>{GAME_STYLES}</style>

  <div className="maze-game-shell">
    <main className="maze-stage">
      <div className="maze-frame">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            display: "block",
            cursor: gameMode === "3d" ? "none" : "crosshair",
            imageRendering: "auto",
          }}
        />
        <button
          type="button"
          className="always-start-maze-button"
          onClick={resetWorld}
          title="Start a fresh maze"
        >
          START NEW MAZE
        </button>
        <div className="game-settings-widget">
          <button
            type="button"
            className="game-settings-toggle"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            ⚙ SETTINGS
          </button>
          {settingsOpen && (
            <div className="game-settings-popover">
              <button
                type="button"
                className="game-settings-close"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
                ×
              </button>
              <SettingsControls
                viewMode={gameMode}
                onToggleViewMode={switchGameMode}
                audioEnabled={audioEnabled}
                musicVolume={musicVolume}
                sfxVolume={sfxVolume}
                onToggleAudio={toggleAudio}
                onTestSound={handleTestSound}
                onMusicVolumeChange={handleMusicVolumeChange}
                onSfxVolumeChange={handleSfxVolumeChange}
                audioStatus={audioStatus}
              />
            </div>
          )}
        </div>

                {touchControlsEnabled && (
          <TouchControls
            gameMode={gameMode}
            storedPowerUps={storedPowerUps}
            onMove={handleTouchMove}
            onAim={handleTouchAim}
            onLookDelta={handleTouchLook}
            onAttackStart={handleTouchAttackStart}
            onAttackEnd={handleTouchAttackEnd}
            onNextWeapon={handleTouchNextWeapon}
            onPowerUp={handleTouchPowerUp}
          />
        )}
        {touchControlsEnabled && (
          <MobileHudOverlay
            world={world}
            mapExpanded={mobileMapExpanded}
            onMapToggle={handleMobileMapToggle}
            onStart={resetWorld}
            onSwitchMode={switchGameMode}
            onExitLevel={returnToLevelSelect}
            onFullscreen={handleMobileFullscreen}
          />
        )}
        {touchControlsEnabled && !rotatePromptDismissed && (
          <div
            className="mobile-rotate-prompt"
            role="dialog"
            aria-label="Rotate phone recommendation"
          >
            <button
              type="button"
              className="mobile-rotate-close"
              aria-label="Close rotate phone message"
              onClick={() => setRotatePromptDismissed(true)}
            >
              ×
            </button>
            <div className="mobile-rotate-icon">↻</div>
            <strong>Rotate your phone</strong>
            <span>Landscape gives you a much larger maze view.</span>
          </div>
        )}
      </div>
    </main>

    {touchControlsEnabled && gameMode === "3d" && (
      <aside className="mobile-3d-sidebar">
        <ThreeDStatusSidebar
          world={world}
          storedPowerUps={storedPowerUps}
          activePowerUps={activePowerUps}
          onPowerUp={handleTouchPowerUp}
          onStart={resetWorld}
          onSwitchMode={switchGameMode}
          onFullscreen={handleMobileFullscreen}
          onExitLevel={returnToLevelSelect}
        />
      </aside>
    )}

    <aside className="maze-sidebar">
      {gameMode === "3d" ? (
        <div className="desktop-3d-sticky">
          <ThreeDStatusSidebar
            world={world}
            storedPowerUps={storedPowerUps}
            activePowerUps={activePowerUps}
            onPowerUp={handleTouchPowerUp}
            onStart={resetWorld}
            onSwitchMode={switchGameMode}
            onFullscreen={handleMobileFullscreen}
            onExitLevel={returnToLevelSelect}
          />
        </div>
      ) : (
        <MinimapPanel world={world} />
      )}
      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
          boxShadow: "0 18px 45px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Mist Maze
        </h1>
        <div
          style={{
            marginTop: 8,
            color: "#38bdf8",
            fontSize: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {world.level.label} · {world.level.themeLabel} · {world.level.subtitle}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            marginTop: 10,
            padding: "6px 9px",
            borderRadius: 999,
            background: "rgba(8, 145, 178, 0.13)",
            border: "1px solid rgba(103, 232, 249, 0.42)",
            color: "#a5f3fc",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow: "0 0 24px rgba(34, 211, 238, 0.12)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: "#22d3ee",
              boxShadow: "0 0 12px #22d3ee",
            }}
          />
          {gameMode === "3d" ? "3D Raycast Beta" : GRAPHICS_VERSION}
        </div>
        <p
          style={{
            margin: "10px 0 0",
            color: "#94a3b8",
            lineHeight: 1.55,
            fontSize: 14,
          }}
        >
          Fight through a braided maze, collect weapons and power-ups, and
          reach the exit before the maze overwhelms you.
        </p>
      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Status
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 14,
          }}
        >
          <StatCard label="Health" value={`${Math.round(world.player.hp)} / ${Math.round(world.player.maxHp)}`} />
          <StatCard label={getAmmoLabel(world)} value={`${Math.floor(world.player.ammo)} / ${MAX_AMMO}`} />
          <StatCard label="Weapon" value={getWeaponLabel(world, world.player.weapon)} />
          <StatCard label="Kills" value={String(world.kills)} />
          <StatCard label="Time" value={formatTime(world.time)} />
          <StatCard label="Map" value={`${getDiscoveredPercent(world)}%`} />
          <StatCard label="Maze" value={`${world.level.logicalCols} × ${world.level.logicalRows}`} />
          <StatCard label="Theme" value={world.level.themeLabel} />
          <StatCard label="Corridor" value={`${PASSAGE_WIDTH} tiles`} />
        </div>
        <button
          type="button"
          onClick={resetWorld}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(34, 211, 238, 0.46)",
            background: "linear-gradient(135deg, rgba(8,145,178,0.34), rgba(14,116,144,0.2))",
            color: "#cffafe",
            fontWeight: 900,
            letterSpacing: "0.04em",
            cursor: "pointer",
          }}
        >
          START NEW MAZE
        </button>
        <button
          type="button"
          onClick={returnToLevelSelect}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(148, 163, 184, 0.22)",
            background: "rgba(30, 41, 59, 0.82)",
            color: "#e2e8f0",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Choose another level
        </button>

      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Weapons
        </h2>

        <div
          style={{
            display: "grid",
            gap: 10,
            marginTop: 14,
          }}
        >
          {WEAPON_ORDER.map((weaponKey, index) => {
            const weapon = WEAPONS[weaponKey];
            const presentation = getWeaponPresentation(world, weaponKey);
            const owned = world.player.ownedWeapons[weaponKey];
            const active = world.player.weapon === weaponKey;

            return (
              <button
                key={weaponKey}
                type="button"
                disabled={!owned}
                aria-pressed={active}
                onClick={() => {
                  if (selectWeapon(worldRef.current, weaponKey)) {
                    forceRefresh();
                  }
                }}
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "36px 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: active
                    ? "rgba(30, 41, 59, 0.95)"
                    : "rgba(15, 23, 42, 0.72)",
                  border: active
                    ? "1px solid rgba(56, 189, 248, 0.45)"
                    : "1px solid rgba(148, 163, 184, 0.12)",
                  color: "inherit",
                  font: "inherit",
                  textAlign: "left",
                  cursor: owned ? "pointer" : "not-allowed",
                  opacity: owned ? 1 : 0.55,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    background:
                      weapon.type === "melee"
                        ? "rgba(249, 115, 22, 0.2)"
                        : "rgba(56, 189, 248, 0.2)",
                    color:
                      weapon.type === "melee" ? "#fdba74" : "#7dd3fc",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {index < 9 ? index + 1 : "•"}
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {presentation.label}
                  </div>
                  {owned && (
                    <>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#cbd5e1",
                          lineHeight: 1.4,
                          marginTop: 4,
                        }}
                      >
                        {presentation.description}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#94a3b8",
                          marginTop: 5,
                        }}
                      >
                        {weapon.type === "melee"
                          ? `Damage ${weapon.damage} • Cooldown ${weapon.cooldown.toFixed(2)}`
                          : `Damage ${weapon.damage} • Range ${weapon.range} • Cooldown ${weapon.cooldown.toFixed(2)}`}
                      </div>
                    </>
                  )}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: active ? "#38bdf8" : owned ? "#cbd5e1" : "#64748b",
                  }}
                >
                  {active ? "Equipped" : owned ? "Click to equip" : "Locked"}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "linear-gradient(145deg, rgba(30, 27, 75, 0.88), rgba(15, 23, 42, 0.9))",
          border: "1px solid rgba(167, 139, 250, 0.28)",
          boxShadow: "0 12px 34px rgba(76, 29, 149, 0.14)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            Power-up Holder
          </h2>
          <span style={{ color: "#c4b5fd", fontSize: 11, fontWeight: 800 }}>
            MAX 2
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 14,
          }}
        >
          {storedPowerUps.map((powerUp, index) => {
            const hotkey = index === 0 ? "Z" : "X";
            const color = powerUp?.color ?? "#64748b";

            return (
              <button
                key={hotkey}
                type="button"
                onClick={() => {
                  activateStoredPowerUp(worldRef.current, index);
                  forceRefresh();
                }}
                style={{
                  minHeight: 86,
                  padding: 12,
                  borderRadius: 14,
                  border: `1px solid ${powerUp ? `${color}88` : "rgba(148, 163, 184, 0.16)"}`,
                  background: powerUp
                    ? `linear-gradient(145deg, ${color}22, rgba(15, 23, 42, 0.92))`
                    : "rgba(15, 23, 42, 0.66)",
                  color: "#f8fafc",
                  textAlign: "left",
                  cursor: powerUp ? "pointer" : "default",
                  boxShadow: powerUp ? `0 0 22px ${color}18` : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 25,
                      height: 25,
                      borderRadius: 8,
                      background: powerUp ? `${color}33` : "rgba(100,116,139,0.14)",
                      border: `1px solid ${powerUp ? `${color}66` : "rgba(148,163,184,0.14)"}`,
                      color: powerUp ? color : "#94a3b8",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {hotkey}
                  </span>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      background: powerUp ? color : "#334155",
                      boxShadow: powerUp ? `0 0 12px ${color}` : "none",
                    }}
                  />
                </div>
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800 }}>
                  {powerUp?.label ?? "Empty slot"}
                </div>
                <div style={{ marginTop: 3, color: "#94a3b8", fontSize: 11 }}>
                  {powerUp?.short ?? `Press ${hotkey} after storing one`}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12, lineHeight: 1.45 }}>
          When both slots are full, other power-ups remain on the maze until you use one.
        </div>
      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Active Power-ups
        </h2>

        <div
          style={{
            display: "grid",
            gap: 10,
            marginTop: 14,
          }}
        >
          {activePowerUps.length > 0 ? (
            activePowerUps.map((powerUp) => (
              <div
                key={powerUp.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "rgba(15, 23, 42, 0.72)",
                  border: `1px solid ${powerUp.color}55`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: powerUp.color,
                      boxShadow: `0 0 14px ${powerUp.color}`,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {powerUp.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                      }}
                    >
                      {powerUp.short}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#e2e8f0",
                  }}
                >
                  {powerUp.remaining.toFixed(1)}s
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(15, 23, 42, 0.72)",
                border: "1px solid rgba(148, 163, 184, 0.12)",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              None active.
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Controls
        </h2>

        <ul
          style={{
            margin: "14px 0 0",
            paddingLeft: 18,
            color: "#cbd5e1",
            display: "grid",
            gap: 8,
            fontSize: 14,
            lineHeight: 1.45,
          }}
        >
          {world.controls.map((control) => (
            <li key={control}>{control}</li>
          ))}
        </ul>
      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Legend
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 14,
          }}
        >
          {legend.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 14,
                background: "rgba(15, 23, 42, 0.72)",
                border: "1px solid rgba(148, 163, 184, 0.12)",
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: item.color,
                }}
              />
              {item.label}
            </div>
          ))}
        </div>
      </section>
    </aside>
  </div>
</div>
); }
