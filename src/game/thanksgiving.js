import {
  FARM_WIDTH, FARM_HEIGHT, FARM_PLAYER_SPEED, FARM_FARMER_SPEED,
  FARM_RESCUE_SECONDS, FARM_SPAWN_LIMITS, FARM_POWERUPS,
} from "../config/thanksgiving.js";

const PLAYER_RADIUS = 0.3;
const FARMER_RADIUS = 0.34;
const RESCUE_DISTANCE = 1.5;
const POWER_IDS = FARM_POWERUPS.map(power => power.id);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const road = (world, x, y) => world.grid[Math.floor(y)]?.[Math.floor(x)] === 0;

function randomIndex(world, length) {
  const value = Number(world._random());
  return Math.min(length - 1, Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * length)));
}

function positionClear(world, x, y, radius, slip = false) {
  const clear = (px, py) => road(world, px, py) || (slip && px >= 1 && py >= 1 && px < world.width - 1 && py < world.height - 1 && world.terrain[Math.floor(py)]?.[Math.floor(px)] === 4);
  return clear(x - radius, y - radius) && clear(x + radius, y - radius)
    && clear(x - radius, y + radius) && clear(x + radius, y + radius);
}

function nearestRoad(world, point) {
  return world._roads.reduce((best, tile) => positionClear(world, tile.x, tile.y, PLAYER_RADIUS) && (!best || distance(tile, point) < distance(best, point)) ? tile : best, null);
}

function clearSegment(world, from, to, radius = 0) {
  const steps = Math.max(1, Math.ceil(distance(from, to) / 0.22));
  for (let step = 0; step <= steps; step += 1) {
    const fraction = step / steps;
    if (!positionClear(world, from.x + (to.x - from.x) * fraction, from.y + (to.y - from.y) * fraction, radius)) return false;
  }
  return true;
}

function randomPosition(world, predicate = () => true) {
  // Starting at a random cell and walking a coprime stride gives a bounded fallback
  // even with a deterministic or unlucky random source.
  const start = randomIndex(world, world._roads.length);
  for (let offset = 0; offset < world._roads.length; offset += 1) {
    const candidate = world._roads[(start + offset) % world._roads.length];
    if (predicate(candidate)) return { x: candidate.x, y: candidate.y };
  }
  return null;
}

function spawn(world, kind) {
  if (world[kind].length >= FARM_SPAWN_LIMITS[kind]) return;
  const entities = [...world.cages, ...world.corn, ...world.pickups];
  const position = randomPosition(world, point => distance(point, world.player) > 1.8
    && distance(point, world.farmer) > 1.8
    && entities.every(entity => distance(point, entity) >= (kind === "cages" ? 2 : 0.8)));
  if (!position) return;
  const entity = { id: world._nextId++, ...position };
  if (kind === "cages") entity.progress = 0;
  if (kind === "pickups") entity.type = POWER_IDS[randomIndex(world, POWER_IDS.length)];
  world[kind].push(entity);
}

function setMessage(world, message, duration = 3) {
  world.message = message;
  world._messageUntil = world.time + duration;
}

