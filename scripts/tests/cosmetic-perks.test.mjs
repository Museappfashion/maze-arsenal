import assert from "node:assert/strict";
import test from "node:test";
import { updatePickups, healPlayer, givePlayerAmmo, damagePlayer, getPlayerSpeed, meleeAttack, updateProjectiles } from "../../src/game/gameplay.js";
import { cosmeticPerkStatus, cosmeticWeaponHitBonus, getCosmeticPerk } from "../../src/game/cosmeticPerks.js";
import { COSMETIC_PERKS, COSMETIC_UPGRADE_PRICE, MAX_COSMETIC_UPGRADES, getCosmeticUpgradeLevel, getCosmeticPerkDefinition } from "../../src/config/cosmeticPerks.js";
import { orbitalPlatformSample } from "../../src/game/outdoorScenes3D.js";

function world(skin = null) {
  return { time: 0, nextId: 1, width: 12, height: 5, gameOver: false, victory: false,
    grid: Array.from({ length: 5 }, (_, y) => Array.from({ length: 12 }, (_, x) => !x || !y || x === 11 || y === 4 ? 1 : 0)),
    level: { themeKey: "city" }, enemies: [], projectiles: [], effects: [], pickups: [],
    player: { cosmetic: skin, x: 2.5, y: 2.5, facing: 0, hp: 100, maxHp: 100, ammo: 0, radius: .24, speed: 4.1, weapon: "fists", powerUps: {}, powerUpSlots: [null, null] },
  };
}
const approx = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);
function pickup(w, type, amount) { w.pickups = [{ id: 1, type, amount, x: w.player.x, y: w.player.y }]; updatePickups(w, .1); }

test("turkey earns ten percent extra only from ammo pickups, respects the cap, and has no medkit bonus", () => {
  const w = world("turkey"); pickup(w, "ammo", 20); approx(w.player.ammo, 22);
  givePlayerAmmo(w, 10); approx(w.player.ammo, 32);
  w.player.ammo = 199; pickup(w, "ammo", 20); assert.equal(w.player.ammo, 200);
  w.player.hp = 50; pickup(w, "medkit", 20); assert.equal(w.player.hp, 70);
  const original = world(); pickup(original, "ammo", 20); assert.equal(original.player.ammo, 20);
});

test("alien improves medkits only; full-health healing stays capped", () => {
  const w = world("alien"); w.player.hp = 50; pickup(w, "medkit", 20); approx(w.player.hp, 72);
  healPlayer(w, 10); approx(w.player.hp, 82);
  pickup(w, "medkit", 20); assert.equal(w.player.hp, 100);
  pickup(w, "ammo", 20); assert.equal(w.player.ammo, 20);
});

test("Wisp activates on real damage for two seconds and cannot retrigger for twenty seconds", () => {
  const w = world("shadowWisp"); damagePlayer(w, 10); approx(getPlayerSpeed(w), 4.1 * 1.15);
  w.time = 2; approx(getPlayerSpeed(w), 4.1);
  w.time = 3; damagePlayer(w, 10); approx(getPlayerSpeed(w), 4.1);
  assert.match(cosmeticPerkStatus(w), /17s recharge/);
  w.time = 20; damagePlayer(w, 10); approx(getPlayerSpeed(w), 4.1 * 1.15);
  w.player.powerUps.haste = { endsAt: 30 }; approx(getPlayerSpeed(w), 4.1 * 1.75 * 1.15);
  const immune = world("shadowWisp"); immune.player.powerUps.phaseWalk = { endsAt: 10 }; damagePlayer(immune, 10); assert.equal(immune.player.cosmeticPerkState, undefined);
});

test("Crystal absorbs at most five damage once every 25 seconds, after armor, and immunity preserves the shell", () => {
  const w = world("crystalGuardian"); damagePlayer(w, 3); assert.equal(w.player.hp, 100);
  damagePlayer(w, 10); assert.equal(w.player.hp, 90);
  w.time = 24.99; damagePlayer(w, 5); assert.equal(w.player.hp, 85);
  w.time = 25; damagePlayer(w, 10); assert.equal(w.player.hp, 80);
  const armored = world("crystalGuardian"); armored.player.powerUps.shield = { endsAt: 30 }; damagePlayer(armored, 20); assert.equal(armored.player.hp, 95);
  const zero = world("crystalGuardian"); damagePlayer(zero, 0); assert.equal(zero.player.cosmeticPerkState, undefined);
  const immune = world("crystalGuardian"); immune.player.powerUps.phaseWalk = { endsAt: 1 }; damagePlayer(immune, 10); assert.equal(immune.player.cosmeticPerkState, undefined);
});

