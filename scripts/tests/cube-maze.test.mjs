import assert from "node:assert/strict";
import test from "node:test";
import * as cubeModule from "../../src/game/cubeMaze.js";
import { CUBE_DIMENSIONS, CUBE_STORY_HEIGHT, CUBE_STORIES, CUBE_COLUMNS, CUBE_ROWS, createCubeMaze, getCubeNode, getCubeNodeEdges, getCubeScene, getCubeOverview, getCubeCacheStats, updateCubeMaze, cubeMazeHint, activateCubeCompass, cubeMazeSaveKey, serializeCubeMaze, restoreCubeMaze, saveCubeMaze, loadCubeMaze } from "../../src/game/cubeMaze.js";

const id = (s, r, c) => `s${s}:r${r}:c${c}`;
const position = (world, node, facing = 0) => { world.player = { x: node.x, y: node.y, z: node.z, facing, pitch: 0 }; world.activeRamp = null; world.currentNode = node.id; };
const signature = (scene) => scene.edges.map((e) => `${e.id}:${e.kind}:${e.riseStories}:${[e.a.x,e.a.y,e.a.z,e.b.x,e.b.y,e.b.z].join(",")}`).sort();
const horizontalLength = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const facingBetween = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const rampsFor = (world, span) => getCubeOverview(world).ramps.filter(ramp => ramp.riseStories === span);
function walkTo(world, target, inspect = () => {}) {
  for (let frame = 0; frame < 1000; frame++) {
    const remaining = horizontalLength(world.player, target);
    if (remaining < 1e-6) return;
    world.player.facing = facingBetween(world.player, target);
    const before = { ...world.player };
    updateCubeMaze(world, Math.min(.05, remaining / (world.haste > 0 ? 12 : 8)), { forward: 1 });
    inspect(before, world.player);
    if (horizontalLength(before, world.player) < 1e-9) assert.fail(`movement blocked before ${target.id}`);
  }
  assert.fail(`did not reach ${target.id}`);
}
function graphPath(world, from, to, story) {
  const queue = [from], previous = new Map([[from, null]]);
  for (let head = 0; head < queue.length && !previous.has(to); head++) {
    for (const edge of getCubeNodeEdges(world, queue[head])) {
      const next = edge.a.id === queue[head] ? edge.b : edge.a;
      if (!next.id.startsWith("s") || next.story !== story || previous.has(next.id)) continue;
      previous.set(next.id, queue[head]); queue.push(next.id);
    }
  }
  return previous;
}

test("the Cube is one 100 × 100 × 100 volume with 25 four-unit stories and an upper far exit", () => {
  const world = createCubeMaze(51);
  assert.deepEqual(CUBE_DIMENSIONS, { length: 100, width: 100, height: 100 });
  assert.equal(CUBE_STORY_HEIGHT, 4); assert.equal(CUBE_STORIES, 25);
  assert.equal(world.player.z, 0); assert.equal(world.goal.z, 96); assert.ok(world.goal.x >= 90);
  assert.ok(getCubeCacheStats(world).cachedStories <= getCubeCacheStats(world).maxCachedStories);
  assert.equal(world.grid, undefined, "no dense million-cell grid or separately loaded floor map");
});

