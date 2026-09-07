// src/services/leaderboard-enhanced.js
import { LEVELS } from "../config/constants.js";
import { getPlayerDisplayName } from "../utils/player.js";
import * as core from "./leaderboard.js?core";

export * from "./leaderboard.js?core";

export const START_LEADERBOARD_RUN_RPC = "start_leaderboard_run";
export const FINISH_LEADERBOARD_RUN_RPC = "finish_leaderboard_run";

export function addLeaderboardTime(
  leaderboards,
  levelKey,
  mode,
  time,
  playerName,
) {
  const world = globalThis.__mistMazeWorld;

  if (
    world &&
    (
      world.labyrinthMode ||
      world.leaderboardEligible === false
    )
  ) {
    return leaderboards;
  }

  return core.addLeaderboardTime(
    leaderboards,
    levelKey,
    mode,
    time,
    playerName,
  );
}

function normalizeMode(mode) {
  return mode === "3d" ? "3d" : "2d";
}

export async function startGlobalLeaderboardRun(levelKey, mode) {
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

  return typeof data === "string" && data ? data : null;
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

  return data;
}

export async function submitGlobalLeaderboardTime(
  levelKey,
  mode,
  _clientTime,
  playerName,
  countryCode,
) {
  const world = globalThis.__mistMazeWorld;

  if (
    !world ||
    world.labyrinthMode ||
    world.leaderboardEligible === false ||
    world.level?.key !== levelKey ||
    normalizeMode(world.runMode) !== normalizeMode(mode)
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