test("Ember adds exactly three damage on the tenth real melee hit; misses and dead targets never advance it", () => {
  const w = world("emberSpirit");
  const weapon = { damage: 2, type: "melee", cooldown: .2, reach: 2, arc: 2 };
  meleeAttack(w, weapon, { x: 1, y: 0 }); assert.equal(w.player.cosmeticPerkState, undefined);
  const enemy = { id: 1, x: 3.5, y: 2.5, radius: .2, hp: 100, kind: "runner" }; w.enemies = [enemy];
  for (let i = 0; i < 9; i++) meleeAttack(w, weapon, { x: 1, y: 0 });
  assert.equal(enemy.hp, 82); assert.match(cosmeticPerkStatus(w), /9\/10/);
  meleeAttack(w, weapon, { x: 1, y: 0 }); assert.equal(enemy.hp, 77); assert.match(cosmeticPerkStatus(w), /0\/10/);
  enemy.hp = 0; meleeAttack(w, weapon, { x: 1, y: 0 }); assert.equal(w.player.cosmeticPerkState.hits, 0);
});

test("Ember works for projectile hits without counting a piercing bullet twice on one target", () => {
  const w = world("emberSpirit"), enemy = { id: 1, x: 3.5, y: 2.5, hp: 100, radius: .3, kind: "runner" };
  for (let i = 0; i < 9; i++) cosmeticWeaponHitBonus(w, enemy);
  w.enemies = [enemy];
  w.projectiles = [{ x: 3.2, y: 2.5, vx: 2, vy: 0, radius: .1, damage: 10, owner: "player", ttl: 2, hitIds: new Set(), piercesLeft: 10, color: "#fff" }];
  updateProjectiles(w, .1); assert.equal(enemy.hp, 87); assert.equal(w.player.cosmeticPerkState.hits, 0);
  updateProjectiles(w, .1); assert.equal(enemy.hp, 87); assert.equal(w.player.cosmeticPerkState.hits, 0);
});

test("perks use run time, reset in a new run, and do not apply in Labyrinth", () => {
  const w = world("crystalGuardian"); damagePlayer(w, 10); assert.equal(w.player.cosmeticPerkState.readyAt, 25);
  const next = world("crystalGuardian"); damagePlayer(next, 10); assert.equal(next.player.hp, 95);
  const lab = world("turkey"); lab.labyrinthMode = true; pickup(lab, "ammo", 20); assert.equal(lab.player.ammo, 20);
  lab.player.cosmetic = "crystalGuardian"; damagePlayer(lab, 10); assert.equal(lab.player.hp, 90);
});

test("orbital walkways support pickups on solid rock without changing collision", () => {
  const w = world(); const before = JSON.stringify(w.grid);
  assert.equal(orbitalPlatformSample(w, 2.01, 2.01), 1);
  assert.equal(orbitalPlatformSample(w, 3, 2.01), 1);
  assert.equal(orbitalPlatformSample(w, 3, 3), 1);
  assert.equal(orbitalPlatformSample(w, -1, -1), 0);
  assert.equal(JSON.stringify(w.grid), before);
});


const TIERS = [0, 1, 2, 3];
const PICKUP_BONUSES = [.10, .15, .20, .25];
const SPEED_BONUSES = [.15, .20, .25, .30];
const WISP_DURATIONS = [2, 2.5, 3, 3.5];
const WISP_COOLDOWNS = [20, 18, 16, 14];
const EMBER_DAMAGE = [3, 5, 7, 10];
const EMBER_HITS = [10, 9, 8, 7];
const CRYSTAL_ABSORB = [5, 7, 9, 12];
const CRYSTAL_COOLDOWNS = [25, 23, 21, 18];
const upgradedWorld = (skin, level) => { const w = world(skin); w.player.cosmeticUpgradeLevel = level; return w; };

test("shared upgrade definitions preserve base perks and expose the exact paid tiers", () => {
  assert.equal(COSMETIC_UPGRADE_PRICE, 10000); assert.equal(MAX_COSMETIC_UPGRADES, 3);
  assert.deepEqual(Object.keys(COSMETIC_PERKS), ["turkey", "alien", "shadowWisp", "emberSpirit", "crystalGuardian"]);
  for (const [skin, base] of Object.entries(COSMETIC_PERKS)) {
    assert.equal(Object.isFrozen(base), true);
    assert.deepEqual(Object.keys(base), ["label", "description"], "existing cosmetic configs keep their base perk references");
    for (const level of TIERS) {
      const perk = getCosmeticPerkDefinition(skin, level);
      assert.equal(perk.label, base.label); assert.equal(perk.upgradeLevel, level);
      assert.equal(Object.isFrozen(perk), true); assert.equal(getCosmeticPerkDefinition(skin, level), perk, "definitions can be reused during rendering and gameplay");
      if (!level) assert.equal(perk.description, base.description);
      if (skin === "turkey" || skin === "alien") assert.equal(perk.pickupBonus, PICKUP_BONUSES[level]);
      if (skin === "shadowWisp") assert.deepEqual([perk.speedBonus, perk.duration, perk.cooldown], [SPEED_BONUSES[level], WISP_DURATIONS[level], WISP_COOLDOWNS[level]]);
      if (skin === "emberSpirit") assert.deepEqual([perk.extraDamage, perk.hitsRequired], [EMBER_DAMAGE[level], EMBER_HITS[level]]);
      if (skin === "crystalGuardian") assert.deepEqual([perk.absorb, perk.cooldown], [CRYSTAL_ABSORB[level], CRYSTAL_COOLDOWNS[level]]);
    }
  }
  for (const skin of [null, "", "default", "constructor", "toString"]) assert.equal(getCosmeticPerkDefinition(skin, 3), null);
});

