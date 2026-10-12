import assert from "node:assert/strict";
import test from "node:test";
import { LEVELS, PASSAGE_WIDTH } from "../../src/config/constants-enhanced.js";
import {
  FARM_WIDTH, FARM_HEIGHT, FARM_PLAYER_SPEED, FARM_FARMER_SPEED,
  FARM_RESCUE_SECONDS, FARM_POWERUPS, FARM_SPAWN_LIMITS,
} from "../../src/config/thanksgiving.js";
import {
  createThanksgivingWorld, updateThanksgivingWorld,
  activateThanksgivingPower, getThanksgivingSnapshot,
} from "../../src/game/thanksgiving.js";

function seeded(seed = 1) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function makeWorld(options = {}) {
  return createThanksgivingWorld({ random: seeded(), ...options });
}
function clearStreetWorld(options = {}) {
  const world = makeWorld(options);
  Object.assign(world.player, { x: 3.5, y: 2.5 });
  Object.assign(world.farmer, { x: 40.5, y: 2.5 });
  world.cages = [];
  world.corn = [];
  world.pickups = [];
  return world;
}
function advance(world, seconds, input = {}) {
  while (seconds > 1e-7) {
    const dt = Math.min(0.1, seconds);
    updateThanksgivingWorld(world, dt, input);
    seconds -= dt;
  }
}
function onRoad(world, entity) {
  assert.equal(world.grid[Math.floor(entity.y)]?.[Math.floor(entity.x)], 0);
}
function approx(actual, expected, precision = 1e-8) {
  assert.ok(Math.abs(actual - expected) < precision, `${actual} differs from ${expected}`);
}

test("farm streets match the real Abandoned City dimensions and form one connected network with loops", () => {
  const world = makeWorld();
  assert.equal(FARM_WIDTH, LEVELS.level0.logicalCols * (PASSAGE_WIDTH + 1) + 1);
  assert.equal(FARM_HEIGHT, LEVELS.level0.logicalRows * (PASSAGE_WIDTH + 1) + 1);
  assert.deepEqual([world.width, world.height], [66, 66]);
  const roads = [];
  world.grid.forEach((row, y) => row.forEach((cell, x) => { if (cell === 0) roads.push([x, y]); }));
  const visited = new Set();
  const pending = [roads[0]];
  let edges = 0;
  for (let index = 0; index < pending.length; index += 1) {
    const [x, y] = pending[index];
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    let exits = 0;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (world.grid[ny]?.[nx] === 0) { pending.push([nx, ny]); exits += 1; }
    }
    assert.ok(exits >= 2, "farm roads have no dead ends");
    edges += exits;
  }
  assert.equal(visited.size, roads.length);
  assert.ok(edges / 2 > visited.size, "the connected roads contain alternate loops");
  for (let x = 0; x < world.width; x += 1) assert.equal(world.grid[0][x] + world.grid[world.height - 1][x], 2);
});

test("random spawns are walkable and safely separated, with no free starting stock", () => {
  const starts = new Set();
  for (let seed = 1; seed <= 12; seed += 1) {
    const world = makeWorld({ random: seeded(seed) });
    for (const entity of [world.player, world.farmer, ...world.cages, ...world.corn, ...world.pickups]) onRoad(world, entity);
    assert.ok(Math.hypot(world.player.x - world.farmer.x, world.player.y - world.farmer.y) >= 25);
    starts.add(`${world.player.x},${world.player.y}`);
    assert.equal(Object.values(world.inventory).reduce((a, b) => a + b, 0), 0);
  }
  assert.ok(starts.size > 1);
  // A non-random supplied test source also terminates and produces valid positions.
  const constant = makeWorld({ random: () => 0 });
  onRoad(constant, constant.farmer);
  assert.equal(constant.cages.length, 16);
});

