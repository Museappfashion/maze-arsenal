// src/features/specialWeaponVisibility.js
import {
  SPECIAL_WEAPON_LABELS,
  shouldShowWeaponForWorld,
} from "../config/specialPlayers.js";

function findWeaponsSection() {
  for (
    const section of
    document.querySelectorAll("section")
  ) {
    const heading =
      section.querySelector("h2");

    if (
      heading?.textContent?.trim() ===
      "Weapons"
    ) {
      return section;
    }
  }

  return null;
}

function getWeaponKeyFromButton(button) {
  const text =
    button.textContent ?? "";

  for (
    const [weaponKey, label] of
    Object.entries(
      SPECIAL_WEAPON_LABELS,
    )
  ) {
    if (text.includes(label)) {
      return weaponKey;
    }
  }

  return null;
}

function applySpecialWeaponVisibility() {
  const section =
    findWeaponsSection();

  if (!section) {
    return;
  }

  const world =
    globalThis.__mistMazeWorld;

  for (
    const button of
    section.querySelectorAll("button")
  ) {
    const weaponKey =
      getWeaponKeyFromButton(button);

    if (!weaponKey) {
      continue;
    }

    button.hidden =
      !shouldShowWeaponForWorld(
        world,
        weaponKey,
      );
  }
}

export function installSpecialWeaponVisibility() {
  if (
    typeof document === "undefined" ||
    typeof MutationObserver ===
      "undefined"
  ) {
    return () => {};
  }

  let frameId = 0;

  const schedule = () => {
    if (frameId) {
      return;
    }

    frameId =
      window.requestAnimationFrame(() => {
        frameId = 0;
        applySpecialWeaponVisibility();
      });
  };

  const observer =
    new MutationObserver(schedule);

  observer.observe(
    document.getElementById("root") ??
      document.body,
    {
      childList: true,
      subtree: true,
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
  };
}
