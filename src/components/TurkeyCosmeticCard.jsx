import { useEffect, useRef } from "react";
import { CHARACTER_COSMETICS, TURKEY_COSMETIC_THEMES } from "../config/turkeyCosmetic.js";
import { COSMETIC_UPGRADE_PRICE, MAX_COSMETIC_UPGRADES, getCosmeticPerkDefinition } from "../config/cosmeticPerks.js";
import { drawCharacterCosmeticBody } from "../game/characterCosmetic.js";
import { buyCharacterCosmetic, setCharacterCosmeticEquipped, upgradeCharacterCosmetic } from "../services/characterCosmetics.js";
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
  const perk = getCosmeticPerkDefinition(item.key, wallet.cosmeticUpgrades?.[item.key] ?? 0);
  const upgradeLevel = perk.upgradeLevel;
  const maxUpgrades = upgradeLevel >= MAX_COSMETIC_UPGRADES;
  const nextPerk = maxUpgrades ? null : getCosmeticPerkDefinition(item.key, upgradeLevel + 1);
  const canUpgrade = owned && !maxUpgrades && wallet.miz >= COSMETIC_UPGRADE_PRICE;
  const myst = variant === "myst";
  const action = () => onMessage((owned ? setCharacterCosmeticEquipped(equipped ? null : item.key) : buyCharacterCosmetic(item.key)).message);
  const upgrade = () => onMessage(upgradeCharacterCosmetic(item.key).message);
  return <article className={`${myst ? "myst-store-item" : "farm-store-item"} turkey-cosmetic-card`} aria-label={`${item.name} cosmetic`}>
    <div className={myst ? "myst-item-row" : "farm-item-meta"}><span className={myst ? "myst-item-rarity" : "farm-eyebrow"}>Permanent character cosmetic</span><strong className={myst ? "myst-item-price" : ""}>{item.price.toLocaleString()} {currency}</strong></div>
    <h3 className={myst ? "myst-item-name" : ""}>{item.name}</h3>
    <div className="turkey-cosmetic-previews">{TURKEY_COSMETIC_THEMES.map((theme) => <CharacterPreview key={theme.key} theme={theme} item={item} />)}</div>
    <p className={myst ? "myst-item-description" : ""}>{item.description}</p>
    <div className={myst ? "myst-item-owned" : "farm-item-meta"}>{owned ? equipped ? "Owned · equipped" : "Owned" : `${balance.toLocaleString()} ${currency} available · permanent unlock`}</div>
    <button type="button" className={myst ? "myst-item-buy" : "farm-button"} disabled={!owned && balance < item.price} onClick={action} aria-label={owned ? `${equipped ? "Unequip" : "Equip"} ${item.name}` : `Buy ${item.name} for ${item.price} ${currency}`}>
      {owned ? `${equipped ? "Unequip" : "Equip"} ${item.name}` : balance < item.price ? `Need ${item.price - balance} ${currency}` : `Buy cosmetic · ${item.price.toLocaleString()} ${currency}`}
    </button>
    <section className="cosmetic-buff-upgrades" aria-label={`${item.name} buff upgrades`}>
      <h4>Skin buff upgrades · {upgradeLevel}/{MAX_COSMETIC_UPGRADES}</h4>
      <p className={`cosmetic-buff-current ${myst ? "myst-item-effect" : ""}`}>Current · <strong>{perk.label}:</strong> {perk.description}</p>
      <p className="cosmetic-buff-next">{nextPerk ? <><strong>Next · {upgradeLevel + 1}/{MAX_COSMETIC_UPGRADES}:</strong> {nextPerk.description}</> : <strong>Maximum buff reached · {MAX_COSMETIC_UPGRADES}/{MAX_COSMETIC_UPGRADES} upgrades.</strong>}</p>
      {!maxUpgrades && <p className="cosmetic-buff-balance">{!owned ? "Unlock this cosmetic to upgrade its buff." : `${wallet.miz.toLocaleString()} MIZ available${canUpgrade ? "" : ` · need ${(COSMETIC_UPGRADE_PRICE - wallet.miz).toLocaleString()} more`}`}</p>}
      <button type="button" className={`${myst ? "myst-item-buy" : "farm-button"} cosmetic-buff-upgrade`} disabled={!canUpgrade} onClick={upgrade} aria-label={maxUpgrades ? `${item.name} buff at maximum ${MAX_COSMETIC_UPGRADES} of ${MAX_COSMETIC_UPGRADES} upgrades` : `Upgrade ${item.name} buff to ${upgradeLevel + 1} of ${MAX_COSMETIC_UPGRADES} for ${COSMETIC_UPGRADE_PRICE} MIZ`}>
        {maxUpgrades ? `Maximum upgrades · ${MAX_COSMETIC_UPGRADES}/${MAX_COSMETIC_UPGRADES}` : `Upgrade buff · ${COSMETIC_UPGRADE_PRICE.toLocaleString()} MIZ`}
      </button>
      <p className="cosmetic-buff-scope">Buff upgrades apply in the four combat mazes, starting with your next maze.</p>
    </section>
  </article>;
}
