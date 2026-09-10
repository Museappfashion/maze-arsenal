// src/game/gameplay-2.0.js
import {
  VIEW_3D_FOV,
  VIEW_3D_MAX_DISTANCE,
} from "../config/constants-enhanced.js";
import {
  isLegendaryPowerUpActive,
} from "../config/legendaryPowerUps.js";
import { WEAPONS } from "../config/weapons-enhanced.js";
import { hasRobbienatorLoadout } from "../config/robbienator.js";
import {
  getDiscoveredPercent,
  hasLineOfSight,
} from "./maze.js";
import * as enhanced from "./gameplay-enhanced.js";

export * from "./gameplay-enhanced.js";

const PHASES = [
  {
    key: "early",
    label: "EARLY",
    threshold: 0,
    enemySpeed: 1,
  },
  {
    key: "mid",
    label: "MID",
    threshold: 0.28,
    enemySpeed: 1.06,
  },
  {
    key: "late",
    label: "LATE",
    threshold: 0.58,
    enemySpeed: 1.14,
  },
  {
    key: "final",
    label: "FINAL STRETCH",
    threshold: 0.84,
    enemySpeed: 1.24,
  },
];

const RECOIL = {
  fists: { kick: 0.8, shake: 0.6, roll: 0.001 },
  crowbar: { kick: 1.7, shake: 1.2, roll: 0.002 },
  machete: { kick: 1.4, shake: 1, roll: 0.002 },
  pistol: { kick: 2.8, shake: 1.8, roll: 0.003 },
  revolver: { kick: 4.8, shake: 3.1, roll: 0.006 },
  smg: { kick: 1.15, shake: 1.8, roll: 0.002 },
  shotgun: { kick: 8.2, shake: 6.6, roll: 0.011 },
  rifle: { kick: 1.8, shake: 2.2, roll: 0.003 },
  dmr: { kick: 5.2, shake: 3.8, roll: 0.007 },
  swordGun: { kick: 4.2, shake: 3.4, roll: 0.007 },
};

const MATERIAL_PARTICLES = {
  city: ["#d1d5db", "#9ca3af", "#fbbf24"],
  space: ["#94a3b8", "#cbd5e1", "#f59e0b"],
  jungle: ["#84cc16", "#a16207", "#65a30d"],
  medieval: ["#d6d3d1", "#a8a29e", "#78716c"],
  labyrinth: ["#c4b5fd", "#64748b", "#94a3b8"],
};

const JOJO_NAME = "jojo";
const JOJO_SPEED_MULTIPLIER = 3;

function isJojoMode(world) {
  return (
    String(world.playerName ?? "")
      .trim()
      .toLowerCase() === JOJO_NAME
  );
}

function enableJojoMode(world) {
  if (!isJojoMode(world)) {
    return false;
  }

  world.leaderboardEligible = false;
  world.__jojoMode = true;
  return true;
}

function normalizeMovement(x, y) {
  const length = Math.hypot(x, y);

  if (length <= 0.0001) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / length,
    y: y / length,
  };
}

function clampJojoToWorld(world) {
  const margin = Math.max(
    0.02,
    Math.min(0.2, world.player.radius * 0.25),
  );

  world.player.x = Math.max(
    margin,
    Math.min(world.width - margin, world.player.x),
  );
  world.player.y = Math.max(
    margin,
    Math.min(world.height - margin, world.player.y),
  );
}

function markJojoPlayerTileChanged(world) {
  const tileX = Math.floor(world.player.x);
  const tileY = Math.floor(world.player.y);

  if (
    tileX === world.lastPlayerTile?.x &&
    tileY === world.lastPlayerTile?.y
  ) {
    return;
  }

  world.lastPlayerTile = {
    x: tileX,
    y: tileY,
  };
  world.distanceTimer = 0;
  world.distanceFieldDirty = true;
}

function stripJojoMovementKeys(world, keys) {
  const safeKeys = {
    ...keys,
  };

  safeKeys.w = false;
  safeKeys.s = false;
  safeKeys.a = false;
  safeKeys.d = false;
  safeKeys.ArrowUp = false;
  safeKeys.ArrowDown = false;

  if (world.viewMode !== "3d") {
    safeKeys.ArrowLeft = false;
    safeKeys.ArrowRight = false;
  }

  return safeKeys;
}

function getJojoMovement(world, keys) {
  if (world.viewMode === "3d") {
    const forwardInput =
      Number(Boolean(keys.w || keys.ArrowUp)) -
      Number(Boolean(keys.s || keys.ArrowDown));
    const strafeInput =
      Number(Boolean(keys.d)) -
      Number(Boolean(keys.a));

    if (forwardInput === 0 && strafeInput === 0) {
      return { x: 0, y: 0 };
    }

    const forwardX = Math.cos(world.player.facing);
    const forwardY = Math.sin(world.player.facing);
    const rightX = -forwardY;
    const rightY = forwardX;

    return normalizeMovement(
      forwardX * forwardInput +
        rightX * strafeInput,
      forwardY * forwardInput +
        rightY * strafeInput,
    );
  }

  const moveX =
    Number(Boolean(keys.ArrowRight || keys.d)) -
    Number(Boolean(keys.ArrowLeft || keys.a));
  const moveY =
    Number(Boolean(keys.ArrowDown || keys.s)) -
    Number(Boolean(keys.ArrowUp || keys.w));

  return normalizeMovement(moveX, moveY);
}

