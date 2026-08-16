// src/game/gameplay.js
import { queueSfx } from "../audio/MazeAudioEngine.js";
import { AMMO_DROP_MIN_TILE_SPACING, AMMO_EXTRA_MAX_AMOUNT, AMMO_EXTRA_MIN_AMOUNT, AMMO_ROUTE_SPACING, AMMO_SUPPORT_MAX_AMOUNT, AMMO_SUPPORT_MELEE_CHANCE, AMMO_SUPPORT_MIN_AMOUNT, AMMO_SUPPORT_RANGED_CHANCE, MAX_AMMO } from "../config/ammo.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH, DRAW_TILE, FLOOR, MAX_EFFECTS, MOBILE_2D_ZOOM, STEEL_WALL, VIEW_3D_TURN_SPEED, WALL } from "../config/constants.js";
import {
  ENEMY_COSTS,
  ENEMY_DIFFICULTY_STAGES,
  ENEMY_PURSUIT_DECAY_SECONDS,
  ENEMY_PURSUIT_MAX_SPEED_MULTIPLIER,
  ENEMY_PURSUIT_RAMP_SECONDS,
  ENEMY_TYPES,
  GUARANTEED_TURRETS,
} from "../config/enemies.js";
import { POWER_UPS, POWER_UP_PICKUP_COUNT, POWER_UP_SPAWN_ORDER, POWER_UP_WALL_BREAK_CHARGES, getPowerUpDuration } from "../config/powerUps.js";
import { getAmmoLabel, getAmmoMessageLabel, getAmmoPickupLabel, getPowerUpPresentation, getWeaponLabel, isMedievalTheme } from "../config/presentations.js";
import { VISION_MARGIN } from "../config/runtime.js";
import { WEAPONS, WEAPON_ORDER, WEAPON_SPAWN_PLAN } from "../config/weapons.js";
import { addPickup, bfsDistances, circleHitsWall, findNearbyOpenTiles, findSpacedSpawnTile, findSpawnTile, findTileNearPercent, hasLineOfSight, isWalkable, moveWithCollisions, spawnProjectile } from "./maze.js";
import { collectLabyrinthBreaker, isLabyrinthWorld, labyrinthBreakerActive } from "./labyrinth.js";
import { angleDelta, chance, clamp, indexOfTile, lerp, normalize, rand, randInt, shuffle, tileCenter, weightedChoice } from "../utils/math.js";
import { getPlayerDisplayName } from "../utils/player.js";

export function placeProgressionItems(world, distances, used) {
  const supportRequests = [];
  const ammoTiles = [];

  for (const entry of WEAPON_SPAWN_PLAN) {
    const tile = findTileNearPercent(
      world,
      distances,
      entry.percent,
      entry.spread,
      used,
    );

    addPickup(world, tile, {
      type: "weapon",
      weapon: entry.weapon,
      label: getWeaponLabel(world, entry.weapon),
    });

    for (let index = 0; index < entry.supportDrops; index += 1) {
      supportRequests.push({ tile, weapon: entry.weapon });
    }
  }

  for (const request of supportRequests) {
    const weapon = WEAPONS[request.weapon];
    const shouldDropAmmo =
      weapon.type === "ranged"
        ? chance(AMMO_SUPPORT_RANGED_CHANCE)
        : chance(AMMO_SUPPORT_MELEE_CHANCE);

    const nearby = findNearbyOpenTiles(
      world,
      request.tile,
      shouldDropAmmo ? 8 : 5,
      used,
      shouldDropAmmo ? 4 : 2,
      shouldDropAmmo ? ammoTiles : [],
      shouldDropAmmo ? AMMO_DROP_MIN_TILE_SPACING : 0,
    );

    if (!nearby) {
      continue;
    }

    if (shouldDropAmmo) {
      addPickup(world, nearby, {
        type: "ammo",
        amount: randInt(
          AMMO_SUPPORT_MIN_AMOUNT,
          AMMO_SUPPORT_MAX_AMOUNT,
        ),
        label: getAmmoPickupLabel(world),
      });
      ammoTiles.push(nearby);
    } else {
      addPickup(world, nearby, {
        type: "medkit",
        amount: randInt(12, 24),
        label: "Medkit",
      });
    }
  }

  const extraAmmo = clamp(
    Math.round(world.exit.distance / AMMO_ROUTE_SPACING),
    4,
    14,
  );
  const medkits = clamp(
    Math.round(world.exit.distance / 42),
    4,
    11,
  );

  for (let index = 0; index < extraAmmo; index += 1) {
    const progress = (index + 1) / (extraAmmo + 1);
    const targetDistance = Math.floor(world.exit.distance * progress);
    const routeWindow = Math.max(
      7,
      Math.floor(world.exit.distance / Math.max(12, extraAmmo * 2)),
    );

    const tile = findSpacedSpawnTile(
      world,
      distances,
      Math.max(8, targetDistance - routeWindow),
      Math.min(world.exit.distance, targetDistance + routeWindow),
      used,
      ammoTiles,
      AMMO_DROP_MIN_TILE_SPACING,
    );

    addPickup(world, tile, {
      type: "ammo",
      amount: randInt(
        AMMO_EXTRA_MIN_AMOUNT,
        AMMO_EXTRA_MAX_AMOUNT,
      ),
      label: getAmmoPickupLabel(world),
    });
    ammoTiles.push(tile);
  }

  for (let index = 0; index < medkits; index += 1) {
    const tile = findSpawnTile(
      world,
      distances,
      8,
      world.exit.distance,
      used,
    );

    addPickup(world, tile, {
      type: "medkit",
      amount: randInt(10, 22),
      label: "Medkit",
    });
  }
}

export function placePowerUps(world, distances, used) { const spreadBase = 7;

for (let index = 0; index < POWER_UP_PICKUP_COUNT; index += 1) { const key = POWER_UP_SPAWN_ORDER[index % POWER_UP_SPAWN_ORDER.length]; const progress = index / Math.max(1, POWER_UP_PICKUP_COUNT - 1); const percent = clamp( 0.08 + progress * 0.84 + rand(-0.04, 0.04), 0.08, 0.94, );

const tile = findTileNearPercent(
  world,
  distances,
  percent,
  spreadBase + (index % 5) * 2,
  used,
);

addPickup(world, tile, {
  type: "powerup",
  powerUp: key,
  label: getPowerUpPresentation(world, key).label,
  color: POWER_UPS[key].color,
});

} }

export function pickEnemyColor(config) { const palette = config.palette ?? [config.color]; return palette[Math.floor(Math.random() * palette.length)] ?? config.color; }

export function chooseEnemyKindForStage(stage, remainingBudget) { const eligible = Object.entries(stage.weights).filter(([kind]) => { return ENEMY_COSTS[kind] <= remainingBudget + 0.45; });

if (!eligible.length) { const fallback = Object.entries(stage.weights).sort( (a, b) => ENEMY_COSTS[a[0]] - ENEMY_COSTS[b[0]], ); return fallback[0]?.[0] ?? "scout"; }

return weightedChoice(eligible); }

export function getEncounterCount(world, stage) { const sizeBonus = Math.floor(world.exit.distance / 70); return randInt(stage.encounters[0], stage.encounters[1]) + sizeBonus; }

export function getEncounterBudget(stage, encounterIndex, encounterCount) { const progress = encounterCount <= 1 ? 1 : encounterIndex / Math.max(1, encounterCount - 1);

return lerp(stage.budget[0], stage.budget[1], progress) + rand(-0.35, 0.35); }

