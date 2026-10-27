import { POWER_UPS } from "../config/powerUps.js";
import { ENEMY_TYPES } from "../config/enemies.js";

export const DEFENSE_COLUMNS = 18;
export const DEFENSE_ROWS = 12;
export const DEFENSE_WAVES = 20;
export const DEFENSE_SPEEDS = Object.freeze([1, 2, 3]);
export const DEFENSE_TYPES = Object.freeze({
  rapidFire: { ...POWER_UPS.rapidFire, cost: 90, damage: 7, cooldown: .24, range: 2.8, symbol: "R", description: "Fast bolts pick off the leading enemy." },
  frost: { ...POWER_UPS.frost, cost: 110, damage: 0, cooldown: 0, range: 2.3, symbol: "F", description: "A constant field slows every enemy inside by 40%." },
  demolition: { ...POWER_UPS.demolition, cost: 180, damage: 28, cooldown: 1.25, range: 3.1, splash: 1.2, symbol: "D", description: "Explosive blasts damage groups of enemies." },
  precision: { ...POWER_UPS.precision, cost: 150, damage: 42, cooldown: 1.5, range: 4.5, symbol: "P", description: "Long-range shots break through Brute and Warden armor." },
  overcharge: { ...POWER_UPS.overcharge, cost: 200, damage: 13, cooldown: .75, range: 3.1, symbol: "O", description: "Lightning jumps between three nearby enemies." },
});

// A fixed, winding route makes each placement readable and never lets towers block enemies.
export const DEFENSE_PATH = [];
for (const [from, to] of [
  [[0, 2], [4, 2]], [[4, 2], [4, 8]], [[4, 8], [10, 8]],
  [[10, 8], [10, 3]], [[10, 3], [14, 3]], [[14, 3], [14, 10]], [[14, 10], [17, 10]],
]) {
  const dx = Math.sign(to[0] - from[0]), dy = Math.sign(to[1] - from[1]);
  let x = from[0], y = from[1];
  if (DEFENSE_PATH.length) { x += dx; y += dy; }
  while (true) { DEFENSE_PATH.push(Object.freeze({ x: x + .5, y: y + .5 })); if (x === to[0] && y === to[1]) break; x += dx; y += dy; }
}
Object.freeze(DEFENSE_PATH);
const pathCells = new Set(DEFENSE_PATH.map(({ x, y }) => `${Math.floor(x)},${Math.floor(y)}`));
export const isDefensePath = (x, y) => pathCells.has(`${x},${y}`);

export function createDefenseGame() {
  return { status: "building", paused: false, speed: 1, wave: 0, lives: 20, energy: 270, kills: 0, time: 0,
    towers: [], enemies: [], effects: [], queue: [], spawnIn: 0, nextId: 1, selectedId: null,
    message: "Place your powerups beside the route, then start wave 1." };
}

export function setDefenseSpeed(game, speed) {
  if (!DEFENSE_SPEEDS.includes(speed)) return false;
  game.speed = speed;
  return true;
}

export function defenseTowerStats(tower) {
  const type = DEFENSE_TYPES[tower.type];
  const tier = tower.level - 1;
  return { ...type, damage: Math.round(type.damage * (1 + tier * .6)), range: type.range + tier * .35,
    cooldown: type.cooldown / (1 + tier * .12), slow: .6 - tier * .08,
    chain: 3 + tier, splash: (type.splash || 0) + tier * .2 };
}
export const defenseUpgradeCost = (tower) => Math.round(DEFENSE_TYPES[tower.type].cost * (.8 + (tower.level - 1) * .5));
export const defenseSellValue = (tower) => Math.floor(tower.spent * .7);