test("ramps connect every floor and the upper exit without a fixed one-story climbing chain", () => {
  for (const seed of [0, 7, 762, 1234]) {
    const world = createCubeMaze(seed);
    for (let story = 0; story < CUBE_STORIES; story++) {
      const connected = graphPath(world, id(story, 0, 0), "no target", story);
      assert.equal(connected.size, CUBE_COLUMNS * CUBE_ROWS, `seed ${seed}: all junctions on story ${story} connect`);
    }
    const queue = [world.start.id], seen = new Set(queue), stories = new Set();
    for (let head = 0; head < queue.length; head++) {
      const node = getCubeNode(world, queue[head]); stories.add(node.story);
      for (const edge of getCubeNodeEdges(world, node.id)) {
        assert.ok(["corridor", "ramp"].includes(edge.kind), "only walking passages connect the graph");
        const next = edge.a.id === node.id ? edge.b : edge.a;
        if (!seen.has(next.id)) { seen.add(next.id); queue.push(next.id); }
      }
    }
    assert.equal(stories.size, CUBE_STORIES); assert.ok(seen.has(world.goal.id));
    assert.equal(seen.size, world.totalNodes, "no generated junction or ramp landing is stranded");
    const oneStory = rampsFor(world, 1);
    const identicalPerimeterChain = oneStory.length >= CUBE_STORIES - 1 && oneStory.every(ramp => ramp.a.x === oneStory[0].a.x && ramp.a.y === oneStory[0].a.y && ramp.b.x === oneStory[0].b.x && ramp.b.y === oneStory[0].b.y);
    assert.equal(identicalPerimeterChain, false, "every climb does not funnel through a fixed repeated edge ramp");
    assert.ok(oneStory.some(ramp => { const x = (ramp.a.x+ramp.b.x)/2, y = (ramp.a.y+ramp.b.y)/2; return x > 15 && x < 85 && y > 15 && y < 85; }), "short connecting ramps also pass through the interior");
    assert.ok(getCubeCacheStats(world).cachedStories <= getCubeCacheStats(world).maxCachedStories);
  }
});

test("every 1–10-story rise appears repeatedly, with real distinct endpoints and no out-of-bounds slopes", () => {
  for (const seed of [7, 98, 1234]) {
    const world = createCubeMaze(seed);
    for (let span = 1; span <= 10; span++) {
      const ramps = rampsFor(world, span), ids = new Set();
      assert.ok(ramps.length >= 2, `seed ${seed}: span ${span} has repeated routes`);
      for (const ramp of ramps) {
        assert.equal(ramp.b.z - ramp.a.z, span * 4);
        const run = horizontalLength(ramp.a, ramp.b);
        assert.ok(run > 0); assert.ok((ramp.b.z-ramp.a.z) / run <= .59, "walkable grade for every ramp orientation"); assert.ok(ramp.length > run);
        for (const node of [ramp.a, ramp.b]) {
          assert.ok(node.x > 0 && node.x < 100 && node.y > 0 && node.y < 100 && node.z >= 0 && node.z < 100);
          assert.ok(getCubeNodeEdges(world, node.id).some(edge => edge.id === ramp.id), "both landings reach the same physical ramp");
        }
        ids.add(ramp.id);
      }
      assert.equal(ids.size, ramps.length, "routes have unique graph identities");
    }
  }
});

test("ramps change their launch positions across elevations and distribute climbing choices through the interior", () => {
  for (const seed of [7, 98, 1234]) {
    const world = createCubeMaze(seed), ramps = getCubeOverview(world).ramps;
    const launches = ramps.map(ramp => ramp.a);
    assert.ok(new Set(launches.map(node => `${node.x}:${node.y}`)).size >= 8, `seed ${seed}: ramps offer several distinct launch positions`);
    for (const [xSide, ySide] of [[0,0],[0,1],[1,0],[1,1]]) {
      assert.ok(launches.some(node => Number(node.x >= 50) === xSide && Number(node.y >= 50) === ySide), `seed ${seed}: ramps serve quadrant ${xSide},${ySide}`);
    }
    assert.ok(new Set(ramps.map(ramp => Math.sign(ramp.b.x-ramp.a.x) + ":" + Math.sign(ramp.b.y-ramp.a.y))).size >= 3, "ascending ramps run in varied directions");
  }
});

