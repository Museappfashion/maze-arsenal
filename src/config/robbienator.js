// src/config/robbienator.js
export const ROBBIENATOR_PLAYER_NAME = "robbie";
export const ROBBIENATOR_WEAPON_KEY = "dmr";
export const ROBBIENATOR_AMMO = 200;
export const ROBBIENATOR_LABEL = "Robbienator";

export function isRobbiePlayerName(playerName) {
  return (
    String(playerName ?? "").trim().toLowerCase() ===
    ROBBIENATOR_PLAYER_NAME
  );
}

export function hasRobbienatorLoadout(world) {
  return Boolean(world?.player?.robbienator);
}

export function isRobbienatorWeapon(
  world,
  weaponKey = world?.player?.weapon,
) {
  return (
    hasRobbienatorLoadout(world) &&
    weaponKey === ROBBIENATOR_WEAPON_KEY
  );
}

export function applyRobbienatorLoadout(world) {
  if (
    !world ||
    world.labyrinthMode ||
    !isRobbiePlayerName(world.playerName)
  ) {
    return false;
  }

  world.player.robbienator = true;
  world.player.ownedWeapons[ROBBIENATOR_WEAPON_KEY] = true;
  world.player.weapon = ROBBIENATOR_WEAPON_KEY;
  world.player.ammo = ROBBIENATOR_AMMO;
  world.leaderboardEligible = false;
  world.message = "ROBBIENATOR UNLOCKED — 200 AMMO";
  world.messageTtl = 3.2;

  return true;
}
