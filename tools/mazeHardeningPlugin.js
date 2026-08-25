// tools/mazeHardeningPlugin.js
const HARDENING_MARKER = "/* maze-hardening-applied */";

const TARGET_FILES = new Set([
  "src/App.jsx",
  "src/game/world.js",
  "src/services/leaderboard.js",
  "src/components/LevelSelectScreen.jsx",
]);

function getTargetPath(id) {
  const normalized = String(id).split("?")[0].replaceAll("\\", "/");

  for (const target of TARGET_FILES) {
    if (normalized === target || normalized.endsWith(`/${target}`)) {
      return target;
    }
  }

  return null;
}

function isAlreadyHardened(code, targetPath) {
  const markers = {
    "src/services/leaderboard.js": [
      "beginGlobalLeaderboardRun",
      "finishGlobalLeaderboardRun",
    ],
    "src/game/world.js": ["leaderboardEligible: !labyrinthMode"],
    "src/App.jsx": [
      "ModeSwitchWarning",
      "RunEndOverlay",
      "beginLeaderboardRunForWorld",
    ],
    "src/components/LevelSelectScreen.jsx": [
      '"Personal best"',
      "One personal best per level and view mode",
    ],
  };

  const requiredMarkers = markers[targetPath] ?? [];
  return (
    requiredMarkers.length > 0 &&
    requiredMarkers.every((marker) => code.includes(marker))
  );
}