test("ramp positions, directions and rise schedules are seeded randomness rather than fixed routes", () => {
  const geometry = world => getCubeOverview(world).ramps.map(ramp => [ramp.a.x, ramp.a.y, ramp.a.z, ramp.b.x, ramp.b.y, ramp.b.z].join(":")).sort();
  const schedule = world => getCubeOverview(world).ramps.map(ramp => `${ramp.a.story}:${ramp.riseStories}`).sort();
  const seeds = [7, 98, 1234], geometries = [], schedules = [];
  for (const seed of seeds) {
    const world = createCubeMaze(seed), repeated = createCubeMaze(seed);
    geometries.push(JSON.stringify(geometry(world))); schedules.push(JSON.stringify(schedule(world)));
    assert.deepEqual(geometry(repeated), geometry(world), "same seed restores the same walking routes");
    assert.deepEqual(schedule(repeated), schedule(world));
  }
  assert.equal(new Set(geometries).size, seeds.length, "different runs change actual ramp placement and direction");
  assert.equal(new Set(schedules).size, seeds.length, "different runs change which elevations offer longer or shorter climbs");
});

test("every generated ramp is walkable up and down across seeds without a floor teleport", () => {
  for (const seed of [7, 123, 762]) {
    const world = createCubeMaze(seed);
    for (const { a, b } of getCubeOverview(world).ramps) {
      position(world, a, facingBetween(a, b)); const visited = world.visited;
      let intermediate = false;
      walkTo(world, b, (before, after) => {
        assert.ok(after.z >= before.z - 1e-7); assert.ok(after.z - before.z < .25, "height follows a slope, never a floor teleport");
        intermediate ||= after.z > a.z + .1 && after.z < b.z - .1;
      });
      assert.ok(intermediate); assert.ok(Math.abs(world.player.z - b.z) < 1e-6); assert.ok(horizontalLength(world.player, b) < .01);
      assert.equal(world.seed, seed); assert.equal(world.visited, visited, "one explored set persists throughout ascent");
      walkTo(world, a, (before, after) => assert.ok(after.z <= before.z + 1e-7));
      assert.ok(Math.abs(world.player.z - a.z) < 1e-6); assert.ok(horizontalLength(world.player, a) < .01);
    }
  }
});

test("floor connectors let a player walk into a ramp and turn, without an interaction teleport", () => {
  const world = createCubeMaze(37), { a, b } = rampsFor(world, 3)[0];
  const connector = getCubeNodeEdges(world, a.id).find((e) => e.kind !== "ramp");
  const room = connector.a.id === a.id ? connector.b : connector.a;
  position(world, room, Math.atan2(a.y - room.y, a.x - room.x));
  walkTo(world, a);
  world.player.facing = facingBetween(a, b);
  for (let i = 0; i < 30; i++) updateCubeMaze(world, .05, { forward: 1 });
  assert.ok(world.player.z > a.z + 1 && world.player.z < a.z + 6); assert.equal(world.activeRamp?.riseStories, 3);
});

test("walls, horizontal bounds, normalized movement, and resumed-frame limits remain solid", () => {
  const world = createCubeMaze(762);
  let node, blocked;
  for (let row = 1; row < CUBE_ROWS - 1 && !blocked; row++) for (let col = 1; col < CUBE_COLUMNS - 1 && !blocked; col++) {
    node = getCubeNode(world, id(0, row, col));
    const links = getCubeNodeEdges(world, node.id);
    blocked = [[row, col-1], [row, col+1], [row-1, col], [row+1, col]].map(([r, c]) => getCubeNode(world, id(0, r, c))).find(neighbor => !links.some(edge => edge.a.id === neighbor.id || edge.b.id === neighbor.id));
  }
  assert.ok(blocked, "the randomized maze has an actual closed corridor");
  position(world, node, Math.atan2(blocked.y - node.y, blocked.x - node.x));
  for (let i = 0; i < 100; i++) updateCubeMaze(world, .05, { forward: 1 });
  assert.ok(Math.hypot(world.player.x - node.x, world.player.y - node.y) < 2.2, "cannot walk through the uncarved edge");
  const before = world.elapsed; updateCubeMaze(world, 1000, { turn: 1, look: 1 });
  assert.ok(world.elapsed - before <= .050001); assert.ok(world.player.pitch <= .8);
  position(world, world.start, 0); const p = { ...world.player }; updateCubeMaze(world, .05, { forward: 1, strafe: 1 });
  assert.ok(Math.hypot(world.player.x - p.x, world.player.y - p.y) <= .400001);
  assert.ok(world.player.x >= 0 && world.player.x <= 100 && world.player.y >= 0 && world.player.y <= 100 && world.player.z >= 0 && world.player.z < 100);
});

