// src/services/mizEconomy.js

export const MIZ_TILES_PER_COIN = 43;

export const MIZ_STATE_CHANGED_EVENT =
  "mist-maze-miz-state-changed";

export const MIZ_SOUND_EVENT =
  "mist-maze-miz-sound";

const STORAGE_KEY =
  "mist-maze-miz-economy-v3";

const LEGACY_V2_STORAGE_KEY =
  "mist-maze-miz-economy-v2";

const LEGACY_V1_STORAGE_KEY =
  "mist-maze-miz-economy-v1";

const LEGACY_V1_REFUNDS =
  Object.freeze({
    fieldWrap: 18,
    ammoSatchel: 24,
    crowbarRig: 32,
    trailBoots: 46,
    pistolCase: 68,
  });

const LEGACY_V2_CONSUMABLE_REFUNDS =
  Object.freeze({
    echoCharm: 5,
    mistVeil: 9,
  });

export const MYST_SHOP_ITEMS =
  Object.freeze([
    Object.freeze({
      key: "violetCoinEdge",
      kind: "cosmetic",
      name: "Violet Coin Edge",
      price: 1200,
      rarity: "Permanent cosmetic",
      description:
        "A violet enamel ring around the edge of the miz coin.",
      effectLabel:
        "Permanent · violet rim on the in-game miz icon.",
    }),
    Object.freeze({
      key: "smokeCoinFace",
      kind: "cosmetic",
      name: "Smoke Coin Face",
      price: 1800,
      rarity: "Permanent cosmetic",
      description:
        "A smoky gray-purple finish over the coin center.",
      effectLabel:
        "Permanent · misted purple coin face.",
    }),
    Object.freeze({
      key: "mystCounterFrame",
      kind: "cosmetic",
      name: "Myst Counter Frame",
      price: 2600,
      rarity: "Permanent cosmetic",
      description:
        "A forged gray frame with muted purple enamel.",
      effectLabel:
        "Permanent · upgrades the miz counter border.",
    }),
    Object.freeze({
      key: "orbitingSpecks",
      kind: "cosmetic",
      name: "Orbiting Specks",
      price: 3400,
      rarity: "Permanent cosmetic",
      description:
        "Two tiny gray-purple motes circling the miz icon.",
      effectLabel:
        "Permanent · subtle orbiting particles.",
    }),
    Object.freeze({
      key: "starGlint",
      kind: "cosmetic",
      name: "Star Glint",
      price: 4200,
      rarity: "Permanent cosmetic",
      description:
        "A small silver flare that catches the coin edge.",
      effectLabel:
        "Permanent · animated coin-edge sparkle.",
    }),
    Object.freeze({
      key: "engravedM",
      kind: "cosmetic",
      name: "Engraved M",
      price: 5000,
      rarity: "Permanent cosmetic",
      description:
        "A deeper, polished engraving for the M stamp.",
      effectLabel:
        "Permanent · brighter engraved M.",
    }),
    Object.freeze({
      key: "frostedCoin",
      kind: "cosmetic",
      name: "Frosted Coin",
      price: 5800,
      rarity: "Permanent cosmetic",
      description:
        "A cold brushed-metal sheen over the miz coin.",
      effectLabel:
        "Permanent · frosted metallic coin finish.",
    }),
    Object.freeze({
      key: "shadowHalo",
      kind: "cosmetic",
      name: "Shadow Halo",
      price: 6600,
      rarity: "Permanent cosmetic",
      description:
        "A soft gray-violet halo sitting behind the miz icon.",
      effectLabel:
        "Permanent · adds a restrained halo.",
    }),
    Object.freeze({
      key: "doubleRim",
      kind: "cosmetic",
      name: "Double Rim",
      price: 7600,
      rarity: "Permanent cosmetic",
      description:
        "A second thin ring etched just inside the coin edge.",
      effectLabel:
        "Permanent · adds a second inner rim.",
    }),
    Object.freeze({
      key: "pulseAura",
      kind: "cosmetic",
      name: "Pulse Aura",
      price: 8800,
      rarity: "Permanent cosmetic",
      description:
        "A slow low-intensity pulse around the complete counter.",
      effectLabel:
        "Permanent · gentle counter aura animation.",
    }),

    Object.freeze({
      key: "healPulse",
      kind: "oneTime",
      name: "Vital Restore",
      price: 500,
      rarity: "One-use power",
      description:
        "A sealed pulse that reconstructs lost health.",
      effectLabel:
        "Activate in-game · restores health to maximum.",
      maxStack: 9,
    }),
    Object.freeze({
      key: "ammoPulse",
      kind: "oneTime",
      name: "Ammo Refill",
      price: 600,
      rarity: "One-use power",
      description:
        "A compressed supply imprint for emergency ammunition.",
      effectLabel:
        "Activate in-game · refills ammo to maximum.",
      maxStack: 9,
    }),
    Object.freeze({
      key: "nullPulse",
      kind: "oneTime",
      name: "Null Pulse",
      price: 700,
      rarity: "One-use power",
      description:
        "A short-range collapse wave that erases active projectiles.",
      effectLabel:
        "Activate in-game · clears every active projectile.",
      maxStack: 9,
    }),
    Object.freeze({
      key: "velocityBloom",
      kind: "oneTime",
      name: "Velocity Bloom",
      price: 800,
      rarity: "One-use power",
      description:
        "A brief kinetic distortion around the player.",
      effectLabel:
        "Activate in-game · +25% movement speed for 30 seconds.",
      maxStack: 9,
    }),
    Object.freeze({
      key: "vitalBloom",
      kind: "oneTime",
      name: "Vital Bloom",
      price: 900,
      rarity: "One-use power",
      description:
        "A temporary reinforcement of the player's physical reserve.",
      effectLabel:
        "Activate in-game · +50 max HP for the current run and heal 50.",
      maxStack: 9,
    }),
    Object.freeze({
      key: "mapFlash",
      kind: "oneTime",
      name: "Cartographer Flash",
      price: 1000,
      rarity: "One-use power",
      description:
        "A violent burst of spatial memory across the maze.",
      effectLabel:
        "Activate in-game · reveals the complete maze map.",
      maxStack: 9,
    }),
    Object.freeze({
      key: "arsenalKey",
      kind: "oneTime",
      name: "Arsenal Key",
      price: 1100,
      rarity: "One-use power",
      description:
        "A temporary authorization imprint for standard weapons.",
      effectLabel:
        "Activate in-game · unlocks all standard weapons for this run.",
      maxStack: 9,
    }),
    Object.freeze({
      key: "purgeOrb",
      kind: "oneTime",
      name: "Purge Orb",
      price: 1200,
      rarity: "One-use power",
      description:
        "A dense gray sphere that collapses nearby hostile signatures.",
      effectLabel:
        "Activate in-game · removes the 8 nearest standard enemies.",
      maxStack: 9,
    }),
    Object.freeze({
      key: "phoenixSpark",
      kind: "oneTime",
      name: "Phoenix Spark",
      price: 1300,
      rarity: "One-use power",
      description:
        "A one-shot emergency spark held until defeat.",
      effectLabel:
        "Activate after defeat · revive at 50% health.",
      maxStack: 9,
    }),
    Object.freeze({
      key: "exitFold",
      kind: "oneTime",
      name: "Exit Fold",
      price: 1500,
      rarity: "One-use power",
      description:
        "A single-use spatial fold keyed to the maze exit.",
      effectLabel:
        "Activate in-game · moves you directly to the exit.",
      maxStack: 9,
    }),
  ]);

