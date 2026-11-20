import { getCosmeticPerkDefinition, getCosmeticUpgradeLevel } from "../config/cosmeticPerks.js";

const resolvedPerks = new WeakMap();

export function getCosmeticPerk(world) {
  const player = world?.player;
  if (world?.labyrinthMode || !player) return null;
  const skin = player.cosmetic, upgradeLevel = getCosmeticUpgradeLevel(player.cosmeticUpgradeLevel);
  let resolved = resolvedPerks.get(player);
  if (!resolved || resolved.skin !== skin || resolved.upgradeLevel !== upgradeLevel) {
    resolved = { skin, upgradeLevel, definition: getCosmeticPerkDefinition(skin, upgradeLevel) };
    resolvedPerks.set(player, resolved);
  }
  return resolved.definition;
}

function stateFor(world, perk) {
  const player = world.player;
  if (player.cosmeticPerkState?.skin !== player.cosmetic || player.cosmeticPerkState?.upgradeLevel !== perk.upgradeLevel) {
    player.cosmeticPerkState = { skin: player.cosmetic, upgradeLevel: perk.upgradeLevel, readyAt: 0, activeUntil: 0, hits: 0 };
  }
  return player.cosmeticPerkState;
}

function flash(world, actor, color) {
  if (!world.effects) world.effects = [];
  world.effects.push({ kind: "ring", x: actor.x, y: actor.y, color, age: 0, size: .12, endSize: .5, ttl: .3, drag: 1, vx: 0, vy: 0 });
}

export function cosmeticPickupAmount(world, type, amount) {
  const gain = Math.max(0, Number(amount) || 0);
  const perk = getCosmeticPerk(world);
  if (!perk) return gain;
  return gain * ((type === "ammo" && world.player.cosmetic === "turkey") || (type === "medkit" && world.player.cosmetic === "alien") ? 1 + perk.pickupBonus : 1);
}

export function cosmeticSpeedMultiplier(world) {
  const perk = getCosmeticPerk(world);
  if (!perk || world.player.cosmetic !== "shadowWisp") return 1;
  return stateFor(world, perk).activeUntil > world.time ? 1 + perk.speedBonus : 1;
}

export function cosmeticIncomingDamage(world, damage) {
  const perk = getCosmeticPerk(world);
  if (!perk || world.player.cosmetic !== "crystalGuardian" || damage <= 0) return damage;
  const state = stateFor(world, perk);
  if (world.time < state.readyAt) return damage;
  state.readyAt = world.time + perk.cooldown;
  flash(world, world.player, "#a5f3fc");
  return Math.max(0, damage - perk.absorb);
}

export function cosmeticDamageTaken(world, damage) {
  const perk = getCosmeticPerk(world);
  if (!perk || world.player.cosmetic !== "shadowWisp" || damage <= 0 || world.player.hp <= 0) return;
  const state = stateFor(world, perk);
  if (world.time < state.readyAt) return;
  state.readyAt = world.time + perk.cooldown;
  state.activeUntil = world.time + perk.duration;
  flash(world, world.player, "#c4b5fd");
}

// Called once for each real melee/projectile hit, before changing enemy health.
export function cosmeticWeaponHitBonus(world, enemy) {
  const perk = getCosmeticPerk(world);
  if (!perk || world.player.cosmetic !== "emberSpirit" || !(enemy.hp > 0)) return 0;
  const state = stateFor(world, perk);
  state.hits = (state.hits + 1) % perk.hitsRequired;
  if (state.hits !== 0) return 0;
  flash(world, enemy, "#fb923c");
  return perk.extraDamage;
}

export function cosmeticPerkStatus(world) {
  const perk = getCosmeticPerk(world);
  if (!perk) return "";
  const state = stateFor(world, perk);
  if (world.player.cosmetic === "emberSpirit") return `${perk.label} · ${state.hits}/${perk.hitsRequired}`;
  if (state.activeUntil > world.time) return `${perk.label} · ${(state.activeUntil - world.time).toFixed(1)}s`;
  if (state.readyAt > world.time) return `${perk.label} · ${Math.ceil(state.readyAt - world.time)}s recharge`;
  return `${perk.label} · ready`;
}