function moveJojoThroughWalls(world, keys, dt) {
  const movement = getJojoMovement(world, keys);

  if (movement.x === 0 && movement.y === 0) {
    return;
  }

  const distance =
    world.player.speed *
    JOJO_SPEED_MULTIPLIER *
    dt;

  world.player.x += movement.x * distance;
  world.player.y += movement.y * distance;
  clampJojoToWorld(world);

  if (
    world.viewMode !== "3d" &&
    !world.pointer.inside &&
    !world.touchAimActive
  ) {
    world.player.facing = Math.atan2(
      movement.y,
      movement.x,
    );
  }

  markJojoPlayerTileChanged(world);
}

function angleDifference(a, b) {
  let difference = a - b;

  while (difference > Math.PI) {
    difference -= Math.PI * 2;
  }

  while (difference < -Math.PI) {
    difference += Math.PI * 2;
  }

  return difference;
}

function finishJojoFistAttack(world) {
  if (
    !isJojoMode(world) ||
    world.player.weapon !== "fists"
  ) {
    return;
  }

  const fists = WEAPONS.fists;
  const arc = fists?.arc ?? 1.2;
  const facing = world.player.facing;

  for (const enemy of world.enemies ?? []) {
    if (enemy.hp <= 0) {
      continue;
    }

    const angleToEnemy = Math.atan2(
      enemy.y - world.player.y,
      enemy.x - world.player.x,
    );

    if (
      Math.abs(
        angleDifference(angleToEnemy, facing),
      ) >
      arc / 2
    ) {
      continue;
    }

    enemy.hp = 0;
    enemy.awake = true;
    enemy.lastHitAt = world.time;
  }
}

function ensureCinematic(world) {
  if (world.__cinematic) {
    return world.__cinematic;
  }

  world.__cinematic = {
    recoilKick: 0,
    recoilRoll: 0,
    shake: 0,
    damageFlash: 0,
    pickupFlash: 0,
    particles: [],
    hitReactions: [],
    phaseIndex: 0,
    phaseLabel: PHASES[0].label,
    phaseTransitionTtl: 0,
    enemiesDefeated: 0,
    defeatedEnemyIds: new Set(),
    lastRegisteredShotAt: -Infinity,
  };

  return world.__cinematic;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function colorForPickup(pickup) {
  if (pickup?.legendary) {
    return "#facc15";
  }

  if (pickup?.type === "health" || pickup?.type === "medkit") {
    return "#22c55e";
  }

  if (pickup?.type === "ammo") {
    return "#38bdf8";
  }

  if (pickup?.type === "powerup") {
    return pickup.color ?? "#c084fc";
  }

  if (pickup?.type === "weapon") {
    return "#fb923c";
  }

  return "#e2e8f0";
}

function spawnParticles(
  world,
  x,
  y,
  {
    count,
    colors,
    speed = 1.8,
    life = 0.32,
    size = 0.06,
    kind = "impact",
  },
) {
  const cinematic = ensureCinematic(world);

  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = randomBetween(speed * 0.35, speed);

    cinematic.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: randomBetween(life * 0.72, life * 1.12),
      maxLife: life,
      size: randomBetween(size * 0.65, size * 1.35),
      color:
        colors[
          Math.floor(Math.random() * colors.length)
        ] ?? "#ffffff",
      kind,
    });
  }

  if (cinematic.particles.length > 220) {
    cinematic.particles.splice(
      0,
      cinematic.particles.length - 220,
    );
  }
}

function snapshotEnemies(world) {
  return new Map(
    (world.enemies ?? []).map((enemy) => [
      enemy.id,
      {
        hp: enemy.hp,
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius,
      },
    ]),
  );
}

function snapshotProjectiles(world) {
  return new Map(
    (world.projectiles ?? []).map((projectile) => [
      projectile.id,
      {
        id: projectile.id,
        owner: projectile.owner,
        x: projectile.x,
        y: projectile.y,
        vx: projectile.vx,
        vy: projectile.vy,
        ttl: projectile.ttl,
      },
    ]),
  );
}