const ITEM_INDEX =
  Object.freeze(
    Object.fromEntries(
      MYST_SHOP_ITEMS.map(
        (item) => [
          item.key,
          item,
        ],
      ),
    ),
  );

const DEFAULT_STATE =
  Object.freeze({
    miz: 0,
    tileRemainder: 0,
    lifetimeExploredTiles: 0,
    lifetimeMizEarned: 0,
    cosmetics: {},
    consumables: {},
  });

let memoryState = {
  ...DEFAULT_STATE,
  cosmetics: {},
  consumables: {},
};

function normalizeInteger(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(number),
  );
}

function getCosmeticKeys() {
  return new Set(
    MYST_SHOP_ITEMS
      .filter(
        (item) =>
          item.kind ===
          "cosmetic",
      )
      .map(
        (item) =>
          item.key,
      ),
  );
}

function getPowerKeys() {
  return new Set(
    MYST_SHOP_ITEMS
      .filter(
        (item) =>
          item.kind ===
          "oneTime",
      )
      .map(
        (item) =>
          item.key,
      ),
  );
}

function sanitizeBooleanMap(
  value,
  allowedKeys,
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, enabled]) =>
          allowedKeys.has(key) &&
          Boolean(enabled),
      )
      .map(
        ([key]) => [
          key,
          true,
        ],
      ),
  );
}

function sanitizeCountMap(
  value,
  allowedKeys,
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {};
  }

  const entries = [];

  for (
    const [
      key,
      rawCount,
    ] of
    Object.entries(value)
  ) {
    if (
      !allowedKeys.has(key)
    ) {
      continue;
    }

    const maximum =
      Math.max(
        1,
        ITEM_INDEX[key]
          ?.maxStack ??
          9,
      );

    const count =
      Math.min(
        maximum,
        normalizeInteger(
          rawCount,
        ),
      );

    if (count > 0) {
      entries.push([
        key,
        count,
      ]);
    }
  }

  return Object.fromEntries(
    entries,
  );
}