function generateFarmLayout(random) {
  // Irregular obstacles divide an open yard into a mesh of short paths. Each
  // placement must preserve connectivity, including pockets behind bent fences.
  let seed = (Math.floor(random() * 4294967296) >>> 0) || 7189;
  const integer = (min, max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return min + Math.floor(seed / 4294967296 * (max - min + 1));
  };
  const grid = Array.from({ length: FARM_HEIGHT }, (_, y) =>
    Array.from({ length: FARM_WIDTH }, (_, x) =>
      x === 0 || y === 0 || x === FARM_WIDTH - 1 || y === FARM_HEIGHT - 1 ? 1 : 0));
  const terrain = grid.map(row => row.map(() => 4));
  const farmProps = [];
  const obstacleTiles = new Set();
  const queue = new Int32Array(FARM_WIDTH * FARM_HEIGHT);
  const visited = new Int32Array(queue.length);
  let visit = 0;
  let floorCount = (FARM_WIDTH - 2) * (FARM_HEIGHT - 2);
  const connected = (expected) => {
    visit += 1;
    let head = 0;
    let tail = 1;
    queue[0] = FARM_WIDTH + 1;
    visited[queue[0]] = visit;
    while (head < tail) {
      const cell = queue[head++];
      const x = cell % FARM_WIDTH;
      const y = Math.floor(cell / FARM_WIDTH);
      for (const next of [cell - 1, cell + 1, cell - FARM_WIDTH, cell + FARM_WIDTH]) {
        const nx = next % FARM_WIDTH;
        const ny = Math.floor(next / FARM_WIDTH);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1 || grid[ny]?.[nx] !== 0 || visited[next] === visit) continue;
        visited[next] = visit;
        queue[tail++] = next;
      }
    }
    return tail === expected;
  };
  const place = (cells, style, prop) => {
    if (cells.some(([x, y]) => grid[y]?.[x] !== 0)) return false;
    for (const [x, y] of cells) grid[y][x] = 1;
    if (!connected(floorCount - cells.length)) {
      for (const [x, y] of cells) grid[y][x] = 0;
      return false;
    }
    floorCount -= cells.length;
    for (const [x, y] of cells) {
      terrain[y][x] = style;
      if (prop) obstacleTiles.add(y * FARM_WIDTH + x);
    }
    if (prop) farmProps.push(prop);
    return true;
  };
  const rectangles = (count, minW, maxW, minH, maxH, types) => {
    let placed = 0;
    for (let attempt = 0; attempt < count * 18 && placed < count; attempt += 1) {
      const width = integer(minW, maxW);
      const height = integer(minH, maxH);
      const x = integer(2, FARM_WIDTH - width - 2);
      const y = integer(2, FARM_HEIGHT - height - 2);
      const cells = [];
      for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) cells.push([x + dx, y + dy]);
      const type = types?.[integer(0, types.length - 1)];
      if (place(cells, type ? 5 : integer(0, 3), type ? { x, y, width, height, type } : null)) placed += 1;
    }
  };
  rectangles(26, 3, 7, 3, 6); // Uneven pens with more room to dodge around them.
  rectangles(7, 4, 6, 4, 5, ['barn']);
  let fences = 0;
  for (let attempt = 0; attempt < 1800 && fences < 65; attempt += 1) {
    const x = integer(2, FARM_WIDTH - 12);
    const y = integer(2, FARM_HEIGHT - 12);
    const length = integer(3, 10);
    const bend = integer(0, 1) ? integer(2, 6) : 0;
    const vertical = integer(0, 1);
    const cells = [];
    for (let n = 0; n < length; n++) cells.push([x + (vertical ? 0 : n), y + (vertical ? n : 0)]);
    for (let n = 1; n <= bend; n++) cells.push([x + (vertical ? n : length - 1), y + (vertical ? length - 1 : n)]);
    if (place(cells, 4, null)) fences += 1;
  }
  rectangles(55, 1, 3, 1, 2, ['hay', 'crates', 'barrels', 'wagon']);
  return { grid, terrain, farmProps, obstacleTiles };
}

export function createThanksgivingWorld({ random = Math.random, inventory = {} } = {}) {
  const randomSource = typeof random === "function" ? random : Math.random;
  const { grid, terrain, farmProps, obstacleTiles } = generateFarmLayout(randomSource);
  const roads = [];
  for (let y = 0; y < FARM_HEIGHT; y += 1) {
    for (let x = 0; x < FARM_WIDTH; x += 1) if (grid[y][x] === 0) roads.push({ x: x + 0.5, y: y + 0.5 });
  }
  const world = {
    width: FARM_WIDTH, height: FARM_HEIGHT, grid, terrain, farmProps, obstacleTiles,
    player: null, farmer: null, cages: [], corn: [], pickups: [], freed: [],
    time: 0, rescued: 0, cornCollected: 0, caught: false,
    inventory: Object.fromEntries(POWER_IDS.map(id => [id, Math.min(99, Math.max(0, Math.floor(Number(inventory[id]) || 0)))])),
    effects: { speed: 0, mudSlow: 0, fenceSlip: 0, gust: 0 }, traps: [],
    message: "Free the turkeys. Gather corn for Hux. Keep moving!",
    _random: randomSource,
    _roads: roads, _nextId: 1, _path: [], _pathTarget: "", _pathUntil: 0,
    _spawnTimers: { cages: 0, corn: 0, pickups: 0 }, _messageUntil: 6,
  };
  world.player = { ...randomPosition(world), facing: 0, radius: PLAYER_RADIUS };
  world.farmer = { ...randomPosition(world, point => distance(point, world.player) >= 25), facing: 0, radius: FARMER_RADIUS };
  for (let index = 0; index < 16; index += 1) spawn(world, "cages");
  for (let index = 0; index < 120; index += 1) spawn(world, "corn");
  for (let index = 0; index < 8; index += 1) spawn(world, "pickups");
  return world;
}

function move(world, actor, dx, dy, radius, slip = false) {
  if (positionClear(world, actor.x + dx, actor.y, radius, slip)) actor.x += dx;
  if (positionClear(world, actor.x, actor.y + dy, radius, slip)) actor.y += dy;
  if (Math.abs(dx) + Math.abs(dy) > 0.00001) actor.facing = Math.atan2(dy, dx);
}

