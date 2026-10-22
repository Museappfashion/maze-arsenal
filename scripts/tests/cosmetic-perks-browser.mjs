import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const url = process.env.GAME_TEST_URL || "http://127.0.0.1:5189/", origin = new URL(url).origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname));
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(url);
  await page.getByRole("heading", { name: "Update board", exact: true }).waitFor();
  const result = await page.evaluate(async () => {
    const { createWorld } = await import("/src/game/world-enhanced.js");
    const g = await import("/src/game/gameplay-2.0.js");
    const { WEAPONS } = await import("/src/config/weapons-enhanced.js");
    const { saveMizState } = await import("/src/services/mizEconomy.js");
    const { setCharacterCosmeticEquipped } = await import("/src/services/characterCosmetics.js");
    const { drawWorld } = await import("/src/game/rendering-2.0.js");
    saveMizState({ miz: 0, legacyTurkeyMigrated: true, cosmetics: { turkey: true, alien: true, shadowWisp: true, emberSpirit: true, crystalGuardian: true } });
    const make = (skin, level = "level0") => { setCharacterCosmeticEquipped(skin); const w = createWorld(level, "3d"); w.pickups = []; w.enemies = []; return w; };
    const collect = (w, type, amount) => { w.pickups = [{ id: 9999, x: w.player.x, y: w.player.y, type, amount }]; g.updatePickups(w, .016); };
    const data = { turkey: [], alien: [], wisp: [], crystal: [], ember: [] };
    for (const level of ["level0", "level1", "level2", "level3"]) {
      let w = make("turkey", level); w.player.ammo = 0; collect(w, "ammo", 20); data.turkey.push(w.player.ammo);
      w = make("alien", level); w.player.hp = 50; collect(w, "medkit", 20); data.alien.push(w.player.hp);
      w = make("shadowWisp", level); g.damagePlayer(w, 10); const boost = g.getPlayerSpeed(w) / w.player.speed; w.time = 2; const expired = g.getPlayerSpeed(w) / w.player.speed; data.wisp.push([boost, expired]);
      w = make("crystalGuardian", level); g.damagePlayer(w, 10); const first = w.player.hp; g.damagePlayer(w, 10); data.crystal.push([first, w.player.hp]);
      w = make("emberSpirit", level);
      for (let y = 1; y < 6; y++) for (let x = 1; x < 6; x++) w.grid[y][x] = 0;
      w.player.x = 2.5; w.player.y = 2.5; w.player.facing = 0;
      w.enemies = [{ id: 12345, kind: "skitter", color: "#facc15", palette: ["#facc15", "#fde047", "#f59e0b"], x: 3, y: 2.5, radius: .2, hp: 10000 }];
      for (let i = 0; i < 10; i++) { w.time = i * 2; w.player.nextAttackAt = 0; g.attack(w); }
      data.ember.push(10000 - w.enemies[0].hp - WEAPONS.fists.damage * 10);
      w.enemies = []; w.viewMode = "2d";
      const c = document.createElement("canvas"); c.width = 840; c.height = 720; drawWorld(c.getContext("2d"), w);
    }
    return data;
  });
  for (const value of result.turkey) assert.ok(Math.abs(value - 22) < 1e-9);
  for (const value of result.alien) assert.ok(Math.abs(value - 72) < 1e-9);
  for (const [boost, expired] of result.wisp) { assert.equal(boost, 1.15); assert.equal(expired, 1); }
  for (const values of result.crystal) assert.deepEqual(values, [95, 85]);
  for (const damage of result.ember) assert.equal(damage, 3);
  await page.locator(".first-page-myst-store-button").click();
  for (const label of ["Lucky Peck", "Alien Recovery", "Slip Away", "Ember Strike", "Crystal Shell"]) assert.ok(await page.getByText(label + ":", { exact: true }).isVisible());
  assert.deepEqual(errors, []);
  console.log("PASS: all five perks work through the actual game modules in all four combat mazes, 2D perk displays render, store descriptions match, and zero browser errors.");
} finally { await browser.close(); }