function sanitizeState(value) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {
      ...DEFAULT_STATE,
      cosmetics: {},
      consumables: {},
    };
  }

  return {
    miz:
      normalizeInteger(
        value.miz,
      ),
    tileRemainder:
      Math.min(
        MIZ_TILES_PER_COIN - 1,
        normalizeInteger(
          value.tileRemainder,
        ),
      ),
    lifetimeExploredTiles:
      normalizeInteger(
        value.lifetimeExploredTiles ??
        value.lifetimeTiles,
      ),
    lifetimeMizEarned:
      normalizeInteger(
        value.lifetimeMizEarned,
      ),
    cosmetics:
      sanitizeBooleanMap(
        value.cosmetics,
        getCosmeticKeys(),
      ),
    consumables:
      sanitizeCountMap(
        value.consumables,
        getPowerKeys(),
      ),
  };
}

function readStorage(key) {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  try {
    const stored =
      window.localStorage.getItem(
        key,
      );

    return stored
      ? JSON.parse(stored)
      : null;
  } catch {
    return null;
  }
}

function writeStorage(
  key,
  value,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(value),
    );
  } catch {
    // In-memory state still works when local storage is unavailable.
  }
}

function migrateV2State() {
  const legacy =
    readStorage(
      LEGACY_V2_STORAGE_KEY,
    );

  if (!legacy) {
    return null;
  }

  const transferableCosmetics =
    sanitizeBooleanMap(
      legacy.cosmetics,
      getCosmeticKeys(),
    );

  const oldConsumables =
    legacy.consumables &&
    typeof legacy.consumables ===
      "object"
      ? legacy.consumables
      : {};

  const consumableRefund =
    Object.entries(
      LEGACY_V2_CONSUMABLE_REFUNDS,
    ).reduce(
      (
        total,
        [
          key,
          price,
        ],
      ) =>
        total +
        normalizeInteger(
          oldConsumables[key],
        ) *
          price,
      0,
    );

  const migrated =
    sanitizeState({
      miz:
        normalizeInteger(
          legacy.miz,
        ) +
        consumableRefund,
      tileRemainder:
        legacy.tileRemainder,
      lifetimeExploredTiles:
        legacy.lifetimeExploredTiles,
      lifetimeMizEarned:
        legacy.lifetimeMizEarned,
      cosmetics:
        transferableCosmetics,
      consumables: {},
    });

  writeStorage(
    STORAGE_KEY,
    migrated,
  );

  return migrated;
}

function migrateV1State() {
  const legacy =
    readStorage(
      LEGACY_V1_STORAGE_KEY,
    );

  if (!legacy) {
    return null;
  }

  const owned =
    legacy.owned &&
    typeof legacy.owned ===
      "object"
      ? legacy.owned
      : {};

  const refund =
    Object.entries(
      LEGACY_V1_REFUNDS,
    ).reduce(
      (
        total,
        [
          key,
          price,
        ],
      ) =>
        total +
        (
          owned[key]
            ? price
            : 0
        ),
      0,
    );

  const migrated =
    sanitizeState({
      miz:
        normalizeInteger(
          legacy.miz,
        ) +
        refund,
      tileRemainder:
        legacy.tileRemainder,
      lifetimeExploredTiles:
        legacy.lifetimeExploredTiles ??
        legacy.lifetimeTiles,
      lifetimeMizEarned:
        legacy.lifetimeMizEarned,
      cosmetics: {},
      consumables: {},
    });

  writeStorage(
    STORAGE_KEY,
    migrated,
  );

  return migrated;
}

function dispatchStateChanged(
  state,
  detail = {},
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      MIZ_STATE_CHANGED_EVENT,
      {
        detail: {
          state,
          ...detail,
        },
      },
    ),
  );
}

export function requestMizSound(
  sound,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      MIZ_SOUND_EVENT,
      {
        detail: {
          sound,
        },
      },
    ),
  );
}

export function loadMizState() {
  if (
    typeof window ===
    "undefined"
  ) {
    return sanitizeState(
      memoryState,
    );
  }

  const stored =
    readStorage(
      STORAGE_KEY,
    );

  if (stored) {
    memoryState =
      sanitizeState(
        stored,
      );

    return sanitizeState(
      memoryState,
    );
  }

  const migratedV2 =
    migrateV2State();

  if (migratedV2) {
    memoryState =
      migratedV2;

    return sanitizeState(
      memoryState,
    );
  }

  const migratedV1 =
    migrateV1State();

  if (migratedV1) {
    memoryState =
      migratedV1;

    return sanitizeState(
      memoryState,
    );
  }

  return sanitizeState(
    memoryState,
  );
}

