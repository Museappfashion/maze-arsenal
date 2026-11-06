// src/config/specialPlayers.js
import { SWORD_GUN_KEY } from "./weapons-enhanced.js";

export const ASHER_PLAYER_NAME = "asher";

export function isAsherPlayerName(playerName) {
  return (
    String(playerName ?? "").trim().toLowerCase() ===
    ASHER_PLAYER_NAME
  );
}

export function hasAsherLoadout(world) {
  return Boolean(world?.player?.asherMode);
}

export function applyAsherLoadout(world) {
  if (
    !world ||
    world.labyrinthMode ||
    !isAsherPlayerName(world.playerName)
  ) {
    return false;
  }

  world.player.asherMode = true;
  world.player.ownedWeapons[SWORD_GUN_KEY] = true;
  world.message = "SWORD GUN UNLOCKED — PRESS 0";
  world.messageTtl = 3;

  return true;
}