export function addEnemy(world, tile, kind) { const config = ENEMY_TYPES[kind]; const position = tileCenter(tile);
const level = world.level;

const hpScale = rand(0.9, 1.18) * level.enemyHpMultiplier;
const speedScale = rand(0.92, 1.12) * level.enemySpeedMultiplier;
const damageScale = rand(0.9, 1.14) * level.enemyDamageMultiplier;
const cooldownScale = rand(0.9, 1.08);

const maxHp = Math.max(1, Math.round(config.hp * hpScale));

world.enemies.push({ id: `enemy-${world.nextId++}`, kind, label: config.label, x: position.x, y: position.y, radius: config.radius * rand(0.96, 1.08), hp: maxHp, maxHp, speed: config.speed * speedScale, pursuitHeat: 0, contactDamage: config.contactDamage ? Math.max(1, Math.round(config.contactDamage * damageScale)) : 0, projectileDamage: config.projectileDamage ? Math.max(1, Math.round(config.projectileDamage * damageScale)) : 0, attackCooldown: config.attackCooldown ? config.attackCooldown * cooldownScale : 0, awake: false, nextAttackAt: 0, nextContactAt: 0, lastAttackAt: -Infinity, attackStyle: null, lastHitAt: -Infinity, color: pickEnemyColor(config), orbitDir: chance(0.5) ? 1 : -1, }); }

export function spawnEncounterPack(world, distances, used, stage, anchorPercent, budget) { const anchorTile = findTileNearPercent( world, distances, anchorPercent, stage.spread, used, );

let spent = 0; let spawned = 0;

while (spawned < stage.packCap && spent < budget) { const remainingBudget = budget - spent; const kind = chooseEnemyKindForStage(stage, remainingBudget);

const tile =
  spawned === 0
    ? anchorTile
    : findNearbyOpenTiles(
        world,
        anchorTile,
        stage.clusterRadius,
        used,
        1,
      ) ??
      findSpawnTile(
        world,
        distances,
        Math.max(8, Math.floor(world.exit.distance * stage.start)),
        Math.max(10, Math.floor(world.exit.distance * stage.end)),
        used,
      );

addEnemy(world, tile, kind);
spent += ENEMY_COSTS[kind];
spawned += 1;

if (spawned >= stage.packCap) {
  break;
}

if (remainingBudget < 0.95) {
  break;
}

if (chance(0.12) && spawned > 0) {
  break;
}

} }

export function placeFinalGuardPack(world, distances, used) { const anchorTile = findTileNearPercent(world, distances, 0.94, 8, used); addEnemy(world, anchorTile, "warden");

const supportKinds = shuffle(["turret", "spitter", "brute", "charger"]).slice( 0, randInt(2, 3), );

for (const kind of supportKinds) { const nearby = findNearbyOpenTiles(world, anchorTile, 5, used, 2) ?? findSpawnTile( world, distances, Math.floor(world.exit.distance * 0.82), world.exit.distance, used, );

addEnemy(world, nearby, kind);

} }

export function placeGuaranteedTurrets(world, distances, used) {
const turretCount = GUARANTEED_TURRETS[world.levelKey] ?? 4;

for (let index = 0; index < turretCount; index += 1) {
  const progress = turretCount <= 1 ? 0.5 : index / (turretCount - 1);
  const percent = lerp(0.28, 0.9, progress);
  const tile = findTileNearPercent(world, distances, percent, 7 + index, used);
  addEnemy(world, tile, "turret");
}
}

export function placeEnemies(world, distances, used) { for (const stage of ENEMY_DIFFICULTY_STAGES) { const encounterCount = getEncounterCount(world, stage);

for (let i = 0; i < encounterCount; i += 1) {
  const laneProgress =
    encounterCount <= 1 ? 0.5 : i / Math.max(1, encounterCount - 1);

  const anchorPercent = clamp(
    lerp(stage.start, stage.end, laneProgress) + rand(-0.025, 0.025),
    stage.start,
    stage.end,
  );

  const budget = getEncounterBudget(stage, i, encounterCount) * world.level.enemyBudgetMultiplier;
  spawnEncounterPack(world, distances, used, stage, anchorPercent, budget);
}

}

placeGuaranteedTurrets(world, distances, used);
placeFinalGuardPack(world, distances, used); }

export function hasPowerUp(world, key) {
  if (key === "breaker" && isLabyrinthWorld(world)) {
    return labyrinthBreakerActive(world);
  }

  return (world.player.powerUps[key]?.endsAt ?? -Infinity) > world.time;
}

export function getActivePowerUps(world) { return Object.entries(world.player.powerUps) .filter(([, state]) => state.endsAt > world.time) .sort((a, b) => a[1].endsAt - b[1].endsAt) .map(([key, state]) => ({ key, label: getPowerUpPresentation(world, key).label, short: getPowerUpPresentation(world, key).short, color: POWER_UPS[key].color, remaining: Math.max(0, state.endsAt - world.time), })); }

export function storePowerUp(world, key) {
  const slots = world.player.powerUpSlots;
  const emptySlot = slots.findIndex((slot) => slot === null);

  if (emptySlot === -1) {
    if (world.time >= (world.lastFullPowerUpNoticeAt ?? -Infinity) + 0.9) {
      setMessage(world, "Power-up holder full — use Z or X first", 1.2);
      world.lastFullPowerUpNoticeAt = world.time;
    }
    return false;
  }

  slots[emptySlot] = key;
  queueSfx(world, "pickupPowerUp", { powerUpKey: key });
  setMessage(world, `${getPowerUpPresentation(world, key).label} stored in slot ${emptySlot + 1}`, 1.5);
  return true;
}

export function activateStoredPowerUp(world, slotIndex) {
  const key = world.player.powerUpSlots[slotIndex];

  if (!key) {
    setMessage(world, `Power-up slot ${slotIndex + 1} is empty`, 0.8);
    return false;
  }

  world.player.powerUpSlots[slotIndex] = null;
  activatePowerUp(world, key);
  return true;
}

export function getStoredPowerUps(world) {
  return world.player.powerUpSlots.map((key, index) => {
    if (!key) {
      return null;
    }

    return {
      key,
      slotIndex: index,
      hotkey: index === 0 ? "Z" : "X",
      label: getPowerUpPresentation(world, key).label,
      short: getPowerUpPresentation(world, key).short,
      color: POWER_UPS[key].color,
    };
  });
}

export function getPlayerSpeed(world) {
  return world.player.speed * (hasPowerUp(world, "haste") ? 1.75 : 1);
}

export function getPlayerDamageMultiplier(world) {
  return hasPowerUp(world, "berserk") ? 2 : 1;
}

export function getWeaponCooldown(world, weapon) {
  let multiplier = hasPowerUp(world, "rapidFire") ? 0.45 : 1;

  if (weapon.type === "melee" && hasPowerUp(world, "longArms")) {
    multiplier *= 0.75;
  }

  return weapon.cooldown * multiplier;
}

export function getWeaponAmmoCost(world, weapon) { return hasPowerUp(world, "overcharge") ? 0 : (weapon.ammoCost ?? 0); }

export function getProjectileSpeed(world, weapon) {
  let multiplier = 1;
  if (hasPowerUp(world, "overcharge")) multiplier *= 1.25;
  if (hasPowerUp(world, "precision")) multiplier *= 1.25;
  return weapon.bulletSpeed * multiplier;
}

