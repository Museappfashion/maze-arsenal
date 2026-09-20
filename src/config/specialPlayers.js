// src/config/specialPlayers.js

export const SWORD_GUN_KEY = "swordGun";
export const BLACK_SWORD_KEY = "blackSword";
export const PORTAL_GUN_KEY = "portalGun";

/**
 * Array semantics preserve compatibility with code that calls
 * SPECIAL_PLAYER_IDS.includes(...), while named properties preserve
 * compatibility with code that uses SPECIAL_PLAYER_IDS.FEIVEL, etc.
 */
const specialPlayerIds = [
  "robbienator",
  "asher",
  "feivel",
  "david ch",
];

Object.assign(
  specialPlayerIds,
  {
    ROBBIENATOR: "robbienator",
    ASHER: "asher",
    FEIVEL: "feivel",
    DAVID_CH: "david ch",
    DAVIDCH: "david ch",

    robbienator: "robbienator",
    asher: "asher",
    feivel: "feivel",
    davidCh: "david ch",
  },
);

export const SPECIAL_PLAYER_IDS =
  Object.freeze(
    specialPlayerIds,
  );

export const SPECIAL_PLAYER_NAMES =
  Object.freeze({
    ROBBIENATOR: "Robbienator",
    ASHER: "Asher",
    FEIVEL: "Feivel",
    DAVID_CH: "David ch",
  });

export const SPECIAL_WEAPON_LABELS =
  Object.freeze({
    [SWORD_GUN_KEY]:
      "Sword Gun",
    [BLACK_SWORD_KEY]:
      "Black Sword",
    [PORTAL_GUN_KEY]:
      "Portal Gun",
  });

export const SPECIAL_WEAPON_OWNER_NAMES =
  Object.freeze({
    [SWORD_GUN_KEY]:
      "asher",
    [BLACK_SWORD_KEY]:
      "feivel",
    [PORTAL_GUN_KEY]:
      "david ch",
  });

export const SPECIAL_PLAYER_WEAPONS =
  Object.freeze({
    robbienator: null,
    asher: SWORD_GUN_KEY,
    feivel: BLACK_SWORD_KEY,
    "david ch":
      PORTAL_GUN_KEY,

    ROBBIENATOR: null,
    ASHER: SWORD_GUN_KEY,
    FEIVEL: BLACK_SWORD_KEY,
    DAVID_CH:
      PORTAL_GUN_KEY,
  });

export const SPECIAL_PLAYER_LOADOUTS =
  Object.freeze({
    robbienator:
      Object.freeze({
        playerId:
          "robbienator",
        specialWeapon: null,
      }),

    asher:
      Object.freeze({
        playerId: "asher",
        specialWeapon:
          SWORD_GUN_KEY,
      }),

    feivel:
      Object.freeze({
        playerId: "feivel",
        specialWeapon:
          BLACK_SWORD_KEY,
      }),

    "david ch":
      Object.freeze({
        playerId:
          "david ch",
        specialWeapon:
          PORTAL_GUN_KEY,
      }),
  });

const SPECIAL_WEAPON_KEYS =
  Object.freeze([
    SWORD_GUN_KEY,
    BLACK_SWORD_KEY,
    PORTAL_GUN_KEY,
  ]);

const SPECIAL_PLAYER_ALIASES =
  Object.freeze({
    robbienator:
      "robbienator",
    asher:
      "asher",
    feivel:
      "feivel",
    "david ch":
      "david ch",
    davidch:
      "david ch",
  });

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

