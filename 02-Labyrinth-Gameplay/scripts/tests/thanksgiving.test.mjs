import assert from "node:assert/strict";
import test from "node:test";
import { LEVELS, PASSAGE_WIDTH } from "../../src/config/constants-enhanced.js";
import {
  FARM_WIDTH, FARM_HEIGHT, FARM_PLAYER_SPEED, FARM_FARMER_SPEED,
  FARM_RESCUE_SECONDS, FARM_POWERUPS, FARM_SPAWN_LIMITS,
  FARM_PICKUP_SPAWN_SECONDS, FARM_NEARBY_PICKUPS, FARM_NEARBY_PICKUP_DISTANCE,
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
  // Controlled collision fixture; mechanics do not depend on generated roads.
  world.grid = Array.from({ length: world.height }, (_, y) => Array.from({ length: world.width }, (_, x) =>
    x === 0 || y === 0 || x === world.width - 1 || y === world.height - 1 || (x >= 5 && x <= 10 && y >= 5 && y <= 10) ? 1 : 0));
  world.terrain = world.grid.map(row => row.map(cell => cell ? 4 : 0));
  world._roads = [];
  world.grid.forEach((row, y) => row.forEach((cell, x) => { if (cell === 0) world._roads.push({ x: x + .5, y: y + .5 }); }));
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
function walkingDistances(world) {
  const start = `${Math.floor(world.player.x)},${Math.floor(world.player.y)}`;
  const steps = new Map([[start, 0]]);
  const pending = [start.split(',').map(Number)];
  for (let head = 0; head < pending.length; head++) {
    const [x, y] = pending[head];
    const nextStep = steps.get(`${x},${y}`) + 1;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const key = `${nx},${ny}`;
      if (world.grid[ny]?.[nx] !== 0 || steps.has(key)) continue;
      steps.set(key, nextStep); pending.push([nx, ny]);
    }
  }
  return steps;
}
function nearbyPickups(world) {
  const steps = walkingDistances(world);
  return world.pickups.filter(pickup => steps.get(`${Math.floor(pickup.x)},${Math.floor(pickup.y)}`) <= FARM_NEARBY_PICKUP_DISTANCE);
}

test("farm paths match Abandoned City dimensions and form one connected mesh with loops", () => {
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
  world.pickups = [{ id: 2, x: world.player.x, y: world.player.y, type: "teleport" }];
  updateThanksgivingWorld(world, 0.1);
  assert.equal(world.cornCollected, 1);
  assert.equal(world.inventory.teleport, 1);
  assert.equal(world.corn.length, 0);
  assert.equal(world.pickups.length, 0);
  updateThanksgivingWorld(world, 0.1);
  assert.equal(world.cornCollected, 1);
  assert.equal(world.inventory.teleport, 1);
});

test("cages, corn, and powers keep spawning in random valid places and respect population caps", () => {
  const world = clearStreetWorld();
  // Isolate long-run spawning from the chase.
  world.grid[2][40] = 1;
  world.grid[2][39] = 1; world.grid[2][41] = 1;
  world.grid[1][40] = 1; world.grid[3][40] = 1;
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
  assert.equal(new Set(world.pickups.map(pickup => pickup.type)).size, FARM_POWERUPS.length);
});

test("farm starts with plentiful, reachable supplies and replenishes them beside the route at the cap", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const world = makeWorld({ random: seeded(seed) });
    assert.ok(world.pickups.length >= 45, "at least 45 ground powers replace the old eight");
    assert.ok(world.pickups.length <= FARM_SPAWN_LIMITS.pickups);
    assert.equal(new Set(world.pickups.map(pickup => pickup.type)).size, FARM_POWERUPS.length);
    assert.ok(nearbyPickups(world).length >= FARM_NEARBY_PICKUPS, `reachable supplies near start ${seed}`);
  }
  const world = clearStreetWorld();
  const distant = world._roads.filter(point => Math.hypot(point.x - world.player.x, point.y - world.player.y) > 25
    && Math.hypot(point.x - world.farmer.x, point.y - world.farmer.y) > 3).slice(0, FARM_SPAWN_LIMITS.pickups);
  world.pickups = distant.map((point, index) => ({ ...point, id: 20000 + index, type: FARM_POWERUPS[index % FARM_POWERUPS.length].id }));
  const originalTypes = new Map(world.pickups.map(pickup => [pickup.id, pickup.type]));
  assert.equal(nearbyPickups(world).length, 0);
  advance(world, FARM_PICKUP_SPAWN_SECONDS + .01);
  assert.equal(world.pickups.length, FARM_SPAWN_LIMITS.pickups, "relocation never exceeds the cap");
  assert.ok(nearbyPickups(world).length >= FARM_NEARBY_PICKUPS);
  for (const pickup of world.pickups) {
    onRoad(world, pickup);
    assert.equal(pickup.type, originalTypes.get(pickup.id), "moving a distant supply retains its type and identity");
  }
});