test("the farmer travels at exactly 110% of the turkey's normal speed on a clear street", () => {
  const world = clearStreetWorld();
  const playerStart = world.player.x;
  const farmerStart = world.farmer.x;
  updateThanksgivingWorld(world, 0.1, { x: 1 });
  approx(world.player.x - playerStart, FARM_PLAYER_SPEED * 0.1);
  approx(farmerStart - world.farmer.x, FARM_FARMER_SPEED * 0.1);
  approx((farmerStart - world.farmer.x) / (world.player.x - playerStart), 1.1);
});

test("diagonal movement stays normalized and large time steps cannot tunnel through chicken wire", () => {
  const diagonal = clearStreetWorld();
  const start = { ...diagonal.player };
  updateThanksgivingWorld(diagonal, 0.1, { x: 1, y: 1 });
  approx(Math.hypot(diagonal.player.x - start.x, diagonal.player.y - start.y), FARM_PLAYER_SPEED * 0.1);
  const fence = clearStreetWorld();
  Object.assign(fence.player, { x: 4.5, y: 7.5 });
  updateThanksgivingWorld(fence, 1, { x: 1 });
  assert.ok(fence.player.x < 5 - fence.player.radius);
  onRoad(fence, fence.player);
});

test("the pursuing farmer navigates around a fenced plot and eventually catches the turkey", () => {
  const world = clearStreetWorld();
  Object.assign(world.player, { x: 12.5, y: 8.5 });
  Object.assign(world.farmer, { x: 3.5, y: 8.5 });
  let wentAround = false;
  for (let step = 0; step < 150 && !world.caught; step += 1) {
    updateThanksgivingWorld(world, 0.1);
    onRoad(world, world.farmer);
    if (world.farmer.y < 5 || world.farmer.y > 11) wentAround = true;
  }
  assert.ok(wentAround, "farmer routed around the blocked farm plot");
  assert.equal(world.caught, true);
});

test("holding rescue near a cage frees one turkey; interruption resets progress and distant cages stay locked", () => {
  const world = clearStreetWorld();
  world.cages = [
    { id: 9000, x: 4.5, y: 2.5, progress: 0 },
    { id: 9001, x: 15.5, y: 2.5, progress: 0 },
  ];
  assert.equal(getThanksgivingSnapshot(world).nearCage, true);
  advance(world, 0.3, { rescue: true });
  assert.ok(world.cages[0].progress > 0);
  updateThanksgivingWorld(world, 0.1);
  assert.equal(world.cages[0].progress, 0);
  advance(world, FARM_RESCUE_SECONDS, { rescue: true });
  assert.equal(world.rescued, 1);
  assert.equal(world.cages.length, 1);
  assert.equal(world.cages[0].id, 9001);
  assert.equal(world.cages[0].progress, 0);
  assert.equal(world.freed.length, 1);
  assert.equal(getThanksgivingSnapshot(world).nearCage, false);
});

test("corn earns one Hux each and ground powerups enter the matching inventory once", () => {
  const world = clearStreetWorld();
  world.corn = [{ id: 1, x: world.player.x, y: world.player.y }];
  world.pickups = [{ id: 2, x: world.player.x, y: world.player.y, type: "stun" }];
  updateThanksgivingWorld(world, 0.1);
  assert.equal(world.cornCollected, 1);
  assert.equal(world.inventory.stun, 1);
  assert.equal(world.corn.length, 0);
  assert.equal(world.pickups.length, 0);
  updateThanksgivingWorld(world, 0.1);
  assert.equal(world.cornCollected, 1);
  assert.equal(world.inventory.stun, 1);
});

test("cages, corn, and powers keep spawning in random valid places and respect population caps", () => {
  const world = clearStreetWorld();
  world.effects.camouflage = 1000;
  advance(world, 61);
  for (const kind of ["cages", "corn", "pickups"]) {
    assert.equal(world[kind].length, FARM_SPAWN_LIMITS[kind]);
    for (const entity of world[kind]) onRoad(world, entity);
  }
  const cageIds = new Set(world.cages.map(cage => cage.id));
  world.cages.splice(0, 2);
  advance(world, 6);
  assert.equal(world.cages.length, FARM_SPAWN_LIMITS.cages);
  assert.ok(world.cages.some(cage => !cageIds.has(cage.id)), "new cages replace freed cages indefinitely");
  assert.equal(new Set(world.pickups.map(pickup => pickup.type)).size, 5);
});

