import { useEffect, useRef } from "react";
import { CHARACTER_COSMETICS, TURKEY_COSMETIC_THEMES } from "../config/turkeyCosmetic.js";
import { drawCharacterCosmeticBody } from "../game/characterCosmetic.js";
import { buyCharacterCosmetic, setCharacterCosmeticEquipped } from "../services/characterCosmetics.js";
import { useCharacterCosmetics } from "./useCharacterCosmetics.js";
import "../styles/turkeyCosmetic.css";

function CharacterPreview({ theme, item }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, 96, 72); ctx.translate(48, 36);
    ctx.strokeStyle = `${theme.glow}90`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
    drawCharacterCosmeticBody(ctx, theme.key, 17, item.key);
  }, [theme, item]);
  const appearance = item.themeLabels?.[theme.key] ?? theme.headwear;
  return <div><canvas ref={canvasRef} width="192" height="144" role="img" aria-label={`${item.name}: ${appearance.toLowerCase()} appearance for ${theme.label}`} /><span>{appearance}</span></div>;
}

export function TurkeyCosmeticCard({ onMessage, variant = "farm", cosmetic = "turkey" }) {
  const wallet = useCharacterCosmetics();
  const item = CHARACTER_COSMETICS.find((entry) => entry.key === cosmetic);
  const currency = item.currency === "hux" ? "hux" : "MIZ";
  const balance = wallet[item.currency];
  const owned = wallet.cosmetics[item.key] === true;
  const equipped = wallet.equippedCharacter === item.key;
  const myst = variant === "myst";
  const action = () => onMessage((owned ? setCharacterCosmeticEquipped(equipped ? null : item.key) : buyCharacterCosmetic(item.key)).message);
  return <article className={`${myst ? "myst-store-item" : "farm-store-item"} turkey-cosmetic-card`} aria-label={`${item.name} cosmetic`}>
    <div className={myst ? "myst-item-row" : "farm-item-meta"}><span className={myst ? "myst-item-rarity" : "farm-eyebrow"}>Permanent character cosmetic</span><strong className={myst ? "myst-item-price" : ""}>{item.price.toLocaleString()} {currency}</strong></div>
    <h3 className={myst ? "myst-item-name" : ""}>{item.name}</h3>
    <div className="turkey-cosmetic-previews">{TURKEY_COSMETIC_THEMES.map((theme) => <CharacterPreview key={theme.key} theme={theme} item={item} />)}</div>
    <p className={myst ? "myst-item-description" : ""}>{item.description}</p>
    <p className={myst ? "myst-item-effect" : ""}><strong>{item.perk.label}:</strong> {item.perk.description}</p>
    <div className={myst ? "myst-item-owned" : "farm-item-meta"}>{owned ? equipped ? "Owned · equipped" : "Owned" : `${balance.toLocaleString()} ${currency} available · permanent unlock`}</div>
    <button type="button" className={myst ? "myst-item-buy" : "farm-button"} disabled={!owned && balance < item.price} onClick={action} aria-label={owned ? `${equipped ? "Unequip" : "Equip"} ${item.name}` : `Buy ${item.name} for ${item.price} ${currency}`}>
      {owned ? `${equipped ? "Unequip" : "Equip"} ${item.name}` : balance < item.price ? `Need ${item.price - balance} ${currency}` : `Buy cosmetic · ${item.price.toLocaleString()} ${currency}`}
    </button>
  </article>;
}
