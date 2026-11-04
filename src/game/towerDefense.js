import { POWER_UPS } from "../config/powerUps.js";
import { ENEMY_TYPES } from "../config/enemies.js";

export const DEFENSE_COLUMNS = 18;
export const DEFENSE_ROWS = 12;
export const DEFENSE_WAVES = 60;
export const DEFENSE_MAX_LEVEL = 6;
export const DEFENSE_SPEEDS = Object.freeze([1, 2, 3]);
export const DEFENSE_TYPES = Object.freeze({
  rapidFire: { ...POWER_UPS.rapidFire, cost: 90, damage: 7, cooldown: .24, range: 2.8, symbol: "R", description: "Fast bolts pick off the leading enemy." },
  frost: { ...POWER_UPS.frost, cost: 110, damage: 0, cooldown: 0, range: 2.3, symbol: "F", description: "A constant field slows every enemy inside by 40%." },
  demolition: { ...POWER_UPS.demolition, cost: 180, damage: 28, cooldown: 1.25, range: 3.1, splash: 1.2, symbol: "D", description: "Explosive blasts damage groups of enemies." },
  precision: { ...POWER_UPS.precision, cost: 150, damage: 42, cooldown: 1.5, range: 4.5, symbol: "P", description: "Long-range shots break through Brute and Warden armor." },
  overcharge: { ...POWER_UPS.overcharge, cost: 200, damage: 13, cooldown: .75, range: 3.1, symbol: "O", description: "Lightning jumps between three nearby enemies." },
  scattershot: { ...POWER_UPS.scattershot, cost: 150, damage: 10, cooldown: .8, range: 2.8, symbol: "S", description: "A volley hits three different enemies at once." },
  berserk: { ...POWER_UPS.berserk, cost: 180, damage: 0, cooldown: 0, range: 2.6, support: true, symbol: "B", description: "Nearby attacking powerups deal 20% more damage. Auras do not stack." },
  sonar: { ...POWER_UPS.sonar, cost: 145, damage: 0, cooldown: 0, range: 2.8, support: true, symbol: "N", description: "Enemies in range take 15% more damage and cannot regenerate. Does not stack." },
  bounty: { ...POWER_UPS.bounty, cost: 160, damage: 0, cooldown: 0, range: 3.1, support: true, symbol: "$", description: "Defeats inside this field give 2 extra energy. Only the strongest field pays." },
  regen: { ...POWER_UPS.regen, cost: 220, damage: 0, cooldown: 18, range: 0, support: true, symbol: "+", description: "Repair 1 core health every 18 active battle seconds. Only the strongest repair runs." },
  shield: { ...POWER_UPS.shield, cost: 210, damage: 0, cooldown: 0, range: 0, support: true, symbol: "G", description: "Absorb 2 core damage each wave. The strongest shield refreshes when a wave starts." },
  juggernaut: { ...POWER_UPS.juggernaut, cost: 230, damage: 60, cooldown: 2, range: 2.1, splash: .9, symbol: "J", description: "A heavy slam damages a group and briefly stuns it. Enemies recover between stuns." },
  breaker: { ...POWER_UPS.breaker, cost: 170, damage: 24, cooldown: .9, range: 3, symbol: "K", description: "Armor-breaking shells strip 18% armor before dealing damage. Only the strongest strip applies." },
  haste: { ...POWER_UPS.haste, cost: 145, damage: 4, cooldown: .14, range: 2.5, symbol: "H", description: "Fast bolts gain damage while continuously firing, up to 50% extra. Idle time clears the bonus." },
  magnet: { ...POWER_UPS.magnet, cost: 175, damage: 12, cooldown: .75, range: 2.7, symbol: "M", description: "Shock the leading enemy and pull it back along its route. Shared recovery prevents permanent trapping." },
  pierce: { ...POWER_UPS.pierce, cost: 210, damage: 18, cooldown: 1.15, range: 3.8, symbol: "I", description: "Piercing rounds hit five enemies and ignore half their armor." },
  vampirism: { ...POWER_UPS.vampirism, cost: 180, damage: 16, cooldown: .8, range: 2.8, symbol: "V", description: "Drain bolts restore 1 core health after every four enemies this defense defeats." },
  longArms: { ...POWER_UPS.longArms, cost: 155, damage: 18, cooldown: .7, range: 1.7, symbol: "L", description: "A close-range sweep damages every enemy around this defense." },
  ammoSurge: { ...POWER_UPS.ammoSurge, cost: 190, damage: 5, cooldown: .35, range: 3.2, symbol: "A", description: "A three-shot barrage retargets as enemies fall. Upgrades add shots to each barrage." },
  phaseWalk: { ...POWER_UPS.phaseWalk, cost: 225, damage: 24, cooldown: .95, range: 3.4, symbol: "W", description: "Phase bolts bypass armor and Warden protection, then leave a short damaging phase burn." },
});