function registerEnemyDamage(world, beforeEnemies) {
  const cinematic = ensureCinematic(world);
  const afterEnemies = new Map(
    (world.enemies ?? []).map((enemy) => [
      enemy.id,
      enemy,
    ]),
  );

  for (const [enemyId, before] of beforeEnemies) {
    const enemy = afterEnemies.get(enemyId);
    const afterHp = enemy?.hp ?? 0;
    const damage = Math.max(0, before.hp - afterHp);

    if (damage <= 0) {
      continue;
    }

    const x = enemy?.x ?? before.x;
    const y = enemy?.y ?? before.y;
    const dead = !enemy || afterHp <= 0;

    if (
      dead &&
      !cinematic.defeatedEnemyIds.has(enemyId)
    ) {
      cinematic.defeatedEnemyIds.add(enemyId);
      cinematic.enemiesDefeated += 1;
    }

    cinematic.hitReactions.push({
      enemyId,
      x,
      y,
      radius: enemy?.radius ?? before.radius ?? 0.3,
      life: dead ? 0.28 : 0.16,
      maxLife: dead ? 0.28 : 0.16,
      dead,
    });

    spawnParticles(world, x, y, {
      count: dead ? 14 : 7,
      colors: dead
        ? ["#fecaca", "#ef4444", "#7f1d1d"]
        : ["#ffffff", "#fca5a5", "#ef4444"],
      speed: dead ? 2.7 : 1.8,
      life: dead ? 0.46 : 0.28,
      size: dead ? 0.075 : 0.055,
      kind: dead ? "enemyDeath" : "enemyHit",
    });

    cinematic.shake = Math.max(
      cinematic.shake,
      dead ? 2.2 : 1.1,
    );
  }
}

function registerRemovedProjectileImpacts(
  world,
  beforeProjectiles,
) {
  const remaining = new Set(
    (world.projectiles ?? []).map(
      (projectile) => projectile.id,
    ),
  );
  const themeKey = world.level?.themeKey ?? "space";
  const colors =
    MATERIAL_PARTICLES[themeKey] ??
    MATERIAL_PARTICLES.space;

  for (const projectile of beforeProjectiles.values()) {
    if (
      projectile.owner !== "player" ||
      remaining.has(projectile.id) ||
      !(projectile.ttl > 0.04)
    ) {
      continue;
    }

    spawnParticles(
      world,
      projectile.x,
      projectile.y,
      {
        count: themeKey === "jungle" ? 6 : 5,
        colors,
        speed: 1.5,
        life: 0.26,
        size: 0.045,
        kind: "wallImpact",
      },
    );
  }
}

function registerPickupCollections(world, beforePickups) {
  const remaining = new Set(
    (world.pickups ?? []).map((pickup) => pickup.id),
  );
  const cinematic = ensureCinematic(world);

  for (const pickup of beforePickups) {
    if (remaining.has(pickup.id)) {
      continue;
    }

    const color = colorForPickup(pickup);
    spawnParticles(world, pickup.x, pickup.y, {
      count: pickup.legendary ? 18 : 10,
      colors: [
        color,
        "#ffffff",
        pickup.legendary ? "#fde68a" : color,
      ],
      speed: pickup.legendary ? 2.4 : 1.6,
      life: pickup.legendary ? 0.62 : 0.4,
      size: pickup.legendary ? 0.075 : 0.055,
      kind: "pickup",
    });

    cinematic.pickupFlash = Math.max(
      cinematic.pickupFlash,
      pickup.legendary ? 0.24 : 0.12,
    );
  }
}

function registerWeaponKick(world, weaponKey) {
  const cinematic = ensureCinematic(world);

  if (cinematic.lastRegisteredShotAt === world.time) {
    return;
  }

  cinematic.lastRegisteredShotAt = world.time;

  const profile =
    RECOIL[weaponKey] ??
    { kick: 1.4, shake: 1.2, roll: 0.002 };

  cinematic.recoilKick = Math.max(
    cinematic.recoilKick,
    profile.kick,
  );
  cinematic.shake = Math.max(
    cinematic.shake,
    profile.shake,
  );

  const rollDirection =
    Math.random() < 0.5 ? -1 : 1;

  cinematic.recoilRoll +=
    profile.roll * rollDirection;

  if (
    hasRobbienatorLoadout(world) &&
    weaponKey === "dmr"
  ) {
    cinematic.recoilRoll +=
      Math.sin(world.time * 31) * 0.018;
    cinematic.shake = Math.max(
      cinematic.shake,
      5.2,
    );
  }
}

function detectFiredAttack(
  world,
  beforeNextAttackAt,
  beforeProjectileCount,
  weaponKey,
) {
  const fired =
    world.player.nextAttackAt > beforeNextAttackAt ||
    world.projectiles.length > beforeProjectileCount;

  if (fired) {
    registerWeaponKick(world, weaponKey);
  }
}

function updateRunPhase(world) {
  const cinematic = ensureCinematic(world);
  const explored =
    getDiscoveredPercent(world) / 100;

  let nextIndex = 0;

  for (let index = 0; index < PHASES.length; index += 1) {
    if (explored >= PHASES[index].threshold) {
      nextIndex = index;
    }
  }

  if (nextIndex === cinematic.phaseIndex) {
    return;
  }

  cinematic.phaseIndex = nextIndex;
  cinematic.phaseLabel = PHASES[nextIndex].label;
  cinematic.phaseTransitionTtl = 1.6;
  cinematic.shake = Math.max(
    cinematic.shake,
    nextIndex >= 3 ? 3.2 : 1.5,
  );
}

