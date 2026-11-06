import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

test("volume pickups retain visible edges when their centers are outside the view or behind a corner", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../../", import.meta.url)), cacheDir: "/tmp/mist-scene-sprites-vite-cache", server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { project3DSprite, draw3DSprites, is3DSpriteVisible } = await server.ssrLoadModule("/src/game/rendering.js?core");
    const { CANVAS_WIDTH, VIEW_3D_FOV, VIEW_3D_RAY_WIDTH } = await server.ssrLoadModule("/src/config/constants.js");
    const plane = CANVAS_WIDTH / (2 * Math.tan(VIEW_3D_FOV / 2));
    const world = { player: { x: 0, y: 0, facing: 0 }, time: 0, level: { themeKey: "medieval" }, exit: { x: -3, y: 0 }, enemies: [], projectiles: [], effects: [], labelsOn: false, pickups: [{ x: 3, y: 0, type: "powerup", color: "#facc15" }] };
    assert.equal(project3DSprite(world, .25, .26, plane), null, "point center lies outside the old angle limit");
    const edge = project3DSprite(world, .25, .26, plane, Math.hypot(.3, .3) / 2);
    assert.ok(edge && edge.screenX > CANVAS_WIDTH && Number.isFinite(edge.scale), "visible box edges survive even with the center offscreen");
    const near = project3DSprite(world, .04, 0, plane, .22);
    assert.ok(near && near.depth >= .08 && Number.isFinite(near.screenX), "camera-straddling volumes retain a finite near-plane anchor");
    assert.equal(project3DSprite(world, -3, 0, plane, .22), null, "fully behind-camera volumes are rejected");

    const z = new Float32Array(Math.ceil(CANVAS_WIDTH / VIEW_3D_RAY_WIDTH)).fill(28);
    const center = Math.floor(CANVAS_WIDTH / 2 / VIEW_3D_RAY_WIDTH);
    for (let ray = center - 2; ray <= center + 2; ray++) z[ray] = 1;
    assert.equal(is3DSpriteVisible(project3DSprite(world, 3, 0, plane), z), false, "a corner hides the center rays");
    let drawnFaces = 0, visibleClipRuns = 0;
    const ctx = { save() {}, restore() {}, beginPath() {}, clip() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, rect() { visibleClipRuns++; }, fill() { drawnFaces++; } };
    draw3DSprites(ctx, world, z, plane);
    assert.ok(drawnFaces > 0 && visibleClipRuns > 0, "visible portions still draw through per-face depth clipping");
  } finally { await server.close(); }
});
