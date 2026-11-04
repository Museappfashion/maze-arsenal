import assert from "node:assert/strict";
import test from "node:test";
import { CUBE_DIMENSIONS, CUBE_STORY_HEIGHT, CUBE_STORIES, CUBE_COLUMNS, CUBE_ROWS, createCubeMaze, getCubeNode, getCubeNodeEdges, getCubeScene, getCubeOverview, getCubeCacheStats, updateCubeMaze, cubeMazeHint, activateCubeCompass, cubeMazeSaveKey, serializeCubeMaze, restoreCubeMaze, saveCubeMaze, loadCubeMaze, getCubeLiftInteraction, activateCubeLift } from "../../src/game/cubeMaze.js";

const id = (s, r, c) => `s${s}:r${r}:c${c}`;
const position = (world, node, facing = 0) => { world.player = { x: node.x, y: node.y, z: node.z, facing, pitch: 0 }; world.activeRamp = null; world.currentNode = node.id; };
const signature = (scene) => scene.edges.map((e) => `${e.id}:${e.kind}:${e.riseStories}`).sort();
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
  assert.equal(getCubeCacheStats(world).cachedStories, 1);
  assert.equal(world.grid, undefined, "no dense million-cell grid or separately loaded floor map");
});

test("all story junctions connect, and repeated one-story ramps join every height into the same graph", () => {
  const world = createCubeMaze(762);
  for (let story = 0; story < CUBE_STORIES; story++) {
    const connected = graphPath(world, id(story, 0, 0), "no target", story);
    assert.equal(connected.size, CUBE_COLUMNS * CUBE_ROWS, `all junctions on story ${story} connect`);
    if (story < CUBE_STORIES - 1) {
      const a = getCubeNode(world, `r${story}:1:a`), b = getCubeNode(world, `r${story}:1:b`);
      const ab = getCubeNodeEdges(world, a.id).find((e) => e.kind === "ramp");
      assert.equal(ab.b.id, b.id);
      assert.ok(getCubeNodeEdges(world, b.id).some((e) => e.id === ab.id), "ramps are bidirectional edges");
    }
  }
  assert.ok(getCubeCacheStats(world).cachedStories <= getCubeCacheStats(world).maxCachedStories);
});

test("every 1–10-story rise appears repeatedly, with real distinct endpoints and no out-of-bounds slopes", () => {
  const world = createCubeMaze(98);
  for (let span = 1; span <= 10; span++) {
    const ids = new Set();
    for (const story of [0, 4, 8, 12]) {
      const node = getCubeNode(world, `r${story}:${span}:a`);
      const ramp = getCubeNodeEdges(world, node.id).find((e) => e.kind === "ramp");
      assert.equal(ramp.riseStories, span); assert.equal(ramp.b.z - ramp.a.z, span * 4);
      assert.ok(ramp.b.x-ramp.a.x>=30&&ramp.b.x-ramp.a.x<=70); assert.ok(ramp.length > ramp.b.x-ramp.a.x);
      for (const p of [ramp.a, ramp.b]) { assert.ok(p.x >= 0 && p.x <= 100 && p.y > 0 && p.y < 100 && p.z >= 0 && p.z < 100); }
      ids.add(ramp.id);
    }
    assert.equal(ids.size, 4, `span ${span} has multiple repeated ramps`);
  }
});

test("walking ascends and descends ramps gradually without loading a new floor or changing the seed", () => {
  for (const [story, span] of [[0, 1], [5, 4], [12, 10]]) {
    const world = createCubeMaze(123), a = getCubeNode(world, `r${story}:${span}:a`), b = getCubeNode(world, `r${story}:${span}:b`);
    position(world, a, 0); const visited = world.visited;
    let previous = world.player.z, intermediate = false;
    for (let i = 0; i < Math.round((b.x-a.x)/.4); i++) {
      updateCubeMaze(world, .05, { forward: 1 });
      assert.ok(world.player.z >= previous - 1e-7); assert.ok(world.player.z - previous < .25, "height follows a slope, never a floor teleport");
      intermediate ||= world.player.z > a.z + .1 && world.player.z < b.z - .1; previous = world.player.z;
    }
    assert.ok(intermediate); assert.ok(Math.abs(world.player.z - b.z) < 1e-6); assert.ok(Math.abs(world.player.x - b.x) < .01);
    assert.equal(world.seed, 123); assert.equal(world.visited, visited, "one explored set persists throughout ascent");
    world.player.facing = Math.PI;
    for (let i = 0; i < Math.round((b.x-a.x)/.4); i++) updateCubeMaze(world, .05, { forward: 1 });
    assert.ok(Math.abs(world.player.z - a.z) < 1e-6); assert.ok(Math.abs(world.player.x - a.x) < .01);
  }
});

