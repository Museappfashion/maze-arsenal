// src/components/MystStore.jsx

import {
  useEffect,
  useState,
} from "react";
import {
  MIZ_STATE_CHANGED_EVENT,
  MIZ_TILES_PER_COIN,
  MYST_SHOP_ITEMS,
  getConsumableCount,
  isCosmeticOwned,
  loadMizState,
  purchaseMystItem,
  requestMizSound,
} from "../services/mizEconomy.js";

const COIN_SVG = (
  <svg
    viewBox="0 0 36 36"
    aria-hidden="true"
  >
    <defs>
      <radialGradient
        id="mizCoinShopFace"
        cx="34%"
        cy="27%"
      >
        <stop
          offset="0%"
          stopColor="#f8fafc"
        />
        <stop
          offset="32%"
          stopColor="#d1d5db"
        />
        <stop
          offset="70%"
          stopColor="#9ca3af"
        />
        <stop
          offset="100%"
          stopColor="#4b5563"
        />
      </radialGradient>
    </defs>

    <circle
      cx="18"
      cy="18"
      r="16"
      fill="url(#mizCoinShopFace)"
      stroke="#f3f4f6"
      strokeWidth="1.5"
    />

    {[
      [18, 5.8],
      [26.6, 9.4],
      [30.2, 18],
      [26.6, 26.6],
      [18, 30.2],
      [9.4, 26.6],
      [5.8, 18],
      [9.4, 9.4],
    ].map(
      ([cx, cy], index) => (
        <circle
          key={index}
          cx={cx}
          cy={cy}
          r="2"
          fill="#4b5563"
        />
      ),
    )}

    <circle
      cx="18"
      cy="18"
      r="8.3"
      fill="rgba(31,41,55,.35)"
      stroke="rgba(255,255,255,.3)"
      strokeWidth="1"
    />

    <text
      x="18"
      y="22.2"
      textAnchor="middle"
      fontFamily="Inter,system-ui,sans-serif"
      fontSize="12"
      fontWeight="900"
      fill="#fff"
    >
      M
    </text>
  </svg>
);

