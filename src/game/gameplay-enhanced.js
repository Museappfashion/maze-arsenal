// src/game/gameplay-enhanced.js
import { MAX_AMMO } from "../config/ammo.js";
import { ENEMY_TYPES } from "../config/enemies.js";
import {
  VIEW_3D_FOV,
  VIEW_3D_MAX_DISTANCE,
} from "../config/constants.js";
import {
  isLegendaryPowerUpActive,
} from "../config/legendaryPowerUps.js";
import { POWER_UPS } from "../config/powerUps.js";
import {
  getPowerUpPresentation,
} from "../config/presentations.js";
import {
  SWORD_GUN_KEY,
  WEAPONS,
} from "../config/weapons.js";
import {
  GLOBAL_LEADERBOARD_ENABLED,
  startGlobalLeaderboardRun,
} from "../services/leaderboard.js";
import {
  angleDelta,
  indexOfTile,
} from "../utils/math.js";
import { hasLineOfSight } from "./maze.js";
import * as core from "./gameplay.js?core";

export * from "./gameplay.js?core";

const LEGENDARY_HASTE_CORE_CORRECTION = 14 / 1.75;
const RAPID_FIRE_AMMO_RATE = 0.45;
const LEGENDARY_REGEN_POOL = 151;
const ENEMY_RAMP_PATH_DISTANCE = 30;
const INFINITE_PIERCE = 1_000_000_000;
const INFINITE_TTL = 3600;

function exposeWorld(world) {
  globalThis.__mistMazeWorld = world;
}

function beginLeaderboardRun(world) {
  if (
    !GLOBAL_LEADERBOARD_ENABLED ||
    world.__leaderboardRunStarted ||
    world.labyrinthMode ||
    world.leaderboardEligible === false ||
    world.level?.leaderboard === false
  ) {
    return;
  }

  world.__leaderboardRunStarted = true;
  world.__leaderboardRunPromise =
    startGlobalLeaderboardRun(
      world.level.key,
      world.runMode,
    ).catch((error) => {
      console.warn("Leaderboard run start failed:", error);
      return null;
    });
}

function isLegendary(world, key) {
  return isLegendaryPowerUpActive(world, key);
}

function healUncapped(world, amount) {
  world.player.hp =
    Math.max(0, Number(world.player.hp) || 0) +
    Math.max(0, Number(amount) || 0);
}

function giveAmmoUncapped(world, amount) {
  world.player.ammo =
    Math.max(0, Number(world.player.ammo) || 0) +
    Math.max(0, Number(amount) || 0);
}

function actualDamage(beforeHp, afterHp) {
  return Math.max(
    0,
    Math.max(0, beforeHp) - Math.max(0, afterHp),
  );
}

function totalEnemyDamage(beforeHpById, enemies) {
  let total = 0;

  for (const enemy of enemies) {
    const before = beforeHpById.get(enemy.id);

    if (!Number.isFinite(before)) {
      continue;
    }

    total += actualDamage(before, enemy.hp);
  }

  return total;
}

function countEnemyHits(beforeHpById, enemies) {
  let hits = 0;

  for (const enemy of enemies) {
    const before = beforeHpById.get(enemy.id);

    if (
      Number.isFinite(before) &&
      enemy.hp < before
    ) {
      hits += 1;
    }
  }

  return hits;
}

function applyLegendaryHitRewards(
  world,
  damage,
  hitCount,
) {
  if (isLegendary(world, "vampirism") && damage > 0) {
    world.player.hp = Math.min(
      world.player.maxHp,
      world.player.hp + damage,
    );
  }

  if (isLegendary(world, "bounty") && hitCount > 0) {
    healUncapped(world, 7 * hitCount);
    giveAmmoUncapped(world, 10 * hitCount);
  }
}

function temporarilyDisableState(world, key) {
  const state = world.player.powerUps[key];

  if (!state || !state.legendary) {
    return null;
  }

  const endsAt = state.endsAt;
  state.endsAt = -Infinity;

  return () => {
    state.endsAt = endsAt;
  };
}

