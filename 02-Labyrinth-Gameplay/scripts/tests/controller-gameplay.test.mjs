import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "vite";

const approx = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("controller movement uses the real base-maze world and gameplay alias chain", async (t) => {
  const previousWorld = globalThis.__mistMazeWorld;
  const server = await createServer({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    cacheDir: "/tmp/mist-controller-gameplay-test-cache",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": '""',
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '""',
    },
  });
  try {
    const { createWorld } = await server.ssrLoadModule("/src/game/world-enhanced.js");
    const { updatePlayer, getPlayerSpeed } = await server.ssrLoadModule("/src/game/gameplay-2.0.js");
    const { FLOOR, WALL } = await server.ssrLoadModule("/src/config/constants.js");

    function arena(level = "level0", mode = "2d", playerName = "Controller movement test") {
      const world = createWorld(level, mode, playerName);
      // Isolate movement from generated corridor placement, while retaining
      // the real world's player, Labyrinth state, and layered gameplay code.
      world.grid = Array.from({ length: world.height }, (_, y) => Array.from({ length: world.width }, (_, x) =>
        !x || !y || x === world.width - 1 || y === world.height - 1 ? WALL : FLOOR));
      world.enemies = [];
      world.pickups = [];
      world.player.cosmetic = null;
      world.player.powerUps = {};
      world.pointer.inside = false;
      world.pointer.down = false;
      world.leaderboardEligible = false;
      world.__leaderboardRunStarted = true;
      return world;
    }

    function move(world, keys, { dt = 0.2, facing = 0 } = {}) {
      world.player.x = 10.5;
      world.player.y = 10.5;
      world.player.facing = facing;
      updatePlayer(world, keys, dt);
      return { x: world.player.x - 10.5, y: world.player.y - 10.5, facing: world.player.facing };
    }

    await t.test("full and half stick travel at the existing speed in all five mazes and both views", () => {
      for (const level of ["level0", "level1", "level2", "level3", "labyrinth"]) {
        for (const mode of ["2d", "3d"]) {
          const world = arena(level, mode);
          const speed = getPlayerSpeed(world);
          const full = move(world, { controllerMove: mode === "3d" ? { x: 0, y: -1 } : { x: 1, y: 0 } });
          const half = move(world, { controllerMove: mode === "3d" ? { x: 0, y: -0.5 } : { x: 0.5, y: 0 } });
          approx(full.x, speed * 0.2); approx(full.y, 0);
          approx(half.x, speed * 0.1); approx(half.y, 0);
          approx(getPlayerSpeed(world), speed);
        }
      }
    });

    await t.test("diagonals remain capped and smaller vectors preserve their exact direction and magnitude", () => {
      for (const mode of ["2d", "3d"]) {
        const world = arena("level1", mode);
        const distance = getPlayerSpeed(world) * 0.2;
        const diagonal = move(world, { controllerMove: { x: 1, y: 1 } });
        approx(Math.hypot(diagonal.x, diagonal.y), distance);
        approx(diagonal.x, distance * Math.SQRT1_2 * (mode === "3d" ? -1 : 1));
        approx(diagonal.y, distance * Math.SQRT1_2);
        const partial = move(world, { controllerMove: { x: 0.3, y: 0.4 } });
        approx(partial.x, distance * (mode === "3d" ? -0.4 : 0.3));
        approx(partial.y, distance * (mode === "3d" ? 0.3 : 0.4));
        approx(Math.hypot(partial.x, partial.y), distance * 0.5);
      }
    });

    await t.test("3D movement rotates forward and strafe with the current camera heading", () => {
      const world = arena("level2", "3d");
      const distance = getPlayerSpeed(world) * 0.2;
      const result = move(world, { controllerMove: { x: 0.3, y: -0.4 } }, { facing: Math.PI / 2 });
      approx(result.x, -distance * 0.3);
      approx(result.y, distance * 0.4);
      approx(result.facing, Math.PI / 2);
    });

    await t.test("analog input retains wall collision and diagonal wall sliding", () => {
      for (const level of ["level0", "labyrinth"]) for (const mode of ["2d", "3d"]) {
        const world = arena(level, mode);
        for (const row of world.grid) row[11] = WALL;
        const beforeGrid = JSON.stringify(world.grid);
        const intoWall = move(world, { controllerMove: mode === "3d" ? { x: 0, y: -1 } : { x: 1, y: 0 } });
        assert.ok(world.player.x + world.player.radius < 11);
        assert.ok(intoWall.x >= 0);
        approx(intoWall.y, 0);
        const slide = move(world, { controllerMove: mode === "3d" ? { x: 1, y: -1 } : { x: 1, y: 1 } });
        assert.ok(world.player.x + world.player.radius < 11);
        assert.ok(slide.y > 0);
        assert.equal(JSON.stringify(world.grid), beforeGrid);
      }
    });

    await t.test("keyboard and touch directions override analog without changing digital speed or cancellation", () => {
      for (const mode of ["2d", "3d"]) {
        const world = arena("level3", mode);
        const distance = getPlayerSpeed(world) * 0.2;
        const keyboard = move(world, { w: true });
        const mixed = move(world, { w: true, controllerMove: { x: 1, y: 1 } });
        approx(mixed.x, keyboard.x); approx(mixed.y, keyboard.y);
        approx(Math.hypot(mixed.x, mixed.y), distance);
        const diagonal = move(world, { w: true, d: true, controllerMove: { x: 0.01, y: 0 } });
        approx(Math.hypot(diagonal.x, diagonal.y), distance);
        const cancelled = move(world, { w: true, s: true, controllerMove: { x: 1, y: 0 } });
        approx(cancelled.x, 0); approx(cancelled.y, 0);
        const arrows = move(world, { ArrowUp: true, controllerMove: { x: 1, y: 1 } });
        approx(arrows.x, keyboard.x); approx(arrows.y, keyboard.y);
      }
    });

    await t.test("2D controller aim retains its heading while walking and releases it back to ordinary movement", () => {
      const world = arena();
      world.controllerAimActive = true;
      approx(move(world, { controllerMove: { x: 1, y: 0 } }, { facing: -1.2 }).facing, -1.2);
      approx(move(world, { w: true }, { facing: -1.2 }).facing, -1.2);
      world.controllerAimActive = false;
      approx(move(world, { controllerMove: { x: 1, y: 0 } }, { facing: -1.2 }).facing, 0);
      world.touchAimActive = true;
      approx(move(world, { controllerMove: { x: 1, y: 0 } }, { facing: -1.2 }).facing, -1.2);
    });

    await t.test("the existing special movement path keeps its threefold speed, analog magnitude, and aim without moving twice", () => {
      for (const mode of ["2d", "3d"]) {
        const world = arena("level0", mode, "Asher");
        const distance = world.player.speed * 3 * 0.2;
        world.controllerAimActive = true;
        const partial = move(world, { controllerMove: { x: 0.3, y: 0.4 } });
        assert.equal(world.__jojoMode, true);
        approx(partial.x, distance * (mode === "3d" ? -0.4 : 0.3));
        approx(partial.y, distance * (mode === "3d" ? 0.3 : 0.4));
        approx(Math.hypot(partial.x, partial.y), distance * 0.5);
        approx(partial.facing, 0);
        const keyboard = move(world, { w: true, controllerMove: { x: 1, y: 1 } });
        approx(Math.hypot(keyboard.x, keyboard.y), distance);
      }
    });

    await t.test("missing or malformed analog values never move the player or produce non-finite coordinates", () => {
      const world = arena();
      for (const keys of [{}, { controllerMove: null }, { controllerMove: { x: NaN, y: Infinity } }]) {
        const result = move(world, keys);
        approx(result.x, 0); approx(result.y, 0);
      }
    });
  } finally {
    if (previousWorld === undefined) delete globalThis.__mistMazeWorld;
    else globalThis.__mistMazeWorld = previousWorld;
    await server.close();
  }
});