export function getWeaponSpread(world, weapon) {
  let spread = weapon.spread ?? 0;
  if (hasPowerUp(world, "precision")) spread *= 0.2;
  if (hasPowerUp(world, "scattershot")) {
    spread = Math.max(spread, 0.07) * 1.25;
  }
  return spread;
}

export function getWeaponPellets(world, weapon) {
  if (!weapon.pellets) {
    return 1;
  }

  if (hasPowerUp(world, "scattershot")) {
    return weapon.pellets + (weapon.pellets === 1 ? 3 : 5);
  }

  return weapon.pellets;
}

export function getMeleeReach(world, weapon) {
  return weapon.reach + (hasPowerUp(world, "longArms") ? 1.6 : 0);
}

export function getMeleeArc(world, weapon) {
  return weapon.arc + (hasPowerUp(world, "longArms") ? 0.75 : 0);
}

export function getPlayerPickupBonus(world) {
  return hasPowerUp(world, "magnet") ? 0.5 : 0;
}

export function getDamageTakenMultiplier(world) {
  return hasPowerUp(world, "shield") ? 0.5 : 1;
}

export function getProjectilePierce(world) {
  return hasPowerUp(world, "pierce") ? 5 : 0;
}

export function applyPlayerHitEffects(world, dealtDamage) {
  if (hasPowerUp(world, "vampirism")) {
    const lifesteal = Math.max(1, Math.round(dealtDamage * 0.22));
    world.player.hp = clamp(
      world.player.hp + lifesteal,
      0,
      world.player.maxHp,
    );
  }
}

export function smashWallTile(world, tileX, tileY, powerUpKey = null) {
  if (
    tileX <= 0 ||
    tileY <= 0 ||
    tileX >= world.width - 1 ||
    tileY >= world.height - 1
  ) {
    return false;
  }

  if (world.grid[tileY][tileX] === STEEL_WALL) {
    if (isLabyrinthWorld(world)) {
      setMessage(world, "Steel wall — cannot be smashed", 0.75);
    }
    return false;
  }

  if (world.grid[tileY][tileX] !== WALL) {
    return false;
  }

  if (powerUpKey) {
    if (isLabyrinthWorld(world) && powerUpKey === "breaker") {
      if (!labyrinthBreakerActive(world)) {
        return false;
      }
    } else {
      const state = world.player.powerUps[powerUpKey];

      if (!state || state.endsAt <= world.time || (state.charges ?? 0) <= 0) {
        return false;
      }
    }
  }

  world.grid[tileY][tileX] = FLOOR;
  world.floorTiles.push({ x: tileX, y: tileY });
  world.floorCount += 1;
  world.distanceTimer = 0;
  world.distanceFieldDirty = true;
  world.minimapDirty = true;

  if (powerUpKey && !isLabyrinthWorld(world)) {
    const state = world.player.powerUps[powerUpKey];
    state.charges = Math.max(0, (state.charges ?? 1) - 1);

    if (state.charges === 0) {
      state.endsAt = world.time;
      setMessage(
        world,
        powerUpKey === "breaker"
          ? "Wall Breaker depleted"
          : "Demolition charges depleted",
        0.9,
      );
    }
  }

  return true;
}

export function trySmashWalls(world, entity, moveX, moveY) { if (!hasPowerUp(world, "breaker")) { return false; }

const smashed = []; const radius = entity.radius + 0.55;

if (moveX !== 0) { const tileX = Math.floor(entity.x + Math.sign(moveX) * radius); const baseY = Math.floor(entity.y); smashed.push(smashWallTile(world, tileX, baseY, "breaker")); smashed.push(smashWallTile(world, tileX, baseY + 1, "breaker")); smashed.push(smashWallTile(world, tileX, baseY - 1, "breaker")); }

if (moveY !== 0) { const tileY = Math.floor(entity.y + Math.sign(moveY) * radius); const baseX = Math.floor(entity.x); smashed.push(smashWallTile(world, baseX, tileY, "breaker")); smashed.push(smashWallTile(world, baseX + 1, tileY, "breaker")); smashed.push(smashWallTile(world, baseX - 1, tileY, "breaker")); }

if (smashed.some(Boolean)) { setMessage(world, "Wall smashed!", 0.45); return true; }

return false; }

export function activatePowerUp(world, key) {
  const player = world.player;
  const powerUp = getPowerUpPresentation(world, key);
  const wasActive = hasPowerUp(world, key);
  const duration = getPowerUpDuration(key);

  if (key === "juggernaut" && !wasActive) {
    player.maxHp = Math.round(player.baseMaxHp * 2.2);
    player.hp = clamp(
      player.hp + Math.round(player.baseMaxHp),
      0,
      player.maxHp,
    );
  }

  if (key === "ammoSurge") {
    player.ammo = clamp(player.ammo + 50, 0, MAX_AMMO);
  }

  if (key === "regen") {
    player.hp = clamp(player.hp + 25, 0, player.maxHp);
  }

  const nextState = { endsAt: world.time + duration };

  if (POWER_UP_WALL_BREAK_CHARGES[key]) {
    nextState.charges = POWER_UP_WALL_BREAK_CHARGES[key];
  }

  player.powerUps[key] = nextState;
  queueSfx(world, "powerUpUse", { powerUpKey: key });

  setMessage(world, `${powerUp.label} for ${duration}s`, 1.4);
}

export function expirePowerUp(world, key) {
  const player = world.player;
  delete player.powerUps[key];

  if (key === "juggernaut") {
    player.maxHp = player.baseMaxHp;
    player.hp = clamp(player.hp, 0, player.maxHp);
  }
}

export function updatePowerUps(world, dt) {
  const player = world.player;

  if (hasPowerUp(world, "regen")) {
    player.hp = clamp(player.hp + 7 * dt, 0, player.maxHp);
  }

  if (hasPowerUp(world, "ammoSurge")) {
    player.ammo = clamp(player.ammo + 10 * dt, 0, MAX_AMMO);
  }

  for (const [key, state] of Object.entries(player.powerUps)) {
    if (state.endsAt <= world.time) {
      expirePowerUp(world, key);
    }
  }
}

export function updateVisionCache(world) {
  world.vision = {
    sightBonus: hasPowerUp(world, "sonar") ? 3 : 0,
    facingX: Math.cos(world.player.facing),
    facingY: Math.sin(world.player.facing),
  };
}

export function visibleStrengthAt(world, tileX, tileY) {
const player = world.player;
const centerX = tileX + 0.5;
const centerY = tileY + 0.5;
const dx = centerX - player.x;
const dy = centerY - player.y;
const distance = Math.hypot(dx, dy);
const vision = world.vision ?? {
  sightBonus: hasPowerUp(world, "sonar") ? 3 : 0,
  facingX: Math.cos(player.facing),
  facingY: Math.sin(player.facing),
};
const dot =
  distance > 0
    ? (dx * vision.facingX + dy * vision.facingY) / distance
    : 1;

if (isLabyrinthWorld(world)) {
  const radius = world.labyrinth.sightRadius;

  if (distance <= radius) { return 1; }

  if (distance <= radius + 2.6 && dot > 0.88) { return 0.62; }

  if (distance <= radius + 1.2 && dot > 0.62) { return 0.28; }

  return 0;
}

if (distance <= 5 + vision.sightBonus) { return 1; }

if (distance <= 7.25 + vision.sightBonus && dot > 0.82) { return 0.72; }

if (distance <= 6.25 + vision.sightBonus && dot > 0.55) { return 0.34; }

return 0;
}