function visiblePickupIn3D(world, pickup) {
  const dx = pickup.x - world.player.x;
  const dy = pickup.y - world.player.y;
  const distance = Math.hypot(dx, dy);

  if (distance > VIEW_3D_MAX_DISTANCE) {
    return false;
  }

  const angle = Math.atan2(dy, dx);

  if (
    Math.abs(angleDelta(angle, world.player.facing)) >
    VIEW_3D_FOV / 2
  ) {
    return false;
  }

  return hasLineOfSight(
    world,
    world.player.x,
    world.player.y,
    pickup.x,
    pickup.y,
  );
}

function pickupIsVisible(world, pickup) {
  if (world.viewMode === "3d") {
    return visiblePickupIn3D(world, pickup);
  }

  return (
    core.visibleStrengthAt(
      world,
      Math.floor(pickup.x),
      Math.floor(pickup.y),
    ) > 0.24
  );
}

function pullLegendaryMagnetPickups(world) {
  if (!isLegendary(world, "magnet")) {
    return;
  }

  const slotsFull =
    world.player.powerUpSlots.every(Boolean);

  for (const pickup of world.pickups ?? []) {
    if (
      pickup.type === "weapon" ||
      !pickupIsVisible(world, pickup)
    ) {
      continue;
    }

    if (
      pickup.type === "powerup" &&
      slotsFull
    ) {
      continue;
    }

    pickup.x = world.player.x;
    pickup.y = world.player.y;
  }
}

function preserveLegendaryPickupMetadata(
  world,
  beforePickups,
  beforeSlots,
) {
  const remaining = new Set(world.pickups);
  const collectedLegendary = beforePickups.filter(
    (pickup) =>
      pickup.type === "powerup" &&
      pickup.legendary &&
      !remaining.has(pickup),
  );

  if (!collectedLegendary.length) {
    return;
  }

  const flags =
    world.player.legendaryPowerUpSlots ??
    [false, false, false];

  world.player.legendaryPowerUpSlots = flags;

  for (let index = 0; index < 3; index += 1) {
    if (
      beforeSlots[index] === null &&
      world.player.powerUpSlots[index]
    ) {
      const key = world.player.powerUpSlots[index];
      const matchIndex = collectedLegendary.findIndex(
        (pickup) => pickup.powerUp === key,
      );

      if (matchIndex >= 0) {
        flags[index] = true;
        collectedLegendary.splice(matchIndex, 1);
      }
    }
  }
}

export function getStoredPowerUps(world) {
  const hotkeys = ["Z", "X", "C"];
  const flags =
    world.player.legendaryPowerUpSlots ??
    [false, false, false];

  return world.player.powerUpSlots.map((key, index) => {
    if (!key) {
      return null;
    }

    const presentation =
      getPowerUpPresentation(world, key);

    return {
      key,
      slotIndex: index,
      hotkey: hotkeys[index] ?? "?",
      label: flags[index]
        ? `★ ${presentation.label}`
        : presentation.label,
      short: presentation.short,
      color: POWER_UPS[key].color,
      legendary: Boolean(flags[index]),
    };
  });
}

export function getActivePowerUps(world) {
  return Object.entries(world.player.powerUps)
    .filter(([, state]) => state.endsAt > world.time)
    .sort((a, b) => a[1].endsAt - b[1].endsAt)
    .map(([key, state]) => {
      const presentation =
        getPowerUpPresentation(world, key);

      return {
        key,
        label: state.legendary
          ? `★ ${presentation.label}`
          : presentation.label,
        short: presentation.short,
        color: POWER_UPS[key].color,
        remaining: Math.max(0, state.endsAt - world.time),
        legendary: Boolean(state.legendary),
        charges: state.charges,
        healingRemaining: state.legendaryHealRemaining,
      };
    });
}

