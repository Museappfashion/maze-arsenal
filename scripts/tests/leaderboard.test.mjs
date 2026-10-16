import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const mockClientId = "\0leaderboard-test-supabase";
const modes = ["2d", "3d"];
const levels = ["level0", "level1", "level2", "level3"];

function entries(level, mode, count = 12) {
  return Array.from({ length: count }, (_, index) => ({
    time: 100 + index,
    completedAt: `2026-10-01T00:00:${String(index).padStart(2, "0")}Z`,
    playerName: `${level}-${mode}-${index + 1}`,
    countryCode: "US",
    globalRank: index + 1,
    isCurrentUser: false,
  })).reverse();
}

function boards() {
  return Object.fromEntries(levels.map(level => [level,
    Object.fromEntries(modes.map(mode => [mode, entries(level, mode)])),
  ]));
}

// Use the production aliases and real render functions, mocking only the
// Supabase transport. No network requests or database writes are performed.
test("leaderboard and anonymous identity regressions", async t => {
  const server = await createServer({
    root,
    cacheDir: "node_modules/.vite-leaderboard-test",
    envDir: false,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ["@supabase/supabase-js"] },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": '"https://leaderboard-test.invalid"',
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '"test-publishable-key"',
    },
    plugins: [{
      name: "leaderboard-test-transport",
      enforce: "pre",
      resolveId(id) {
        if (id === "@supabase/supabase-js") return mockClientId;
      },
      load(id) {
        if (id === mockClientId) return `
          export function createClient() {
            return {
              auth: {
                async getSession() { return { data: { session: { user: { id: "player" } } }, error: null }; },
                async signInAnonymously() { throw new Error("Unexpected sign-in"); },
              },
              async rpc() { throw new Error("Unmocked RPC"); },
            };
          }
        `;
      },
    }],
  });
  const previousWindow = globalThis.window;

  try {
    const core = await server.ssrLoadModule("/src/services/leaderboard.js?core");
    const enhanced = await server.ssrLoadModule("/src/services/leaderboard.js");
    assert.equal(enhanced.supabase, core.supabase, "all callers must share one client/session guard");
    const originalGetSession = core.supabase.auth.getSession;
    const storage = new Map();
    globalThis.window = {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
    };

    await t.test("ten sorted entries survive normalization, save, and reload for all eight lists", () => {
      const normalized = core.normalizeLeaderboards(boards());
      for (const level of levels) {
        for (const mode of modes) {
          assert.equal(normalized[level][mode].length, 10);
          assert.deepEqual(normalized[level][mode].map(entry => entry.time),
            Array.from({ length: 10 }, (_, index) => 100 + index));
          assert.equal(normalized[level][mode][9].playerName, `${level}-${mode}-10`);
        }
      }
      core.saveLeaderboards(normalized);
      assert.deepEqual(core.loadLeaderboards(), normalized);
      assert.deepEqual(core.loadLeaderboards(), normalized, "repeated cache loads must not shrink lists");
    });

    await t.test("legacy array caches retain their ten 2D entries during migration", () => {
      storage.clear();
      storage.set(core.LEGACY_LEADERBOARD_STORAGE_KEY, JSON.stringify({ level1: entries("level1", "2d") }));
      const migrated = core.loadLeaderboards();
      assert.equal(migrated.level1["2d"].length, 10);
      assert.deepEqual(migrated.level1["3d"], []);
      assert.equal(JSON.parse(storage.get(core.LEADERBOARD_STORAGE_KEY)).level1["2d"].length, 10);
    });

    await t.test("a personal-best update preserves opponents, other modes, and other mazes", () => {
      const current = core.normalizeLeaderboards(boards());
      current.level1["2d"][5].isCurrentUser = true;
      const updated = core.addLeaderboardTime(current, "level1", "2d", 102.5, "My improved best");
      assert.equal(updated.level1["2d"].length, 10);
      assert.equal(updated.level1["2d"][3].playerName, "My improved best");
      assert.equal(updated.level1["2d"][3].globalRank, null);
      assert.equal(updated.level1["2d"].filter(entry => entry.isCurrentUser).length, 1);
      assert.equal(updated.level1["2d"].filter(entry => !entry.isCurrentUser).length, 9);
      assert.deepEqual(updated.level1["3d"], current.level1["3d"]);
      for (const level of ["level0", "level2", "level3"]) assert.deepEqual(updated[level], current[level]);
      assert.equal(core.addLeaderboardTime(updated, "level1", "2d", 104, "Slower run"), updated);

      const newWinner = core.addLeaderboardTime(updated, "level1", "2d", 95, "New winner");
      assert.equal(newWinner.level1["2d"].length, 10, "beating rank one must not erase the other nine");
      assert.equal(newWinner.level1["2d"][0].playerName, "New winner");
    });

    await t.test("local personal best and ineligible-maze rules stay unchanged", () => {
      const first = core.addLeaderboardTime(core.createEmptyLeaderboards(), "level0", "3d", 90, "Player");
      assert.equal(first.level0["3d"].length, 1);
      assert.equal(core.addLeaderboardTime(first, "level0", "3d", 92, "Player"), first);
      const improved = core.addLeaderboardTime(first, "level0", "3d", 80, "Player");
      assert.equal(improved.level0["3d"].length, 1);
      assert.equal(improved.level0["3d"][0].time, 80);
      assert.equal(core.addLeaderboardTime(first, "labyrinth", "3d", 70, "Player"), first);
    });

    await t.test("RPC results reach all ten visible rows for every maze and mode", async () => {
      const rows = levels.flatMap(level => modes.flatMap(mode => entries(level, mode).map(entry => ({
        level_key: level, mode, player_name: entry.playerName,
        country_code: "us", time_seconds: String(entry.time),
        created_at: entry.completedAt, global_rank: String(entry.globalRank),
        is_current_user: false,
      }))));
      rows.push({ level_key: "level3", mode: "3d", player_name: "Outside top ten", country_code: "GB",
        time_seconds: "140", created_at: "2026-10-01T00:01:00Z", global_rank: "21", is_current_user: true });
      core.supabase.rpc = async name => {
        assert.equal(name, "get_global_leaderboard");
        return { data: rows, error: null };
      };
      const state = await core.fetchGlobalLeaderboards();
      assert.deepEqual(state.userRanks.level3["3d"], { rank: 21, bestTime: 140 });
      const { LeaderboardPanel } = await server.ssrLoadModule("/src/components/LevelSelectScreen.jsx?core");
      const html = renderToStaticMarkup(createElement(LeaderboardPanel, { ...state, status: "online" }));
      assert.equal((html.match(/class="leaderboard-player-name"/g) ?? []).length, 80);
      for (const level of levels) {
        for (const mode of modes) {
          assert.equal(state.leaderboards[level][mode].length, 10);
          for (let rank = 1; rank <= 10; rank += 1) assert.ok(html.includes(`>${level}-${mode}-${rank}</span>`));
          assert.ok(!html.includes(`>${level}-${mode}-11</span>`));
        }
      }
      assert.ok(html.includes("#21"), "the player's own rank outside top ten stays visible separately");
      core.saveLeaderboards(state.leaderboards);
      assert.deepEqual(core.loadLeaderboards(), state.leaderboards);
    });

    await t.test("concurrent inbox, analytics, and leaderboard startup share a single anonymous identity", async () => {
      let checks = 0;
      let signIns = 0;
      let session = null;
      core.supabase.auth.getSession = async () => {
        checks += 1;
        return { data: { session }, error: null };
      };
      core.supabase.auth.signInAnonymously = async () => {
        signIns += 1;
        session = { user: { id: `anonymous-${signIns}` }, access_token: "anonymous-token" };
        return { data: { session }, error: null };
      };
      const sessions = await Promise.all(Array.from({ length: 12 }, () => core.ensureGlobalLeaderboardSession()));
      assert.equal(checks, 1);
      assert.equal(signIns, 1);
      for (const result of sessions) assert.equal(result, session);
      await core.ensureGlobalLeaderboardSession();
      assert.equal(checks, 2, "later requests recheck the persisted session instead of reusing a stale token");
      assert.equal(signIns, 1);
      core.supabase.auth.getSession = originalGetSession;
    });

    await t.test("a failed session attempt can be retried", async () => {
      core.supabase.auth.getSession = async () => ({ data: { session: null }, error: new Error("Temporary auth failure") });
      await assert.rejects(core.ensureGlobalLeaderboardSession(), /Temporary auth failure/);
      core.supabase.auth.getSession = originalGetSession;
      assert.equal((await core.ensureGlobalLeaderboardSession()).user.id, "player");
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    await server.close();
  }
});
