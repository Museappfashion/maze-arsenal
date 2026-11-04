import { sanitizePlayerName } from "../utils/player.js";

// One continuous volume. A story is four world units; it is not a separately
// loaded map. The compact 100-unit volume is generated as connected passage graphs.
export const CUBE_DIMENSIONS = Object.freeze({ length: 100, width: 100, height: 100 });
export const CUBE_STORY_HEIGHT = 4;
export const CUBE_STORIES = 25;
export const CUBE_CORRIDOR_WIDTH = 3;
export const CUBE_COLUMNS = 9;
export const CUBE_ROWS = 9;
export const CUBE_MAX_CACHED_STORIES = 16;
const ROOM_RADIUS = 2.1;
const SAVE_VERSION = 2;
const runtimes = new WeakMap();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const square = (n) => n * n;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const regularId = (s, r, c) => `s${s}:r${r}:c${c}`;
const rampNodeId = (s, span, end) => `r${s}:${span}:${end}`;
function randomSource(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let n = Math.imul(value ^ (value >>> 15), 1 | value);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (seed, a, b = 0) => {
  let n = (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca6b)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
};
function runtime(world) {
  let state = runtimes.get(world);
  if (!state) { state = { stories: new Map(), generationCount: 0 }; runtimes.set(world, state); }
  return state;
}
function regularNode(story, row, col) {
  return { id: regularId(story, row, col), x: 10 + col * 10, y: 10 + row * 10, z: story * CUBE_STORY_HEIGHT, story, radius: ROOM_RADIUS };
}
function rampLayout(seed, span) {
  // Each span owns a lane between the ordinary passage rows. Long slopes
  // remain below 0.58 rise/run, with their endpoints inside the 100-unit cube.
  const run = span <= 3 ? 3 : span <= 6 ? 5 : 7;
  const col = hash(seed, span, 47) % (CUBE_COLUMNS - run);
  return { col, run, row: Math.min(8, span - 1), y: 5 + (span - 1) * 10 };
}
function rampNodes(world, story, span) {
  if (story < 0 || story + span >= CUBE_STORIES || span < 1 || span > 10) return null;
  const layout = rampLayout(world.seed, span);
  const a = { id: rampNodeId(story, span, "a"), x: 10 + layout.col * 10, y: layout.y, z: story * 4, story, radius: ROOM_RADIUS };
  const b = { id: rampNodeId(story, span, "b"), x: a.x + layout.run * 10, y: layout.y, z: (story + span) * 4, story: story + span, radius: ROOM_RADIUS };
  return { a, b, entry: regularNode(story, layout.row, layout.col), exit: regularNode(story + span, layout.row, layout.col + layout.run), span };
}
const liftId = (side, span) => `lift:${side}:${span}`;
const liftNodeId = (side, span, story) => `l${side}:${span}:s${story}`;
function liftDefinition(side, span) {
  const row = Math.min(CUBE_ROWS - 1, span - 1), col = side ? CUBE_COLUMNS - 1 : 0;
  const x = side ? 95 : 5, y = 5 + (span - 1) * 10;
  const regular = regularNode(0, row, col), length = Math.hypot(regular.x - x, regular.y - y);
  return { id: liftId(side, span), side, span, x, y, row, col, ux: (regular.x-x)/length, uy: (regular.y-y)/length, width: 3, depth: 3 };
}
function liftNode(side, span, story) {
  if (story < 0 || story >= CUBE_STORIES || span < 1 || span > 10 || side < 0 || side > 1) return null;
  const lift = liftDefinition(side, span);
  return { id: liftNodeId(side, span, story), x: lift.x, y: lift.y, z: story * 4, story, radius: 1.5, kind: "liftStation", shaftId: lift.id, span, side };
}
function liftState(world, definition) {
  return world.lifts[definition.id] ||= { z: 0, targetZ: 0, phase: "idle" };
}
function liftEdges(world, story, side, span) {
  const node = liftNode(side, span, story); if (!node) return [];
  const def = liftDefinition(side, span);
  const approach = { ...edge(regularNode(story, def.row, def.col), node, "liftApproach"), shaftId: def.id };
  const result = [approach];
  if (story + span < CUBE_STORIES) result.push({ ...edge(node, liftNode(side, span, story + span), "lift", span), shaftId: def.id });
  return result;
}
function edge(a, b, kind = "corridor", riseStories = 0) {
  return { id: [a.id, b.id].sort().join("~"), a, b, kind, riseStories, width: CUBE_CORRIDOR_WIDTH, length: distance(a, b) };
}
function rampEdges(world, story, span) {
  const nodes = rampNodes(world, story, span);
  return nodes ? [edge(nodes.entry, nodes.a), edge(nodes.a, nodes.b, "ramp", span), edge(nodes.b, nodes.exit)] : [];
}
function allowedFloorEdge(seed, row, col, nr, nc) {
  if (nr === row) return true;
  const lowY = 10 + Math.min(row, nr) * 10;
  const highY = lowY + 10;
  // Leave the dedicated slope lanes and their endpoint rooms clear. Without
  // this reservation upper-floor corridors could cut straight through ramps.
  for (let span = 1; span <= 10; span++) {
    const ramp = rampLayout(seed, span);
    if (ramp.y > lowY && ramp.y < highY && col >= ramp.col && col <= ramp.col + ramp.run) return false;
  }
  return true;
}
function storyChunk(world, story) {
  const state = runtime(world);
  if (state.stories.has(story)) {
    const cached = state.stories.get(story); state.stories.delete(story); state.stories.set(story, cached); return cached;
  }
  const random = randomSource(hash(world.seed, story, 93));
  const nodes = Array.from({ length: CUBE_COLUMNS * CUBE_ROWS }, (_, i) => regularNode(story, Math.floor(i / CUBE_COLUMNS), i % CUBE_COLUMNS));
  const links = new Map();
  const at = (r, c) => r * CUBE_COLUMNS + c;
  const candidates = (i) => {
    const r = Math.floor(i / CUBE_COLUMNS), c = i % CUBE_COLUMNS;
    return [[r, c - 1], [r, c + 1], [r - 1, c], [r + 1, c]].filter(([nr, nc]) => nr >= 0 && nr < CUBE_ROWS && nc >= 0 && nc < CUBE_COLUMNS && allowedFloorEdge(world.seed, r, c, nr, nc)).map(([nr, nc]) => at(nr, nc));
  };
  const connect = (a, b) => { const item = edge(nodes[a], nodes[b]); links.set(item.id, item); };
  const visited = new Uint8Array(nodes.length), stack = [0]; visited[0] = 1;
  while (stack.length) {
    const current = stack[stack.length - 1], choices = candidates(current).filter((i) => !visited[i]);
    if (!choices.length) { stack.pop(); continue; }
    const next = choices[Math.floor(random() * choices.length)]; connect(current, next); visited[next] = 1; stack.push(next);
  }
  for (let i = 0; i < nodes.length; i++) for (const next of candidates(i)) if (next > i && random() < .17) connect(i, next);
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const item of links.values()) { adjacency.get(item.a.id).push(item); adjacency.get(item.b.id).push(item); }
  const chunk = { nodes, edges: [...links.values()], adjacency };
  state.stories.set(story, chunk); state.generationCount++;
  while (state.stories.size > CUBE_MAX_CACHED_STORIES) state.stories.delete(state.stories.keys().next().value);
  return chunk;
}

