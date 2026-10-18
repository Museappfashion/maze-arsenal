import { LEVELS, PASSAGE_WIDTH } from "./constants-enhanced.js";

// Share the actual Abandoned City footprint, including its outer boundary.
export const FARM_WIDTH = LEVELS.level0.logicalCols * (PASSAGE_WIDTH + 1) + 1;
export const FARM_HEIGHT = LEVELS.level0.logicalRows * (PASSAGE_WIDTH + 1) + 1;
export const FARM_PLAYER_SPEED = 4.2;
export const FARM_FARMER_SPEED = FARM_PLAYER_SPEED * 1.1;
export const FARM_RESCUE_SECONDS = 0.75;
export const FARM_SPAWN_LIMITS = Object.freeze({ cages: 20, corn: 160, pickups: 60 });
export const FARM_PICKUP_SPAWN_SECONDS = 1;
export const FARM_NEARBY_PICKUPS = 3;
export const FARM_NEARBY_PICKUP_DISTANCE = 12;
export const FARM_POWER_SETTINGS = Object.freeze({
  speedMultiplier: 2, speedSeconds: 12,
  mudTrapSeconds: 25, mudRadius: 2.25, mudSlowSeconds: 10, mudFarmerMultiplier: 0.2,
  teleportFarmerDistance: 28, teleportTravelDistance: 20, teleportSpeedSeconds: 4,
  gustRange: 14, gustPushDistance: 10, gustStaggerSeconds: 2.5,
  fenceSlipSeconds: 12,
});

// Keep saved IDs so existing charges become the replacement supplies.
export const FARM_POWERUPS = [
  { id: "speed", name: "Turkey Trot", icon: "⚡", description: "Run at double speed for 12 seconds.", price: 12, key: "1", color: "#f6cc60" },
  { id: "stun", name: "Mud Trap", icon: "🟤", description: "Leave a broad puddle for 25 seconds. It slows the farmer by 80% for 10 seconds.", price: 14, key: "2", color: "#b48b63" },
  { id: "teleport", name: "Haystack Hop", icon: "🌀", description: "Hop at least 20 tiles away and 28 tiles from the farmer, with 4 seconds of double speed.", price: 24, key: "3", color: "#d0aaff" },
  { id: "decoy", name: "Feather Gust", icon: "🪶", description: "Blast the farmer back up to 10 tiles and stagger them for 2.5 seconds. Range: 14 clear tiles.", price: 18, key: "4", color: "#ffdfbf" },
  { id: "camouflage", name: "Fence Slip", icon: "✨", description: "Cross chicken-wire fences for 12 seconds. Barns and farm obstacles still block you.", price: 20, key: "5", color: "#a6d68c" },
];