export function activateStoredPowerUp(world, slotIndex) {
  const key = world.player.powerUpSlots[slotIndex];

  if (!key) {
    core.setMessage(
      world,
      `Power-up slot ${slotIndex + 1} is empty`,
      0.8,
    );
    return false;
  }

  const legendary = Boolean(
    world.player.legendaryPowerUpSlots?.[slotIndex],
  );
  const beforeHp = world.player.hp;

  world.player.powerUpSlots[slotIndex] = null;

  if (world.player.legendaryPowerUpSlots) {
    world.player.legendaryPowerUpSlots[slotIndex] = false;
  }

  core.activatePowerUp(world, key);

  if (!legendary) {
    return true;
  }

  const state = world.player.powerUps[key];

  if (!state) {
    return true;
  }

  state.legendary = true;

  if (key === "breaker") {
    state.charges = 12;
    state.endsAt = Infinity;
  }

  if (key === "demolition") {
    state.charges = 10;
    state.endsAt = Infinity;
  }

  if (key === "juggernaut") {
    world.player.maxHp = 220;
    world.player.hp = Math.min(
      220,
      Math.max(world.player.hp, beforeHp),
    );
  }

  if (key === "regen") {
    const activationHeal =
      Math.max(0, world.player.hp - beforeHp);

    state.endsAt = Infinity;
    state.legendaryHealRemaining = Math.max(
      0,
      LEGENDARY_REGEN_POOL - activationHeal,
    );
  }

  if (key === "overcharge") {
    world.player.ammo = Math.max(
      300,
      world.player.ammo,
    );
  }

  if (key === "ammoSurge") {
    world.player.ammo = Math.max(
      MAX_AMMO,
      world.player.ammo,
    );
  }

  core.setMessage(
    world,
    `★ LEGENDARY ${presentationLabel(world, key)}!`,
    1.8,
  );

  return true;
}

function presentationLabel(world, key) {
  return getPowerUpPresentation(world, key).label;
}

export function updatePowerUps(world, dt) {
  const legendaryRegen =
    isLegendary(world, "regen");
  const legendaryAmmoSurge =
    isLegendary(world, "ammoSurge");
  const beforeHp = world.player.hp;
  const beforeAmmo = world.player.ammo;

  core.updatePowerUps(world, dt);

  if (legendaryAmmoSurge) {
    world.player.ammo = Math.max(
      world.player.ammo,
      beforeAmmo + 10 * dt,
    );
  }

  if (legendaryRegen) {
    const state = world.player.powerUps.regen;

    if (state?.legendary) {
      const actualHeal =
        Math.max(0, world.player.hp - beforeHp);
      const remainingBefore =
        Math.max(
          0,
          Number(state.legendaryHealRemaining) || 0,
        );
      const acceptedHeal = Math.min(
        remainingBefore,
        actualHeal,
      );

      if (actualHeal > acceptedHeal) {
        world.player.hp -= actualHeal - acceptedHeal;
      }

      state.legendaryHealRemaining =
        remainingBefore - acceptedHeal;

      if (state.legendaryHealRemaining <= 0) {
        core.expirePowerUp(world, "regen");
      }
    }
  }
}

export function updateVisionCache(world) {
  core.updateVisionCache(world);

  if (isLegendary(world, "sonar")) {
    world.vision.sightBonus = 9999;
  }
}

export function updatePickups(world, dt) {
  const legendaryMagnet =
    isLegendary(world, "magnet");

  pullLegendaryMagnetPickups(world);

  const beforePickups = [...world.pickups];
  const beforeSlots = [...world.player.powerUpSlots];
  const restoreMagnet = legendaryMagnet
    ? temporarilyDisableState(world, "magnet")
    : null;

  try {
    core.updatePickups(world, dt);
  } finally {
    restoreMagnet?.();
  }

  preserveLegendaryPickupMetadata(
    world,
    beforePickups,
    beforeSlots,
  );
}

