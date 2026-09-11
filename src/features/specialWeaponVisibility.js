// src/features/specialWeaponVisibility.js

import {
  SPECIAL_WEAPON_LABELS,
  shouldShowWeaponForWorld,
} from "../config/specialPlayers.js";
import {
  BLACK_SWORD_KEY,
  PORTAL_GUN_KEY,
  SWORD_GUN_KEY,
} from "../config/weapons-enhanced.js";

const HOTKEY_BY_WEAPON =
  Object.freeze({
    [SWORD_GUN_KEY]: "0",
    [BLACK_SWORD_KEY]: "-",
    [PORTAL_GUN_KEY]: "=",
  });

function findWeaponsSection() {
  for (
    const section of
    document.querySelectorAll(
      "section",
    )
  ) {
    const heading =
      section.querySelector("h2");

    if (
      heading?.textContent
        ?.trim() ===
      "Weapons"
    ) {
      return section;
    }
  }

  return null;
}

function getWeaponKeyFromButton(
  button,
) {
  const text =
    button.textContent ?? "";

  for (
    const [
      weaponKey,
      label,
    ] of Object.entries(
      SPECIAL_WEAPON_LABELS,
    )
  ) {
    if (
      text.includes(label)
    ) {
      return weaponKey;
    }
  }

  return null;
}

function findHotkeyBadge(button) {
  return [
    ...button.querySelectorAll(
      "div",
    ),
  ].find((element) =>
    [
      "•",
      "0",
      "-",
      "=",
    ].includes(
      element.textContent
        ?.trim(),
    ),
  );
}

function applySpecialWeaponBadges() {
  const section =
    findWeaponsSection();

  if (!section) {
    return;
  }

  const world =
    globalThis
      .__mistMazeWorld;

  for (
    const button of
    section.querySelectorAll(
      "button",
    )
  ) {
    const weaponKey =
      getWeaponKeyFromButton(
        button,
      );

    if (!weaponKey) {
      continue;
    }

    const visible =
      shouldShowWeaponForWorld(
        world,
        weaponKey,
      );

    if (!visible) {
      /**
       * The enhanced weapon registry prevents this button from rendering.
       * This is only a defensive fallback for stale DOM during world swaps.
       */
      button.hidden = true;
      continue;
    }

    button.hidden = false;

    const badge =
      findHotkeyBadge(button);

    const expectedHotkey =
      HOTKEY_BY_WEAPON[
        weaponKey
      ];

    if (
      badge &&
      badge.textContent
        ?.trim() !==
        expectedHotkey
    ) {
      badge.textContent =
        expectedHotkey;
    }
  }
}

export function installSpecialWeaponVisibility() {
  if (
    typeof document ===
      "undefined" ||
    typeof MutationObserver ===
      "undefined" ||
    globalThis
      .__mistMazeSpecialWeaponVisibilityInstalled
  ) {
    return () => {};
  }

  globalThis
    .__mistMazeSpecialWeaponVisibilityInstalled =
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
          applySpecialWeaponBadges();
        },
      );
  };

  const observer =
    new MutationObserver(
      schedule,
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

  schedule();

  return () => {
    observer.disconnect();

    if (frameId) {
      window.cancelAnimationFrame(
        frameId,
      );
    }

    globalThis
      .__mistMazeSpecialWeaponVisibilityInstalled =
      false;
  };
}