test("malformed upgrade levels cannot exceed three tiers or produce invalid effect values", () => {
  for (const [input, expected] of [[undefined, 0], [null, 0], [NaN, 0], [Infinity, 0], [-Infinity, 0], [-50, 0], [2.9, 2], ["2", 0], ["bad", 0], [99, 3], [Symbol("bad"), 0], [{ valueOf() { throw new Error("invalid level"); } }, 0]]) {
    assert.equal(getCosmeticUpgradeLevel(input), expected);
    assert.equal(getCosmeticPerkDefinition("turkey", input).pickupBonus, PICKUP_BONUSES[expected]);
  }
  const original = world("turkey"); assert.equal(getCosmeticPerk(original).upgradeLevel, 0);
  const maximum = upgradedWorld("turkey", 99); pickup(maximum, "ammo", 20); approx(maximum.player.ammo, 25);
});

test("all turkey and alien tiers improve only their matching pickup while preserving resource caps", () => {
  for (const level of TIERS) {
    const turkey = upgradedWorld("turkey", level); pickup(turkey, "ammo", 20); approx(turkey.player.ammo, 20 * (1 + PICKUP_BONUSES[level]));
    givePlayerAmmo(turkey, 10); approx(turkey.player.ammo, 20 * (1 + PICKUP_BONUSES[level]) + 10);
    turkey.player.ammo = 199; pickup(turkey, "ammo", 20); assert.equal(turkey.player.ammo, 200);
    turkey.player.hp = 50; pickup(turkey, "medkit", 20); assert.equal(turkey.player.hp, 70);
    const alien = upgradedWorld("alien", level); alien.player.hp = 40; pickup(alien, "medkit", 20); approx(alien.player.hp, 40 + 20 * (1 + PICKUP_BONUSES[level]));
    healPlayer(alien, 10); approx(alien.player.hp, 50 + 20 * (1 + PICKUP_BONUSES[level]));
    alien.player.hp = 99; pickup(alien, "medkit", 20); assert.equal(alien.player.hp, 100);
    pickup(alien, "ammo", 20); assert.equal(alien.player.ammo, 20);
  }
});

test("all Wisp tiers use their upgraded speed, active duration and recharge after real damage", () => {
  for (const level of TIERS) {
    const w = upgradedWorld("shadowWisp", level); damagePlayer(w, 1);
    approx(getPlayerSpeed(w), 4.1 * (1 + SPEED_BONUSES[level]));
    assert.equal(w.player.cosmeticPerkState.readyAt, WISP_COOLDOWNS[level]);
    w.player.powerUps.haste = { endsAt: 50 }; approx(getPlayerSpeed(w), 4.1 * 1.75 * (1 + SPEED_BONUSES[level])); delete w.player.powerUps.haste;
    w.time = WISP_DURATIONS[level]; approx(getPlayerSpeed(w), 4.1);
    w.time = WISP_COOLDOWNS[level] - .01; damagePlayer(w, 1); approx(getPlayerSpeed(w), 4.1);
    w.time = WISP_COOLDOWNS[level]; damagePlayer(w, 1); approx(getPlayerSpeed(w), 4.1 * (1 + SPEED_BONUSES[level]));
    assert.equal(w.player.cosmeticPerkState.activeUntil, WISP_COOLDOWNS[level] + WISP_DURATIONS[level]);
    const immune = upgradedWorld("shadowWisp", level); immune.player.powerUps.phaseWalk = { endsAt: 10 }; damagePlayer(immune, 10); assert.equal(immune.player.cosmeticPerkState, undefined);
    const fatal = upgradedWorld("shadowWisp", level); fatal.player.hp = 1; damagePlayer(fatal, 2); assert.equal(fatal.player.cosmeticPerkState, undefined, "fatal damage cannot activate an escape buff");
  }
});