function makePath(points) {
  const path = [];
  for (let segment = 1; segment < points.length; segment++) {
    const [fromX, fromY] = points[segment - 1], [toX, toY] = points[segment];
    const dx = Math.sign(toX - fromX), dy = Math.sign(toY - fromY);
    if (dx && dy) throw new Error("Defense routes must turn on grid cells.");
    let x = fromX, y = fromY;
    if (path.length) { x += dx; y += dy; }
    while (true) { path.push(Object.freeze({ x: x + .5, y: y + .5 })); if (x === toX && y === toY) break; x += dx; y += dy; }
  }
  return Object.freeze(path);
}
function level(key, title, points, blocked = []) {
  const path = makePath(points);
  return Object.freeze({ key, title, themeKey: key, path, blocked: Object.freeze(blocked.map(([x,y]) => Object.freeze({x,y}))), pathCells: new Set(path.map(({x,y}) => `${Math.floor(x)},${Math.floor(y)}`)), blockedCells: new Set(blocked.map(([x,y]) => `${x},${y}`)) });
}
export const DEFENSE_LEVELS = Object.freeze({
  city: level("city", "Abandoned City", [[0,1],[6,1],[6,7],[2,7],[2,10],[12,10],[12,8],[16,8]], [[1,3],[2,3],[1,4],[15,1],[16,1],[16,2]]),
  space: level("space", "Orbital Ruins", [[0,2],[4,2],[4,8],[10,8],[10,3],[14,3],[14,10],[17,10]]),
  jungle: level("jungle", "Emerald Wilds", [[0,10],[3,10],[3,3],[9,3],[9,8],[14,8],[14,2],[17,2]], [[0,0],[1,0],[0,1],[16,10],[17,10],[17,9]]),
  medieval: level("medieval", "Fallen Keep", [[17,1],[11,1],[11,5],[15,5],[15,10],[5,10],[5,6],[3,6]], [[0,0],[1,0],[0,1],[7,7],[7,8],[8,8]]),
});
export function getDefenseLevel(value = "space") {
  const key = typeof value === "string" ? value : value?.levelKey;
  const aliases = { level0:"city", level1:"space", level2:"jungle", level3:"medieval" };
  return DEFENSE_LEVELS[key] || DEFENSE_LEVELS[aliases[key]] || DEFENSE_LEVELS.space;
}
export const getDefensePath = (value) => getDefenseLevel(value).path;
// Compatibility for older integrations: the default route is still Orbital Ruins.
export const DEFENSE_PATH = DEFENSE_LEVELS.space.path;
export const isDefensePath = (x, y, value = "space") => getDefenseLevel(value).pathCells.has(`${x},${y}`);
export const isDefenseObstacle = (x, y, value = "space") => getDefenseLevel(value).blockedCells.has(`${x},${y}`);

export function createDefenseGame(levelKey = "space") {
  return { levelKey: getDefenseLevel(levelKey).key, status: "building", paused: false, speed: 1, wave: 0, lives: 20, energy: 270, kills: 0, time: 0,
    towers: [], enemies: [], effects: [], queue: [], spawnIn: 0, nextId: 1, selectedId: null, coreShield: 0, repairIn: 18, coreDamageTaken: 0, coreDamageBlocked: 0, coreRepairs: 0,
    message: `Place your powerups beside the ${getDefenseLevel(levelKey).title} route, then start wave 1.` };
}

export function setDefenseSpeed(game, speed) {
  if (!DEFENSE_SPEEDS.includes(speed)) return false;
  game.speed = speed;
  return true;
}