export function getCubeNode(world, id) {
  let match = /^s(\d+):r(\d+):c(\d+)$/.exec(id || "");
  if (match) {
    const [s, r, c] = match.slice(1).map(Number);
    return s < CUBE_STORIES && r < CUBE_ROWS && c < CUBE_COLUMNS ? regularNode(s, r, c) : null;
  }
  match = /^r(\d+):(\d+):([ab])$/.exec(id || "");
  if (match) return rampNodes(world, Number(match[1]), Number(match[2]))?.[match[3]] || null;
  match = /^l([01]):(\d+):s(\d+)$/.exec(id || "");
  return match ? liftNode(Number(match[1]), Number(match[2]), Number(match[3])) : null;
}
export function getCubeNodeEdges(world, id) {
  const node = getCubeNode(world, id); if (!node) return [];
  const result = new Map();
  if (id.startsWith("s")) for (const item of storyChunk(world, node.story).adjacency.get(id) || []) result.set(item.id, item);
  for (let span = 1; span <= 10; span++) {
    for (const story of [node.story, node.story - span]) for (const item of rampEdges(world, story, span)) if (item.a.id === id || item.b.id === id) result.set(item.id, item);
  }
  for (let side = 0; side < 2; side++) for (let span = 1; span <= 10; span++) {
    for (const story of [node.story, node.story - span]) for (const item of liftEdges(world, story, side, span)) if (item.a.id === id || item.b.id === id) result.set(item.id, item);
  }
  return [...result.values()];
}
export function getCubeCacheStats(world) {
  const state = runtime(world);
  return { cachedStories: state.stories.size, maxCachedStories: CUBE_MAX_CACHED_STORIES, generationCount: state.generationCount, materializedNodes: state.stories.size * CUBE_COLUMNS * CUBE_ROWS };
}
function segmentNear(item, center, radius, verticalRadius) {
  const dx = Math.max(0, Math.min(item.a.x, item.b.x) - center.x, center.x - Math.max(item.a.x, item.b.x));
  const dy = Math.max(0, Math.min(item.a.y, item.b.y) - center.y, center.y - Math.max(item.a.y, item.b.y));
  const dz = Math.max(0, Math.min(item.a.z, item.b.z) - center.z, center.z - Math.max(item.a.z, item.b.z));
  return dx * dx + dy * dy <= radius * radius && dz <= verticalRadius;
}
function segmentDistance(item, center) {
  const dx = item.b.x - item.a.x, dy = item.b.y - item.a.y, dz = item.b.z - item.a.z;
  const t = clamp(((center.x - item.a.x) * dx + (center.y - item.a.y) * dy + (center.z - item.a.z) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
  return Math.hypot(item.a.x + dx * t - center.x, item.a.y + dy * t - center.y, (item.a.z + dz * t - center.z) * 2);
}
export function getCubeScene(world, options = {}) {
  const center = options.center || world.player;
  const radius = clamp(Number(options.radius) || 65, 8, 250);
  const verticalRadius = clamp(Number(options.verticalRadius) || 12, 2, 32);
  const limit = clamp(Math.trunc(Number(options.maxNodes)) || 650, 40, 2000);
  const low = Math.max(0, Math.floor((center.z - verticalRadius) / 4));
  const high = Math.min(CUBE_STORIES - 1, Math.ceil((center.z + verticalRadius) / 4));
  const candidates = new Map();
  for (let story = low; story <= high; story++) {
    for (const item of storyChunk(world, story).edges) if (segmentNear(item, center, radius, verticalRadius)) candidates.set(item.id, item);
  }
  // Long slopes can cross the query even when both endpoint stories lie outside
  // the local band. Their ownership story is at most ten stories below it.
  for (let story = Math.max(0, low - 10); story <= high; story++) {
    for (let span = 1; span <= 10; span++) for (const item of rampEdges(world, story, span)) if (segmentNear(item, center, radius, verticalRadius)) candidates.set(item.id, item);
  }
  for (let story = low; story <= high; story++) for (let side = 0; side < 2; side++) for (let span = 1; span <= 10; span++) {
    for (const item of liftEdges(world, story, side, span)) if (segmentNear(item, center, radius, verticalRadius)) candidates.set(item.id, item);
  }
  // Include vertical lift edges which cross an altitude slice.
  for (let story = Math.max(0, low - 10); story < low; story++) for (let side = 0; side < 2; side++) for (let span = 1; span <= 10; span++) {
    const item = liftEdges(world, story, side, span)[1];
    if (item && segmentNear(item, center, radius, verticalRadius)) candidates.set(item.id, item);
  }
  const nodes = new Map(), edges = [];
  for (const item of [...candidates.values()].sort((a, b) => segmentDistance(a, center) - segmentDistance(b, center))) {
    const extra = Number(!nodes.has(item.a.id)) + Number(!nodes.has(item.b.id));
    if (nodes.size + extra > limit) continue;
    edges.push(item); nodes.set(item.a.id, item.a); nodes.set(item.b.id, item.b);
  }
  const pickups = [];
  for (const node of nodes.values()) {
    node.visited = world.visited.has(node.id);
    if (node.id.startsWith("s") && hash(world.seed, node.story * 1000 + node.y, node.x) % 31 === 0 && !world.collected.has(node.id)) pickups.push({ id: node.id, x: node.x, y: node.y, z: node.z, type: hash(world.seed, node.x, node.story) % 3 ? "haste" : "sonar" });
  }
  return { nodes: [...nodes.values()], edges, ramps: edges.filter((item) => item.kind === "ramp"), lifts: cubeLiftScene(world,center,radius,verticalRadius), pickups, goal: world.goal, start: world.start, corridorWidth: CUBE_CORRIDOR_WIDTH, storyHeight: CUBE_STORY_HEIGHT, dimensions: CUBE_DIMENSIONS };
}

export function getCubeOverview(world) {
  const state = runtime(world);
  if (!state.overview) {
    const edges = new Map(), nodes = new Map();
    const add = (item) => { edges.set(item.id, item); nodes.set(item.a.id, item.a); nodes.set(item.b.id, item.b); };
    // Representative real passages span the whole envelope. The overview is
    // explicitly sampled; zooming/slicing requests the exact local graph.
    for (const story of [0, 3, 6, 9, 12, 15, 18, 21, 24]) {
      const chunk = storyChunk(world, story);
      const stride = Math.max(1, Math.floor(chunk.edges.length / 12));
      for (let index = 0; index < chunk.edges.length; index += stride) add(chunk.edges[index]);
    }
    for (let story = 0; story < CUBE_STORIES; story += 4) for (let span = 1; span <= 10; span++) {
      const item = rampEdges(world, story, span)[1]; if (item) add(item);
      for (let side = 0; side < 2; side++) { const lift = liftEdges(world,story,side,span)[1]; if (lift) add(lift); }
    }
    nodes.set(world.start.id, world.start); nodes.set(world.goal.id, world.goal);
    state.overview = { nodes: [...nodes.values()], edges: [...edges.values()] };
  }
  for (const node of state.overview.nodes) node.visited = world.visited.has(node.id);
  return { ...state.overview, ramps: state.overview.edges.filter((item) => item.kind === "ramp"), pickups: [], sampled: true, lifts: cubeLiftScene(world,{x:50,y:50,z:50},100,100), goal: world.goal, start: world.start, dimensions: CUBE_DIMENSIONS, corridorWidth: CUBE_CORRIDOR_WIDTH, storyHeight: CUBE_STORY_HEIGHT };
}

let liftDefinitions;
function allLiftDefinitions() { return liftDefinitions ||= Array.from({length:20},(_,i)=>liftDefinition(Math.floor(i/10),i%10+1)); }
function insideLift(def,x,y,extra=0) {
  const dx=x-def.x,dy=y-def.y;
  return Math.abs(dx*def.ux+dy*def.uy)<=1.5+extra&&Math.abs(-dx*def.uy+dy*def.ux)<=1.5+extra;
}
function cubeLiftScene(world,center,radius,verticalRadius) {
  return allLiftDefinitions().filter(def=>Math.hypot(def.x-center.x,def.y-center.y)<=radius+4).map(def=>{
    const state=liftState(world,def);
    return {...def,platformZ:state.z,phase:state.phase,lowStory:Math.max(0,Math.floor((center.z-verticalRadius)/4)),highStory:Math.min(CUBE_STORIES-1,Math.ceil((center.z+verticalRadius)/4)),active:world.activeLift?.shaftId===def.id};
  });
}
export function getCubeLiftInteraction(world) {
  if(world.completed)return null;
  if(world.activeLift) return {...world.activeLift,moving:true,ready:false,canUp:false,canDown:false,label:`Lifter moving to story ${world.activeLift.targetStory}`};
  const story=clamp(Math.round(world.player.z/4),0,CUBE_STORIES-1);
  if(Math.abs(world.player.z-story*4)>.18)return null;
  const definitions=allLiftDefinitions().sort((a,b)=>Math.hypot(a.x-world.player.x,a.y-world.player.y)-Math.hypot(b.x-world.player.x,b.y-world.player.y));
  const def=definitions[0];
  if(!def||Math.hypot(def.x-world.player.x,def.y-world.player.y)>6.6)return null;
  const rx=world.player.x-def.x,ry=world.player.y-def.y;
  const along=rx*def.ux+ry*def.uy,across=-rx*def.uy+ry*def.ux;
  if(!insideLift(def,world.player.x,world.player.y)&&(along<1.3||Math.abs(across)>1.1))return null;
  const state=liftState(world,def),ready=Math.abs(state.z-story*4)<.08&&state.phase==="idle";
  return {shaftId:def.id,span:def.span,story,ready,moving:state.phase!=="idle",insideCabin:insideLift(def,world.player.x,world.player.y),canUp:story+def.span<CUBE_STORIES,canDown:story-def.span>=0,label:ready?`${def.span}-story lifter · E up / Shift+E down`:state.phase==="calling"?"Lifter arriving…":`Call ${def.span}-story lifter`};
}
export function activateCubeLift(world,direction=1) {
  const interaction=getCubeLiftInteraction(world);
  if(!interaction||interaction.moving)return false;
  const def=allLiftDefinitions().find(item=>item.id===interaction.shaftId),state=liftState(world,def);
  if(!interaction.ready) {state.targetZ=interaction.story*4;state.phase="calling";world.message="Lifter called. Wait for the gated platform, then press E to ride.";world.messageTime=4;return true;}
  const signed=direction<0?-1:1;
  if(signed>0&&!interaction.canUp||signed<0&&!interaction.canDown)return false;
  const targetStory=interaction.story+signed*def.span;
  world.activeRamp=null;
  world.activeLift={shaftId:def.id,span:def.span,phase:"boarding",targetZ:targetStory*4,targetStory:targetStory+1,boardFrom:{x:world.player.x,y:world.player.y},boardTime:0};
  state.phase="boarding";state.targetZ=targetStory*4;
  world.message=`Lifter · travelling ${def.span} ${def.span===1?"story":"stories"} ${signed>0?"up":"down"}.`;world.messageTime=4;
  return true;
}
function advanceLifts(world,dt) {
  for(const def of allLiftDefinitions()) {
    const state=world.lifts[def.id];if(!state||state.phase!=="calling")continue;
    const delta=state.targetZ-state.z,amount=Math.sign(delta)*Math.min(Math.abs(delta),dt*7);
    state.z+=amount;if(Math.abs(state.targetZ-state.z)<.001){state.z=state.targetZ;state.phase="idle";}
  }
  const active=world.activeLift;if(!active)return false;
  const def=allLiftDefinitions().find(item=>item.id===active.shaftId),state=liftState(world,def);
  if(active.phase==="boarding") {
    active.boardTime+=dt;const t=Math.min(1,active.boardTime/.7);
    world.player.x=active.boardFrom.x+(def.x-active.boardFrom.x)*t;world.player.y=active.boardFrom.y+(def.y-active.boardFrom.y)*t;world.player.z=state.z;
    if(t>=1){active.phase="moving";state.phase="moving";}
    return true;
  }
  const delta=active.targetZ-state.z,amount=Math.sign(delta)*Math.min(Math.abs(delta),dt*5);
  state.z+=amount;world.player.x=def.x;world.player.y=def.y;world.player.z=state.z;
  if(Math.abs(state.z-active.targetZ)<.001) {
    state.z=active.targetZ;state.phase="idle";world.player.z=state.z;
    world.currentNode=liftNodeId(def.side,def.span,Math.round(state.z/4));world.visited.add(world.currentNode);
    world.activeLift=null;world.message="Lifter arrived. Walk through the open gate.";world.messageTime=4;
  }
  return true;
}

export function createCubeMaze(seed = Math.floor(Math.random() * 0xFFFFFFFF)) {
  const safeSeed = Number.isInteger(seed) ? seed >>> 0 : 0;
  const start = regularNode(0, 0, 0), goal = regularNode(CUBE_STORIES - 1, CUBE_ROWS - 1, CUBE_COLUMNS - 1);
  const world = { lifts: {}, activeLift: null, seed: safeSeed, dimensions: CUBE_DIMENSIONS, start, goal, player: { x: start.x, y: start.y, z: start.z, facing: 0, pitch: 0 }, visited: new Set([start.id]), collected: new Set(), elapsed: 0, distance: 0, moves: 0, completed: false, haste: 0, sonar: 0, compass: 0, compassCooldown: 0, activeRamp: null, currentNode: start.id, story: 1, totalNodes: CUBE_COLUMNS * CUBE_ROWS * CUBE_STORIES + 2 * (10 * CUBE_STORIES - 55) + 20 * CUBE_STORIES, message: "One connected cube. Walk ramps, or press E near a lifter to travel up; Shift+E travels down.", messageTime: 8 };
  const first = storyChunk(world, 0).adjacency.get(start.id)[0];
  if (first) { const next = first.a.id === start.id ? first.b : first.a; world.player.facing = Math.atan2(next.y - start.y, next.x - start.x); }
  return world;
}
function surfaceAt(scene, x, y, previousZ, maximumRise = .3) {
  let best = null;
  for (const item of scene.edges) {
    if (item.kind === "lift") continue;
    const dx = item.b.x - item.a.x, dy = item.b.y - item.a.y;
    const t = clamp(((x - item.a.x) * dx + (y - item.a.y) * dy) / (dx * dx + dy * dy), 0, 1);
    const centerX = item.a.x + dx * t, centerY = item.a.y + dy * t;
    const separation = Math.hypot(x - centerX, y - centerY), z = item.a.z + (item.b.z - item.a.z) * t;
    if (item.kind === "liftApproach") {
      const lift = scene.lifts?.find((entry) => entry.id === item.shaftId);
      if (lift && insideLift(lift,x,y,.35) && (Math.abs(lift.platformZ-z)>.08 || lift.phase!=="idle")) continue;
    }
    if (separation > item.width / 2 - .2 || Math.abs(z - previousZ) > maximumRise) continue;
    const score = separation + Math.abs(z - previousZ) * .03;
    if (!best || score < best.score) best = { z, score, edge: item };
  }
  for (const node of scene.nodes) {
    if (node.kind === "liftStation") {
      const lift=scene.lifts?.find((entry)=>entry.id===node.shaftId);
      if (!lift || Math.abs(lift.platformZ-node.z)>.08 || lift.phase!=="idle") continue;
    }
    const separation = Math.hypot(x - node.x, y - node.y);
    if (separation > node.radius - .2 || Math.abs(node.z - previousZ) > maximumRise) continue;
    const score = separation + .15;
    if (!best || score < best.score) best = { z: node.z, score, node };
  }
  return best;
}
function moveStep(world, scene, x, y) {
  if (x < .2 || x > CUBE_DIMENSIONS.length - .2 || y < .2 || y > CUBE_DIMENSIONS.width - .2) return false;
  const surface = surfaceAt(scene, x, y, world.player.z, .16);
  if (!surface) return false;
  world.distance += Math.hypot(x - world.player.x, y - world.player.y, surface.z - world.player.z);
  Object.assign(world.player, { x, y, z: surface.z });
  world.activeRamp = surface.edge?.kind === "ramp" ? surface.edge : null;
  return true;
}
export function updateCubeMaze(world, elapsed, input = {}) {
  if (world.completed) return 0;
  const dt = clamp(Number(elapsed) || 0, 0, .05); world.elapsed += dt;
  for (const key of ["haste", "sonar", "compass", "compassCooldown", "messageTime"]) world[key] = Math.max(0, world[key] - dt);
  world.player.facing += clamp(Number(input.turn) || 0, -1, 1) * 2 * dt;
  world.player.facing = Math.atan2(Math.sin(world.player.facing), Math.cos(world.player.facing));
  world.player.pitch = clamp((world.player.pitch || 0) + clamp(Number(input.look) || 0, -1, 1) * dt, -.8, .8);
  if (advanceLifts(world,dt)) {
    world.story = clamp(Math.floor(world.player.z / 4)+1,1,CUBE_STORIES);
    return dt;
  }
  const forward = clamp(Number(input.forward) || 0, -1, 1), strafe = clamp(Number(input.strafe) || 0, -1, 1), norm = Math.max(1, Math.hypot(forward, strafe));
  const speed = world.haste > 0 ? 12 : 8, cos = Math.cos(world.player.facing), sin = Math.sin(world.player.facing);
  const dx = (cos * forward - sin * strafe) / norm * speed * dt, dy = (sin * forward + cos * strafe) / norm * speed * dt;
  const scene = getCubeScene(world, { radius: 35, verticalRadius: 5, maxNodes: 650 });
  const count = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / .12));
  for (let step = 0; step < count; step++) {
    if (!moveStep(world, scene, world.player.x + dx / count, world.player.y + dy / count)) {
      moveStep(world, scene, world.player.x + dx / count, world.player.y);
      moveStep(world, scene, world.player.x, world.player.y + dy / count);
    }
  }
  world.moves = world.distance; world.story = clamp(Math.floor(world.player.z / 4) + 1, 1, CUBE_STORIES);
  for (const node of scene.nodes) if (distance(world.player, node) < 8) {
    world.visited.add(node.id);
    if (distance(world.player, node) < node.radius) world.currentNode = node.id;
  }
  for (const pickup of scene.pickups) if (distance(world.player, pickup) < 1.2 && !world.collected.has(pickup.id)) {
    world.collected.add(pickup.id); world[pickup.type] = pickup.type === "haste" ? 20 : 25;
    world.message = pickup.type === "haste" ? "Haste · faster movement for 20 seconds." : "Sonar · nearby passages and ramps highlighted for 25 seconds."; world.messageTime = 5;
  }
  if (distance(world.player, world.goal) < 2) { world.completed = true; world.message = "The Cube is conquered. You reached the far upper exit!"; world.messageTime = 10; }
  return dt;
}

