// src/services/mizEconomy.js

export const MIZ_TILES_PER_COIN = 43;
export const MIZ_STATE_CHANGED_EVENT =
  "mist-maze-miz-state-changed";
export const MIZ_SOUND_EVENT =
  "mist-maze-miz-sound";

const STORAGE_KEY =
  "mist-maze-miz-economy-v2";
const LEGACY_STORAGE_KEY =
  "mist-maze-miz-economy-v1";

const LEGACY_REFUND_PRICES =
  Object.freeze({
    fieldWrap: 18,
    ammoSatchel: 24,
    crowbarRig: 32,
    trailBoots: 46,
    pistolCase: 68,
  });

export const MYST_SHOP_ITEMS =
  Object.freeze([
    Object.freeze({
      key: "violetCoinEdge",
      kind: "cosmetic",
      name: "Violet Coin Edge",
      price: 12,
      rarity: "Cosmetic",
      description:
        "A violet enamel ring fitted around the edge of your miz counter coin.",
      effectLabel:
        "Permanent cosmetic · recolors the miz coin rim.",
    }),
    Object.freeze({
      key: "smokeCoinFace",
      kind: "cosmetic",
      name: "Smoke Coin Face",
      price: 18,
      rarity: "Cosmetic",
      description:
        "A smoky gray-purple finish for the center face of your miz coin.",
      effectLabel:
        "Permanent cosmetic · adds a swirling coin-center finish.",
    }),
    Object.freeze({
      key: "mystCounterFrame",
      kind: "cosmetic",
      name: "Myst Counter Frame",
      price: 26,
      rarity: "Cosmetic",
      description:
        "A thin forged frame with muted purple enamel and a brushed gray edge.",
      effectLabel:
        "Permanent cosmetic · upgrades the in-game miz counter frame.",
    }),
    Object.freeze({
      key: "orbitingSpecks",
      kind: "cosmetic",
      name: "Orbiting Specks",
      price: 34,
      rarity: "Cosmetic",
      description:
        "Two tiny gray-purple motes that orbit the miz icon while you play.",
      effectLabel:
        "Permanent cosmetic · adds subtle orbiting particles.",
    }),
    Object.freeze({
      key: "echoCharm",
      kind: "oneTime",
      name: "Echo Charm",
      price: 5,
      rarity: "One use",
      description:
        "A small metal charm that changes the sound of the next miz you earn.",
      effectLabel:
        "Consumed on your next miz gain · enhanced coin chime.",
      maxStack: 9,
    }),
    Object.freeze({
      key: "mistVeil",
      kind: "oneTime",
      name: "Mist Veil Capsule",
      price: 9,
      rarity: "One use",
      description:
        "A sealed glass capsule of gray-purple mist.",
      effectLabel:
        "Consumed when your next maze starts · cosmetic edge haze for that run.",
      maxStack: 5,
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

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(number),
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
      .map(([key]) => [
        key,
        true,
      ]),
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
    const [key, rawCount] of
    Object.entries(value)
  ) {
    if (
      !allowedKeys.has(key)
    ) {
      continue;
    }

    const item =
      ITEM_INDEX[key];

    const maximum =
      Math.max(
        1,
        item?.maxStack ?? 9,
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
  const cosmeticKeys =
    new Set(
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

  const consumableKeys =
    new Set(
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
        MIZ_TILES_PER_COIN -
          1,
        normalizeInteger(
          value.tileRemainder,
        ),
      ),
    lifetimeExploredTiles:
      normalizeInteger(
        value.lifetimeExploredTiles,
      ),
    lifetimeMizEarned:
      normalizeInteger(
        value.lifetimeMizEarned,
      ),
    cosmetics:
      sanitizeBooleanMap(
        value.cosmetics,
        cosmeticKeys,
      ),
    consumables:
      sanitizeCountMap(
        value.consumables,
        consumableKeys,
      ),
  };
}

function readStorage(
  key,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(
        key,
      );

    return raw
      ? JSON.parse(raw)
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
    // Memory state remains available when browser storage is blocked.
  }
}

function getLegacyRefund(
  legacyState,
) {
  const owned =
    legacyState?.owned;

  if (
    !owned ||
    typeof owned !==
      "object"
  ) {
    return 0;
  }

  return Object.entries(
    LEGACY_REFUND_PRICES,
  ).reduce(
    (
      total,
      [key, price],
    ) =>
      total +
      (
        owned[key]
          ? price
          : 0
      ),
    0,
  );
}

function migrateLegacyState() {
  const legacy =
    readStorage(
      LEGACY_STORAGE_KEY,
    );

  if (!legacy) {
    return null;
  }

  const migrated =
    sanitizeState({
      miz:
        normalizeInteger(
          legacy.miz,
        ) +
        getLegacyRefund(
          legacy,
        ),
      tileRemainder:
        legacy.tileRemainder,
      lifetimeExploredTiles:
        legacy.lifetimeExploredTiles,
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

  const migrated =
    migrateLegacyState();

  if (migrated) {
    memoryState =
      migrated;

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
      enhancedChime: false,
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

  let consumables = {
    ...current.consumables,
  };

  let enhancedChime =
    false;

  if (
    mizEarned > 0 &&
    (
      consumables.echoCharm ??
      0
    ) > 0
  ) {
    enhancedChime = true;

    const nextCount =
      consumables.echoCharm -
      1;

    if (nextCount > 0) {
      consumables.echoCharm =
        nextCount;
    } else {
      delete consumables
        .echoCharm;
    }
  }

  const nextState =
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
        consumables,
      },
      {
        reason: "tiles",
        mizEarned,
        tilesAdded: tiles,
        enhancedChime,
      },
    );

  return {
    state:
      nextState,
    mizEarned,
    tilesAdded: tiles,
    enhancedChime,
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

  const nextConsumables = {
    ...current.consumables,
  };

  if (count > 1) {
    nextConsumables[
      itemKey
    ] =
      count - 1;
  } else {
    delete nextConsumables[
      itemKey
    ];
  }

  const state =
    saveMizState(
      {
        ...current,
        consumables:
          nextConsumables,
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