function tickCinematic(world, dt) {
  const cinematic = ensureCinematic(world);

  cinematic.recoilKick *= Math.exp(-13 * dt);
  cinematic.recoilRoll *= Math.exp(-11 * dt);
  cinematic.shake *= Math.exp(-9 * dt);
  cinematic.damageFlash = Math.max(
    0,
    cinematic.damageFlash - dt,
  );
  cinematic.pickupFlash = Math.max(
    0,
    cinematic.pickupFlash - dt,
  );
  cinematic.phaseTransitionTtl = Math.max(
    0,
    cinematic.phaseTransitionTtl - dt,
  );

  for (const particle of cinematic.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.exp(-4.5 * dt);
    particle.vy *= Math.exp(-4.5 * dt);
  }

  cinematic.particles =
    cinematic.particles.filter(
      (particle) => particle.life > 0,
    );

  for (const reaction of cinematic.hitReactions) {
    reaction.life -= dt;
  }

  cinematic.hitReactions =
    cinematic.hitReactions.filter(
      (reaction) => reaction.life > 0,
    );

  updateRunPhase(world);
}


const LEGENDARY_DESCRIPTIONS = {
  juggernaut: "Max HP 220 • fill to 220",
  breaker: "12 wall breaks • no timer",
  berserk: "Speed x2 • damage x2",
  haste: "Speed x14",
  rapidFire: "Faster fire • same sustained ammo use",
  shield: "Damage -90%",
  regen: "151 HP healing pool • no timer",
  magnet: "Collect every visible non-weapon pickup",
  overcharge: "300+ ammo • map-range projectiles",
  pierce: "Unlimited pierce • ranged damage x1.5",
  vampirism: "Heal 100% of actual damage",
  frost: "Pursuit removed • base speed x0.5",
  longArms: "Melee x2 • reach x5 • 360°",
  scattershot: "Extra projectiles keep full damage",
  precision: "Damage x1.5 • speed x1.5 • zero spread",
  ammoSurge: "Fill ammo • +10/s • overflow kept",
  sonar: "Full-maze sight",
  phaseWalk: "Damage immune • reflect 100%",
  demolition: "10 wall-breaking shots • no timer",
  bounty: "+7 HP +10 ammo per hit • overflow",
};

const SHIELD_SOURCE_SCALE = 0.2;
const DEMOLITION_CHARGE_SENTINEL = 1_000_000;

function getLegendaryState(world, key) {
  if (!isLegendaryPowerUpActive(world, key)) {
    return null;
  }

  return world.player.powerUps[key] ?? null;
}

function powerUpIsActive(world, key) {
  const state = world.player?.powerUps?.[key];

  return Boolean(
    state &&
      (state.endsAt ?? -Infinity) > world.time,
  );
}

function snapshotEnemyHealth(world) {
  return new Map(
    (world.enemies ?? []).map((enemy) => [
      enemy.id,
      enemy.hp,
    ]),
  );
}

function totalActualEnemyDamage(world, beforeHpById) {
  let total = 0;

  for (const enemy of world.enemies ?? []) {
    const before = beforeHpById.get(enemy.id);

    if (!Number.isFinite(before)) {
      continue;
    }

    total += Math.max(
      0,
      Math.max(0, before) -
        Math.max(0, enemy.hp),
    );
  }

  return total;
}

function countDamagedEnemies(world, beforeHpById) {
  let count = 0;

  for (const enemy of world.enemies ?? []) {
    const before = beforeHpById.get(enemy.id);

    if (
      Number.isFinite(before) &&
      enemy.hp < before
    ) {
      count += 1;
    }
  }

  return count;
}

function suspendLegendaryPowerUp(world, key) {
  const state = getLegendaryState(world, key);

  if (!state) {
    return {
      active: false,
      restore() {},
    };
  }

  const endsAt = state.endsAt;
  state.endsAt = -Infinity;

  return {
    active: true,
    restore() {
      state.endsAt = endsAt;
    },
  };
}

function suspendLegendaryRewards(world) {
  const vampirism =
    suspendLegendaryPowerUp(
      world,
      "vampirism",
    );
  const bounty =
    suspendLegendaryPowerUp(
      world,
      "bounty",
    );

  return {
    vampirism: vampirism.active,
    bounty: bounty.active,
    restore() {
      bounty.restore();
      vampirism.restore();
    },
  };
}

