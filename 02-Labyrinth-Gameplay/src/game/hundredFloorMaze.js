import { sanitizePlayerName } from "../utils/player.js";

export const HUNDRED_FLOOR_SIZE = 100;
export const HUNDRED_FLOOR_COUNT = 100;
const SAVE_VERSION = 1;
const WALK = 0;
const WALL = 1;
const THEMES = [
  { name: "Abandoned City", floor: "#152234", wall: "#334155", trim: "#475569", accent: "#67e8f9" },
  { name: "Orbital Ruins", floor: "#18132d", wall: "#473b60", trim: "#65547d", accent: "#c4b5fd" },
  { name: "Emerald Wilds", floor: "#10251f", wall: "#275542", trim: "#38735b", accent: "#86efac" },
  { name: "Fallen Keep", floor: "#252032", wall: "#4a4159", trim: "#685d78", accent: "#f0abfc" },
];

function randomSource(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function hundredFloorSaveKey(playerName) {
  const normalized = sanitizePlayerName(playerName).toLowerCase();
  return `mist-maze-hundred-floors-v1:${normalized ? `player:${encodeURIComponent(normalized)}` : "anonymous"}`;
}

export function floorIndex(x, y) { return y * HUNDRED_FLOOR_SIZE + x; }

export function isHundredFloorOpen(world, x, y) {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  return tileX >= 0 && tileY >= 0 && tileX < world.width && tileY < world.height && world.grid[floorIndex(tileX, tileY)] === WALK;
}

function neighbors(index) {
  const x = index % HUNDRED_FLOOR_SIZE;
  const y = Math.floor(index / HUNDRED_FLOOR_SIZE);
  const result = [];
  if (x > 0) result.push(index - 1);
  if (x < HUNDRED_FLOOR_SIZE - 1) result.push(index + 1);
  if (y > 0) result.push(index - HUNDRED_FLOOR_SIZE);
  if (y < HUNDRED_FLOOR_SIZE - 1) result.push(index + HUNDRED_FLOOR_SIZE);
  return result;
}

function distancesFrom(grid, start) {
  const distances = new Int32Array(grid.length).fill(-1);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 1;
  queue[0] = start;
  distances[start] = 0;
  while (head < tail) {
    const current = queue[head++];
    for (const next of neighbors(current)) {
      if (grid[next] !== WALK || distances[next] >= 0) continue;
      distances[next] = distances[current] + 1;
      queue[tail++] = next;
    }
  }
  return { distances, farthest: queue[tail - 1] };
}

export function createHundredFloor(seed, floor = 1) {
  const safeFloor = Math.max(1, Math.min(HUNDRED_FLOOR_COUNT, Math.trunc(Number(floor)) || 1));
  const random = randomSource((seed >>> 0) ^ Math.imul(safeFloor, 0x9E3779B1));
  const width = HUNDRED_FLOOR_SIZE;
  const grid = new Uint8Array(width * width).fill(WALL);
  const stack = [floorIndex(1, 1)];
  grid[stack[0]] = WALK;
  // Carve one connected spanning tree, then add loops and small rooms.
  while (stack.length) {
    const current = stack[stack.length - 1];
    const x = current % width;
    const y = Math.floor(current / width);
    const candidates = [[x - 2, y], [x + 2, y], [x, y - 2], [x, y + 2]].filter(([nx, ny]) => nx > 0 && ny > 0 && nx < width - 1 && ny < width - 1 && grid[floorIndex(nx, ny)] === WALL);
    if (!candidates.length) { stack.pop(); continue; }
    const [nx, ny] = candidates[Math.floor(random() * candidates.length)];
    grid[floorIndex((x + nx) / 2, (y + ny) / 2)] = WALK;
    grid[floorIndex(nx, ny)] = WALK;
    stack.push(floorIndex(nx, ny));
  }
  for (let count = 0; count < 180; count++) {
    const x = 2 + Math.floor(random() * 95);
    const y = 2 + Math.floor(random() * 95);
    if ((grid[floorIndex(x - 1, y)] === WALK && grid[floorIndex(x + 1, y)] === WALK) || (grid[floorIndex(x, y - 1)] === WALK && grid[floorIndex(x, y + 1)] === WALK)) grid[floorIndex(x, y)] = WALK;
  }
  for (let count = 0; count < 16; count++) {
    const x = 3 + 2 * Math.floor(random() * 46);
    const y = 3 + 2 * Math.floor(random() * 46);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) grid[floorIndex(x + dx, y + dy)] = WALK;
  }
  const start = { x: 1.5, y: 1.5 };
  const startDistances = distancesFrom(grid, floorIndex(1, 1));
  const stairIndex = startDistances.farthest;
  const stairs = { x: stairIndex % width + .5, y: Math.floor(stairIndex / width) + .5 };
  const route = distancesFrom(grid, stairIndex).distances;
  const pickupTiles = [];
  for (let index = 0; index < grid.length; index++) if (grid[index] === WALK && startDistances.distances[index] > 6 && index !== stairIndex) pickupTiles.push(index);
  for (let index = pickupTiles.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [pickupTiles[index], pickupTiles[other]] = [pickupTiles[other], pickupTiles[index]];
  }
  const pickups = pickupTiles.slice(0, 72).map((index, i) => ({ index, x: index % width + .5, y: Math.floor(index / width) + .5, type: i % 3 === 0 ? "sonar" : "haste" }));
  return { width, height: width, grid, floor: safeFloor, start, stairs, route, pickups, theme: THEMES[(safeFloor - 1) % THEMES.length] };
}