export function placeEnemies(world, distances, used) {
  core.placeEnemies(world, distances, used);

  if (world.level?.key !== "level0") {
    return;
  }

  let keptTurret = false;

  world.enemies = world.enemies.filter((enemy) => {
    if (enemy.kind !== "turret") {
      return true;
    }

    if (!keptTurret) {
      keptTurret = true;
      return true;
    }

    return false;
  });
}

function stripAttackInput(keys) {
  return {
    ...keys,
    " ": false,
    Enter: false,
  };
}

function wantsAttack(world, keys) {
  return Boolean(
    keys[" "] ||
      keys.Enter ||
      world.pointer.down,
  );
}

export function updatePlayer(world, keys, dt) {
  beginLeaderboardRun(world);
  exposeWorld(world);

  const shouldAttack = wantsAttack(world, keys);
  const pointerDown = world.pointer.down;
  const safeKeys = stripAttackInput(keys);
  const legendaryHaste =
    isLegendary(world, "haste");
  const legendaryBerserk =
    isLegendary(world, "berserk");
  const speedCorrection =
    (legendaryHaste
      ? LEGENDARY_HASTE_CORE_CORRECTION
      : 1) *
    (legendaryBerserk ? 2 : 1);
  const originalSpeed = world.player.speed;
  const requestedDistance =
    originalSpeed *
    (legendaryHaste ? 14 : 1) *
    (legendaryBerserk ? 2 : 1) *
    dt;
  const steps = Math.max(
    1,
    Math.min(
      128,
      Math.ceil(requestedDistance / 0.12),
    ),
  );

  world.player.speed =
    originalSpeed * speedCorrection;
  world.pointer.down = false;

  try {
    for (let index = 0; index < steps; index += 1) {
      core.updatePlayer(
        world,
        safeKeys,
        dt / steps,
      );
    }
  } finally {
    world.player.speed = originalSpeed;
    world.pointer.down = pointerDown;
  }

  if (shouldAttack) {
    attack(world);
  }

  exposeWorld(world);
}

function modifyWeaponForLegendaryAttack(
  world,
  weapon,
) {
  const original = {
    damage: weapon.damage,
    bulletSpeed: weapon.bulletSpeed,
    spread: weapon.spread,
    reach: weapon.reach,
    arc: weapon.arc,
  };

  if (
    weapon.type === "ranged" &&
    isLegendary(world, "precision")
  ) {
    weapon.damage *= 1.5 / 1.18;
    weapon.bulletSpeed *= 1.5 / 1.25;
    weapon.spread = 0;
  }

  if (
    weapon.type === "melee" &&
    isLegendary(world, "longArms")
  ) {
    weapon.damage *= 2 / 1.35;
    weapon.reach =
      original.reach * 5 - 1.6;
    weapon.arc =
      Math.PI * 2 - 0.75;
  }

  return () => {
    Object.assign(weapon, original);
  };
}

function enhanceNewProjectiles(
  world,
  weapon,
  newProjectiles,
) {
  const legendaryPierce =
    isLegendary(world, "pierce");
  const legendaryScatter =
    isLegendary(world, "scattershot");
  const legendaryOvercharge =
    isLegendary(world, "overcharge");
  const legendaryPrecision =
    isLegendary(world, "precision");
  const basePellets =
    Math.max(1, weapon.pellets ?? 1);
  const pelletCount =
    core.getWeaponPellets(world, weapon);

  for (const projectile of newProjectiles) {
    if (legendaryPrecision) {
      const speed = Math.hypot(
        projectile.vx,
        projectile.vy,
      );

      projectile.vx =
        Math.cos(world.player.facing) * speed;
      projectile.vy =
        Math.sin(world.player.facing) * speed;
    }

    if (world.player.weapon === SWORD_GUN_KEY) {
      projectile.bladeProjectile = true;
      projectile.piercesLeft = INFINITE_PIERCE;
      projectile.color = "#e2e8f0";
    }

    if (legendaryOvercharge) {
      projectile.ttl = INFINITE_TTL;
    }

    if (legendaryPierce) {
      projectile.piercesLeft = INFINITE_PIERCE;
      projectile.damage = Math.max(
        1,
        Math.round(
          projectile.damage * (1.5 / 1.12),
        ),
      );
    }

    if (legendaryScatter) {
      projectile.damage = Math.max(
        1,
        Math.round(
          projectile.damage *
            (pelletCount / (basePellets * 1.7)),
        ),
      );
    }
  }
}

