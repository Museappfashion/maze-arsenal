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

const SPECIAL_WEAPON_OWNER_NAMES = Object.freeze({
  [SWORD_GUN_KEY]: "asher",
  [BLACK_SWORD_KEY]: "feivel",
  [PORTAL_GUN_KEY]: "david ch",
});

const ALL_WEAPON_ORDER = Object.freeze([
  ...CORE_WEAPON_ORDER,
  SWORD_GUN_KEY,
  BLACK_SWORD_KEY,
  PORTAL_GUN_KEY,
]);

const ALL_WEAPON_HOTKEYS = Object.freeze({
  ...Object.fromEntries(
    CORE_WEAPON_ORDER
      .slice(0, 9)
      .map((weaponKey, index) => [
        String(index + 1),
        weaponKey,
      ]),
  ),
  "0": SWORD_GUN_KEY,
  "-": BLACK_SWORD_KEY,
  "=": PORTAL_GUN_KEY,
});

function normalizePlayerName(playerName) {
  return String(playerName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getCurrentWorld() {
  return globalThis.__mistMazeWorld ?? null;
}

function canCurrentPlayerSeeWeapon(weaponKey) {
  const ownerName =
    SPECIAL_WEAPON_OWNER_NAMES[weaponKey];

  if (!ownerName) {
    return true;
  }

  const world = getCurrentWorld();

  if (!world) {
    return false;
  }

  if (world.player?.ownedWeapons?.[weaponKey]) {
    return true;
  }

  return (
    normalizePlayerName(world.playerName) ===
    ownerName
  );
}

function getVisibleWeaponOrder() {
  return ALL_WEAPON_ORDER.filter(
    canCurrentPlayerSeeWeapon,
  );
}

export const WEAPON_ORDER = new Proxy(
  [...ALL_WEAPON_ORDER],
  {
    get(_target, property) {
      const visibleOrder =
        getVisibleWeaponOrder();

      if (property === Symbol.iterator) {
        return visibleOrder[
          Symbol.iterator
        ].bind(visibleOrder);
      }

      if (property === "length") {
        return visibleOrder.length;
      }

      if (
        typeof property === "string" &&
        /^\d+$/.test(property)
      ) {
        return visibleOrder[Number(property)];
      }

      const value = Reflect.get(
        visibleOrder,
        property,
        visibleOrder,
      );

      return typeof value === "function"
        ? value.bind(visibleOrder)
        : value;
    },
  },
);

export const WEAPON_HOTKEY_MAP = new Proxy(
  { ...ALL_WEAPON_HOTKEYS },
  {
    get(target, property, receiver) {
      const weaponKey = Reflect.get(
        target,
        property,
        receiver,
      );

      if (
        typeof weaponKey !== "string" ||
        canCurrentPlayerSeeWeapon(weaponKey)
      ) {
        return weaponKey;
      }

      return undefined;
    },

    has(target, property) {
      const weaponKey = target[property];

      return (
        typeof weaponKey === "string" &&
        canCurrentPlayerSeeWeapon(weaponKey)
      );
    },

    ownKeys(target) {
      return Reflect.ownKeys(target).filter(
        (property) => {
          if (typeof property !== "string") {
            return true;
          }

          const weaponKey = target[property];

          return (
            typeof weaponKey !== "string" ||
            canCurrentPlayerSeeWeapon(
              weaponKey,
            )
          );
        },
      );
    },

    getOwnPropertyDescriptor(
      target,
      property,
    ) {
      const weaponKey = target[property];

      if (
        typeof weaponKey === "string" &&
        !canCurrentPlayerSeeWeapon(
          weaponKey,
        )
      ) {
        return undefined;
      }

      return Object.getOwnPropertyDescriptor(
        target,
        property,
      );
    },
  },
);

export const WEAPON_HOTKEY_LABEL = "1-9";

export { WEAPON_SPAWN_PLAN };