export function cubeMazeHint(world, maxPoints = 60) {
  if (world.completed) return [];
  const local = getCubeScene(world, { radius: 20, verticalRadius: 2, maxNodes: 300 });
  const surface = surfaceAt(local, world.player.x, world.player.y, world.player.z, .1);
  const activeRamp = world.activeRamp || (surface?.edge?.kind === "ramp" ? surface.edge : null);
  if (activeRamp) return [{ ...world.player }, { ...activeRamp.b, kind: "ramp" }];
  const story = clamp(Math.round(world.player.z / 4), 0, CUBE_STORIES - 1), chunk = storyChunk(world, story);
  // Start from a junction of the passage the player actually occupies. Pure
  // Euclidean nearest-node selection can point through a nearby closed wall.
  const ends = surface?.edge ? [surface.edge.a, surface.edge.b].filter((node) => node.id.startsWith("s") && node.story === story) : [];
  if (surface?.node?.id.startsWith("s")) ends.push(surface.node);
  const candidates = ends.length ? ends : chunk.nodes;
  const nearest = candidates.reduce((best, node) => distance(world.player, node) < distance(world.player, best) ? node : best, candidates[0]);
  const span = Math.min(10, CUBE_STORIES - 1 - story), ramp = span ? rampNodes(world, story, span) : null;
  const target = ramp ? ramp.entry : world.goal;
  const queue = [nearest.id], previous = new Map([[nearest.id, null]]);
  for (let head = 0; head < queue.length && !previous.has(target.id); head++) for (const item of chunk.adjacency.get(queue[head]) || []) {
    const next = item.a.id === queue[head] ? item.b.id : item.a.id;
    if (!previous.has(next)) { previous.set(next, queue[head]); queue.push(next); }
  }
  const ids = []; let id = target.id;
  while (id !== null && previous.has(id)) { ids.push(id); id = previous.get(id); }
  const points = ids.reverse().map((nodeId) => getCubeNode(world, nodeId));
  if (ramp) points.push(ramp.a, { ...ramp.b, kind: "ramp" }, ramp.exit);
  return [{ ...world.player }, ...points].slice(0, Math.max(2, Math.min(200, maxPoints)));
}
export function activateCubeCompass(world) {
  if (world.completed || world.compassCooldown > 0) return false;
  world.compass = 12; world.compassCooldown = 30; world.message = "Compass · follow cyan passages toward an upward ramp and the upper exit."; world.messageTime = 5;
  return true;
}
export function cubeMazeSaveKey(playerName) {
  const normalized = sanitizePlayerName(playerName).toLowerCase();
  return `mist-maze-cube-v2:${normalized ? `player:${encodeURIComponent(normalized)}` : "anonymous"}`;
}
export function serializeCubeMaze(world) {
  return JSON.stringify({ version: SAVE_VERSION, seed: world.seed, player: world.player, visited: [...world.visited], collected: [...world.collected], elapsed: world.elapsed, distance: world.distance, completed: world.completed, haste: world.haste, sonar: world.sonar, compass: world.compass, compassCooldown: world.compassCooldown, lifts:world.lifts, activeLift:world.activeLift });
}
export function restoreCubeMaze(serialized) {
  try {
    const saved = JSON.parse(serialized);
    if (!saved || saved.version !== SAVE_VERSION || !Number.isInteger(saved.seed) || saved.seed < 0 || saved.seed > 0xFFFFFFFF) return null;
    const world = createCubeMaze(saved.seed), p = saved.player;
    for (let side=0;side<2;side++)for(let span=1;span<=10;span++) {
      const def=liftDefinition(side,span),savedLift=saved.lifts?.[def.id];
      if(savedLift&&Number.isFinite(savedLift.z))world.lifts[def.id]={z:clamp(savedLift.z,0,96),targetZ:clamp(Number(savedLift.targetZ)||savedLift.z,0,96),phase:savedLift.phase==="calling"?"calling":"idle"};
    }
    if (p && [p.x, p.y, p.z, p.facing, p.pitch].every(Number.isFinite) && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100 && p.z >= 0 && p.z < 100) {
      const scene = getCubeScene(world, { center: p, radius: 15, verticalRadius: 2, maxNodes: 650 });
      const surface = surfaceAt(scene, p.x, p.y, p.z, .1);
      if (surface) { world.player = { x: p.x, y: p.y, z: surface.z, facing: p.facing, pitch: clamp(p.pitch, -.8, .8) }; world.activeRamp = surface.edge?.kind === "ramp" ? surface.edge : null; }
    }
    if (saved.activeLift && p && [p.x,p.y,p.z,p.facing,p.pitch].every(Number.isFinite) && p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100&&p.z>=0&&p.z<=96) {
      const active=saved.activeLift, def=allLiftDefinitions().find(item=>item.id===active.shaftId);
      if(def&&["boarding","moving"].includes(active.phase)&&Number.isFinite(active.targetZ)&&Number.isInteger(active.targetZ/4)&&active.targetZ>=0&&active.targetZ<=96&&(insideLift(def,p.x,p.y,.35)||active.phase==="boarding"&&Math.hypot(p.x-def.x,p.y-def.y)<6.7)) {
        const state=liftState(world,def);state.z=clamp(p.z,0,96);state.targetZ=active.targetZ;state.phase=active.phase;
        world.player={...p,pitch:clamp(p.pitch,-.8,.8)};
        world.activeLift={shaftId:def.id,span:def.span,phase:active.phase,targetZ:active.targetZ,targetStory:Math.round(active.targetZ/4)+1};
        if(active.phase==="boarding") {world.activeLift.boardFrom={x:Number(active.boardFrom?.x)||p.x,y:Number(active.boardFrom?.y)||p.y};world.activeLift.boardTime=clamp(Number(active.boardTime)||0,0,.7);}
      }
    }
    world.visited = new Set((Array.isArray(saved.visited) ? saved.visited : []).filter((id) => typeof id === "string" && getCubeNode(world, id)));
    world.visited.add(world.start.id);
    world.collected = new Set((Array.isArray(saved.collected) ? saved.collected : []).filter((id) => typeof id === "string" && id.startsWith("s") && getCubeNode(world, id)));
    for (const key of ["elapsed", "distance"]) world[key] = Number.isFinite(saved[key]) ? Math.max(0, saved[key]) : 0;
    for (const key of ["haste", "sonar", "compass", "compassCooldown"]) world[key] = Number.isFinite(saved[key]) ? clamp(saved[key], 0, 30) : 0;
    world.moves = world.distance; world.story = Math.floor(world.player.z / 4) + 1;
    world.completed = saved.completed === true && distance(world.player, world.goal) < 2;
    world.message = world.completed ? "The Cube is conquered. You reached the upper exit!" : "Welcome back. Your position in the same connected volume is restored.";
    world.messageTime = 6; return world;
  } catch { return null; }
}
export function loadCubeMaze(playerName, storage) {
  try { const target = storage === undefined ? globalThis.localStorage : storage; return restoreCubeMaze(target?.getItem(cubeMazeSaveKey(playerName))) || createCubeMaze(); }
  catch { return createCubeMaze(); }
}
export function saveCubeMaze(playerName, world, storage) {
  try { const target = storage === undefined ? globalThis.localStorage : storage; target?.setItem(cubeMazeSaveKey(playerName), serializeCubeMaze(world)); return Boolean(target); }
  catch { return false; }
}