/** Shared by the current and next-level rows so the preview uses the actual combat values. */
export function defenseStatSummary(tower) {
  const stats = defenseTowerStats(tower);
  const parts = tower.type === "frost" ? [`${Math.round((1 - stats.slow) * 100)}% slow`] : [`${stats.damage} damage`, `${stats.cooldown.toFixed(2)}s cooldown`];
  parts.push(`${stats.range.toFixed(2)} tile range`);
  if (tower.type === "demolition") parts.push(`${stats.splash.toFixed(2)} tile splash`);
  if (tower.type === "overcharge") parts.push(`${stats.chain} chain targets`);
  if (tower.type === "precision") parts.push("ignores armor");
  return parts.join(" · ");
}

export function canPlaceDefense(game, type, x, y) {
  if (!["building", "running"].includes(game.status)) return "Restart to build again.";
  if (game.paused) return "Resume before building.";
  if (!DEFENSE_TYPES[type]) return "Choose a powerup first.";
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= DEFENSE_COLUMNS || y >= DEFENSE_ROWS) return "Choose a tile on the board.";
  if (isDefensePath(x, y)) return "The enemy route must stay clear.";
  if (game.towers.some((t) => t.x === x + .5 && t.y === y + .5)) return "A powerup already occupies this tile.";
  if (game.energy < DEFENSE_TYPES[type].cost) return "Not enough battlefield energy.";
  return null;
}

export function placeDefense(game, type, x, y) {
  const error = canPlaceDefense(game, type, x, y);
  if (error) { game.message = error; return false; }
  const cost = DEFENSE_TYPES[type].cost;
  const tower = { id: game.nextId++, type, x: x + .5, y: y + .5, level: 1, cooldown: 0, spent: cost, kills: 0, angle: 0 };
  game.towers.push(tower); game.energy -= cost; game.selectedId = tower.id;
  game.message = `${DEFENSE_TYPES[type].label} placed. Select it to upgrade or sell.`;
  return true;
}

export function upgradeDefense(game, id) {
  const tower = game.towers.find((t) => t.id === id);
  if (!tower || game.paused || !["building", "running"].includes(game.status)) return false;
  if (tower.level >= 3) { game.message = "This powerup is already level 3."; return false; }
  const cost = defenseUpgradeCost(tower);
  if (game.energy < cost) { game.message = "Not enough battlefield energy to upgrade."; return false; }
  game.energy -= cost; tower.spent += cost; tower.level++;
  game.message = `${DEFENSE_TYPES[tower.type].label} upgraded to level ${tower.level}.`; return true;
}

export function sellDefense(game, id) {
  const index = game.towers.findIndex((t) => t.id === id);
  if (index < 0 || game.paused || !["building", "running"].includes(game.status)) return false;
  const value = defenseSellValue(game.towers[index]);
  game.energy += value; game.towers.splice(index, 1); game.selectedId = null;
  game.message = `Powerup sold for ${value} energy.`; return true;
}

export function defenseWave(wave) {
  const keys = wave <= 2 ? ["skitter", "scout", "scout"] : wave === 3 ? ["skitter", "skitter", "crawler"]
    : wave < 6 ? ["crawler", "scout", "charger"] : wave < 8 ? ["skitter", "scout", "crawler", "charger", "spitter"]
    : wave % 5 === 3 ? ["skitter", "charger", "charger", "spitter"]
    : wave % 5 === 4 ? ["crawler", "brute", "brute", "spitter"]
    : ["skitter", "scout", "crawler", "charger", "spitter", "brute"];
  const enemies = Array.from({ length: 6 + wave * 2 }, (_, i) => keys[(i + wave) % keys.length]);
  if (wave % 5 === 0) enemies.push(...Array.from({ length: wave / 5 }, () => "warden"));
  return enemies;
}

