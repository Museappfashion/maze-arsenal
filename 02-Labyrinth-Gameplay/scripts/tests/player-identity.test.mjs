import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const identityUrl = new URL("../../src/services/playerIdentity.js", import.meta.url);

test("first-time identity saves one sanitized name, migrates named profiles and preserves unrelated progress", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map([["cube-save", "existing climb"], ["wallet-save", "existing coins"]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try {
    const progress = await import("../../src/services/playerProgress.js");
    const identity = await import(`${identityUrl.href}?fresh`);
    assert.equal(identity.getPlayerIdentity(), "", "an unknown player must enter a name");
    assert.equal(identity.savePlayerIdentity("   "), "", "blank input does not complete first-time entry");
    assert.equal(identity.savePlayerIdentity("  Cedar\n  Runner  "), "Cedar Runner");
    assert.equal(identity.getPlayerIdentity(), "Cedar Runner");
    assert.equal(identity.savePlayerIdentity(""), "");
    assert.equal(identity.getPlayerIdentity(), "Cedar Runner", "blank rename cannot erase identity");
    const reloaded = await import(`${identityUrl.href}?reload`);
    assert.equal(reloaded.getPlayerIdentity(), "Cedar Runner", "reload skips the first-time prompt");
    assert.equal(reloaded.savePlayerIdentity("123456789012345678901234"), "12345678901234567890");
    assert.equal(values.get("cube-save"), "existing climb");
    assert.equal(values.get("wallet-save"), "existing coins");

    await t.test("existing named progress migrates without a fresh prompt", async () => {
      values.delete(identity.PLAYER_IDENTITY_KEY);
      progress.selectProgressPlayer("  Existing   Scout ");
      const snapshot = new Map(values);
      const migrated = await import(`${identityUrl.href}?migration`);
      assert.equal(migrated.getPlayerIdentity(), "Existing Scout");
      for (const [key, value] of snapshot) assert.equal(values.get(key), value, `migration preserves ${key}`);
      assert.equal(JSON.parse(values.get(identity.PLAYER_IDENTITY_KEY)).playerName, "Existing Scout");
    });
    await t.test("denied storage still allows a usable identity for this session", async () => {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Storage disabled"); } });
      const fallback = await import(`${identityUrl.href}?denied`);
      assert.equal(fallback.savePlayerIdentity("Offline Explorer"), "Offline Explorer");
      assert.equal(fallback.getPlayerIdentity(), "Offline Explorer");
    });
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete globalThis.localStorage;
  }
});

test("first identity adopts anonymous unlock time once using the maximum and never copies it into later names", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const progress = await import("../../src/services/playerProgress.js");
  try {
    for (const existing of [0, 9000]) {
      const values = new Map([
        [progress.PLAYER_PROGRESS_KEY, JSON.stringify({ profiles: { "p:(anonymous)": { seconds: 7200 }, "p:first name": { seconds: existing }, "p:other player": { seconds: 1234 } }, lastPlayerName: "" })],
        ["miz-wallet", "owned cosmetics and coins"], ["cube-save", "saved climb"],
      ]);
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value) } });
      const identity = await import(`${identityUrl.href}?adoption-${existing}`);
      assert.equal(identity.savePlayerIdentity("First Name"), "First Name");
      assert.equal(progress.getPlayerProgress("First Name").playedSeconds, Math.max(existing, 7200));
      assert.equal(progress.getPlayerProgress("First Name").hundredFloor, true);
      assert.equal(progress.getPlayerProgress("").playedSeconds, 7200, "the old anonymous record is preserved");
      assert.equal(progress.getPlayerProgress("Other Player").playedSeconds, 1234);
      assert.equal(values.get("miz-wallet"), "owned cosmetics and coins"); assert.equal(values.get("cube-save"), "saved climb");
      identity.savePlayerIdentity("Second Name");
      assert.equal(progress.getPlayerProgress("Second Name").playedSeconds, 0, "renaming cannot copy anonymous time again");
      const reloadedProgress = await import(`../../src/services/playerProgress.js?adoption-reload-${existing}`);
      assert.equal(reloadedProgress.adoptAnonymousPlaytime("Third Name"), false, "the durable progress receipt survives reload");
      assert.equal(reloadedProgress.getPlayerProgress("Third Name").playedSeconds, 0);
      values.delete(identity.PLAYER_IDENTITY_KEY);
      const record=JSON.parse(values.get(progress.PLAYER_PROGRESS_KEY));record.lastPlayerName="";values.set(progress.PLAYER_PROGRESS_KEY,JSON.stringify(record));
      const lostIdentity = await import(`${identityUrl.href}?lost-key-${existing}`);
      lostIdentity.savePlayerIdentity("Fourth Name");
      assert.equal(progress.getPlayerProgress("Fourth Name").playedSeconds, 0, "losing the separate identity key cannot farm new unlocked profiles");
      assert.equal(progress.getPlayerProgress("First Name").playedSeconds, Math.max(existing,7200));
    }
  } finally {
    if(previous)Object.defineProperty(globalThis,"localStorage",previous);else delete globalThis.localStorage;
  }
});