export function revealAroundPlayer(world) {
if (isLabyrinthWorld(world)) {
  return;
}

let discoveredCount = world.player.discoveredFloor; let minimapChanged = false; const sightBonus = world.vision?.sightBonus ?? 0; const revealRadius = Math.ceil(VISION_MARGIN + sightBonus); const minX = Math.max(0, Math.floor(world.player.x) - revealRadius); const maxX = Math.min(world.width - 1, Math.ceil(world.player.x) + revealRadius); const minY = Math.max(0, Math.floor(world.player.y) - revealRadius); const maxY = Math.min(world.height - 1, Math.ceil(world.player.y) + revealRadius);

for (let y = minY; y <= maxY; y += 1) { for (let x = minX; x <= maxX; x += 1) { const strength = visibleStrengthAt(world, x, y); if (strength <= 0.24) { continue; }

  const idx = indexOfTile(world.width, x, y);
  if (world.discovered[idx] === 1) {
    continue;
  }

  world.discovered[idx] = 1;
  minimapChanged = true;
  if (world.grid[y][x] === FLOOR) {
    discoveredCount += 1;
  }
}

}

world.player.discoveredFloor = discoveredCount; if (minimapChanged) { world.minimapDirty = true; } }

export function setMessage(world, text, ttl = 2.5) { world.message = text; world.messageTtl = ttl; }

export function toggleLabels(world) { world.labelsOn = !world.labelsOn; setMessage(world, world.labelsOn ? "Labels on" : "Labels off", 1); }

export function getWorldRenderZoom(world) {
  return world.mobileView && world.viewMode === "2d"
    ? MOBILE_2D_ZOOM
    : 1;
}

export function getCamera(world) {
  const zoom = getWorldRenderZoom(world);
  const visibleWidth = CANVAS_WIDTH / (DRAW_TILE * zoom);
  const visibleHeight = CANVAS_HEIGHT / (DRAW_TILE * zoom);
  const maxX = Math.max(0, world.width - visibleWidth);
  const maxY = Math.max(0, world.height - visibleHeight);

  return {
    x: clamp(world.player.x - visibleWidth / 2, 0, maxX),
    y: clamp(world.player.y - visibleHeight / 2, 0, maxY),
  };
}

export function screenToWorld(world, screenX, screenY) {
  const camera = getCamera(world);
  const zoom = getWorldRenderZoom(world);

  return {
    x: camera.x + screenX / (DRAW_TILE * zoom),
    y: camera.y + screenY / (DRAW_TILE * zoom),
  };
}

export function getAimVector(world) {
  const player = world.player;

  if (world.viewMode === "3d") {
    return { x: Math.cos(player.facing), y: Math.sin(player.facing) };
  }

  const pointerWorld = screenToWorld(world, world.pointer.x, world.pointer.y);
  const dx = pointerWorld.x - player.x;
  const dy = pointerWorld.y - player.y;

  if (Math.hypot(dx, dy) > 0.01) {
    const direction = normalize(dx, dy);
    player.facing = Math.atan2(direction.y, direction.x);
    return direction;
  }

  return { x: Math.cos(player.facing), y: Math.sin(player.facing) };
}

export function selectWeapon(world, weaponKey) {
  if (!world.player.ownedWeapons[weaponKey] || world.player.weapon === weaponKey) {
    return false;
  }

  world.player.weapon = weaponKey;
  queueSfx(world, "weaponSelect", { weaponKey });
  setMessage(world, `${getWeaponLabel(world, weaponKey)} equipped`, 1.3);
  return true;
}

export function meleeAttack(world, weapon, direction) {
  const player = world.player;
  const meleeBoost = hasPowerUp(world, "longArms") ? 1.35 : 1;
  const damage = Math.round(
    weapon.damage * getPlayerDamageMultiplier(world) * meleeBoost,
  );
  const reach = getMeleeReach(world, weapon);
  const arc = getMeleeArc(world, weapon);
  let hitCount = 0;

player.meleeSwing = {
  startedAt: world.time,
  duration: clamp(weapon.cooldown * 0.72, 0.15, 0.26),
  weaponKey: player.weapon,
  directionAngle: Math.atan2(direction.y, direction.x),
};
queueSfx(world, "weaponAttack", { weaponKey: player.weapon });

for (const enemy of world.enemies) { const dx = enemy.x - player.x; const dy = enemy.y - player.y; const distance = Math.hypot(dx, dy); const overlapping = distance <= enemy.radius + player.radius + 0.08;

if (distance > reach + enemy.radius) {
  continue;
}

if (!overlapping) {
  const angleToEnemy = Math.atan2(dy, dx);
  const swingCenter = Math.atan2(direction.y, direction.x);

  if (Math.abs(angleDelta(angleToEnemy, swingCenter)) > arc / 2) {
    continue;
  }

  if (!hasLineOfSight(world, player.x, player.y, enemy.x, enemy.y)) {
    continue;
  }
}

enemy.hp -= damage;
enemy.awake = true;
enemy.lastHitAt = world.time;
queueSfx(world, "enemyHit", { enemyKind: enemy.kind });
applyPlayerHitEffects(world, damage);

const impactDirection = Math.atan2(enemy.y - player.y, enemy.x - player.x);
if (enemy.kind === "turret") {
  spawnSparks(world, enemy.x, enemy.y, impactDirection, 1.1);
  spawnImpact(world, enemy.x, enemy.y, "#5eead4", 1.05);
} else {
  spawnBlood(world, enemy.x, enemy.y, impactDirection, 1.05);
  spawnImpact(
    world,
    enemy.x,
    enemy.y,
    world.level.themeKey === "space" ? "#cbd5e1" : "#fca5a5",
    world.level.themeKey === "space" ? 1.05 : 0.9,
  );
}

hitCount += 1;

if (hitCount >= 3) {
  break;
}

}

if (hitCount > 0) { setMessage(world, hitCount === 1 ? "Hit!" : `${hitCount} hits!`, 0.7); } }

export function rangedAttack(world, weapon, direction) {
  const player = world.player;
  const ammoCost = getWeaponAmmoCost(world, weapon);
  const pelletCount = getWeaponPellets(world, weapon);
  const projectileSpeed = getProjectileSpeed(world, weapon);
  const precisionBoost = hasPowerUp(world, "precision") ? 1.18 : 1;
  const overchargeBoost = hasPowerUp(world, "overcharge") ? 1.1 : 1;
  const pierceBoost = hasPowerUp(world, "pierce") ? 1.12 : 1;
  const basePellets = Math.max(1, weapon.pellets ?? 1);
  const scatterTotalBoost = hasPowerUp(world, "scattershot") ? 1.7 : 1;
  const scatterPerProjectileScale = hasPowerUp(world, "scattershot")
    ? (basePellets * scatterTotalBoost) / pelletCount
    : 1;
  const damage = Math.max(
    1,
    Math.round(
      weapon.damage *
        getPlayerDamageMultiplier(world) *
        precisionBoost *
        overchargeBoost *
        pierceBoost *
        scatterPerProjectileScale,
    ),
  );

if (player.ammo < ammoCost) {
  queueSfx(world, "outOfAmmo");
  setMessage(world, `Out of ${getAmmoMessageLabel(world)}`, 0.8);
  return;
}

player.ammo -= ammoCost;
queueSfx(world, "weaponAttack", { weaponKey: player.weapon });

const medievalArchery = isMedievalTheme(world);
if (!medievalArchery) {
  const muzzleAngle = Math.atan2(direction.y, direction.x);
  const muzzleX = player.x + direction.x * 0.5;
  const muzzleY = player.y + direction.y * 0.5;
  spawnMuzzleFlash(
    world,
    muzzleX,
    muzzleY,
    muzzleAngle,
    hasPowerUp(world, "overcharge") ? "#facc15" : "#fde047",
    weapon === WEAPONS.shotgun ? 0.9 : weapon === WEAPONS.revolver ? 0.75 : 0.62,
  );
}

for (let i = 0; i < pelletCount; i += 1) { const baseAngle = Math.atan2(direction.y, direction.x); const spreadRange = getWeaponSpread(world, weapon); const spread = spreadRange ? rand(-spreadRange, spreadRange) : 0; const angle = baseAngle + spread;

spawnProjectile(world, {
  x: player.x + Math.cos(angle) * 0.42,
  y: player.y + Math.sin(angle) * 0.42,
  vx: Math.cos(angle) * projectileSpeed,
  vy: Math.sin(angle) * projectileSpeed,
  damage,
  owner: "player",
  ttl: weapon.range / projectileSpeed,
  piercesLeft: getProjectilePierce(world),
  breaksWalls: hasPowerUp(world, "demolition"),
  isArrow: medievalArchery,
  weaponKey: player.weapon,
  color: medievalArchery
    ? hasPowerUp(world, "overcharge")
      ? "#facc15"
      : "#d6a85f"
    : hasPowerUp(world, "overcharge")
      ? "#facc15"
      : "#fde047",
});

} }