export function defenseWaveBrief(wave) {
  if (wave % 5 === 0) return "Warden assault: heavy armor and a protective aura. Precision bypasses armor.";
  if (wave >= 8 && wave % 5 === 3) return "Rush: Chargers surge past gaps in your defenses. Slow them across several bends.";
  if (wave >= 8 && wave % 5 === 4) return "Siege: armored Brutes protect regenerating Crawlers. Focus sustained damage.";
  if (wave >= 11) return "Veterans: every fourth enemy has more health, speed, and resistance to slowing.";
  if (wave >= 6) return "Mixed groups: Spitters rally nearby enemies. Demolition and Overcharge break up packs.";
  if (wave >= 4) return "Chargers now surge forward. Keep more than one bend covered.";
  return "Build near bends to keep enemies in range. Energy comes from defeats and cleared waves.";
}

/** Fixed wave growth is tuned to the energy earned from earlier waves; buying towers never secretly buffs enemies. */
export function defenseEnemyStats(kind, wave, index = 0) {
  const type = ENEMY_TYPES[kind], age = Math.max(0, wave - 1);
  const veteran = wave >= 11 && index % 4 === 0 && kind !== "warden";
  const boss = kind === "warden";
  const hp = Math.round(type.hp * (1 + age * .18 + age * age * .045) * (veteran ? 1.45 : 1) * (boss ? 3.5 : 1));
  return { hp, maxHp: hp, speed: type.speed * .42 * (1 + age * .024) * (veteran ? 1.15 : 1),
    radius: type.radius * (boss ? 1.35 : veteran ? 1.12 : 1), color: type.color, veteran, boss,
    armor: boss ? .38 : kind === "brute" ? .28 : 0,
    reward: 5 + Math.round(type.hp / 16) + (veteran ? 2 : 0) + (boss ? 30 : 0),
    leak: boss ? 4 : kind === "brute" ? 2 : 1,
    slowFloor: boss ? .65 : veteran ? .55 : .25,
    regeneration: kind === "crawler" && wave >= 8 ? hp * .012 : 0 };
}

export function startDefenseWave(game) {
  if (game.status !== "building" || game.paused || game.wave >= DEFENSE_WAVES) return false;
  game.wave++; game.queue = defenseWave(game.wave); game.spawned = 0; game.spawnIn = .3; game.status = "running";
  game.message = `Wave ${game.wave}: ${defenseWaveBrief(game.wave)}`;
  return true;
}

export function defensePosition(distance) {
  const at = Math.max(0, Math.min(distance, DEFENSE_PATH.length - 1));
  const index = Math.floor(at), a = DEFENSE_PATH[index], b = DEFENSE_PATH[Math.min(index + 1, DEFENSE_PATH.length - 1)];
  return { x: a.x + (b.x - a.x) * (at - index), y: a.y + (b.y - a.y) * (at - index) };
}

function spawnEnemy(game, kind) {
  game.enemies.push({ id: game.nextId++, kind, ...defenseEnemyStats(kind, game.wave, game.spawned++), distance: 0, ...DEFENSE_PATH[0], slow: 1, protected: false });
}
const separation = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function hurt(game, tower, enemy, damage) {
  if (enemy.hp <= 0) return;
  enemy.hp -= damage * (tower.type === "precision" ? 1 : 1 - Math.min(.65, enemy.armor + (enemy.protected ? .12 : 0)));
  if (enemy.hp <= 0) { game.kills++; tower.kills++; game.energy += enemy.reward; }
}
function beam(game, tower, target, color) {
  game.effects.push({ type: "beam", x: tower.x, y: tower.y, x2: target.x, y2: target.y, color, ttl: .13, maxTtl: .13 });
}

