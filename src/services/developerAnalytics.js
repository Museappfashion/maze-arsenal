// src/services/developerAnalytics.js

const ANALYTICS_ENDPOINT = "/api/developer-analytics";
const USER_ID_STORAGE_KEY = "mist-maze-analytics-user-id";

function createUserId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getUserId() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    let userId = window.localStorage.getItem(USER_ID_STORAGE_KEY);

    if (!userId) {
      userId = createUserId();
      window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    }

    return userId;
  } catch {
    return createUserId();
  }
}

function normalizePlayerName(playerName) {
  if (typeof playerName !== "string") {
    return "";
  }

  return playerName.trim().slice(0, 40);
}

async function sendAnalyticsEvent(type, data = {}) {
  try {
    const response = await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        userId: getUserId(),
        ...data,
      }),
      keepalive: true,
    });

    if (!response.ok) {
      console.warn(
        `Developer analytics request failed: ${response.status}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn(
      "Developer analytics request failed:",
      error instanceof Error ? error.message : String(error),
    );

    return false;
  }
}

export async function recordGameStarted(playerName = "") {
  return sendAnalyticsEvent("game_started", {
    playerName: normalizePlayerName(playerName),
  });
}

export async function recordGameFinished(playerName = "") {
  return sendAnalyticsEvent("game_finished", {
    playerName: normalizePlayerName(playerName),
  });
}

export async function recordPlaySeconds(
  seconds,
  playerName = "",
) {
  const normalizedSeconds = Math.max(
    0,
    Math.min(3600, Math.floor(Number(seconds) || 0)),
  );

  if (normalizedSeconds === 0) {
    return false;
  }

  return sendAnalyticsEvent("play_seconds", {
    playerName: normalizePlayerName(playerName),
    seconds: normalizedSeconds,
  });
}

export async function recordDonationAttempt(
  amount,
  playerName = "",
) {
  const numericAmount = Number(amount);

  let donationType = "custom";

  if (numericAmount === 1) {
    donationType = "1";
  } else if (numericAmount === 2) {
    donationType = "2";
  } else if (numericAmount === 5) {
    donationType = "5";
  }

  return sendAnalyticsEvent("donation_attempt", {
    playerName: normalizePlayerName(playerName),
    donationType,
  });
}