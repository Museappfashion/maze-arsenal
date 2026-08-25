// src/services/developerAnalytics.js
import {
  ensureGlobalLeaderboardSession,
  supabase,
} from "./leaderboard.js";

const PLAYTIME_HEARTBEAT_LIMIT_SECONDS = 120;
const DEVELOPER_USAGE_ENDPOINT = "/api/developer-usage";

let analyticsSessionPromise = null;

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

async function recordUsage({
  eventType,
  donationKey = null,
  seconds = 0,
  playerName = "",
}) {
  if (!supabase) {
    return false;
  }

  const payload = {
    eventType,
    donationKey,
    seconds: Math.min(
      PLAYTIME_HEARTBEAT_LIMIT_SECONDS,
      Math.max(0, Math.round(Number(seconds) || 0)),
    ),
    playerName: String(playerName ?? "").trim().slice(0, 20),
  };

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

export function recordVisitorSeen() {
  return recordUsage({
    eventType: "visitor",
  });
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
    seconds: PLAYTIME_HEARTBEAT_LIMIT_SECONDS,
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
