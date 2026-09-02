// src/game/world-enhanced.js
import {
  applyRobbienatorLoadout,
} from "../config/robbienator.js";
import {
  createWorld as createWorldCore,
  setWorldViewMode as setWorldViewModeCore,
} from "./world.js?core";

export * from "./world.js?core";

function exposeWorld(world) {
  if (typeof globalThis !== "undefined") {
    globalThis.__mistMazeWorld = world;
  }

  return world;
}

function resetLeaderboardState(world) {
  world.__leaderboardRunStarted = false;
  world.__leaderboardRunFinished = false;
  world.__leaderboardRunPromise = null;
}

export function createWorld(...args) {
  const world = createWorldCore(...args);

  world.leaderboardEligible = !world.labyrinthMode;
  resetLeaderboardState(world);
  applyRobbienatorLoadout(world);

  return exposeWorld(world);
}

export function setWorldViewMode(world, nextViewMode) {
  const normalizedMode =
    nextViewMode === "3d" ? "3d" : "2d";
  const changed =
    world?.viewMode &&
    world.viewMode !== normalizedMode;

  if (changed && !world.labyrinthMode) {
    world.leaderboardEligible = false;
    world.__leaderboardRunPromise = null;
    world.__leaderboardRunFinished = true;
    world.message =
      "Leaderboard disabled for this run after switching 2D/3D";
    world.messageTtl = 2.4;
  }

  const result = setWorldViewModeCore(
    world,
    normalizedMode,
  );
  exposeWorld(world);
  return result;
}
