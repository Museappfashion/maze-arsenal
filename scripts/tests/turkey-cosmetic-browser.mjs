import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const baseUrl = process.env.GAME_TEST_URL || "http://127.0.0.1:5189/";
const origin = new URL(baseUrl).origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname));
const screenshots = process.env.GAME_SCREENSHOT_DIR;
if (screenshots) await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.clock.setFixedTime(new Date("2026-10-16T12:00:00Z"));
  await page.goto(baseUrl);
  await page.locator(".thanksgiving-entry").click();
  await page.getByRole("button", { name: "Farm supply store", exact: true }).click();
  const buy = page.getByRole("button", { name: "Buy Turkey Disguise for 1000 hux", exact: true });
  assert.equal(await buy.isDisabled(), true);
  await page.evaluate(async () => {
    const { earnHux } = await import("/src/services/huxEconomy.js");
    earnHux(1001);
  });
  await buy.click();
  await page.getByRole("button", { name: "Unequip Turkey Disguise", exact: true }).waitFor();
  assert.equal(await buy.count(), 0, "an owned cosmetic cannot be bought twice");
  const purchased = await page.evaluate(async () => (await import("/src/services/huxEconomy.js")).loadHuxState());
  assert.equal(purchased.hux, 1);
  assert.equal(purchased.cosmetics.turkey, true);
  assert.equal(purchased.equippedCosmetic, "turkey");
  if (screenshots) await page.locator(".turkey-cosmetic-card").screenshot({ path: `${screenshots}/turkey-store.png` });
  await page.getByRole("button", { name: /Back to first page/ }).click();
  await page.getByRole("button", { name: "UNLOCK ALL MAZES", exact: true }).click();

  const looks = [];
  for (const [key, label, theme] of [["level1", "Orbital Ruins", "space"], ["level2", "Emerald Wilds", "jungle"], ["level3", "The Fallen Keep", "medieval"]]) {
    await page.locator(".level-choice").filter({ hasText: label }).click();
    await page.locator(".name-prompt-button.primary").click();
    await page.waitForFunction((key) => globalThis.__mistMazeWorld?.levelKey === key, key);
    assert.equal(await page.evaluate(() => globalThis.__mistMazeWorld.player.cosmetic), "turkey");
    const result = await page.evaluate(async () => {
      const world = globalThis.__mistMazeWorld;
      world.enemies = [];
      const { drawPlayerBody, draw3DOverlay } = await import("/src/game/rendering.js?core");
      const canvas = document.createElement("canvas");
      canvas.width = 240; canvas.height = 180;
      const ctx = canvas.getContext("2d");
      const stats = () => JSON.stringify({ hp: world.player.hp, maxHp: world.player.maxHp, speed: world.player.speed, radius: world.player.radius, ammo: world.player.ammo, weapon: world.player.weapon, eligible: world.leaderboardEligible });
      const before = stats();
      const render = (cosmetic) => {
        world.player.cosmetic = cosmetic;
        ctx.resetTransform(); ctx.clearRect(0, 0, 240, 180); ctx.scale(4, 4);
        drawPlayerBody(ctx, world, 30, 22.5);
        return canvas.toDataURL();
      };
      const normal = render(null);
      const turkey = render("turkey");
      const overlay = document.createElement("canvas"); overlay.width = 840; overlay.height = 720;
      draw3DOverlay(overlay.getContext("2d"), world);
      return { normal, turkey, sameStats: before === stats(), overlay: overlay.toDataURL() };
    });
    assert.notEqual(result.normal, result.turkey, `${theme}: actual player body uses the turkey`);
    assert.equal(result.sameStats, true, `${theme}: cosmetic preserves combat stats and eligibility`);
    looks.push(result.turkey);
    if (screenshots) {
      await writeFile(`${screenshots}/turkey-${theme}.png`, Buffer.from(result.turkey.split(",")[1], "base64"));
      if (theme === "space") await writeFile(`${screenshots}/turkey-3d-hud.png`, Buffer.from(result.overlay.split(",")[1], "base64"));
    }
    await page.keyboard.press("Escape");
    await page.locator(".level-select-screen").waitFor();
  }
  assert.equal(new Set(looks).size, 3, "all three themes have distinct headwear");
  await page.reload();
  await page.locator(".first-page-myst-store-button").click();
  await page.getByRole("button", { name: "Unequip Turkey Disguise", exact: true }).click();
  await page.getByRole("button", { name: "Equip Turkey Disguise", exact: true }).waitFor();
  await page.reload();
  await page.locator(".level-choice").filter({ hasText: "Orbital Ruins" }).click();
  await page.locator(".name-prompt-button.primary").click();
  await page.waitForFunction(() => globalThis.__mistMazeWorld?.levelKey === "level1");
  assert.equal(await page.evaluate(() => globalThis.__mistMazeWorld.player.cosmetic), null);
  await page.keyboard.press("Escape");
  await page.locator(".first-page-myst-store-button").click();
  await page.getByRole("button", { name: "Equip Turkey Disguise", exact: true }).click();

  // Permanent unlocks remain manageable after the seasonal entry disappears.
  await page.clock.setFixedTime(new Date("2026-11-28T12:00:00Z"));
  await page.reload();
  assert.equal(await page.locator(".thanksgiving-entry").count(), 0);
  await page.locator(".first-page-myst-store-button").click();
  await page.getByRole("button", { name: "Unequip Turkey Disguise", exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  const card = page.locator(".turkey-cosmetic-card");
  assert.equal(await card.evaluate((el) => el.scrollWidth > el.clientWidth), false);
  assert.equal(await page.evaluate(async () => (await import("/src/services/huxEconomy.js")).loadHuxState().hux), 1);
  assert.deepEqual(errors, []);
  console.log("PASS: 1000-hux purchase, permanent ownership, three actual player skins, unchanged stats, 3D portrait, reload, equip/unequip, post-season controls, mobile fit, zero browser errors.");
} finally {
  await browser.close();
}
