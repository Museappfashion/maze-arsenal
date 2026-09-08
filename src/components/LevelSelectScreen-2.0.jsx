// src/components/LevelSelectScreen-2.0.jsx
import { useEffect, useState } from "react";
import {
  getHighestUnlockedLevel,
  recordLevelCompletion,
} from "../services/progression.js";
import {
  LevelSelectScreen as CoreLevelSelectScreen,
} from "./LevelSelectScreen.jsx?core";

export * from "./LevelSelectScreen.jsx?core";

const SKIP_STYLE = `
  .city-skip-unlock {
    position: fixed;
    left: 18px;
    bottom: 18px;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: calc(100vw - 36px);
    padding: 12px 16px;
    border: 1px solid rgba(56, 189, 248, 0.52);
    border-radius: 12px;
    background: rgba(2, 6, 23, 0.92);
    color: #e0f2fe;
    box-shadow:
      0 12px 36px rgba(0, 0, 0, 0.35),
      0 0 28px rgba(56, 189, 248, 0.08);
    font: 800 12px/1.2 system-ui, sans-serif;
    letter-spacing: 0.04em;
    cursor: pointer;
    backdrop-filter: blur(10px);
  }

  .city-skip-unlock:hover {
    border-color: rgba(125, 211, 252, 0.9);
    background: rgba(8, 47, 73, 0.94);
  }

  .city-skip-unlock.unlocked {
    border-color: rgba(74, 222, 128, 0.58);
    color: #bbf7d0;
    background: rgba(5, 46, 22, 0.92);
    cursor: default;
  }

  .city-skip-unlock small {
    display: block;
    margin-top: 2px;
    color: rgba(226, 232, 240, 0.72);
    font-weight: 600;
    letter-spacing: 0;
  }

  @media (max-width: 720px) {
    .city-skip-unlock {
      left: 12px;
      bottom: 12px;
      padding: 10px 12px;
      font-size: 11px;
    }
  }
`;

export function LevelSelectScreen(props) {
  const [highestUnlocked, setHighestUnlocked] =
    useState(() => getHighestUnlockedLevel());

  useEffect(() => {
    const handleProgression = (event) => {
      const next =
        Number(
          event?.detail?.highestUnlocked,
        );

      if (Number.isFinite(next)) {
        setHighestUnlocked(next);
        return;
      }

      setHighestUnlocked(
        getHighestUnlockedLevel(),
      );
    };

    window.addEventListener(
      "mist-maze-progression-changed",
      handleProgression,
    );

    return () => {
      window.removeEventListener(
        "mist-maze-progression-changed",
        handleProgression,
      );
    };
  }, []);

  const orbitalUnlocked =
    highestUnlocked >= 1;

  const unlockOrbitalRuins = () => {
    if (orbitalUnlocked) {
      return;
    }

    const next =
      recordLevelCompletion("level0");
    setHighestUnlocked(next);
  };

  return (
    <>
      <style>{SKIP_STYLE}</style>
      <CoreLevelSelectScreen {...props} />
      <button
        type="button"
        className={`city-skip-unlock${
          orbitalUnlocked ? " unlocked" : ""
        }`}
        onClick={unlockOrbitalRuins}
        disabled={orbitalUnlocked}
        title={
          orbitalUnlocked
            ? "Orbital Ruins is unlocked"
            : "Skip City progression and unlock Orbital Ruins"
        }
      >
        <span>
          {orbitalUnlocked
            ? "✓ ORBITAL RUINS UNLOCKED"
            : "SKIP CITY · UNLOCK ORBITAL RUINS"}
          <small>
            {orbitalUnlocked
              ? "City progression requirement cleared"
              : "Local unlock only — no leaderboard score is created"}
          </small>
        </span>
      </button>
    </>
  );
}