function findPath(world, from, to) {
  const width = world.width;
  const start = Math.floor(from.y) * width + Math.floor(from.x);
  const target = Math.floor(to.y) * width + Math.floor(to.x);
  const previous = new Int32Array(width * world.height).fill(-1);
  const queue = new Int32Array(previous.length);
  previous[start] = start;
  queue[0] = start;
  let tail = 1;
  for (let head = 0; head < tail && previous[target] === -1; head += 1) {
    const current = queue[head];
    const x = current % width;
    const y = Math.floor(current / width);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const next = ny * width + nx;
      if (world.grid[ny]?.[nx] !== 0 || previous[next] !== -1) continue;
      previous[next] = current;
      queue[tail++] = next;
    }
  }
  if (previous[target] === -1) return [];
  const path = [];
  for (let cursor = target; cursor !== start; cursor = previous[cursor]) {
    path.push({ x: cursor % width + 0.5, y: Math.floor(cursor / width) + 0.5 });
  }
  return path.reverse();
}

function updateFarmer(world, dt) {
  for (const trap of world.traps) {
    if (distance(trap, world.farmer) < 1.2 && clearSegment(world, trap, world.farmer)) {
      world.effects.mudSlow = 5;
      trap.remaining = 0;
    }
  }
  const target = positionClear(world, world.player.x, world.player.y, PLAYER_RADIUS) ? world.player : nearestRoad(world, world.player);
  let waypoint = target;
  if (!clearSegment(world, world.farmer, target, FARMER_RADIUS)) {
    const targetKey = `${Math.floor(target.x)},${Math.floor(target.y)}`;
    if (world._pathTarget !== targetKey || world.time >= world._pathUntil || !world._path.length) {
      world._path = findPath(world, world.farmer, target);
      world._pathTarget = targetKey;
      world._pathUntil = world.time + 0.5;
    }
    while (world._path.length > 1 && distance(world.farmer, world._path[0]) < 0.15) world._path.shift();
    // Skip visible waypoints, keeping the farmer at full speed around broad bends.
    let visibleIndex = 0;
    for (let index = 1; index < world._path.length; index += 1) {
      if (!clearSegment(world, world.farmer, world._path[index], FARMER_RADIUS)) break;
      visibleIndex = index;
    }
    if (visibleIndex) world._path.splice(0, visibleIndex);
    waypoint = world._path[0];
    if (!waypoint) return;
  } else {
    world._path = [];
  }
  const gap = distance(world.farmer, waypoint);
  if (gap < 0.001) return;
  const step = Math.min(gap, FARM_FARMER_SPEED * (world.effects.mudSlow > 0 ? 0.35 : 1) * dt);
  move(world, world.farmer, (waypoint.x - world.farmer.x) / gap * step, (waypoint.y - world.farmer.y) / gap * step, FARMER_RADIUS);
}

function nearestCage(world) {
  let nearest = null;
  let closest = RESCUE_DISTANCE;
  for (const cage of world.cages) {
    const gap = distance(world.player, cage);
    if (gap <= closest && clearSegment(world, world.player, cage)) {
      nearest = cage;
      closest = gap;
    }
  }
  return nearest;
}

