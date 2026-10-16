import { CHARACTER_COSMETICS, TURKEY_COSMETIC_THEMES } from "../config/turkeyCosmetic.js";
import { loadMizState, purchaseMystItem, saveMizState } from "./mizEconomy.js";
import { buyTurkeyCosmetic, loadHuxState } from "./huxEconomy.js";

export function loadCharacterCosmeticState() {
  const wallet = loadHuxState();
  let state = loadMizState();
  const owned = wallet.cosmetics.turkey === true;
  if (!state.legacyTurkeyMigrated || (owned && !state.cosmetics.turkey)) {
    state = saveMizState({
      ...state,
      cosmetics: { ...state.cosmetics, ...(owned ? { turkey: true } : {}) },
      equippedCharacter: state.equippedCharacter || (!state.legacyTurkeyMigrated && owned && wallet.equippedCosmetic === "turkey" ? "turkey" : null),
      legacyTurkeyMigrated: true,
    }, { reason: "character-migration" });
  }
  return { ...state, hux: wallet.hux };
}

export function buyCharacterCosmetic(key) {
  const state = loadCharacterCosmeticState();
  const item = CHARACTER_COSMETICS.find((entry) => entry.key === key);
  if (!item) return { ok: false, message: "Character unavailable." };
  if (state.cosmetics[key]) return { ok: false, message: "Already owned.", state };
  const result = item.currency === "hux" ? buyTurkeyCosmetic() : purchaseMystItem(key);
  if (!result.ok) return { ...result, message: result.message || result.error };
  const next = saveMizState({ ...loadMizState(), cosmetics: { ...loadMizState().cosmetics, [key]: true }, equippedCharacter: key });
  return { ok: true, state: { ...next, hux: loadHuxState().hux }, message: `${item.name} unlocked and equipped!` };
}

export function setCharacterCosmeticEquipped(key) {
  const state = loadCharacterCosmeticState();
  if (key !== null && (!CHARACTER_COSMETICS.some((item) => item.key === key) || state.cosmetics[key] !== true)) return { ok: false, message: "Unlock this character first.", state };
  return { ok: true, state: saveMizState({ ...state, equippedCharacter: key }), message: key ? "Character equipped for your next maze." : "Original character equipped for your next maze." };
}

export function getPlayerCosmeticForTheme(themeKey, state = loadCharacterCosmeticState()) {
  return TURKEY_COSMETIC_THEMES.some((theme) => theme.key === themeKey)
    && CHARACTER_COSMETICS.some((item) => item.key === state.equippedCharacter && state.cosmetics?.[item.key] === true) ? state.equippedCharacter : null;
}
