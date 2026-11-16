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
const SAVE_VERSION = 4;
const runtimes = new WeakMap();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const regularId = (s, r, c) => `s${s}:r${r}:c${c}`;
const rampNodeId = (story, span, instance, end) => `r${story}:${span}:${instance}:${end}`;
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
const FLOOR_NODES = CUBE_COLUMNS * CUBE_ROWS;
const passageKey = (a, b) => Math.min(a, b) * FLOOR_NODES + Math.max(a, b);
const rampSegments = (ramp) => [
  { a: ramp.entry, b: ramp.a }, { a: ramp.a, b: ramp.b }, { a: ramp.b, b: ramp.exit },
];
function floorReservations(ramp) {
  const blocked = [];
  const low = Math.min(ramp.from, ramp.to), high = Math.max(ramp.from, ramp.to);
  const lane = Math.floor((ramp.fixed - 10) / 10);
  for (let index = 0; index < CUBE_COLUMNS; index++) {
    if (10 + index * 10 < low || 10 + index * 10 > high) continue;
    const a = ramp.axis === "x" ? lane * CUBE_COLUMNS + index : index * CUBE_COLUMNS + lane;
    blocked.push(passageKey(a, a + (ramp.axis === "x" ? CUBE_COLUMNS : 1)));
  }
  return blocked;
}
function floorConnected(blocked) {
  const seen = new Uint8Array(FLOOR_NODES), queue = [0]; seen[0] = 1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], row = Math.floor(current / CUBE_COLUMNS), col = current % CUBE_COLUMNS;
    const next = [col ? current - 1 : -1, col < CUBE_COLUMNS - 1 ? current + 1 : -1, row ? current - CUBE_COLUMNS : -1, row < CUBE_ROWS - 1 ? current + CUBE_COLUMNS : -1];
    for (const node of next) if (node >= 0 && !seen[node] && !blocked.has(passageKey(current, node))) { seen[node] = 1; queue.push(node); }
  }
  return queue.length === FLOOR_NODES;
}
function tunnelInterval(segment, minX, maxX, minY, maxY) {
  const dx = segment.b.x - segment.a.x, dy = segment.b.y - segment.a.y;
  const t0 = dx ? (minX - segment.a.x) / dx : (minY - segment.a.y) / dy;
  const t1 = dx ? (maxX - segment.a.x) / dx : (maxY - segment.a.y) / dy;
  const z0 = segment.a.z + (segment.b.z - segment.a.z) * clamp(t0, 0, 1);
  const z1 = segment.a.z + (segment.b.z - segment.a.z) * clamp(t1, 0, 1);
  return [Math.min(z0, z1), Math.max(z0, z1) + 3.12];
}
function tunnelsOverlap(first, second) {
  // Include the circular endpoint rooms, not just infinitely thin centerlines.
  // The vertical interval includes the actual 2.9-unit roof plus a small margin.
  const radius = ROOM_RADIUS + .03;
  const minX = Math.max(Math.min(first.a.x, first.b.x) - radius, Math.min(second.a.x, second.b.x) - radius);
  const maxX = Math.min(Math.max(first.a.x, first.b.x) + radius, Math.max(second.a.x, second.b.x) + radius);
  const minY = Math.max(Math.min(first.a.y, first.b.y) - radius, Math.min(second.a.y, second.b.y) - radius);
  const maxY = Math.min(Math.max(first.a.y, first.b.y) + radius, Math.max(second.a.y, second.b.y) + radius);
  if (minX >= maxX || minY >= maxY) return false;
  const a = tunnelInterval(first, minX, maxX, minY, maxY), b = tunnelInterval(second, minX, maxX, minY, maxY);
  return a[0] < b[1] && b[0] < a[1];
}
function candidateRamp(random, span, story, instance) {
  const axis = random() < .5 ? "x" : "y";
  const minimumRun = Math.ceil(span * CUBE_STORY_HEIGHT / .58 / 10);
  const run = minimumRun + Math.floor(random() * (Math.min(8, minimumRun + 2) - minimumRun + 1));
  const start = Math.floor(random() * (CUBE_COLUMNS - run));
  const reverse = random() < .5, fromIndex = reverse ? start + run : start, toIndex = reverse ? start : start + run;
  const lane = Math.floor(random() * (CUBE_ROWS - 1)), fixed = 15 + lane * 10;
  const from = 10 + fromIndex * 10, to = 10 + toIndex * 10;
  const a = { id: rampNodeId(story, span, instance, "a"), x: axis === "x" ? from : fixed, y: axis === "y" ? from : fixed, z: story * 4, story, radius: ROOM_RADIUS };
  const b = { id: rampNodeId(story, span, instance, "b"), x: axis === "x" ? to : fixed, y: axis === "y" ? to : fixed, z: (story + span) * 4, story: story + span, radius: ROOM_RADIUS };
  const entry = regularNode(story, axis === "x" ? lane : fromIndex, axis === "x" ? fromIndex : lane);
  const exit = regularNode(story + span, axis === "x" ? lane : toIndex, axis === "x" ? toIndex : lane);
  return { instance, story, span, axis, fixed, from, to, a, b, entry, exit };
}
function shuffled(random, items) {
  const values = [...items];
  for (let index = values.length - 1; index > 0; index--) { const next = Math.floor(random() * (index + 1)); [values[index], values[next]] = [values[next], values[index]]; }
  return values;
}
function rampDefinitions(world) {
  const state = runtime(world);
  if (state.rampDefinitions) return state.rampDefinitions;
  // Every individual slope chooses its axis, direction, position, run and
  // launch height from the seed. Rejection sampling protects tunnel clearance
  // and preserves a connected ordinary passage network on every altitude.
  for (let attempt = 0; attempt < 32; attempt++) {
    const random = randomSource(hash(world.seed, attempt, 271));
    const definitions = [], blocked = Array.from({ length: CUBE_STORIES }, () => new Set());
    const tall = shuffled(random, Array.from({ length: 18 }, (_, index) => index % 9 + 2)).sort((a, b) => b - a);
    const requests = tall.map((span) => ({ span, story: null }));
    requests.push(...shuffled(random, Array.from({ length: CUBE_STORIES - 1 }, (_, story) => ({ span: 1, story }))));
    requests.push(...Array.from({ length: 4 + Math.floor(random() * 7) }, () => ({ span: 1 + Math.floor(random() * 10), story: null, optional: true })));
    let complete = true;
    for (let index = 0; index < requests.length; index++) {
      const request = requests[index]; let accepted = false;
      for (let trial = 0; trial < 1200; trial++) {
        const story = request.story ?? Math.floor(random() * (CUBE_STORIES - request.span));
        const candidate = candidateRamp(random, request.span, story, definitions.length);
        const segments = rampSegments(candidate);
        if (definitions.some((other) => segments.some((first) => rampSegments(other).some((second) => tunnelsOverlap(first, second))))) continue;
        const reservations = floorReservations(candidate), additions = [];
        let connected = true;
        for (let floor = story; floor <= story + request.span; floor++) {
          const updated = new Set([...blocked[floor], ...reservations]);
          if (!floorConnected(updated)) { connected = false; break; }
          additions.push([floor, updated]);
        }
        if (!connected) continue;
        for (const [floor, updated] of additions) blocked[floor] = updated;
        definitions.push(candidate); accepted = true; break;
      }
      if (!accepted && !request.optional) { complete = false; break; }
    }
    if (!complete) continue;
    state.rampDefinitions = definitions; state.blockedFloorEdges = blocked;
    state.rampNodes = new Map(); state.rampAdjacency = new Map();
    for (const ramp of definitions) {
      const edges = [edge(ramp.entry, ramp.a), edge(ramp.a, ramp.b, "ramp", ramp.span), edge(ramp.b, ramp.exit)];
      ramp.edges = edges;
      state.rampNodes.set(ramp.a.id, ramp.a); state.rampNodes.set(ramp.b.id, ramp.b);
      for (const item of edges) for (const node of [item.a, item.b]) {
        if (!state.rampAdjacency.has(node.id)) state.rampAdjacency.set(node.id, []);
        state.rampAdjacency.get(node.id).push(item);
      }
    }
    return definitions;
  }
  throw new Error("Could not generate a safe Cube layout. Start a new Cube to try another seed.");
}
function edge(a, b, kind = "corridor", riseStories = 0) {
  return { id: [a.id, b.id].sort().join("~"), a, b, kind, riseStories, width: CUBE_CORRIDOR_WIDTH, length: distance(a, b) };
}
function allowedFloorEdge(world, story, row, col, nr, nc) {
  rampDefinitions(world);
  return !runtime(world).blockedFloorEdges[story].has(passageKey(row * CUBE_COLUMNS + col, nr * CUBE_COLUMNS + nc));
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
    return [[r, c - 1], [r, c + 1], [r - 1, c], [r + 1, c]].filter(([nr, nc]) => nr >= 0 && nr < CUBE_ROWS && nc >= 0 && nc < CUBE_COLUMNS && allowedFloorEdge(world, story, r, c, nr, nc)).map(([nr, nc]) => at(nr, nc));
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
  rampDefinitions(world);
  return runtime(world).rampNodes.get(id) || null;
}
export function getCubeNodeEdges(world, id) {
  const node = getCubeNode(world, id); if (!node) return [];
  const result = new Map();
  if (id.startsWith("s")) for (const item of storyChunk(world, node.story).adjacency.get(id) || []) result.set(item.id, item);
  for (const item of runtime(world).rampAdjacency.get(id) || []) result.set(item.id, item);
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
  // Include slopes that cross the query even if both landing stories lie
  // outside its altitude slice. These are real edges from the same volume.
  for (const ramp of rampDefinitions(world)) for (const item of ramp.edges) if (segmentNear(item, center, radius, verticalRadius)) candidates.set(item.id, item);
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
  return { nodes: [...nodes.values()], edges, ramps: edges.filter((item) => item.kind === "ramp"), pickups, goal: world.goal, start: world.start, corridorWidth: CUBE_CORRIDOR_WIDTH, storyHeight: CUBE_STORY_HEIGHT, dimensions: CUBE_DIMENSIONS };
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
    // Show every real ascent in the navigable overview, including those whose
    // launch floor lies between the representative horizontal slices.
    for (const ramp of rampDefinitions(world)) add(ramp.edges[1]);
    nodes.set(world.start.id, world.start); nodes.set(world.goal.id, world.goal);
    state.overview = { nodes: [...nodes.values()], edges: [...edges.values()] };
  }
  for (const node of state.overview.nodes) node.visited = world.visited.has(node.id);
  return { ...state.overview, ramps: state.overview.edges.filter((item) => item.kind === "ramp"), pickups: [], sampled: true, goal: world.goal, start: world.start, dimensions: CUBE_DIMENSIONS, corridorWidth: CUBE_CORRIDOR_WIDTH, storyHeight: CUBE_STORY_HEIGHT };
}

