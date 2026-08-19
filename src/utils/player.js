// src/utils/player.js
export const PLAYER_NAME_LIMIT = 20;

export function sanitizePlayerName(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PLAYER_NAME_LIMIT);
}

export function getPlayerDisplayName(valueOrWorld) {
  const value =
    valueOrWorld && typeof valueOrWorld === "object"
      ? valueOrWorld.playerName
      : valueOrWorld;

  return sanitizePlayerName(value) || "You";
}