function finishLongArmsCircle(
  world,
  weapon,
  beforeHitAt,
  originalDamage,
  originalReach,
) {
  if (
    weapon.type !== "melee" ||
    !isLegendary(world, "longArms")
  ) {
    return;
  }

  const desiredDamage = Math.round(
    originalDamage *
      2 *
      core.getPlayerDamageMultiplier(world),
  );
  const reach = originalReach * 5;

  for (const enemy of world.enemies) {
    if (
      enemy.lastHitAt === world.time &&
      beforeHitAt.get(enemy.id) !== world.time
    ) {
      continue;
    }

    const distance = Math.hypot(
      enemy.x - world.player.x,
      enemy.y - world.player.y,
    );

    if (
      distance > reach + enemy.radius ||
      !hasLineOfSight(
        world,
        world.player.x,
        world.player.y,
        enemy.x,
        enemy.y,
      )
    ) {
      continue;
    }

    enemy.hp -= desiredDamage;
    enemy.awake = true;
    enemy.lastHitAt = world.time;
  }
}

export function attack(world) {
  if (
    world.labyrinthMode ||
    world.gameOver ||
    world.victory ||
    world.time < world.player.nextAttackAt
  ) {
    return;
  }

  const weapon = WEAPONS[world.player.weapon];

  if (!weapon) {
    return;
  }

  const beforeNextAttack = world.player.nextAttackAt;
  const beforeAmmo = world.player.ammo;
  const beforeProjectileCount = world.projectiles.length;
  const beforeEnemyHp = new Map(
    world.enemies.map((enemy) => [enemy.id, enemy.hp]),
  );
  const beforeHitAt = new Map(
    world.enemies.map((enemy) => [enemy.id, enemy.lastHitAt]),
  );
  const originalDamage = weapon.damage;
  const originalReach = weapon.reach;
  const restoreWeapon =
    modifyWeaponForLegendaryAttack(world, weapon);
  const restoreVampirism =
    temporarilyDisableState(world, "vampirism");

  const legendaryRapid =
    weapon.type === "ranged" &&
    isLegendary(world, "rapidFire") &&
    !core.hasPowerUp(world, "overcharge");
  const fractionalAmmoCost =
    (weapon.ammoCost ?? 0) * RAPID_FIRE_AMMO_RATE;

  if (
    legendaryRapid &&
    beforeAmmo >= fractionalAmmoCost &&
    beforeAmmo < (weapon.ammoCost ?? 0)
  ) {
    world.player.ammo = weapon.ammoCost;
  }

  try {
    core.attack(world);
  } finally {
    restoreWeapon();
    restoreVampirism?.();
  }

  const fired =
    weapon.type === "ranged"
      ? world.projectiles.length > beforeProjectileCount
      : world.player.nextAttackAt > beforeNextAttack;

  if (!fired) {
    world.player.ammo = beforeAmmo;
    return;
  }

  if (legendaryRapid) {
    world.player.ammo = Math.max(
      0,
      beforeAmmo - fractionalAmmoCost,
    );
  }

  const newProjectiles =
    world.projectiles.slice(beforeProjectileCount);

  enhanceNewProjectiles(
    world,
    weapon,
    newProjectiles,
  );

  finishLongArmsCircle(
    world,
    weapon,
    beforeHitAt,
    originalDamage,
    originalReach,
  );

  if (weapon.type === "melee") {
    const damage = totalEnemyDamage(
      beforeEnemyHp,
      world.enemies,
    );
    const hitCount = countEnemyHits(
      beforeEnemyHp,
      world.enemies,
    );

    applyLegendaryHitRewards(
      world,
      damage,
      hitCount,
    );
  }
}