function applyLegendaryCombatRewards(
  world,
  damage,
  hitCount,
  rewardState,
) {
  if (
    rewardState.vampirism &&
    damage > 0
  ) {
    const currentHp =
      Math.max(
        0,
        Number(world.player.hp) || 0,
      );
    const maxHp =
      Math.max(
        0,
        Number(world.player.maxHp) || 0,
      );

    /*
     * Preserve Bounty overflow instead of forcing HP
     * back down to max HP.
     */
    if (currentHp < maxHp) {
      world.player.hp = Math.min(
        maxHp,
        currentHp + damage,
      );
    }
  }

  if (
    rewardState.bounty &&
    hitCount > 0
  ) {
    world.player.hp =
      Math.max(
        0,
        Number(world.player.hp) || 0,
      ) +
      7 * hitCount;
    world.player.ammo =
      Math.max(
        0,
        Number(world.player.ammo) || 0,
      ) +
      10 * hitCount;
  }
}

function getProjectileHitSnapshot(world) {
  const projectiles =
    (world.projectiles ?? []).filter(
      (projectile) =>
        projectile.owner === "player",
    );

  return {
    projectiles,
    hitCounts: new Map(
      projectiles.map((projectile) => [
        projectile,
        projectile.hitIds?.size ?? 0,
      ]),
    ),
  };
}

function countNewProjectileHits(snapshot) {
  return snapshot.projectiles.reduce(
    (total, projectile) =>
      total +
      Math.max(
        0,
        (projectile.hitIds?.size ?? 0) -
          (snapshot.hitCounts.get(projectile) ?? 0),
      ),
    0,
  );
}

function normalizeAngleDelta(angle) {
  return Math.atan2(
    Math.sin(angle),
    Math.cos(angle),
  );
}

