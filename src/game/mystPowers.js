import { MAX_AMMO } from "../config/ammo.js";
import { activatePowerUp, givePlayerAmmo, healPlayer, setMessage } from "./gameplay.js";
import { consumeOneTimeItem, getConsumableCount, loadMizState, MYST_SHOP_ITEMS, recordWorldExploration, resetExplorationBaseline } from "../services/mizEconomy.js";

export function activateMystPower(world, key) {
  const item = MYST_SHOP_ITEMS.find((entry) => entry.key === key && entry.kind === "oneTime");
  const fail = (message) => ({ ok: false, message });
  if (!world?.player || world.labyrinthMode || world.victory || !item) return fail("This power is unavailable here.");
  if (world.gameOver && key !== "phoenixSpark") return fail("Use Phoenix Spark to revive first.");
  if (!world.gameOver && key === "phoenixSpark") return fail("Phoenix Spark is used after defeat.");
  if (key === "healPulse" && world.player.hp >= world.player.maxHp) return fail("Health is already full.");
  if (key === "ammoPulse" && world.player.ammo >= MAX_AMMO) return fail("Ammo is already full.");
  const targets = key === "purgeOrb" ? world.enemies.filter((enemy) => enemy.hp > 0 && enemy.kind !== "warden").sort((a, b) => Math.hypot(a.x - world.player.x, a.y - world.player.y) - Math.hypot(b.x - world.player.x, b.y - world.player.y)).slice(0, 8) : [];
  if (key === "purgeOrb" && !targets.length) return fail("No standard enemies remain.");
  if (key === "mapFlash" && world.player.discoveredFloor >= world.floorCount) return fail("The map is already revealed.");
  if (key === "arsenalKey" && ["fists", "crowbar", "machete", "pistol", "revolver", "smg", "shotgun", "rifle", "dmr"].every((weapon) => world.player.ownedWeapons[weapon])) return fail("The standard arsenal is already unlocked.");
  if (!getConsumableCount(key, loadMizState()) || !consumeOneTimeItem(key).consumed) return fail("No charges owned. Buy supplies in Myst's Store.");
  const power = (id, duration) => {
    const previous = world.player.powerUps[id]?.endsAt ?? 0;
    activatePowerUp(world, id);
    world.player.powerUps[id].endsAt = Math.max(previous, world.time + duration);
  };
  if (key === "healPulse") healPlayer(world, world.player.maxHp);
  else if (key === "ammoPulse") givePlayerAmmo(world, MAX_AMMO);
  else if (key === "nullPulse") { world.projectiles = world.projectiles.filter((p) => p.owner !== "enemy"); power("phaseWalk", 8); }
  else if (key === "velocityBloom") power("haste", 30);
  else if (key === "vitalBloom") power("shield", 30);
  else if (key === "mapFlash") {
    recordWorldExploration(world);
    world.discovered.fill(1); world.player.discoveredFloor = world.floorCount; world.minimapDirty = true;
    resetExplorationBaseline(world);
  } else if (key === "arsenalKey") {
    for (const weapon of ["fists", "crowbar", "machete", "pistol", "revolver", "smg", "shotgun", "rifle", "dmr"]) world.player.ownedWeapons[weapon] = true;
  } else if (key === "purgeOrb") for (const enemy of targets) enemy.hp = 0;
  else if (key === "phoenixSpark") {
    world.gameOver = false; world.player.hp = Math.max(1, Math.round(world.player.maxHp * .5));
    world.leaderboardEligible = false; world.projectiles = world.projectiles.filter((p) => p.owner !== "enemy"); power("phaseWalk", 8);
  } else if (key === "exitFold") {
    world.player.x = world.exit.x + .5; world.player.y = world.exit.y + .5;
    world.distanceFieldDirty = true; world.leaderboardEligible = false;
  }
  const message = `${item.name} activated${["phoenixSpark", "exitFold"].includes(key) ? " · run unranked" : ""}`;
  setMessage(world, message, 2.5);
  return { ok: true, message };
}
