// src/features/nextLevelEnhancement.js

import {
  getNextLevelKey,
  recordLevelCompletion,
} from "../services/progression.js";

const NEXT_BUTTON_ACTION =
  "next-level";

const WAIT_TIMEOUT_MS = 4000;

function getWorld() {
  return (
    globalThis
      .__mistMazeWorld ??
    null
  );
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
  return new Promise(
    (resolve) => {
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

        window
          .requestAnimationFrame(
            check,
          );
      };

      check();
    },
  );
}

async function openNextLevel(
  nextLevelKey,
) {
  const menuButton =
    document.querySelector(
      '[data-mist-action="menu"]',
    );

  if (
    !(menuButton instanceof
      HTMLButtonElement)
  ) {
    return;
  }

  menuButton.click();

  const card =
    await waitForElement(
      () =>
        [
          ...document
            .querySelectorAll(
              ".level-choice",
            ),
        ].find(
          (candidate) =>
            levelKeyFromCard(
              candidate,
            ) ===
            nextLevelKey,
        ),
    );

  if (
    !(card instanceof
      HTMLElement)
  ) {
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
      letterSpacing:
        "0.075em",
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

    nextButton.type =
      "button";
    nextButton.dataset
      .mistAction =
      NEXT_BUTTON_ACTION;
    nextButton.textContent =
      "PLAY NEXT LEVEL";

    styleNextLevelButton(
      nextButton,
    );

    restartButton
      .insertAdjacentElement(
        "afterend",
        nextButton,
      );
  }

  nextButton.dataset
    .mistNextLevel =
    nextLevelKey;

  nextButton.onclick = (
    event,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const world =
      getWorld();

    if (
      !world?.victory ||
      world.labyrinthMode
    ) {
      return;
    }

    const currentNextLevel =
      getNextLevelKey(
        world.level?.key,
      );

    if (!currentNextLevel) {
      return;
    }

    recordLevelCompletion(
      world.level.key,
    );

    document
      .exitPointerLock?.();

    void openNextLevel(
      currentNextLevel,
    );
  };
}

function updateTerminalButtons() {
  const world =
    getWorld();

  const restartButton =
    document.querySelector(
      '[data-mist-action="restart"]',
    );

  const finished =
    Boolean(
      world?.gameOver ||
      world?.victory,
    );

  if (
    !finished ||
    !restartButton
  ) {
    removeNextLevelButton();
    return;
  }

  if (
    restartButton
      .textContent !==
    "START NEW GAME"
  ) {
    restartButton
      .textContent =
      "START NEW GAME";
  }

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
    typeof MutationObserver ===
      "undefined" ||
    globalThis
      .__mistMazeNextLevelEnhancementInstalled
  ) {
    return () => {};
  }

  globalThis
    .__mistMazeNextLevelEnhancementInstalled =
    true;

  let frameId = 0;

  const schedule = () => {
    if (frameId) {
      return;
    }

    frameId =
      window.requestAnimationFrame(
        () => {
          frameId = 0;
          updateTerminalButtons();
        },
      );
  };

  const observer =
    new MutationObserver(
      schedule,
    );

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true,
      characterData: true,
    },
  );

  schedule();

  return () => {
    observer.disconnect();

    if (frameId) {
      window.cancelAnimationFrame(
        frameId,
      );
    }

    globalThis
      .__mistMazeNextLevelEnhancementInstalled =
      false;
  };
}
