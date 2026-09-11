// src/features/specialWeaponVisibility.js
import {
  SPECIAL_WEAPON_LABELS,
  shouldShowWeaponForWorld,
} from "../config/specialPlayers.js";

const VISIBILITY_REFRESH_MS = 250;

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

function setButtonVisible(
  button,
  visible,
) {
  if (visible) {
    button.removeAttribute(
      "data-special-weapon-hidden",
    );
    button.style.removeProperty(
      "display",
    );
    return;
  }

  button.setAttribute(
    "data-special-weapon-hidden",
    "true",
  );
  button.style.setProperty(
    "display",
    "none",
    "important",
  );
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

    setButtonVisible(
      button,
      shouldShowWeaponForWorld(
        world,
        weaponKey,
      ),
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
      characterData: true,
    },
  );

  const intervalId =
    window.setInterval(
      applySpecialWeaponVisibility,
      VISIBILITY_REFRESH_MS,
    );

  schedule();

  return () => {
    observer.disconnect();
    window.clearInterval(intervalId);

    if (frameId) {
      window.cancelAnimationFrame(
        frameId,
      );
    }
  };
}
