import { LEVELS, PASSAGE_WIDTH } from "./constants-enhanced.js";

// Share the actual Abandoned City footprint, including its outer boundary.
export const FARM_WIDTH = LEVELS.level0.logicalCols * (PASSAGE_WIDTH + 1) + 1;
export const FARM_HEIGHT = LEVELS.level0.logicalRows * (PASSAGE_WIDTH + 1) + 1;
export const FARM_PLAYER_SPEED = 4.2;
export const FARM_FARMER_SPEED = FARM_PLAYER_SPEED * 1.1;
export const FARM_RESCUE_SECONDS = 0.75;
export const FARM_SPAWN_LIMITS = Object.freeze({ cages: 20, corn: 160, pickups: 12 });

// Keep saved IDs so existing charges become the replacement supplies.
export const FARM_POWERUPS = [
  { id: "speed", name: "Turkey Trot", icon: "⚡", description: "Run 65% faster for 7 seconds.", price: 12, key: "1", color: "#f6cc60" },
  { id: "stun", name: "Mud Trap", icon: "🟤", description: "Leave a puddle for 14 seconds. Crossing it slows the farmer by 65% for 5 seconds.", price: 14, key: "2", color: "#b48b63" },
  { id: "teleport", name: "Haystack Hop", icon: "🌀", description: "Teleport to a distant, safe farm passage.", price: 24, key: "3", color: "#d0aaff" },
  { id: "decoy", name: "Feather Gust", icon: "🪶", description: "Push a nearby farmer back up to 6 tiles. Needs a clear path within 10 tiles.", price: 18, key: "4", color: "#ffdfbf" },
  { id: "camouflage", name: "Fence Slip", icon: "✨", description: "Cross chicken-wire fences for 5 seconds. Barns and farm obstacles still block you.", price: 20, key: "5", color: "#a6d68c" },
];
