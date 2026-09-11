// src/config/presentations-enhanced.js
import * as core from "./presentations.js?core";
import {
  ROBBIENATOR_LABEL,
  hasDavidChLoadout,
  hasRobbienatorLoadout,
  isRobbienatorWeapon,
} from "./specialPlayers.js";
import {
  BLACK_SWORD_KEY,
  PORTAL_GUN_KEY,
  SWORD_GUN_KEY,
} from "./weapons-enhanced.js";

export * from "./presentations.js?core";

export function getWeaponPresentation(world, weaponKey) {
  if (
    hasRobbienatorLoadout(world) &&
    weaponKey === "machete"
  ) {
    return {
      label: "Plunger",
      description:
        "A smiley plunger with the machete's normal combat stats.",
    };
  }

  if (isRobbienatorWeapon(world, weaponKey)) {
    return {
      label: ROBBIENATOR_LABEL,
      description:
        "A precision banana with a smile and deeply questionable engineering.",
    };
  }

  if (weaponKey === SWORD_GUN_KEY) {
    return {
      label: "Sword Gun",
      description:
        "Fires wall-stopped blades that pierce every enemy in their path.",
    };
  }

  if (weaponKey === BLACK_SWORD_KEY) {
    return {
      label: "Black Sword",
      description:
        "A fast, long-reaching obsidian blade with heavy melee damage.",
    };
  }

  if (weaponKey === PORTAL_GUN_KEY) {
    return {
      label: "Portal Gun",
      description:
        "Alternates blue/orange shots. Hit walls to place a linked teleport pair.",
    };
  }

  return core.getWeaponPresentation(
    world,
    weaponKey,
  );
}

export function getWeaponLabel(world, weaponKey) {
  return getWeaponPresentation(
    world,
    weaponKey,
  ).label;
}

export function getAmmoLabel(world) {
  if (
    hasDavidChLoadout(world) &&
    world?.player?.weapon === PORTAL_GUN_KEY
  ) {
    return "Portal Charge";
  }

  if (hasRobbienatorLoadout(world)) {
    return "Ammo";
  }

  return core.getAmmoLabel(world);
}

export function getAmmoPickupLabel(world) {
  if (hasRobbienatorLoadout(world)) {
    return "Ammo";
  }

  return core.getAmmoPickupLabel(world);
}

export function getAmmoMessageLabel(world) {
  if (hasRobbienatorLoadout(world)) {
    return "ammo";
  }

  return core.getAmmoMessageLabel(world);
}