test("all Crystal tiers absorb after armor, clamp damage at zero and preserve their upgraded recharge", () => {
  for (const level of TIERS) {
    const w = upgradedWorld("crystalGuardian", level); damagePlayer(w, 20); assert.equal(w.player.hp, 80 + CRYSTAL_ABSORB[level]);
    assert.equal(w.player.cosmeticPerkState.readyAt, CRYSTAL_COOLDOWNS[level]);
    w.time = CRYSTAL_COOLDOWNS[level] - .01; damagePlayer(w, 1); assert.equal(w.player.hp, 79 + CRYSTAL_ABSORB[level]);
    w.time = CRYSTAL_COOLDOWNS[level]; damagePlayer(w, 1); assert.equal(w.player.hp, 79 + CRYSTAL_ABSORB[level]);
    const armored = upgradedWorld("crystalGuardian", level); armored.player.powerUps.shield = { endsAt: 50 }; damagePlayer(armored, 20); assert.equal(armored.player.hp, 100 - Math.max(0, 10 - CRYSTAL_ABSORB[level]));
    const immune = upgradedWorld("crystalGuardian", level); immune.player.powerUps.phaseWalk = { endsAt: 1 }; damagePlayer(immune, 10); assert.equal(immune.player.cosmeticPerkState, undefined);
  }
});

test("all Ember tiers trigger on the upgraded real-hit count and display that denominator", () => {
  for (const level of TIERS) {
    const w = upgradedWorld("emberSpirit", level), hits = EMBER_HITS[level];
    const weapon = { damage: 2, type: "melee", cooldown: .2, reach: 2, arc: 2 };
    meleeAttack(w, weapon, { x: 1, y: 0 }); assert.equal(w.player.cosmeticPerkState, undefined, "misses never count");
    const enemy = { id: 1, x: 3.5, y: 2.5, radius: .2, hp: 100, kind: "runner" }; w.enemies = [enemy];
    for (let i = 0; i < hits - 1; i++) meleeAttack(w, weapon, { x: 1, y: 0 });
    assert.equal(enemy.hp, 100 - 2 * (hits - 1)); assert.equal(cosmeticPerkStatus(w), `Ember Strike · ${hits - 1}/${hits}`);
    meleeAttack(w, weapon, { x: 1, y: 0 }); assert.equal(enemy.hp, 100 - 2 * hits - EMBER_DAMAGE[level]); assert.equal(cosmeticPerkStatus(w), `Ember Strike · 0/${hits}`);
    enemy.hp = 0; assert.equal(cosmeticWeaponHitBonus(w, enemy), 0); assert.equal(w.player.cosmeticPerkState.hits, 0);
    const projectileWorld = upgradedWorld("emberSpirit", level), projectileEnemy = { id: 2, x: 3.5, y: 2.5, hp: 100, radius: .3, kind: "runner" };
    for (let i = 0; i < hits - 1; i++) cosmeticWeaponHitBonus(projectileWorld, projectileEnemy);
    projectileWorld.enemies = [projectileEnemy]; projectileWorld.projectiles = [{ x: 3.2, y: 2.5, vx: 2, vy: 0, radius: .1, damage: 10, owner: "player", ttl: 2, hitIds: new Set(), piercesLeft: 10, color: "#fff" }];
    updateProjectiles(projectileWorld, .1); assert.equal(projectileEnemy.hp, 90 - EMBER_DAMAGE[level]);
    updateProjectiles(projectileWorld, .1); assert.equal(projectileEnemy.hp, 90 - EMBER_DAMAGE[level], "a piercing bullet cannot count twice on the same target");
  }
});

test("all upgraded skins remain disabled in Labyrinth and changing a run snapshot resets stale perk counters", () => {
  for (const skin of Object.keys(COSMETIC_PERKS)) for (const level of TIERS) {
    const lab = upgradedWorld(skin, level); lab.labyrinthMode = true; lab.player.hp = 50;
    assert.equal(getCosmeticPerk(lab), null); pickup(lab, "ammo", 20); assert.equal(lab.player.ammo, 20);
    pickup(lab, "medkit", 20); assert.equal(lab.player.hp, 70); damagePlayer(lab, 10); assert.equal(lab.player.hp, 60);
    approx(getPlayerSpeed(lab), 4.1); assert.equal(cosmeticWeaponHitBonus(lab, { hp: 100 }), 0); assert.equal(cosmeticPerkStatus(lab), "");
  }
  const changing = upgradedWorld("emberSpirit", 0), enemy = { hp: 100 };
  for (let i = 0; i < 9; i++) cosmeticWeaponHitBonus(changing, enemy);
  changing.player.cosmeticUpgradeLevel = 3;
  assert.equal(cosmeticWeaponHitBonus(changing, enemy), 0); assert.equal(cosmeticPerkStatus(changing), "Ember Strike · 1/7");
});
