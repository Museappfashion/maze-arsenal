import test from "node:test";
import assert from "node:assert/strict";
import { DEFENSE_PATH, DEFENSE_WAVES, DEFENSE_TYPES, createDefenseGame, placeDefense, upgradeDefense, sellDefense, startDefenseWave, stepDefense, defenseTowerStats, defenseUpgradeCost, defenseWave, defensePosition, isDefensePath } from "../../src/game/towerDefense.js";

function running() { const game = createDefenseGame(); game.energy = 2000; startDefenseWave(game); game.queue = []; game.spawnIn = 100; return game; }
function enemy(game, { x = 2.5, y = 2.5, hp = 100, armor = 0, distance = 2, speed = 0, ...rest } = {}) {
  const item = { id: game.nextId++, kind: "scout", x, y, hp, maxHp: hp, armor, distance, speed, reward: 7, leak: 1, slow: 1, ...rest }; game.enemies.push(item); return item;
}

test("route is continuous and placements reject path, occupied, unaffordable, and invalid cells without spending", () => {
  for (let i = 1; i < DEFENSE_PATH.length; i++) assert.equal(Math.abs(DEFENSE_PATH[i].x - DEFENSE_PATH[i - 1].x) + Math.abs(DEFENSE_PATH[i].y - DEFENSE_PATH[i - 1].y), 1);
  assert.equal(new Set(DEFENSE_PATH.map((point) => `${point.x},${point.y}`)).size, DEFENSE_PATH.length);
  const game = createDefenseGame(); const before = game.energy;
  for (const [x, y] of [[0, 2], [-1, 2], [18, 2], [1.1, 1], [NaN, 1]]) assert.equal(placeDefense(game, "rapidFire", x, y), false);
  assert.equal(placeDefense(game, "invalid", 1, 1), false); assert.equal(game.energy, before);
  assert.equal(placeDefense(game, "rapidFire", 1, 1), true); assert.equal(game.energy, before - 90);
  assert.equal(placeDefense(game, "frost", 1, 1), false); assert.equal(game.towers.length, 1);
  assert.equal(placeDefense(game, "overcharge", 2, 1), false); assert.equal(game.energy, 180);
});

test("upgrades improve statistics, have escalating costs, stop at level 3, and sell once for 70 percent", () => {
  const game = createDefenseGame(); game.energy = 1000;
  placeDefense(game, "rapidFire", 2, 1); const tower = game.towers[0]; const original = defenseTowerStats(tower);
  assert.equal(upgradeDefense(game, tower.id), true); assert.equal(game.energy, 1000 - 90 - 72);
  assert.ok(defenseTowerStats(tower).damage > original.damage); assert.ok(defenseTowerStats(tower).range > original.range);
  assert.ok(defenseTowerStats(tower).cooldown < original.cooldown);
  assert.equal(upgradeDefense(game, tower.id), true); assert.equal(game.energy, 1000 - 90 - 72 - 117);
  assert.equal(upgradeDefense(game, tower.id), false);
  const remaining = game.energy; assert.equal(sellDefense(game, tower.id), true); assert.equal(game.energy, remaining + Math.floor((90 + 72 + 117) * .7));
  assert.equal(sellDefense(game, tower.id), false); assert.equal(game.towers.length, 0);
});

test("frost slows every nearby enemy without damage or stacking overlapping fields", () => {
  const game = running(); placeDefense(game, "frost", 2, 1); placeDefense(game, "frost", 3, 1);
  const near = enemy(game, { speed: 1 }), far = enemy(game, { x: 10.5, y: 8.5, distance: 16, speed: 1 });
  stepDefense(game, .1); assert.equal(near.hp, 100); assert.equal(near.slow, .6); assert.equal(far.slow, 1);
  assert.ok(Math.abs(near.distance - 2.06) < 1e-8); assert.ok(Math.abs(far.distance - 16.1) < 1e-8);
  upgradeDefense(game, game.towers[0].id); stepDefense(game, .01); assert.equal(near.slow, .52);
});

test("Demolition splashes groups; Precision ignores armor; Overcharge has a bounded chain", () => {
  const splash = running(); placeDefense(splash, "demolition", 2, 1);
  const a = enemy(splash), b = enemy(splash, { x: 3.2, distance: 2.7 }), c = enemy(splash, { x: 8.5, distance: 20 });
  stepDefense(splash, .01); assert.equal(a.hp, 72); assert.equal(b.hp, 72); assert.equal(c.hp, 100);
  const precise = running(); placeDefense(precise, "precision", 2, 1); const armored = enemy(precise, { armor: .3 });
  stepDefense(precise, .01); assert.equal(armored.hp, 58);
  const rapid = running(); placeDefense(rapid, "rapidFire", 2, 1); const protectedEnemy = enemy(rapid, { armor: .3 }); stepDefense(rapid, .01);
  assert.equal(protectedEnemy.hp, 95.1);
  const chain = running(); placeDefense(chain, "overcharge", 2, 1);
  const targets = Array.from({ length: 5 }, (_, index) => enemy(chain, { x: 2.5 + index * .3, distance: 2 + index * .3 }));
  stepDefense(chain, .01); assert.equal(targets.filter((item) => item.hp < 100).length, 3);
});

test("frontmost targets are attacked first and killed enemies award energy exactly once", () => {
  const game = running(); placeDefense(game, "rapidFire", 2, 1); placeDefense(game, "rapidFire", 3, 1);
  const behind = enemy(game, { hp: 100, distance: 1 }), ahead = enemy(game, { hp: 1, distance: 3, x: 3.5 }); const energy = game.energy;
  stepDefense(game, .01);
  assert.ok(ahead.hp <= 0); assert.equal(behind.hp, 93); assert.equal(game.kills, 1); assert.equal(game.energy, energy + 7);
});

