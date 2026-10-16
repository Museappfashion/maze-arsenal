import { useEffect, useState } from "react";
import { MIZ_STATE_CHANGED_EVENT, MYST_SHOP_ITEMS, loadMizState, getConsumableCount } from "../services/mizEconomy.js";
import { activateMystPower } from "../game/mystPowers.js";

export function MystPowersPanel({ world, onUse }) {
  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState(loadMizState);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const refresh = () => setWallet(loadMizState());
    window.addEventListener(MIZ_STATE_CHANGED_EVENT, refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(MIZ_STATE_CHANGED_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  if (world.labyrinthMode) return null;
  const powers = MYST_SHOP_ITEMS.filter((item) => item.kind === "oneTime");
  const count = powers.reduce((sum, item) => sum + getConsumableCount(item.key, wallet), 0);
  const visiblePowers = world.gameOver ? powers.filter((item) => item.key === "phoenixSpark") : powers;
  return <div className="myst-powers-control" style={{ zIndex: world.gameOver ? 110 : 40 }} onKeyDown={(event) => {
    if (open || [" ", "Enter"].includes(event.key)) event.stopPropagation();
    if (open && event.key === "Escape") setOpen(false);
  }}>
    <style>{`
      .myst-powers-control { position: absolute; left: 12px; top: 112px; z-index: 40; max-width: calc(100% - 24px); }
      .myst-powers-toggle { border: 1px solid #8b7ba2; border-radius: 10px; background: #292436ed; color: #e9ddf7; padding: 9px 12px; font: 800 11px system-ui,sans-serif; cursor: pointer; }
      .myst-powers-panel { width: min(330px, calc(100vw - 48px)); padding: 12px; margin-top: 8px; border: 1px solid #61516f; border-radius: 12px; background: #151220f5; color: #e2dcec; box-shadow: 0 12px 32px #0008; max-height: min(390px, 55vh); overflow: auto; }
      .myst-powers-panel header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
      .myst-powers-panel button { font: inherit; cursor: pointer; }
      .myst-power-use { width: 100%; display: flex; gap: 12px; justify-content: space-between; text-align: left; padding: 10px; margin: 6px 0; border-radius: 8px; border: 1px solid #61516f; background: #292436; color: #ede5f5; font-size: 12px !important; }
      .myst-power-use:disabled { opacity: .45; cursor: default; }
      .myst-power-use small { display: block; font-size: 10px; margin-top: 4px; line-height: 1.5; color: #c4b7d5; }
      .myst-powers-message { margin: 10px 0 0; font-size: 11px; line-height: 1.5; color: #d2c1e0; }
      .touch-mobile .myst-powers-control { top: 72px; }
    `}</style>
    <button type="button" className="myst-powers-toggle" aria-expanded={open} onClick={() => { document.exitPointerLock?.(); setOpen(!open); }}>MYST POWERS · {count}</button>
    {open && <section className="myst-powers-panel" aria-label="Myst Powers">
      <header><strong>Myst Powers</strong><button type="button" className="myst-powers-toggle" onClick={() => setOpen(false)}>Close</button></header>
      {visiblePowers.map((item) => <button type="button" className="myst-power-use" key={item.key} disabled={!getConsumableCount(item.key, wallet) || world.victory || (world.gameOver ? item.key !== "phoenixSpark" : item.key === "phoenixSpark")} onClick={() => { setMessage(activateMystPower(world, item.key).message); onUse(); }}><span>{item.name}<small>{item.effectLabel.replace("Activate in-game · ", "").replace("Activate after defeat · ", "")}</small></span><strong>×{getConsumableCount(item.key, wallet)}</strong></button>)}
      <p className="myst-powers-message" role="status">{message || "Powers are spent only when they can help. Exit Fold and revival make the run unranked."}</p>
    </section>}
  </div>;
}
