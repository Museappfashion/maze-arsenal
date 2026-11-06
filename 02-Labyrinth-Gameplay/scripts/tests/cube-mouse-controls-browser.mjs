import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const url = process.env.GAME_TEST_URL || "http://127.0.0.1:5189/";
const origin = new URL(url).origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "This scenario is local-only.");
const out = process.env.GAME_SCREENSHOT_DIR || "/tmp/mist-cube-mouse-controls";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const evidence = { noRightClicks: true };

async function enterCube(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(url);
  await page.locator("#first-player-name").fill("oibougvovov");
  await page.getByRole("button", { name: "Start exploring", exact: true }).click();
  await page.getByRole("button", { name: "Enter The Cube", exact: true }).click();
  await page.locator(".cube-canvas").waitFor();
  await page.waitForFunction(() => Boolean(globalThis.__mistCubeMazeWorld));
}
const isLocked = (page) => page.evaluate(() => document.pointerLockElement === document.querySelector(".cube-canvas"));
const state = (page) => page.evaluate(() => {
  const world = globalThis.__mistCubeMazeWorld;
  return { x: world.player.x, y: world.player.y, z: world.player.z, facing: world.player.facing, pitch: world.player.pitch, elapsed: world.elapsed };
});
async function waitLocked(page) {
  await page.waitForFunction(() => document.pointerLockElement === document.querySelector(".cube-canvas"), null, { timeout: 3000 });
  await page.locator('.cube-page[data-mouse-locked="true"]').waitFor();
}
async function captureIfNeeded(page) {
  if (!await isLocked(page)) {
    try { await page.waitForFunction(() => document.pointerLockElement === document.querySelector(".cube-canvas"), null, { timeout: 500 }); } catch { /* A new left click is required. */ }
  }
  if (!await isLocked(page)) {
    const capture = page.getByRole("button", { name: "Capture mouse", exact: true });
    await capture.waitFor({ state: "visible" });
    await capture.click();
  }
  await waitLocked(page);
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await enterCube(page);
  assert.equal(await isLocked(page),false,"Mouse look starts after one click.");
  await captureIfNeeded(page);
  evidence.leftClickCapture = true;

  await page.evaluate(() => {
    globalThis.__cubeMouseProbe = [];
    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement) globalThis.__cubeMouseProbe.push({ buttons: event.buttons, dx: event.movementX, dy: event.movementY });
    });
  });
  const beforeLook = await state(page);
  await page.mouse.move(700, 480);
  await page.mouse.move(750, 455, { steps: 4 });
  await page.waitForFunction((before) => Math.abs(globalThis.__mistCubeMazeWorld.player.facing - before.facing) > .01 && Math.abs(globalThis.__mistCubeMazeWorld.player.pitch - before.pitch) > .001, beforeLook);
  const probe = await page.evaluate(() => globalThis.__cubeMouseProbe);
  assert.ok(probe.some((event) => event.buttons === 0 && (event.dx || event.dy)), "Actual mouse movement with no held button controls looking.");
  evidence.freeMouseLook = true;
  await page.screenshot({ path: `${out}/mouse-captured.png` });

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.pointerLockElement === null);
  await page.locator('.cube-page[data-cursor-free="true"]').waitFor();
  const released = await state(page);
  await page.mouse.move(900, 700);
  await page.waitForTimeout(200);
  assert.deepEqual(await state(page), released, "Released mouse neither moves the camera nor advances paused play.");
  evidence.escapeReleasesAndPauses = true;
  await page.screenshot({ path: `${out}/escape-released.png` });

  assert.equal(await page.getByRole("heading", { name: "Maze paused", exact: true }).count(),0);
  await captureIfNeeded(page);
  evidence.leftClickRecaptures = true;
  await page.keyboard.press("m");
  const map = page.locator(".cube-minimap-expanded");
  await map.waitFor();
  await page.waitForFunction(() => document.pointerLockElement === null);
  assert.equal(await page.getByRole("heading", { name: "Maze paused", exact: true }).count(), 0, "Opening the map must not also open the pause dialog.");
  const mapPaused = await state(page);
  await map.getByRole("button", { name: "Rotate map right", exact: true }).click();
  await map.getByRole("button", { name: "Zoom map in", exact: true }).click();
  await page.waitForTimeout(200);
  assert.deepEqual(await state(page), mapPaused, "Map controls do not rotate or move the game camera.");
  evidence.mapReleaseAndPause = true;
  await page.screenshot({ path: `${out}/map-cursor-free.png` });
  await map.getByRole("button", { name: /Close map/ }).click();
  assert.equal(await isLocked(page), false, "Closing the map leaves the cursor free until a new left click.");
  await page.locator(".cube-canvas").click({ position: { x: 100, y: 180 } });
  await waitLocked(page);
  evidence.canvasLeftClickCapture = true;

  // An unexpected browser release has the same pointerlockchange event as
  // native Escape. Holding W verifies release also clears movement keys.
  await page.keyboard.down("w");
  await page.waitForTimeout(100);
  await page.evaluate(() => document.exitPointerLock());
  await page.locator('.cube-page[data-cursor-free="true"]').waitFor();
  await page.keyboard.up("w");
  const unexpectedRelease = await state(page);
  await page.waitForTimeout(150);
  assert.deepEqual(await state(page), unexpectedRelease);
  evidence.unexpectedReleaseClearsInput = true;
  await captureIfNeeded(page);
  await page.keyboard.press("Escape");await page.waitForFunction(()=>document.pointerLockElement===null);
  assert.equal(await page.locator(".cube-page").count(),1,"First Escape stays inside the Cube.");
  await page.keyboard.press("Escape");
  evidence.twoEscapesExit=true;
  await page.getByRole("heading", { name: "Playtime unlocks", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.pointerLockElement), null, "Leaving the Cube must release the mouse.");
  evidence.menuCleanup = true;

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await enterCube(mobile);
  assert.equal(await mobile.evaluate(() => document.pointerLockElement), null, "Touch play does not capture the cursor.");
  assert.equal(await mobile.getByRole("group", { name: "Movement joystick", exact: true }).isVisible(), true);
  assert.equal(await mobile.getByRole("group", { name: "Look joystick", exact: true }).isVisible(), true);
  const touch = await mobile.context().newCDPSession(mobile);
  async function dragStick(label, dx, dy) {
    const box = await mobile.getByRole("group", { name: label, exact: true }).boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx, y: y + dy }] });
    await mobile.waitForTimeout(300);
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  const beforeTouch = await state(mobile);
  await dragStick("Movement joystick", 0, -25);
  const afterTouch = await state(mobile);
  assert.ok(Math.hypot(afterTouch.x-beforeTouch.x, afterTouch.y-beforeTouch.y) > .2, "The real touch MOVE joystick still walks.");
  await dragStick("Look joystick", 25, 0);
  assert.ok(Math.abs((await state(mobile)).facing-afterTouch.facing) > .1, "The real touch LOOK joystick still turns.");
  assert.equal(await mobile.evaluate(() => document.pointerLockElement), null);
  evidence.mobileTouchControls = true;
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "PASS", checks: evidence, pageErrors: errors, screenshots: out }));
} finally { await browser.close(); }