test("wave generation grows, uses familiar enemy types, and sends Wardens every fifth wave", () => {
  assert.ok(defenseWave(20).length > defenseWave(1).length);
  assert.deepEqual(new Set(defenseWave(6)), new Set(["skitter", "scout", "crawler", "charger", "spitter"]));
  assert.equal(defenseWave(4).includes("warden"), false); assert.equal(defenseWave(5).filter((kind) => kind === "warden").length, 1);
  assert.equal(defenseWave(20).filter((kind) => kind === "warden").length, 4);
  const game = createDefenseGame(); assert.equal(startDefenseWave(game), true); assert.equal(startDefenseWave(game), false);
  stepDefense(game, .25); stepDefense(game, .1); assert.equal(game.enemies.length, 1); assert.ok(game.enemies[0].speed > 0);
  assert.equal(game.wave, 1); assert.ok(game.enemies[0].maxHp > 0);
});

test("pausing freezes all simulation and economy actions; large deltas cannot fast-forward a background tab", () => {
  const game = running(); placeDefense(game, "rapidFire", 2, 1); enemy(game); game.paused = true;
  const serialized = JSON.stringify(game); stepDefense(game, 100); assert.equal(JSON.stringify(game), serialized);
  assert.equal(upgradeDefense(game, game.towers[0].id), false); assert.equal(sellDefense(game, game.towers[0].id), false);
  game.paused = false; stepDefense(game, 100); assert.ok(game.time <= .250001);
});

test("escaped enemies damage the core without kill rewards; defeat stops the wave", () => {
  const game = running(); game.lives = 4;
  enemy(game, { distance: DEFENSE_PATH.length - 1.01, speed: 10, leak: 4, kind: "warden", ...DEFENSE_PATH.at(-1) });
  const energy = game.energy; stepDefense(game, .1);
  assert.equal(game.status, "defeat"); assert.equal(game.lives, 0); assert.equal(game.kills, 0); assert.equal(game.energy, energy);
  assert.equal(startDefenseWave(game), false); const time = game.time; stepDefense(game, .1); assert.equal(game.time, time);
});

test("a cleared wave grants one completion bonus and all twenty cleared waves produce victory", () => {
  const game = running(); placeDefense(game, "rapidFire", 2, 1); enemy(game, { hp: 1 }); const initial = game.energy;
  stepDefense(game, .01); assert.equal(game.status, "building"); assert.equal(game.energy, initial + 7 + 31);
  stepDefense(game, .25); assert.equal(game.energy, initial + 7 + 31);
  assert.equal(startDefenseWave(game), true); assert.equal(game.wave, 2);
  const last = running(); last.wave = DEFENSE_WAVES; placeDefense(last, "precision", 2, 1); enemy(last, { hp: 1 }); stepDefense(last, .01);
  assert.equal(last.status, "victory"); assert.equal(startDefenseWave(last), false);
  assert.equal(placeDefense(last, "rapidFire", 1, 1), false);
});

test("path interpolation follows bends and reaches the core exactly", () => {
  assert.deepEqual(defensePosition(0), DEFENSE_PATH[0]); assert.deepEqual(defensePosition(999), DEFENSE_PATH.at(-1));
  const point = defensePosition(4.5); assert.deepEqual(point, { x: 4.5, y: 3 });
  assert.equal(isDefensePath(4, 3), true); assert.equal(isDefensePath(5, 3), false);
  assert.equal(Object.keys(DEFENSE_TYPES).length, 5);
});

test("all 20 waves are beatable using only the starting budget and earned energy", () => {
  const game = createDefenseGame();
  for (const [x, y] of [[3, 4], [5, 6], [11, 5]]) assert.equal(placeDefense(game, "rapidFire", x, y), true);
  // A simple repeatable strategy: improve existing damage towers, then cover the most route.
  function buildBest(type) {
    const stats = DEFENSE_TYPES[type], candidates = [];
    for (let y = 0; y < 12; y++) for (let x = 0; x < 18; x++) {
      if (isDefensePath(x, y) || game.towers.some((tower) => tower.x === x + .5 && tower.y === y + .5)) continue;
      const score = DEFENSE_PATH.filter((point) => Math.hypot(point.x - x - .5, point.y - y - .5) <= stats.range).length;
      candidates.push({ x, y, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    return placeDefense(game, type, candidates[0].x, candidates[0].y);
  }
  for (let wave = 1; wave <= 20; wave++) {
    if (wave > 1) for (let count = 0; count < 60; count++) {
      const upgradable = game.towers.find((tower) => tower.type !== "frost" && tower.level < 3 && defenseUpgradeCost(tower) <= game.energy);
      if (upgradable) { upgradeDefense(game, upgradable.id); continue; }
      const type = wave % 3 === 0 && !game.towers.some((tower) => tower.type === "frost") ? "frost"
        : wave >= 4 && game.towers.filter((tower) => tower.type === "demolition").length < 4 ? "demolition"
        : wave >= 5 && game.towers.filter((tower) => tower.type === "precision").length < 4 ? "precision" : "rapidFire";
      if (!buildBest(type)) break;
    }
    assert.ok(game.energy >= 0); assert.equal(startDefenseWave(game), true);
    let steps = 0;
    while (game.status === "running" && steps++ < 4000) stepDefense(game, .25);
    assert.equal(game.status, wave === 20 ? "victory" : "building", `Wave ${wave} must be survivable`);
  }
  assert.equal(game.wave, 20); assert.ok(game.lives > 0); assert.ok(game.kills >= 500);
});
