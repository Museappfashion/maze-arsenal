export const TURKEY_COSMETIC = Object.freeze({
  key: "turkey",
  name: "Turkey Disguise",
  price: 1000, currency: "hux",
  description: "A full turkey: plain in Abandoned City, a space helmet in Orbital Ruins, a jungle hat in Emerald Wilds, and a metal helmet in Fallen Keep.",
});

export const ALIEN_COSMETIC = Object.freeze({
  key: "alien", name: "Blobby Alien", price: 10000, currency: "miz",
  description: "A green blobby alien: plain in Abandoned City, a space helmet in Orbital Ruins, a jungle hat in Emerald Wilds, and a metal helmet in Fallen Keep.",
});

export const CHARACTER_COSMETICS = Object.freeze([TURKEY_COSMETIC, ALIEN_COSMETIC]);

export const TURKEY_COSMETIC_THEMES = Object.freeze([
  { key: "city", label: "Abandoned City", headwear: "Plain", glow: "#f8fafc" },
  { key: "space", label: "Orbital Ruins", headwear: "Space helmet", glow: "#38bdf8" },
  { key: "jungle", label: "Emerald Wilds", headwear: "Jungle hat", glow: "#4ade80" },
  { key: "medieval", label: "Fallen Keep", headwear: "Metal helmet", glow: "#f59e0b" },
]);
