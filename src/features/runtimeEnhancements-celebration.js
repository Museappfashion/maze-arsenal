// src/features/runtimeEnhancements-celebration.js
import {
  installRuntimeEnhancements as installCoreRuntimeEnhancements,
} from "./runtimeEnhancements.js?core";

const LEVEL_ORDER = [
  "level0",
  "level1",
  "level2",
  "level3",
  "labyrinth",
];

const LEVEL_LABELS = {
  level0: "LEVEL 0",
  level1: "LEVEL 1",
  level2: "LEVEL 2",
  level3: "LEVEL 3",
  labyrinth: "LABYRINTH",
};

const PATCH_INTERVAL_MS = 50;

function getWorld() {
  return globalThis.__mistMazeWorld ?? null;
}

function getNextLevelKey(levelKey) {
  const index = LEVEL_ORDER.indexOf(levelKey);

  if (
    index < 0 ||
    index >= LEVEL_ORDER.length - 1
  ) {
    return null;
  }

  return LEVEL_ORDER[index + 1];
}

function findButton(labels) {
  const wanted =
    labels.map((label) =>
      label.toUpperCase(),
    );

  return [
    ...document.querySelectorAll("button"),
  ].find((button) => {
    const text =
      button.textContent
        ?.trim()
        .toUpperCase() ?? "";

    return wanted.some((label) =>
      text.includes(label),
    );
  });
}

function openThreeDSettings() {
  const gear =
    document.querySelector(
      ".three-d-gear-only",
    );

  if (
    gear &&
    gear.getAttribute("aria-expanded") !==
      "true"
  ) {
    gear.click();
  }
}

function openLevelMenu() {
  const button = findButton([
    "LEVEL MENU",
    "CHOOSE ANOTHER LEVEL",
  ]);

  if (button) {
    button.click();
    return true;
  }

  openThreeDSettings();

  const menuButton = findButton([
    "LEVEL MENU",
    "CHOOSE ANOTHER LEVEL",
  ]);

  if (menuButton) {
    menuButton.click();
    return true;
  }

  return false;
}

function levelKeyFromCard(card) {
  const number =
    card
      .querySelector(
        ".level-choice-number",
      )
      ?.textContent?.trim()
      .toUpperCase() ?? "";

  for (
    const [levelKey, label] of
    Object.entries(LEVEL_LABELS)
  ) {
    if (number.includes(label)) {
      return levelKey;
    }
  }

  if (
    /LABYRINTH/i.test(
      card.textContent ?? "",
    )
  ) {
    return "labyrinth";
  }

  return null;
}

function findLevelCard(levelKey) {
  return [
    ...document.querySelectorAll(
      ".level-choice",
    ),
  ].find(
    (card) =>
      levelKeyFromCard(card) ===
      levelKey,
  );
}

function retryUntil(action, attempts = 40) {
  if (action()) {
    return;
  }

  if (attempts <= 1) {
    return;
  }

  window.setTimeout(
    () =>
      retryUntil(
        action,
        attempts - 1,
      ),
    50,
  );
}

function startNextLevel(nextLevelKey) {
  document.exitPointerLock?.();

  retryUntil(() => {
    if (!openLevelMenu()) {
      return false;
    }

    retryUntil(() => {
      const card =
        findLevelCard(nextLevelKey);

      if (!card) {
        return false;
      }

      card.click();

      retryUntil(() => {
        const submit =
          document.querySelector(
            ".name-prompt-card button[type='submit']",
          );

        if (!submit) {
          return false;
        }

        submit.click();
        return true;
      });

      return true;
    });

    return true;
  });
}

function returnToLevelSelect() {
  document.exitPointerLock?.();

  retryUntil(() => openLevelMenu());
}

function patchVictoryOverlay() {
  const world = getWorld();

  if (!world?.victory) {
    return;
  }

  const root =
    document.getElementById(
      "mist-maze-runtime-enhancements",
    );

  if (!root) {
    return;
  }

  const primary =
    root.querySelector(
      '[data-mist-action="restart"]',
    );
  const secondary =
    root.querySelector(
      '[data-mist-action="menu"]',
    );

  if (!primary) {
    return;
  }

  const nextLevelKey =
    getNextLevelKey(world.level?.key);

  primary.textContent =
    nextLevelKey
      ? "NEXT LEVEL"
      : "LEVEL SELECT";

  primary.dataset.mistVictoryAction =
    nextLevelKey
      ? "next"
      : "menu";

  if (nextLevelKey) {
    primary.dataset.mistNextLevel =
      nextLevelKey;
  } else {
    delete primary.dataset.mistNextLevel;
  }

  primary.style.background =
    "linear-gradient(135deg,#fde047,#f59e0b 46%,#67e8f9)";
  primary.style.boxShadow =
    "0 0 38px rgba(250,204,21,.82),0 0 74px rgba(34,211,238,.42)";
  primary.style.transform =
    "scale(1.04)";

  if (secondary) {
    secondary.textContent =
      "LEVEL SELECT";
  }
}

function handleVictoryAction(event) {
  const target =
    event.target instanceof Element
      ? event.target.closest(
          '[data-mist-action="restart"]',
        )
      : null;

  if (!target) {
    return;
  }

  const world = getWorld();

  if (!world?.victory) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const nextLevelKey =
    getNextLevelKey(world.level?.key);

  if (nextLevelKey) {
    startNextLevel(nextLevelKey);
    return;
  }

  returnToLevelSelect();
}

export function installRuntimeEnhancements() {
  installCoreRuntimeEnhancements();

  if (
    typeof document === "undefined" ||
    globalThis.__mistMazeCelebrationInstalled
  ) {
    return;
  }

  globalThis.__mistMazeCelebrationInstalled =
    true;

  document.addEventListener(
    "click",
    handleVictoryAction,
    true,
  );

  window.setInterval(
    patchVictoryOverlay,
    PATCH_INTERVAL_MS,
  );

  patchVictoryOverlay();
}