function enemyFieldDistance(world, enemy) {
  return world.distanceField[
    indexOfTile(
      world.width,
      Math.floor(enemy.x),
      Math.floor(enemy.y),
    )
  ];
}

function applyPursuitRampGate(world) {
  const frost = isLegendary(world, "frost");

  for (const enemy of world.enemies) {
    if (!enemy.awake) {
      enemy.__legendaryRampEligible = false;
      continue;
    }

    const fieldDistance =
      enemyFieldDistance(world, enemy);
    const eligible =
      !frost &&
      fieldDistance >= 0 &&
      fieldDistance <= ENEMY_RAMP_PATH_DISTANCE;

    if (!eligible) {
      enemy.pursuitStartedAt = world.time;
      enemy.__legendaryRampEligible = false;
      continue;
    }

    if (!enemy.__legendaryRampEligible) {
      enemy.pursuitStartedAt = world.time;
      enemy.__legendaryRampEligible = true;
    }
  }
}

function reflectPhaseContactDamage(world) {
  if (!isLegendary(world, "phaseWalk")) {
    return;
  }

  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    const touching =
      Math.hypot(
        enemy.x - world.player.x,
        enemy.y - world.player.y,
      ) <=
      enemy.radius + world.player.radius + 0.06;
    const damage = enemy.contactDamage ?? 0;

    if (
      damage > 0 &&
      touching &&
      world.time >= enemy.nextContactAt
    ) {
      enemy.hp -= damage;
      enemy.nextContactAt =
        world.time + (enemy.contactCooldown ?? 0.8);
      enemy.pursuitStartedAt = world.time;
      enemy.__legendaryRampEligible = false;
    }
  }
}

function applyLegendaryShieldRefund(world, beforeHp) {
  if (!isLegendary(world, "shield")) {
    return;
  }

  const coreDamage =
    Math.max(0, beforeHp - world.player.hp);

  if (coreDamage <= 0) {
    return;
  }

  const estimatedRaw = coreDamage / 0.5;
  const desiredDamage = Math.max(
    1,
    Math.round(estimatedRaw * 0.1),
  );

  world.player.hp = Math.min(
    beforeHp,
    world.player.hp +
      Math.max(0, coreDamage - desiredDamage),
  );

  if (world.player.hp > 0 && world.gameOver) {
    world.gameOver = false;

    if (
      typeof world.message === "string" &&
      /game over|dead|killed/i.test(world.message)
    ) {
      world.message = "";
      world.messageTtl = 0;
    }

    if (Array.isArray(world.audioEvents)) {
      world.audioEvents = world.audioEvents.filter(
        (event) =>
          !["playerDeath", "gameOver"].includes(event?.type),
      );
    }
  }
}

function tagEnemyProjectiles(world, previousCount) {
  for (
    let index = previousCount;
    index < world.projectiles.length;
    index += 1
  ) {
    const projectile = world.projectiles[index];

    if (projectile.owner === "player") {
      continue;
    }

    let nearest = null;
    let nearestDistance = Infinity;

    for (const enemy of world.enemies) {
      const distance = Math.hypot(
        enemy.x - (projectile.sourceX ?? projectile.x),
        enemy.y - (projectile.sourceY ?? projectile.y),
      );

      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }

    if (nearest && nearestDistance <= 1.25) {
      projectile.sourceEnemyId = nearest.id;
    }
  }
}