test("free powerups refill every second and never omit a power with an unlucky random source", () => {
  const world = clearStreetWorld({ random: () => 0 });
  advance(world, 1.01);
  assert.ok(world.pickups.length >= FARM_NEARBY_PICKUPS);
  advance(world, 2.01);
  assert.equal(new Set(world.pickups.map(pickup => pickup.type)).size, FARM_POWERUPS.length);
});

test("nearby supplies behind a long fence move onto a reachable route even when the farm is at its cap", () => {
  const world = clearStreetWorld();
  world.grid = Array.from({ length: world.height }, (_, y) => Array.from({ length: world.width }, (_, x) =>
    x === 0 || y === 0 || x === world.width - 1 || y === world.height - 1 || (x === 33 && y <= 55) ? 1 : 0));
  world.terrain = world.grid.map(row => row.map(cell => cell ? 4 : 0));
  world._roads = [];
  world.grid.forEach((row, y) => row.forEach((cell, x) => { if (cell === 0) world._roads.push({ x: x + .5, y: y + .5 }); }));
  Object.assign(world.player, { x: 35.5, y: 10.5 });
  Object.assign(world.farmer, { x: 55.5, y: 40.5 });
  const acrossFence = world._roads.filter(point => point.x < 33
    && Math.hypot(point.x - world.player.x, point.y - world.player.y) <= FARM_NEARBY_PICKUP_DISTANCE).slice(0, FARM_SPAWN_LIMITS.pickups);
  world.pickups = acrossFence.map((point, index) => ({ ...point, id: 30000 + index, type: FARM_POWERUPS[index % FARM_POWERUPS.length].id }));
  const originalTypes = new Map(world.pickups.map(pickup => [pickup.id, pickup.type]));
  assert.equal(walkingDistances(world).size, world._roads.length, "both sides still connect around the end of the fence");
  assert.equal(world.pickups.length, FARM_SPAWN_LIMITS.pickups);
  assert.equal(nearbyPickups(world).length, 0);
  advance(world, FARM_PICKUP_SPAWN_SECONDS + .01);
  assert.ok(nearbyPickups(world).length >= FARM_NEARBY_PICKUPS, "walking distance, rather than visual distance, controls access");
  assert.equal(world.pickups.length, FARM_SPAWN_LIMITS.pickups);
  for (const pickup of world.pickups) assert.equal(pickup.type, originalTypes.get(pickup.id));
});

test("speed power increases travel speed and spends exactly one supplied charge", () => {
  const world = clearStreetWorld({ inventory: { speed: 2 } });
  assert.equal(activateThanksgivingPower(world, "speed"), true);
  assert.equal(world.inventory.speed, 1);
  const x = world.player.x;
  updateThanksgivingWorld(world, 0.1, { x: 1 });
  approx(world.player.x - x, FARM_PLAYER_SPEED * 2 * 0.1);
  assert.ok(world.effects.speed > 11.8);
  assert.equal(activateThanksgivingPower(world, "unknown"), false);
});

test("teleport relocates the turkey far from the farmer onto a clear road", () => {
  const world = clearStreetWorld({ inventory: { teleport: 1 } });
  const from = { ...world.player };
  assert.equal(activateThanksgivingPower(world, "teleport"), true);
  onRoad(world, world.player);
  assert.ok(Math.hypot(world.player.x - from.x, world.player.y - from.y) >= 20);
  assert.ok(Math.hypot(world.player.x - world.farmer.x, world.player.y - world.farmer.y) >= 28);
  assert.equal(world.effects.speed, 4);
  assert.ok(nearbyPickups(world).length >= FARM_NEARBY_PICKUPS, "a hop also lands near reachable supplies");
  assert.equal(world.inventory.teleport, 0);
  assert.equal(activateThanksgivingPower(world, "teleport"), false);
});

test("Mud Trap slows only after the farmer crosses it and then expires", () => {
  const world = clearStreetWorld({ inventory: { stun: 1 } });
  assert.equal(activateThanksgivingPower(world, "stun"), true);
  assert.equal(world.effects.mudSlow, 0);
  assert.equal(world.traps.length, 1);
  Object.assign(world.player, { x: 20.5, y: 2.5 });
  Object.assign(world.farmer, { x: 3.5, y: 2.5 });
  const start = world.farmer.x;
  updateThanksgivingWorld(world, .1);
  approx(world.farmer.x - start, FARM_FARMER_SPEED * .2 * .1);
  assert.ok(world.effects.mudSlow > 9.8);
  updateThanksgivingWorld(world, .1); assert.equal(world.traps.length, 0);
  advance(world, 10); assert.equal(world.effects.mudSlow, 0);
  const expired = clearStreetWorld({ inventory: { stun: 1 } });
  activateThanksgivingPower(expired, "stun");
  Object.assign(expired.player, { x: 3.5, y: 40.5 });
  for (const [x, y] of [[39,2], [41,2], [40,1], [40,3]]) expired.grid[y][x] = 1;
  advance(expired, 24); assert.equal(expired.traps.length, 1);
  advance(expired, 1.1); assert.equal(expired.traps.length, 0);
});

