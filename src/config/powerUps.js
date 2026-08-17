// src/config/powerUps.js
export const POWER_UP_PICKUP_COUNT = 20;

export const POWER_UP_DURATIONS = {
  juggernaut: 16,
  breaker: 12,
  berserk: 16,
  haste: 20,
  rapidFire: 16,
  shield: 18,
  regen: 18,
  magnet: 24,
  overcharge: 16,
  pierce: 18,
  vampirism: 20,
  frost: 20,
  longArms: 20,
  scattershot: 16,
  precision: 18,
  ammoSurge: 18,
  sonar: 18,
  phaseWalk: 8,
  demolition: 12,
  bounty: 20,
};

export const POWER_UP_WALL_BREAK_CHARGES = {
  breaker: 12,
  demolition: 10,
};

export function getPowerUpDuration(key) {
  return POWER_UP_DURATIONS[key] ?? 14;
}

export const POWER_UPS = {
  juggernaut: { label: "Double Health", color: "#fb7185", short: "HP x2.2" },
  breaker: { label: "Wall Breaker", color: "#f97316", short: "12 wall breaks" },
  berserk: { label: "Berserk", color: "#ef4444", short: "Damage x2" },
  haste: { label: "Haste", color: "#22c55e", short: "Speed x1.75" },
  rapidFire: { label: "Rapid Fire", color: "#38bdf8", short: "Cooldown -55%" },
  shield: { label: "Shield", color: "#60a5fa", short: "Damage -50%" },
  regen: { label: "Regeneration", color: "#34d399", short: "Heal 7/s" },
  magnet: { label: "Magnet", color: "#a78bfa", short: "Vacuum 7 tiles" },
  overcharge: { label: "Overcharge", color: "#facc15", short: "Free ammo +10% dmg" },
  pierce: { label: "Piercing Rounds", color: "#e879f9", short: "Pierce 5 +12% dmg" },
  vampirism: { label: "Vampirism", color: "#dc2626", short: "Heal 22% hit" },
  frost: { label: "Frost Field", color: "#67e8f9", short: "Enemies x0.5" },
  longArms: { label: "Long Arms", color: "#c084fc", short: "Melee master" },
  scattershot: { label: "Scattershot", color: "#f59e0b", short: "Wide x1.7 total dmg" },
  precision: { label: "Precision", color: "#93c5fd", short: "Aim +18% damage" },
  ammoSurge: { label: "Ammo Surge", color: "#2563eb", short: "+10 ammo/s" },
  sonar: { label: "Sonar", color: "#14b8a6", short: "Track all enemies" },
  phaseWalk: { label: "Phase Walk", color: "#818cf8", short: "8s damage immune" },
  demolition: { label: "Demolition", color: "#fb923c", short: "10 wall breaks" },
  bounty: { label: "Bounty", color: "#f472b6", short: "+7 HP +10 ammo/kill" },
};

export const POWER_UP_SPAWN_ORDER = [ "juggernaut", "breaker", "berserk", "haste", "rapidFire", "shield", "regen", "magnet", "overcharge", "pierce", "vampirism", "frost", "longArms", "scattershot", "precision", "ammoSurge", "sonar", "phaseWalk", "demolition", "bounty", ];
