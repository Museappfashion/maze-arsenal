// src/config/presentations-enhanced.js
import * as core from "./presentations.js?core";
import {
  hasRobbienatorLoadout,
  isRobbienatorWeapon,
  ROBBIENATOR_LABEL,
} from "./robbienator.js";

export * from "./presentations.js?core";

export function getWeaponPresentation(world, weaponKey) {
  if (isRobbienatorWeapon(world, weaponKey)) {
    return {
      label: ROBBIENATOR_LABEL,
      description:
        "A precision banana of questionable engineering and excellent potassium.",
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
