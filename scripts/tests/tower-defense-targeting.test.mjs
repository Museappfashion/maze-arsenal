import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFENSE_TARGET_MODES, DEFENSE_TYPES, createDefenseGame, placeDefense,
  upgradeDefense, startDefenseWave, stepDefense, defenseTowerStats,
  defenseSupportsTargeting, setDefenseTargetMode,
} from "../../src/game/towerDefense.js";

const MODES = ["strongest", "weakest", "first", "last"];
const TARGETED = ["rapidFire", "demolition", "precision", "overcharge", "juggernaut", "breaker", "haste", "magnet", "pierce", "vampirism", "ammoSurge", "phaseWalk"];
const UNTARGETED = ["scattershot", "longArms", "frost", "berserk", "sonar", "bounty", "regen", "shield"];
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);

function running(type = "rapidFire") {
  const game = createDefenseGame(); game.energy = 10000;
  assert.equal(placeDefense(game, type, 2, 1), true);
  assert.equal(startDefenseWave(game), true);
  game.queue = []; game.spawnIn = 100;
  return game;
}
function enemy(game, { x = 2.5, y = 2.5, hp = 100, distance = 2, ...extra } = {}) {
  const unit = { id: game.nextId++, kind: "scout", x, y, hp, maxHp: hp, distance, armor: 0, speed: 0, reward: 7, leak: 1, slow: 1, ...extra };
  game.enemies.push(unit); return unit;
}
function choices(game) {
  return {
    strongest: enemy(game, { x: 2.2, hp: 90, distance: 2 }),
    weakest: enemy(game, { x: 2.4, hp: 30, maxHp: 10000, distance: 2.5 }),
    first: enemy(game, { x: 2.6, hp: 50, distance: 5 }),
    last: enemy(game, { x: 2.8, hp: 70, distance: .5 }),
  };
}

test("four target choices apply only to individually aimed defenses", () => {
  assert.deepEqual(DEFENSE_TARGET_MODES.map(mode => mode.key).sort(), [...MODES].sort());
  assert.deepEqual(DEFENSE_TARGET_MODES.map(mode => mode.label).sort(), ["First", "Last", "Strongest", "Weakest"]);
  assert.ok(DEFENSE_TARGET_MODES.every(mode => typeof mode.description === "string" && mode.description.length));
  assert.deepEqual([...TARGETED, ...UNTARGETED].sort(), Object.keys(DEFENSE_TYPES).sort());
  for (const type of TARGETED) {
    assert.equal(defenseSupportsTargeting(type), true, type);
    assert.equal(defenseSupportsTargeting({ type, level: 1 }), true, type);
    assert.equal(running(type).towers[0].targetMode, "first", "new aimed defenses preserve leading-enemy behavior");
  }
  for (const type of UNTARGETED) {
    assert.equal(defenseSupportsTargeting(type), false, type);
    const game = running(type), tower = game.towers[0];
    for (const mode of MODES) assert.equal(setDefenseTargetMode(game, tower.id, mode), false, `${type} has no target preference`);
  }
  for (const value of [null, undefined, {}, "unknown", "toString"]) assert.equal(defenseSupportsTargeting(value), false);
});

test("the four choices damage distinct enemies using current health or route progress", () => {
  for (const mode of MODES) {
    const game = running(), units = choices(game), tower = game.towers[0];
    const before = Object.fromEntries(Object.entries(units).map(([key, unit]) => [key, unit.hp]));
    assert.equal(setDefenseTargetMode(game, tower.id, mode), true);
    stepDefense(game, .01);
    for (const [key, unit] of Object.entries(units)) assert.equal(unit.hp, before[key] - (key === mode ? 7 : 0), `${mode} selects ${mode}, not ${key}`);
  }
});

test("all twelve aimed attack types aim their initial attack at the chosen enemy", () => {
  for (const type of TARGETED) {
    const game = running(type), tower = game.towers[0];
    const strong = enemy(game, { x: 2.2, y: 2.4, hp: 1000, distance: 1 });
    enemy(game, { x: 2.8, y: 2.3, hp: 100, distance: 3 });
    const aimedAt = { x: strong.x, y: strong.y };
    assert.equal(setDefenseTargetMode(game, tower.id, "strongest"), true);
    stepDefense(game, .01);
    const shot = game.effects.find(effect => effect.type === "beam");
    assert.ok(shot, `${type} actually fires`);
    close(shot.x2, aimedAt.x); close(shot.y2, aimedAt.y);
    assert.ok(strong.hp < 1000, `${type} actually damages its chosen primary target`);
  }
});

