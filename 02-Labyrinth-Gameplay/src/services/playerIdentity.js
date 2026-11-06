import { sanitizePlayerName } from "../utils/player.js";
import { adoptAnonymousPlaytime, getLastPlayerName } from "./playerProgress.js";

export const PLAYER_IDENTITY_KEY = "mist-maze-player-identity-v1";
let sessionName = "";

/** Existing named profiles are already identified and do not need a new prompt. */
export function getPlayerIdentity() {
  try {
    const raw = globalThis.localStorage?.getItem(PLAYER_IDENTITY_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    const name = sanitizePlayerName(saved?.playerName);
    if (name) { sessionName = name; return name; }
  } catch { /* A usable session identity remains available without storage. */ }
  if (sessionName) return sessionName;
  const previous = sanitizePlayerName(getLastPlayerName());
  if (previous) savePlayerIdentity(previous, { adoptAnonymous: false });
  return previous;
}

/** Blank input never replaces a known name or changes a player's profiles. */
export function savePlayerIdentity(value, { adoptAnonymous = true } = {}) {
  const name = sanitizePlayerName(value);
  if (!name) return "";
  let identified = Boolean(sessionName);
  try { identified ||= Boolean(sanitizePlayerName(JSON.parse(globalThis.localStorage?.getItem(PLAYER_IDENTITY_KEY) || "null")?.playerName)); }
  catch { /* The progress receipt also protects adoption if identity storage fails. */ }
  if (adoptAnonymous && !identified && !getLastPlayerName()) adoptAnonymousPlaytime(name);
  sessionName = name;
  try { globalThis.localStorage?.setItem(PLAYER_IDENTITY_KEY, JSON.stringify({ version: 1, playerName: name })); }
  catch { /* State in the current session still uses the chosen name. */ }
  return name;
}