export function attack(world) {
const player = world.player;

if (isLabyrinthWorld(world)) { return; }

if (world.gameOver || world.victory || world.time < player.nextAttackAt) { return; }

const weapon = WEAPONS[player.weapon]; const direction = getAimVector(world); player.nextAttackAt = world.time + getWeaponCooldown(world, weapon);

if (weapon.type === "melee") { meleeAttack(world, weapon, direction); } else { rangedAttack(world, weapon, direction); } }

export function updatePlayer3D(world, keys, dt) {
  const player = world.player;
  const forwardInput =
    Number(Boolean(keys.w || keys.ArrowUp)) -
    Number(Boolean(keys.s || keys.ArrowDown));
  const strafeInput = Number(Boolean(keys.d)) - Number(Boolean(keys.a));
  const turnInput =
    Number(Boolean(keys.ArrowRight)) - Number(Boolean(keys.ArrowLeft));

  if (turnInput !== 0) {
    player.facing += turnInput * VIEW_3D_TURN_SPEED * dt;
  }

  if (forwardInput !== 0 || strafeInput !== 0) {
    const forwardX = Math.cos(player.facing);
    const forwardY = Math.sin(player.facing);
    const rightX = -forwardY;
    const rightY = forwardX;
    const movement = normalize(
      forwardX * forwardInput + rightX * strafeInput,
      forwardY * forwardInput + rightY * strafeInput,
    );
    const speed = getPlayerSpeed(world);

    trySmashWalls(world, player, movement.x, movement.y);
    moveWithCollisions(
      world,
      player,
      movement.x * speed * dt,
      movement.y * speed * dt,
    );
  }

  if (keys[" "] || keys.Enter || world.pointer.down) {
    attack(world);
  }

  const playerTileX = Math.floor(player.x);
  const playerTileY = Math.floor(player.y);

  if (
    playerTileX !== world.lastPlayerTile.x ||
    playerTileY !== world.lastPlayerTile.y
  ) {
    world.lastPlayerTile = { x: playerTileX, y: playerTileY };
    world.distanceTimer = 0;
    world.distanceFieldDirty = true;
  }
}

export function updatePlayer(world, keys, dt) {
  if (world.viewMode === "3d") {
    updatePlayer3D(world, keys, dt);
    return;
  }

  const player = world.player;
  let moveX = 0;
  let moveY = 0;

if (keys.ArrowUp || keys.w) moveY -= 1; if (keys.ArrowDown || keys.s) moveY += 1; if (keys.ArrowLeft || keys.a) moveX -= 1; if (keys.ArrowRight || keys.d) moveX += 1;

if (moveX !== 0 || moveY !== 0) { const direction = normalize(moveX, moveY); const speed = getPlayerSpeed(world); trySmashWalls(world, player, direction.x, direction.y); moveWithCollisions( world, player, direction.x * speed * dt, direction.y * speed * dt, );

if (!world.pointer.inside) {
  player.facing = Math.atan2(direction.y, direction.x);
}

}

if (world.pointer.inside) { getAimVector(world); }

if (keys[" "] || keys.Enter || world.pointer.down) { attack(world); }

const playerTileX = Math.floor(player.x); const playerTileY = Math.floor(player.y);

if ( playerTileX !== world.lastPlayerTile.x || playerTileY !== world.lastPlayerTile.y ) { world.lastPlayerTile = { x: playerTileX, y: playerTileY }; world.distanceTimer = 0; world.distanceFieldDirty = true; } }

export function updatePickups(world, dt) {
  const player = world.player;
  const remaining = [];
  const pickupBonus = getPlayerPickupBonus(world);
  const magnetActive = hasPowerUp(world, "magnet");
  const magnetRadius = 7;
  const magnetPullSpeed = 11;

for (const pickup of world.pickups) {
  let dx = player.x - pickup.x;
  let dy = player.y - pickup.y;
  let distance = Math.hypot(dx, dy);
  const collectRadius = pickup.radius + player.radius + 0.1 + pickupBonus;

  if (
    magnetActive &&
    distance > collectRadius &&
    distance <= magnetRadius
  ) {
    const direction = normalize(dx, dy);
    const pullDistance = Math.min(
      distance - collectRadius,
      magnetPullSpeed * dt,
    );
    pickup.x += direction.x * pullDistance;
    pickup.y += direction.y * pullDistance;
    dx = player.x - pickup.x;
    dy = player.y - pickup.y;
    distance = Math.hypot(dx, dy);
  }

if (distance > collectRadius) {
  remaining.push(pickup);
  continue;
}

if (pickup.type === "labyrinthBreaker") {
  if (collectLabyrinthBreaker(world)) {
    queueSfx(world, "pickupPowerUp", { powerUpKey: "breaker" });
    continue;
  }

  remaining.push(pickup);
  continue;
}

if (pickup.type === "weapon") {
  if (!player.ownedWeapons[pickup.weapon]) {
    player.ownedWeapons[pickup.weapon] = true;
    const hotkeyIndex = WEAPON_ORDER.indexOf(pickup.weapon);
    const hotkeyLabel = hotkeyIndex >= 0 && hotkeyIndex < 9 ? String(hotkeyIndex + 1) : "";
    queueSfx(world, "pickupWeapon", { weaponKey: pickup.weapon });
    setMessage(
      world,
      `${getWeaponLabel(world, pickup.weapon)} unlocked${hotkeyLabel ? ` — press ${hotkeyLabel} or click it` : ""}`,
      2,
    );
  }
  continue;
}

if (pickup.type === "ammo") {
  const before = player.ammo;
  player.ammo = clamp(player.ammo + pickup.amount, 0, MAX_AMMO);
  const gained = Math.max(0, Math.floor(player.ammo) - Math.floor(before));

  if (gained > 0) {
    queueSfx(world, "pickupAmmo");
    setMessage(world, `+${gained} ${getAmmoMessageLabel(world)}`, 1.2);
  } else {
    setMessage(world, `${getAmmoLabel(world)} full`, 1.2);
  }
  continue;
}

if (pickup.type === "medkit") {
  const before = player.hp;
  player.hp = clamp(player.hp + pickup.amount, 0, player.maxHp);
  const restored = Math.max(0, Math.round(player.hp - before));

  if (restored > 0) {
    queueSfx(world, "pickupHealth");
    setMessage(world, `+${restored} health`, 1.2);
  }
  continue;
}

if (pickup.type === "powerup") {
  if (storePowerUp(world, pickup.powerUp)) {
    continue;
  }

  remaining.push(pickup);
  continue;
}

remaining.push(pickup);

}

world.pickups = remaining; }

