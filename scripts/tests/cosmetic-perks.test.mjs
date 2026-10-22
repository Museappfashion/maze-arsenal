import assert from "node:assert/strict";
import test from "node:test";
import { updatePickups, healPlayer, givePlayerAmmo, damagePlayer, getPlayerSpeed, meleeAttack, updateProjectiles } from "../../src/game/gameplay.js";
import { cosmeticPerkStatus, cosmeticWeaponHitBonus } from "../../src/game/cosmeticPerks.js";
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

test("orbital walkways have real void gaps, connecting energy bridges, and solid slabs without changing collision", () => {
  const w = world(); const before = JSON.stringify(w.grid);
  assert.equal(orbitalPlatformSample(w, 2.01, 2.01), 0);
  assert.equal(orbitalPlatformSample(w, 3, 2.01), 3);
  assert.equal(orbitalPlatformSample(w, 3, 3), 1);
  assert.equal(orbitalPlatformSample(w, -1, -1), 0);
  assert.equal(JSON.stringify(w.grid), before);
});
