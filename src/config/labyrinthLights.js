// src/config/labyrinthLights.js
export const LABYRINTH_LIGHT_ORDER = [
  "candle",
  "glowstick",
  "flashlight",
  "lantern",
  "headlamp",
  "floodlight",
  "searchlight",
  "twinBeam",
  "prismLamp",
  "watchersLantern",
];

export const LABYRINTH_LIGHTS = {
  candle: {
    key: "candle",
    label: "Candle",
    mode: "circle",
    radius: 4.8,
    strength: 0.56,
    color: "#fbbf24",
    description: "A small warm halo that slightly expands your base light.",
  },
  glowstick: {
    key: "glowstick",
    label: "Glowstick",
    mode: "circle",
    radius: 5.4,
    strength: 0.64,
    color: "#4ade80",
    description: "A dim but broader circular glow.",
  },
  flashlight: {
    key: "flashlight",
    label: "Flashlight",
    mode: "beam",
    range: 11,
    cone: 0.3,
    strength: 0.82,
    color: "#f8fafc",
    description: "A long, concentrated beam straight ahead.",
  },
  lantern: {
    key: "lantern",
    label: "Lantern",
    mode: "circle",
    radius: 6.3,
    strength: 0.78,
    color: "#f59e0b",
    description: "A strong circle of light surrounding the player.",
  },
  headlamp: {
    key: "headlamp",
    label: "Headlamp",
    mode: "beam",
    range: 9.5,
    cone: 0.48,
    strength: 0.86,
    color: "#fde68a",
    description: "A medium-long beam with a wider forward view.",
  },
  floodlight: {
    key: "floodlight",
    label: "Floodlight",
    mode: "beam",
    range: 8,
    cone: 0.82,
    strength: 0.9,
    color: "#e0f2fe",
    description: "A short but very wide forward wash.",
  },
  searchlight: {
    key: "searchlight",
    label: "Searchlight",
    mode: "beam",
    range: 15,
    cone: 0.2,
    strength: 0.98,
    color: "#ffffff",
    description: "An extremely long, narrow scouting beam.",
  },
  twinBeam: {
    key: "twinBeam",
    label: "Twin Beam",
    mode: "twin",
    range: 10,
    cone: 0.34,
    strength: 0.92,
    color: "#bfdbfe",
    description: "Matching beams shine forward and behind.",
  },
  prismLamp: {
    key: "prismLamp",
    label: "Prism Lamp",
    mode: "prism",
    range: 9.5,
    cone: 0.3,
    spread: 0.58,
    strength: 0.95,
    color: "#c4b5fd",
    description: "Three medium beams cover forward, left, and right.",
  },
  watchersLantern: {
    key: "watchersLantern",
    label: "Watcher's Lantern",
    mode: "circle",
    radius: 8.5,
    strength: 1,
    color: "#fef3c7",
    description: "The broadest and strongest circular light.",
  },
};

export const LABYRINTH_LIGHT_HOTKEY_MAP = Object.fromEntries(
  LABYRINTH_LIGHT_ORDER.map((lightKey, index) => [
    index === 9 ? "0" : String(index + 1),
    lightKey,
  ]),
);

export function createOwnedLabyrinthLights() {
  return Object.fromEntries(
    LABYRINTH_LIGHT_ORDER.map((lightKey) => [lightKey, false]),
  );
}

export function getLabyrinthLight(world) {
  const key = world?.labyrinth?.equippedLight;
  return key ? LABYRINTH_LIGHTS[key] ?? null : null;
}

function beamStrength(distance, angleDelta, light) {
  if (distance > light.range || Math.abs(angleDelta) > light.cone) {
    return 0;
  }

  return light.strength;
}

function circleStrength(distance, light) {
  return distance <= light.radius ? light.strength : 0;
}

function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

export function getLabyrinthBaseLightStrength(world, x, y) {
  const player = world.player;
  const dx = x - player.x;
  const dy = y - player.y;
  const distance = Math.hypot(dx, dy);
  const facing = player.facing;
  const targetAngle = distance > 0 ? Math.atan2(dy, dx) : facing;
  const delta = normalizeAngle(targetAngle - facing);
  const radius = world.labyrinth.sightRadius;

  if (distance <= radius) {
    return 1;
  }

  const dot = Math.cos(delta);
  if (distance <= radius + 2.6 && dot > 0.88) {
    return 0.62;
  }

  if (distance <= radius + 1.2 && dot > 0.62) {
    return 0.28;
  }

  return 0;
}

export function getLabyrinthEquippedLightStrength(world, x, y) {
  const light = getLabyrinthLight(world);
  if (!light) {
    return 0;
  }

  const player = world.player;
  const dx = x - player.x;
  const dy = y - player.y;
  const distance = Math.hypot(dx, dy);
  const facing = player.facing;
  const targetAngle = distance > 0 ? Math.atan2(dy, dx) : facing;
  const delta = normalizeAngle(targetAngle - facing);

  if (light.mode === "circle") {
    return circleStrength(distance, light);
  }

  if (light.mode === "beam") {
    return beamStrength(distance, delta, light);
  }

  if (light.mode === "twin") {
    return Math.max(
      beamStrength(distance, delta, light),
      beamStrength(distance, normalizeAngle(delta - Math.PI), light),
    );
  }

  if (light.mode === "prism") {
    return Math.max(
      beamStrength(distance, delta, light),
      beamStrength(distance, normalizeAngle(delta - light.spread), light),
      beamStrength(distance, normalizeAngle(delta + light.spread), light),
    );
  }

  return 0;
}

export function getLabyrinthLightStrength(world, x, y) {
  return Math.max(
    getLabyrinthBaseLightStrength(world, x, y),
    getLabyrinthEquippedLightStrength(world, x, y),
  );
}
