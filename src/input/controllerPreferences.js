export const CONTROLLER_PREFERENCES_KEY = "mist-maze-controller-settings-v1";
export const DEFAULT_CONTROLLER_PREFERENCES = Object.freeze({ deadzone: .18, sensitivity: 1 });

export function normalizeControllerPreferences(value = {}) {
  return {
    deadzone: Number.isFinite(value?.deadzone) ? Math.max(.05, Math.min(.4, value.deadzone)) : .18,
    sensitivity: Number.isFinite(value?.sensitivity) ? Math.max(.25, Math.min(2, value.sensitivity)) : 1,
  };
}

export function loadControllerPreferences() {
  try { return normalizeControllerPreferences(JSON.parse(globalThis.localStorage?.getItem(CONTROLLER_PREFERENCES_KEY) || "null")); }
  catch { return { ...DEFAULT_CONTROLLER_PREFERENCES }; }
}

export function saveControllerPreferences(value) {
  const next = normalizeControllerPreferences(value);
  try { globalThis.localStorage?.setItem(CONTROLLER_PREFERENCES_KEY, JSON.stringify(next)); } catch { /* Keep the current session usable without storage. */ }
  return next;
}