test("seeded topology regenerates exactly after bounded chunks are evicted, and another seed changes passages", () => {
  const world = createCubeMaze(918), options = { center: { x: 50, y: 50, z: 40 }, radius: 90, verticalRadius: 8 };
  const original = signature(getCubeScene(world, options));
  for (let z = 0; z <= 96; z += 4) {
    const scene = getCubeScene(world, { center: { x: 50, y: 50, z }, radius: 180, verticalRadius: 30 });
    assert.ok(scene.nodes.length <= 650);
    const stats = getCubeCacheStats(world); assert.ok(stats.cachedStories <= stats.maxCachedStories); assert.ok(stats.materializedNodes <= CUBE_COLUMNS*CUBE_ROWS*stats.maxCachedStories);
  }
  assert.deepEqual(signature(getCubeScene(world, options)), original);
  assert.notDeepEqual(signature(getCubeScene(createCubeMaze(919), options)), original);
});

test("the navigable map can inspect arbitrary positions and a bounded overview covers the full volume", () => {
  const world = createCubeMaze(118);
  const local = getCubeScene(world, { center: { x: 90, y: 80, z: 96 }, radius: 50, verticalRadius: 8 });
  assert.ok(local.nodes.some((node) => node.z >= 92 && node.x >= 80));
  const overview = getCubeOverview(world);
  assert.equal(overview.sampled, true); assert.ok(overview.nodes.length <= 650);
  assert.equal(Math.min(...overview.nodes.map((node) => node.z)), 0);
  assert.equal(Math.max(...overview.nodes.map((node) => node.z)), 96);
  assert.deepEqual(overview.dimensions, CUBE_DIMENSIONS);
  assert.ok(overview.nodes.some((node) => node.id === world.goal.id));
  assert.ok(overview.ramps.some((ramp) => ramp.riseStories === 10));
  assert.deepEqual(signature(getCubeOverview(world)), signature(overview));
});

test("Compass follows actual connected corridors toward an upward ramp and has a cooldown", () => {
  const world = createCubeMaze(983);
  assert.equal(activateCubeCompass(world), true); assert.equal(activateCubeCompass(world), false);
  assert.equal(world.compass, 12); assert.equal(world.compassCooldown, 30);
  const route = cubeMazeHint(world, 200).slice(1);
  assert.ok(route.some((point) => point.z > 0));
  for (let i = 1; i < route.length; i++) assert.ok(getCubeNodeEdges(world, route[i - 1].id).some((edge) => edge.a.id === route[i].id || edge.b.id === route[i].id), "every hint segment is a real graph edge");
  assert.ok(route.at(-1).z > world.player.z);
});

test("powerups are placed on real junctions, collected once, and retain their effects when restored", () => {
  const world = createCubeMaze(19);
  const pickup = getCubeScene(world, { center: { x: 50, y: 50, z: 0 }, radius: 200, verticalRadius: 2 }).pickups[0];
  assert.ok(pickup); position(world, getCubeNode(world, pickup.id));
  updateCubeMaze(world, 0); assert.ok(world[pickup.type] > 0); assert.ok(world.collected.has(pickup.id));
  world[pickup.type] = 1; updateCubeMaze(world, .05); assert.ok(world[pickup.type] < 1, "returning to an already collected pickup cannot reset its timer");
  const restored = restoreCubeMaze(serializeCubeMaze(world)); assert.ok(restored.collected.has(pickup.id)); assert.equal(restored[pickup.type], world[pickup.type]);
});

