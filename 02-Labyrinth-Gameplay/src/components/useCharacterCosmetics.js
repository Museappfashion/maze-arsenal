import { useEffect, useState } from "react";
import { loadCharacterCosmeticState } from "../services/characterCosmetics.js";
import { HUX_UPDATED_EVENT } from "../services/huxEconomy.js";
import { MIZ_STATE_CHANGED_EVENT } from "../services/mizEconomy.js";

export function useCharacterCosmetics() {
  const [state, setState] = useState(loadCharacterCosmeticState);
  useEffect(() => {
    const refresh = () => setState(loadCharacterCosmeticState());
    window.addEventListener(MIZ_STATE_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener(HUX_UPDATED_EVENT, refresh);
    return () => { window.removeEventListener(HUX_UPDATED_EVENT, refresh); window.removeEventListener(MIZ_STATE_CHANGED_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  return state;
}