function pickupVisibleForLegendaryMagnet(
  world,
  pickup,
) {
  if (world.viewMode !== "3d") {
    return (
      visibleStrengthAt(
        world,
        Math.floor(pickup.x),
        Math.floor(pickup.y),
      ) > 0.24
    );
  }

  const dx =
    pickup.x - world.player.x;
  const dy =
    pickup.y - world.player.y;
  const distance = Math.hypot(dx, dy);

  if (distance > VIEW_3D_MAX_DISTANCE) {
    return false;
  }

  const angle = Math.atan2(dy, dx);
  const angleFromFacing =
    normalizeAngleDelta(
      angle - world.player.facing,
    );

  if (
    Math.abs(angleFromFacing) >
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

function ensureMagnetOverflowQueue(world) {
  world.player.magnetOverflowPowerUps ??= [];
  world.player.legendaryPowerUpSlots ??=
    [false, false, false];

  return world.player.magnetOverflowPowerUps;
}

function drainMagnetOverflowQueue(world) {
  const queue =
    ensureMagnetOverflowQueue(world);

  while (queue.length) {
    const slotIndex =
      world.player.powerUpSlots.findIndex(
        (slot) => !slot,
      );

    if (slotIndex < 0) {
      break;
    }

    const stored = queue.shift();
    world.player.powerUpSlots[slotIndex] =
      stored.key;
    world.player.legendaryPowerUpSlots[
      slotIndex
    ] = Boolean(stored.legendary);
  }
}

function captureMagnetOverflowPowerUps(world) {
  if (!getLegendaryState(world, "magnet")) {
    return 0;
  }

  drainMagnetOverflowQueue(world);

  if (
    world.player.powerUpSlots.some(
      (slot) => !slot,
    )
  ) {
    return 0;
  }

  const queue =
    ensureMagnetOverflowQueue(world);
  const remaining = [];
  let captured = 0;

  for (const pickup of world.pickups ?? []) {
    if (
      pickup.type === "powerup" &&
      pickupVisibleForLegendaryMagnet(
        world,
        pickup,
      )
    ) {
      queue.push({
        key: pickup.powerUp,
        legendary: Boolean(
          pickup.legendary,
        ),
      });
      captured += 1;
      continue;
    }

    remaining.push(pickup);
  }

  if (captured > 0) {
    world.pickups = remaining;
    enhanced.setMessage(
      world,
      `Magnet secured ${captured} power-up${
        captured === 1 ? "" : "s"
      } for the next open slot`,
      1.3,
    );
  }

  return captured;
}

function scaleLegendaryShieldContacts(world) {
  const state =
    getLegendaryState(world, "shield");

  if (!state) {
    return () => {};
  }

  const originalLegendary =
    state.legendary;
  const backups = [];

  state.legendary = false;

  for (const enemy of world.enemies ?? []) {
    if (
      !Number.isFinite(enemy.contactDamage) ||
      enemy.contactDamage <= 0
    ) {
      continue;
    }

    backups.push([
      enemy,
      enemy.contactDamage,
    ]);
    enemy.contactDamage *=
      SHIELD_SOURCE_SCALE;
  }

  return () => {
    for (const [enemy, damage] of backups) {
      enemy.contactDamage = damage;
    }

    state.legendary = originalLegendary;
  };
}

function scaleLegendaryShieldProjectiles(world) {
  const state =
    getLegendaryState(world, "shield");

  if (!state) {
    return () => {};
  }

  const originalLegendary =
    state.legendary;
  const backups = [];

  state.legendary = false;

  for (
    const projectile of
    world.projectiles ?? []
  ) {
    if (
      projectile.owner === "player" ||
      !Number.isFinite(projectile.damage)
    ) {
      continue;
    }

    backups.push([
      projectile,
      projectile.damage,
    ]);
    projectile.damage *=
      SHIELD_SOURCE_SCALE;
  }

  return () => {
    for (
      const [projectile, damage] of backups
    ) {
      projectile.damage = damage;
    }

    state.legendary = originalLegendary;
  };
}

function projectileWillHitPlayer(
  world,
  projectile,
  dt,
) {
  if (
    projectile.owner === "player" ||
    (projectile.ttl ?? 0) <= dt
  ) {
    return false;
  }

  const startX = projectile.x;
  const startY = projectile.y;
  const endX =
    startX + projectile.vx * dt;
  const endY =
    startY + projectile.vy * dt;
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared =
    segmentX * segmentX +
    segmentY * segmentY;

  let t = 0;

  if (lengthSquared > 0) {
    t =
      (
        (world.player.x - startX) *
          segmentX +
        (world.player.y - startY) *
          segmentY
      ) /
      lengthSquared;
    t = Math.max(0, Math.min(1, t));
  }

  const closestX =
    startX + segmentX * t;
  const closestY =
    startY + segmentY * t;
  const radius =
    (projectile.radius ?? 0) +
    world.player.radius;

  if (
    Math.hypot(
      closestX - world.player.x,
      closestY - world.player.y,
    ) > radius
  ) {
    return false;
  }

  return hasLineOfSight(
    world,
    startX,
    startY,
    world.player.x,
    world.player.y,
  );
}

function findProjectileSourceEnemy(
  world,
  projectile,
) {
  if (projectile.sourceEnemyId) {
    const exact =
      world.enemies.find(
        (enemy) =>
          enemy.id ===
          projectile.sourceEnemyId,
      );

    if (exact) {
      return exact;
    }
  }

  const sourceX =
    projectile.sourceX ??
    projectile.x;
  const sourceY =
    projectile.sourceY ??
    projectile.y;
  let nearest = null;
  let nearestDistance = Infinity;

  for (const enemy of world.enemies ?? []) {
    const distance = Math.hypot(
      enemy.x - sourceX,
      enemy.y - sourceY,
    );

    if (distance < nearestDistance) {
      nearest = enemy;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= 1.5
    ? nearest
    : null;
}

function reflectIncomingPhaseProjectiles(
  world,
  dt,
) {
  const phaseState =
    getLegendaryState(
      world,
      "phaseWalk",
    );

  if (!phaseState) {
    return () => {};
  }

  const remaining = [];

  for (
    const projectile of
    world.projectiles ?? []
  ) {
    if (
      !projectileWillHitPlayer(
        world,
        projectile,
        dt,
      )
    ) {
      remaining.push(projectile);
      continue;
    }

    const enemy =
      findProjectileSourceEnemy(
        world,
        projectile,
      );

    if (enemy && enemy.hp > 0) {
      enemy.hp -= Math.max(
        0,
        Number(projectile.damage) || 0,
      );
      enemy.lastHitAt = world.time;
      enemy.awake = true;
      enemy.pursuitStartedAt = world.time;
      enemy.__legendaryRampEligible = false;
    }
  }

  world.projectiles = remaining;

  /*
   * Core Phase Walk immunity stays active; only the enhanced
   * proximity-based reflection heuristic is disabled.
   */
  const originalLegendary =
    phaseState.legendary;
  phaseState.legendary = false;

  return () => {
    phaseState.legendary =
      originalLegendary;
  };
}

function getLegendaryDemolitionState(world) {
  return getLegendaryState(
    world,
    "demolition",
  );
}

function suspendDepletedDemolitionForAttack(
  world,
) {
  const state =
    getLegendaryDemolitionState(world);

  if (
    !state ||
    (state.charges ?? 0) > 0
  ) {
    return () => {};
  }

  const endsAt = state.endsAt;
  state.endsAt = -Infinity;

  return () => {
    state.endsAt = endsAt;
  };
}

function registerLegendaryDemolitionShot(
  world,
  beforeProjectileCount,
) {
  const state =
    getLegendaryDemolitionState(world);

  if (
    !state ||
    (state.charges ?? 0) <= 0
  ) {
    return;
  }

  const newProjectiles =
    world.projectiles
      .slice(beforeProjectileCount)
      .filter(
        (projectile) =>
          projectile.owner === "player" &&
          projectile.breaksWalls,
      );

  if (!newProjectiles.length) {
    return;
  }

  state.charges = Math.max(
    0,
    state.charges - 1,
  );

  for (const projectile of newProjectiles) {
    projectile.__legendaryDemolitionShot =
      true;
  }

  if (state.charges === 0) {
    enhanced.setMessage(
      world,
      "Demolition: final wall-breaking shot fired",
      1.2,
    );
  }
}

function protectLegendaryDemolitionCharges(
  world,
) {
  const state =
    getLegendaryDemolitionState(world);

  if (!state) {
    return () => {};
  }

  const charges =
    Math.max(
      0,
      Number(state.charges) || 0,
    );
  const endsAt = state.endsAt;

  state.charges =
    DEMOLITION_CHARGE_SENTINEL;
  state.endsAt = Infinity;

  return () => {
    state.charges = charges;
    state.endsAt = endsAt;
  };
}

function finishLegendaryDemolitionIfSpent(
  world,
) {
  const state =
    getLegendaryDemolitionState(world);

  if (
    !state ||
    (state.charges ?? 0) > 0
  ) {
    return;
  }

  const pendingShot =
    (world.projectiles ?? []).some(
      (projectile) =>
        projectile
          .__legendaryDemolitionShot,
    );

  if (pendingShot) {
    return;
  }

  state.endsAt = world.time;
  enhanced.setMessage(
    world,
    "Demolition depleted",
    0.9,
  );
}

function legendaryShort(powerUp) {
  if (!powerUp?.legendary) {
    return powerUp?.short;
  }

  return (
    LEGENDARY_DESCRIPTIONS[
      powerUp.key
    ] ??
    powerUp.short
  );
}

export function getStoredPowerUps(world) {
  return enhanced
    .getStoredPowerUps(world)
    .map((powerUp) =>
      powerUp
        ? {
            ...powerUp,
            short:
              legendaryShort(powerUp),
          }
        : null,
    );
}

export function getActivePowerUps(world) {
  return enhanced
    .getActivePowerUps(world)
    .map((powerUp) => ({
      ...powerUp,
      short: legendaryShort(powerUp),
    }));
}

export function updateVisionCache(world) {
  enhanced.updateVisionCache(world);

  if (
    getLegendaryState(world, "sonar") &&
    world.vision
  ) {
    /*
     * Full sight is handled by visibleStrengthAt().
     * Keeping this at zero prevents a full-maze scan every frame.
     */
    world.vision.sightBonus = 0;
  }
}

export function visibleStrengthAt(
  world,
  tileX,
  tileY,
) {
  if (
    !world.labyrinthMode &&
    getLegendaryState(world, "sonar")
  ) {
    return 1;
  }

  return enhanced.visibleStrengthAt(
    world,
    tileX,
    tileY,
  );
}

export function revealAroundPlayer(world) {
  const state =
    getLegendaryState(world, "sonar");

  if (!state || world.labyrinthMode) {
    enhanced.revealAroundPlayer(world);
    return;
  }

  const token = state.endsAt;

  if (
    world.__legendarySonarRevealToken ===
    token
  ) {
    return;
  }

  world.vision ??= {
    sightBonus: 0,
    facingX: Math.cos(world.player.facing),
    facingY: Math.sin(world.player.facing),
  };

  const previousBonus =
    world.vision.sightBonus;

  world.vision.sightBonus =
    Math.hypot(
      world.width,
      world.height,
    ) + 2;

  try {
    /*
     * One full reveal per Legendary Sonar activation is cheap;
     * the former 9999 bonus forced this scan every frame.
     */
    enhanced.revealAroundPlayer(world);
  } finally {
    world.vision.sightBonus =
      previousBonus;
  }

  world.__legendarySonarRevealToken =
    token;
}


export function activateStoredPowerUp(
  world,
  slotIndex,
) {
  const key =
    world.player.powerUpSlots[
      slotIndex
    ];
  const legendary = Boolean(
    world.player.legendaryPowerUpSlots?.[
      slotIndex
    ],
  );
  const beforeHp =
    world.player.hp;
  const wasActive =
    key === "juggernaut" &&
    powerUpIsActive(
      world,
      "juggernaut",
    );

  const activated =
    enhanced.activateStoredPowerUp(
      world,
      slotIndex,
    );

  if (!activated) {
    return false;
  }

  if (key === "juggernaut") {
    world.player.maxHp = 220;

    if (legendary) {
      world.player.hp = 220;
    } else if (!wasActive) {
      world.player.hp = Math.min(
        220,
        Math.max(0, beforeHp) + 100,
      );
    } else {
      world.player.hp = Math.min(
        220,
        world.player.hp,
      );
    }
  }

  drainMagnetOverflowQueue(world);

  return true;
}


export function attack(world) {
  enableJojoMode(world);

  const weaponKey =
    world.player.weapon;
  const weapon =
    WEAPONS[weaponKey];
  const beforeNextAttackAt =
    world.player.nextAttackAt;
  const beforeProjectileCount =
    world.projectiles.length;
  const beforeEnemies =
    snapshotEnemies(world);
  const beforeEnemyHp =
    snapshotEnemyHealth(world);
  const rewards =
    suspendLegendaryRewards(world);
  const restoreDepletedDemolition =
    suspendDepletedDemolitionForAttack(
      world,
    );

  try {
    enhanced.attack(world);
  } finally {
    restoreDepletedDemolition();
    rewards.restore();
  }

  const attackStarted =
    world.player.nextAttackAt >
    beforeNextAttackAt;

  if (
    attackStarted &&
    weaponKey === "fists"
  ) {
    finishJojoFistAttack(world);
  }

  detectFiredAttack(
    world,
    beforeNextAttackAt,
    beforeProjectileCount,
    weaponKey,
  );

  registerLegendaryDemolitionShot(
    world,
    beforeProjectileCount,
  );

  if (
    weapon?.type === "melee" &&
    attackStarted
  ) {
    applyLegendaryCombatRewards(
      world,
      totalActualEnemyDamage(
        world,
        beforeEnemyHp,
      ),
      countDamagedEnemies(
        world,
        beforeEnemyHp,
      ),
      rewards,
    );
  }

  registerEnemyDamage(
    world,
    beforeEnemies,
  );
}


export function updatePlayer(
  world,
  keys,
  dt,
) {
  const cinematic =
    ensureCinematic(world);
  const jojoMode =
    enableJojoMode(world);
  const beforeHp =
    world.player.hp;
  const shouldAttack = Boolean(
    keys[" "] ||
      keys.Enter ||
      world.pointer.down,
  );
  const pointerDown =
    world.pointer.down;
  const safeKeys = {
    ...keys,
    " ": false,
    Enter: false,
  };

  world.pointer.down = false;

  try {
    if (jojoMode) {
      enhanced.updatePlayer(
        world,
        stripJojoMovementKeys(
          world,
          safeKeys,
        ),
        dt,
      );
      moveJojoThroughWalls(
        world,
        safeKeys,
        dt,
      );
    } else {
      enhanced.updatePlayer(
        world,
        safeKeys,
        dt,
      );
    }
  } finally {
    world.pointer.down = pointerDown;
  }

  if (shouldAttack) {
    attack(world);
  }

  if (world.player.hp < beforeHp) {
    cinematic.damageFlash = Math.max(
      cinematic.damageFlash,
      0.24,
    );
    cinematic.shake = Math.max(
      cinematic.shake,
      4.4,
    );
  }

  tickCinematic(world, dt);
}


export function updatePickups(world, dt) {
  ensureCinematic(world);
  const beforePickups = [
    ...(world.pickups ?? []),
  ];

  captureMagnetOverflowPowerUps(
    world,
  );
  enhanced.updatePickups(world, dt);
  drainMagnetOverflowQueue(world);

  registerPickupCollections(
    world,
    beforePickups,
  );
}


export function updateProjectiles(
  world,
  dt,
) {
  ensureCinematic(world);

  const beforeEnemies =
    snapshotEnemies(world);

  /*
   * Reflect only projectiles whose movement segment actually
   * intersects the player this frame.
   */
  const restorePhaseReflection =
    reflectIncomingPhaseProjectiles(
      world,
      dt,
    );

  const beforeEnemyHp =
    snapshotEnemyHealth(world);
  const projectileHits =
    getProjectileHitSnapshot(world);
  const rewards =
    suspendLegendaryRewards(world);
  const restoreShield =
    scaleLegendaryShieldProjectiles(
      world,
    );
  const restoreDemolition =
    protectLegendaryDemolitionCharges(
      world,
    );

  try {
    enhanced.updateProjectiles(
      world,
      dt,
    );
  } finally {
    restoreDemolition();
    restoreShield();
    rewards.restore();
    restorePhaseReflection();
  }

  applyLegendaryCombatRewards(
    world,
    totalActualEnemyDamage(
      world,
      beforeEnemyHp,
    ),
    countNewProjectileHits(
      projectileHits,
    ),
    rewards,
  );

  finishLegendaryDemolitionIfSpent(
    world,
  );

  registerEnemyDamage(
    world,
    beforeEnemies,
  );
}


export function updateEnemies(world, dt) {
  const cinematic =
    ensureCinematic(world);
  const beforeHp =
    world.player.hp;
  const phase =
    PHASES[
      cinematic.phaseIndex ?? 0
    ] ?? PHASES[0];

  if (cinematic.phaseIndex >= 2) {
    const wakeRadius =
      cinematic.phaseIndex >= 3
        ? 10
        : 7;

    for (
      const enemy of
      world.enemies ?? []
    ) {
      const distance = Math.hypot(
        enemy.x - world.player.x,
        enemy.y - world.player.y,
      );

      if (distance <= wakeRadius) {
        enemy.awake = true;
      }
    }
  }

  /*
   * Keep the requested 2.0 phase speed multiplier unchanged.
   * Legendary Shield is corrected at the incoming damage source.
   */
  const restoreShield =
    scaleLegendaryShieldContacts(
      world,
    );

  try {
    enhanced.updateEnemies(
      world,
      dt * phase.enemySpeed,
    );
  } finally {
    restoreShield();
  }

  if (world.player.hp < beforeHp) {
    cinematic.damageFlash = Math.max(
      cinematic.damageFlash,
      0.24,
    );
    cinematic.shake = Math.max(
      cinematic.shake,
      4.4,
    );
  }
}