test("floor connectors let a player walk into a ramp and turn, without an interaction teleport", () => {
  const world = createCubeMaze(37), a = getCubeNode(world, "r0:3:a");
  const connector = getCubeNodeEdges(world, a.id).find((e) => e.kind !== "ramp");
  const room = connector.a.id === a.id ? connector.b : connector.a;
  position(world, room, Math.atan2(a.y - room.y, a.x - room.x));
  for (let i = 0; i < 12; i++) updateCubeMaze(world, .05, { forward: 1 });
  world.player.facing = 0;
  for (let i = 0; i < 30; i++) updateCubeMaze(world, .05, { forward: 1 });
  assert.ok(world.player.z > 1 && world.player.z < 6); assert.equal(world.activeRamp?.riseStories, 3);
});

test("walls, horizontal bounds, normalized movement, and resumed-frame limits remain solid", () => {
  const world = createCubeMaze(762), node = getCubeNode(world, id(0, 4, 4));
  const links = getCubeNodeEdges(world, node.id);
  const blocked = [[4, 3], [4, 5], [3, 4], [5, 4]].map(([r, c]) => getCubeNode(world, id(0, r, c))).find((n) => !links.some((e) => e.a.id === n.id || e.b.id === n.id));
  assert.ok(blocked, "fixture has an actual closed corridor");
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
  const world = createCubeMaze(327), a = getCubeNode(world, "r12:7:a");
  position(world, a); for (let i = 0; i < 130; i++) updateCubeMaze(world, .05, { forward: 1 });
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

test("only reaching the physical far upper exit completes the run, and completion stops time", () => {
  const world = createCubeMaze(19);
  world.player.x = world.goal.x; world.player.y = world.goal.y; updateCubeMaze(world, .05);
  assert.equal(world.completed, false, "same map coordinates on a lower story are not the exit");
  position(world, world.goal); updateCubeMaze(world, .05); assert.equal(world.completed, true);
  const elapsed = world.elapsed; updateCubeMaze(world, .05, { forward: 1 }); assert.equal(world.elapsed, elapsed);
  assert.equal(restoreCubeMaze(serializeCubeMaze(world)).completed, true);
});


test("both sides contain repeated lifters for every 1–10-story span, with bounded bidirectional stations",()=>{
 const world=createCubeMaze(1234);
 for(let span=1;span<=10;span++)for(const side of [0,1])for(const story of [0,4,8,12]){
  const node=getCubeNode(world,`l${side}:${span}:s${story}`);
  const edge=getCubeNodeEdges(world,node.id).find(e=>e.kind==="lift"&&e.a.story===story);
  assert.ok(edge);assert.equal(edge.riseStories,span);assert.equal(edge.b.z-edge.a.z,span*4);
  assert.ok(getCubeNodeEdges(world,edge.b.id).some(e=>e.id===edge.id));
  for(const p of [edge.a,edge.b])assert.ok(p.x>0&&p.x<100&&p.y>0&&p.y<100&&p.z>=0&&p.z<100);
 }
 const queue=[world.start.id],seen=new Set(queue);
 for(let i=0;i<queue.length;i++)for(const edge of getCubeNodeEdges(world,queue[i])){
  const next=edge.a.id===queue[i]?edge.b.id:edge.a.id;
  if(!seen.has(next)){seen.add(next);queue.push(next);}
 }
 assert.equal(seen.size,world.totalNodes);assert.ok(seen.has(world.goal.id));
});

test("all lift spans carry the player gradually up and down on a real platform without changing the seed",()=>{
 for(let span=1;span<=10;span++){
  const world=createCubeMaze(28),station=getCubeNode(world,`l0:${span}:s0`);position(world,station);
  assert.equal(getCubeLiftInteraction(world).span,span);assert.equal(activateCubeLift(world,1),true);
  let previous=world.player.z,intermediate=false;
  for(let frame=0;frame<Math.ceil((span*4/5+1)/.05);frame++){
   updateCubeMaze(world,.05,{forward:1});
   assert.ok(world.player.z>=previous-1e-8&&world.player.z-previous<=.250001);
   intermediate ||= world.player.z>.1&&world.player.z<span*4-.1;previous=world.player.z;
  }
  assert.ok(intermediate);assert.equal(world.player.z,span*4);assert.equal(world.activeLift,null);assert.equal(world.seed,28);
  assert.equal(activateCubeLift(world,-1),true);
  for(let frame=0;frame<Math.ceil((span*4/5+1)/.05);frame++)updateCubeMaze(world,.05);
  assert.equal(world.player.z,0);assert.equal(world.activeLift,null);
 }
});

test("an absent platform leaves a solid closed gate, then the called platform arrives before boarding",()=>{
 const world=createCubeMaze(29),station=getCubeNode(world,"l0:10:s0");
 const scene=getCubeScene(world,{center:station}),lift=scene.lifts.find(l=>l.id===station.shaftId);
 world.lifts[lift.id]={z:40,targetZ:40,phase:"idle"};
 position(world,{...station,x:station.x+lift.ux*3,y:station.y+lift.uy*3},Math.atan2(-lift.uy,-lift.ux));
 for(let i=0;i<30;i++)updateCubeMaze(world,.05,{forward:1});
 assert.ok(Math.hypot(world.player.x-station.x,world.player.y-station.y)>=1.3,"closed gate prevents walking into an empty shaft");
 assert.equal(world.player.z,0);const before={...world.player};
 assert.equal(getCubeLiftInteraction(world).ready,false);assert.equal(activateCubeLift(world),true);
 updateCubeMaze(world,.05);assert.ok(world.lifts[lift.id].z<40&&world.lifts[lift.id].z>0,"empty cabin visibly travels to the station");
 assert.deepEqual(world.player,before,"calling never teleports the player");
 for(let i=0;i<125;i++)updateCubeMaze(world,.05);
 assert.equal(getCubeLiftInteraction(world).ready,true);assert.equal(world.lifts[lift.id].z,0);
 assert.equal(activateCubeLift(world),true);updateCubeMaze(world,.05);
 assert.ok(world.activeLift);assert.ok(Math.hypot(world.player.x-station.x,world.player.y-station.y)<Math.hypot(before.x-station.x,before.y-station.y),"boarding moves smoothly through the open doorway");
});

test("mid-ride and mid-boarding saves resume exact platform positions and finish the same ride",()=>{
 for(const frames of [4,30]){
  const world=createCubeMaze(99),station=getCubeNode(world,"l1:8:s0"),lift=getCubeScene(world,{center:station}).lifts.find(l=>l.id===station.shaftId);
  position(world,{...station,x:station.x+lift.ux*2.5,y:station.y+lift.uy*2.5});activateCubeLift(world);
  for(let i=0;i<frames;i++)updateCubeMaze(world,.05);
  const restored=restoreCubeMaze(serializeCubeMaze(world));assert.ok(restored.activeLift);
  assert.deepEqual(restored.player,world.player);assert.equal(restored.activeLift.phase,world.activeLift.phase);
  for(let i=0;i<180;i++)updateCubeMaze(restored,.05);
  assert.equal(restored.player.z,32);assert.equal(restored.activeLift,null);
 }
});


test("reserved ramp lanes cannot intersect an unconnected ordinary passage at their endpoints or middles",()=>{
 for(const seed of [1,42,99]){
  const world=createCubeMaze(seed),scene=getCubeScene(world,{center:{x:50,y:50,z:0},radius:100,verticalRadius:2,maxNodes:2000});
  const slopes=scene.ramps.filter(edge=>edge.a.story===0);
  for(const floor of scene.edges.filter(edge=>edge.kind==="corridor"&&edge.a.id.startsWith("s")&&edge.b.id.startsWith("s")&&edge.a.story===0&&edge.a.x===edge.b.x))for(const ramp of slopes){
   const crossesY=ramp.a.y>Math.min(floor.a.y,floor.b.y)&&ramp.a.y<Math.max(floor.a.y,floor.b.y);
   const crossesX=floor.a.x>=ramp.a.x&&floor.a.x<=ramp.b.x;
   assert.equal(crossesY&&crossesX,false,"a closed ramp room cannot visually block an invisible crossing corridor");
  }
 }
});


test("malformed lift saves cannot restore a rider outside the cube or at an invalid destination",()=>{
 const world=createCubeMaze(99),station=getCubeNode(world,"l0:6:s0");position(world,station);activateCubeLift(world);for(let i=0;i<30;i++)updateCubeMaze(world,.05);
 for(const mutate of [saved=>{saved.player.z=9000;},saved=>{saved.activeLift.targetZ=17.3;}]){
  const saved=JSON.parse(serializeCubeMaze(world));mutate(saved);const restored=restoreCubeMaze(JSON.stringify(saved));
  assert.ok(restored);assert.equal(restored.activeLift,null);assert.ok(restored.player.z>=0&&restored.player.z<=96);
 }
});