export function updateEnemies(world, dt) {
  applyPursuitRampGate(world);
  reflectPhaseContactDamage(world);

  const beforeHp = world.player.hp;
  const beforeProjectiles = world.projectiles.length;
  const previousAttacks = new Map(
    world.enemies.map((enemy) => [
      enemy.id,
      enemy.lastAttackAt,
    ]),
  );
  const restoreBounty =
    temporarilyDisableState(world, "bounty");
  const legendaryFrost =
    isLegendary(world, "frost");
  const chargerConfig =
    ENEMY_TYPES.charger;
  const originalChargeMultiplier =
    chargerConfig?.chargeSpeedMultiplier;

  if (
    legendaryFrost &&
    chargerConfig &&
    Number.isFinite(originalChargeMultiplier)
  ) {
    chargerConfig.chargeSpeedMultiplier = 1;
  }

  try {
    core.updateEnemies(world, dt);
  } finally {
    restoreBounty?.();

    if (
      legendaryFrost &&
      chargerConfig &&
      Number.isFinite(originalChargeMultiplier)
    ) {
      chargerConfig.chargeSpeedMultiplier =
        originalChargeMultiplier;
    }
  }

  applyLegendaryShieldRefund(world, beforeHp);
  tagEnemyProjectiles(world, beforeProjectiles);

  for (const enemy of world.enemies) {
    if (
      enemy.attackStyle === "contact" &&
      enemy.lastAttackAt !== previousAttacks.get(enemy.id) &&
      enemy.lastAttackAt === world.time
    ) {
      enemy.pursuitStartedAt = world.time;
      enemy.__legendaryRampEligible = false;
    }
  }

  applyPursuitRampGate(world);
}

function projectileHitPlayer(world, projectile) {
  return (
    Math.hypot(
      projectile.x - world.player.x,
      projectile.y - world.player.y,
    ) <=
    projectile.radius + world.player.radius + 0.18
  );
}

function resetProjectileSourceRamp(world, projectile) {
  if (!projectile.sourceEnemyId) {
    return;
  }

  const enemy = world.enemies.find(
    (candidate) =>
      candidate.id === projectile.sourceEnemyId,
  );

  if (!enemy) {
    return;
  }

  enemy.pursuitStartedAt = world.time;
  enemy.__legendaryRampEligible = false;
}

function reflectProjectile(world, projectile) {
  if (!isLegendary(world, "phaseWalk")) {
    return;
  }

  const enemy = world.enemies.find(
    (candidate) =>
      candidate.id === projectile.sourceEnemyId,
  );

  if (enemy) {
    enemy.hp -= projectile.damage;
    enemy.lastHitAt = world.time;
  }
}

export function updateProjectiles(world, dt) {
  const beforeEnemyHp = new Map(
    world.enemies.map((enemy) => [enemy.id, enemy.hp]),
  );
  const playerProjectiles = world.projectiles.filter(
    (projectile) => projectile.owner === "player",
  );
  const beforeHitCounts = new Map(
    playerProjectiles.map((projectile) => [
      projectile,
      projectile.hitIds?.size ?? 0,
    ]),
  );
  const enemyProjectiles = world.projectiles.filter(
    (projectile) => projectile.owner !== "player",
  );
  const beforeHp = world.player.hp;
  const restoreVampirism =
    temporarilyDisableState(world, "vampirism");

  try {
    core.updateProjectiles(world, dt);
  } finally {
    restoreVampirism?.();
  }

  const remaining = new Set(world.projectiles);

  for (const projectile of enemyProjectiles) {
    if (
      !remaining.has(projectile) &&
      projectileHitPlayer(world, projectile)
    ) {
      resetProjectileSourceRamp(world, projectile);
      reflectProjectile(world, projectile);
    }
  }

  applyLegendaryShieldRefund(world, beforeHp);

  const damage = totalEnemyDamage(
    beforeEnemyHp,
    world.enemies,
  );
  const projectileHitCount = playerProjectiles.reduce(
    (total, projectile) =>
      total +
      Math.max(
        0,
        (projectile.hitIds?.size ?? 0) -
          (beforeHitCounts.get(projectile) ?? 0),
      ),
    0,
  );

  applyLegendaryHitRewards(
    world,
    damage,
    projectileHitCount,
  );
}
