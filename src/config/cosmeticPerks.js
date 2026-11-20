export const COSMETIC_PERKS = Object.freeze({
  turkey: Object.freeze({ label: "Lucky Peck", description: "Ammo pickups give 10% more ammo." }),
  alien: Object.freeze({ label: "Alien Recovery", description: "Medkits restore 10% more health." }),
  shadowWisp: Object.freeze({ label: "Slip Away", description: "Taking damage gives 15% extra speed for 2 seconds. Recharges every 20 seconds." }),
  emberSpirit: Object.freeze({ label: "Ember Strike", description: "Every tenth successful weapon hit deals 3 extra fire damage." }),
  crystalGuardian: Object.freeze({ label: "Crystal Shell", description: "Absorb up to 5 damage from one hit. Recharges every 25 seconds." }),
});

export const COSMETIC_UPGRADE_PRICE = 10000;
export const MAX_COSMETIC_UPGRADES = 3;

export function getCosmeticUpgradeLevel(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(MAX_COSMETIC_UPGRADES, Math.floor(value))) : 0;
}

const PICKUP_BONUSES = [.10, .15, .20, .25];
const SPEED_BONUSES = [.15, .20, .25, .30];
const WISP_DURATIONS = [2, 2.5, 3, 3.5];
const WISP_COOLDOWNS = [20, 18, 16, 14];
const EMBER_DAMAGE = [3, 5, 7, 10];
const EMBER_HITS = [10, 9, 8, 7];
const EMBER_ORDINALS = ["tenth", "ninth", "eighth", "seventh"];
const CRYSTAL_ABSORB = [5, 7, 9, 12];
const CRYSTAL_COOLDOWNS = [25, 23, 21, 18];

const PERK_DEFINITIONS = Object.freeze(Object.fromEntries(Object.entries(COSMETIC_PERKS).map(([skin, base]) => [skin, Object.freeze(Array.from({ length: MAX_COSMETIC_UPGRADES + 1 }, (_, upgradeLevel) => {
  let stats, description;
  if (skin === "turkey" || skin === "alien") {
    stats = { pickupBonus: PICKUP_BONUSES[upgradeLevel] };
    description = skin === "turkey" ? `Ammo pickups give ${stats.pickupBonus * 100}% more ammo.` : `Medkits restore ${stats.pickupBonus * 100}% more health.`;
  } else if (skin === "shadowWisp") {
    stats = { speedBonus: SPEED_BONUSES[upgradeLevel], duration: WISP_DURATIONS[upgradeLevel], cooldown: WISP_COOLDOWNS[upgradeLevel] };
    description = `Taking damage gives ${stats.speedBonus * 100}% extra speed for ${stats.duration} seconds. Recharges every ${stats.cooldown} seconds.`;
  } else if (skin === "emberSpirit") {
    stats = { extraDamage: EMBER_DAMAGE[upgradeLevel], hitsRequired: EMBER_HITS[upgradeLevel] };
    description = `Every ${EMBER_ORDINALS[upgradeLevel]} successful weapon hit deals ${stats.extraDamage} extra fire damage.`;
  } else {
    stats = { absorb: CRYSTAL_ABSORB[upgradeLevel], cooldown: CRYSTAL_COOLDOWNS[upgradeLevel] };
    description = `Absorb up to ${stats.absorb} damage from one hit. Recharges every ${stats.cooldown} seconds.`;
  }
  return Object.freeze({ ...base, description: upgradeLevel ? description : base.description, upgradeLevel, ...stats });
}))])));

export function getCosmeticPerkDefinition(skin, level = 0) {
  return typeof skin === "string" && Object.hasOwn(PERK_DEFINITIONS, skin) ? PERK_DEFINITIONS[skin][getCosmeticUpgradeLevel(level)] : null;
}
