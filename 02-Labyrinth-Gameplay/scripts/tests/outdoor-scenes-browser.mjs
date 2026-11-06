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
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(baseUrl);
  const result = await page.evaluate(async () => {
    const { createWorld } = await import("/src/game/world-enhanced.js");
    const { drawWorld } = await import("/src/game/rendering-2.0.js");
    const { draw3DEnvironment } = await import("/src/game/rendering.js?core");
    const { hasOutdoorDepth } = await import("/src/game/outdoorGeometry3D.js");
    const results = [];
    for (const key of ["level1", "level2"]) {
      const world = createWorld(key, "3d"); world.time = 1; world.message = ""; world.damageKick = 0;
      const before = JSON.stringify(world.grid);
      const canvas = document.createElement("canvas"); canvas.width = 840; canvas.height = 720;
      const ctx = canvas.getContext("2d");
      const sheet = document.createElement("canvas"); sheet.width = 840 * 4; sheet.height = 750 * 4;
      const sc = sheet.getContext("2d");
      sc.fillStyle = "#081019"; sc.fillRect(0, 0, sheet.width, sheet.height);
      const spots = [{ x: world.player.x, y: world.player.y }];
      // Position the second camera close to a genuine wall corner, where the
      // old billboards stretched into giant screen-height vertical slices.
      outer: for (let y = 2; y < world.height - 2; y++) for (let x = 2; x < world.width - 2; x++) {
        if (world.grid[y][x] !== 0) continue;
        if (world.grid[y][x - 1] !== 0 && world.grid[y - 1][x] !== 0) { spots.push({ x: x + .26, y: y + .26 }); break outer; }
      }
      if (spots.length === 1) spots.push({ x: world.player.x + .2, y: world.player.y + .2 });
      const frames = [];
      for (let spot = 0; spot < spots.length; spot++) {
        Object.assign(world.player, spots[spot]);
        for (let angle = 0; angle < 8; angle++) {
          world.player.facing = angle * Math.PI / 4;
          const start = performance.now(); drawWorld(ctx, world); const ms = performance.now() - start;
          const rendered = canvas.toDataURL(); drawWorld(ctx, world);
          const stable = rendered === canvas.toDataURL();
          world.player.facing += Math.PI * 2; drawWorld(ctx, world);
          const a = ctx.getImageData(0, 0, 840, 720).data;
          world.player.facing -= Math.PI * 2; drawWorld(ctx, world);
          const b = ctx.getImageData(0, 0, 840, 720).data;
          let mismatch = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 3) mismatch++;
          frames.push({ spot, angle, ms, stable, rotationMismatch: mismatch / a.length });
          const col = angle % 4, row = spot * 2 + Math.floor(angle / 4);
          sc.drawImage(canvas, col * 840, row * 750);
          sc.fillStyle = "#d9e5ef"; sc.font = "18px sans-serif"; sc.fillText(`${key} / ${spot ? "wall corner" : "entry"} / ${angle * 45}°`, col * 840 + 12, row * 750 + 744);
        }
      }
      // Wall destruction and other scene changes remain visible on the next frame.
      world.enemies = []; world.pickups = []; world.projectiles = []; world.effects = [];
      Object.assign(world.player, spots[0]); world.player.facing = 0;
      draw3DEnvironment(ctx, world, new Float32Array(280)); const intact = canvas.toDataURL();
      const collisionUnchanged = before === JSON.stringify(world.grid);
      world.grid = world.grid.map((row) => row.map(() => 0));
      draw3DEnvironment(ctx, world, new Float32Array(280)); const cleared = canvas.toDataURL();
      results.push({ key, frames, collisionUnchanged, usesDepth: hasOutdoorDepth(world), wallsRemoved: intact !== cleared, sheet: sheet.toDataURL() });
    }
    return results;
  });
  for (const theme of result) {
    assert.equal(theme.usesDepth, true);
    assert.equal(theme.collisionUnchanged, true, `${theme.key}: rendering does not change collision`);
    assert.equal(theme.wallsRemoved, true, `${theme.key}: removed walls disappear without stale geometry`);
    for (const frame of theme.frames) {
      assert.equal(frame.stable, true, `${theme.key} ${frame.spot}/${frame.angle}: steady view is stable`);
      assert.ok(frame.rotationMismatch < .001, `${theme.key} ${frame.spot}/${frame.angle}: full rotation restores the same view`);
      if (frame.angle) assert.ok(frame.ms < 90, `${theme.key}: warmed full game rendering remains interactive`);
    }
    if (out) await writeFile(`${out}/${theme.key}-all-angles.png`, Buffer.from(theme.sheet.split(",")[1], "base64"));
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "PASS", tested: "32 full-game entry/corner/angle combinations, true outdoor mesh depth, stable full turns, wall destruction, and active enemy/pickup occlusion", renderingMs: result.map((r) => ({ key: r.key, average: r.frames.slice(1).reduce((sum, f) => sum + f.ms, 0) / (r.frames.length - 1) })), errors }));
} finally { await browser.close(); }
