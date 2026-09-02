// src/services/leaderboard-enhanced.js
import { LEVELS } from "../config/constants.js";
import { getPlayerDisplayName } from "../utils/player.js";
import * as core from "./leaderboard.js?core";

export * from "./leaderboard.js?core";

export const START_LEADERBOARD_RUN_RPC = "start_leaderboard_run";
export const FINISH_LEADERBOARD_RUN_RPC = "finish_leaderboard_run";
export const PERSONAL_BEST_STORAGE_KEY =
  "mist-maze-personal-bests-v3";

let personalBestCache = null;

function normalizeMode(mode) {
  return mode === "3d" ? "3d" : "2d";
}

function emptyPersonalBests() {
  return core.createEmptyLeaderboards();
}

function normalizePersonalBestEntry(entry) {
  const time = Number(entry?.time);

  if (!Number.isFinite(time) || time <= 0) {
    return null;
  }

  return {
    time,
    completedAt:
      typeof entry?.completedAt === "string"
        ? entry.completedAt
        : "",
    playerName: getPlayerDisplayName(entry?.playerName),
    countryCode: core.normalizeCountryCode(entry?.countryCode),
    globalRank: Number.isFinite(Number(entry?.globalRank))
      ? Number(entry.globalRank)
      : null,
    isCurrentUser: Boolean(entry?.isCurrentUser),
  };
}

function choosePersonalBest(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const candidates = entries
    .map(normalizePersonalBestEntry)
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  const personalCandidates = candidates.filter(
    (entry) => entry.isCurrentUser || entry.globalRank === null,
  );

  return (personalCandidates[0] ? [personalCandidates[0]] : []);
}

function normalizePersonalBests(stored) {
  const output = emptyPersonalBests();

  for (const levelKey of Object.keys(LEVELS)) {
    const levelBoards = stored?.[levelKey];
    const legacyEntries = Array.isArray(levelBoards)
      ? levelBoards
      : null;

    output[levelKey]["2d"] = choosePersonalBest(
      legacyEntries ?? levelBoards?.["2d"],
    );
    output[levelKey]["3d"] = choosePersonalBest(
      levelBoards?.["3d"],
    );
  }

  return output;
}

function persistPersonalBests() {
  if (
    typeof window === "undefined" ||
    !personalBestCache
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      PERSONAL_BEST_STORAGE_KEY,
      JSON.stringify(personalBestCache),
    );
  } catch {
    // Private/restricted browser storage can be unavailable.
  }
}

function ensurePersonalBestCache() {
  if (personalBestCache) {
    return personalBestCache;
  }

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(
        PERSONAL_BEST_STORAGE_KEY,
      );

      if (raw) {
        personalBestCache = normalizePersonalBests(
          JSON.parse(raw),
        );
        return personalBestCache;
      }
    } catch {
      // Fall through to migration.
    }
  }

  personalBestCache = normalizePersonalBests(
    core.loadLeaderboards(),
  );
  persistPersonalBests();
  return personalBestCache;
}

function recordPersonalBest(levelKey, mode, time, playerName) {
  if (
    !LEVELS[levelKey] ||
    LEVELS[levelKey].leaderboard === false ||
    !Number.isFinite(time) ||
    time <= 0
  ) {
    return;
  }

  const cache = ensurePersonalBestCache();
  const normalizedMode = normalizeMode(mode);
  const current = cache[levelKey][normalizedMode][0];

  if (current && current.time <= time) {
    return;
  }

  cache[levelKey][normalizedMode] = [
    {
      time,
      completedAt: new Date().toISOString(),
      playerName: getPlayerDisplayName(playerName),
      countryCode: "",
      globalRank: null,
      isCurrentUser: false,
    },
  ];

  persistPersonalBests();
}

export function loadLeaderboards() {
  return ensurePersonalBestCache();
}

export function saveLeaderboards() {
  persistPersonalBests();
}

export function addLeaderboardTime(
  leaderboards,
  levelKey,
  mode,
  time,
  playerName,
) {
  recordPersonalBest(
    levelKey,
    mode,
    time,
    playerName,
  );

  if (core.GLOBAL_LEADERBOARD_ENABLED) {
    return core.addLeaderboardTime(
      leaderboards,
      levelKey,
      mode,
      time,
      playerName,
    );
  }

  return ensurePersonalBestCache();
}

export async function startGlobalLeaderboardRun(
  levelKey,
  mode,
) {
  if (
    !core.supabase ||
    !LEVELS[levelKey] ||
    LEVELS[levelKey].leaderboard === false
  ) {
    return null;
  }

  await core.ensureGlobalLeaderboardSession();

  const { data, error } = await core.supabase.rpc(
    START_LEADERBOARD_RUN_RPC,
    {
      p_level_key: levelKey,
      p_mode: normalizeMode(mode),
    },
  );

  if (error) {
    throw error;
  }

  return typeof data === "string" && data
    ? data
    : null;
}

export async function finishGlobalLeaderboardRun(
  runId,
  playerName,
  countryCode,
) {
  if (!core.supabase || !runId) {
    return null;
  }

  await core.ensureGlobalLeaderboardSession();

  const { data, error } = await core.supabase.rpc(
    FINISH_LEADERBOARD_RUN_RPC,
    {
      p_run_id: runId,
      p_player_name: getPlayerDisplayName(playerName),
      p_country_code:
        core.normalizeCountryCode(countryCode) || null,
    },
  );

  if (error) {
    throw error;
  }

  return {
    improved: Boolean(data?.improved),
    timeSeconds: Number(data?.timeSeconds) || null,
  };
}

export async function submitGlobalLeaderboardTime(
  levelKey,
  mode,
  _clientTime,
  playerName,
  countryCode,
) {
  const world =
    typeof globalThis !== "undefined"
      ? globalThis.__mistMazeWorld
      : null;
  const normalizedMode = normalizeMode(mode);

  if (
    !world ||
    world.labyrinthMode ||
    world.leaderboardEligible === false ||
    world.level?.key !== levelKey ||
    normalizeMode(world.runMode) !== normalizedMode
  ) {
    return false;
  }

  const runPromise = world.__leaderboardRunPromise;
  world.__leaderboardRunPromise = null;
  world.__leaderboardRunFinished = true;

  if (!runPromise) {
    return false;
  }

  const runId = await runPromise;

  if (!runId) {
    return false;
  }

  await finishGlobalLeaderboardRun(
    runId,
    playerName,
    countryCode,
  );

  return true;
}
