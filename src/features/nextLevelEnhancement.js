// src/features/nextLevelEnhancement.js

import {
  getNextLevelKey,
  isLevelUnlocked,
  recordLevelCompletion,
} from "../services/progression.js";

const UPDATE_INTERVAL_MS = 75;
const WAIT_TIMEOUT_MS = 5000;

const NEXT_LEVEL_DETAILS = Object.freeze({
  level1: {
    label: "LEVEL 1",
    subtitle: "ORBITAL RUINS",
  },
  level2: {
    label: "LEVEL 2",
    subtitle: "EMERALD WILDS",
  },
  level3: {
    label: "LEVEL 3",
    subtitle: "THE FALLEN KEEP",
  },
});

function getWorld() {
  return (
    globalThis.__mistMazeWorld ??
    null
  );
}

function getWorldLevelKey(world) {
  return (
    world?.levelKey ??
    world?.level?.key ??
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

function waitFor(
  getValue,
  timeoutMs = WAIT_TIMEOUT_MS,
) {
  return new Promise((resolve) => {
    const startedAt =
      performance.now();

    const check = () => {
      const value = getValue();

      if (value) {
        resolve(value);
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

function clearAddedUi() {
  document
    .querySelector(
      '[data-mist-action="next-level"]',
    )
    ?.remove();

  document
    .querySelector(
      "[data-mist-unlock-status]",
    )
    ?.remove();
}

function styleNextButton(button) {
  Object.assign(
    button.style,
    {
      minWidth: "270px",
      padding: "17px 30px",
      border:
        "2px solid rgba(125, 211, 252, 0.95)",
      borderRadius: "16px",
      background:
        "linear-gradient(135deg, #0ea5e9, #67e8f9 52%, #22d3ee)",
      color: "#04111d",
      font: "inherit",
      fontSize: "16px",
      fontWeight: "950",
      lineHeight: "1.25",
      letterSpacing: "0.055em",
      cursor: "pointer",
      pointerEvents: "auto",
      boxShadow:
        "0 0 30px rgba(34, 211, 238, 0.68)",
    },
  );
}

function styleUnlockStatus(status) {
  Object.assign(
    status.style,
    {
      color: "#bbf7d0",
      fontSize: "12px",
      fontWeight: "900",
      letterSpacing: "0.08em",
      textAlign: "center",
      textShadow:
        "0 0 14px rgba(74, 222, 128, 0.45)",
      pointerEvents: "none",
    },
  );
}

async function openNextLevel(
  nextLevelKey,
) {
  if (!nextLevelKey) {
    return;
  }

  const menuButton =
    document.querySelector(
      '#mist-maze-runtime-enhancements [data-mist-action="menu"]',
    );

  if (
    !(menuButton instanceof
      HTMLButtonElement)
  ) {
    return;
  }

  menuButton.click();

  const card =
    await waitFor(() => {
      if (
        !isLevelUnlocked(
          nextLevelKey,
        )
      ) {
        return null;
      }

      return [
        ...document.querySelectorAll(
          ".level-choice",
        ),
      ].find(
        (candidate) =>
          levelKeyFromCard(
            candidate,
          ) === nextLevelKey &&
          candidate.getAttribute(
            "aria-disabled",
          ) !== "true" &&
          !candidate.classList.contains(
            "mist-locked-level",
          ),
      );
    });

  if (
    !(card instanceof
      HTMLButtonElement)
  ) {
    return;
  }

  card.click();

  const form =
    await waitFor(
      () =>
        document.querySelector(
          ".name-prompt-card",
        ),
      2500,
    );

  if (
    form instanceof
    HTMLFormElement
  ) {
    form.requestSubmit();
  }
}

function ensureVictoryProgress(world) {
  if (
    !world?.victory ||
    world.labyrinthMode
  ) {
    return null;
  }

  const levelKey =
    getWorldLevelKey(world);

  if (!levelKey) {
    return null;
  }

  recordLevelCompletion(
    levelKey,
  );

  return getNextLevelKey(
    levelKey,
  );
}

function ensureEndGameUi() {
  const world = getWorld();

  if (
    !world ||
    (!world.gameOver &&
      !world.victory)
  ) {
    clearAddedUi();
    return;
  }

  const restartButton =
    document.querySelector(
      '#mist-maze-runtime-enhancements [data-mist-action="restart"]',
    );

  if (
    !(restartButton instanceof
      HTMLButtonElement)
  ) {
    return;
  }

  restartButton.textContent =
    "START NEW GAME";

  if (
    !world.victory ||
    world.labyrinthMode
  ) {
    clearAddedUi();
    return;
  }

  const nextLevelKey =
    ensureVictoryProgress(
      world,
    );

  if (!nextLevelKey) {
    clearAddedUi();
    return;
  }

  const details =
    NEXT_LEVEL_DETAILS[
      nextLevelKey
    ];

  const actions =
    restartButton.parentElement;

  if (!actions) {
    return;
  }

  let status =
    actions.querySelector(
      "[data-mist-unlock-status]",
    );

  if (!status) {
    status =
      document.createElement(
        "div",
      );

    status.dataset
      .mistUnlockStatus = "true";

    styleUnlockStatus(
      status,
    );

    restartButton
      .insertAdjacentElement(
        "afterend",
        status,
      );
  }

  status.textContent =
    details
      ? `✓ ${details.label} UNLOCKED`
      : "✓ NEXT LEVEL UNLOCKED";

  let nextButton =
    actions.querySelector(
      '[data-mist-action="next-level"]',
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
      "next-level";

    styleNextButton(
      nextButton,
    );

    status.insertAdjacentElement(
      "afterend",
      nextButton,
    );
  }

  nextButton.textContent =
    details
      ? `PLAY ${details.label} — ${details.subtitle}`
      : "PLAY NEXT LEVEL";

  nextButton.onclick = (
    event,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const currentWorld =
      getWorld();

    const currentNext =
      ensureVictoryProgress(
        currentWorld,
      );

    if (!currentNext) {
      return;
    }

    document
      .exitPointerLock?.();

    void openNextLevel(
      currentNext,
    );
  };
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
    ensureEndGameUi,
    UPDATE_INTERVAL_MS,
  );

  ensureEndGameUi();
}
