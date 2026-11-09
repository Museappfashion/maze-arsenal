import { sanitizePlayerName } from "../utils/player.js";
import { claimExpeditionMizGift } from "./mizEconomy.js";
import { claimExpeditionHuxGift } from "./huxEconomy.js";

export const PLAYER_PROGRESS_KEY = "mist-maze-player-progress-v1";
export const PLAYER_PROGRESS_EVENT = "mist-maze-player-progress-updated";
export const SPECIAL_UNLOCK_NAME = "oibougvovov";
export const MODE_UNLOCK_SECONDS = Object.freeze({ towerDefense: 3600, hundredFloor: 7200 });
const pending = new Map();
let memory = { profiles: {}, lastPlayerName: "", anonymousIdentityClaimedBy: "" };
let unsaved = false;
let lastObserved = null;
let sinceFlush = 0;
let syncedPlaytime = null;

const seconds = (value) => Number.isFinite(Number(value)) ? Math.min(1e10, Math.max(0, Number(value))) : 0;
export const playerProgressId = (name) => `p:${sanitizePlayerName(name).toLowerCase() || "(anonymous)"}`;
export const isSpecialUnlockName = (name) => sanitizePlayerName(name).toLowerCase() === SPECIAL_UNLOCK_NAME;

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(PLAYER_PROGRESS_KEY) ?? null;
    if (unsaved && raw === lastObserved) return memory;
    const value = raw ? JSON.parse(raw) : {};
    const profiles = {};
    for (const [key, profile] of Object.entries(value?.profiles || {})) {
      if (key.startsWith("p:")) profiles[key] = { seconds: seconds(profile?.seconds) };
    }
    memory = { profiles, lastPlayerName: sanitizePlayerName(value?.lastPlayerName), anonymousIdentityClaimedBy: sanitizePlayerName(value?.anonymousIdentityClaimedBy).toLowerCase() };
    lastObserved = raw;
    unsaved = false;
  } catch { /* Keep this session's progress if storage is unavailable. */ }
  return memory;
}

function publish() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PLAYER_PROGRESS_EVENT));
}

function write(state) {
  memory = state;
  unsaved = true;
  try {
    if (globalThis.localStorage) {
      const raw = JSON.stringify(state);
      globalThis.localStorage.setItem(PLAYER_PROGRESS_KEY, raw);
      lastObserved = raw;
      unsaved = false;
    }
  } catch { /* Session progress remains usable when storage is full. */ }
  publish();
}

export function getLastPlayerName() { return read().lastPlayerName; }

/** Adopt old anonymous playtime once when that player chooses their first name.
 * Copying the maximum preserves gates without summing time or duplicating rewards.
 * The receipt belongs to the progress store, so losing the identity key cannot
 * repeat adoption into another profile. The anonymous profile stays untouched.
 */
export function adoptAnonymousPlaytime(name) {
  const clean = sanitizePlayerName(name);
  if (!clean) return false;
  flushPlayerProgress();
  const state = read();
  if (state.anonymousIdentityClaimedBy) return false;
  const id = playerProgressId(clean);
  const anonymous = seconds(state.profiles[playerProgressId("")]?.seconds);
  const existing = seconds(state.profiles[id]?.seconds);
  write({ ...state, anonymousIdentityClaimedBy: clean.toLowerCase(), profiles: { ...state.profiles, [id]: { seconds: Math.max(anonymous, existing) } } });
  return true;
}


export function getPlayerProgress(name) {
  const id = playerProgressId(name);
  const localSeconds = seconds(read().profiles[id]?.seconds) + (pending.get(id) || 0);
  const playedSeconds = syncedPlaytime ?? localSeconds;
  const unlockSeconds = Math.max(localSeconds, playedSeconds);
  const special = isSpecialUnlockName(name);
  return {
    playerName: sanitizePlayerName(name), playedSeconds, special,
    towerDefense: special || unlockSeconds >= MODE_UNLOCK_SECONDS.towerDefense,
    hundredFloor: special || unlockSeconds >= MODE_UNLOCK_SECONDS.hundredFloor,
  };
}

export function setSyncedPlaytime(value) {
  const next = Number.isFinite(value) && value >= 0 ? value : null;
  if (next === syncedPlaytime) return;
  syncedPlaytime = next;
  publish();
}

// The receipt lives in each wallet alongside its credit, so selecting or
// reloading the name cannot repeatedly grant money or overwrite purchases.
export function selectProgressPlayer(name) {
  const clean = sanitizePlayerName(name);
  const state = read();
  write({ ...state, lastPlayerName: clean });
  if (isSpecialUnlockName(clean)) {
    claimExpeditionMizGift();
    claimExpeditionHuxGift();
  }
  return getPlayerProgress(clean);
}

export function flushPlayerProgress() {
  if (!pending.size) return;
  const state = read();
  const profiles = { ...state.profiles };
  for (const [id, delta] of pending) profiles[id] = { seconds: seconds(profiles[id]?.seconds) + delta };
  pending.clear();
  sinceFlush = 0;
  write({ ...state, profiles });
}

// Called by live simulation loops, never by the menu or wall-clock timers.
// Cap resumed frames so a sleeping/hidden tab cannot earn hours in one tick.
export function recordActivePlay(name, deltaSeconds) {
  if (typeof document !== "undefined" && document.hidden) return 0;
  const delta = Math.min(1, seconds(deltaSeconds));
  if (!delta) return 0;
  const id = playerProgressId(name);
  pending.set(id, (pending.get(id) || 0) + delta);
  sinceFlush += delta;
  if (sinceFlush >= 10) flushPlayerProgress();
  return delta;
}

if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("pagehide", flushPlayerProgress);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushPlayerProgress(); });
  window.addEventListener("storage", (event) => { if (event.key === PLAYER_PROGRESS_KEY) publish(); });
}