test("Feather Gust needs a nearby clear path, pushes safely, and keeps unusable charges", () => {
  const world = clearStreetWorld({ inventory: { decoy: 2 } });
  assert.equal(activateThanksgivingPower(world, "decoy"), false);
  assert.equal(world.inventory.decoy, 2);
  Object.assign(world.farmer, { x: 5.5, y: 2.5 });
  world.grid[2][9] = 1;
  assert.equal(activateThanksgivingPower(world, "decoy"), true);
  assert.ok(world.farmer.x > 8 && world.farmer.x < 8.7);
  onRoad(world, world.farmer);
  assert.equal(world.effects.farmerStagger, 2.5);
  const staggeredPosition = { x: world.farmer.x, y: world.farmer.y };
  advance(world, 2);
  assert.deepEqual({ x: world.farmer.x, y: world.farmer.y }, staggeredPosition);
  assert.equal(world.inventory.decoy, 1);
  world.grid[2][6] = 1;
  assert.equal(activateThanksgivingPower(world, "decoy"), false);
  assert.equal(world.inventory.decoy, 1);
});

test("Feather Gust reaches 14 clear tiles, pushes ten, and still staggers against a wall", () => {
  const world = clearStreetWorld({ inventory: { decoy: 2 } });
  Object.assign(world.farmer, { x: 16.5, y: 2.5 });
  assert.equal(activateThanksgivingPower(world, "decoy"), true);
  approx(world.farmer.x, 26.5);
  assert.equal(world.effects.farmerStagger, 2.5);
  Object.assign(world.farmer, { x: 5.5, y: 2.5 });
  world.grid[2][6] = 1;
  assert.equal(activateThanksgivingPower(world, "decoy"), true);
  assert.ok(world.farmer.x < 5.7, "the push respects the wall behind the farmer");
  assert.equal(world.effects.farmerStagger, 2.5, "a blocked push still buys escape time");
});

test("Fence Slip crosses wire, respects solid props and outer bounds, and expires onto open ground", () => {
  const world = clearStreetWorld({ inventory: { camouflage: 1 } });
  world.grid[2][4] = 1; world.terrain[2][4] = 4;
  updateThanksgivingWorld(world, .3, { x: 1 }); assert.ok(world.player.x < 3.71);
  assert.equal(activateThanksgivingPower(world, "camouflage"), true);
  assert.equal(world.effects.fenceSlip, 12);
  updateThanksgivingWorld(world, .2, { x: 1 }); assert.ok(world.player.x > 4);
  world.effects.fenceSlip = .01;
  updateThanksgivingWorld(world, .1); onRoad(world, world.player);
  world.effects.fenceSlip = 5;
  Object.assign(world.player, { x: 3.5, y: 2.5 }); world.terrain[2][4] = "barn";
  updateThanksgivingWorld(world, .3, { x: 1 }); assert.ok(world.player.x < 3.71);
  Object.assign(world.player, { x: 1.5, y: 2.5 });
  updateThanksgivingWorld(world, .5, { x: -1 }); assert.ok(world.player.x >= 1.3);
  // Passing through fences does not hide you from a farmer on the same road.
  Object.assign(world.farmer, { x: world.player.x, y: world.player.y });
  updateThanksgivingWorld(world, .1); assert.equal(world.caught, true);
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


test("busy randomized layouts stay connected with solid props and irregular paths across seeds", () => {
  const layouts = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const world = makeWorld({ random: seeded(seed) });
    layouts.add(JSON.stringify(world.grid));
    const start = world._roads[0];
    const pending = [[Math.floor(start.x), Math.floor(start.y)]];
    const seen = new Set([pending[0].join(',')]);
    for (let i = 0; i < pending.length; i++) {
      const [x, y] = pending[i];
      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        const key = `${nx},${ny}`;
        if (world.grid[ny]?.[nx] === 0 && !seen.has(key)) { seen.add(key); pending.push([nx, ny]); }
      }
    }
    assert.equal(seen.size, world._roads.length, 'no blocked-off rescue pockets');
    assert.ok(seen.size > 1500 && seen.size < 3000, 'a busy layout balances clutter and traversable ground');
    assert.ok(world.farmProps.length >= 60);
    assert.equal(new Set(world.farmProps.map(prop => prop.type)).size, 5);
    for (const prop of world.farmProps) {
      for (let y = prop.y; y < prop.y + prop.height; y++) for (let x = prop.x; x < prop.x + prop.width; x++) {
        assert.equal(world.grid[y][x], 1, 'props really block movement');
        assert.ok(world.obstacleTiles.has(y * world.width + x));
      }
    }
    const straightRows = world.grid.filter(row => row.slice(1, -1).every(cell => cell === 0));
    assert.ok(straightRows.length <= 4, 'no repeated full-width street grid');
  }
  assert.equal(layouts.size, 20, 'each seed produces a different arrangement');
});

test("the farmer finds the turkey through generated clutter without crossing solid tiles", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const world = makeWorld({ random: seeded(seed) });
    for (let step = 0; step < 1400 && !world.caught; step++) {
      updateThanksgivingWorld(world, .1);
      onRoad(world, world.farmer);
    }
    assert.equal(world.caught, true, `farmer must navigate generated layout ${seed}`);
  }
});
