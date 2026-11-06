// src/utils/math.js
import { WEAPON_ORDER } from "../config/weapons.js";

export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function lerp(a, b, t) { return a + (b - a) * t; }

export function rand(min = 0, max = 1) { return min + Math.random() * (max - min); }

export function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

export function chance(probability) { return Math.random() < probability; }

export function shuffle(items) { const list = [...items]; for (let i = list.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; }

export function weightedChoice(entries) { if (!entries.length) { return null; }

let total = 0; for (const [, weight] of entries) { total += weight; }

let roll = Math.random() * total; for (const [key, weight] of entries) { roll -= weight; if (roll <= 0) { return key; } }

return entries[entries.length - 1][0]; }

export function indexOfTile(width, x, y) { return y * width + x; }

export function tileCenter(tile) { return { x: tile.x + 0.5, y: tile.y + 0.5 }; }

export function normalize(x, y) { const length = Math.hypot(x, y) || 1; return { x: x / length, y: y / length }; }

export function angleDelta(a, b) { let delta = a - b; while (delta > Math.PI) delta -= Math.PI * 2; while (delta < -Math.PI) delta += Math.PI * 2; return delta; }

export function formatTime(seconds) { const safe = Math.max(0, Math.floor(seconds)); const minutes = String(Math.floor(safe / 60)).padStart(2, "0"); const secs = String(safe % 60).padStart(2, "0");

return `${minutes}:${secs}`; }

export function formatLeaderboardTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const wholeSeconds = Math.floor(safe);
  const minutes = String(Math.floor(wholeSeconds / 60)).padStart(2, "0");
  const secs = String(wholeSeconds % 60).padStart(2, "0");
  const centiseconds = String(Math.floor((safe - wholeSeconds) * 100)).padStart(2, "0");

  return `${minutes}:${secs}.${centiseconds}`;
}

export function createOwnedWeapons() { return Object.fromEntries( WEAPON_ORDER.map((weaponKey) => [weaponKey, weaponKey === "fists"]), ); }
