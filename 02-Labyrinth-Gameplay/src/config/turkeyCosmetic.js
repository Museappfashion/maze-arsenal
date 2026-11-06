import { COSMETIC_PERKS } from "./cosmeticPerks.js";

export const TURKEY_COSMETIC = Object.freeze({
  key: "turkey", perk: COSMETIC_PERKS.turkey,
  name: "Turkey Disguise",
  price: 1000, currency: "hux",
  description: "A full turkey: plain in Abandoned City, a space helmet in Orbital Ruins, a jungle hat in Emerald Wilds, and a metal helmet in Fallen Keep.",
});

export const ALIEN_COSMETIC = Object.freeze({
  key: "alien", perk: COSMETIC_PERKS.alien, name: "Blobby Alien", price: 10000, currency: "miz",
  description: "A green blobby alien: plain in Abandoned City, a space helmet in Orbital Ruins, a jungle hat in Emerald Wilds, and a metal helmet in Fallen Keep.",
});

export const SHADOW_WISP_COSMETIC = Object.freeze({
  key: "shadowWisp", perk: COSMETIC_PERKS.shadowWisp, name: "Shadow Wisp", portraitLabel: "WISP", price: 3500, currency: "miz",
  description: "Become a silver-eyed violet spirit with a flowing, wispy body. Orbiting stars, forest leaves, or a forged crest match the maze you enter.",
  themeLabels: { city: "Violet spirit", space: "Star wisp", jungle: "Forest wisp", medieval: "Crested wisp" },
});

export const EMBER_SPIRIT_COSMETIC = Object.freeze({
  key: "emberSpirit", perk: COSMETIC_PERKS.emberSpirit, name: "Ember Spirit", portraitLabel: "EMBER", price: 6000, currency: "miz",
  description: "A living orange flame with a charcoal face and curling fire trail. Blue stellar fire, a leafy crown, and a steel circlet change with the maze.",
  themeLabels: { city: "Ember flame", space: "Stellar flame", jungle: "Leaf crown", medieval: "Steel circlet" },
});

export const CRYSTAL_GUARDIAN_COSMETIC = Object.freeze({
  key: "crystalGuardian", perk: COSMETIC_PERKS.crystalGuardian, name: "Crystal Guardian", portraitLabel: "CRYSTAL", price: 8000, currency: "miz",
  description: "A faceted crystal guardian with bright eyes and pointed shoulders. Lunar blue, emerald green, and royal violet facets suit each maze.",
  themeLabels: { city: "Ice crystal", space: "Lunar crystal", jungle: "Emerald crystal", medieval: "Royal crystal" },
});

export const CHARACTER_COSMETICS = Object.freeze([
  TURKEY_COSMETIC, ALIEN_COSMETIC, SHADOW_WISP_COSMETIC, EMBER_SPIRIT_COSMETIC, CRYSTAL_GUARDIAN_COSMETIC,
]);

export function getCharacterCosmetic(key) {
  return CHARACTER_COSMETICS.find((item) => item.key === key) ?? null;
}

export function isCharacterCosmetic(key) {
  return getCharacterCosmetic(key) !== null;
}

export const TURKEY_COSMETIC_THEMES = Object.freeze([
  { key: "city", label: "Abandoned City", headwear: "Plain", glow: "#f8fafc" },
  { key: "space", label: "Orbital Ruins", headwear: "Space helmet", glow: "#38bdf8" },
  { key: "jungle", label: "Emerald Wilds", headwear: "Jungle hat", glow: "#4ade80" },
  { key: "medieval", label: "Fallen Keep", headwear: "Metal helmet", glow: "#f59e0b" },
]);
