import { LEVELS, PASSAGE_WIDTH } from "./constants-enhanced.js";

// Share the actual Abandoned City footprint, including its outer boundary.
export const FARM_WIDTH = LEVELS.level0.logicalCols * (PASSAGE_WIDTH + 1) + 1;
export const FARM_HEIGHT = LEVELS.level0.logicalRows * (PASSAGE_WIDTH + 1) + 1;
export const FARM_PLAYER_SPEED = 4.2;
export const FARM_FARMER_SPEED = FARM_PLAYER_SPEED * 1.1;
export const FARM_RESCUE_SECONDS = 0.75;
export const FARM_SPAWN_LIMITS = Object.freeze({ cages: 20, corn: 160, pickups: 12 });

export const FARM_POWERUPS = [
  { id: "speed", name: "Turkey Trot", icon: "⚡", description: "Run 65% faster for 7 seconds.", price: 12, key: "1", color: "#f6cc60" },
  { id: "stun", name: "Farmer Stunner", icon: "💫", description: "Freeze the farmer for 4 seconds.", price: 16, key: "2", color: "#9fceff" },
  { id: "teleport", name: "Haystack Hop", icon: "🌀", description: "Teleport to a distant, safe farm passage.", price: 24, key: "3", color: "#d0aaff" },
  { id: "decoy", name: "Scarecrow Decoy", icon: "🌾", description: "Leave a decoy that distracts the farmer for 8 seconds.", price: 14, key: "4", color: "#eea86e" },
  { id: "camouflage", name: "Cornfield Cover", icon: "🍃", description: "Hide from the farmer for 6 seconds.", price: 22, key: "5", color: "#b5e294" },
];
