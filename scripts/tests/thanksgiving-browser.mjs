// Local-only end-to-end coverage. World inspection is injected into the served
// test response; the production engine has no browser-global test hook.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const baseUrl = process.env.GAME_TEST_URL || "http://127.0.0.1:5189/";
const origin = new URL(baseUrl).origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname));
const screenshots = process.env.GAME_SCREENSHOT_DIR;
if (screenshots) await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : { channel: "chrome" }),
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  // Keep this seasonal regression runnable after the event's actual deadline.
  await page.clock.setFixedTime(new Date("2026-10-12T12:00:00Z"));
  const localRoute = async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    // Vite adds a timestamp query after hot updates; instrument those too.
    if (url.pathname === "/src/game/thanksgiving.js") {
      const response = await route.fetch();
      const original = await response.text();
      assert.ok(original.includes("return world;"), "the create-world return is available for test instrumentation");
      return route.fulfill({
        response,
        body: original.replace("return world;", "globalThis.__farmTestWorld = world; return world;"),
      });
    }
    return route.continue();
  };
  await page.route("**/*", localRoute);
  const wallet = () => page.evaluate(() => JSON.parse(localStorage.getItem("mist-maze-thanksgiving-hux-v1")));
  const assertMizUnchanged = async (expected) => assert.equal(
    await page.evaluate(() => localStorage.getItem("mist-maze-miz-economy-v3")), expected,
    "the separate farm currency must leave the existing MIZ wallet untouched",
  );

  await page.goto(baseUrl);
  const mizSentinel = await page.evaluate(async () => {
    const { saveMizState } = await import("/src/services/mizEconomy.js");
    saveMizState({ miz: 321, tileRemainder: 7, lifetimeExploredTiles: 93, lifetimeMizEarned: 2, legacyTurkeyMigrated: true });
    return localStorage.getItem("mist-maze-miz-economy-v3");
  });
  await page.locator(".thanksgiving-entry").click();
  await page.locator(".farm-page").waitFor();
  assert.match(await page.locator(".farm-season-strip").innerText(), /Only until Thanksgiving/);
  await page.getByRole("button", { name: /Back to first page/ }).click();
  await page.locator(".level-choice").filter({ hasText: "Abandoned City" }).waitFor();
  await page.locator(".thanksgiving-entry").click();
  await page.getByRole("button", { name: "Farm supply store", exact: true }).click();
  const speedBuy = page.getByRole("button", { name: "Buy Turkey Trot for 12 hux", exact: true });
  assert.equal(await speedBuy.isDisabled(), true, "a new wallet cannot buy supplies it cannot afford");
  assert.equal(await page.locator(".farm-store-grid .farm-store-item button:disabled").count(), 5);

  await page.evaluate(async () => {
    const { earnHux } = await import("/src/services/huxEconomy.js");
    earnHux(100);
  });
  await speedBuy.click();
  await speedBuy.click();
  await page.getByRole("button", { name: "Buy Haystack Hop for 24 hux", exact: true }).click();
  assert.equal((await wallet()).hux, 52);
  assert.equal((await wallet()).inventory.speed, 2);
  assert.equal((await wallet()).inventory.teleport, 1);
  await assertMizUnchanged(mizSentinel);
  await page.getByRole("button", { name: "Close farm store", exact: true }).click();
  if (screenshots) await page.screenshot({ path: `${screenshots}/thanksgiving-lobby.png` });

  await page.getByRole("button", { name: "Enter the farm →", exact: true }).click();
  await page.locator(".farm-canvas").waitFor();
  await page.waitForFunction(() => globalThis.__farmTestWorld?.time > 0);
  const firstSpawns = await page.evaluate(() => {
    const world = globalThis.__farmTestWorld;
    const initial = [world.player.x, world.player.y, world.farmer.x, world.farmer.y];
    // Use a controlled clear patch for input checks, independent of random terrain.
    world.grid = world.grid.map(row => [...row]);
    for (let y = 1; y <= 4; y++) for (let x = 1; x <= 12; x++) world.grid[y][x] = 0;
    world.grid[62][60] = 0;
    Object.assign(world.player, { x: 3.5, y: 2.5 });
    Object.assign(world.farmer, { x: 60.5, y: 62.5 });
    world.cages = [];
    world.corn = [];
    world.pickups = [];
    return initial;
  });
  await page.keyboard.down("d");
  await page.waitForFunction(() => globalThis.__farmTestWorld.player.x > 4.3);
  await page.keyboard.up("d");
  assert.equal(await page.evaluate(() => globalThis.__farmTestWorld.player.y), 2.5);
  await page.keyboard.press("1");
  await page.waitForFunction(() => globalThis.__farmTestWorld.inventory.speed === 1);
  assert.equal((await wallet()).inventory.speed, 1, "keyboard use persists consumption immediately");
  assert.ok(await page.evaluate(() => globalThis.__farmTestWorld.effects.speed > 0));

  // Place normal engine entities nearby; the actual animation loop, key handler,
  // collection/rescue rules, and wallet accounting perform the rest.
  await page.evaluate(() => {
    const world = globalThis.__farmTestWorld;
    world.cages = [{ id: 90001, x: world.player.x + 1, y: world.player.y, progress: 0 }];
    world.corn = [{ id: 90002, x: world.player.x, y: world.player.y }];
    world.pickups = [{ id: 90003, x: world.player.x, y: world.player.y, type: "teleport" }];
  });
  await page.keyboard.down("e");
  await page.waitForFunction(() => globalThis.__farmTestWorld.rescued === 1);
  await page.keyboard.up("e");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("mist-maze-thanksgiving-hux-v1"))?.totalRescued === 1);
  const earned = await wallet();
  assert.equal(earned.hux, 53);
  assert.equal(earned.bestRescued, 1);
  assert.equal(earned.totalRescued, 1);
  assert.equal(earned.inventory.teleport, 2, "found supplies persist alongside purchased supplies");
  assert.equal(await page.evaluate(() => globalThis.__farmTestWorld.cornCollected), 1);
  await assertMizUnchanged(mizSentinel);
  if (screenshots) await page.screenshot({ path: `${screenshots}/thanksgiving-play.png` });

  await page.keyboard.press("Escape");
  await page.getByRole("heading", { name: "Farm paused", exact: true }).waitFor();
  const paused = await page.evaluate(() => {
    const world = globalThis.__farmTestWorld;
    return { time: world.time, player: { ...world.player }, farmer: { ...world.farmer } };
  });
  await page.keyboard.down("d");
  await page.waitForTimeout(300);
  await page.keyboard.up("d");
  assert.deepEqual(await page.evaluate(() => {
    const world = globalThis.__farmTestWorld;
    return { time: world.time, player: { ...world.player }, farmer: { ...world.farmer } };
  }), paused, "Escape freezes both actors and run time");
  await page.keyboard.press("Escape");
  await page.waitForFunction(time => globalThis.__farmTestWorld.time > time, paused.time);

  await page.evaluate(() => {
    const world = globalThis.__farmTestWorld;
    globalThis.__farmPreviousTestWorld = world;
    Object.assign(world.farmer, { x: world.player.x, y: world.player.y });
    world.effects.mudSlow = 0;
    world.effects.fenceSlip = 0;
  });
  await page.getByRole("heading", { name: "The farmer caught you!", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => globalThis.__farmTestWorld.caught), true);
  assert.deepEqual(await wallet(), earned, "capture preserves corn earnings, rescue records, and remaining supplies");
  if (screenshots) await page.screenshot({ path: `${screenshots}/thanksgiving-caught.png` });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.waitForFunction(() => globalThis.__farmTestWorld !== globalThis.__farmPreviousTestWorld);
  const restarted = await page.evaluate(() => {
    const world = globalThis.__farmTestWorld;
    return {
      rescued: world.rescued, corn: world.cornCollected, caught: world.caught,
      inventory: world.inventory, spawns: [world.player.x, world.player.y, world.farmer.x, world.farmer.y],
    };
  });
  assert.equal(restarted.rescued, 0);
  assert.equal(restarted.corn, 0);
  assert.equal(restarted.caught, false);
  assert.deepEqual(restarted.inventory, earned.inventory);
  assert.notDeepEqual(restarted.spawns, firstSpawns, "a retry creates new random actor spawns");
  assert.deepEqual(await wallet(), earned);
  await page.getByRole("button", { name: "Farm menu", exact: true }).click();
  await page.locator(".farm-page").waitFor();
  assert.match(await page.locator(".farm-records").innerText(), /1/);

  await page.reload();
  await page.locator(".thanksgiving-entry").click();
  await page.locator(".farm-page").waitFor();
  assert.deepEqual(await wallet(), earned, "a reload retains the farm wallet and records");
  await assertMizUnchanged(mizSentinel);
  await page.getByRole("button", { name: /Back to first page/ }).click();
  await page.locator(".level-choice").filter({ hasText: "Abandoned City" }).click();
  await page.locator(".name-prompt-button.primary").click();
  await page.locator(".maze-frame > canvas").first().waitFor();
  await page.locator(".miz-counter").waitFor();
  assert.match(await page.locator(".miz-counter-balance").innerText(), /321 MIZ/);
  assert.equal(await page.locator(".farm-game").count(), 0);

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  });
  const mobile = await mobileContext.newPage();
  mobile.setDefaultTimeout(10000);
  mobile.on("pageerror", error => errors.push(`mobile: ${error.message}`));
  await mobile.clock.setFixedTime(new Date("2026-10-12T12:00:00Z"));
  await mobile.route("**/*", localRoute);
  await mobile.goto(baseUrl);
  await mobile.locator(".thanksgiving-entry").tap();
  await mobile.getByRole("button", { name: "Enter the farm →", exact: true }).tap();
  await mobile.locator(".farm-canvas").waitFor();
  await mobile.waitForFunction(() => globalThis.__farmTestWorld?.time > 0);
  await mobile.evaluate(() => {
    const world = globalThis.__farmTestWorld;
    // Use a controlled clear patch for input checks, independent of random terrain.
    world.grid = world.grid.map(row => [...row]);
    for (let y = 1; y <= 4; y++) for (let x = 1; x <= 12; x++) world.grid[y][x] = 0;
    world.grid[62][60] = 0;
    Object.assign(world.player, { x: 3.5, y: 2.5 });
    Object.assign(world.farmer, { x: 60.5, y: 62.5 });
    world.cages = []; world.corn = []; world.pickups = [];
  });
  // Native touch input exercises pointer capture and release, not synthetic DOM
  // events (which cannot create a real active pointer for setPointerCapture).
  const touch = await mobileContext.newCDPSession(mobile);
  const joystick = await mobile.locator(".farm-joystick").boundingBox();
  assert.ok(joystick?.width > 0, "the mobile joystick is visible");
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: joystick.x + joystick.width * 0.82, y: joystick.y + joystick.height / 2, id: 1 }],
  });
  await mobile.waitForFunction(() => globalThis.__farmTestWorld.player.x > 4.3);
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const releasedX = await mobile.evaluate(() => globalThis.__farmTestWorld.player.x);
  await mobile.waitForTimeout(200);
  assert.equal(await mobile.evaluate(() => globalThis.__farmTestWorld.player.x), releasedX,
    "releasing the touch joystick stops turkey movement");
  await mobile.evaluate(() => {
    const world = globalThis.__farmTestWorld;
    world.cages = [{ id: 90004, x: world.player.x + 1, y: world.player.y, progress: 0 }];
  });
  const freeButton = await mobile.getByRole("button", { name: "Hold to free turkey", exact: true }).boundingBox();
  assert.ok(freeButton?.width > 0, "the mobile FREE control is visible");
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: freeButton.x + freeButton.width / 2, y: freeButton.y + freeButton.height / 2, id: 1 }],
  });
  await mobile.waitForFunction(() => globalThis.__farmTestWorld.rescued === 1);
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.equal(await mobile.evaluate(() => JSON.parse(localStorage.getItem("mist-maze-thanksgiving-hux-v1"))?.totalRescued), 1);
  if (screenshots) await mobile.screenshot({ path: `${screenshots}/thanksgiving-mobile-controls.png` });
  await mobileContext.close();
  assert.deepEqual(errors, []);
  console.log("PASS: seasonal entry/back, affordability, Hux purchases, keyboard movement/powers/rescues, corn and supply persistence, pause/resume, capture/retry, reload, separate MIZ wallet, normal Abandoned City launch, mobile touch movement/release/rescue, no browser errors.");
} finally {
  await browser.close();
}
