// src/features/characterModeEnhancement.js

import {
  applyCharacterWorldProfile,
  isMendelName,
} from "../config/characterProfiles.js";
import {
  applySpecialPlayerLoadout,
  getWorldPlayerName,
  normalizePlayerName,
} from "../config/specialPlayers.js";

const INSTALLED_KEY =
  "__mistMazeCharacterModeEnhancementInstalled";

const SESSION_NAME_KEY =
  "mist-maze-current-player-name";

const MENDEL_TO_NORMAL =
  Object.freeze({
    "Under 770":
      "Orbital Ruins",
    "Jungle":
      "Emerald Wilds",
    "The Trail":
      "Fallen Keep",
  });

const NORMAL_TO_MENDEL =
  Object.freeze({
    "Orbital Ruins":
      "Under 770",
    "Emerald Wilds":
      "Jungle",
    "Fallen Keep":
      "The Trail",
  });

function isNameInput(
  element,
) {
  if (
    !(
      element instanceof
      HTMLInputElement
    )
  ) {
    return false;
  }

  if (
    element.closest(
      ".name-prompt-card",
    )
  ) {
    return true;
  }

  const searchable = [
    element.name,
    element.id,
    element.placeholder,
    element
      .getAttribute(
        "aria-label",
      ),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    searchable.includes(
      "name",
    ) ||
    searchable.includes(
      "player",
    )
  );
}

function isEditableTarget(
  target,
) {
  if (
    target instanceof
      HTMLInputElement ||
    target instanceof
      HTMLTextAreaElement ||
    target instanceof
      HTMLSelectElement
  ) {
    return true;
  }

  return Boolean(
    target instanceof
      HTMLElement &&
    target.isContentEditable,
  );
}

/**
 * This listener is installed before React mounts.
 * It runs in the normal bubble phase, after the input itself receives
 * the key, but before later document/window gameplay listeners.
 * No preventDefault call is used, so typing and form submission remain normal.
 */
function stopGameplayHotkeysInsideInputs(
  event,
) {
  if (
    !isEditableTarget(
      event.target,
    )
  ) {
    return;
  }

  event.stopImmediatePropagation();
}

function rememberPlayerName(
  playerName,
) {
  const normalized =
    normalizePlayerName(
      playerName,
    );

  globalThis
    .__mistMazeEnteredPlayerName =
    playerName;

  try {
    sessionStorage.setItem(
      SESSION_NAME_KEY,
      playerName,
    );
  } catch {
    // Session storage may be unavailable in restricted browser modes.
  }

  return normalized;
}

function getRememberedPlayerName() {
  const world =
    globalThis
      .__mistMazeWorld;

  const worldName =
    getWorldPlayerName(
      world,
    );

  if (
    normalizePlayerName(
      worldName,
    )
  ) {
    return worldName;
  }

  if (
    globalThis
      .__mistMazeEnteredPlayerName
  ) {
    return (
      globalThis
        .__mistMazeEnteredPlayerName
    );
  }

  try {
    return (
      sessionStorage.getItem(
        SESSION_NAME_KEY,
      ) ?? ""
    );
  } catch {
    return "";
  }
}

function replaceText(
  root,
  replacements,
) {
  if (!root) {
    return;
  }

  const walker =
    document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
    );

  const nodes = [];

  while (
    walker.nextNode()
  ) {
    nodes.push(
      walker.currentNode,
    );
  }

  for (const node of nodes) {
    let value =
      node.nodeValue ?? "";
    let next = value;

    for (
      const [
        from,
        to,
      ] of Object.entries(
        replacements,
      )
    ) {
      next =
        next.replaceAll(
          from,
          to,
        );
    }

    if (next !== value) {
      node.nodeValue = next;
    }
  }
}

function updateLevelNamesInDom() {
  const playerName =
    getRememberedPlayerName();

  const mendel =
    isMendelName(
      playerName,
    );

  const replacements =
    mendel
      ? NORMAL_TO_MENDEL
      : MENDEL_TO_NORMAL;

  for (
    const root of
    document.querySelectorAll(
      [
        ".level-choice",
        ".level-select",
        ".level-select-screen",
        ".sidebar-tools-card",
        ".three-d-sidebar-card",
        ".game-header",
        ".game-over-overlay",
      ].join(","),
    )
  ) {
    replaceText(
      root,
      replacements,
    );
  }
}

function ensureWorldRules() {
  const world =
    globalThis
      .__mistMazeWorld;

  if (!world) {
    return;
  }

  applyCharacterWorldProfile(
    world,
  );

  applySpecialPlayerLoadout(
    world,
  );
}

function onInput(event) {
  const target =
    event.target;

  if (
    !isNameInput(target)
  ) {
    return;
  }

  rememberPlayerName(
    target.value,
  );

  updateLevelNamesInDom();
}

export function installCharacterModeEnhancement() {
  if (
    typeof document ===
      "undefined" ||
    globalThis[
      INSTALLED_KEY
    ]
  ) {
    return () => {};
  }

  globalThis[
    INSTALLED_KEY
  ] = true;

  document.addEventListener(
    "keydown",
    stopGameplayHotkeysInsideInputs,
  );

  document.addEventListener(
    "keyup",
    stopGameplayHotkeysInsideInputs,
  );

  document.addEventListener(
    "input",
    onInput,
  );

  let frameId = 0;

  const scheduleDomUpdate =
    () => {
      if (frameId) {
        return;
      }

      frameId =
        window.requestAnimationFrame(
          () => {
            frameId = 0;
            updateLevelNamesInDom();
          },
        );
    };

  const observer =
    new MutationObserver(
      scheduleDomUpdate,
    );

  observer.observe(
    document.getElementById(
      "root",
    ) ?? document.body,
    {
      childList: true,
      subtree: true,
      characterData: true,
    },
  );

  const intervalId =
    window.setInterval(
      ensureWorldRules,
      100,
    );

  ensureWorldRules();
  scheduleDomUpdate();

  return () => {
    observer.disconnect();

    if (frameId) {
      window
        .cancelAnimationFrame(
          frameId,
        );
    }

    window.clearInterval(
      intervalId,
    );

    document
      .removeEventListener(
        "keydown",
        stopGameplayHotkeysInsideInputs,
      );

    document
      .removeEventListener(
        "keyup",
        stopGameplayHotkeysInsideInputs,
      );

    document
      .removeEventListener(
        "input",
        onInput,
      );

    globalThis[
      INSTALLED_KEY
    ] = false;
  };
}