test("speed power increases travel speed and spends exactly one supplied charge", () => {
  const world = clearStreetWorld({ inventory: { speed: 2 } });
  assert.equal(activateThanksgivingPower(world, "speed"), true);
  assert.equal(world.inventory.speed, 1);
  const x = world.player.x;
  updateThanksgivingWorld(world, 0.1, { x: 1 });
  approx(world.player.x - x, FARM_PLAYER_SPEED * 1.65 * 0.1);
  assert.ok(world.effects.speed > 6);
  assert.equal(activateThanksgivingPower(world, "unknown"), false);
});

test("stun and camouflage pause the farmer, protect the turkey, and expire", () => {
  for (const id of ["stun", "camouflage"]) {
    const world = clearStreetWorld({ inventory: { [id]: 1 } });
    Object.assign(world.farmer, { x: world.player.x + 0.2, y: world.player.y });
    assert.equal(activateThanksgivingPower(world, id), true);
    const initial = { ...world.farmer };
    advance(world, 0.2);
    assert.deepEqual(world.farmer, initial);
    assert.equal(world.caught, false);
    advance(world, 6.1);
    assert.equal(world.caught, true);
    assert.equal(world.effects[id], 0);
  }
});

test("teleport relocates the turkey far from the farmer onto a clear road", () => {
  const world = clearStreetWorld({ inventory: { teleport: 1 } });
  const from = { ...world.player };
  assert.equal(activateThanksgivingPower(world, "teleport"), true);
  onRoad(world, world.player);
  assert.ok(Math.hypot(world.player.x - from.x, world.player.y - from.y) >= 14);
  assert.ok(Math.hypot(world.player.x - world.farmer.x, world.player.y - world.farmer.y) >= 22);
  assert.equal(world.inventory.teleport, 0);
  assert.equal(activateThanksgivingPower(world, "teleport"), false);
});

test("a decoy attracts the farmer away from the moving turkey and expires", () => {
  const world = clearStreetWorld({ inventory: { decoy: 1 } });
  Object.assign(world.player, { x: 10.5, y: 2.5 });
  Object.assign(world.farmer, { x: 15.5, y: 2.5 });
  assert.equal(activateThanksgivingPower(world, "decoy"), true);
  Object.assign(world.player, { x: 30.5, y: 2.5 });
  updateThanksgivingWorld(world, 0.1);
  assert.ok(world.farmer.x < 15.5, "farmer heads left toward the decoy while turkey is right");
  assert.deepEqual(world.decoy, { x: 10.5, y: 2.5 });
  advance(world, 8);
  assert.equal(world.decoy, null);
  assert.equal(world.effects.decoy, 0);
});

test("capture ends updates and power usage, while snapshots cannot mutate live supplies", () => {
  const world = clearStreetWorld({ inventory: Object.fromEntries(FARM_POWERUPS.map(power => [power.id, 1])) });
  const snapshot = getThanksgivingSnapshot(world);
  snapshot.inventory.speed = 90;
  snapshot.effects.speed = 90;
  assert.equal(world.inventory.speed, 1);
  assert.equal(world.effects.speed, 0);
  Object.assign(world.farmer, { x: world.player.x, y: world.player.y });
  updateThanksgivingWorld(world, 0.1);
  assert.equal(world.caught, true);
  const end = getThanksgivingSnapshot(world);
  updateThanksgivingWorld(world, 1, { x: 1, rescue: true });
  for (const power of FARM_POWERUPS) assert.equal(activateThanksgivingPower(world, power.id), false);
  assert.deepEqual(getThanksgivingSnapshot(world), end);
});