export function computeDistanceField(world) { const playerTile = { x: clamp(Math.floor(world.player.x), 0, world.width - 1), y: clamp(Math.floor(world.player.y), 0, world.height - 1), };

world.distanceField = bfsDistances(world, playerTile); world.distanceFieldDirty = false; }

export function enemyTargetTile(world, enemy) { const enemyTileX = clamp(Math.floor(enemy.x), 0, world.width - 1); const enemyTileY = clamp(Math.floor(enemy.y), 0, world.height - 1); const hereIndex = indexOfTile(world.width, enemyTileX, enemyTileY); const hereDistance = world.distanceField[hereIndex];

const options = [ { x: enemyTileX + 1, y: enemyTileY }, { x: enemyTileX - 1, y: enemyTileY }, { x: enemyTileX, y: enemyTileY + 1 }, { x: enemyTileX, y: enemyTileY - 1 }, ].filter((tile) => isWalkable(world, tile.x, tile.y));

let bestTile = null; let bestDistance = hereDistance;

for (const tile of options) { const nextDistance = world.distanceField[indexOfTile(world.width, tile.x, tile.y)];

if (nextDistance === -1) {
  continue;
}

if (hereDistance === -1 || nextDistance < bestDistance) {
  bestDistance = nextDistance;
  bestTile = tile;
}

}

return bestTile; }

export function moveEnemyTowardTile(world, enemy, tile, speed, dt) { if (!tile) { return false; }

const startX = enemy.x; const startY = enemy.y; const center = tileCenter(tile); const move = normalize(center.x - enemy.x, center.y - enemy.y);

moveWithCollisions(world, enemy, move.x * speed * dt, move.y * speed * dt);

return Math.hypot(enemy.x - startX, enemy.y - startY) > 0.0001; }

export function moveEnemyTowardPoint(world, enemy, targetX, targetY, speed, dt) { const startX = enemy.x; const startY = enemy.y; const step = speed * dt; const direction = normalize(targetX - enemy.x, targetY - enemy.y);

moveWithCollisions(world, enemy, direction.x * step, direction.y * step);

if (Math.hypot(enemy.x - startX, enemy.y - startY) > 0.0001) { return true; }

const deltaX = targetX - startX; const deltaY = targetY - startY;

const primaryMoves = Math.abs(deltaX) >= Math.abs(deltaY) ? [ { dx: Math.sign(deltaX) * step, dy: 0 }, { dx: 0, dy: Math.sign(deltaY) * step }, ] : [ { dx: 0, dy: Math.sign(deltaY) * step }, { dx: Math.sign(deltaX) * step, dy: 0 }, ];

const detours = Math.abs(deltaX) >= Math.abs(deltaY) ? [ { dx: 0, dy: step }, { dx: 0, dy: -step }, ] : [ { dx: step, dy: 0 }, { dx: -step, dy: 0 }, ];

for (const option of [...primaryMoves, ...detours]) { moveWithCollisions(world, enemy, option.dx, option.dy); if (Math.hypot(enemy.x - startX, enemy.y - startY) > 0.0001) { return true; } }

return false; }

export function moveEnemyTowardPlayer(world, enemy, speed, dt) { const nextTile = enemyTargetTile(world, enemy);

if (nextTile && moveEnemyTowardTile(world, enemy, nextTile, speed, dt)) { return; }

moveEnemyTowardPoint(world, enemy, world.player.x, world.player.y, speed, dt); }

export function moveEnemyAwayFromPlayer(world, enemy, speed, dt) { const dx = enemy.x - world.player.x; const dy = enemy.y - world.player.y;

return moveEnemyTowardPoint( world, enemy, enemy.x + dx, enemy.y + dy, speed, dt, ); }

export function strafeEnemyAroundPlayer(world, enemy, speed, dt) { const dx = enemy.x - world.player.x; const dy = enemy.y - world.player.y; const length = Math.hypot(dx, dy) || 1;

return moveEnemyTowardPoint( world, enemy, enemy.x + (-dy / length) * enemy.orbitDir, enemy.y + (dx / length) * enemy.orbitDir, speed, dt, ); }

export function fireEnemyProjectiles(world, enemy, config, aimX, aimY) { const projectileCount = config.projectileCount ?? 1; const spread = config.projectileSpread ?? 0; const baseAngle = Math.atan2(aimY, aimX);

spawnMuzzleFlash(
  world,
  enemy.x + Math.cos(baseAngle) * (enemy.radius + 0.14),
  enemy.y + Math.sin(baseAngle) * (enemy.radius + 0.14),
  baseAngle,
  config.projectileColor ?? enemy.color ?? "#34d399",
  enemy.kind === "turret" ? 0.72 : 0.55,
);

for (let i = 0; i < projectileCount; i += 1) { let offset = 0;

if (projectileCount === 1) {
  offset = spread ? rand(-spread, spread) : 0;
} else {
  offset = lerp(-spread, spread, i / Math.max(1, projectileCount - 1));
}

const angle = baseAngle + offset;
const speed = config.projectileSpeed;
const damage = enemy.projectileDamage || config.projectileDamage;

spawnProjectile(world, {
  x: enemy.x + Math.cos(angle) * (enemy.radius + 0.12),
  y: enemy.y + Math.sin(angle) * (enemy.radius + 0.12),
  vx: Math.cos(angle) * speed,
  vy: Math.sin(angle) * speed,
  damage,
  owner: "enemy",
  sourceX: enemy.x,
  sourceY: enemy.y,
  ttl: Math.max(1.05, (config.attackRange ?? 8) / speed),
  color: config.projectileColor ?? enemy.color ?? config.color,
});

} }

export function damagePlayer(world, amount, sourceX = null, sourceY = null) {
  if (world.gameOver || world.victory) {
    return;
  }

  if (hasPowerUp(world, "phaseWalk")) {
    return;
  }

const actualDamage = Math.max( 1, Math.round(amount * getDamageTakenMultiplier(world)), );

world.player.hp = clamp(world.player.hp - actualDamage, 0, world.player.maxHp);
world.damageFlash = Math.min(0.92, (world.damageFlash ?? 0) + 0.46);
world.damageKick = Math.min(1, (world.damageKick ?? 0) + 0.58);
world.lastDamageAt = world.time;
queueSfx(world, "playerHit");

if (Number.isFinite(sourceX) && Number.isFinite(sourceY)) {
  const sourceAngle = Math.atan2(
    sourceY - world.player.y,
    sourceX - world.player.x,
  );
  world.damageDirection = angleDelta(sourceAngle, world.player.facing);
}
spawnBlood(world, world.player.x, world.player.y, null, 0.75);
spawnImpact(world, world.player.x, world.player.y, "#fb7185", 0.8);

if (world.player.hp <= 0) {
  spawnExplosion(world, world.player.x, world.player.y, {
    size: 1.15,
    colors: ["#ef4444", "#fb7185", "#f97316"],
  });
  world.gameOver = true;
  queueSfx(world, "gameOver");
  const displayName = getPlayerDisplayName(world);
  setMessage(
    world,
    displayName === "You"
      ? "You were overwhelmed."
      : `${displayName} was overwhelmed.`,
    99,
  );
} }

