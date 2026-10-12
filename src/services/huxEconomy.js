import { FARM_POWERUPS } from "../config/thanksgiving.js";

export const HUX_STORAGE_KEY = "mist-maze-thanksgiving-hux-v1";
export const HUX_UPDATED_EVENT = "mist-maze-hux-updated";
const MAX_VALUE = 1_000_000_000;
let memoryState = null;
let lastObservedStorage = null;
let hasUnsavedChanges = false;

const whole = (value) => Math.min(MAX_VALUE, Math.max(0, Math.floor(Number(value) || 0)));

function normalize(state = {}) {
  return {
    hux: whole(state?.hux),
    bestRescued: whole(state?.bestRescued),
    totalRescued: whole(state?.totalRescued),
    inventory: Object.fromEntries(FARM_POWERUPS.map(({ id }) => [id, Math.min(99, whole(state?.inventory?.[id]))])),
  };
}

export function loadHuxState() {
  try {
    const storage = globalThis.localStorage;
    if (storage) {
      const saved = storage.getItem(HUX_STORAGE_KEY);
      // A quota/write failure must not erase this session's earnings on the
      // next wallet refresh. A genuinely changed saved value still wins.
      if (hasUnsavedChanges && saved === lastObservedStorage) return normalize(memoryState);
      try { memoryState = saved ? normalize(JSON.parse(saved)) : null; }
      catch { memoryState = null; }
      lastObservedStorage = saved;
      hasUnsavedChanges = false;
    }
  } catch { /* Keep the session wallet usable when browser storage is unavailable. */ }
  return normalize(memoryState);
}

function save(state) {
  memoryState = normalize(state);
  try {
    const storage = globalThis.localStorage;
    if (storage) {
      const serialized = JSON.stringify(memoryState);
      storage.setItem(HUX_STORAGE_KEY, serialized);
      lastObservedStorage = serialized;
      hasUnsavedChanges = false;
    } else hasUnsavedChanges = true;
  } catch { hasUnsavedChanges = true; }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(HUX_UPDATED_EVENT));
  return normalize(memoryState);
}

export function earnHux(amount) {
  const state = loadHuxState();
  return save({ ...state, hux: state.hux + whole(amount) });
}

export function saveFarmInventory(inventory) {
  return save({ ...loadHuxState(), inventory });
}

export function recordTurkeyRescues(amount, runTotal) {
  const state = loadHuxState();
  return save({ ...state, totalRescued: state.totalRescued + whole(amount), bestRescued: Math.max(state.bestRescued, whole(runTotal)) });
}

export function buyFarmSupply(id) {
  const item = FARM_POWERUPS.find((power) => power.id === id);
  const state = loadHuxState();
  if (!item) return { ok: false, message: "That supply is unavailable.", state };
  if (state.inventory[id] >= 99) return { ok: false, message: "Your bag is full for this supply.", state };
  if (state.hux < item.price) return { ok: false, message: `You need ${item.price - state.hux} more hux. Eat corn to earn it.`, state };
  const next = save({ ...state, hux: state.hux - item.price, inventory: { ...state.inventory, [id]: state.inventory[id] + 1 } });
  return { ok: true, message: `${item.name} added to your bag.`, state: next };
}
