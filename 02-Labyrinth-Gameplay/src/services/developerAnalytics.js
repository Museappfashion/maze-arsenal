// src/services/developerAnalytics.js
import {
  ensureGlobalLeaderboardSession,
  supabase,
} from "./leaderboard-enhanced.js";

import { getPlayerIdentity } from "./playerIdentity.js";
import { flushPlayerProgress, recordActivePlay, setSyncedPlaytime } from "./playerProgress.js";
import { sanitizePlayerName } from "../utils/player.js";

const PLAYTIME_HEARTBEAT_LIMIT_SECONDS = 120;
const DEVELOPER_USAGE_ENDPOINT = "/api/developer-usage";

let analyticsSessionPromise = null;
let usageQueue = Promise.resolve();
let playtimeRequest = 0;
let playtimeAccount = null;
const pendingPlaytime = new Map();

function updatePlaytimeAccount(session) {
  const account = session?.user?.id ?? null;
  if (account === playtimeAccount) return;
  playtimeAccount = account;
  playtimeRequest += 1;
  setSyncedPlaytime(null);
}

supabase?.auth.onAuthStateChange?.((_event, session) => updatePlaytimeAccount(session));

async function getAnalyticsSession() {
  if (!supabase) {
    return null;
  }

  if (!analyticsSessionPromise) {
    analyticsSessionPromise = ensureGlobalLeaderboardSession().finally(() => {
      analyticsSessionPromise = null;
    });
  }

  return analyticsSessionPromise;
}

async function postUsage(session, payload) {
  return fetch(DEVELOPER_USAGE_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    keepalive: true,
  });
}

function recordUsage({
  eventType,
  donationKey = null,
  seconds = 0,
  playerName = "",
}) {
  if (!supabase) {
    return Promise.resolve(false);
  }

  const payload = {
    eventType,
    donationKey,
    seconds: Math.min(
      PLAYTIME_HEARTBEAT_LIMIT_SECONDS,
      Math.max(0, Math.round(Number(seconds) || 0)),
    ),
    playerName: sanitizePlayerName(playerName) || getPlayerIdentity(),
  };

  // A run's start, heartbeats and finish must reach the server in that order.
  usageQueue = usageQueue.then(() => sendUsage(payload));
  return usageQueue;
}

async function sendUsage(payload) {
  try {
    let session = await getAnalyticsSession();

    if (!session?.access_token) {
      return false;
    }

    let response = await postUsage(session, payload);

    if (response.status === 401) {
      const { data, error } = await supabase.auth.refreshSession();

      if (!error && data.session?.access_token) {
        session = data.session;
        response = await postUsage(session, payload);
      }
    }

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message =
        data?.error ??
        data?.code ??
        `Analytics request failed (${response.status}).`;

      throw new Error(message);
    }

    return true;
  } catch (error) {
    console.warn("Developer analytics event failed:", error);
    return false;
  }
}

export function recordDonationAttempt(donationKey) {
  if (!["1", "2", "5", "custom"].includes(donationKey)) {
    return Promise.resolve(false);
  }

  return recordUsage({
    eventType: "donation",
    donationKey,
  });
}

export function recordVisitorSeen(playerName = getPlayerIdentity()) {
  return recordUsage({ eventType: "visitor", playerName });
}

export function recordGameStarted(world) {
  return recordUsage({
    eventType: "game_start",
    playerName: world?.playerName ?? "",
  });
}

export function recordGameFinished(world) {
  return recordUsage({
    eventType: "game_finish",
    playerName: world?.playerName ?? "",
  });
}

export function recordPlaySeconds(world, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return Promise.resolve(false);
  }

  return recordUsage({
    eventType: "playtime",
    seconds,
    playerName: world?.playerName ?? "",
  });
}

export function recordTrackedPlay(playerName, deltaSeconds) {
  const activeSeconds = recordActivePlay(playerName, deltaSeconds);
  if (!supabase || !activeSeconds) return;

  const total = (pendingPlaytime.get(playerName) ?? 0) + activeSeconds;
  pendingPlaytime.set(playerName, total);
  if (total >= 30) flushTrackedPlay(playerName);
}

export function flushTrackedPlay(playerName) {
  flushPlayerProgress();
  const pendingSeconds = pendingPlaytime.get(playerName) ?? 0;
  const wholeSeconds = Math.floor(pendingSeconds);
  if (!wholeSeconds) return;

  pendingPlaytime.set(playerName, pendingSeconds - wholeSeconds);
  void recordPlaySeconds({ playerName }, wholeSeconds);
}

export async function refreshPlayerPlaytime() {
  if (!supabase) return;

  try {
    const session = await getAnalyticsSession();
    if (!session?.access_token) return;
    updatePlaytimeAccount(session);
    const request = ++playtimeRequest;

    // The level menu can mount while the last heartbeat is still in flight.
    await usageQueue;
    if (request !== playtimeRequest) return;

    const response = await fetch(DEVELOPER_USAGE_ENDPOINT, {
      headers: { Accept: "application/json", Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (request !== playtimeRequest) return;
    if (response.status === 401) setSyncedPlaytime(null);
    if (!response.ok) return;

    const { playedSeconds } = await response.json();
    if (request === playtimeRequest && Number.isFinite(playedSeconds) && playedSeconds >= 0) {
      setSyncedPlaytime(playedSeconds);
    }
  } catch { /* Keep the last confirmed total or the browser's local progress. */ }
}
