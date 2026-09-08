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

const SKIP_BUTTON_ID =
  "mist-maze-skip-progression-button";
const LEVEL_PROGRESS_STORAGE_KEY =
  "mist-maze-level-progress-v1";

function unlockAllLevels() {
  try {
    window.localStorage.setItem(
      LEVEL_PROGRESS_STORAGE_KEY,
      "3",
    );
  } catch {
    return false;
  }

  window.dispatchEvent(
    new CustomEvent(
      "mist-maze-progression-changed",
      {
        detail: {
          highestUnlocked: 3,
          source: "skip-button",
        },
      },
    ),
  );

  return true;
}

function styleSkipButton(button) {
  button.style.border =
    "1px solid rgba(250,204,21,.72)";
  button.style.borderRadius = "12px";
  button.style.padding = "10px 14px";
  button.style.background =
    "linear-gradient(135deg,rgba(113,63,18,.94),rgba(30,41,59,.96))";
  button.style.color = "#fef3c7";
  button.style.fontWeight = "900";
  button.style.fontSize = "12px";
  button.style.letterSpacing = ".08em";
  button.style.cursor = "pointer";
  button.style.boxShadow =
    "0 0 18px rgba(250,204,21,.16)";
  button.style.transition =
    "transform .15s ease, box-shadow .15s ease, opacity .15s ease";
}

function updateSkipButtonState(button) {
  let fullyUnlocked = false;

  try {
    fullyUnlocked =
      Number(
        window.localStorage.getItem(
          LEVEL_PROGRESS_STORAGE_KEY,
        ),
      ) >= 3;
  } catch {
    fullyUnlocked = false;
  }

  if (fullyUnlocked) {
    button.textContent =
      "✓ ALL LEVELS UNLOCKED";
    button.disabled = true;
    button.style.opacity = "0.62";
    button.style.cursor = "default";
    button.style.boxShadow =
      "0 0 14px rgba(34,197,94,.16)";
    return;
  }

  button.textContent =
    "SKIP — UNLOCK ALL LEVELS";
  button.disabled = false;
  button.style.opacity = "1";
  button.style.cursor = "pointer";
}

function ensureSkipProgressionButton() {
  const levelSelect =
    document.querySelector(
      ".level-select-screen",
    );

  if (!levelSelect) {
    return;
  }

  const headerActions =
    levelSelect.querySelector(
      ".first-page-header-actions",
    );

  if (!headerActions) {
    return;
  }

  let button =
    document.getElementById(
      SKIP_BUTTON_ID,
    );

  if (!button) {
    button =
      document.createElement("button");
    button.id = SKIP_BUTTON_ID;
    button.type = "button";
    button.setAttribute(
      "aria-label",
      "Skip progression and unlock all levels",
    );
    button.title =
      "Skip normal progression and unlock every level";
    styleSkipButton(button);

    button.addEventListener(
      "mouseenter",
      () => {
        if (!button.disabled) {
          button.style.transform =
            "translateY(-1px)";
          button.style.boxShadow =
            "0 0 26px rgba(250,204,21,.28)";
        }
      },
    );

    button.addEventListener(
      "mouseleave",
      () => {
        button.style.transform = "";
        if (!button.disabled) {
          button.style.boxShadow =
            "0 0 18px rgba(250,204,21,.16)";
        }
      },
    );

    button.addEventListener(
      "click",
      () => {
        if (!unlockAllLevels()) {
          return;
        }

        updateSkipButtonState(button);

        /*
         * The base runtime re-checks cards every 50 ms,
         * so using the game's progression event/storage
         * keeps the unlock behavior consistent.
         */
        window.setTimeout(
          () => {
            for (
              const card of
              document.querySelectorAll(
                ".level-choice",
              )
            ) {
              card.classList.remove(
                "mist-locked-level",
              );
              card.setAttribute(
                "aria-disabled",
                "false",
              );
              card
                .querySelector(
                  ".mist-lock-overlay",
                )
                ?.remove();
            }
          },
          0,
        );
      },
    );

    headerActions.prepend(button);
  }

  updateSkipButtonState(button);
}


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

const VICTORY_ACTIONS_ID =
  "mist-maze-victory-actions";

const LEVEL_SUBTITLES = {
  level0: "ABANDONED CITY",
  level1: "ORBITAL RUINS",
  level2: "EMERALD WILDS",
  level3: "FALLEN KEEP",
  labyrinth: "SHIFTING DARK",
};

function leaveCurrentRun() {
  document.exitPointerLock?.();

  window.dispatchEvent(
    new KeyboardEvent(
      "keydown",
      {
        key: "Escape",
        code: "Escape",
        bubbles: true,
      },
    ),
  );

  window.dispatchEvent(
    new KeyboardEvent(
      "keyup",
      {
        key: "Escape",
        code: "Escape",
        bubbles: true,
      },
    ),
  );
}

