// src/config/legendaryPowerUps.js
export const LEGENDARY_PICKUP_COUNT = 2;
export const LEGENDARY_GOLD = "#facc15";
export const LEGENDARY_WHITE = "#fff7d6";

export function isLegendaryPowerUpActive(world, key) {
  const state = world?.player?.powerUps?.[key];

  return Boolean(
    state?.legendary &&
      (state.endsAt ?? -Infinity) > world.time,
  );
}

export function markLegendaryPowerUps(world) {
  if (world?.labyrinthMode) {
    return [];
  }

  const powerUps = (world.pickups ?? []).filter(
    (pickup) => pickup.type === "powerup",
  );

  for (const pickup of powerUps) {
    pickup.legendary = false;
  }

  const pool = [...powerUps];
  const selected = [];

  while (
    pool.length &&
    selected.length < LEGENDARY_PICKUP_COUNT
  ) {
    const index = Math.floor(Math.random() * pool.length);
    const [pickup] = pool.splice(index, 1);

    pickup.legendary = true;
    selected.push(pickup);
  }

  return selected;
}
