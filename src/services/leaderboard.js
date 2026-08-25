// src/services/leaderboard.js
import { createClient } from "@supabase/supabase-js";
import { LEVELS } from "../config/constants.js";
import { getPlayerDisplayName } from "../utils/player.js";

export const LEADERBOARD_STORAGE_KEY = "maze-arsenal-fastest-escapes-v2";
export const LEGACY_LEADERBOARD_STORAGE_KEY = "maze-arsenal-fastest-escapes-v1";
export const LEADERBOARD_LIMIT = 10;
export const GLOBAL_LEADERBOARD_TABLE = "leaderboard_scores";
export const GLOBAL_LEADERBOARD_RPC = "get_global_leaderboard";
export const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export let detectedCountryCodePromise = null;

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const GLOBAL_LEADERBOARD_ENABLED = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
);

export const supabase = GLOBAL_LEADERBOARD_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function normalizeCountryCode(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return COUNTRY_CODE_PATTERN.test(normalized) ? normalized : "";
}

export function countryCodeToFlag(value) {
  const countryCode = normalizeCountryCode(value);

  if (!countryCode) {
    return "🌐";
  }

  return String.fromCodePoint(
    ...countryCode
      .split("")
      .map((character) => 127397 + character.charCodeAt(0)),
  );
}

export function inferCountryCodeFromLocale() {
  if (typeof navigator === "undefined") {
    return "";
  }

  const locales = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ].filter(Boolean);

  for (const locale of locales) {
    try {
      const region = new Intl.Locale(locale).region;
      const normalized = normalizeCountryCode(region);

      if (normalized) {
        return normalized;
      }
    } catch {
      const match = String(locale).match(/[-_]([A-Za-z]{2})\b/);
      const normalized = normalizeCountryCode(match?.[1]);

      if (normalized) {
        return normalized;
      }
    }
  }

  return "";
}

export async function detectCountryCode() {
  if (detectedCountryCodePromise) {
    return detectedCountryCodePromise;
  }

  detectedCountryCodePromise = (async () => {
    if (typeof window === "undefined") {
      return "";
    }

    try {
      const response = await fetch("/api/country", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const countryCode = normalizeCountryCode(data?.country);

        if (countryCode) {
          return countryCode;
        }
      }
    } catch {
      // Local Vite development has no Vercel geo endpoint.
    }

    return inferCountryCodeFromLocale();
  })();

  return detectedCountryCodePromise;
}

export function createEmptyLeaderboards() {
  return Object.fromEntries(
    Object.keys(LEVELS).map((levelKey) => [
      levelKey,
      {
        "2d": [],
        "3d": [],
      },
    ]),
  );
}

export function createEmptyUserRanks() {
  return Object.fromEntries(
    Object.keys(LEVELS).map((levelKey) => [
      levelKey,
      {
        "2d": null,
        "3d": null,
      },
    ]),
  );
}

export function normalizeLeaderboardEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => ({
      time: Number(entry?.time),
      completedAt:
        typeof entry?.completedAt === "string" ? entry.completedAt : "",
      playerName: getPlayerDisplayName(entry?.playerName),
      countryCode: normalizeCountryCode(entry?.countryCode),
      globalRank: Number.isFinite(Number(entry?.globalRank))
        ? Number(entry.globalRank)
        : null,
      isCurrentUser: Boolean(entry?.isCurrentUser),
    }))
    .filter((entry) => Number.isFinite(entry.time) && entry.time > 0)
    .sort((a, b) => a.time - b.time)
    .slice(0, LEADERBOARD_LIMIT);
}

export function normalizeLevelLeaderboards(levelBoards) {
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

export function normalizeLeaderboards(stored) {
  return Object.fromEntries(
    Object.keys(LEVELS).map((levelKey) => [
      levelKey,
      normalizeLevelLeaderboards(stored?.[levelKey]),
    ]),
  );
}

export function loadLeaderboards() {
  const empty = createEmptyLeaderboards();

  if (typeof window === "undefined") {
    return empty;
  }

  try {
    const currentRaw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);

    if (currentRaw) {
      const normalized = normalizeLeaderboards(JSON.parse(currentRaw));
      window.localStorage.setItem(
        LEADERBOARD_STORAGE_KEY,
        JSON.stringify(normalized),
      );
      return normalized;
    }

    const legacyRaw = window.localStorage.getItem(
      LEGACY_LEADERBOARD_STORAGE_KEY,
    );

    if (!legacyRaw) {
      return empty;
    }

    const migrated = normalizeLeaderboards(JSON.parse(legacyRaw));
    window.localStorage.setItem(
      LEADERBOARD_STORAGE_KEY,
      JSON.stringify(migrated),
    );
    return migrated;
  } catch {
    return empty;
  }
}

