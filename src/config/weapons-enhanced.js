// src/config/weapons-enhanced.js
import {
  WEAPONS as CORE_WEAPONS,
  WEAPON_ORDER as CORE_WEAPON_ORDER,
  WEAPON_SPAWN_PLAN,
} from "./weapons.js?core";

export * from "./weapons.js?core";

export const SWORD_GUN_KEY = "swordGun";
export const BLACK_SWORD_KEY = "blackSword";
export const PORTAL_GUN_KEY = "portalGun";

export const WEAPONS = {
  ...CORE_WEAPONS,
  [SWORD_GUN_KEY]: {
    label: "Sword Gun",
    type: "ranged",
    damage: 45,
    cooldown: 0.55,
    bulletSpeed: 14,
    spread: 0,
    range: 28,
    ammoCost: 1,
    pellets: 1,
  },
  [BLACK_SWORD_KEY]: {
    label: "Black Sword",
    type: "melee",
    damage: 58,
    cooldown: 0.24,
    reach: 2.25,
    arc: 1.65,
  },
  [PORTAL_GUN_KEY]: {
    label: "Portal Gun",
    type: "ranged",
    damage: 30,
    cooldown: 0.2,
    bulletSpeed: 18.5,
    spread: 0,
    range: 18,
    ammoCost: 1,
    pellets: 1,
  },
};

export const WEAPON_ORDER = [
  ...CORE_WEAPON_ORDER,
  SWORD_GUN_KEY,
  BLACK_SWORD_KEY,
  PORTAL_GUN_KEY,
];

export const WEAPON_HOTKEY_MAP = {
  ...Object.fromEntries(
    CORE_WEAPON_ORDER.slice(0, 9).map((weaponKey, index) => [
      String(index + 1),
      weaponKey,
    ]),
  ),
  "0": SWORD_GUN_KEY,
  "-": BLACK_SWORD_KEY,
  "=": PORTAL_GUN_KEY,
};

export const WEAPON_HOTKEY_LABEL =
  "1-9 · 0 Sword Gun · - Black Sword · = Portal Gun";

export { WEAPON_SPAWN_PLAN };