export function updateEnemies(world, dt) { const player = world.player; const alive = [];

for (const enemy of world.enemies) { if (enemy.hp <= 0) { world.kills += 1; queueSfx(world, "enemyDeath", { enemyKind: enemy.kind });

  if (world.level.themeKey === "space") {
    const debrisIntensity =
      enemy.kind === "warden"
        ? 2.15
        : enemy.kind === "brute"
          ? 1.75
          : enemy.kind === "turret"
            ? 1.55
            : 1.35;

    spawnShipDebris(world, enemy.x, enemy.y, null, debrisIntensity);
    spawnImpact(world, enemy.x, enemy.y, "#cbd5e1", 1.15);

    if (enemy.kind === "turret" || enemy.kind === "brute" || enemy.kind === "warden") {
      spawnSparks(world, enemy.x, enemy.y, null, debrisIntensity * 0.9);
    }
  } else if (enemy.kind === "turret" || enemy.kind === "brute" || enemy.kind === "warden") {
    spawnExplosion(world, enemy.x, enemy.y, {
      size: enemy.kind === "warden" ? 1.3 : enemy.kind === "brute" ? 1.05 : 0.9,
      colors:
        enemy.kind === "turret"
          ? ["#14b8a6", "#5eead4", "#facc15"]
          : ["#ef4444", "#f97316", "#facc15"],
    });
  } else {
    spawnBlood(world, enemy.x, enemy.y, null, 1.35);
    spawnImpact(world, enemy.x, enemy.y, "#fecaca", 1.1);
  }

  if (hasPowerUp(world, "bounty")) {
    world.player.ammo = clamp(world.player.ammo + 10, 0, MAX_AMMO);
    world.player.hp = clamp(
      world.player.hp + 7,
      0,
      world.player.maxHp,
    );
  }

  continue;
}

const config = ENEMY_TYPES[enemy.kind];
const dxToPlayer = player.x - enemy.x;
const dyToPlayer = player.y - enemy.y;
const distanceToPlayer = Math.hypot(dxToPlayer, dyToPlayer);
const fieldDistance =
  world.distanceField[
    indexOfTile(world.width, Math.floor(enemy.x), Math.floor(enemy.y))
  ];

if (
  !enemy.awake &&
  (distanceToPlayer <= config.alertRadius ||
    (fieldDistance !== -1 && fieldDistance <= config.alertRadius))
) {
  enemy.awake = true;
}

const enemyTileX = Math.floor(enemy.x);
const enemyTileY = Math.floor(enemy.y);
const playerCanSeeEnemy =
  enemy.awake &&
  visibleStrengthAt(world, enemyTileX, enemyTileY) > 0.24 &&
  hasLineOfSight(
    world,
    player.x,
    player.y,
    enemy.x,
    enemy.y,
  );

const pursuitDelta = playerCanSeeEnemy
  ? dt / ENEMY_PURSUIT_RAMP_SECONDS
  : -dt / ENEMY_PURSUIT_DECAY_SECONDS;

enemy.pursuitHeat = clamp(
  (enemy.pursuitHeat ?? 0) + pursuitDelta,
  0,
  1,
);

if (enemy.awake) {
  const frostMultiplier = hasPowerUp(world, "frost") ? 0.5 : 1;
  const chargeMultiplier =
    enemy.kind === "charger" &&
    distanceToPlayer <= (config.chargeRange ?? 0)
      ? config.chargeSpeedMultiplier ?? 1
      : 1;
  const pursuitMultiplier = lerp(
    1,
    ENEMY_PURSUIT_MAX_SPEED_MULTIPLIER,
    enemy.pursuitHeat,
  );

  const moveSpeed =
    enemy.speed *
    frostMultiplier *
    chargeMultiplier *
    pursuitMultiplier;
  const isRanged =
    Number.isFinite(config.attackRange) &&
    Number.isFinite(config.projectileSpeed) &&
    Number.isFinite(enemy.projectileDamage || config.projectileDamage);

  if (isRanged) {
    const canSeePlayer = hasLineOfSight(
      world,
      enemy.x,
      enemy.y,
      player.x,
      player.y,
    );
    const preferredRange = config.preferredRange ?? config.attackRange * 0.65;

    if (enemy.speed > 0) {
      if (!canSeePlayer || distanceToPlayer > preferredRange + 0.6) {
        moveEnemyTowardPlayer(world, enemy, moveSpeed, dt);
      } else if (distanceToPlayer < preferredRange * 0.58) {
        moveEnemyAwayFromPlayer(world, enemy, moveSpeed * 0.9, dt);
      } else {
        if (chance(0.015)) {
          enemy.orbitDir *= -1;
        }
        strafeEnemyAroundPlayer(world, enemy, moveSpeed * 0.72, dt);
      }
    }

    if (
      distanceToPlayer <= config.attackRange &&
      canSeePlayer &&
      world.time >= enemy.nextAttackAt
    ) {
      const aim = normalize(dxToPlayer, dyToPlayer);
      enemy.nextAttackAt =
        world.time + (enemy.attackCooldown || config.attackCooldown);
      enemy.lastAttackAt = world.time;
      enemy.attackStyle = "ranged";
      queueSfx(world, "enemyAttack", { enemyKind: enemy.kind, style: "ranged" });

      fireEnemyProjectiles(world, enemy, config, aim.x, aim.y);
    }
  } else {
    moveEnemyTowardPlayer(world, enemy, moveSpeed, dt);
  }
}

const touching =
  Math.hypot(enemy.x - player.x, enemy.y - player.y) <=
  enemy.radius + player.radius + 0.06;

const contactDamage = enemy.contactDamage || config.contactDamage || 0;

if (
  contactDamage > 0 &&
  touching &&
  world.time >= enemy.nextContactAt &&
  !hasPowerUp(world, "phaseWalk")
) {
  enemy.nextContactAt = world.time + config.contactCooldown;
  enemy.lastAttackAt = world.time;
  enemy.attackStyle = "contact";
  queueSfx(world, "enemyAttack", { enemyKind: enemy.kind, style: "contact" });
  damagePlayer(world, contactDamage, enemy.x, enemy.y);
}

alive.push(enemy);

}

world.enemies = alive; }