export function saveLeaderboards(leaderboards) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LEADERBOARD_STORAGE_KEY,
      JSON.stringify(leaderboards),
    );
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

export function addLeaderboardTime(
  leaderboards,
  levelKey,
  mode,
  time,
  playerName,
) {
  if (
    !LEVELS[levelKey] ||
    LEVELS[levelKey].leaderboard === false ||
    !["2d", "3d"].includes(mode) ||
    !Number.isFinite(time) ||
    time <= 0
  ) {
    return leaderboards;
  }

  const levelBoards = normalizeLevelLeaderboards(leaderboards[levelKey]);
  const currentBest = levelBoards[mode][0] ?? null;

  if (currentBest && currentBest.time <= time) {
    return leaderboards;
  }

  return {
    ...leaderboards,
    [levelKey]: {
      ...levelBoards,
      [mode]: [
        {
          time,
          completedAt: new Date().toISOString(),
          playerName: getPlayerDisplayName(playerName),
          countryCode: "",
          globalRank: null,
          isCurrentUser: true,
        },
      ],
    },
  };
}

export async function ensureGlobalLeaderboardSession() {
  if (!supabase) {
    throw new Error("Global leaderboard is not configured.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (session) {
    return session;
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("Supabase did not create an anonymous session.");
  }

  return data.session;
}

export async function fetchGlobalLeaderboards() {
  if (!supabase) {
    return null;
  }

  await ensureGlobalLeaderboardSession();

  const { data, error } = await supabase.rpc(GLOBAL_LEADERBOARD_RPC);

  if (error) {
    throw error;
  }

  const nextLeaderboards = createEmptyLeaderboards();
  const userRanks = createEmptyUserRanks();

  for (const row of data ?? []) {
    const levelKey = row.level_key;
    const mode = row.mode === "3d" ? "3d" : "2d";
    const globalRank = Number(row.global_rank);
    const time = Number(row.time_seconds);

    if (
      !LEVELS[levelKey] ||
      LEVELS[levelKey].leaderboard === false ||
      !Number.isFinite(time) ||
      time <= 0
    ) {
      continue;
    }

    const entry = {
      time,
      completedAt: row.created_at ?? "",
      playerName: row.player_name,
      countryCode: normalizeCountryCode(row.country_code),
      globalRank: Number.isFinite(globalRank) ? globalRank : null,
      isCurrentUser: Boolean(row.is_current_user),
    };

    if (entry.isCurrentUser) {
      userRanks[levelKey][mode] = {
        rank: entry.globalRank,
        bestTime: entry.time,
      };
    }

    if (entry.globalRank && entry.globalRank <= LEADERBOARD_LIMIT) {
      nextLeaderboards[levelKey][mode].push(entry);
    }
  }

  for (const levelKey of Object.keys(LEVELS)) {
    nextLeaderboards[levelKey]["2d"] = normalizeLeaderboardEntries(
      nextLeaderboards[levelKey]["2d"],
    );
    nextLeaderboards[levelKey]["3d"] = normalizeLeaderboardEntries(
      nextLeaderboards[levelKey]["3d"],
    );
  }

  return {
    leaderboards: nextLeaderboards,
    userRanks,
  };
}

export async function submitGlobalLeaderboardTime(
  levelKey,
  mode,
  time,
  playerName,
  countryCode,
) {
  if (
    !supabase ||
    !LEVELS[levelKey] ||
    LEVELS[levelKey].leaderboard === false ||
    !["2d", "3d"].includes(mode) ||
    !Number.isFinite(time) ||
    time <= 0
  ) {
    return false;
  }

  await ensureGlobalLeaderboardSession();

  const roundedTime = Math.round(time * 1000) / 1000;
  const { data, error } = await supabase.rpc("submit_personal_best", {
    p_level_key: levelKey,
    p_mode: mode,
    p_time_seconds: roundedTime,
    p_player_name: getPlayerDisplayName(playerName),
    p_country_code: normalizeCountryCode(countryCode) || null,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}