test("visitor identification and otherwise unnamed analytics requests send the saved player name", async () => {
  const oldFetch = globalThis.fetch;
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map([["mist-maze-player-identity-v1", JSON.stringify({ version: 1, playerName: "First Entry" })]]);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value) } });
  const calls = [];
  let savedSeconds = 3721;
  let reads = 0;
  let holdHeartbeat;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/developer-usage");
    assert.equal(options.headers.Authorization, "Bearer verified-session");
    if (options.method !== "POST") {
      reads++;
      return new Response(JSON.stringify({ playedSeconds: savedSeconds }));
    }
    const event = JSON.parse(options.body);
    calls.push(event);
    if (event.eventType === "playtime" && holdHeartbeat) {
      await holdHeartbeat(event.seconds);
      savedSeconds += event.seconds;
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const stub = "virtual:identity-analytics-session";
  const server = await createServer({
    root: fileURLToPath(new URL("../../", import.meta.url)), cacheDir: "/tmp/mist-player-identity-test-cache",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{ name: "identity-analytics-session", enforce: "pre",
      resolveId(id) { if (id === stub) return "\0" + id; },
      load(id) { if (id === "\0" + stub) return 'export const supabase={auth:{refreshSession:async()=>({data:{session:{access_token:"verified-session"}}})}};export async function ensureGlobalLeaderboardSession(){return {access_token:"verified-session"};}'; },
      transform(source, id) { if (id.endsWith("/src/services/developerAnalytics.js")) return source.replace('"./leaderboard-enhanced.js"', JSON.stringify(stub)); },
    }],
  });
  try {
    const analytics = await server.ssrLoadModule("/src/services/developerAnalytics.js");
    const identity = await server.ssrLoadModule("/src/services/playerIdentity.js");
    assert.equal(await analytics.recordVisitorSeen(), true);
    assert.equal(await analytics.recordDonationAttempt("1"), true);
    assert.equal(await analytics.recordGameStarted({}), true);
    assert.equal(await analytics.recordPlaySeconds({}, 12), true);
    assert.deepEqual(calls.map(call=>call.playerName), Array(4).fill("First Entry"));
    assert.equal(calls[0].eventType, "visitor", "identity reaches developer analytics before starting a game");
    identity.savePlayerIdentity("Renamed Explorer");
    await analytics.recordVisitorSeen("Renamed Explorer");
    await analytics.recordDonationAttempt("custom");
    assert.equal(calls.at(-1).playerName, "Renamed Explorer", "later unnamed events cannot erase the chosen name");
    await analytics.recordGameStarted({ playerName: " \n " });
    assert.equal(calls.at(-1).playerName, "Renamed Explorer", "whitespace-only analytics cannot erase identity");
    await analytics.recordGameStarted({ playerName: "Explicit Run" });
    assert.equal(calls.at(-1).playerName, "Explicit Run");

    const progress = await server.ssrLoadModule("/src/services/playerProgress.js");
    await analytics.refreshPlayerPlaytime();
    assert.equal(progress.getPlayerProgress("Explicit Run").playedSeconds, 3721);
    assert.equal(progress.getPlayerProgress("Explicit Run").towerDefense, true);

    let releaseHeartbeat;
    const heartbeat = new Promise((resolve) => { releaseHeartbeat = resolve; });
    holdHeartbeat = async (seconds) => {
      assert.equal(seconds, 2);
      await heartbeat;
    };
    for (let frame = 0; frame < 4; frame++) analytics.recordTrackedPlay("Explicit Run", 0.5);
    analytics.flushTrackedPlay("Explicit Run");
    const refresh = analytics.refreshPlayerPlaytime();
    await new Promise((resolve) => setImmediate(resolve));
    const readsWhileWriting = reads;
    releaseHeartbeat();
    await refresh;
    assert.equal(readsWhileWriting, 1, "the menu waits for the run's final heartbeat");
    assert.equal(progress.getPlayerProgress("Explicit Run").playedSeconds, 3723);
    assert.equal(JSON.parse(values.get(progress.PLAYER_PROGRESS_KEY)).profiles["p:explicit run"].seconds, 2);

    await analytics.refreshPlayerPlaytime();
    assert.equal(progress.getPlayerProgress("Explicit Run").playedSeconds, 3723, "refresh never adds the same history twice");

    const local = JSON.parse(values.get(progress.PLAYER_PROGRESS_KEY));
    local.profiles["p:explicit run"].seconds = 7200;
    values.set(progress.PLAYER_PROGRESS_KEY, JSON.stringify(local));
    assert.equal(progress.getPlayerProgress("Explicit Run").playedSeconds, 3723, "the display matches the saved account total");
    assert.equal(progress.getPlayerProgress("Explicit Run").hundredFloor, true, "an existing local unlock is preserved");
  } finally {
    await server.close(); globalThis.fetch = oldFetch;
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage); else delete globalThis.localStorage;
  }
});
