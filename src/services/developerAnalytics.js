// src/services/developerAnalytics.js
import {
  ensureGlobalLeaderboardSession,
  supabase,
} from "./leaderboard.js";

const PLAYTIME_HEARTBEAT_LIMIT_SECONDS = 120;

async function recordUsage({
  eventType,
  donationKey = null,
  seconds = 0,
  playerName = "",
}) {
  if (!supabase) {
    return false;
  }

  try {
    await ensureGlobalLeaderboardSession();

    const normalizedSeconds = Math.min(
      PLAYTIME_HEARTBEAT_LIMIT_SECONDS,
      Math.max(0, Math.round(Number(seconds) || 0)),
    );

    const { error } = await supabase.rpc("record_developer_usage", {
      p_event: eventType,
      p_donation_key: donationKey,
      p_seconds: normalizedSeconds,
      p_player_name: String(playerName ?? "").trim().slice(0, 20),
    });

    if (error) {
      throw error;
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