export function updateProjectiles(world, dt) { const nextProjectiles = [];

for (const projectile of world.projectiles) { projectile.ttl -= dt;

if (projectile.ttl <= 0) {
  continue;
}

const distance = Math.hypot(projectile.vx * dt, projectile.vy * dt);
const steps = Math.max(1, Math.ceil(distance / 0.08));
let destroyed = false;

for (let step = 0; step < steps; step += 1) {
  projectile.x += (projectile.vx * dt) / steps;
  projectile.y += (projectile.vy * dt) / steps;

  if (circleHitsWall(world, projectile.x, projectile.y, projectile.radius)) {
    const impactAngle = Math.atan2(-projectile.vy, -projectile.vx);
    spawnSparks(world, projectile.x, projectile.y, impactAngle, 0.85);
    spawnImpact(world, projectile.x, projectile.y, projectile.color, 0.65);

    if (projectile.owner === "player" && projectile.breaksWalls) {
      const wallBroken = smashWallTile(
        world,
        Math.floor(projectile.x),
        Math.floor(projectile.y),
        "demolition",
      );

      if (wallBroken) {
        spawnExplosion(world, projectile.x, projectile.y, {
          size: 0.72,
          colors: ["#f97316", "#facc15", "#94a3b8"],
        });
      }
    }

    destroyed = true;
    break;
  }

  if (projectile.owner === "player") {
    for (const enemy of world.enemies) {
      const hit =
        Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) <=
        projectile.radius + enemy.radius;

      if (!hit || projectile.hitIds.has(enemy.id)) {
        continue;
      }

      projectile.hitIds.add(enemy.id);
      enemy.hp -= projectile.damage;
      enemy.awake = true;
      enemy.lastHitAt = world.time;
      queueSfx(world, "enemyHit", { enemyKind: enemy.kind });
      applyPlayerHitEffects(world, projectile.damage);

      const hitDirection = Math.atan2(projectile.vy, projectile.vx);
      if (enemy.kind === "turret") {
        spawnSparks(world, projectile.x, projectile.y, hitDirection, 1.2);
        spawnImpact(world, projectile.x, projectile.y, "#5eead4", 1);
      } else {
        spawnBlood(world, projectile.x, projectile.y, hitDirection, 1);
        spawnImpact(world, projectile.x, projectile.y, "#fecaca", 0.9);
      }

      if (projectile.piercesLeft > 0) {
        projectile.piercesLeft -= 1;
        continue;
      }

      destroyed = true;
      break;
    }
  } else {
    const hitPlayer =
      Math.hypot(projectile.x - world.player.x, projectile.y - world.player.y) <=
      projectile.radius + world.player.radius;

    if (hitPlayer) {
      damagePlayer(
        world,
        projectile.damage,
        projectile.sourceX ?? projectile.x - projectile.vx,
        projectile.sourceY ?? projectile.y - projectile.vy,
      );
      destroyed = true;
    }
  }

  if (destroyed) {
    break;
  }
}

if (!destroyed) {
  nextProjectiles.push(projectile);
}

}

world.projectiles = nextProjectiles; }

export function addEffect(world, effect) {
  if (!world.effects) {
    world.effects = [];
  }

  world.effects.push({
    age: 0,
    ttl: 0.35,
    size: 0.12,
    vx: 0,
    vy: 0,
    drag: 0.9,
    gravity: 0,
    alpha: 1,
    ...effect,
  });

  if (world.effects.length > MAX_EFFECTS) {
    world.effects.splice(0, world.effects.length - MAX_EFFECTS);
  }
}

export function spawnParticleBurst(
  world,
  x,
  y,
  {
    count = 8,
    color = "#ffffff",
    colors = null,
    speed = 2.8,
    size = 0.12,
    ttl = 0.42,
    direction = null,
    spread = Math.PI * 2,
    gravity = 0,
    kind = "particle",
  } = {},
) {
  for (let index = 0; index < count; index += 1) {
    const baseAngle =
      direction === null ? rand(0, Math.PI * 2) : direction + rand(-spread / 2, spread / 2);
    const particleSpeed = speed * rand(0.45, 1.15);
    const palette = colors ?? [color];

    addEffect(world, {
      kind,
      x,
      y,
      vx: Math.cos(baseAngle) * particleSpeed,
      vy: Math.sin(baseAngle) * particleSpeed,
      size: size * rand(0.65, 1.3),
      ttl: ttl * rand(0.72, 1.2),
      color: palette[Math.floor(Math.random() * palette.length)] ?? color,
      gravity,
      drag: 0.9,
    });
  }
}

export function spawnMuzzleFlash(world, x, y, angle, color = "#fde047", size = 0.62) {
  addEffect(world, {
    kind: "muzzle",
    x: x + Math.cos(angle) * 0.12,
    y: y + Math.sin(angle) * 0.12,
    angle,
    color,
    size,
    ttl: 0.13,
    drag: 1,
  });

  spawnParticleBurst(world, x, y, {
    count: 5,
    colors: [color, "#fff7ed", "#fb923c"],
    speed: 3.7,
    size: 0.07,
    ttl: 0.2,
    direction: angle,
    spread: 0.65,
    kind: "spark",
  });
}

export function spawnShipDebris(world, x, y, direction = null, intensity = 1) {
  spawnParticleBurst(world, x, y, {
    count: Math.round(14 * intensity),
    colors: [
      "#dbeafe",
      "#cbd5e1",
      "#94a3b8",
      "#64748b",
      "#334155",
      "#38bdf8",
    ],
    speed: 3.7 * intensity,
    size: 0.14 * intensity,
    ttl: 0.82,
    direction,
    spread: direction === null ? Math.PI * 2 : 1.55,
    gravity: 1.05,
    kind: "shipDebris",
  });

  spawnParticleBurst(world, x, y, {
    count: Math.round(5 * intensity),
    colors: ["#67e8f9", "#bae6fd", "#f8fafc"],
    speed: 4.8 * intensity,
    size: 0.06 * intensity,
    ttl: 0.26,
    direction,
    spread: direction === null ? Math.PI * 2 : 1.15,
    kind: "spark",
  });
}

export function spawnBlood(world, x, y, direction = null, intensity = 1) {
  if (world?.level?.themeKey === "space") {
    spawnShipDebris(world, x, y, direction, intensity);
    return;
  }

  spawnParticleBurst(world, x, y, {
    count: Math.round(10 * intensity),
    colors: ["#ef4444", "#b91c1c", "#7f1d1d"],
    speed: 2.8 * intensity,
    size: 0.11 * intensity,
    ttl: 0.55,
    direction,
    spread: direction === null ? Math.PI * 2 : 1.5,
    gravity: 1.5,
    kind: "blood",
  });
}

export function spawnSparks(world, x, y, direction = null, intensity = 1) {
  spawnParticleBurst(world, x, y, {
    count: Math.round(9 * intensity),
    colors: ["#fef08a", "#facc15", "#fb923c", "#e0f2fe"],
    speed: 4.4 * intensity,
    size: 0.075 * intensity,
    ttl: 0.34,
    direction,
    spread: direction === null ? Math.PI * 2 : 1.2,
    kind: "spark",
  });
}

export function spawnImpact(world, x, y, color = "#ffffff", intensity = 1) {
  addEffect(world, {
    kind: "ring",
    x,
    y,
    color,
    size: 0.16 * intensity,
    endSize: 0.55 * intensity,
    ttl: 0.22,
    drag: 1,
  });
}

export function spawnExplosion(
  world,
  x,
  y,
  { size = 1, colors = ["#f97316", "#facc15", "#ef4444"] } = {},
) {
  addEffect(world, {
    kind: "explosion",
    x,
    y,
    color: colors[0],
    colors,
    size: 0.34 * size,
    endSize: 1.15 * size,
    ttl: 0.38,
    drag: 1,
  });

  spawnParticleBurst(world, x, y, {
    count: Math.round(18 * size),
    colors,
    speed: 5 * size,
    size: 0.1,
    ttl: 0.55,
    kind: "spark",
  });
}

export function updateEffects(world, dt) {
  if (!world.effects) {
    return;
  }

  const remaining = [];

  for (const effect of world.effects) {
    effect.age += dt;
    effect.ttl -= dt;

    if (effect.ttl <= 0) {
      continue;
    }

    const drag = Math.pow(effect.drag ?? 1, dt * 60);
    effect.vx *= drag;
    effect.vy *= drag;
    effect.vy += (effect.gravity ?? 0) * dt;
    effect.x += effect.vx * dt;
    effect.y += effect.vy * dt;
    remaining.push(effect);
  }

  world.effects = remaining;
  world.damageFlash = Math.max(0, (world.damageFlash ?? 0) - dt * 2.8);
  world.damageKick = Math.max(0, (world.damageKick ?? 0) - dt * 3.7);
}