export function defenseTowerStats(tower) {
  const type = DEFENSE_TYPES[tower.type];
  const tier = Math.max(0, Math.min(DEFENSE_MAX_LEVEL - 1, (tower.level || 1) - 1));
  const advanced = Math.max(0, tier - 2);
  return { ...type, damage: Math.round(type.damage * (1 + tier * .6 + advanced * advanced * .5)),
    range: type.range > 0 ? type.range + tier * .35 : 0,
    cooldown: type.cooldown / (1 + tier * .12 + advanced * .12), slow: Math.max(.25, .6 - tier * .08),
    chain: 3 + tier, targets: 3 + tier, splash: (type.splash || 0) + tier * .2,
    damageBoost: .2 + tier * .05, vulnerability: .15 + tier * .04,
    bounty: 2 + tier, repair: 1 + Math.floor(tier / 2), shieldCapacity: 2 + tier,
    stun: .18 + tier * .04, armorBreak: .18 + tier * .05, pull: .28 + tier * .08, shots: 3 + tier,
    pierceTargets: 5 + tier, momentumCap: .5 + tier * .1, killsForRepair: Math.max(2, 4 - Math.floor(tier / 2)),
    burn: 5 + tier * 2, burnDuration: 2 + tier * .2 };
}
export const defenseUpgradeCost = (tower) => Math.round(DEFENSE_TYPES[tower.type].cost * (.8 + (tower.level - 1) * .5));
export const defenseSellValue = (tower) => Math.floor(tower.spent * .7);

/** The same values drive combat and both stat rows, including support effects. */
export function defenseStatSummary(tower) {
  const stats = defenseTowerStats(tower);
  const percent = (value) => Math.round(value * 100);
  const parts = tower.type === "frost" ? [`${percent(1 - stats.slow)}% slow`]
    : tower.type === "berserk" ? [`+${percent(stats.damageBoost)}% nearby tower damage`, "strongest aura only"]
    : tower.type === "sonar" ? [`+${percent(stats.vulnerability)}% damage taken`, "blocks regeneration", "strongest field only"]
    : tower.type === "bounty" ? [`+${stats.bounty} energy per nearby defeat`, "strongest field only"]
    : tower.type === "regen" ? [`${stats.repair} core repair`, `${stats.cooldown.toFixed(2)}s cooldown`, "strongest repair only"]
    : tower.type === "shield" ? [`${stats.shieldCapacity} core shield per wave`, "strongest shield only"]
    : [`${stats.damage} damage`, `${stats.cooldown.toFixed(2)}s cooldown`];
  parts.push(stats.range ? `${stats.range.toFixed(2)} tile range` : "whole core");
  if (tower.type === "demolition") parts.push(`${stats.splash.toFixed(2)} tile splash`);
  if (tower.type === "overcharge") parts.push(`${stats.chain} chain targets`);
  if (tower.type === "scattershot") parts.push(`${stats.targets} volley targets`);
  if (tower.type === "precision") parts.push("ignores armor");
  if (tower.type === "juggernaut") parts.push(`${stats.splash.toFixed(2)} tile slam`, `${stats.stun.toFixed(2)}s stun`, "1.2s stun recovery");
  if (tower.type === "breaker") parts.push(`${percent(stats.armorBreak)}% armor strip`, "strongest strip only");
  if (tower.type === "haste") parts.push(`up to +${percent(stats.momentumCap)}% sustained-fire damage`);
  if (tower.type === "magnet") parts.push(`${stats.pull.toFixed(2)} tile pull`, "1.2s pull recovery; bosses resist");
  if (tower.type === "pierce") parts.push(`${stats.pierceTargets} piercing targets`, "ignores 50% armor");
  if (tower.type === "vampirism") parts.push(`1 core repair per ${stats.killsForRepair} defeats`);
  if (tower.type === "longArms") parts.push("sweeps every nearby enemy");
  if (tower.type === "ammoSurge") parts.push(`${stats.shots} barrage shots`);
  if (tower.type === "phaseWalk") parts.push("ignores armor and protection", `${stats.burn} burn damage/s`, `${stats.burnDuration.toFixed(2)}s burn`, "strongest burn only");
  return parts.join(" · ");
}

