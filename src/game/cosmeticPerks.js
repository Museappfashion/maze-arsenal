import { COSMETIC_PERKS } from "../config/cosmeticPerks.js";

export function getCosmeticPerk(world) {
  return !world?.labyrinthMode ? COSMETIC_PERKS[world?.player?.cosmetic] ?? null : null;
}

function stateFor(world) {
  const player = world.player;
  if (player.cosmeticPerkState?.skin !== player.cosmetic) {
    player.cosmeticPerkState = { skin: player.cosmetic, readyAt: 0, activeUntil: 0, hits: 0 };
  }
  return player.cosmeticPerkState;
}

function flash(world, actor, color) {
  if (!world.effects) world.effects = [];
  world.effects.push({ kind: "ring", x: actor.x, y: actor.y, color, age: 0, size: .12, endSize: .5, ttl: .3, drag: 1, vx: 0, vy: 0 });
}

export function cosmeticPickupAmount(world, type, amount) {
  const gain = Math.max(0, Number(amount) || 0);
  if (!getCosmeticPerk(world)) return gain;
  return gain * ((type === "ammo" && world.player.cosmetic === "turkey") || (type === "medkit" && world.player.cosmetic === "alien") ? 1.1 : 1);
}

export function cosmeticSpeedMultiplier(world) {
  if (!getCosmeticPerk(world) || world.player.cosmetic !== "shadowWisp") return 1;
  return stateFor(world).activeUntil > world.time ? 1.15 : 1;
}

export function cosmeticIncomingDamage(world, damage) {
  if (!getCosmeticPerk(world) || world.player.cosmetic !== "crystalGuardian" || damage <= 0) return damage;
  const state = stateFor(world);
  if (world.time < state.readyAt) return damage;
  state.readyAt = world.time + 25;
  flash(world, world.player, "#a5f3fc");
  return Math.max(0, damage - 5);
}

export function cosmeticDamageTaken(world, damage) {
  if (!getCosmeticPerk(world) || world.player.cosmetic !== "shadowWisp" || damage <= 0 || world.player.hp <= 0) return;
  const state = stateFor(world);
  if (world.time < state.readyAt) return;
  state.readyAt = world.time + 20;
  state.activeUntil = world.time + 2;
  flash(world, world.player, "#c4b5fd");
}

// Called once for each real melee/projectile hit, before changing enemy health.
export function cosmeticWeaponHitBonus(world, enemy) {
  if (!getCosmeticPerk(world) || world.player.cosmetic !== "emberSpirit" || !(enemy.hp > 0)) return 0;
  const state = stateFor(world);
  state.hits = (state.hits + 1) % 10;
  if (state.hits !== 0) return 0;
  flash(world, enemy, "#fb923c");
  return 3;
}

export function cosmeticPerkStatus(world) {
  const perk = getCosmeticPerk(world);
  if (!perk) return "";
  const state = stateFor(world);
  if (world.player.cosmetic === "emberSpirit") return `${perk.label} · ${state.hits}/10`;
  if (state.activeUntil > world.time) return `${perk.label} · ${(state.activeUntil - world.time).toFixed(1)}s`;
  if (state.readyAt > world.time) return `${perk.label} · ${Math.ceil(state.readyAt - world.time)}s recharge`;
  return `${perk.label} · ready`;
}
