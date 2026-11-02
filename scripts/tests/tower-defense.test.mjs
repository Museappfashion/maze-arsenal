import test from "node:test";
import assert from "node:assert/strict";
import { DEFENSE_PATH, DEFENSE_WAVES, DEFENSE_MAX_LEVEL, DEFENSE_TYPES, createDefenseGame, placeDefense, upgradeDefense, sellDefense, startDefenseWave, stepDefense, setDefenseSpeed, defenseTowerStats, defenseStatSummary, defenseUpgradeCost, defenseWave, defenseEnemyStats, defensePosition, isDefensePath } from "../../src/game/towerDefense.js";

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

test("six upgrade tiers improve statistics, have escalating costs, and sell exactly once for 70 percent", () => {
  const game = createDefenseGame(); game.energy = 10000;
  placeDefense(game, "rapidFire", 2, 1); const tower = game.towers[0];
  let previous = defenseTowerStats(tower), lastCost = 0;
  for (let level = 2; level <= DEFENSE_MAX_LEVEL; level++) {
    const before = game.energy, cost = defenseUpgradeCost(tower);
    assert.ok(cost > lastCost); lastCost = cost;
    assert.equal(upgradeDefense(game, tower.id), true); assert.equal(game.energy, before - cost);
    const stats = defenseTowerStats(tower);
    assert.ok(stats.damage > previous.damage && stats.range > previous.range && stats.cooldown < previous.cooldown);
    previous = stats;
  }
  const before = game.energy; assert.equal(tower.level, 6); assert.equal(upgradeDefense(game, tower.id), false); assert.equal(game.energy,before);
  const refund = Math.floor(tower.spent * .7);
  assert.equal(sellDefense(game, tower.id), true); assert.equal(game.energy, before + refund);
  assert.equal(sellDefense(game, tower.id), false); assert.equal(game.towers.length, 0);
});