export function canPlaceDefense(game, type, x, y) {
  if (!["building", "running"].includes(game.status)) return "Restart to build again.";
  if (game.paused) return "Resume before building.";
  if (!DEFENSE_TYPES[type]) return "Choose a powerup first.";
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= DEFENSE_COLUMNS || y >= DEFENSE_ROWS) return "Choose a tile on the board.";
  if (isDefensePath(x, y, game)) return "The enemy route must stay clear.";
  if (isDefenseObstacle(x, y, game)) return "That tile contains a level obstacle.";
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
  if (tower.level >= DEFENSE_MAX_LEVEL) { game.message = `This powerup is already level ${DEFENSE_MAX_LEVEL}.`; return false; }
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
  if (wave === 60) return "Final assault: twelve Wardens lead elite packs. Combine upgraded damage, area attacks, auras, and core support.";
  if (wave >= 40 && wave % 5 === 0) return "Elite Warden assault: hardened armor and protection. Use Precision, Sonar and Berserk together.";
  if (wave % 5 === 0) return "Warden assault: heavy armor and a protective aura. Precision bypasses armor.";
  if (wave >= 31) return "Elite legions: faster armored veterans join dense waves. Six upgrade tiers and support combinations matter.";
  if (wave >= 21) return "Reinforcements: denser packs, stronger veterans and increasing energy rewards. Add support fields and advanced upgrades.";
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
  const elite = wave >= 31 && index % 6 === 0;
  const hp = Math.round(type.hp * (1 + age * .18 + age * age * .045) * (veteran ? 1.45 : 1) * (boss ? 3.5 : 1) * (elite ? 1.25 : 1));
  return { hp, maxHp: hp, speed: type.speed * .42 * (1 + age * .024) * (veteran ? 1.15 : 1),
    radius: type.radius * (boss ? 1.35 : veteran ? 1.12 : 1), color: type.color, veteran, boss, elite,
    armor: Math.min(.5, (boss ? .38 : kind === "brute" ? .28 : 0) + (elite ? .08 : 0)),
    reward: 5 + Math.round(type.hp / 16) + (veteran ? 2 : 0) + (boss ? 30 : 0) + Math.floor(Math.max(0, wave - 20) / 8),
    leak: boss ? 4 : kind === "brute" ? 2 : 1,
    slowFloor: boss ? .65 : veteran ? .55 : .25,
    regeneration: kind === "crawler" && wave >= 8 ? hp * .012 : 0 };
}

export function startDefenseWave(game) {
  if (game.status !== "building" || game.paused || game.wave >= DEFENSE_WAVES) return false;
  game.coreShield = Math.max(0, ...game.towers.filter((tower) => tower.type === "shield").map((tower) => defenseTowerStats(tower).shieldCapacity));
  game.wave++; game.queue = defenseWave(game.wave); game.spawned = 0; game.spawnIn = .3; game.status = "running";
  game.message = `Wave ${game.wave}: ${defenseWaveBrief(game.wave)}`;
  return true;
}

export function defensePosition(distance, value = "space") {
  const path = getDefensePath(value);
  const at = Math.max(0, Math.min(distance, path.length - 1));
  const index = Math.floor(at), a = path[index], b = path[Math.min(index + 1, path.length - 1)];
  return { x: a.x + (b.x - a.x) * (at - index), y: a.y + (b.y - a.y) * (at - index) };
}

