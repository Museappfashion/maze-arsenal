// src/config/presentations.js
import { LEVEL_THEMES } from "./constants.js";
import { POWER_UPS } from "./powerUps.js";
import { WEAPONS } from "./weapons.js";

export const LEVEL_WEAPON_PRESENTATIONS = {
  space: {
    fists: { label: "Gravity Grips", description: "Magnetic combat gloves that turn each punch into a crushing gravity burst." },
    crowbar: { label: "Hullbreaker", description: "A meteor-alloy impact tool made to split armored ship plating." },
    machete: { label: "Solaris Edge", description: "A broad ion blade burning with a miniature solar flare." },
    pistol: { label: "Starlight", description: "A compact sidearm that fires clean bolts of concentrated light." },
    revolver: { label: "Supernova Six", description: "Six heavy chambers built to strike with explosive force." },
    smg: { label: "Pulsar", description: "A rapid energy emitter that releases a relentless stream of pulses." },
    shotgun: { label: "Cometfall", description: "A close-range blaster that scatters a storm of burning fragments." },
    rifle: { label: "Orion's Lance", description: "A balanced long arm that drives bright shots through the dark." },
    dmr: { label: "Event Horizon", description: "A precision weapon whose scoped shots seem impossible to escape." },
  },
  jungle: {
    fists: { label: "Jaguar Claws", description: "Reinforced trail gloves made for fast, close strikes." },
    crowbar: { label: "Temple Crusher", description: "A stone-headed relic strong enough to crack ancient masonry." },
    machete: { label: "Emerald Fang", description: "A sweeping green blade made to cut through vines and enemies alike." },
    pistol: { label: "Pathfinder's Sting", description: "A mud-proof sidearm trusted by generations of expedition leaders." },
    revolver: { label: "Jaguar's Roar", description: "A heavy jungle sidearm whose thunderous shots roar through the canopy." },
    smg: { label: "Hornet Swarm", description: "A compact automatic weapon with a furious, stinging burst." },
    shotgun: { label: "Monsoon", description: "A close-range weapon that floods the path with a wide blast." },
    rifle: { label: "Canopy Spear", description: "A dependable long arm for threats hiding beyond the leaves." },
    dmr: { label: "Eagle Eye", description: "A relic scope and precise barrel built for impossible shots through the canopy." },
  },
  medieval: {
    fists: { label: "Oathbound", description: "Consecrated steel gauntlets carried by the keep's sworn champion." },
    crowbar: { label: "King's Justice", description: "An iron-banded war club made to crush armor and rebellion." },
    machete: { label: "Ashen Fang", description: "A fast single-edged sword blackened in the keep's final siege." },
    pistol: { label: "Squire's Shortbow", description: "A compact bow with a quick draw for close and mid-range fights." },
    revolver: { label: "Knight's Warbow", description: "A heavy bow that trades draw speed for punishing single-arrow hits." },
    smg: { label: "Swiftbow", description: "A light recurve bow built for rapid volleys of arrows." },
    shotgun: { label: "Volley Bow", description: "A rune-split bow that releases a fan of arrows at close range." },
    rifle: { label: "Watchman's Longbow", description: "A balanced longbow made for accurate shots along the castle walls." },
    dmr: { label: "Crownseeker Greatbow", description: "The royal marksman's greatbow, made for one decisive distant arrow." },
  },
};

export function getTheme(world) {
  return LEVEL_THEMES[world.level.themeKey] ?? LEVEL_THEMES.space;
}

export function getWeaponPresentation(world, weaponKey) {
  return (
    LEVEL_WEAPON_PRESENTATIONS[world.level.themeKey]?.[weaponKey] ?? {
      label: WEAPONS[weaponKey]?.label ?? "Weapon",
      description: "",
    }
  );
}

export function getWeaponLabel(world, weaponKey) {
  return getWeaponPresentation(world, weaponKey).label;
}

export function isMedievalTheme(world) {
  return world?.level?.themeKey === "medieval";
}

export function getAmmoLabel(world) {
  return isMedievalTheme(world) ? "Arrows" : "Ammo";
}

export function getAmmoPickupLabel(world) {
  return isMedievalTheme(world) ? "Arrow Bundle" : "Ammo";
}

export function getAmmoMessageLabel(world) {
  return isMedievalTheme(world) ? "arrows" : "ammo";
}

export function getPowerUpPresentation(world, key) {
  const base = POWER_UPS[key];

  if (!base || !isMedievalTheme(world)) {
    return base;
  }

  const medievalOverrides = {
    overcharge: { label: "Endless Quiver", short: "Free arrows +10% dmg" },
    pierce: { label: "Piercing Arrows", short: "Pierce 5 +12% dmg" },
    scattershot: { label: "Volley", short: "Wide x1.7 total dmg" },
    precision: { label: "True Fletching", short: "Aim +18% damage" },
    ammoSurge: { label: "Quiver Surge", short: "+10 arrows/s" },
    demolition: { label: "Siege Arrows", short: "10 wall breaks" },
  };

  return {
    ...base,
    ...(medievalOverrides[key] ?? {}),
  };
}
