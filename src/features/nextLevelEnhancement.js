// src/features/nextLevelEnhancement.js

import {
  getNextLevelKey,
  recordLevelCompletion,
} from "../services/progression.js";

const UPDATE_INTERVAL_MS = 100;
const WAIT_TIMEOUT_MS = 4000;
const NEXT_BUTTON_ACTION = "next-level";

function getWorld() {
  return (
    globalThis.__mistMazeWorld ??
    null
  );
}

function findButtonByText(labels) {
  const normalized =
    labels.map(
      (label) =>
        label.toUpperCase(),
    );

  return [
    ...document.querySelectorAll(
      "button",
    ),
  ].find((button) => {
    const text =
      button.textContent
        ?.trim()
        .toUpperCase() ?? "";

    return normalized.some(
      (label) =>
        text.includes(label),
    );
  });
}

function levelKeyFromCard(card) {
  const label =
    card
      .querySelector(
        ".level-choice-number",
      )
      ?.textContent
      ?.trim() ?? "";

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

  if (
    /LABYRINTH/i.test(
      card.textContent ?? "",
    )
  ) {
    return "labyrinth";
  }

  return null;
}

function waitForElement(
  getElement,
  timeoutMs = WAIT_TIMEOUT_MS,
) {
  return new Promise((resolve) => {
    const startedAt =
      performance.now();

    const check = () => {
      const element =
        getElement();

      if (element) {
        resolve(element);
        return;
      }

      if (
        performance.now() -
          startedAt >=
        timeoutMs
      ) {
        resolve(null);
        return;
      }

      window.requestAnimationFrame(
        check,
      );
    };

    check();
  });
}

function clickLevelMenu() {
  const button =
    findButtonByText([
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

async function openNextLevel(
  nextLevelKey,
) {
  if (!nextLevelKey) {
    return;
  }

  if (!clickLevelMenu()) {
    return;
  }

  const card =
    await waitForElement(
      () =>
        [
          ...document.querySelectorAll(
            ".level-choice",
          ),
        ].find(
          (candidate) =>
            levelKeyFromCard(
              candidate,
            ) === nextLevelKey,
        ),
    );

  if (!card) {
    return;
  }

  card.click();

  const form =
    await waitForElement(
      () =>
        document.querySelector(
          ".name-prompt-card",
        ),
    );

  if (
    form instanceof
    HTMLFormElement
  ) {
    form.requestSubmit();
  }
}

function removeNextLevelButton() {
  document
    .querySelector(
      `[data-mist-action="${NEXT_BUTTON_ACTION}"]`,
    )
    ?.remove();
}

function styleNextLevelButton(
  button,
) {
  Object.assign(
    button.style,
    {
      minWidth: "270px",
      padding: "17px 30px",
      border:
        "2px solid rgba(125, 211, 252, 0.92)",
      borderRadius: "16px",
      background:
        "linear-gradient(135deg, #0ea5e9, #67e8f9 52%, #22d3ee)",
      color: "#04111d",
      font: "inherit",
      fontSize: "18px",
      fontWeight: "950",
      letterSpacing: "0.075em",
      cursor: "pointer",
      pointerEvents: "auto",
      boxShadow:
        "0 0 30px rgba(34, 211, 238, 0.68)",
    },
  );
}

function ensureNextLevelButton(
  restartButton,
  nextLevelKey,
) {
  let nextButton =
    document.querySelector(
      `[data-mist-action="${NEXT_BUTTON_ACTION}"]`,
    );

  if (!nextButton) {
    nextButton =
      document.createElement(
        "button",
      );

    nextButton.type = "button";
    nextButton.dataset.mistAction =
      NEXT_BUTTON_ACTION;
    nextButton.textContent =
      "PLAY NEXT LEVEL";

    styleNextLevelButton(
      nextButton,
    );

    restartButton.insertAdjacentElement(
      "afterend",
      nextButton,
    );
  }

  nextButton.dataset.mistNextLevel =
    nextLevelKey;

  nextButton.onclick = (
    event,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const currentWorld =
      getWorld();

    if (
      !currentWorld?.victory ||
      currentWorld.labyrinthMode
    ) {
      return;
    }

    const currentNextLevel =
      getNextLevelKey(
        currentWorld.level?.key,
      );

    if (!currentNextLevel) {
      return;
    }

    recordLevelCompletion(
      currentWorld.level.key,
    );

    document.exitPointerLock?.();

    void openNextLevel(
      currentNextLevel,
    );
  };
}

function updateTerminalButtons() {
  const world = getWorld();

  const restartButton =
    document.querySelector(
      '[data-mist-action="restart"]',
    );

  if (
    !world ||
    (!world.gameOver &&
      !world.victory) ||
    !restartButton
  ) {
    removeNextLevelButton();
    return;
  }

  restartButton.textContent =
    "START NEW GAME";

  if (
    !world.victory ||
    world.labyrinthMode
  ) {
    removeNextLevelButton();
    return;
  }

  recordLevelCompletion(
    world.level?.key,
  );

  const nextLevelKey =
    getNextLevelKey(
      world.level?.key,
    );

  if (!nextLevelKey) {
    removeNextLevelButton();
    return;
  }

  ensureNextLevelButton(
    restartButton,
    nextLevelKey,
  );
}

export function installNextLevelEnhancement() {
  if (
    typeof document ===
      "undefined" ||
    globalThis
      .__mistMazeNextLevelEnhancementInstalled
  ) {
    return;
  }

  globalThis
    .__mistMazeNextLevelEnhancementInstalled =
    true;

  window.setInterval(
    updateTerminalButtons,
    UPDATE_INTERVAL_MS,
  );

  updateTerminalButtons();
}
