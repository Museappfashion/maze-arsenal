import assert from "node:assert/strict";
import test from "node:test";
import { activateHundredFloorCompass, ascendHundredFloor, createHundredFloor, createHundredFloorRun, floorIndex, HUNDRED_FLOOR_COUNT, HUNDRED_FLOOR_SIZE, hundredFloorHintRoute, hundredFloorSaveKey, isHundredFloorOpen, loadHundredFloorRun, nearHundredFloorStairs, restoreHundredFloorRun, saveHundredFloorRun, serializeHundredFloorRun, updateHundredFloorRun } from "../../src/game/hundredFloorMaze.js";

test("all 100 stories are distinct 100×100 connected mazes with reachable stairs", () => {
  let previous = "";
  for (let floor = 1; floor <= HUNDRED_FLOOR_COUNT; floor++) {
    const world = createHundredFloor(0xCADE2026, floor);
    assert.equal(world.width, HUNDRED_FLOOR_SIZE);
    assert.equal(world.height, HUNDRED_FLOOR_SIZE);
    assert.equal(world.grid.length, 10000);
    assert.equal(world.floor, floor);
    let walkable = 0;
    for (let index = 0; index < world.grid.length; index++) {
      const x = index % 100;
      const y = Math.floor(index / 100);
      if (x === 0 || y === 0 || x === 99 || y === 99) assert.equal(world.grid[index], 1, "outside boundary stays solid");
      if (world.grid[index] === 0) {
        walkable++;
        assert.ok(world.route[index] >= 0, `floor ${floor} tile ${index} can reach the stairs`);
      }
    }
    assert.ok(walkable > 4800);
    assert.equal(world.route[floorIndex(Math.floor(world.stairs.x), Math.floor(world.stairs.y))], 0);
    assert.ok(world.route[floorIndex(1, 1)] > 60, "staircase is far enough to make a real floor");
    const signature = Buffer.from(world.grid).toString("base64");
    assert.notEqual(signature, previous);
    previous = signature;
    assert.equal(new Set(world.pickups.map((pickup) => pickup.index)).size, world.pickups.length);
    for (const pickup of world.pickups) assert.equal(world.grid[pickup.index], 0);
  }
});

test("same run seed reproduces each floor and a new seed changes it", () => {
  assert.deepEqual(createHundredFloor(18, 63).grid, createHundredFloor(18, 63).grid);
  assert.notDeepEqual(createHundredFloor(18, 63).grid, createHundredFloor(19, 63).grid);
});

test("stairs require proximity, advance one floor at a time, and complete only floor 100", () => {
  const world = createHundredFloorRun(120);
  assert.equal(ascendHundredFloor(world), false);
  const firstGrid = world.grid;
  for (let floor = 1; floor <= 100; floor++) {
    assert.equal(world.floor, floor);
    assert.equal(world.completed, false);
    world.player = { ...world.stairs };
    assert.equal(nearHundredFloorStairs(world), true);
    assert.equal(ascendHundredFloor(world), true);
    if (floor < 100) {
      assert.equal(world.floor, floor + 1);
      assert.deepEqual(world.player, world.start);
      assert.equal(world.collected.size, 0);
    }
  }
  assert.equal(world.floor, 100);
  assert.equal(world.completed, true);
  assert.equal(ascendHundredFloor(world), false);
  assert.notEqual(world.grid, firstGrid, "current floor replaces the previous grid");
  assert.equal(Object.values(world).filter((value) => value instanceof Uint8Array).length, 2, "only current grid and discovery mask are allocated");
});

test("movement is normalized, solid boundaries hold, and floor exploration follows the player", () => {
  const world = createHundredFloorRun(440);
  const x = world.player.x;
  for (let frame = 0; frame < 100; frame++) updateHundredFloorRun(world, .05, { x: -1, y: -1 });
  assert.ok(world.player.x >= 1.2 && world.player.x <= x);
  assert.ok(world.player.y >= 1.2 && world.player.y <= 1.5);
  assert.ok(isHundredFloorOpen(world, world.player.x, world.player.y));
  assert.ok(world.explored[floorIndex(1, 1)]);
  assert.ok(Math.abs(world.elapsed - 5) < .00001);
  const elapsed = world.elapsed;
  world.completed = true;
  updateHundredFloorRun(world, .05, { x: 1 });
  assert.equal(world.elapsed, elapsed);
});

