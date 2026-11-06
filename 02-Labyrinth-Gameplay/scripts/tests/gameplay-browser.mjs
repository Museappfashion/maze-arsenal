// Run against a local Vite server with Playwright available. No remote requests
// are allowed, and each test uses an isolated browser profile/local wallet.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const baseUrl = process.env.GAME_TEST_URL || "http://127.0.0.1:5177/";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : { channel: "chrome" }),
});
const screenshotDir = process.env.GAME_SCREENSHOT_DIR;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (/Encountered two children with the same key/.test(message.text())) errors.push(message.text());
  });
  await page.route("**/*", route => {
    return new URL(route.request().url()).origin === new URL(baseUrl).origin
      ? route.continue()
      : route.abort();
  });
  await page.goto(baseUrl);
  await page.locator(".level-choice").filter({ hasText: "Abandoned City" }).click();
  await page.locator(".name-prompt-button.primary").click();
  await page.waitForSelector(".miz-counter");

  const inspectStableWorld = () => page.evaluate(async () => {
    const world = globalThis.__mistMazeWorld;
    world.enemies = [];
    const grid = world.grid;
    const pickups = world.pickups.filter(pickup =>
      Math.hypot(pickup.x - world.player.x, pickup.y - world.player.y) > 5);
    const startTime = world.time;
    let changes = 0;
    for (let frame = 0; frame < 90; frame += 1) {
      await new Promise(requestAnimationFrame);
      if (globalThis.__mistMazeWorld !== world) changes += 1;
    }
    return {
      changes,
      gridStable: globalThis.__mistMazeWorld.grid === grid,
      pickupsStable: pickups.every(pickup => globalThis.__mistMazeWorld.pickups.includes(pickup)),
      timeAdvanced: world.time > startTime + 0.5,
    };
  });
  assert.deepEqual(await inspectStableWorld(), {
    changes: 0, gridStable: true, pickupsStable: true, timeAdvanced: true,
  });

  const exploration = await page.evaluate(async () => {
    const world = globalThis.__mistMazeWorld;
    const before = world.player.discoveredFloor;
    // Move to actual floor tiles and let the normal game loop reveal/award them.
    for (const tile of world.floorTiles) {
      if (world.discovered[tile.y * world.width + tile.x] ||
          Math.hypot(tile.x - world.exit.x, tile.y - world.exit.y) < 4) continue;
      world.player.x = tile.x + 0.5;
      world.player.y = tile.y + 0.5;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      if (world.player.discoveredFloor - before >= 86) break;
    }
    return world.player.discoveredFloor - before;
  });
  assert.ok(exploration >= 86, "actual new discoveries must be available");
  await page.waitForFunction(() => Number(document.querySelector(".miz-counter-balance")?.textContent.trim().split(" ")[0]) >= 2);
  const wallet = await page.evaluate(() => JSON.parse(localStorage.getItem("mist-maze-miz-economy-v3")));
  assert.ok(wallet.miz >= 2);
  assert.equal(wallet.miz, Math.floor(wallet.lifetimeExploredTiles / 43));
  assert.equal(wallet.tileRemainder, wallet.lifetimeExploredTiles % 43);
  await inspectStableWorld();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("mist-maze-miz-economy-v3")).miz), wallet.miz);
  if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/maze-2d.png` });

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "POINTER: ON", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("[data-mist-exit-direction]"));
  await page.getByRole("button", { name: "POINTER: OFF", exact: true }).click();
  await page.waitForSelector("[data-mist-exit-direction]");
  await page.locator(".settings-view-toggle").click();
  await page.getByRole("button", { name: "SWITCH ANYWAY", exact: true }).click();
  await page.waitForSelector(".maze-game-root.mode-3d");
  assert.deepEqual(await inspectStableWorld(), {
    changes: 0, gridStable: true, pickupsStable: true, timeAdvanced: true,
  });

  for (const [offset, direction] of [[0, 12], [Math.PI / 2, 0], [Math.PI, 4], [-Math.PI / 2, 8]]) {
    await page.evaluate(offset => {
      const world = globalThis.__mistMazeWorld;
      const bearing = Math.atan2(world.exit.y + 0.5 - world.player.y, world.exit.x + 0.5 - world.player.x);
      world.player.facing = bearing - offset;
    }, offset);
    await page.waitForFunction(expected => document.querySelector("[data-mist-exit-direction]")?.dataset.mistExitDirection === String(expected), direction);
  }
  if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/maze-3d.png` });

  // Restart through the actual control; old wallet/progress must survive.
  await page.getByRole("button", { name: "START NEW MAZE", exact: true }).click();
  assert.deepEqual(await inspectStableWorld(), {
    changes: 0, gridStable: true, pickupsStable: true, timeAdvanced: true,
  });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("mist-maze-miz-economy-v3")).miz), wallet.miz);
  await page.reload();
  await page.locator(".level-choice").filter({ hasText: "Abandoned City" }).click();
  await page.locator(".name-prompt-button.primary").click();
  await page.waitForSelector(".miz-counter");
  assert.ok((await page.locator(".miz-counter-balance").innerText()).includes(`${wallet.miz} MIZ`));
  assert.deepEqual(errors, []);
  console.log("PASS: 2D/3D world identity, real exploration awards, saved wallet, pointer directions/toggle, restart/reload, no browser errors.");
} finally {
  await browser.close();
}
