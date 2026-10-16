import assert from "node:assert/strict";
import test from "node:test";
import { FLOOR, WALL } from "../../src/config/constants.js";
import { WEAPONS } from "../../src/config/weapons.js";
import { getBowDrawProgress, isMedievalArcheryWeapon } from "../../src/config/archery.js";
import { rangedAttack, updateProjectiles } from "../../src/game/gameplay.js";
import { draw3DProjectile, drawProjectile, project3DSprite } from "../../src/game/rendering.js";
import { CANVAS_WIDTH, VIEW_3D_FOV } from "../../src/config/constants.js";

function makeWorld(themeKey = "medieval") {
  return {
    width: 4, height: 3, nextId: 1, time: 0,
    grid: [[WALL, WALL, WALL, WALL], [WALL, FLOOR, FLOOR, WALL], [WALL, WALL, WALL, WALL]],
    level: { themeKey }, projectiles: [], effects: [], enemies: [],
    player: { x: 1.5, y: 1.5, facing: 0, weapon: "pistol", ammo: 10, powerUps: {} },
  };
}

function shoot(world) {
  rangedAttack(world, { ...WEAPONS.pistol, spread: 0 }, { x: 1, y: 0 });
  updateProjectiles(world, 0.1);
  return world.projectiles[0];
}

test("an arrow stays fixed in a wall for one second, without damage or bullet sparks", () => {
  const world = makeWorld();
  const arrow = shoot(world);
  assert.equal(arrow.stuckInWall, true);
  assert.equal(arrow.ttl, 1);
  assert.deepEqual([arrow.vx, arrow.vy, arrow.angle], [0, 0, 0]);
  assert.equal(world.effects.length, 0);
  const position = [arrow.x, arrow.y];
  world.enemies.push({ id: "near-wall", x: arrow.x, y: arrow.y, hp: 100, radius: 0.4 });
  updateProjectiles(world, 0.99);
  assert.equal(world.projectiles.length, 1);
  assert.deepEqual([arrow.x, arrow.y], position);
  assert.equal(world.enemies[0].hp, 100);
  updateProjectiles(world, 0.011);
  assert.equal(world.projectiles.length, 0);
});

test("normal guns keep immediate wall impacts, and special weapons remain non-archery", () => {
  const world = makeWorld("jungle");
  shoot(world);
  assert.equal(world.projectiles.length, 0);
  assert.ok(world.effects.some(effect => effect.kind === "muzzle"));
  const keep = makeWorld();
  for (const key of ["swordGun", "portalGun", "blackSword", "fists"]) {
    assert.equal(isMedievalArcheryWeapon(keep, key), false);
  }
});

test("bow releases its arrow and redraws the string during the weapon cooldown", () => {
  const world = makeWorld();
  assert.equal(getBowDrawProgress(world), 1);
  rangedAttack(world, WEAPONS.pistol, { x: 1, y: 0 });
  assert.equal(getBowDrawProgress(world), 0);
  world.time = WEAPONS.pistol.cooldown / 2;
  assert.equal(getBowDrawProgress(world), 0.5);
  world.time = WEAPONS.pistol.cooldown;
  assert.equal(getBowDrawProgress(world), 1);
  assert.equal(world.effects.length, 0);
});

test("wall arrows retain their direction in 2D and project relative to the camera in 3D", () => {
  const world = makeWorld();
  const arrow = shoot(world);
  arrow.angle = Math.PI / 4;
  const calls = [];
  const ctx = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]) });
  drawProjectile(ctx, arrow, { x: 0, y: 0 });
  assert.ok(calls.some(call => call[0] === "rotate" && call[1] === arrow.angle));
  const plane = CANVAS_WIDTH / (2 * Math.tan(VIEW_3D_FOV / 2));
  const projection = project3DSprite(world, arrow.x, arrow.y, plane);
  draw3DProjectile(ctx, arrow, projection, world);
  for (const call of calls) for (const value of call.slice(1)) {
    if (typeof value === "number") assert.ok(Number.isFinite(value));
  }
});
