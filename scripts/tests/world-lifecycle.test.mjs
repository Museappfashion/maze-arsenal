import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const hooksId = "virtual:world-lifecycle-hooks";

// Invoke the real App and its start-game handler while preserving hook state
// across HUD renders. Browser effects are deliberately left to browser tests.
const hooksSource = `
let cursor = 0;
let slots = [];
export function beginRender() { cursor = 0; }
export function resetHooks() { cursor = 0; slots = []; }
export function useRef(initial) {
  const index = cursor++;
  if (!(index in slots)) slots[index] = { current: initial };
  return slots[index];
}
export function useState(initial) {
  const index = cursor++;
  if (!(index in slots)) {
    slots[index] = typeof initial === "function" ? initial() : initial;
  }
  return [slots[index], value => {
    slots[index] = typeof value === "function" ? value(slots[index]) : value;
  }];
}
export function useCallback(callback) { return callback; }
export function useEffect() {}
`;

test("HUD renders preserve the active world used by overlays in 2D and 3D", async () => {
  const server = await createServer({
    root,
    cacheDir: "node_modules/.vite-world-lifecycle-test",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": '""',
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '""',
    },
    plugins: [{
      name: "world-lifecycle-hooks",
      enforce: "pre",
      resolveId(id) {
        if (id === hooksId) return `\0${hooksId}`;
      },
      load(id) {
        if (id === `\0${hooksId}`) return hooksSource;
      },
      transform(source, id) {
        if (id.endsWith("/src/App.jsx")) {
          return source.replace('from "react";', `from "${hooksId}";`);
        }
      },
    }],
  });
  const originalWorld = globalThis.__mistMazeWorld;

  try {
    const hooks = await server.ssrLoadModule(hooksId);
    const { default: App } = await server.ssrLoadModule("/src/App.jsx");
    const render = () => {
      hooks.beginRender();
      return App();
    };

    for (const mode of ["2d", "3d"]) {
      hooks.resetHooks();
      const menu = render();
      menu.props.onSelectLevel("level1", mode, "Render regression");
      const activeWorld = globalThis.__mistMazeWorld;
      activeWorld.time = 17.25;
      activeWorld.player.hp = 71;
      const pickups = activeWorld.pickups;
      const grid = activeWorld.grid;

      for (let refresh = 0; refresh < 30; refresh += 1) {
        const screen = render();
        assert.ok(globalThis.__mistMazeWorld === activeWorld,
          `${mode}: HUD refresh ${refresh} replaced the world used by decorative overlays`);
        assert.ok(screen.props.className.includes(`mode-${mode}`));
        assert.equal(activeWorld.grid, grid);
        assert.equal(activeWorld.pickups, pickups);
        assert.equal(activeWorld.time, 17.25);
        assert.equal(activeWorld.player.hp, 71);
      }

      // Starting another run must replace the world, then keep that one stable.
      menu.props.onSelectLevel("level2", mode, "Render regression");
      const nextWorld = globalThis.__mistMazeWorld;
      assert.notEqual(nextWorld, activeWorld);
      render();
      assert.equal(globalThis.__mistMazeWorld, nextWorld);
      assert.equal(nextWorld.time, 0);
    }
  } finally {
    globalThis.__mistMazeWorld = originalWorld;
    await server.close();
  }
});