export function saveMizState(
  nextState,
  detail = {},
) {
  memoryState =
    sanitizeState(
      nextState,
    );

  writeStorage(
    STORAGE_KEY,
    memoryState,
  );

  const saved =
    sanitizeState(
      memoryState,
    );

  dispatchStateChanged(
    saved,
    detail,
  );

  return saved;
}

export function addExploredTiles(
  tileCount,
) {
  const tiles =
    normalizeInteger(
      tileCount,
    );

  const current =
    loadMizState();

  if (tiles <= 0) {
    return {
      state: current,
      mizEarned: 0,
      tilesAdded: 0,
    };
  }

  const totalProgress =
    current.tileRemainder +
    tiles;

  const mizEarned =
    Math.floor(
      totalProgress /
        MIZ_TILES_PER_COIN,
    );

  const state =
    saveMizState(
      {
        ...current,
        miz:
          current.miz +
          mizEarned,
        tileRemainder:
          totalProgress %
          MIZ_TILES_PER_COIN,
        lifetimeExploredTiles:
          current.lifetimeExploredTiles +
          tiles,
        lifetimeMizEarned:
          current.lifetimeMizEarned +
          mizEarned,
      },
      {
        reason:
          "tiles",
        mizEarned,
        tilesAdded:
          tiles,
      },
    );

  return {
    state,
    mizEarned,
    tilesAdded:
      tiles,
  };
}

export function getTilesUntilNextMiz(
  state =
    loadMizState(),
) {
  return (
    MIZ_TILES_PER_COIN -
    normalizeInteger(
      state.tileRemainder,
    )
  );
}

export function isCosmeticOwned(
  itemKey,
  state =
    loadMizState(),
) {
  return Boolean(
    state.cosmetics?.[
      itemKey
    ],
  );
}

export function getConsumableCount(
  itemKey,
  state =
    loadMizState(),
) {
  return normalizeInteger(
    state.consumables?.[
      itemKey
    ],
  );
}

export function consumeOneTimeItem(
  itemKey,
) {
  const item =
    ITEM_INDEX[
      itemKey
    ];

  const current =
    loadMizState();

  if (
    item?.kind !==
    "oneTime"
  ) {
    return {
      consumed: false,
      state: current,
    };
  }

  const count =
    getConsumableCount(
      itemKey,
      current,
    );

  if (count <= 0) {
    return {
      consumed: false,
      state: current,
    };
  }

  const consumables = {
    ...current.consumables,
  };

  if (count > 1) {
    consumables[itemKey] =
      count - 1;
  } else {
    delete consumables[
      itemKey
    ];
  }

  const state =
    saveMizState(
      {
        ...current,
        consumables,
      },
      {
        reason:
          "consume",
        itemKey,
      },
    );

  return {
    consumed: true,
    state,
  };
}

export function purchaseMystItem(
  itemKey,
) {
  const item =
    ITEM_INDEX[
      itemKey
    ];

  const current =
    loadMizState();

  if (!item) {
    return {
      ok: false,
      error:
        "Item unavailable.",
      state: current,
      item: null,
    };
  }

  if (
    item.kind ===
      "cosmetic" &&
    isCosmeticOwned(
      itemKey,
      current,
    )
  ) {
    return {
      ok: false,
      error:
        "Already owned.",
      state: current,
      item,
    };
  }

  if (
    current.miz <
    item.price
  ) {
    return {
      ok: false,
      error:
        `Need ${
          item.price -
          current.miz
        } more miz.`,
      state: current,
      item,
    };
  }

  if (
    item.kind ===
    "oneTime"
  ) {
    const count =
      getConsumableCount(
        itemKey,
        current,
      );

    if (
      count >=
      (
        item.maxStack ??
        9
      )
    ) {
      return {
        ok: false,
        error:
          "Inventory full.",
        state: current,
        item,
      };
    }
  }

  const cosmetics = {
    ...current.cosmetics,
  };

  const consumables = {
    ...current.consumables,
  };

  if (
    item.kind ===
    "cosmetic"
  ) {
    cosmetics[
      itemKey
    ] = true;
  } else {
    consumables[
      itemKey
    ] =
      getConsumableCount(
        itemKey,
        current,
      ) + 1;
  }

  const state =
    saveMizState(
      {
        ...current,
        miz:
          current.miz -
          item.price,
        cosmetics,
        consumables,
      },
      {
        reason:
          "purchase",
        itemKey,
      },
    );

  return {
    ok: true,
    error: "",
    state,
    item,
  };
}
