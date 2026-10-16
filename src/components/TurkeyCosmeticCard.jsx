import { useEffect, useRef } from "react";
import { TURKEY_COSMETIC, TURKEY_COSMETIC_THEMES } from "../config/turkeyCosmetic.js";
import { drawTurkeyCosmeticBody } from "../game/turkeyCosmetic.js";
import { buyTurkeyCosmetic, setTurkeyCosmeticEquipped } from "../services/huxEconomy.js";
import "../styles/turkeyCosmetic.css";

function TurkeyPreview({ theme }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, 96, 72);
    ctx.translate(48, 36);
    ctx.strokeStyle = `${theme.glow}90`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    drawTurkeyCosmeticBody(ctx, theme.key, 17);
  }, [theme]);
  return <div><canvas ref={canvasRef} width="192" height="144" role="img" aria-label={`Full turkey with ${theme.headwear.toLowerCase()} for ${theme.label}`} /><span>{theme.headwear}</span></div>;
}

export function TurkeyCosmeticCard({ wallet, onMessage, variant = "farm" }) {
  const owned = wallet.cosmetics.turkey === true;
  const equipped = wallet.equippedCosmetic === "turkey";
  const myst = variant === "myst";
  const handleAction = () => {
    const result = owned ? setTurkeyCosmeticEquipped(!equipped) : buyTurkeyCosmetic();
    onMessage(result.message);
  };
  return (
    <article className={`${myst ? "myst-store-item" : "farm-store-item"} turkey-cosmetic-card`} aria-label="Turkey Disguise cosmetic">
      <div className={myst ? "myst-item-row" : "farm-item-meta"}>
        <span className={myst ? "myst-item-rarity" : "farm-eyebrow"}>Permanent character cosmetic</span>
        <strong className={myst ? "myst-item-price" : ""}>{TURKEY_COSMETIC.price.toLocaleString()} hux</strong>
      </div>
      <h3 className={myst ? "myst-item-name" : ""}>{TURKEY_COSMETIC.name}</h3>
      <div className="turkey-cosmetic-previews">{TURKEY_COSMETIC_THEMES.map((theme) => <TurkeyPreview key={theme.key} theme={theme} />)}</div>
      <p className={myst ? "myst-item-description" : ""}>{TURKEY_COSMETIC.description}</p>
      <div className={myst ? "myst-item-owned" : "farm-item-meta"}>{owned ? equipped ? "Owned · equipped" : "Owned · original character equipped" : "One purchase unlocks all three looks permanently."}</div>
      <button type="button" className={myst ? "myst-item-buy" : "farm-button"} disabled={!owned && wallet.hux < TURKEY_COSMETIC.price} onClick={handleAction} aria-label={owned ? equipped ? "Unequip Turkey Disguise" : "Equip Turkey Disguise" : "Buy Turkey Disguise for 1000 hux"}>
        {owned ? equipped ? "Unequip turkey" : "Equip turkey" : wallet.hux < TURKEY_COSMETIC.price ? `Need ${TURKEY_COSMETIC.price - wallet.hux} hux` : "Buy cosmetic · 1,000 hux"}
      </button>
    </article>
  );
}
