import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// Use the real browser artwork collector and real sprite pass. A small clip
// probe records whether selected screen points survive the Canvas clip mask;
// this catches artwork painted in a separate overlay after wall clipping.
function clippingProbe() {
  let contains = () => true;
  let path = [];
  const stack = [];
  const visible = [];
  const order = [];
  const ctx = {
    visible, order,
    save() { stack.push(contains); },
    restore() { contains = stack.pop(); },
    beginPath() { path = []; },
    rect(x, y, width, height) { path.push([x, y, width, height]); },
    clip() {
      const previous = contains, rectangles = path;
      contains = (x, y) => previous(x, y) && rectangles.some(([rx, ry, width, height]) => x >= rx && x < rx + width && y >= ry && y < ry + height);
    },
    probe(label, x, y) { if (contains(x, y)) visible.push(label); },
    translate() {}, arc() {}, stroke() {},
    fill() { order.push("pickup"); },
  };
  return ctx;
}

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);

test("browser decorations share scene projection, sorting, and wall clipping", async (t) => {
  const server = await createServer({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    cacheDir: "/tmp/mist-scene-decorations-regression-vite-cache",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom", optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const registry = await server.ssrLoadModule("/src/game/sceneDecorations3D.js");
    const { collectVisualDecorations3D } = await server.ssrLoadModule("/src/features/visualPolish.js");
    const { draw3DSprites } = await server.ssrLoadModule("/src/game/rendering.js?core");
    const { sceneScreenY, projectScenePoint, SCENE_PROJECTION_PLANE: plane } = await server.ssrLoadModule("/src/game/sceneProjection3D.js");
    const { CANVAS_WIDTH, VIEW_3D_RAY_WIDTH } = await server.ssrLoadModule("/src/config/constants.js");

    await t.test("registration forwards the current world and unregisters cleanly", () => {
      registry.registerSceneDecorations3D(null);
      const world = {};
      assert.deepEqual(registry.getSceneDecorations3D(world), []);
      const decorations = [{ type: "decoration" }];
      registry.registerSceneDecorations3D((received) => { assert.equal(received, world); return decorations; });
      assert.equal(registry.getSceneDecorations3D(world), decorations);
      registry.registerSceneDecorations3D(() => null);
      assert.deepEqual(registry.getSceneDecorations3D(world), []);
      registry.registerSceneDecorations3D("unregister");
      assert.deepEqual(registry.getSceneDecorations3D(world), []);
    });

    await t.test("actual signs and lamps remain on the shared ground plane when moving and turning", () => {
      const world = {
        width: 20, height: 20, level: { themeKey: "city" }, time: 0,
        grid: Array.from({ length: 20 }, () => Array(20).fill(0)),
        floorTiles: [{ x: 8, y: 8 }], start: { x: 0, y: 0 }, exit: { x: 19, y: 19 },
        player: { x: 4.5, y: 8.5, facing: 0 },
      };
      world.grid[7][8] = 1; // One deterministic roadside tile supplies both props.
      const grounds = [], horizontal = [];
      for (const camera of [{ x: 4.5, facing: 0 }, { x: 6.5, facing: 0 }, { x: 4.5, facing: .2 }]) {
        Object.assign(world.player, camera);
        const props = collectVisualDecorations3D(world);
        assert.equal(props.length, 2, "the real collector produces the roadside sign and lamp");
        const expected = projectScenePoint(world.player, [8.5, 8.5, 0]);
        for (const prop of props) {
          assert.equal(prop.type, "decoration");
          close(prop.projection.depth, expected.depth);
          close(prop.projection.scale, expected.scale);
          const translations = [];
          const ctx = new Proxy({}, { get(_target, name) {
            if (name === "translate") return (...point) => translations.push(point);
            if (name === "createLinearGradient" || name === "createRadialGradient") return () => ({ addColorStop() {} });
            return () => {};
          } });
          prop.draw(ctx);
          close(translations[0][0], expected.screenX);
          close(translations[0][1], expected.screenY);
          close(translations[0][1], sceneScreenY(prop.projection.scale));
        }
        grounds.push(expected.screenY); horizontal.push(expected.screenX);
      }
      assert.ok(grounds[1] > grounds[0], "closer ground props move downward with perspective");
      assert.notEqual(horizontal[2], horizontal[0], "turning changes their screen position");
    });

    const fixture = () => ({
      player: { x: 0, y: 0, facing: 0 }, time: 0, level: { themeKey: "city" },
      exit: { x: -4, y: 0 }, enemies: [], pickups: [], projectiles: [], effects: [], labelsOn: false,
    });
    const zBuffer = () => new Float32Array(Math.ceil(CANVAS_WIDTH / VIEW_3D_RAY_WIDTH)).fill(28);
    await t.test("a wall clips decoration pixels while a visible edge survives", () => {
      const world = fixture(), z = zBuffer();
      registry.registerSceneDecorations3D(() => [{ type: "decoration", projection: { depth: 4, distance: 4, screenX: 420, scale: plane / 4 }, draw(ctx) { ctx.probe("center", 420, 450); ctx.probe("edge", 650, 450); } }]);
      const open = clippingProbe(); draw3DSprites(open, world, z, plane);
      assert.deepEqual(open.visible, ["center", "edge"]);
      for (let ray = 100; ray <= 190; ray++) z[ray] = 2;
      const corner = clippingProbe(); draw3DSprites(corner, world, z, plane);
      assert.deepEqual(corner.visible, ["edge"], "decorations use the same partial wall mask as ordinary sprites");
      z.fill(2);
      const hidden = clippingProbe(); draw3DSprites(hidden, world, z, plane);
      assert.deepEqual(hidden.visible, [], "a fully occluded decoration cannot leak into an overlay");
      registry.registerSceneDecorations3D(null);
      const removed = clippingProbe(); draw3DSprites(removed, world, zBuffer(), plane);
      assert.deepEqual(removed.visible, []);
    });

    await t.test("decorations sort on both sides of a normal pickup in the shared entity pass", () => {
      const world = fixture();
      world.pickups = [{ x: 4, y: 0, type: "labyrinthLight", color: "#facc15" }];
      registry.registerSceneDecorations3D(() => [2, 6].map((depth) => ({
        type: "decoration", projection: { depth, distance: depth, screenX: 420, scale: plane / depth },
        draw(ctx) { ctx.order.push(depth === 6 ? "far decoration" : "near decoration"); },
      })));
      const ctx = clippingProbe();
      draw3DSprites(ctx, world, zBuffer(), plane);
      assert.deepEqual(ctx.order, ["far decoration", "pickup", "pickup", "near decoration"], "decorations cannot all paint over closer pickups in a later pass");
    });
  } finally {
    const registry = await server.ssrLoadModule("/src/game/sceneDecorations3D.js");
    registry.registerSceneDecorations3D(null);
    await server.close();
  }
});