test("dead and out-of-range enemies cannot win any target priority", () => {
  for (const mode of MODES) {
    const game = running(), tower = game.towers[0];
    const valid = enemy(game, { hp: 100, distance: 2 });
    const farStrong = enemy(game, { x: 14, y: 10, hp: 10000, distance: 34 });
    const farWeak = enemy(game, { x: 14.5, y: 10, hp: .1, distance: 0 });
    const dead = enemy(game, { hp: 0, distance: 99 });
    setDefenseTargetMode(game, tower.id, mode); stepDefense(game, .01);
    assert.equal(valid.hp, 93); assert.equal(farStrong.hp, 10000); assert.equal(farWeak.hp, .1); assert.equal(dead.hp, 0);
    assert.equal(game.kills, 0, "an already dead enemy is never rewarded");
  }
});

test("equal-health ties prefer the leading enemy and exact ties stay stable despite array order", () => {
  for (const mode of ["strongest", "weakest"]) {
    const game = running(), tower = game.towers[0];
    const behind = enemy(game, { hp: 100, distance: 1 }), ahead = enemy(game, { hp: 100, distance: 3, x: 2.7 });
    setDefenseTargetMode(game, tower.id, mode); stepDefense(game, .01);
    assert.equal(behind.hp, 100); assert.equal(ahead.hp, 93);
  }
  for (const mode of MODES) for (const reversed of [false, true]) {
    const game = running(), tower = game.towers[0];
    const highId = enemy(game, { id: 20, x: 2.3 }), lowId = enemy(game, { id: 10, x: 2.7 });
    if (reversed) game.enemies.reverse();
    setDefenseTargetMode(game, tower.id, mode); stepDefense(game, .01);
    assert.equal(lowId.hp, 93, `${mode}: stable ID resolves equal health/progress`); assert.equal(highId.hp, 100);
  }
});

test("missing or invalid old target modes retain First behavior", () => {
  for (const mode of [undefined, null, "closest", "FIRST", 3, { key: "last" }]) {
    const game = running(), units = choices(game);
    game.towers[0].targetMode = mode;
    stepDefense(game, .01);
    assert.equal(units.first.hp, 43); assert.equal(units.strongest.hp, 90); assert.equal(units.weakest.hp, 30); assert.equal(units.last.hp, 70);
  }
});

test("target preferences are independent per defense and survive upgrades and later waves", () => {
  const game = createDefenseGame(); game.energy = 10000;
  placeDefense(game, "rapidFire", 2, 1); placeDefense(game, "precision", 3, 1);
  const [a, b] = game.towers;
  assert.equal(setDefenseTargetMode(game, a.id, "strongest"), true);
  assert.equal(setDefenseTargetMode(game, b.id, "last"), true);
  assert.equal(upgradeDefense(game, a.id), true);
  assert.equal(a.targetMode, "strongest"); assert.equal(b.targetMode, "last");
  assert.equal(startDefenseWave(game), true);
  game.status = "building"; assert.equal(startDefenseWave(game), true);
  assert.equal(a.targetMode, "strongest"); assert.equal(b.targetMode, "last");
});

test("invalid settings and finished battles cannot mutate target preferences or spend resources", () => {
  const game = running(), tower = game.towers[0];
  setDefenseTargetMode(game, tower.id, "weakest");
  const energy = game.energy, time = game.time, cooldown = tower.cooldown;
  for (const mode of [undefined, null, "nearest", "FIRST", 0, {}]) assert.equal(setDefenseTargetMode(game, tower.id, mode), false);
  assert.equal(setDefenseTargetMode(game, -1, "first"), false);
  for (const status of ["victory", "defeat", "unknown"]) {
    game.status = status; assert.equal(setDefenseTargetMode(game, tower.id, "last"), false);
  }
  assert.equal(tower.targetMode, "weakest"); assert.equal(game.energy, energy); assert.equal(game.time, time); assert.equal(tower.cooldown, cooldown);
});

test("changing targeting while paused is free and never advances the frozen battle", () => {
  const game = running(), tower = game.towers[0]; enemy(game, { speed: 1 });
  game.paused = true;
  const energy = game.energy, cooldown = tower.cooldown;
  assert.equal(setDefenseTargetMode(game, tower.id, "last"), true);
  assert.equal(game.energy, energy); assert.equal(tower.cooldown, cooldown);
  const frozen = JSON.stringify(game);
  assert.equal(stepDefense(game, 100), 0); assert.equal(JSON.stringify(game), frozen);
  assert.equal(upgradeDefense(game, tower.id), false, "target preferences do not unlock paused economy actions");
});