export function createHundredFloorRun(seed = Math.floor(Math.random() * 0xFFFFFFFF)) {
  return { ...createHundredFloor(seed), seed: seed >>> 0, player: { x: 1.5, y: 1.5 }, explored: new Uint8Array(HUNDRED_FLOOR_SIZE ** 2), collected: new Set(), elapsed: 0, completed: false, haste: 0, sonar: 0, compass: 0, compassCooldown: 0, moves: 0, message: "Find the glowing stairs. Each staircase saves your next floor.", messageTime: 6 };
}

function revealNearby(world) {
  const px = Math.floor(world.player.x);
  const py = Math.floor(world.player.y);
  for (let y = Math.max(0, py - 7); y <= Math.min(world.height - 1, py + 7); y++) {
    for (let x = Math.max(0, px - 7); x <= Math.min(world.width - 1, px + 7); x++) {
      if ((x - px) ** 2 + (y - py) ** 2 <= 49) world.explored[floorIndex(x, y)] = 1;
    }
  }
}

function canOccupy(world, x, y) {
  const radius = .2;
  return isHundredFloorOpen(world, x - radius, y - radius) && isHundredFloorOpen(world, x + radius, y - radius) && isHundredFloorOpen(world, x - radius, y + radius) && isHundredFloorOpen(world, x + radius, y + radius);
}

export function updateHundredFloorRun(world, elapsed, input = {}) {
  if (world.completed) return;
  const dt = Math.max(0, Math.min(.05, Number(elapsed) || 0));
  world.elapsed += dt;
  for (const key of ["haste", "sonar", "compass", "compassCooldown", "messageTime"]) world[key] = Math.max(0, world[key] - dt);
  const rawX = Number(input.x) || 0;
  const rawY = Number(input.y) || 0;
  const magnitude = Math.max(1, Math.hypot(rawX, rawY));
  const speed = world.haste > 0 ? 7 : 4.5;
  const dx = rawX / magnitude * speed * dt;
  const dy = rawY / magnitude * speed * dt;
  // Short substeps keep narrow corridors solid even during Haste.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / .12));
  for (let step = 0; step < steps; step++) {
    if (canOccupy(world, world.player.x + dx / steps, world.player.y)) world.player.x += dx / steps;
    if (canOccupy(world, world.player.x, world.player.y + dy / steps)) world.player.y += dy / steps;
  }
  world.moves += Math.hypot(dx, dy);
  revealNearby(world);
  for (const pickup of world.pickups) {
    if (world.collected.has(pickup.index) || Math.hypot(world.player.x - pickup.x, world.player.y - pickup.y) > .6) continue;
    world.collected.add(pickup.index);
    if (pickup.type === "haste") {
      world.haste = Math.max(world.haste, 14);
      world.message = "Haste · faster movement for 14 seconds.";
    } else {
      world.sonar = Math.max(world.sonar, 18);
      world.message = "Sonar · full map and a route toward the stairs for 18 seconds.";
    }
    world.messageTime = 4;
  }
}