test("a name-isolated Cube save restores mid-ramp positions and leaves all old floor saves untouched", () => {
  const data = new Map([["mist-maze-hundred-floors-v1:player:alice", "original floor save"],["mist-maze-cube-v1:player:alice","original large Cube save"]]);
  const storage = { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
  const world = createCubeMaze(327), { a, b } = rampsFor(world, 7)[0];
  position(world, a, facingBetween(a, b)); for (let i = 0; i < 50; i++) updateCubeMaze(world, .05, { forward: 1 });
  assert.equal(saveCubeMaze("Alice", world, storage), true);
  const resumed = loadCubeMaze("ALICE", storage);
  assert.deepEqual(resumed.player, world.player); assert.deepEqual([...resumed.visited].sort(), [...world.visited].sort());
  assert.equal(resumed.elapsed, world.elapsed); assert.equal(resumed.activeRamp?.riseStories, 7);
  assert.notEqual(cubeMazeSaveKey("Alice"), cubeMazeSaveKey("Bob"));
  assert.equal(data.get("mist-maze-hundred-floors-v1:player:alice"), "original floor save");
  assert.equal(data.get("mist-maze-cube-v1:player:alice"),"original large Cube save");
  assert.match(cubeMazeSaveKey("Alice"),/cube-v2:/);
  assert.ok(serializeCubeMaze(world).length < 10000, "saving contains sparse progress, never generated chunks/voxel arrays");
  assert.equal(restoreCubeMaze("not json"), null);
  const malformed = JSON.parse(serializeCubeMaze(world)); malformed.player.z = 90000;
  assert.deepEqual(restoreCubeMaze(JSON.stringify(malformed)).player, createCubeMaze(327).player);
});

test("previous v2 and v3 ramp or lift saves retain progress and migrate to a nearby safe walking surface", () => {
  for (const version of [2, 3]) for (const riding of [false, true]) {
    const previous = { version, seed: 327, player: { x: riding ? 45 : 42, y: 65, z: 61.2, facing: 1.1, pitch: .2 }, visited: ["s0:r0:c0", "s8:r4:c4", "l0:8:s12"], collected: ["s8:r4:c4"], elapsed: 2401, distance: 902, haste: 5, sonar: 2, lifts: { "lift:0:8": { z: 61.2, targetZ: 80, phase: "moving" } }, activeLift: riding ? { shaftId: "lift:0:8", span: 8, phase: "moving", targetZ: 80, targetStory: 21 } : null };
    const restored = restoreCubeMaze(JSON.stringify(previous));
    assert.ok(restored, "the update accepts previous Cube saves");
    assert.equal(restored.elapsed, 2401); assert.equal(restored.distance, 902);
    assert.ok(restored.visited.has("s8:r4:c4")); assert.ok(restored.collected.has("s8:r4:c4"));
    assert.ok(!restored.visited.has("l0:8:s12"), "removed lift stations cannot remain reachable map markers");
    assert.ok(Math.abs(restored.player.z - previous.player.z) <= CUBE_STORY_HEIGHT / 2, "a removed lift or moved ramp resumes at a nearby safe altitude");
    const serialized = serializeCubeMaze(restored), saved = JSON.parse(serialized);
    assert.equal("lifts" in saved, false); assert.equal("activeLift" in saved, false);
    assert.deepEqual(restoreCubeMaze(serialized).player, restored.player, "the migrated position rests on a real floor or ramp");
  }
});

test("only reaching the physical far upper exit completes the run, and completion stops time", () => {
  const world = createCubeMaze(19);
  world.player.x = world.goal.x; world.player.y = world.goal.y; updateCubeMaze(world, .05);
  assert.equal(world.completed, false, "same map coordinates on a lower story are not the exit");
  position(world, world.goal); updateCubeMaze(world, .05); assert.equal(world.completed, true);
  const elapsed = world.elapsed; updateCubeMaze(world, .05, { forward: 1 }); assert.equal(world.elapsed, elapsed);
  assert.equal(restoreCubeMaze(serializeCubeMaze(world)).completed, true);
});


test("Cube queries, topology, runtime and saves contain no lifts or vertical transport", () => {
  assert.equal(cubeModule.getCubeLiftInteraction, undefined); assert.equal(cubeModule.activateCubeLift, undefined);
  for (const seed of [7, 98, 1234]) {
    const world = createCubeMaze(seed), overview = getCubeOverview(world);
    assert.equal("lifts" in world, false); assert.equal("activeLift" in world, false);
    assert.equal(getCubeNode(world, "l0:8:s12"), null);
    assert.deepEqual(getCubeNodeEdges(world, "l0:8:s12"), []);
    for (const scene of [overview, getCubeScene(world, { center: { x: 50, y: 50, z: 50 }, radius: 150, verticalRadius: 32, maxNodes: 2000 })]) {
      assert.ok(!scene.lifts?.length, "no lift shafts are returned to the renderer or map");
      assert.ok(scene.nodes.every(node => node.kind !== "liftStation" && !node.shaftId));
      for (const edge of scene.edges) {
        assert.ok(["corridor", "ramp"].includes(edge.kind));
        if (edge.a.z !== edge.b.z) {
          assert.equal(edge.kind, "ramp"); assert.ok(horizontalLength(edge.a, edge.b) > 0, "height changes require walking a slope");
          assert.ok(edge.riseStories >= 1 && edge.riseStories <= 10, "no climb exceeds ten stories");
        }
      }
    }
    const saved = JSON.parse(serializeCubeMaze(world));
    assert.equal("lifts" in saved, false); assert.equal("activeLift" in saved, false);
  }
});

test("reserved ramp lanes cannot intersect an unconnected ordinary passage at walkable heights",()=>{
 for(const seed of [1,42,99]){
  const world=createCubeMaze(seed);
  for(const ramp of getCubeOverview(world).ramps){
   const center = { x: (ramp.a.x+ramp.b.x)/2, y: (ramp.a.y+ramp.b.y)/2, z: (ramp.a.z+ramp.b.z)/2 };
   const scene=getCubeScene(world,{center,radius:100,verticalRadius:32,maxNodes:2000});
   for(const floor of scene.edges.filter(edge=>edge.kind==="corridor"&&edge.a.id.startsWith("s")&&edge.b.id.startsWith("s"))){
    const ax=ramp.b.x-ramp.a.x,ay=ramp.b.y-ramp.a.y,bx=floor.b.x-floor.a.x,by=floor.b.y-floor.a.y;
    const determinant=ax*by-ay*bx;if(Math.abs(determinant)<1e-8)continue;
    const dx=floor.a.x-ramp.a.x,dy=floor.a.y-ramp.a.y,t=(dx*by-dy*bx)/determinant,u=(dx*ay-dy*ax)/determinant;
    if(t<0||t>1||u<=0||u>=1)continue;
    const z=ramp.a.z+(ramp.b.z-ramp.a.z)*t;
    assert.ok(Math.abs(z-floor.a.z)>=2.9, `seed ${seed}: ${ramp.id} cannot cut through ordinary passage ${floor.id}`);
   }
  }
 }
});


test("malformed legacy lift data cannot restore the player outside the cube", () => {
  const world = createCubeMaze(99), saved = JSON.parse(serializeCubeMaze(world));
  Object.assign(saved, { version: 3, player: { x: 45, y: 65, z: 9000, facing: 0, pitch: 0 }, lifts: { "lift:0:6": { z: 9000, targetZ: 17.3, phase: "moving" } }, activeLift: { shaftId: "lift:0:6", span: 6, phase: "moving", targetZ: 17.3 } });
  const restored = restoreCubeMaze(JSON.stringify(saved));
  assert.ok(restored); assert.equal(restored.activeLift, undefined);
  assert.ok(restored.player.z >= 0 && restored.player.z <= 96);
});
