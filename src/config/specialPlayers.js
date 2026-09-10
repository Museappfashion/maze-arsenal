// src/config/specialPlayers.js
import {
  BLACK_SWORD_KEY,
  PORTAL_GUN_KEY,
  SWORD_GUN_KEY,
} from "./weapons-enhanced.js";

export const SPECIAL_PLAYER_IDS = Object.freeze({
  ROBBIE: "robbie",
  ASHER: "asher",
  JOJO: "jojo",
  FEIVEL: "feivel",
  DAVID_CH: "davidCh",
});

export const SPECIAL_PLAYERS = Object.freeze({
  [SPECIAL_PLAYER_IDS.ROBBIE]: Object.freeze({
    name: "robbie",
    label: "Robbie",
  }),
  [SPECIAL_PLAYER_IDS.ASHER]: Object.freeze({
    name: "asher",
    label: "Asher",
  }),
  [SPECIAL_PLAYER_IDS.JOJO]: Object.freeze({
    name: "jojo",
    label: "JOJO",
  }),
  [SPECIAL_PLAYER_IDS.FEIVEL]: Object.freeze({
    name: "feivel",
    label: "Feivel",
  }),
  [SPECIAL_PLAYER_IDS.DAVID_CH]: Object.freeze({
    name: "david ch",
    label: "David ch",
  }),
});

export const ROBBIENATOR_PLAYER_NAME =
  SPECIAL_PLAYERS[SPECIAL_PLAYER_IDS.ROBBIE].name;
export const ROBBIENATOR_WEAPON_KEY = "dmr";
export const ROBBIENATOR_START_WEAPON_KEY = "smg";
export const ROBBIENATOR_AMMO = 200;
export const ROBBIENATOR_LABEL = "Robbienator";

export const FEIVEL_WEAPON_KEY = BLACK_SWORD_KEY;
export const DAVID_CH_WEAPON_KEY = PORTAL_GUN_KEY;
export const DAVID_CH_START_AMMO = 200;