const STYLES = `
  .myst-store-panel {
    position: absolute;
    z-index: 90;
    top: calc(100% + 12px);
    right: 0;
    width: min(960px, calc(100vw - 32px));
    max-height: min(720px, calc(100vh - 120px));
    overflow-y: auto;
    padding: 18px;
    border: 1px solid rgba(168,85,247,.28);
    border-radius: 20px;
    background:
      radial-gradient(circle at 10% 0%, rgba(148,163,184,.12), transparent 28%),
      radial-gradient(circle at 88% 8%, rgba(168,85,247,.17), transparent 28%),
      rgba(2,6,23,.97);
    box-shadow: 0 28px 70px rgba(0,0,0,.46);
    text-align: left;
  }

  .first-page-myst-store-button {
    min-height: 46px;
    padding: 10px 14px;
    border: 1px solid rgba(168,85,247,.55);
    border-radius: 14px;
    background:
      linear-gradient(
        135deg,
        rgba(71,85,105,.72),
        rgba(88,28,135,.62)
      );
    color: #f5f3ff;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
    transition:
      transform 160ms ease,
      filter 160ms ease;
  }

  .first-page-myst-store-button:hover {
    transform: translateY(-2px);
    filter: brightness(1.08);
  }

  .myst-store-shell {
    display: grid;
    gap: 18px;
  }

  .myst-store-head {
    display: grid;
    grid-template-columns:
      142px minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
  }

  .myst-entity {
    position: relative;
    width: 138px;
    height: 138px;
    justify-self: center;
    filter:
      drop-shadow(
        0 12px 24px
        rgba(0,0,0,.34)
      );
  }

  .myst-core,
  .myst-ring {
    position: absolute;
    left: 50%;
    top: 50%;
    border-radius: 50%;
  }

  .myst-core {
    width: 58px;
    height: 58px;
    margin: -29px;
    background:
      radial-gradient(
        circle at 38% 34%,
        #f8fafc 0 7%,
        #c4b5fd 19%,
        #8b5cf6 48%,
        #64748b 73%,
        rgba(71,85,105,.08) 100%
      );
    box-shadow:
      0 0 26px rgba(168,85,247,.25),
      0 0 48px rgba(148,163,184,.12);
    animation:
      mystCorePulse
      3.2s
      ease-in-out
      infinite;
  }

  .myst-ring {
    border-style: solid;
  }

  .myst-ring.one {
    width: 116px;
    height: 50px;
    margin: -25px -58px;
    border-width: 4px;
    border-color: rgba(196,181,253,.43);
    animation:
      mystRingOne
      5.4s
      linear
      infinite;
  }

  .myst-ring.two {
    width: 68px;
    height: 126px;
    margin: -63px -34px;
    border-width: 4px;
    border-color: rgba(148,163,184,.4);
    animation:
      mystRingTwo
      7s
      linear
      infinite;
  }

  .myst-ring.three {
    width: 92px;
    height: 92px;
    margin: -46px;
    border-width: 2px;
    border-style: dashed;
    border-color: rgba(168,85,247,.36);
    animation:
      mystRingThree
      9s
      linear
      infinite;
  }

  .myst-store-copy {
    min-width: 0;
  }

  .myst-store-kicker {
    color: #c084fc;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: .17em;
    text-transform: uppercase;
  }

  .myst-store-title {
    margin: 5px 0 0;
    color: #f8fafc;
    font-size: 28px;
    font-weight: 950;
    letter-spacing: -.04em;
  }

  .myst-store-note {
    max-width: 600px;
    margin-top: 8px;
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.45;
  }

  .myst-store-wallet {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border: 1px solid rgba(203,213,225,.18);
    border-radius: 14px;
    background: rgba(15,23,42,.72);
    color: #f8fafc;
  }

  .myst-store-wallet svg {
    width: 27px;
    height: 27px;
    display: block;
  }

  .myst-store-wallet strong {
    font-size: 23px;
    line-height: 1;
    font-weight: 950;
    letter-spacing: -.04em;
  }

  .myst-store-status {
    min-height: 16px;
    color: #c4b5fd;
    font-size: 10px;
    font-weight: 850;
    text-align: right;
  }

  .myst-store-items {
    display: grid;
    grid-template-columns:
      repeat(
        3,
        minmax(0, 1fr)
      );
    gap: 11px;
  }

  .myst-store-item {
    min-width: 0;
    display: grid;
    gap: 9px;
    padding: 14px;
    border: 1px solid rgba(148,163,184,.13);
    border-radius: 16px;
    background: rgba(15,23,42,.66);
  }

  .myst-item-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .myst-item-rarity {
    color: #a78bfa;
    font-size: 8px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .myst-item-name {
    margin-top: 4px;
    color: #f8fafc;
    font-size: 14px;
    line-height: 1.16;
    font-weight: 950;
  }

  .myst-item-price {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #e2e8f0;
    font-size: 11px;
    font-weight: 950;
    white-space: nowrap;
  }

  .myst-item-price svg {
    width: 15px;
    height: 15px;
  }

  .myst-item-description {
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.42;
  }

  .myst-item-effect {
    min-height: 38px;
    color: #e9d5ff;
    font-size: 10px;
    line-height: 1.4;
  }

  .myst-item-owned {
    color: #bbf7d0;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .myst-item-buy {
    width: 100%;
    min-height: 39px;
    margin-top: auto;
    padding: 8px 10px;
    border: 1px solid rgba(168,85,247,.3);
    border-radius: 11px;
    background:
      linear-gradient(
        135deg,
        rgba(88,28,135,.82),
        rgba(76,29,149,.66)
      );
    color: #faf5ff;
    font: inherit;
    font-size: 10px;
    font-weight: 950;
    cursor: pointer;
  }

  .myst-item-buy:disabled {
    opacity: .42;
    cursor: not-allowed;
  }

  @keyframes mystCorePulse {
    0%, 100% {
      transform: scale(.96);
    }

    50% {
      transform: scale(1.06);
    }
  }

  @keyframes mystRingOne {
    from {
      transform: rotate(-18deg);
    }

    to {
      transform: rotate(342deg);
    }
  }

  @keyframes mystRingTwo {
    from {
      transform: rotate(27deg);
    }

    to {
      transform: rotate(-333deg);
    }
  }

  @keyframes mystRingThree {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 760px) {
    .myst-store-panel {
      right: -8px;
      width:
        min(
          94vw,
          620px
        );
    }

    .myst-store-head {
      grid-template-columns:
        100px minmax(0, 1fr);
    }

    .myst-entity {
      width: 96px;
      height: 96px;
      transform: scale(.7);
    }

    .myst-store-wallet-wrap {
      grid-column: 1 / -1;
    }

    .myst-store-items {
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
    }
  }

  @media (max-width: 520px) {
    .myst-store-items {
      grid-template-columns:
        1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .myst-core,
    .myst-ring {
      animation: none !important;
    }
  }
`;