function spawnEnemy(game, kind) {
  game.enemies.push({ id: game.nextId++, kind, ...defenseEnemyStats(kind, game.wave, game.spawned++), distance: 0, ...getDefensePath(game)[0], slow: 1, protected: false });
}
const separation = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function hurt(game, tower, enemy, damage) {
  if (enemy.hp <= 0) return;
  const ignoresArmor = tower.type === "precision" || tower.type === "phaseWalk";
  const armor = Math.max(0, (enemy.armor || 0) - (enemy.armorBreak || 0)) * (tower.type === "pierce" ? .5 : 1);
  enemy.hp -= damage * (1 + (tower.damageBoost || 0)) * (1 + (enemy.vulnerability || 0)) * (ignoresArmor ? 1 : 1 - Math.min(.65, armor + (enemy.protected ? .12 : 0)));
  if (enemy.hp <= 0) {
    game.kills++; tower.kills++; game.energy += enemy.reward + (enemy.bounty || 0);
    if (tower.type === "vampirism") {
      tower.drainKills = (tower.drainKills || 0) + 1;
      const needed = defenseTowerStats(tower).killsForRepair;
      if (tower.drainKills >= needed) { tower.drainKills -= needed; if (game.lives < 20) { game.lives++; game.coreRepairs++; } }
    }
  }
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
    const wardens = game.enemies.filter((enemy) => enemy.hp > 0 && enemy.kind === "warden");
    const spitters = game.enemies.filter((enemy) => enemy.hp > 0 && enemy.kind === "spitter");
    const fields = game.towers.map((tower) => ({ tower, stats: defenseTowerStats(tower) }));
    const damageAuras = fields.filter(({ tower }) => tower.type === "berserk");
    const sonars = fields.filter(({ tower }) => tower.type === "sonar");
    const bounties = fields.filter(({ tower }) => tower.type === "bounty");
    const repair = fields.filter(({ tower }) => tower.type === "regen").sort((a,b) => b.stats.repair / b.stats.cooldown - a.stats.repair / a.stats.cooldown)[0];
    if (repair) {
      game.repairIn = Math.max(0, Math.min(game.repairIn ?? repair.stats.cooldown, repair.stats.cooldown) - dt);
      if (game.repairIn <= 0) {
        if (game.lives < 20) {
          const restored = Math.min(20 - game.lives, repair.stats.repair);
          game.lives += restored; game.coreRepairs = (game.coreRepairs || 0) + restored;
          game.effects.push({ type: "blast", x: getDefensePath(game).at(-1).x, y: getDefensePath(game).at(-1).y, radius: .8, color: repair.stats.color, ttl: .4, maxTtl: .4 });
        }
        game.repairIn = repair.stats.cooldown;
      }
    }
    for (const enemy of game.enemies) {
      enemy.slow = 1;
      enemy.protected = wardens.some((other) => other !== enemy && separation(other, enemy) <= 2.2);
      enemy.vulnerability = Math.max(0, ...sonars.filter(({tower,stats}) => separation(tower,enemy) <= stats.range).map(({stats}) => stats.vulnerability));
      enemy.bounty = Math.max(0, ...bounties.filter(({tower,stats}) => separation(tower,enemy) <= stats.range).map(({stats}) => stats.bounty));
    }
    for (const tower of game.towers) {
      const stats = defenseTowerStats(tower);
      if (stats.support) continue;
      tower.damageBoost = Math.max(0, ...damageAuras.filter(({tower: aura,stats: auraStats}) => separation(tower,aura) <= auraStats.range).map(({stats: auraStats}) => auraStats.damageBoost));
      if (tower.type === "frost") {
        for (const enemy of game.enemies) if (separation(tower, enemy) <= stats.range) enemy.slow = Math.min(enemy.slow, Math.max(stats.slow, enemy.slowFloor || 0));
        continue;
      }
      tower.cooldown = Math.max(0, tower.cooldown - dt);
      if (tower.cooldown > 0) continue;
      const targets = game.enemies.filter((enemy) => enemy.hp > 0 && separation(tower, enemy) <= stats.range).sort((a, b) => b.distance - a.distance);
      const target = targets[0]; if (!target) { tower.momentum = 0; continue; }
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
      } else if (tower.type === "scattershot") {
        for (const enemy of targets.slice(0, stats.targets)) {
          if (enemy !== target) beam(game, tower, enemy, stats.color);
          hurt(game, tower, enemy, stats.damage);
        }
      } else if (tower.type === "juggernaut") {
        game.effects.push({ type:"blast",x:target.x,y:target.y,radius:stats.splash,color:stats.color,ttl:.35,maxTtl:.35 });
        for (const enemy of game.enemies) if (enemy.hp > 0 && separation(target, enemy) <= stats.splash) {
          if (game.time >= (enemy.stunReadyAt || 0)) { enemy.stunned = stats.stun * (enemy.boss ? .3 : 1); enemy.stunReadyAt = game.time + 1.2; }
          hurt(game,tower,enemy,stats.damage);
        }
      } else if (tower.type === "breaker") {
        target.armorBreak = Math.max(target.armorBreak || 0, stats.armorBreak); hurt(game,tower,target,stats.damage);
      } else if (tower.type === "haste") {
        hurt(game,tower,target,stats.damage * (1 + Math.min(stats.momentumCap,(tower.momentum || 0) * .05)));
        tower.momentum = Math.min(Math.ceil(stats.momentumCap / .05),(tower.momentum || 0) + 1);
      } else if (tower.type === "magnet") {
        hurt(game,tower,target,stats.damage);
        if (target.hp > 0 && game.time >= (target.pullReadyAt || 0)) {
          target.distance = Math.max(0,target.distance - stats.pull * (target.boss ? .25 : 1));
          Object.assign(target,defensePosition(target.distance,game)); target.pullReadyAt = game.time + 1.2;
        }
      } else if (tower.type === "pierce" || tower.type === "longArms") {
        for (const enemy of targets.slice(0,tower.type === "pierce" ? stats.pierceTargets : targets.length)) {
          if (enemy !== target) beam(game,tower,enemy,stats.color);
          hurt(game,tower,enemy,stats.damage);
        }
      } else if (tower.type === "ammoSurge") {
        for (let shot=0;shot<stats.shots;shot++) {
          const next=targets.find(enemy=>enemy.hp>0);if (!next) break;
          if (shot) beam(game,tower,next,stats.color); hurt(game,tower,next,stats.damage);
        }
      } else if (tower.type === "phaseWalk") {
        hurt(game,tower,target,stats.damage);
        if (target.hp > 0) {
          if ((target.phaseBurn || 0) <= stats.burn) { target.phaseBurn=stats.burn;target.phaseOwner=tower; }
          target.phaseTime=Math.max(target.phaseTime || 0,stats.burnDuration);
        }
      } else hurt(game, tower, target, stats.damage);
    }
    for (const enemy of game.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.phaseTime > 0 && enemy.phaseOwner) {
        const burnTime=Math.min(dt,enemy.phaseTime);enemy.phaseTime=Math.max(0,enemy.phaseTime-dt);
        hurt(game,enemy.phaseOwner,enemy,(enemy.phaseBurn || 0)*burnTime);
        if (enemy.hp <= 0) continue;
      }
      if (enemy.regeneration && !enemy.vulnerability) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regeneration * dt);
      // Chargers surge in pulses. Spitters steadily march; Brutes and Wardens carry armor.
      const charge = enemy.kind === "charger" && Math.sin(game.time * 2 + enemy.id) > .65 ? 1.7 : 1;
      const rally = spitters.some((other) => other.hp > 0 && other !== enemy && separation(other, enemy) <= 1.5) ? 1.12 : 1;
      enemy.stunned = Math.max(0,(enemy.stunned || 0)-dt);
      enemy.distance += enemy.speed * enemy.slow * charge * rally * (enemy.stunned > 0 ? 0 : 1) * dt;
      Object.assign(enemy, defensePosition(enemy.distance, game));
      if (enemy.distance >= getDefensePath(game).length - 1) {
        const absorbed = Math.min(game.coreShield || 0, enemy.leak);
        game.coreShield = Math.max(0, (game.coreShield || 0) - absorbed);
        game.coreDamageBlocked = (game.coreDamageBlocked || 0) + absorbed;
        game.coreDamageTaken = (game.coreDamageTaken || 0) + Math.min(game.lives, enemy.leak - absorbed);
        game.lives = Math.max(0, game.lives - (enemy.leak - absorbed)); enemy.hp = 0; enemy.escaped = true;
      }
    }
    game.enemies = game.enemies.filter((enemy) => enemy.hp > 0);
    if (game.lives === 0) { game.status = "defeat"; game.message = `The core fell on wave ${game.wave}. Try covering several bends with each powerup.`; }
    else if (!game.queue.length && !game.enemies.length) {
      const bonus = 25 + game.wave * 6; game.energy += bonus;
      game.status = game.wave >= DEFENSE_WAVES ? "victory" : "building";
      game.message = game.status === "victory" ? `All ${DEFENSE_WAVES} waves defeated. The core is safe!` : `Wave ${game.wave} cleared! +${bonus} energy. Build, upgrade, then start the next wave.`;
      game.effects = [];
    }
  }
  // The component records this real active duration, never the accelerated simulation clock.
  return (game.time - before) / speed;
}
