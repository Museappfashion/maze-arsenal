// src/config/specialPlayers.js

export const SWORD_GUN_KEY = "swordGun";
export const BLACK_SWORD_KEY = "blackSword";
export const PORTAL_GUN_KEY = "portalGun";

export const SPECIAL_WEAPON_LABELS =
  Object.freeze({
    [SWORD_GUN_KEY]: "Sword Gun",
    [BLACK_SWORD_KEY]: "Black Sword",
    [PORTAL_GUN_KEY]: "Portal Gun",
  });

export const SPECIAL_WEAPON_OWNER_NAMES =
  Object.freeze({
    [SWORD_GUN_KEY]: "asher",
    [BLACK_SWORD_KEY]: "feivel",
    [PORTAL_GUN_KEY]: "david ch",
  });

const SPECIAL_WEAPON_KEYS =
  Object.freeze([
    SWORD_GUN_KEY,
    BLACK_SWORD_KEY,
    PORTAL_GUN_KEY,
  ]);

export function normalizePlayerName(
  playerName,
) {
  return String(
    playerName ?? "",
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getWorldPlayerName(
  world,
) {
  return (
    world?.playerName ??
    world?.player?.playerName ??
    world?.player?.username ??
    world?.player?.displayName ??
    world?.player?.name ??
    globalThis
      .__mistMazeEnteredPlayerName ??
    ""
  );
}

export function getSpecialWeaponForPlayerName(
  playerName,
) {
  const normalized =
    normalizePlayerName(
      playerName,
    );

  for (
    const [
      weaponKey,
      ownerName,
    ] of Object.entries(
      SPECIAL_WEAPON_OWNER_NAMES,
    )
  ) {
    if (
      normalized === ownerName
    ) {
      return weaponKey;
    }
  }

  return null;
}

export function getSpecialWeaponForWorld(
  world,
) {
  return (
    getSpecialWeaponForPlayerName(
      getWorldPlayerName(world),
    )
  );
}

export function shouldShowWeaponForWorld(
  world,
  weaponKey,
) {
  const ownerName =
    SPECIAL_WEAPON_OWNER_NAMES[
      weaponKey
    ];

  if (!ownerName) {
    return true;
  }

  return (
    normalizePlayerName(
      getWorldPlayerName(world),
    ) === ownerName
  );
}

function keepOnlyOwnedSpecialWeapon(
  collection,
  ownedSpecialWeapon,
) {
  if (
    Array.isArray(collection)
  ) {
    const normalWeapons =
      collection.filter(
        (weaponKey) =>
          !SPECIAL_WEAPON_KEYS.includes(
            weaponKey,
          ),
      );

    if (
      ownedSpecialWeapon &&
      !normalWeapons.includes(
        ownedSpecialWeapon,
      )
    ) {
      normalWeapons.push(
        ownedSpecialWeapon,
      );
    }

    return normalWeapons;
  }

  if (
    collection instanceof Set
  ) {
    for (
      const weaponKey of
      SPECIAL_WEAPON_KEYS
    ) {
      collection.delete(
        weaponKey,
      );
    }

    if (ownedSpecialWeapon) {
      collection.add(
        ownedSpecialWeapon,
      );
    }

    return collection;
  }

  return collection;
}

export function applySpecialPlayerLoadout(
  world,
) {
  if (
    !world?.player ||
    world.labyrinthMode
  ) {
    return world;
  }

  const specialWeapon =
    getSpecialWeaponForWorld(
      world,
    );

  const ownedWeapons = {
    ...(
      world.player
        .ownedWeapons ?? {}
    ),
  };

  for (
    const weaponKey of
    SPECIAL_WEAPON_KEYS
  ) {
    delete ownedWeapons[
      weaponKey
    ];
  }

  if (specialWeapon) {
    ownedWeapons[
      specialWeapon
    ] = true;
  }

  world.player.ownedWeapons =
    ownedWeapons;

  for (
    const field of [
      "availableWeapons",
      "unlockedWeapons",
      "weaponInventory",
    ]
  ) {
    const current =
      world.player[field];

    if (
      Array.isArray(current) ||
      current instanceof Set
    ) {
      world.player[field] =
        keepOnlyOwnedSpecialWeapon(
          current,
          specialWeapon,
        );
    }
  }

  world.player
    .specialWeapon =
    specialWeapon;

  return world;
}