function openNextLevelPrompt(nextLevelKey) {
  leaveCurrentRun();

  retryUntil(() => {
    const card =
      findLevelCard(nextLevelKey);

    if (!card) {
      return false;
    }

    card.click();
    return true;
  });
}

function styleVictoryPanel(panel) {
  panel.style.position = "fixed";
  panel.style.left = "50%";
  panel.style.bottom =
    "max(28px, env(safe-area-inset-bottom))";
  panel.style.transform =
    "translateX(-50%)";
  panel.style.zIndex = "2147483646";
  panel.style.display = "flex";
  panel.style.gap = "12px";
  panel.style.alignItems = "center";
  panel.style.justifyContent = "center";
  panel.style.width = "min(92vw, 680px)";
  panel.style.padding = "14px";
  panel.style.borderRadius = "18px";
  panel.style.border =
    "1px solid rgba(250,204,21,.34)";
  panel.style.background =
    "rgba(2,6,23,.88)";
  panel.style.backdropFilter = "blur(10px)";
  panel.style.boxShadow =
    "0 18px 70px rgba(0,0,0,.58),0 0 38px rgba(34,211,238,.12)";
  panel.style.pointerEvents = "auto";
}

function styleVictoryButton(
  button,
  primary,
) {
  button.type = "button";
  button.style.minHeight = "52px";
  button.style.borderRadius = "13px";
  button.style.padding = "0 22px";
  button.style.fontFamily =
    "system-ui, sans-serif";
  button.style.fontSize = "14px";
  button.style.fontWeight = "950";
  button.style.letterSpacing = ".055em";
  button.style.cursor = "pointer";
  button.style.transition =
    "transform .12s ease, box-shadow .12s ease";

  if (primary) {
    button.style.flex = "1";
    button.style.border =
      "1px solid rgba(254,240,138,.95)";
    button.style.color = "#07111f";
    button.style.background =
      "linear-gradient(135deg,#fef08a,#facc15 48%,#67e8f9)";
    button.style.boxShadow =
      "0 0 28px rgba(250,204,21,.46)";
  } else {
    button.style.border =
      "1px solid rgba(148,163,184,.38)";
    button.style.color = "#e2e8f0";
    button.style.background =
      "rgba(15,23,42,.88)";
  }

  button.addEventListener(
    "mouseenter",
    () => {
      button.style.transform =
        "translateY(-2px)";
    },
  );

  button.addEventListener(
    "mouseleave",
    () => {
      button.style.transform = "";
    },
  );
}

function removeVictoryActionPanel() {
  document
    .getElementById(VICTORY_ACTIONS_ID)
    ?.remove();
}

function ensureVictoryActionPanel() {
  const world = getWorld();

  if (!world?.victory) {
    removeVictoryActionPanel();
    return;
  }

  const nextLevelKey =
    getNextLevelKey(world.level?.key);

  let panel =
    document.getElementById(
      VICTORY_ACTIONS_ID,
    );

  if (!panel) {
    panel = document.createElement("div");
    panel.id = VICTORY_ACTIONS_ID;
    panel.setAttribute(
      "role",
      "group",
    );
    panel.setAttribute(
      "aria-label",
      "Victory actions",
    );
    styleVictoryPanel(panel);
    document.body.appendChild(panel);
  }

  panel.replaceChildren();

  const primary =
    document.createElement("button");
  styleVictoryButton(primary, true);

  if (nextLevelKey) {
    primary.textContent =
      `PLAY NEXT: ${
        LEVEL_SUBTITLES[nextLevelKey] ??
        "NEXT LEVEL"
      }`;
    primary.addEventListener(
      "click",
      () => {
        removeVictoryActionPanel();
        openNextLevelPrompt(
          nextLevelKey,
        );
      },
    );
  } else {
    primary.textContent =
      "LEVEL SELECT";
    primary.addEventListener(
      "click",
      () => {
        removeVictoryActionPanel();
        leaveCurrentRun();
      },
    );
  }

  panel.appendChild(primary);

  if (nextLevelKey) {
    const secondary =
      document.createElement("button");
    secondary.textContent =
      "LEVEL SELECT";
    styleVictoryButton(
      secondary,
      false,
    );
    secondary.addEventListener(
      "click",
      () => {
        removeVictoryActionPanel();
        leaveCurrentRun();
      },
    );
    panel.appendChild(secondary);
  }
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

  window.setInterval(
    () => {
      ensureVictoryActionPanel();
      ensureSkipProgressionButton();
    },
    PATCH_INTERVAL_MS,
  );

  ensureSkipProgressionButton();
  ensureVictoryActionPanel();
}