export function normalizeSpecialPlayerName(playerName) {
  return String(playerName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getSpecialPlayerId(playerName) {
  const normalized =
    normalizeSpecialPlayerName(playerName);

  for (const [id, definition] of Object.entries(SPECIAL_PLAYERS)) {
    if (definition.name === normalized) {
      return id;
    }
  }

  return null;
}

export function isSpecialPlayerName(playerName, specialPlayerId) {
  return (
    getSpecialPlayerId(playerName) ===
    specialPlayerId
  );
}

export function isSpecialPlayerWorld(
  world,
  specialPlayerId,
) {
  return (
    world?.player?.specialPlayerId ===
      specialPlayerId ||
    isSpecialPlayerName(
      world?.playerName,
      specialPlayerId,
    )
  );
}

function prepareSpecialPlayer(world, specialPlayerId) {
  if (!world?.player) {
    return false;
  }

  world.player.specialPlayerId =
    specialPlayerId;
  world.leaderboardEligible = false;
  return true;
}

function ownWeapon(world, weaponKey) {
  world.player.ownedWeapons ??= {};
  world.player.ownedWeapons[weaponKey] = true;
}

export function isRobbiePlayerName(playerName) {
  return isSpecialPlayerName(
    playerName,
    SPECIAL_PLAYER_IDS.ROBBIE,
  );
}

export function hasRobbienatorLoadout(world) {
  return Boolean(
    world?.player?.robbienator ||
      isSpecialPlayerWorld(
        world,
        SPECIAL_PLAYER_IDS.ROBBIE,
      ),
  );
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

  prepareSpecialPlayer(
    world,
    SPECIAL_PLAYER_IDS.ROBBIE,
  );
  world.player.robbienator = true;
  ownWeapon(world, ROBBIENATOR_WEAPON_KEY);
  ownWeapon(
    world,
    ROBBIENATOR_START_WEAPON_KEY,
  );
  world.player.weapon =
    ROBBIENATOR_START_WEAPON_KEY;
  world.player.ammo = ROBBIENATOR_AMMO;
  world.message =
    "ROBBIENATOR + PULSAR UNLOCKED — 200 AMMO";
  world.messageTtl = 3.2;

  return true;
}

export function isAsherPlayerName(playerName) {
  return isSpecialPlayerName(
    playerName,
    SPECIAL_PLAYER_IDS.ASHER,
  );
}

export function hasAsherLoadout(world) {
  return Boolean(
    world?.player?.asherMode ||
      isSpecialPlayerWorld(
        world,
        SPECIAL_PLAYER_IDS.ASHER,
      ),
  );
}

export function applyAsherLoadout(world) {
  if (
    !world ||
    world.labyrinthMode ||
    !isAsherPlayerName(world.playerName)
  ) {
    return false;
  }

  prepareSpecialPlayer(
    world,
    SPECIAL_PLAYER_IDS.ASHER,
  );
  world.player.asherMode = true;
  ownWeapon(world, SWORD_GUN_KEY);
  world.message =
    "SWORD GUN UNLOCKED — PRESS 0";
  world.messageTtl = 3;

  return true;
}

export function isJojoPlayerName(playerName) {
  return isSpecialPlayerName(
    playerName,
    SPECIAL_PLAYER_IDS.JOJO,
  );
}

export function hasJojoMode(world) {
  return Boolean(
    world?.player?.jojoMode ||
      world?.__jojoMode ||
      isSpecialPlayerWorld(
        world,
        SPECIAL_PLAYER_IDS.JOJO,
      ),
  );
}

export function applyJojoLoadout(world) {
  if (
    !world ||
    world.labyrinthMode ||
    !isJojoPlayerName(world.playerName)
  ) {
    return false;
  }

  prepareSpecialPlayer(
    world,
    SPECIAL_PLAYER_IDS.JOJO,
  );
  world.player.jojoMode = true;
  world.__jojoMode = true;
  world.message = "JOJO MODE ENABLED";
  world.messageTtl = 2.4;

  return true;
}

export function isFeivelPlayerName(playerName) {
  return isSpecialPlayerName(
    playerName,
    SPECIAL_PLAYER_IDS.FEIVEL,
  );
}

export function hasFeivelLoadout(world) {
  return Boolean(
    world?.player?.feivelMode ||
      isSpecialPlayerWorld(
        world,
        SPECIAL_PLAYER_IDS.FEIVEL,
      ),
  );
}

export function applyFeivelLoadout(world) {
  if (
    !world ||
    world.labyrinthMode ||
    !isFeivelPlayerName(world.playerName)
  ) {
    return false;
  }

  prepareSpecialPlayer(
    world,
    SPECIAL_PLAYER_IDS.FEIVEL,
  );
  world.player.feivelMode = true;
  ownWeapon(world, FEIVEL_WEAPON_KEY);
  world.player.weapon = FEIVEL_WEAPON_KEY;
  world.message =
    "BLACK SWORD UNLOCKED — PRESS -";
  world.messageTtl = 3;

  return true;
}

export function isDavidChPlayerName(playerName) {
  return isSpecialPlayerName(
    playerName,
    SPECIAL_PLAYER_IDS.DAVID_CH,
  );
}

export function hasDavidChLoadout(world) {
  return Boolean(
    world?.player?.davidChMode ||
      isSpecialPlayerWorld(
        world,
        SPECIAL_PLAYER_IDS.DAVID_CH,
      ),
  );
}

export function applyDavidChLoadout(world) {
  if (
    !world ||
    world.labyrinthMode ||
    !isDavidChPlayerName(world.playerName)
  ) {
    return false;
  }

  prepareSpecialPlayer(
    world,
    SPECIAL_PLAYER_IDS.DAVID_CH,
  );
  world.player.davidChMode = true;
  ownWeapon(world, DAVID_CH_WEAPON_KEY);
  world.player.weapon = DAVID_CH_WEAPON_KEY;
  world.player.ammo = Math.max(
    DAVID_CH_START_AMMO,
    Number(world.player.ammo) || 0,
  );
  world.message =
    "PORTAL GUN UNLOCKED — PRESS =";
  world.messageTtl = 3;

  return true;
}

export function applySpecialPlayerLoadout(world) {
  if (!world || world.labyrinthMode) {
    return false;
  }

  const specialPlayerId =
    getSpecialPlayerId(world.playerName);

  switch (specialPlayerId) {
    case SPECIAL_PLAYER_IDS.ROBBIE:
      return applyRobbienatorLoadout(world);
    case SPECIAL_PLAYER_IDS.ASHER:
      return applyAsherLoadout(world);
    case SPECIAL_PLAYER_IDS.JOJO:
      return applyJojoLoadout(world);
    case SPECIAL_PLAYER_IDS.FEIVEL:
      return applyFeivelLoadout(world);
    case SPECIAL_PLAYER_IDS.DAVID_CH:
      return applyDavidChLoadout(world);
    default:
      return false;
  }
}