test("splash and slams center their groups on the selected primary target", () => {
  for (const type of ["demolition", "juggernaut"]) {
    const game = running(type), tower = game.towers[0], damage = defenseTowerStats(tower).damage;
    const strong = enemy(game, { x: 4, y: 2, hp: 1000, distance: 2 });
    const neighbor = enemy(game, { x: 4.2, y: 2.1, hp: 200, distance: 1 });
    const leading = enemy(game, { x: .9, y: 1.5, hp: 300, distance: 4 });
    const otherGroup = enemy(game, { x: .8, y: 1.5, hp: 250, distance: 3 });
    setDefenseTargetMode(game, tower.id, "strongest"); stepDefense(game, .01);
    assert.equal(strong.hp, 1000 - damage); assert.equal(neighbor.hp, 200 - damage);
    assert.equal(leading.hp, 300); assert.equal(otherGroup.hp, 250);
    if (type === "juggernaut") { assert.ok(strong.stunned > 0 && neighbor.stunned > 0); assert.ok(!leading.stunned); }
  }
});

test("Overcharge selects its starting enemy by priority, then chains to nearest neighbors", () => {
  const game = running("overcharge"), tower = game.towers[0];
  const strong = enemy(game, { x: 4, y: 1.5, hp: 1000, distance: 2 });
  const nearest = enemy(game, { x: 4.2, y: 1.5, hp: 100, distance: .3 });
  const next = enemy(game, { x: 5, y: 1.5, hp: 200, distance: .5 });
  const leading = enemy(game, { x: 1, y: 1.5, hp: 400, distance: 10 });
  setDefenseTargetMode(game, tower.id, "strongest"); stepDefense(game, .01);
  close(strong.hp, 987); close(nearest.hp, 100 - 13 * .85); close(next.hp, 200 - 13 * .85 ** 2);
  assert.equal(leading.hp, 400);
});

test("Pierce applies target priority to its bounded group instead of hitting every enemy", () => {
  for (const mode of MODES) {
    const game = running("pierce"), tower = game.towers[0];
    const units = Array.from({ length: 6 }, (_, index) => enemy(game, { x: 2.1 + index * .1, hp: (index + 1) * 100, distance: 6 - index }));
    setDefenseTargetMode(game, tower.id, mode); stepDefense(game, .01);
    const skipped = ["strongest", "last"].includes(mode) ? 0 : 5;
    for (let index = 0; index < units.length; index++) assert.equal(units[index].hp, (index + 1) * 100 - (index === skipped ? 0 : 18));
  }
});

test("Ammo Surge recalculates strongest after each shot, and weakest after each defeat", () => {
  const strongGame = running("ammoSurge"), tower = strongGame.towers[0];
  const a = enemy(strongGame, { hp: 20, distance: 2 }), b = enemy(strongGame, { x: 2.7, hp: 19, maxHp: 10000, distance: 1 });
  setDefenseTargetMode(strongGame, tower.id, "strongest"); stepDefense(strongGame, .01);
  assert.equal(a.hp, 10); assert.equal(b.hp, 14, "each shot uses the health remaining after the previous shot");
  const weakGame = running("ammoSurge"), weakTower = weakGame.towers[0];
  const small = enemy(weakGame, { hp: 1, distance: 1 }), medium = enemy(weakGame, { x: 2.6, hp: 4, distance: 3 }), large = enemy(weakGame, { x: 2.7, hp: 6, distance: 2 });
  const energy = weakGame.energy;
  setDefenseTargetMode(weakGame, weakTower.id, "weakest"); stepDefense(weakGame, .01);
  assert.ok(small.hp <= 0 && medium.hp <= 0); assert.equal(large.hp, 1);
  assert.equal(weakGame.kills, 2); assert.equal(weakGame.energy, energy + 14, "a dead target cannot receive another shot or reward");
});

test("later defenses use the health changed by earlier defenses in the same simulation step", () => {
  const game = running(); placeDefense(game, "rapidFire", 3, 1);
  const a = enemy(game, { hp: 20 }), b = enemy(game, { x: 2.7, hp: 19, distance: 1 });
  for (const tower of game.towers) setDefenseTargetMode(game, tower.id, "strongest");
  stepDefense(game, .01); assert.equal(a.hp, 13); assert.equal(b.hp, 12);
});

test("sprays and all-nearby sweeps ignore an injected target mode and keep their area behavior", () => {
  const spray = running("scattershot"); spray.towers[0].targetMode = "last";
  const units = Array.from({ length: 4 }, (_, index) => enemy(spray, { x: 2.3 + index * .1, hp: 1000, distance: index + 1 }));
  stepDefense(spray, .01);
  assert.equal(units[0].hp, 1000); assert.ok(units.slice(1).every(unit => unit.hp === 990), "the original leading-enemy volley still hits three separate enemies");
  const sweep = running("longArms"); sweep.towers[0].targetMode = "weakest";
  const near = Array.from({ length: 4 }, (_, index) => enemy(sweep, { x: 2.3 + index * .1, hp: 1000 + index * 10, distance: index + 1 }));
  const outside = enemy(sweep, { x: 7, y: 8, hp: 1, distance: 20 });
  stepDefense(sweep, .01);
  near.forEach((unit, index) => assert.equal(unit.hp, 1000 + index * 10 - 18)); assert.equal(outside.hp, 1);
});
