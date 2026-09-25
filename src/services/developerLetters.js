import {
  ensureGlobalLeaderboardSession,
  supabase,
} from "./leaderboard.js";

export const DEVELOPER_LETTER_LIMIT = 2000;

async function postLetter(session, payload) {
  return fetch("/api/developer-letter", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
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

  if (!supabase) {
    throw new Error("Letters are unavailable while the game is offline.");
  }

  let session = await ensureGlobalLeaderboardSession();
  let response = await postLetter(session, {
    message: cleanMessage,
    playerName: String(playerName ?? "").trim().slice(0, 20),
  });

  if (response.status === 401) {
    const { data, error } = await supabase.auth.refreshSession();

    if (!error && data.session?.access_token) {
      session = data.session;
      response = await postLetter(session, {
        message: cleanMessage,
        playerName: String(playerName ?? "").trim().slice(0, 20),
      });
    }
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error || `Could not send letter (${response.status}).`,
    );
  }

  return payload;
}
