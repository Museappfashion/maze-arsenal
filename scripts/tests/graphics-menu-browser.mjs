// Local browser regression: real shop purchases, saved cosmetics, chain locks.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const baseUrl = process.env.GAME_TEST_URL || "http://127.0.0.1:5188/";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const screenshots = process.env.GAME_SCREENSHOT_DIR;
if (screenshots) await mkdir(screenshots, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => new URL(route.request().url()).origin === new URL(baseUrl).origin
    ? route.continue() : route.abort());
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.setItem("mist-maze-miz-economy-v3", JSON.stringify({ miz: 60000 })));
  await page.reload();
  await page.locator(".mist-lock-overlay").first().waitFor();
  assert.equal(await page.locator(".mist-lock-overlay").count(), 3);
  assert.equal(await page.locator(".mist-lock-overlay .mist-padlock").count(), 0);
  assert.equal(await page.locator(".mist-lock-overlay svg").count(), 6);
  await page.locator(".level-choice.mist-locked-level").first().click({ force: true });
  assert.equal(await page.locator(".name-prompt-button.primary").count(), 0);
  if (screenshots) await page.screenshot({ path: `${screenshots}/white-chain-locks.png` });
  await page.locator(".first-page-myst-store-button").click();
  const cosmetics = await page.evaluate(async () => {
    const { MYST_SHOP_ITEMS } = await import("/src/services/mizEconomy.js");
    return MYST_SHOP_ITEMS.filter(item => item.kind === "cosmetic");
  });
  for (const item of cosmetics) {
    await page.locator(".myst-store-item").filter({ has: page.locator(".myst-item-name", { hasText: item.name }) }).getByRole("button", { name: "Buy cosmetic", exact: true }).click();
  }
  const walletState = await page.evaluate(() => JSON.parse(localStorage.getItem("mist-maze-miz-economy-v3")));
  assert.equal(walletState.miz, 60000 - cosmetics.reduce((sum, item) => sum + item.price, 0));
  assert.equal(Object.keys(walletState.cosmetics).length, 10);
  assert.equal(await page.locator(".myst-store-wallet [data-miz-cosmetic]").count(), 8);
  assert.equal(await page.locator(".myst-store-wallet.miz-cosmetic-frame.miz-cosmetic-aura").count(), 1);
  assert.equal(await page.getByRole("button", { name: "Active", exact: true }).count(), 10);
  if (screenshots) await page.locator(".myst-store-head").screenshot({ path: `${screenshots}/shop-upgrades.png` });
  // A fresh page must activate already-owned upgrades without another purchase.
  await page.reload();
  await page.locator(".level-choice").filter({ hasText: "Abandoned City" }).click();
  await page.locator(".name-prompt-button.primary").click();
  await page.locator(".miz-counter").waitFor();
  assert.equal(await page.locator(".miz-counter [data-miz-cosmetic]").count(), 8);
  assert.equal(await page.locator(".miz-counter.miz-cosmetic-frame.miz-cosmetic-aura").count(), 1);
  assert.ok((await page.locator(".miz-counter").boundingBox()).width < 250, "upgrades keep the HUD wallet compact");
  assert.ok((await page.locator(".miz-counter-balance").innerText()).includes(String(walletState.miz)));
  if (screenshots) await page.locator(".miz-counter").screenshot({ path: `${screenshots}/coin-upgrades.png` });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator(".miz-counter .miz-orbit").evaluate(el => getComputedStyle(el).animationName), "none");
  await page.evaluate(async () => {
    const { saveMizState, loadMizState } = await import("/src/services/mizEconomy.js");
    saveMizState({ ...loadMizState(), cosmetics: {} });
  });
  await page.waitForFunction(() => !document.querySelector(".miz-counter [data-miz-cosmetic]"));
  assert.equal(await page.locator(".miz-counter.miz-cosmetic-frame").count(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS: ten purchases apply immediately, saved upgrades activate after reload, default coin still works, reduced motion honored, white chains still block locked mazes, no browser errors.");
} finally {
  await browser.close();
}
