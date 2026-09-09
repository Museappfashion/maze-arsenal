// src/features/nextLevelEnhancement.js

const NEXT_LEVEL_BY_KEY = Object.freeze({
  level0: "level1",
  level1: "level2",
  level2: "level3",
});

const UPDATE_INTERVAL_MS = 100;
const WAIT_TIMEOUT_MS = 4000;

function getWorld() {
  return globalThis.__mistMazeWorld ?? null;
}

function findButtonByText(labels) {
  const normalized = labels.map((label) => label.toUpperCase());

  return [...document.querySelectorAll("button")].find((button) => {
    const text = button.textContent?.trim().toUpperCase() ?? "";

    return normalized.some((label) => text.includes(label));
  });
}

function levelKeyFromCard(card) {
  const label =
    card.querySelector(".level-choice-number")?.textContent?.trim() ?? "";

  if (/LEVEL\s*0/i.test(label)) {
    return "level0";
  }

  if (/LEVEL\s*1/i.test(label)) {
    return "level1";
  }

  if (/LEVEL\s*2/i.test(label)) {
    return "level2";
  }

  if (/LEVEL\s*3/i.test(label)) {
    return "level3";
  }

  if (/LABYRINTH/i.test(card.textContent ?? "")) {
    return "labyrinth";
  }

  return null;
}

function waitForElement(getElement, timeoutMs = WAIT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const startedAt = performance.now();

    const check = () => {
      const element = getElement();

      if (element) {
        resolve(element);
        return;
      }

      if (performance.now() - startedAt >= timeoutMs) {
        resolve(null);
        return;
      }

      window.requestAnimationFrame(check);
    };

    check();
  });
}

function clickLevelMenu() {
  const button = findButtonByText([
    "LEVEL MENU",
    "CHOOSE ANOTHER LEVEL",
    "BACK TO MAIN MENU",
  ]);

  if (!button) {
    return false;
  }

  button.click();
  return true;
}

async function openNextLevel(nextLevelKey) {
  if (!nextLevelKey) {
    clickLevelMenu();
    return;
  }

  if (!clickLevelMenu()) {
    return;
  }

  const card = await waitForElement(() =>
    [...document.querySelectorAll(".level-choice")].find(
      (candidate) => levelKeyFromCard(candidate) === nextLevelKey,
    ),
  );

  if (!card) {
    return;
  }

  card.click();

  const form = await waitForElement(() =>
    document.querySelector(".name-prompt-card"),
  );

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  form.requestSubmit();
}

function updateVictoryButton() {
  const world = getWorld();
  const button = document.querySelector(
    '[data-mist-action="restart"]',
  );

  if (!world?.victory || world.labyrinthMode || !button) {
    return;
  }

  const nextLevelKey = NEXT_LEVEL_BY_KEY[world.level?.key] ?? null;

  button.textContent = nextLevelKey
    ? "PLAY NEXT LEVEL"
    : "BACK TO LEVEL MENU";

  button.dataset.mistNextLevel = nextLevelKey ?? "menu";
}

function interceptVictoryButton(event) {
  const button = event.target.closest?.(
    '[data-mist-action="restart"]',
  );

  if (!button) {
    return;
  }

  const world = getWorld();

  if (!world?.victory || world.labyrinthMode) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  document.exitPointerLock?.();

  const nextLevelKey =
    NEXT_LEVEL_BY_KEY[world.level?.key] ?? null;

  void openNextLevel(nextLevelKey);
}

export function installNextLevelEnhancement() {
  if (
    typeof document === "undefined" ||
    globalThis.__mistMazeNextLevelEnhancementInstalled
  ) {
    return;
  }

  globalThis.__mistMazeNextLevelEnhancementInstalled = true;

  document.addEventListener(
    "click",
    interceptVictoryButton,
    true,
  );

  window.setInterval(
    updateVictoryButton,
    UPDATE_INTERVAL_MS,
  );

  updateVictoryButton();
}
