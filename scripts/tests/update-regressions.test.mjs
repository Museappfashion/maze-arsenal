import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { getLeaderboardDisplayName } from "../../src/utils/player.js";

test("October update: currencies, characters, supplies, powers, and 30-second shifts", async (t) => {
  const values = new Map();
  const previousWindow = globalThis.window, previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  globalThis.window = { localStorage: storage, dispatchEvent() {} };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  const server = await createServer({ root: fileURLToPath(new URL("../../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true, include: [] }, define: { "import.meta.env.VITE_SUPABASE_URL": '""', "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '""' } });
  try {
    const economy = await server.ssrLoadModule("/src/services/mizEconomy.js");
    const characters = await server.ssrLoadModule("/src/services/characterCosmetics.js");
    const { CHARACTER_COSMETICS } = await server.ssrLoadModule("/src/config/turkeyCosmetic.js");
    const { createWorld } = await server.ssrLoadModule("/src/game/world-enhanced.js");
    const { activateMystPower } = await server.ssrLoadModule("/src/game/mystPowers.js");
    const gameplay = await server.ssrLoadModule("/src/game/gameplay-2.0.js");
    const labyrinth = await server.ssrLoadModule("/src/game/labyrinth-enhanced.js");
    const reset = (extra = {}) => economy.saveMizState({ miz: 5000, cosmetics: {}, consumables: {}, equippedCharacter: null, legacyTurkeyMigrated: true, ...extra });
    const make = () => { const world = createWorld("level0"); world.enemies = []; return world; };
    const own = (key, count = 1) => { const state = economy.loadMizState(); economy.saveMizState({ ...state, consumables: { ...state.consumables, [key]: count } }); };

    await t.test("legacy turkey owners keep their unlock without paying MIZ or spending hux again", () => {
      values.clear(); reset({ miz: 23, legacyTurkeyMigrated: false });
      const legacy = JSON.stringify({ hux: 45, cosmetics: { turkey: true }, equippedCosmetic: "turkey", inventory: { speed: 2 } });
      values.set("mist-maze-thanksgiving-hux-v1", legacy);
      const migrated = characters.loadCharacterCosmeticState();
      assert.equal(migrated.cosmetics.turkey, true); assert.equal(migrated.equippedCharacter, "turkey"); assert.equal(migrated.miz, 23);
      assert.equal(characters.loadCharacterCosmeticState().miz, 23); assert.equal(values.get("mist-maze-thanksgiving-hux-v1"), legacy);
    });
    await t.test("alien costs MIZ and turkey costs hux, equip only one, and support plain City looks", () => {
      reset({ miz: 10000 });
      values.set("mist-maze-thanksgiving-hux-v1", JSON.stringify({ hux: 1000 }));
      assert.equal(economy.purchaseMystItem("turkey").ok, false);
      assert.equal(characters.buyCharacterCosmetic("turkey").ok, true);
      assert.equal(characters.loadCharacterCosmeticState().hux, 0);
      assert.equal(economy.loadMizState().miz, 10000);
      assert.equal(characters.buyCharacterCosmetic("alien").ok, true);
      let state = economy.loadMizState(); assert.equal(state.miz, 0); assert.equal(state.equippedCharacter, "alien");
      assert.equal(state.cosmetics.turkey, true); assert.equal(state.cosmetics.alien, true);
      assert.equal(characters.buyCharacterCosmetic("alien").ok, false);
      assert.equal(characters.buyCharacterCosmetic("turkey").ok, false);
      assert.equal(characters.loadCharacterCosmeticState().hux, 0);
      for (const key of ["level0", "level1", "level2", "level3"]) assert.equal(createWorld(key).player.cosmetic, "alien");
      characters.setCharacterCosmeticEquipped("turkey"); assert.equal(createWorld("level0").player.cosmetic, "turkey");
      characters.setCharacterCosmeticEquipped(null); assert.equal(createWorld("level0").player.cosmetic, null);
      assert.equal(characters.getPlayerCosmeticForTheme("labyrinth"), null);
    });
    await t.test("unaffordable and unowned characters leave wallets unchanged", () => {
      reset({ miz: 9999 }); values.set("mist-maze-thanksgiving-hux-v1", JSON.stringify({ hux: 999 })); const before = economy.loadMizState();
      assert.equal(characters.buyCharacterCosmetic("alien").ok, false);
      assert.equal(characters.buyCharacterCosmetic("turkey").ok, false);
      assert.equal(characters.loadCharacterCosmeticState().hux, 999);
      assert.equal(characters.setCharacterCosmeticEquipped("alien").ok, false);
      assert.deepEqual(economy.loadMizState(), before);
    });
    await t.test("three permanent full-player cosmetics persist, equip in all four combat mazes, and leave gameplay stats unchanged", () => {
      reset();
      const statKeys = ["hp", "maxHp", "baseMaxHp", "ammo", "radius", "speed", "ownedWeapons", "powerUps"];
      const stats = (world) => Object.fromEntries(statKeys.map((key) => [key, world.player[key]]));
      const baseline = Object.fromEntries(["level0", "level1", "level2", "level3"].map((key) => [key, stats(createWorld(key))]));
      const newCosmetics = CHARACTER_COSMETICS.filter((item) => ["shadowWisp", "emberSpirit", "crystalGuardian"].includes(item.key));
      assert.equal(newCosmetics.length, 3);
      reset({ miz: 17500, cosmetics: { turkey: true, alien: true, violetCoinEdge: true }, consumables: { nullPulse: 2 } });
      let balance = 17500;
      for (const item of newCosmetics) {
        assert.equal(item.currency, "miz");
        assert.equal(characters.buyCharacterCosmetic(item.key).ok, true);
        balance -= item.price;
        const saved = JSON.parse(values.get("mist-maze-miz-economy-v3"));
        assert.equal(saved.miz, balance); assert.equal(saved.cosmetics[item.key], true); assert.equal(saved.equippedCharacter, item.key);
        assert.equal(characters.buyCharacterCosmetic(item.key).ok, false);
        assert.equal(economy.loadMizState().miz, balance);
        for (const key of Object.keys(baseline)) {
          const world = createWorld(key);
          assert.equal(world.player.cosmetic, item.key);
          assert.deepEqual(stats(world), baseline[key]);
        }
        characters.setCharacterCosmeticEquipped(null);
        assert.equal(createWorld("level0").player.cosmetic, null);
        characters.setCharacterCosmeticEquipped(item.key);
        assert.equal(characters.loadCharacterCosmeticState().equippedCharacter, item.key);
      }
      const final = economy.loadMizState();
      assert.equal(final.cosmetics.turkey, true); assert.equal(final.cosmetics.alien, true); assert.equal(final.cosmetics.violetCoinEdge, true);
      assert.equal(final.consumables.nullPulse, 2); assert.equal(final.miz, 0);
      assert.equal(characters.getPlayerCosmeticForTheme("labyrinth"), null);
      const unowned = reset({ cosmetics: { turkey: true } });
      assert.equal(characters.setCharacterCosmeticEquipped("shadowWisp").ok, false);
      assert.deepEqual(economy.loadMizState(), unowned);
    });
    await t.test("one-use powers have substantial prices and charge exactly the listed amount while preserving existing stock", () => {
      const prices = { ammoPulse: 250, healPulse: 350, vitalBloom: 600, velocityBloom: 650, nullPulse: 800, mapFlash: 1000, purgeOrb: 1250, arsenalKey: 1500, phoenixSpark: 2000, exitFold: 2500 };
      const items = economy.MYST_SHOP_ITEMS.filter((item) => item.kind === "oneTime");
      assert.equal(items.length, Object.keys(prices).length);
      for (const item of items) {
        assert.equal(item.price, prices[item.key]);
        reset({ miz: item.price - 1, consumables: { [item.key]: 2 } });
        assert.equal(economy.purchaseMystItem(item.key).ok, false);
        assert.equal(economy.getConsumableCount(item.key), 2);
        assert.equal(economy.loadMizState().miz, item.price - 1);
        reset({ miz: item.price, consumables: { [item.key]: 2 } });
        assert.equal(economy.purchaseMystItem(item.key).ok, true);
        assert.equal(economy.loadMizState().miz, 0);
        assert.equal(economy.getConsumableCount(item.key), 3);
      }
    });
    await t.test("all four combat mazes receive fifty extra pickups of each supply on distinct floor tiles", () => {
      reset();
      for (const key of ["level0", "level1", "level2", "level3"]) {
        const world = createWorld(key);
        const extra = world.pickups.filter((pickup) => pickup.extraSupply);
        assert.equal(extra.filter((pickup) => pickup.type === "ammo").length, 50);
        assert.equal(extra.filter((pickup) => pickup.type === "medkit").length, 50);
        assert.equal(new Set(extra.map((p) => `${p.x},${p.y}`)).size, 100);
        for (const p of extra) assert.equal(world.grid[Math.floor(p.y)][Math.floor(p.x)], 0);
      }
    });
    await t.test("every Labyrinth difficulty shifts at 30 and 60 seconds while preserving the player", () => {
      for (const difficulty of ["easy", "normal", "hard", "nightmare"]) {
        const world = createWorld("labyrinth", "2d", "", { difficulty, timeMinutes: 2 });
        assert.equal(world.labyrinth.mutationInterval, 30); assert.equal(world.labyrinth.nextMutationAt, 30);
        assert.equal(world.pickups.some((pickup) => ["ammo", "medkit"].includes(pickup.type)), false);
        const initial = world.grid, x = world.player.x, y = world.player.y;
        world.time = 29.99; labyrinth.updateLabyrinth(world); assert.equal(world.grid, initial);
        world.time = 30; labyrinth.updateLabyrinth(world); assert.notEqual(world.grid, initial);
        assert.equal(world.labyrinth.nextMutationAt, 60); assert.equal(world.player.x, x); assert.equal(world.player.y, y);
        const shifted = world.grid; world.time = 60; labyrinth.updateLabyrinth(world); assert.notEqual(world.grid, shifted);
      }
    });
    await t.test("powers consume only when usable; Mist Guard actually prevents damage", () => {
      reset(); let world = make(); own("healPulse", 2); own("ammoPulse"); own("nullPulse");
      assert.equal(activateMystPower(world, "healPulse").ok, false); assert.equal(economy.getConsumableCount("healPulse"), 2);
      world.player.hp = 20; assert.equal(activateMystPower(world, "healPulse").ok, true); assert.equal(world.player.hp, world.player.maxHp);
      world.player.ammo = 0; activateMystPower(world, "ammoPulse"); assert.equal(world.player.ammo, 200);
      world.projectiles = [{ owner: "enemy" }, { owner: "player" }]; activateMystPower(world, "nullPulse");
      assert.deepEqual(world.projectiles, [{ owner: "player" }]);
      const hp = world.player.hp; gameplay.damagePlayer(world, 20); assert.equal(world.player.hp, hp);
      world.time = 8.1; gameplay.damagePlayer(world, 20); assert.ok(world.player.hp < hp);
      assert.equal(economy.getConsumableCount("nullPulse"), 0);
      assert.ok(economy.MYST_SHOP_ITEMS.filter((item) => item.kind === "oneTime").every((item) => item.price >= 250));
    });
    await t.test("speed and armor have real timed effects; map reveal cannot mint free MIZ", () => {
      reset(); const world = make(); own("velocityBloom"); own("vitalBloom"); own("mapFlash", 2);
      const speed = gameplay.getPlayerSpeed(world); activateMystPower(world, "velocityBloom"); assert.equal(gameplay.getPlayerSpeed(world), speed * 1.75);
      activateMystPower(world, "vitalBloom"); assert.equal(gameplay.getDamageTakenMultiplier(world), .5);
      economy.recordWorldExploration(world); const balance = economy.loadMizState().miz;
      activateMystPower(world, "mapFlash"); economy.recordWorldExploration(world);
      assert.equal(world.player.discoveredFloor, world.floorCount); assert.equal(economy.loadMizState().miz, balance);
      assert.equal(activateMystPower(world, "mapFlash").ok, false); assert.equal(economy.getConsumableCount("mapFlash"), 1);
      world.time = 30.1; assert.equal(gameplay.getPlayerSpeed(world), speed); assert.equal(gameplay.getDamageTakenMultiplier(world), 1);
    });
    await t.test("arsenal, purge, protected revival, and exit fold perform their listed effects", () => {
      reset(); const world = make(); for (const key of ["arsenalKey", "purgeOrb", "phoenixSpark", "exitFold"]) own(key);
      activateMystPower(world, "arsenalKey"); assert.equal(Object.values(world.player.ownedWeapons).filter(Boolean).length >= 9, true);
      world.enemies = Array.from({ length: 10 }, (_, i) => ({ x: i + 2, y: 2, hp: 10, kind: i === 0 ? "warden" : "runner" }));
      activateMystPower(world, "purgeOrb"); assert.equal(world.enemies.filter((enemy) => enemy.hp === 0).length, 8); assert.equal(world.enemies[0].hp, 10);
      assert.equal(activateMystPower(world, "phoenixSpark").ok, false);
      world.gameOver = true; world.player.hp = 0; activateMystPower(world, "phoenixSpark");
      assert.equal(world.gameOver, false); assert.equal(world.player.hp, world.player.maxHp / 2); assert.equal(world.leaderboardEligible, false);
      activateMystPower(world, "exitFold"); assert.equal(world.player.x, world.exit.x + .5); assert.equal(world.player.y, world.exit.y + .5);
      assert.equal(world.leaderboardEligible, false);
    });
  } finally {
    await server.close(); globalThis.window = previousWindow;
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage); else delete globalThis.localStorage;
  }
});

test("ranking labels distinguish unnamed opponents and identify your named entry without duplicating You", () => {
  assert.equal(getLeaderboardDisplayName({ playerName: "Other Player", isCurrentUser: false }), "Other Player");
  assert.equal(getLeaderboardDisplayName({ playerName: "You", isCurrentUser: false }), "Random Player");
  assert.equal(getLeaderboardDisplayName({ playerName: "Sara", isCurrentUser: true }), "Sara (you)");
  assert.equal(getLeaderboardDisplayName({ playerName: "You", isCurrentUser: true }), "You");
  assert.equal(getLeaderboardDisplayName({ playerName: "you", isCurrentUser: true }), "you");
});
