import { useEffect, useState } from "react";
import { HUX_STORAGE_KEY, HUX_UPDATED_EVENT, loadHuxState } from "../services/huxEconomy.js";

export function useHuxWallet() {
  const [wallet, setWallet] = useState(loadHuxState);
  useEffect(() => {
    const refresh = () => setWallet(loadHuxState());
    const storage = (event) => { if (event.key === HUX_STORAGE_KEY || event.key === null) refresh(); };
    window.addEventListener(HUX_UPDATED_EVENT, refresh);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(HUX_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return wallet;
}