function updateStep(world, dt, input) {
  world.time += dt;
  for (const id of Object.keys(world.effects)) world.effects[id] = Math.max(0, world.effects[id] - dt);
  world.traps = world.traps.filter(trap => (trap.remaining -= dt) > 0);
  // Return to the nearest open cell when a wire crossing expires.
  if (!world.effects.fenceSlip && !positionClear(world, world.player.x, world.player.y, PLAYER_RADIUS)) {
    Object.assign(world.player, nearestRoad(world, world.player));
  }
  if (world.time >= world._messageUntil) world.message = "";
  const x = Number.isFinite(input.x) ? input.x : 0;
  const y = Number.isFinite(input.y) ? input.y : 0;
  const magnitude = Math.max(1, Math.hypot(x, y));
  const speed = FARM_PLAYER_SPEED * (world.effects.speed > 0 ? 1.65 : 1);
  move(world, world.player, x / magnitude * speed * dt, y / magnitude * speed * dt, PLAYER_RADIUS, world.effects.fenceSlip > 0);
  updateFarmer(world, dt);
  if (distance(world.player, world.farmer) < 0.66
    && clearSegment(world, world.player, world.farmer)) {
    world.caught = true;
    setMessage(world, "Caught! Your rescued turkeys are safe and your Hux are kept.", Infinity);
    return;
  }
  world.corn = world.corn.filter(piece => {
    if (distance(world.player, piece) > 0.7) return true;
    world.cornCollected += 1;
    return false;
  });
  world.pickups = world.pickups.filter(pickup => {
    const power = FARM_POWERUPS.find(item => item.id === pickup.type);
    if (!power) return false;
    if (distance(world.player, pickup) > 0.8 || world.inventory[pickup.type] >= 99) return true;
    world.inventory[pickup.type] += 1;
    setMessage(world, `${power.name} found! Press ${power.key} to use it.`);
    return false;
  });
  const activeCage = input.rescue ? nearestCage(world) : null;
  for (const cage of world.cages) cage.progress = cage === activeCage ? Math.min(1, cage.progress + dt / FARM_RESCUE_SECONDS) : 0;
  if (activeCage?.progress >= 1 - 1e-9) {
    world.cages = world.cages.filter(cage => cage !== activeCage);
    world.rescued += 1;
    world.freed.push({ x: activeCage.x, y: activeCage.y, age: 0 });
    setMessage(world, "Turkey freed! Find the next cage.");
  }
  world.freed = world.freed.filter(turkey => (turkey.age += dt) < 2);
  for (const [kind, interval] of [["cages", 2.8], ["corn", 0.3], ["pickups", 4.5]]) {
    world._spawnTimers[kind] += dt;
    if (world._spawnTimers[kind] >= interval) {
      world._spawnTimers[kind] -= interval;
      spawn(world, kind);
    }
  }
}

export function updateThanksgivingWorld(world, dt, input = {}) {
  if (world.caught || !Number.isFinite(dt) || dt <= 0) return world;
  // Fixed-size substeps prevent fence tunnelling, including on slower devices.
  // A suspended tab cannot advance the chase by more than one second on return.
  let remaining = Math.min(dt, 1);
  while (remaining > 1e-8 && !world.caught) {
    const step = Math.min(remaining, 1 / 30);
    updateStep(world, step, input);
    remaining -= step;
  }
  return world;
}

export function activateThanksgivingPower(world, id) {
  if (world.caught || !POWER_IDS.includes(id) || !(world.inventory[id] > 0)) return false;
  if (id === "teleport") {
    const destination = randomPosition(world, point => distance(point, world.farmer) >= 22
      && distance(point, world.player) >= 14 && world.cages.every(cage => distance(point, cage) > 1));
    if (!destination) return false;
    world.player.x = destination.x;
    world.player.y = destination.y;
    world._path = [];
  } else if (id === "speed") world.effects.speed = 7;
  else if (id === "stun") {
    if (!positionClear(world, world.player.x, world.player.y, PLAYER_RADIUS)) { setMessage(world, "Step onto open ground to place a Mud Trap. Charge kept."); return false; }
    world.traps.push({ x: world.player.x, y: world.player.y, remaining: 14 });
    if (world.traps.length > 3) world.traps.shift();
  }
  else if (id === "camouflage") world.effects.fenceSlip = 5;
  else if (id === "decoy") {
    const gap = distance(world.player, world.farmer);
    if (gap > 10 || !clearSegment(world, world.player, world.farmer, FARMER_RADIUS)) { setMessage(world, "Feather Gust needs the farmer nearby on a clear path. Charge kept."); return false; }
    const angle = gap > 0.01 ? Math.atan2(world.farmer.y - world.player.y, world.farmer.x - world.player.x) : world.player.facing;
    const start = { ...world.farmer };
    for (let step = 0; step < 30; step++) {
      const x = world.farmer.x + Math.cos(angle) * 0.2;
      const y = world.farmer.y + Math.sin(angle) * 0.2;
      if (!positionClear(world, x, y, FARMER_RADIUS)) break;
      world.farmer.x = x; world.farmer.y = y;
    }
    if (distance(start, world.farmer) < 0.1) { setMessage(world, "No room to push the farmer. Feather Gust charge kept."); return false; }
    world.effects.gust = 0.7;
    world._path = [];
  }
  world.inventory[id] -= 1;
  setMessage(world, `${FARM_POWERUPS.find(power => power.id === id).name} activated!`);
  return true;
}

export function getThanksgivingSnapshot(world) {
  return {
    time: world.time, rescued: world.rescued, cornCollected: world.cornCollected,
    caught: world.caught, inventory: { ...world.inventory }, effects: { ...world.effects, stun: Math.max(0, ...world.traps.map(trap => trap.remaining)), camouflage: world.effects.fenceSlip, decoy: world.effects.gust },
    message: world.message, nearCage: Boolean(nearestCage(world)),
  };
}
