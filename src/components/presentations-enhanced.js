// src/config/presentations-enhanced.js
import * as core from "./presentations.js?core";
import {
  hasRobbienatorLoadout,
  isRobbienatorWeapon,
  ROBBIENATOR_LABEL,
} from "./robbienator.js";
import { SWORD_GUN_KEY } from "./weapons-enhanced.js";

export * from "./presentations.js?core";

export function getWeaponPresentation(world, weaponKey) {
  if (hasRobbienatorLoadout(world) && weaponKey === "machete") {
    return {
      label: "Plunger",
      description:
        "Robbie's smiley plunger. It keeps the machete's normal combat stats.",
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

  return core.getWeaponPresentation(world, weaponKey);
}

export function getWeaponLabel(world, weaponKey) {
  return getWeaponPresentation(world, weaponKey).label;
}

export function getAmmoLabel(world) {
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
