// src/game/gameplay-2.0.js
import { WEAPONS } from "../config/weapons-enhanced.js";
import { hasRobbienatorLoadout } from "../config/robbienator.js";
import { getDiscoveredPercent } from "./maze.js";
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

export function attack(world) {
  const weaponKey = world.player.weapon;
  const beforeNextAttackAt =
    world.player.nextAttackAt;
  const beforeProjectileCount =
    world.projectiles.length;
  const beforeEnemies = snapshotEnemies(world);

  enhanced.attack(world);

  detectFiredAttack(
    world,
    beforeNextAttackAt,
    beforeProjectileCount,
    weaponKey,
  );
  registerEnemyDamage(world, beforeEnemies);
}

export function updatePlayer(world, keys, dt) {
  const cinematic = ensureCinematic(world);
  const beforeHp = world.player.hp;
  const weaponKey = world.player.weapon;
  const beforeNextAttackAt =
    world.player.nextAttackAt;
  const beforeProjectileCount =
    world.projectiles.length;
  const beforeEnemies = snapshotEnemies(world);

  enhanced.updatePlayer(world, keys, dt);

  detectFiredAttack(
    world,
    beforeNextAttackAt,
    beforeProjectileCount,
    weaponKey,
  );
  registerEnemyDamage(world, beforeEnemies);

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

  enhanced.updatePickups(world, dt);
  registerPickupCollections(
    world,
    beforePickups,
  );
}

export function updateProjectiles(world, dt) {
  ensureCinematic(world);
  const beforeEnemies = snapshotEnemies(world);
  const beforeProjectiles =
    snapshotProjectiles(world);

  enhanced.updateProjectiles(world, dt);

  registerEnemyDamage(world, beforeEnemies);
  registerRemovedProjectileImpacts(
    world,
    beforeProjectiles,
  );
}

export function updateEnemies(world, dt) {
  const cinematic = ensureCinematic(world);
  const beforeHp = world.player.hp;
  const phase =
    PHASES[
      cinematic.phaseIndex ?? 0
    ] ?? PHASES[0];

  if (cinematic.phaseIndex >= 2) {
    const wakeRadius =
      cinematic.phaseIndex >= 3 ? 10 : 7;

    for (const enemy of world.enemies ?? []) {
      const distance = Math.hypot(
        enemy.x - world.player.x,
        enemy.y - world.player.y,
      );

      if (distance <= wakeRadius) {
        enemy.awake = true;
      }
    }
  }

  enhanced.updateEnemies(
    world,
    dt * phase.enemySpeed,
  );

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