function transformMazeSource(source, activeFile) {
  let output = source.replace(/\r\n?/g, "\n");

  function read() {
    return output;
  }

  function write(_filePath, content) {
    output = content.endsWith("\n") ? content : `${content}\n`;
  }

  function replaceRegex(filePath, pattern, replacement, expected = 1) {
    if (filePath !== activeFile) {
      return;
    }

    const current = read();
    const matches = [...current.matchAll(pattern)];

    if (matches.length !== expected) {
      throw new Error(
        `[maze-hardening] ${filePath} expected ${expected} match(es), found ${matches.length}. ` +
          `Pattern: ${pattern}. Your branch has moved; refresh this source-only fix before deploying.`,
      );
    }

    write(filePath, current.replace(pattern, replacement));
  }

  replaceRegex(
    "src/services/leaderboard.js",
    /export function normalizeLevelLeaderboards\(levelBoards\) \{[\s\S]*?\n\}\nexport function normalizeLeaderboards/g,
    `export function normalizeLevelLeaderboards(levelBoards) {
    if (Array.isArray(levelBoards)) {
      return {
        "2d": normalizeLeaderboardEntries(levelBoards).slice(0, 1),
        "3d": [],
      };
    }

    return {
      "2d": normalizeLeaderboardEntries(levelBoards?.["2d"]).slice(0, 1),
      "3d": normalizeLeaderboardEntries(levelBoards?.["3d"]).slice(0, 1),
    };
  }
  export function normalizeLeaderboards`,
  );
  replaceRegex(
    "src/services/leaderboard.js",
    /if \(currentRaw\) \{\n      return normalizeLeaderboards\(JSON\.parse\(currentRaw\)\);\n    \}/g,
    `if (currentRaw) {
        const normalized = normalizeLeaderboards(JSON.parse(currentRaw));
        window.localStorage.setItem(
          LEADERBOARD_STORAGE_KEY,
          JSON.stringify(normalized),
        );
        return normalized;
      }`,
  );
  replaceRegex(
    "src/services/leaderboard.js",
    /export function addLeaderboardTime\([\s\S]*?\n\}\nexport async function ensureGlobalLeaderboardSession/g,
    "export function addLeaderboardTime(\n  leaderboards,\n  levelKey,\n  mode,\n  time,\n  playerName,\n) {\n  if (\n    !LEVELS[levelKey] ||\n    LEVELS[levelKey].leaderboard === false ||\n    !Number.isFinite(time) ||\n    time <= 0\n  ) {\n    return leaderboards;\n  }\n\n  const normalizedMode = mode === \"3d\" ? \"3d\" : \"2d\";\n  const levelBoards = normalizeLevelLeaderboards(leaderboards[levelKey]);\n  const currentBest = levelBoards[normalizedMode][0] ?? null;\n\n  if (currentBest && currentBest.time <= time) {\n    return leaderboards;\n  }\n\n  return {\n    ...leaderboards,\n    [levelKey]: {\n      ...levelBoards,\n      [normalizedMode]: [\n        {\n          time,\n          completedAt: new Date().toISOString(),\n          playerName: getPlayerDisplayName(playerName),\n          countryCode: \"\",\n          globalRank: null,\n          isCurrentUser: true,\n        },\n      ],\n    },\n  };\n}\n\nexport async function ensureGlobalLeaderboardSession",
  );
  replaceRegex(
    "src/services/leaderboard.js",
    /export async function submitGlobalLeaderboardTime\([\s\S]*$/g,
    "export async function beginGlobalLeaderboardRun(levelKey, mode) {\n  if (\n    !supabase ||\n    !LEVELS[levelKey] ||\n    LEVELS[levelKey].leaderboard === false\n  ) {\n    return null;\n  }\n\n  await ensureGlobalLeaderboardSession();\n\n  const { data, error } = await supabase.rpc(\"start_leaderboard_run\", {\n    p_level_key: levelKey,\n    p_mode: mode === \"3d\" ? \"3d\" : \"2d\",\n  });\n\n  if (error) {\n    throw error;\n  }\n\n  return typeof data === \"string\" ? data : null;\n}\n\nexport async function finishGlobalLeaderboardRun(\n  runId,\n  playerName,\n  countryCode,\n) {\n  if (!supabase || !runId) {\n    return null;\n  }\n\n  await ensureGlobalLeaderboardSession();\n\n  const { data, error } = await supabase.rpc(\"finish_leaderboard_run\", {\n    p_run_id: runId,\n    p_player_name: getPlayerDisplayName(playerName),\n    p_country_code: normalizeCountryCode(countryCode) || null,\n  });\n\n  if (error) {\n    throw error;\n  }\n\n  return data ?? null;\n}\n",
  );

  replaceRegex(
    "src/game/world.js",
    /    runMode: normalizedViewMode,\n/g,
    `    runMode: normalizedViewMode,
      leaderboardEligible: !labyrinthMode,
  `,
  );

  replaceRegex(
    "src/App.jsx",
    /import \{ LevelSelectScreen \} from "\.\/components\/LevelSelectScreen\.jsx";\n/g,
    `import { LevelSelectScreen } from "./components/LevelSelectScreen.jsx";
  import { ModeSwitchWarning } from "./components/ModeSwitchWarning.jsx";
  import { RunEndOverlay } from "./components/RunEndOverlay.jsx";
  `,
  );
  replaceRegex(
    "src/App.jsx",
    /import \{ sanitizePlayerName \} from "\.\/utils\/player\.js";\n/g,
    `import { sanitizePlayerName } from "./utils/player.js";

  const MODE_SWITCH_WARNING_STORAGE_KEY =
    "maze-arsenal-mode-switch-warning-seen-v1";

  function loadModeSwitchWarningSeen() {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      return window.localStorage.getItem(MODE_SWITCH_WARNING_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function saveModeSwitchWarningSeen() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(MODE_SWITCH_WARNING_STORAGE_KEY, "1");
    } catch {
      // The session ref still prevents repeated warnings.
    }
  }
  `,
  );

  replaceRegex(
    "src/App.jsx",
    /import \{ GLOBAL_LEADERBOARD_ENABLED,[^\n]+from "\.\/services\/leaderboard\.js";\n/g,
    `import { GLOBAL_LEADERBOARD_ENABLED, addLeaderboardTime, beginGlobalLeaderboardRun, createEmptyUserRanks, detectCountryCode, fetchGlobalLeaderboards, finishGlobalLeaderboardRun, loadLeaderboards, saveLeaderboards } from "./services/leaderboard.js";
  `,
  );
  replaceRegex(
    "src/App.jsx",
    /const analyticsRunEndedRef = useRef\(false\);\n/g,
    `const analyticsRunEndedRef = useRef(false);
  const leaderboardRunPromiseRef = useRef(null);
  `,
  );
  replaceRegex(
    "src/App.jsx",
    /const \[selectedLevel, setSelectedLevel\] = useState\(null\);\n/g,
    `const [selectedLevel, setSelectedLevel] = useState(null);
  const [runGeneration, setRunGeneration] = useState(0);
  const modeSwitchWarningSeenRef = useRef(loadModeSwitchWarningSeen());
  const [pendingModeSwitch, setPendingModeSwitch] = useState(null);
  `,
  );
  replaceRegex(
    "src/App.jsx",
    /const recordLeaderboardScore = useCallback\([\s\S]*?\nconst getAudioEngine = useCallback/g,
    "const beginLeaderboardRunForWorld = useCallback((world) => {\n  leaderboardRunPromiseRef.current = null;\n\n  if (!GLOBAL_LEADERBOARD_ENABLED || world.labyrinthMode) {\n    return;\n  }\n\n  void detectCountryCode();\n\n  leaderboardRunPromiseRef.current = beginGlobalLeaderboardRun(\n    world.level.key,\n    world.runMode,\n  ).catch((error) => {\n    console.warn(\"Global leaderboard run start failed:\", error);\n    setLeaderboardStatus(\"offline\");\n    return null;\n  });\n}, []);\n\nconst recordLeaderboardScore = useCallback(\n  (world) => {\n    if (world.labyrinthMode || world.leaderboardEligible === false) {\n      return;\n    }\n\n    const completedTime = world.time;\n    const levelKey = world.level.key;\n    const mode = world.runMode;\n    const runPlayerName = world.playerName;\n\n    if (!GLOBAL_LEADERBOARD_ENABLED) {\n      setLeaderboards((currentLeaderboards) => {\n        const nextLeaderboards = addLeaderboardTime(\n          currentLeaderboards,\n          levelKey,\n          mode,\n          completedTime,\n          runPlayerName,\n        );\n        saveLeaderboards(nextLeaderboards);\n        return nextLeaderboards;\n      });\n      return;\n    }\n\n    const runPromise = leaderboardRunPromiseRef.current;\n    leaderboardRunPromiseRef.current = null;\n\n    void (async () => {\n      try {\n        const runId = await runPromise;\n\n        if (!runId) {\n          throw new Error(\"Leaderboard run was not started.\");\n        }\n\n        const countryCode = await detectCountryCode();\n        await finishGlobalLeaderboardRun(\n          runId,\n          runPlayerName,\n          countryCode,\n        );\n        await refreshGlobalLeaderboards({ silent: true });\n      } catch (error) {\n        console.warn(\"Global leaderboard submission failed:\", error);\n        setLeaderboardStatus(\"offline\");\n      }\n    })();\n  },\n  [refreshGlobalLeaderboards],\n);\nconst getAudioEngine = useCallback",
  );
  replaceRegex(
    "src/App.jsx",
    /worldRef\.current = nextWorld;\n  startLevelAudio\(nextWorld\);/g,
    `worldRef.current = nextWorld;
    beginLeaderboardRunForWorld(nextWorld);
    startLevelAudio(nextWorld);`,
    2,
  );
  replaceRegex(
    "src/App.jsx",
    /setSelectedLevel\(levelKey\);\n  forceRefresh\(\);\n\}, \[clearTouchInput, forceRefresh, selectionMode, startLevelAudio\]\);/g,
    `setSelectedLevel(levelKey);
    setRunGeneration((value) => value + 1);
    forceRefresh();
  }, [
    beginLeaderboardRunForWorld,
    clearTouchInput,
    forceRefresh,
    selectionMode,
    startLevelAudio,
  ]);`,
  );
  replaceRegex(
    "src/App.jsx",
    /analyticsRunEndedRef\.current = false;\n  void recordGameStarted\(nextWorld\);\n  forceRefresh\(\);\n\}, \[\n  clearTouchInput,\n  flushPlayAnalytics,\n  forceRefresh,\n  gameMode,\n  playerName,\n  selectedLevel,\n  startLevelAudio,\n\]\);/g,
    `analyticsRunEndedRef.current = false;
    void recordGameStarted(nextWorld);
    setRunGeneration((value) => value + 1);
    forceRefresh();
  }, [
    beginLeaderboardRunForWorld,
    clearTouchInput,
    flushPlayAnalytics,
    forceRefresh,
    gameMode,
    playerName,
    selectedLevel,
    startLevelAudio,
  ]);`,
  );
  replaceRegex(
    "src/App.jsx",
    /const switchGameMode = useCallback\(\(\) => \{[\s\S]*?\n\}, \[clearTouchInput, forceRefresh, gameMode\]\);\n/g,
    `const performGameModeSwitch = useCallback(
    (requestedMode) => {
      const nextViewMode = requestedMode === "3d" ? "3d" : "2d";
      const world = worldRef.current;
      const activeLeaderboardRun =
        !world.labyrinthMode && !world.victory && !world.gameOver;

      if (
        typeof document !== "undefined" &&
        document.pointerLockElement
      ) {
        document.exitPointerLock?.();
      }

      setWorldViewMode(world, nextViewMode);

      if (activeLeaderboardRun) {
        world.leaderboardEligible = false;
        setMessage(
          world,
          "Leaderboard disabled for this run after switching 2D / 3D.",
          3.2,
        );
      }

      keysRef.current = {};
      clearTouchInput();
      setGameMode(nextViewMode);
      setSelectionMode(nextViewMode);
      forceRefresh();
    },
    [clearTouchInput, forceRefresh],
  );

  const switchGameMode = useCallback(() => {
    const nextViewMode = gameMode === "3d" ? "2d" : "3d";
    const world = worldRef.current;
    const shouldWarn =
      !world.labyrinthMode &&
      !world.victory &&
      !world.gameOver &&
      world.leaderboardEligible !== false &&
      !modeSwitchWarningSeenRef.current;

    if (shouldWarn) {
      if (
        typeof document !== "undefined" &&
        document.pointerLockElement
      ) {
        document.exitPointerLock?.();
      }

      setPendingModeSwitch(nextViewMode);
      return;
    }

    performGameModeSwitch(nextViewMode);
  }, [gameMode, performGameModeSwitch]);

  const confirmModeSwitch = useCallback(() => {
    if (!pendingModeSwitch) {
      return;
    }

    const nextViewMode = pendingModeSwitch;
    modeSwitchWarningSeenRef.current = true;
    saveModeSwitchWarningSeen();
    setPendingModeSwitch(null);
    performGameModeSwitch(nextViewMode);
  }, [pendingModeSwitch, performGameModeSwitch]);

  const cancelModeSwitch = useCallback(() => {
    setPendingModeSwitch(null);
  }, []);
  `,
  );

  replaceRegex(
    "src/App.jsx",
    /if \(\n    \(world\.victory \|\| world\.gameOver\) &&\n    !analyticsRunEndedRef\.current\n  \) \{[\s\S]*?void recordGameFinished\(world\);\n  \}/g,
    "if (\n    (world.victory || world.gameOver) &&\n    !analyticsRunEndedRef.current\n  ) {\n    analyticsRunEndedRef.current = true;\n\n    if (\n      typeof document !== \"undefined\" &&\n      document.pointerLockElement\n    ) {\n      document.exitPointerLock?.();\n    }\n\n    flushPlayAnalytics(world);\n    void recordGameFinished(world);\n  }",
  );
  replaceRegex(
    "src/App.jsx",
    /drawWorld\(ctx, world\);\n\n  hudAccumulatorRef\.current \+= dt;/g,
    `drawWorld(ctx, world);

    if (world.victory || world.gameOver) {
      forceRefresh();
      return;
    }

    hudAccumulatorRef.current += dt;`,
  );
  replaceRegex(
    "src/App.jsx",
    /  recordLeaderboardScore,\n  selectedLevel,\n\]\);/g,
    `  recordLeaderboardScore,
    runGeneration,
    selectedLevel,
  ]);`,
  );
  replaceRegex(
    "src/App.jsx",
    /  <style>\{GAME_STYLES\}<\/style>\n/g,
    `  <style>{GAME_STYLES}</style>
    {pendingModeSwitch && (
      <ModeSwitchWarning
        fromMode={gameMode}
        toMode={pendingModeSwitch}
        onConfirm={confirmModeSwitch}
        onCancel={cancelModeSwitch}
      />
    )}
    <RunEndOverlay
      world={world}
      onTryAgain={resetWorld}
      onMainMenu={returnToLevelSelect}
    />
  `,
  );

  replaceRegex(
    "src/components/LevelSelectScreen.jsx",
    /        <span>Top \{LEADERBOARD_LIMIT\}<\/span>/g,
    `        <span>
            {status === "local" ? "Personal best" : \`Top \${LEADERBOARD_LIMIT}\`}
          </span>`,
  );
  replaceRegex(
    "src/components/LevelSelectScreen.jsx",
    /\{Array\.from\(\{ length: LEADERBOARD_LIMIT \}, \(_, index\) => \{/g,
    `{Array.from(
            { length: status === "local" ? 1 : LEADERBOARD_LIMIT },
            (_, index) => {`,
  );
  replaceRegex(
    "src/components/LevelSelectScreen.jsx",
    /: `Separate top \$\{LEADERBOARD_LIMIT\} lists for 2D and 3D`\}/g,
    `: "One personal best per level and view mode"}`,
  );
  replaceRegex(
    "src/components/LevelSelectScreen.jsx",
    /Your result will be saved to this level’s separate\{" "\}\n\s+\{viewMode === "3d" \? "3D" : "2D"\} top-ten leaderboard\./g,
    `Only your fastest {viewMode === "3d" ? "3D" : "2D"} result
                    is kept. Slower retries are discarded; a faster run replaces
                    your personal best.`,
  );

  return output;
}

export function mazeHardeningPlugin() {
  return {
    name: "maze-arsenal-source-hardening",
    enforce: "pre",
    transform(code, id) {
      const targetPath = getTargetPath(id);

      if (
        !targetPath ||
        code.includes(HARDENING_MARKER) ||
        isAlreadyHardened(code, targetPath)
      ) {
        return null;
      }

      const transformed = transformMazeSource(code, targetPath);

      if (transformed === code) {
        return null;
      }

      return {
        code: `${HARDENING_MARKER}\n${transformed}`,
        map: null,
      };
    },
  };
}