test("all attacking and support upgrade previews use the same values as the purchased level", () => {
  for (const type of Object.keys(DEFENSE_TYPES)) for (let level = 1; level < DEFENSE_MAX_LEVEL; level++) {
    const game = createDefenseGame(); game.energy = 100000; placeDefense(game, type, 2, 1);
    const tower = game.towers[0]; while(tower.level < level) upgradeDefense(game,tower.id);
    const forecast = defenseStatSummary({ ...tower, level: tower.level + 1 });
    upgradeDefense(game, tower.id); assert.equal(defenseStatSummary(tower), forecast);
    const stats = defenseTowerStats(tower);
    assert.ok(forecast.includes(stats.range ? `${stats.range.toFixed(2)} tile range` : "whole core"));
    if (type === "frost") assert.ok(forecast.includes(`${Math.round((1-stats.slow)*100)}% slow`));
    else if (type === "berserk") assert.ok(forecast.includes(`+${Math.round(stats.damageBoost*100)}% nearby tower damage`));
    else if (type === "sonar") assert.ok(forecast.includes(`+${Math.round(stats.vulnerability*100)}% damage taken`) && forecast.includes("blocks regeneration"));
    else if (type === "bounty") assert.ok(forecast.includes(`+${stats.bounty} energy per nearby defeat`));
    else if (type === "regen") assert.ok(forecast.includes(`${stats.repair} core repair`) && forecast.includes(`${stats.cooldown.toFixed(2)}s cooldown`));
    else if (type === "shield") assert.ok(forecast.includes(`${stats.shieldCapacity} core shield per wave`));
    else assert.ok(forecast.includes(`${stats.damage} damage`) && forecast.includes(`${stats.cooldown.toFixed(2)}s cooldown`));
    if (type === "demolition") assert.ok(forecast.includes(`${stats.splash.toFixed(2)} tile splash`));
    if (type === "overcharge") assert.ok(forecast.includes(`${stats.chain} chain targets`));
    if (type === "scattershot") assert.ok(forecast.includes(`${stats.targets} volley targets`));
  }
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

test("later waves add real health pressure, veterans, rushes, armor, regeneration, and slow resistance", () => {
  assert.ok(defenseEnemyStats("crawler", 20).hp > defenseEnemyStats("crawler", 5).hp * 5);
  const ordinary = defenseEnemyStats("scout", 12, 1), veteran = defenseEnemyStats("scout", 12, 0);
  assert.ok(veteran.hp > ordinary.hp && veteran.speed > ordinary.speed && veteran.slowFloor > ordinary.slowFloor);
  assert.equal(defenseEnemyStats("scout", 10, 0).veteran, false);
  const boss = defenseEnemyStats("warden", 10);
  assert.equal(boss.boss, true); assert.ok(boss.maxHp > 2000 && boss.armor > .3 && boss.slowFloor >= .6);
  assert.equal(defenseWave(13).filter((kind) => kind === "charger").length > defenseWave(13).length / 3, true);
  assert.ok(defenseWave(14).includes("brute"));
  const game = running(); placeDefense(game, "frost", 2, 1); upgradeDefense(game, game.towers[0].id); upgradeDefense(game, game.towers[0].id);
  const resistant = enemy(game, { ...veteran, speed: 1 });
  stepDefense(game, .01); assert.equal(resistant.slow, veteran.slowFloor);
  const regeneration = running(); const crawler = enemy(regeneration, { ...defenseEnemyStats("crawler", 9), hp: 50, speed: 0 });
  stepDefense(regeneration, .1); assert.ok(crawler.hp > 50);
});

test("Warden protection reduces nearby damage and Spitters rally nearby enemy movement", () => {
  const protectedGame = running(); placeDefense(protectedGame, "rapidFire", 2, 1);
  const protectedEnemy = enemy(protectedGame); enemy(protectedGame, { kind: "warden", x: 1.5, distance: 1, hp: 500 });
  stepDefense(protectedGame, .01); assert.equal(protectedEnemy.protected, true); assert.ok(Math.abs(protectedEnemy.hp - 93.84) < 1e-8);
  const rally = running(); const runner = enemy(rally, { speed: 1 }); enemy(rally, { kind: "spitter", x: 1.5, distance: 1 });
  stepDefense(rally, .1); assert.ok(Math.abs(runner.distance - 2.112) < 1e-8);
});

test("pausing freezes all simulation and economy actions; large deltas cannot fast-forward a background tab", () => {
  const game = running(); placeDefense(game, "rapidFire", 2, 1); enemy(game); game.paused = true;
  const serialized = JSON.stringify(game); stepDefense(game, 100); assert.equal(JSON.stringify(game), serialized);
  assert.equal(upgradeDefense(game, game.towers[0].id), false); assert.equal(sellDefense(game, game.towers[0].id), false);
  game.paused = false; stepDefense(game, 100); assert.ok(game.time <= .250001);
});

test("1x, 2x, and 3x speed accelerate fixed simulation but return only actual active playtime", () => {
  for (const speed of [1, 2, 3]) {
    const game = running(); enemy(game, { speed: 1 });
    assert.equal(setDefenseSpeed(game, speed), true);
    const active = stepDefense(game, .2);
    assert.ok(Math.abs(game.time - .2 * speed) < 1e-8);
    assert.ok(Math.abs(active - .2) < 1e-8);
    assert.ok(Math.abs(game.enemies[0].distance - (2 + .2 * speed)) < 1e-8);
    game.paused = true; assert.equal(stepDefense(game, 1), 0);
  }
  const invalid = running(); enemy(invalid);
  for (const value of [0, 4, -1, NaN, "3"]) assert.equal(setDefenseSpeed(invalid, value), false);
  assert.equal(invalid.speed, 1);
  setDefenseSpeed(invalid, 3); assert.ok(Math.abs(stepDefense(invalid, 100) - .25) < 1e-8); assert.ok(Math.abs(invalid.time - .75) < 1e-8);
  const finishing = running(); placeDefense(finishing, "rapidFire", 2, 1); enemy(finishing, { hp: 1 }); setDefenseSpeed(finishing, 3);
  const active = stepDefense(finishing, .2); assert.equal(finishing.status, "building"); assert.ok(active > 0 && active < .2);
});

test("escaped enemies damage the core without kill rewards; defeat stops the wave", () => {
  const game = running(); game.lives = 4;
  enemy(game, { distance: DEFENSE_PATH.length - 1.01, speed: 10, leak: 4, kind: "warden", ...DEFENSE_PATH.at(-1) });
  const energy = game.energy; stepDefense(game, .1);
  assert.equal(game.status, "defeat"); assert.equal(game.lives, 0); assert.equal(game.kills, 0); assert.equal(game.energy, energy);
  assert.equal(startDefenseWave(game), false); const time = game.time; stepDefense(game, .1); assert.equal(game.time, time);
});

test("a cleared wave grants one completion bonus and only the sixtieth cleared wave produces victory", () => {
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
  assert.equal(Object.keys(DEFENSE_TYPES).length, 11); assert.equal(DEFENSE_WAVES,60);
});

test("all 60 waves are beatable with earned energy at normal and fast speed, while late assaults damage the core", () => {
  for(const speed of [1,3]) {
    const game = createDefenseGame(); setDefenseSpeed(game,speed);
    for (const [x, y] of [[3, 4], [5, 6], [11, 5]]) assert.equal(placeDefense(game, "rapidFire", x, y), true);
    function buildBest(type) {
      const stats = DEFENSE_TYPES[type], candidates = [];
      for (let y = 0; y < 12; y++) for (let x = 0; x < 18; x++) {
        if (isDefensePath(x, y) || game.towers.some((tower) => tower.x === x + .5 && tower.y === y + .5)) continue;
        let score = DEFENSE_PATH.filter((point) => Math.hypot(point.x - x - .5, point.y - y - .5) <= stats.range).length;
        if(type === "berserk") score=game.towers.filter(t=>!DEFENSE_TYPES[t.type].support && t.type!=="frost" && Math.hypot(t.x-x-.5,t.y-y-.5)<=stats.range).length*10;
        candidates.push({ x, y, score });
      }
      candidates.sort((a, b) => b.score - a.score);
      return candidates.length && placeDefense(game, type, candidates[0].x, candidates[0].y);
    }
    let damageAt40=0,minimum=20;
    for (let wave = 1; wave <= DEFENSE_WAVES; wave++) {
      if (wave > 1) for (let count = 0; count < 120; count++) {
        const cap=wave<=20?3:DEFENSE_MAX_LEVEL;
        const wanted=[["frost",3],["regen",21],["shield",21],["berserk",22],["sonar",22],["bounty",23]].find(([type,start])=>wave>=start&&!game.towers.some(t=>t.type===type));
        if(wanted && game.energy >= DEFENSE_TYPES[wanted[0]].cost && buildBest(wanted[0]))continue;
        const upgradable = game.towers.find(t=>!DEFENSE_TYPES[t.type].support && t.type!=="frost" && t.level<cap && defenseUpgradeCost(t)<=game.energy);
        if (upgradable) { upgradeDefense(game, upgradable.id); continue; }
        const support=wave>20&&game.towers.find(t=>DEFENSE_TYPES[t.type].support && t.type!=="bounty" && t.level<cap && defenseUpgradeCost(t)<=game.energy);
        if(support){upgradeDefense(game,support.id);continue;}
        const counts=type=>game.towers.filter(t=>t.type===type).length;
        const type=wave%3===0 && !counts("frost") ? "frost" : wave>=4 && counts("demolition")<(wave>35?8:4)?"demolition"
          :wave>=5&&counts("precision")<(wave>35?12:4)?"precision":wave>=21&&counts("scattershot")<3?"scattershot"
          :wave>=21&&counts("overcharge")<3?"overcharge":"rapidFire";
        if (!buildBest(type)) break;
      }
      assert.ok(game.energy >= 0); assert.equal(startDefenseWave(game), true);
      let steps = 0;
      while (game.status === "running" && steps++ < 10000) stepDefense(game, .25);
      assert.equal(game.status, wave === DEFENSE_WAVES ? "victory" : "building", `Wave ${wave} must be survivable at ${speed}x`);
      minimum=Math.min(minimum,game.lives);
      if(wave===40)damageAt40=game.coreDamageTaken;
    }
    assert.equal(game.wave, 60); assert.ok(game.lives>0); assert.ok(minimum<10);
    assert.ok(game.coreDamageTaken>damageAt40,"the final 20 waves still put the core at risk");
    assert.ok(game.coreDamageBlocked>0 && game.coreRepairs>0,"support has real defensive value");
    assert.ok(game.kills>=4000); assert.ok(game.towers.some(t=>t.level===DEFENSE_MAX_LEVEL));
  }
});

test("an affordable opening survives early waves, but ignoring all upgrades loses before the final waves", () => {
  const game = createDefenseGame();
  for (const [x, y] of [[3, 4], [5, 6], [11, 5]]) assert.equal(placeDefense(game, "rapidFire", x, y), true);
  for (let wave = 1; wave <= DEFENSE_WAVES; wave++) {
    startDefenseWave(game); let steps = 0;
    while (game.status === "running" && steps++ < 4000) stepDefense(game, .25);
    if (wave <= 3) assert.equal(game.status, "building", `The starting budget must cover opening wave ${wave}`);
    if (game.status === "defeat") break;
  }
  assert.equal(game.status, "defeat"); assert.ok(game.wave > 3 && game.wave < 15);
});

test("Scattershot hits separate targets and its six upgrade tiers increase volley size", () => {
  for(const level of [1,6]) {
    const game=running();placeDefense(game,"scattershot",2,1);game.towers[0].level=level;
    const targets=Array.from({length:10},(_,i)=>enemy(game,{x:2.5+i*.1,distance:2+i*.1,hp:1000}));
    stepDefense(game,.01);
    assert.equal(targets.filter(t=>t.hp<1000).length,defenseTowerStats(game.towers[0]).targets);
  }
});

test("Berserk and Sonar combine their real effects without stacking duplicate fields, and Sonar blocks regeneration", () => {
  const game=running();placeDefense(game,"rapidFire",2,1);placeDefense(game,"berserk",1,1);placeDefense(game,"berserk",3,1);
  placeDefense(game,"sonar",1,3);placeDefense(game,"sonar",2,3);
  const target=enemy(game,{hp:100,regeneration:10});
  stepDefense(game,.01);
  assert.ok(Math.abs(target.hp-(100-7*1.2*1.15))<1e-8);
  assert.equal(game.towers[0].damageBoost,.2);assert.equal(target.vulnerability,.15);
  game.towers[0].cooldown=100;
  const hp=target.hp;stepDefense(game,.1);assert.equal(target.hp,hp,"Sonar suppresses Crawler recovery");
  game.towers=game.towers.filter(t=>t.type!=="sonar");stepDefense(game,.1);assert.ok(target.hp>hp);
});

test("Bounty pays only the strongest field once for an actual defeat", () => {
  const game=running();placeDefense(game,"rapidFire",2,1);placeDefense(game,"rapidFire",3,1);
  placeDefense(game,"bounty",1,1);placeDefense(game,"bounty",2,3);game.towers.at(-1).level=2;
  enemy(game,{hp:1});enemy(game,{x:15.5,y:10.5,distance:DEFENSE_PATH.length-3,hp:100000});
  const before=game.energy;stepDefense(game,.01);
  assert.equal(game.kills,1);assert.equal(game.energy,before+7+3);
  stepDefense(game,.1);assert.equal(game.energy,before+10,"a second tower cannot pay for an already defeated enemy");
});

test("Regeneration repairs only the strongest rate, never exceeds core health, and pauses completely", () => {
  const game=running();placeDefense(game,"regen",1,1);placeDefense(game,"regen",2,1);
  for(const tower of game.towers)tower.level=6;
  enemy(game,{hp:10000});game.lives=10;game.repairIn=0;
  stepDefense(game,.01);assert.equal(game.lives,13);assert.equal(game.coreRepairs,3);
  game.lives=19;game.repairIn=0;stepDefense(game,.01);assert.equal(game.lives,20);assert.equal(game.coreRepairs,4);
  game.paused=true;const before=JSON.stringify(game);stepDefense(game,100);assert.equal(JSON.stringify(game),before);
  game.paused=false;game.lives=10;game.repairIn=100;
  stepDefense(game,.01);assert.ok(game.repairIn<=defenseTowerStats(game.towers[0]).cooldown,"upgrades clamp remaining repair cooldown to the new rate");
});

test("the strongest Shield absorbs core damage without stacking and refreshes on the next wave", () => {
  const game=createDefenseGame();game.energy=10000;placeDefense(game,"shield",1,1);placeDefense(game,"shield",2,1);
  for(const tower of game.towers)tower.level=6;
  startDefenseWave(game);assert.equal(game.coreShield,7);
  game.queue=["scout"];game.spawnIn=100;
  const leak=()=>enemy(game,{kind:"warden",distance:DEFENSE_PATH.length-1.01,speed:10,leak:4,...DEFENSE_PATH.at(-1)});
  leak();stepDefense(game,.1);assert.equal(game.lives,20);assert.equal(game.coreShield,3);assert.equal(game.coreDamageBlocked,4);
  leak();stepDefense(game,.1);assert.equal(game.lives,19);assert.equal(game.coreShield,0);assert.equal(game.coreDamageBlocked,7);assert.equal(game.coreDamageTaken,1);
  game.queue=[];stepDefense(game,.01);assert.equal(game.status,"building");
  assert.equal(startDefenseWave(game),true);assert.equal(game.coreShield,7);
});

test("fixed waves keep increasing through 60, with elite enemies and twelve Wardens in the final assault", () => {
  for(let wave=2;wave<=60;wave++) {
    assert.ok(defenseWave(wave).length>defenseWave(wave-1).length-12);
    assert.ok(defenseEnemyStats("scout",wave,1).hp>=defenseEnemyStats("scout",wave-1,1).hp);
    assert.ok(defenseEnemyStats("scout",wave,1).speed>defenseEnemyStats("scout",wave-1,1).speed);
  }
  assert.equal(defenseWave(60).filter(t=>t==="warden").length,12);
  assert.ok(defenseEnemyStats("warden",60).hp>defenseEnemyStats("warden",20).hp*5);
  const ordinary=defenseEnemyStats("brute",40,1),elite=defenseEnemyStats("brute",40,0);
  assert.equal(elite.elite,true);assert.ok(elite.hp>ordinary.hp&&elite.armor>ordinary.armor);
  const empty=createDefenseGame();empty.wave=60;assert.equal(startDefenseWave(empty),false);
});