export function activateHundredFloorCompass(world) {
  if (world.completed || world.compassCooldown > 0) return false;
  world.compass = 10;
  world.compassCooldown = 30;
  world.message = "Compass · follow the cyan trail toward the stairs.";
  world.messageTime = 4;
  return true;
}

export function nearHundredFloorStairs(world) { return Math.hypot(world.player.x - world.stairs.x, world.player.y - world.stairs.y) < .9; }

export function ascendHundredFloor(world) {
  if (world.completed || !nearHundredFloorStairs(world)) return false;
  if (world.floor === HUNDRED_FLOOR_COUNT) {
    world.completed = true;
    world.message = "The summit is yours. All 100 floors cleared!";
    return true;
  }
  Object.assign(world, createHundredFloor(world.seed, world.floor + 1));
  world.player = { ...world.start };
  world.explored = new Uint8Array(HUNDRED_FLOOR_SIZE ** 2);
  world.collected = new Set();
  world.haste = 0;
  world.sonar = 0;
  world.compass = 0;
  world.compassCooldown = 0;
  world.message = `Floor ${world.floor} · ${world.theme.name}. Checkpoint reached.`;
  world.messageTime = 5;
  revealNearby(world);
  return true;
}

export function hundredFloorHintRoute(world, length = 40) {
  let current = floorIndex(Math.floor(world.player.x), Math.floor(world.player.y));
  const path = [current];
  for (let count = 0; count < length && world.route[current] > 0; count++) {
    const next = neighbors(current).find((index) => world.route[index] >= 0 && world.route[index] < world.route[current]);
    if (next === undefined) break;
    path.push(next);
    current = next;
  }
  return path;
}

export function serializeHundredFloorRun(world) {
  return JSON.stringify({ version: SAVE_VERSION, seed: world.seed, floor: world.floor, player: world.player, explored: Array.from(world.explored).map((value, index) => value ? index : -1).filter((index) => index >= 0), collected: [...world.collected], elapsed: world.elapsed, completed: world.completed, haste: world.haste, sonar: world.sonar, compass: world.compass, compassCooldown: world.compassCooldown, moves: world.moves });
}

export function restoreHundredFloorRun(serialized) {
  try {
    const saved = JSON.parse(serialized);
    if (!saved || saved.version !== SAVE_VERSION || !Number.isInteger(saved.seed) || saved.seed < 0 || saved.seed > 0xFFFFFFFF || !Number.isInteger(saved.floor) || saved.floor < 1 || saved.floor > HUNDRED_FLOOR_COUNT) return null;
    const world = createHundredFloorRun(saved.seed);
    Object.assign(world, createHundredFloor(saved.seed, saved.floor));
    if (saved.player && Number.isFinite(saved.player.x) && Number.isFinite(saved.player.y) && canOccupy(world, saved.player.x, saved.player.y)) world.player = { x: saved.player.x, y: saved.player.y };
    for (const index of Array.isArray(saved.explored) ? saved.explored : []) if (Number.isInteger(index) && index >= 0 && index < world.explored.length) world.explored[index] = 1;
    const pickupIds = new Set(world.pickups.map((pickup) => pickup.index));
    world.collected = new Set((Array.isArray(saved.collected) ? saved.collected : []).filter((index) => pickupIds.has(index)));
    for (const key of ["elapsed", "moves"]) world[key] = Number.isFinite(saved[key]) ? Math.max(0, saved[key]) : 0;
    for (const key of ["haste", "sonar", "compass", "compassCooldown"]) world[key] = Number.isFinite(saved[key]) ? Math.max(0, Math.min(30, saved[key])) : 0;
    world.completed = saved.completed === true && saved.floor === HUNDRED_FLOOR_COUNT && nearHundredFloorStairs(world);
    world.message = world.completed ? "The summit is yours. All 100 floors cleared!" : `Welcome back. Floor ${world.floor} is ready.`;
    world.messageTime = 5;
    revealNearby(world);
    return world;
  } catch { return null; }
}

export function loadHundredFloorRun(playerName, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    return restoreHundredFloorRun(target?.getItem(hundredFloorSaveKey(playerName))) || createHundredFloorRun();
  }
  catch { return createHundredFloorRun(); }
}

export function saveHundredFloorRun(playerName, world, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(hundredFloorSaveKey(playerName), serializeHundredFloorRun(world));
    return Boolean(target);
  }
  catch { return false; }
}
