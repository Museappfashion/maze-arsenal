import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const baseUrl = process.env.GAME_TEST_URL || "http://127.0.0.1:5189/";
const origin = new URL(baseUrl).origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname));
const out = process.env.GAME_SCREENSHOT_DIR;
if (out) await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-10-16T12:00:00Z"));
  await page.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(baseUrl);
  await page.getByRole("heading", { name: "Update board", exact: true }).waitFor();
  assert.equal(await page.locator(".update-notice-board li").count(), 8);
  if (out) await page.screenshot({ path: `${out}/notice-board.png` });
  await page.evaluate(async () => {
    const { saveMizState } = await import("/src/services/mizEconomy.js");
    (await import("/src/services/huxEconomy.js")).earnHux(1000);
    saveMizState({ miz: 50000, cosmetics: {}, consumables: {}, equippedCharacter: null, legacyTurkeyMigrated: true });
  });
  await page.locator(".first-page-myst-store-button").click();
  await page.getByRole("button", { name: "Buy Turkey Disguise for 1000 hux", exact: true }).click();
  await page.getByRole("button", { name: "Buy Blobby Alien for 10000 MIZ", exact: true }).click();
  await page.getByRole("button", { name: "Unequip Blobby Alien", exact: true }).waitFor();
  assert.equal(await page.evaluate(async () => (await import("/src/services/mizEconomy.js")).loadMizState().miz), 40000);
  for (const [name, price, key] of [["Shadow Wisp", 3500, "shadowWisp"], ["Ember Spirit", 6000, "emberSpirit"], ["Crystal Guardian", 8000, "crystalGuardian"]]) {
    await page.getByRole("button", { name: `Buy ${name} for ${price} MIZ`, exact: true }).click();
    await page.getByRole("button", { name: `Unequip ${name}`, exact: true }).waitFor();
    assert.equal(await page.evaluate(async (key) => (await import("/src/services/characterCosmetics.js")).loadCharacterCosmeticState().equippedCharacter, key), key);
  }
  await page.getByRole("button", { name: "Equip Blobby Alien", exact: true }).click();
  assert.equal(await page.locator(".myst-store-shell").getByText("Null Pulse", { exact: true }).count(), 0);
  assert.equal(await page.locator(".myst-store-shell").getByText("Mist Guard", { exact: true }).count(), 1);
  for (const name of ["Mist Guard", "Ammo Refill", "Vital Restore", "Phoenix Spark"]) {
    await page.locator(".myst-store-item").filter({ has: page.locator(".myst-item-name", { hasText: name }) }).getByRole("button", { name: "Buy one", exact: true }).click();
  }
  if (out) await page.locator(".myst-store-shell").screenshot({ path: `${out}/miz-store.png` });
  await page.locator(".first-page-myst-store-button").click();
  await page.getByRole("button", { name: "UNLOCK ALL MAZES", exact: true }).click();
  const select = async (label, key) => {
    await page.locator(".level-choice").filter({ hasText: label }).click();
    await page.locator(".name-prompt-button.primary").click();
    await page.waitForFunction((key) => globalThis.__mistMazeWorld?.levelKey === key, key);
    await page.evaluate(() => { globalThis.__mistMazeWorld.enemies = []; });
  };
  await select("Abandoned City", "level0");
  assert.equal(await page.evaluate(() => globalThis.__mistMazeWorld.player.cosmetic), "alien");
  assert.equal(await page.evaluate(() => globalThis.__mistMazeWorld.pickups.filter((p) => p.extraSupply).length), 100);
  await page.getByRole("button", { name: /MYST POWERS/ }).click();
  await page.evaluate(() => { globalThis.__mistMazeWorld.player.hp = 20; });
  await page.locator(".myst-power-use").filter({ hasText: "Vital Restore" }).click();
  assert.equal(await page.evaluate(() => globalThis.__mistMazeWorld.player.hp), 100);
  await page.locator(".myst-power-use").filter({ hasText: "Mist Guard" }).click();
  assert.ok(await page.evaluate(() => globalThis.__mistMazeWorld.player.powerUps.phaseWalk.endsAt > globalThis.__mistMazeWorld.time));
  await page.getByRole("button", { name: "Close", exact: true }).click();
  if (out) await page.screenshot({ path: `${out}/city-alien.png` });
  await page.evaluate(() => { globalThis.__mistMazeWorld.player.hp = 0; globalThis.__mistMazeWorld.gameOver = true; });
  await page.getByRole("region", { name: "Run complete", exact: true }).waitFor();
  await page.getByRole("button", { name: /MYST POWERS/ }).click();
  await page.locator(".myst-power-use").filter({ hasText: "Phoenix Spark" }).click();
  await page.waitForFunction(() => !globalThis.__mistMazeWorld.gameOver);
  assert.equal(await page.evaluate(() => globalThis.__mistMazeWorld.player.hp), 50);
  assert.equal(await page.evaluate(() => globalThis.__mistMazeWorld.leaderboardEligible), false);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.keyboard.press("Escape");

  // Exercise the actual render chain and compare fixed-camera images, then rotate.
  const results = await page.evaluate(async () => {
    const { createWorld } = await import("/src/game/world-enhanced.js");
    const { drawWorld } = await import("/src/game/rendering-2.0.js");
    const { drawCharacterCosmeticBody } = await import("/src/game/characterCosmetic.js");
    const pictures = [], skins = [];
    for (const key of ["level0", "level1", "level2", "level3"]) {
      const world = createWorld(key, "3d"); world.player.x = 2.5; world.player.y = 2.5; world.player.facing = 0;
      world.enemies = []; world.pickups = []; world.message = ""; world.damageKick = 0; world.time = 1;
      const canvas = document.createElement("canvas"); canvas.width = 840; canvas.height = 720;
      const c = canvas.getContext("2d");
      const start = performance.now(); for (let i = 0; i < 6; i++) drawWorld(c, world);
      const averageMs = (performance.now() - start) / 6;
      const still = canvas.toDataURL(); drawWorld(c, world); const stable = still === canvas.toDataURL();
      world.player.facing = Math.PI / 2; drawWorld(c, world); const turns = still !== canvas.toDataURL();
      pictures.push({ key, image: still, stable, turns, averageMs });
      for (const cosmetic of ["alien", "turkey", "shadowWisp", "emberSpirit", "crystalGuardian"]) {
        const skin = document.createElement("canvas"); skin.width = 220; skin.height = 180;
        const ctx = skin.getContext("2d"); ctx.translate(110, 90); drawCharacterCosmeticBody(ctx, world.level.themeKey, 42, cosmetic);
        skins.push({ key, cosmetic, image: skin.toDataURL() });
      }
    }
    return { pictures, skins };
  });
  for (const result of results.pictures) {
    assert.equal(result.stable, true, `${result.key}: steady camera has stable textures`);
    assert.equal(result.turns, true, `${result.key}: turning changes perspective`);
    assert.ok(result.averageMs < 90, `${result.key}: rendering remains interactive (${result.averageMs.toFixed(1)}ms)`);
    if (out) await writeFile(`${out}/${result.key}-3d.png`, Buffer.from(result.image.split(",")[1], "base64"));
  }
  for (const key of ["level0", "level1", "level2", "level3"]) {
    assert.equal(new Set(results.skins.filter((skin) => skin.key === key).map((skin) => skin.image)).size, 5, `${key}: all five character silhouettes are distinct`);
  }
  if (out) for (const skin of results.skins) await writeFile(`${out}/${skin.key}-${skin.cosmetic}.png`, Buffer.from(skin.image.split(",")[1], "base64"));

  await page.locator(".thanksgiving-entry").click();
  await page.getByRole("button", { name: "Farm supply store", exact: true }).click();
  assert.equal(await page.locator(".farm-store-grid .farm-store-item").count(), 5);
  assert.equal(await page.getByText("Farmer Stunner", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Close farm store", exact: true }).click();
  await page.getByRole("button", { name: "Enter the farm →", exact: true }).click();
  await page.locator(".farm-canvas").waitFor();
  assert.equal(await page.locator(".farm-power").count(), 5);
  if (out) await page.screenshot({ path: `${out}/open-farm.png` });
  await page.getByRole("button", { name: "Farm menu", exact: true }).click();
  await page.getByRole("button", { name: /Back to first page/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator(".update-notice-board").evaluate((el) => el.scrollWidth > el.clientWidth), false);
  await page.locator(".first-page-myst-store-button").click();
  for (const card of await page.locator(".turkey-cosmetic-card").all()) assert.equal(await card.evaluate((el) => el.scrollWidth > el.clientWidth), false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "PASS", tested: "new player cosmetics and higher store prices, MIZ alien / hux turkey purchases, equip, plain City, Myst powers UI, extra supplies, notice board, more open farm with five redesigned powers, stable 3D in all four mazes, mobile layout", renderingMs: results.pictures.map(({key, averageMs}) => ({key, averageMs: +averageMs.toFixed(1)})), errors }));
} finally { await browser.close(); }