export function createCubeMaze(seed = Math.floor(Math.random() * 0xFFFFFFFF)) {
  const safeSeed = Number.isInteger(seed) ? seed >>> 0 : 0;
  const start = regularNode(0, 0, 0), goal = regularNode(CUBE_STORIES - 1, CUBE_ROWS - 1, CUBE_COLUMNS - 1);
  const world = { seed: safeSeed, dimensions: CUBE_DIMENSIONS, start, goal, player: { x: start.x, y: start.y, z: start.z, facing: 0, pitch: 0 }, visited: new Set([start.id]), collected: new Set(), elapsed: 0, distance: 0, moves: 0, completed: false, haste: 0, sonar: 0, compass: 0, compassCooldown: 0, activeRamp: null, currentNode: start.id, story: 1, message: "Explore the randomized Cube. Walk scattered ramps to ascend or descend; every slope climbs at most 10 stories.", messageTime: 8 };
  world.totalNodes = CUBE_COLUMNS * CUBE_ROWS * CUBE_STORIES + 2 * rampDefinitions(world).length;
  const first = storyChunk(world, 0).adjacency.get(start.id)[0];
  if (first) { const next = first.a.id === start.id ? first.b : first.a; world.player.facing = Math.atan2(next.y - start.y, next.x - start.x); }
  return world;
}
function surfaceAt(scene, x, y, previousZ, maximumRise = .3) {
  let best = null;
  for (const item of scene.edges) {
    const dx = item.b.x - item.a.x, dy = item.b.y - item.a.y;
    const t = clamp(((x - item.a.x) * dx + (y - item.a.y) * dy) / (dx * dx + dy * dy), 0, 1);
    const centerX = item.a.x + dx * t, centerY = item.a.y + dy * t;
    const separation = Math.hypot(x - centerX, y - centerY), z = item.a.z + (item.b.z - item.a.z) * t;
    if (separation > item.width / 2 - .2 || Math.abs(z - previousZ) > maximumRise) continue;
    const score = separation + Math.abs(z - previousZ) * .03;
    if (!best || score < best.score) best = { z, score, edge: item };
  }
  for (const node of scene.nodes) {
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
  const upwardRamps = rampDefinitions(world).filter((definition) => definition.story === story);
  const ramp = upwardRamps.sort((a, b) => distance(nearest, a.entry) - distance(nearest, b.entry))[0] || null;
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
  return JSON.stringify({ version: SAVE_VERSION, seed: world.seed, player: world.player, visited: [...world.visited], collected: [...world.collected], elapsed: world.elapsed, distance: world.distance, completed: world.completed, haste: world.haste, sonar: world.sonar, compass: world.compass, compassCooldown: world.compassCooldown });
}
export function restoreCubeMaze(serialized) {
  try {
    const saved = JSON.parse(serialized);
    if (!saved || ![2, 3, SAVE_VERSION].includes(saved.version) || !Number.isInteger(saved.seed) || saved.seed < 0 || saved.seed > 0xFFFFFFFF) return null;
    const world = createCubeMaze(saved.seed), p = saved.player, layoutChanged = saved.version !== SAVE_VERSION;
    if (p && [p.x, p.y, p.z, p.facing, p.pitch].every(Number.isFinite) && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100 && p.z >= 0 && p.z < 100) {
      const scene = getCubeScene(world, { center: p, radius: 15, verticalRadius: 2, maxNodes: 650 });
      const surface = surfaceAt(scene, p.x, p.y, p.z, .1);
      if (surface) { world.player = { x: p.x, y: p.y, z: surface.z, facing: p.facing, pitch: clamp(p.pitch, -.8, .8) }; world.activeRamp = surface.edge?.kind === "ramp" ? surface.edge : null; }
      else if (layoutChanged) {
        const story = clamp(Math.round(p.z / 4), 0, CUBE_STORIES - 1);
        const node = storyChunk(world, story).nodes.reduce((nearest, candidate) => Math.hypot(candidate.x - p.x, candidate.y - p.y) < Math.hypot(nearest.x - p.x, nearest.y - p.y) ? candidate : nearest);
        world.player = { x: node.x, y: node.y, z: node.z, facing: p.facing, pitch: clamp(p.pitch, -.8, .8) }; world.currentNode = node.id;
      }
    }
    world.visited = new Set((Array.isArray(saved.visited) ? saved.visited : []).filter((id) => typeof id === "string" && getCubeNode(world, id)));
    world.visited.add(world.start.id);
    world.collected = new Set((Array.isArray(saved.collected) ? saved.collected : []).filter((id) => typeof id === "string" && id.startsWith("s") && getCubeNode(world, id)));
    for (const key of ["elapsed", "distance"]) world[key] = Number.isFinite(saved[key]) ? Math.max(0, saved[key]) : 0;
    for (const key of ["haste", "sonar", "compass", "compassCooldown"]) world[key] = Number.isFinite(saved[key]) ? clamp(saved[key], 0, 30) : 0;
    world.moves = world.distance; world.story = Math.floor(world.player.z / 4) + 1;
    world.completed = saved.completed === true && distance(world.player, world.goal) < 2;
    world.message = world.completed ? "The Cube is conquered. You reached the upper exit!" : layoutChanged ? "The Cube now uses randomized ramps only. Your progress is kept; your position was restored to a safe landing." : "Welcome back. Your position in the same connected volume is restored.";
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
