// The Keep presents these normal ranged weapons as bows. Special weapons keep
// their own projectiles and animation even when carried into a medieval maze.
const ARCHERY_WEAPONS = new Set([
  "pistol", "revolver", "smg", "shotgun", "rifle", "dmr",
]);

export const WALL_ARROW_LIFETIME = 1;

export function isMedievalArcheryWeapon(world, weaponKey = world?.player?.weapon) {
  return world?.level?.themeKey === "medieval" && ARCHERY_WEAPONS.has(weaponKey);
}

export function getBowDrawProgress(world, weaponKey = world?.player?.weapon) {
  const shot = world?.player?.bowShot;
  if (!shot || shot.weaponKey !== weaponKey) return 1;
  return Math.max(0, Math.min(1,
    ((world.time ?? 0) - shot.startedAt) / Math.max(0.08, shot.duration),
  ));
}