function normalizePlayerAlias(
  playerName,
) {
  return normalizePlayerName(
    playerName,
  )
    .replace(
      /[^a-z0-9 ]+/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function getWorldPlayerName(
  world,
) {
  return (
    world?.playerName ??
    world?.username ??
    world?.displayName ??
    world?.player
      ?.playerName ??
    world?.player
      ?.username ??
    world?.player
      ?.displayName ??
    world?.player?.name ??
    globalThis
      .__mistMazeEnteredPlayerName ??
    ""
  );
}

export function getSpecialPlayerId(
  playerName,
) {
  const normalized =
    normalizePlayerAlias(
      playerName,
    );

  return (
    SPECIAL_PLAYER_ALIASES[
      normalized
    ] ??
    null
  );
}

export function getSpecialPlayerIdForWorld(
  world,
) {
  return (
    getSpecialPlayerId(
      getWorldPlayerName(
        world,
      ),
    )
  );
}

export function getSpecialPlayerForWorld(
  world,
) {
  const playerId =
    getSpecialPlayerIdForWorld(
      world,
    );

  if (!playerId) {
    return null;
  }

  return (
    SPECIAL_PLAYER_LOADOUTS[
      playerId
    ] ?? {
      playerId,
      specialWeapon: null,
    }
  );
}

export function getSpecialPlayerLoadout(
  worldOrPlayerName,
) {
  const playerId =
    typeof worldOrPlayerName ===
      "string"
      ? getSpecialPlayerId(
          worldOrPlayerName,
        )
      : getSpecialPlayerIdForWorld(
          worldOrPlayerName,
        );

  if (!playerId) {
    return null;
  }

  return (
    SPECIAL_PLAYER_LOADOUTS[
      playerId
    ] ?? {
      playerId,
      specialWeapon: null,
    }
  );
}

export function isSpecialPlayerName(
  playerName,
) {
  return Boolean(
    getSpecialPlayerId(
      playerName,
    ),
  );
}

/**
 * Supports all common call shapes:
 *   isSpecialPlayerWorld(world)
 *   isSpecialPlayerWorld(world, "feivel")
 *   isSpecialPlayerWorld(world, SPECIAL_PLAYER_IDS.FEIVEL)
 *   isSpecialPlayerWorld(world, ["feivel", "asher"])
 */
export function isSpecialPlayerWorld(
  world,
  expectedPlayerId = null,
) {
  const actualPlayerId =
    getSpecialPlayerIdForWorld(
      world,
    );

  if (!actualPlayerId) {
    return false;
  }

  if (
    expectedPlayerId == null
  ) {
    return true;
  }

  if (
    Array.isArray(
      expectedPlayerId,
    ) ||
    expectedPlayerId instanceof
      Set
  ) {
    return Array.from(
      expectedPlayerId,
    ).some(
      (candidate) =>
        isSpecialPlayerWorld(
          world,
          candidate,
        ),
    );
  }

  const expected =
    getSpecialPlayerId(
      expectedPlayerId,
    ) ??
    normalizePlayerAlias(
      expectedPlayerId,
    );

  return (
    actualPlayerId ===
    expected
  );
}

export function hasRobbienatorLoadout(
  world,
) {
  return (
    isSpecialPlayerWorld(
      world,
      SPECIAL_PLAYER_IDS
        .ROBBIENATOR,
    )
  );
}

export function hasAsherLoadout(
  world,
) {
  return (
    isSpecialPlayerWorld(
      world,
      SPECIAL_PLAYER_IDS
        .ASHER,
    )
  );
}

export function hasFeivelLoadout(
  world,
) {
  return (
    isSpecialPlayerWorld(
      world,
      SPECIAL_PLAYER_IDS
        .FEIVEL,
    )
  );
}

export function hasDavidChLoadout(
  world,
) {
  return (
    isSpecialPlayerWorld(
      world,
      SPECIAL_PLAYER_IDS
        .DAVID_CH,
    )
  );
}

/*
 * Compatibility aliases for older renderer/gameplay revisions.
 */
export const isRobbienatorWorld =
  hasRobbienatorLoadout;

export const isAsherWorld =
  hasAsherLoadout;

export const isFeivelWorld =
  hasFeivelLoadout;

export const isDavidChWorld =
  hasDavidChLoadout;

export const hasSwordGunLoadout =
  hasAsherLoadout;

export const hasBlackSwordLoadout =
  hasFeivelLoadout;

export const hasPortalGunLoadout =
  hasDavidChLoadout;

export const ROBBIENATOR_PLAYER_ID =
  SPECIAL_PLAYER_IDS
    .ROBBIENATOR;

export const ASHER_PLAYER_ID =
  SPECIAL_PLAYER_IDS.ASHER;

export const FEIVEL_PLAYER_ID =
  SPECIAL_PLAYER_IDS.FEIVEL;

export const DAVID_CH_PLAYER_ID =
  SPECIAL_PLAYER_IDS
    .DAVID_CH;

export function getSpecialWeaponForPlayerName(
  playerName,
) {
  const playerId =
    getSpecialPlayerId(
      playerName,
    );

  if (!playerId) {
    return null;
  }

  return (
    SPECIAL_PLAYER_WEAPONS[
      playerId
    ] ?? null
  );
}

export function getSpecialWeaponForWorld(
  world,
) {
  return (
    getSpecialWeaponForPlayerName(
      getWorldPlayerName(
        world,
      ),
    )
  );
}

export function isSpecialWeaponKey(
  weaponKey,
) {
  return (
    SPECIAL_WEAPON_KEYS.includes(
      weaponKey,
    )
  );
}

export function shouldShowWeaponForWorld(
  world,
  weaponKey,
) {
  if (
    !isSpecialWeaponKey(
      weaponKey,
    )
  ) {
    return true;
  }

  return (
    getSpecialWeaponForWorld(
      world,
    ) === weaponKey
  );
}

function keepOnlyOwnedSpecialWeapon(
  collection,
  ownedSpecialWeapon,
) {
  if (
    Array.isArray(
      collection,
    )
  ) {
    const normalWeapons =
      collection.filter(
        (weaponKey) =>
          !isSpecialWeaponKey(
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
    collection instanceof
      Set
  ) {
    for (
      const weaponKey of
      SPECIAL_WEAPON_KEYS
    ) {
      collection.delete(
        weaponKey,
      );
    }

    if (
      ownedSpecialWeapon
    ) {
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

  world.player
    .ownedWeapons =
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
      Array.isArray(
        current,
      ) ||
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
