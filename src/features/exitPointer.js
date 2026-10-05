export const POINTER_DIRECTION_COUNT = 16;
export const POINTER_DIRECTION_STEP = Math.PI * 2 / POINTER_DIRECTION_COUNT;

// A small boundary margin prevents tiny movement from toggling adjacent lights.
const BOUNDARY_MARGIN = Math.PI / 90;

export function getExitPointerDirection(world, previousIndex = null) {
  const player = world?.player;
  const exit = world?.exit;

  if (
    !Number.isFinite(player?.x) || !Number.isFinite(player?.y) ||
    !Number.isFinite(exit?.x) || !Number.isFinite(exit?.y)
  ) {
    return null;
  }

  const dx = exit.x + 0.5 - player.x;
  const dy = exit.y + 0.5 - player.y;
  if (Math.hypot(dx, dy) < 0.001) return null;

  const bearing = Math.atan2(dy, dx);
  // 2D follows the north-up maze. In 3D, straight ahead is the top light;
  // turning the camera changes the indicated direction relative to the player.
  const angle = world.viewMode === "3d"
    ? bearing - (Number.isFinite(player.facing) ? player.facing : 0) - Math.PI / 2
    : bearing;

  if (Number.isInteger(previousIndex) && previousIndex >= 0 && previousIndex < POINTER_DIRECTION_COUNT) {
    const delta = angle - previousIndex * POINTER_DIRECTION_STEP;
    const distance = Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
    if (distance <= POINTER_DIRECTION_STEP / 2 + BOUNDARY_MARGIN) {
      return previousIndex;
    }
  }

  return ((Math.round(angle / POINTER_DIRECTION_STEP) % POINTER_DIRECTION_COUNT) +
    POINTER_DIRECTION_COUNT) % POINTER_DIRECTION_COUNT;
}