function useMizState() {
  const [
    state,
    setState,
  ] = useState(
    () =>
      loadMizState(),
  );

  useEffect(
    () => {
      const handleChange =
        (event) => {
          setState(
            event.detail
              ?.state ??
              loadMizState(),
          );
        };

      window.addEventListener(
        MIZ_STATE_CHANGED_EVENT,
        handleChange,
      );

      return () => {
        window.removeEventListener(
          MIZ_STATE_CHANGED_EVENT,
          handleChange,
        );
      };
    },
    [],
  );

  return state;
}

function getItemStatus(
  item,
  state,
) {
  if (
    item.kind ===
    "cosmetic"
  ) {
    return isCosmeticOwned(
      item.key,
      state,
    )
      ? "Owned"
      : "";
  }

  const count =
    getConsumableCount(
      item.key,
      state,
    );

  return count > 0
    ? `Inventory ${count}`
    : "";
}

function getBuyLabel(
  item,
  state,
) {
  if (
    item.kind ===
      "cosmetic" &&
    isCosmeticOwned(
      item.key,
      state,
    )
  ) {
    return "Owned";
  }

  const count =
    getConsumableCount(
      item.key,
      state,
    );

  if (
    item.kind ===
      "oneTime" &&
    count >=
      (
        item.maxStack ??
        9
      )
  ) {
    return "Inventory full";
  }

  if (
    state.miz <
    item.price
  ) {
    return `Need ${
      item.price -
      state.miz
    } more miz`;
  }

  return item.kind ===
    "oneTime"
    ? "Buy one"
    : "Buy cosmetic";
}

function isBuyDisabled(
  item,
  state,
) {
  if (
    state.miz <
    item.price
  ) {
    return true;
  }

  if (
    item.kind ===
    "cosmetic"
  ) {
    return isCosmeticOwned(
      item.key,
      state,
    );
  }

  return (
    getConsumableCount(
      item.key,
      state,
    ) >=
    (
      item.maxStack ??
      9
    )
  );
}

export function MystStore() {
  const state =
    useMizState();

  const [
    status,
    setStatus,
  ] = useState("");

  const handleBuy =
    (itemKey) => {
      const result =
        purchaseMystItem(
          itemKey,
        );

      if (
        result.ok
      ) {
        setStatus(
          `Purchased: ${
            result.item.name
          }`,
        );

        requestMizSound(
          "purchase",
        );
      } else {
        setStatus(
          result.error,
        );

        requestMizSound(
          "error",
        );
      }
    };

  return (
    <div className="myst-store-shell">
      <style>{STYLES}</style>

      <div className="myst-store-head">
        <div
          className="myst-entity"
          role="img"
          aria-label="Myst, a swirling gray and purple entity"
        >
          <div className="myst-ring one" />
          <div className="myst-ring two" />
          <div className="myst-ring three" />
          <div className="myst-core" />
        </div>

        <div className="myst-store-copy">
          <div className="myst-store-kicker">
            Myst's Store
          </div>

          <div className="myst-store-title">
            MYST
          </div>

          <div className="myst-store-note">
            10 cosmetics are permanent.
            10 one-use powers are activated
            manually from the Myst Powers button
            during a maze. Miz is earned at
            1 coin per{" "}
            {MIZ_TILES_PER_COIN} newly
            explored floor tiles.
          </div>
        </div>

        <div className="myst-store-wallet-wrap">
          <div className="myst-store-wallet">
            {COIN_SVG}
            <strong>
              {state.miz}
            </strong>
          </div>

          <div
            className="myst-store-status"
            aria-live="polite"
          >
            {status}
          </div>
        </div>
      </div>

      <div className="myst-store-items">
        {MYST_SHOP_ITEMS.map(
          (item) => {
            const itemStatus =
              getItemStatus(
                item,
                state,
              );

            return (
              <article
                className="myst-store-item"
                key={item.key}
              >
                <div className="myst-item-row">
                  <div>
                    <div className="myst-item-rarity">
                      {item.rarity}
                    </div>

                    <div className="myst-item-name">
                      {item.name}
                    </div>
                  </div>

                  <div className="myst-item-price">
                    {COIN_SVG}
                    {item.price}
                  </div>
                </div>

                <div className="myst-item-description">
                  {item.description}
                </div>

                <div className="myst-item-effect">
                  {item.effectLabel}
                </div>

                <div className="myst-item-owned">
                  {itemStatus}
                </div>

                <button
                  type="button"
                  className="myst-item-buy"
                  disabled={
                    isBuyDisabled(
                      item,
                      state,
                    )
                  }
                  onClick={() =>
                    handleBuy(
                      item.key,
                    )
                  }
                >
                  {getBuyLabel(
                    item,
                    state,
                  )}
                </button>
              </article>
            );
          },
        )}
      </div>
    </div>
  );
}
