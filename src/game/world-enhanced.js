// src/game/world-enhanced.js
import {
  applyRobbienatorLoadout,
} from "../config/robbienator.js";
import {
  applyAsherLoadout,
} from "../config/specialPlayers.js";
import {
  markLegendaryPowerUps,
} from "../config/legendaryPowerUps.js";
import {
  createWorld as createWorldCore,
  setWorldViewMode as setWorldViewModeCore,
} from "./world.js?core";

export * from "./world.js?core";

function exposeWorld(world) {
  globalThis.__mistMazeWorld = world;
  return world;
}

export function createWorld(...args) {
  const world = createWorldCore(...args);

  world.leaderboardEligible = !world.labyrinthMode;
  world.__leaderboardRunStarted = false;
  world.__leaderboardRunFinished = false;
  world.__leaderboardRunPromise = null;

  if (!world.labyrinthMode) {
    world.controls = (world.controls ?? []).map((control) =>
      String(control)
        .replace("Z / X", "Z / X / C")
        .replace("maximum 2", "maximum 3"),
    );

    world.player.powerUpSlots = [
      ...(world.player.powerUpSlots ?? []),
      null,
    ].slice(0, 3);

    while (world.player.powerUpSlots.length < 3) {
      world.player.powerUpSlots.push(null);
    }

    world.player.legendaryPowerUpSlots = [false, false, false];
    markLegendaryPowerUps(world);
  }

  applyRobbienatorLoadout(world);
  applyAsherLoadout(world);

  return exposeWorld(world);
}

export function setWorldViewMode(world, nextViewMode) {
  const normalized = nextViewMode === "3d" ? "3d" : "2d";
  const changed =
    world?.viewMode &&
    world.viewMode !== normalized;

  if (changed && !world.labyrinthMode) {
    world.leaderboardEligible = false;
    world.__leaderboardRunPromise = null;
    world.__leaderboardRunFinished = true;
    world.message =
      "Leaderboard disabled for this run after switching 2D/3D";
    world.messageTtl = 2.3;
  }

  const result = setWorldViewModeCore(world, normalized);

  if (!world.labyrinthMode) {
    world.controls = (world.controls ?? []).map((control) =>
      String(control)
        .replace("Z / X", "Z / X / C")
        .replace("maximum 2", "maximum 3"),
    );
  }

  exposeWorld(world);
  return result;
}