test("pickups are collected once and compass follows a connected route with a cooldown", () => {
  const world = createHundredFloorRun(23);
  const haste = world.pickups.find((pickup) => pickup.type === "haste");
  const sonar = world.pickups.find((pickup) => pickup.type === "sonar");
  world.player = { x: haste.x, y: haste.y };
  updateHundredFloorRun(world, 0);
  assert.equal(world.haste, 14);
  assert.equal(world.collected.has(haste.index), true);
  updateHundredFloorRun(world, .05);
  assert.equal(world.haste, 13.95);
  world.player = { x: sonar.x, y: sonar.y };
  updateHundredFloorRun(world, 0);
  assert.equal(world.sonar, 18);
  assert.equal(activateHundredFloorCompass(world), true);
  assert.equal(activateHundredFloorCompass(world), false);
  const route = hundredFloorHintRoute(world, 10000);
  assert.equal(world.route[route.at(-1)], 0);
  for (let index = 1; index < route.length; index++) {
    assert.equal(world.route[route[index]], world.route[route[index - 1]] - 1);
    const dx = Math.abs(route[index] % 100 - route[index - 1] % 100);
    const dy = Math.abs(Math.floor(route[index] / 100) - Math.floor(route[index - 1] / 100));
    assert.equal(dx + dy, 1);
  }
  for (let frame = 0; frame < 601; frame++) updateHundredFloorRun(world, .05);
  assert.equal(activateHundredFloorCompass(world), true);
});

test("save and resume restores floor, position, explored tiles, pickups, timers, and complete runs", () => {
  const world = createHundredFloorRun(2026);
  for (let count = 0; count < 6; count++) { world.player = { ...world.stairs }; ascendHundredFloor(world); }
  const pickup = world.pickups[0];
  world.player = { x: pickup.x, y: pickup.y };
  updateHundredFloorRun(world, .05);
  activateHundredFloorCompass(world);
  world.elapsed = 1234;
  const restored = restoreHundredFloorRun(serializeHundredFloorRun(world));
  assert.equal(restored.floor, 7);
  assert.equal(restored.seed, 2026);
  assert.deepEqual(restored.grid, world.grid);
  assert.deepEqual(restored.player, world.player);
  assert.deepEqual(restored.explored, world.explored);
  assert.deepEqual(restored.collected, world.collected);
  assert.equal(restored.elapsed, 1234);
  assert.equal(restored.sonar, 18);
  assert.equal(restored.compassCooldown, 30);
  Object.assign(world, createHundredFloor(world.seed, 100));
  world.player = { ...world.stairs };
  ascendHundredFloor(world);
  assert.equal(restoreHundredFloorRun(serializeHundredFloorRun(world)).completed, true);
});

test("storage is isolated by normalized player name, and malformed saves fail safely", () => {
  const contents = new Map();
  const storage = { getItem: (key) => contents.get(key) ?? null, setItem: (key, value) => contents.set(key, value) };
  const world = createHundredFloorRun(555);
  world.player = { ...world.stairs };
  ascendHundredFloor(world);
  assert.equal(saveHundredFloorRun("  Captain   Turkey  ", world, storage), true);
  assert.equal(loadHundredFloorRun("captain turkey", storage).floor, 2);
  assert.equal(loadHundredFloorRun("Alien", storage).floor, 1);
  assert.equal(hundredFloorSaveKey("Captain Turkey"), hundredFloorSaveKey("captain turkey"));
  assert.notEqual(hundredFloorSaveKey(""), hundredFloorSaveKey("You"));
  assert.notEqual(hundredFloorSaveKey(""), hundredFloorSaveKey("(anonymous)"));
  assert.equal(restoreHundredFloorRun("bad json"), null);
  assert.equal(restoreHundredFloorRun('{"version":1,"seed":12,"floor":101}'), null);
  const broken = JSON.parse(serializeHundredFloorRun(world));
  broken.player = { x: -12, y: Infinity };
  broken.completed = true;
  broken.collected = [-1, "oops", 999999];
  const repaired = restoreHundredFloorRun(JSON.stringify(broken));
  assert.deepEqual(repaired.player, repaired.start);
  assert.equal(repaired.completed, false);
  assert.equal(repaired.collected.size, 0);
  assert.equal(saveHundredFloorRun("You", world, { setItem() { throw Error("storage full"); } }), false);
});

test("denied browser storage getters do not prevent playing a new climb", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw Error("storage denied"); } });
  try {
    const world = loadHundredFloorRun("No storage");
    assert.equal(world.floor, 1);
    assert.equal(saveHundredFloorRun("No storage", world), false);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});