/** Advance fixed, short simulation steps; callers cannot skip a wave with a background-tab delta. */
export function stepDefense(game, elapsed) {
  if (game.paused || game.status !== "running" || !Number.isFinite(elapsed) || elapsed <= 0) return 0;
  const speed = DEFENSE_SPEEDS.includes(game.speed) ? game.speed : 1;
  const before = game.time;
  let left = Math.min(elapsed, .25) * speed;
  while (left > .000001 && game.status === "running") {
    const dt = Math.min(left, 1 / 30); left -= dt; game.time += dt;
    game.effects = game.effects.filter((effect) => (effect.ttl -= dt) > 0);
    game.spawnIn -= dt;
    if (game.queue.length && game.spawnIn <= 0) { spawnEnemy(game, game.queue.shift()); game.spawnIn += Math.max(.3, .86 - game.wave * .026); }
    for (const enemy of game.enemies) {
      enemy.slow = 1;
      enemy.protected = game.enemies.some((other) => other.hp > 0 && other.kind === "warden" && other !== enemy && separation(other, enemy) <= 2.2);
    }
    for (const tower of game.towers) {
      const stats = defenseTowerStats(tower);
      if (tower.type === "frost") {
        for (const enemy of game.enemies) if (separation(tower, enemy) <= stats.range) enemy.slow = Math.min(enemy.slow, Math.max(stats.slow, enemy.slowFloor || 0));
        continue;
      }
      tower.cooldown = Math.max(0, tower.cooldown - dt);
      if (tower.cooldown > 0) continue;
      const targets = game.enemies.filter((enemy) => enemy.hp > 0 && separation(tower, enemy) <= stats.range).sort((a, b) => b.distance - a.distance);
      const target = targets[0]; if (!target) continue;
      tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x); tower.cooldown = stats.cooldown;
      beam(game, tower, target, stats.color);
      if (tower.type === "demolition") {
        game.effects.push({ type: "blast", x: target.x, y: target.y, radius: stats.splash, color: stats.color, ttl: .35, maxTtl: .35 });
        for (const enemy of game.enemies) if (separation(target, enemy) <= stats.splash) hurt(game, tower, enemy, stats.damage);
      } else if (tower.type === "overcharge") {
        let current = target; const hit = new Set();
        for (let jump = 0; current && jump < stats.chain; jump++) {
          hurt(game, tower, current, stats.damage * (.85 ** jump)); hit.add(current.id);
          const next = game.enemies.filter((enemy) => enemy.hp > 0 && !hit.has(enemy.id) && separation(current, enemy) <= 2).sort((a, b) => separation(current, a) - separation(current, b))[0];
          if (next && jump < stats.chain - 1) beam(game, current, next, stats.color);
          current = next;
        }
      } else hurt(game, tower, target, stats.damage);
    }
    for (const enemy of game.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.regeneration) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regeneration * dt);
      // Chargers surge in pulses. Spitters steadily march; Brutes and Wardens carry armor.
      const charge = enemy.kind === "charger" && Math.sin(game.time * 2 + enemy.id) > .65 ? 1.7 : 1;
      const rally = game.enemies.some((other) => other.hp > 0 && other.kind === "spitter" && other !== enemy && separation(other, enemy) <= 1.5) ? 1.12 : 1;
      enemy.distance += enemy.speed * enemy.slow * charge * rally * dt;
      Object.assign(enemy, defensePosition(enemy.distance));
      if (enemy.distance >= DEFENSE_PATH.length - 1) { game.lives = Math.max(0, game.lives - enemy.leak); enemy.hp = 0; enemy.escaped = true; }
    }
    game.enemies = game.enemies.filter((enemy) => enemy.hp > 0);
    if (game.lives === 0) { game.status = "defeat"; game.message = `The core fell on wave ${game.wave}. Try covering several bends with each powerup.`; }
    else if (!game.queue.length && !game.enemies.length) {
      const bonus = 25 + game.wave * 6; game.energy += bonus;
      game.status = game.wave >= DEFENSE_WAVES ? "victory" : "building";
      game.message = game.status === "victory" ? "All 20 waves defeated. The core is safe!" : `Wave ${game.wave} cleared! +${bonus} energy. Build, upgrade, then start the next wave.`;
      game.effects = [];
    }
  }
  // The component records this real active duration, never the accelerated simulation clock.
  return (game.time - before) / speed;
}
