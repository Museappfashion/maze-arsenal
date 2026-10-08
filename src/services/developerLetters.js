import {
  ensureGlobalLeaderboardSession,
  supabase,
} from "./leaderboard.js";

export const DEVELOPER_LETTER_LIMIT = 2000;

async function requestLetter(session, method, payload) {
  return fetch("/api/developer-letter", {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    cache: "no-store",
  });
}

async function playerRequest(method, payload) {
  if (!supabase) {
    throw new Error("Letters are unavailable while the game is offline.");
  }

  let session = await ensureGlobalLeaderboardSession();
  let response = await requestLetter(session, method, payload);
  if (response.status === 401) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) {
      session = data.session;
      response = await requestLetter(session, method, payload);
    }
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Could not access letters (${response.status}).`);
  }
  return result;
}

export async function loadDeveloperLetterInbox() {
  const result = await playerRequest("GET");
  return result.letters ?? [];
}

export async function sendDeveloperReply({ developerKey, letterId, message }) {
  const response = await requestLetter(
    { access_token: String(developerKey ?? "").trim() },
    "PATCH",
    { letterId, message: String(message ?? "").trim() },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Could not send reply (${response.status}).`);
  }
  return result.reply;
}

export async function sendDeveloperLetter({
  message,
  playerName = "",
}) {
  const cleanMessage = String(message ?? "").trim();

  if (!cleanMessage) {
    throw new Error("Write a message before sending.");
  }

  if (cleanMessage.length > DEVELOPER_LETTER_LIMIT) {
    throw new Error(
      `Letters can be at most ${DEVELOPER_LETTER_LIMIT} characters.`,
    );
  }

  return playerRequest("POST", {
    message: cleanMessage,
    playerName: String(playerName ?? "").trim().slice(0, 20),
  });
}
