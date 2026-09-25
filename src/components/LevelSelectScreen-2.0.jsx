// src/components/LevelSelectScreen-2.0.jsx

import {
  Fragment,
  createElement,
  useEffect,
  useState,
} from "react";
import {
  createPortal,
} from "react-dom";
import {
  LevelSelectScreen as CoreLevelSelectScreen,
} from "./LevelSelectScreen.jsx?core";
import {
  MystStore,
} from "./MystStore.jsx";

export * from "./LevelSelectScreen.jsx?core";

function closeNativeExpandedPanels() {
  const settingsButton =
    document.querySelector(
      '.first-page-settings-button[aria-expanded="true"]',
    );

  const supportButton =
    document.querySelector(
      '.first-page-support-button[aria-expanded="true"]',
    );

  const letterButton =
    document.querySelector(
      '.first-page-letter-button[aria-expanded="true"]',
    );

  settingsButton?.click();
  letterButton?.click();
  supportButton?.click();
}

/**
 * Keeps the core level selector intact while adding the Myst Store
 * as a header popover beside Settings and Support.
 */
export function LevelSelectScreen(props) {
  const [
    headerActions,
    setHeaderActions,
  ] = useState(null);

  const [
    shopOpen,
    setShopOpen,
  ] = useState(false);

  useEffect(
    () => {
      const findTarget = () => {
        const nextTarget =
          document.querySelector(
            ".first-page-header-actions",
          );

        setHeaderActions(
          nextTarget instanceof
            HTMLElement
            ? nextTarget
            : null,
        );
      };

      findTarget();

      const observer =
        new MutationObserver(
          findTarget,
        );

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true,
        },
      );

      return () => {
        observer.disconnect();
      };
    },
    [],
  );

  useEffect(
    () => {
      const handleNativeButton =
        (event) => {
          const target =
            event.target;

          if (
            !(target instanceof
              Element)
          ) {
            return;
          }

          if (
            target.closest(
              ".first-page-settings-button, .first-page-letter-button, .first-page-support-button",
            )
          ) {
            setShopOpen(false);
          }
        };

      document.addEventListener(
        "click",
        handleNativeButton,
      );

      return () => {
        document.removeEventListener(
          "click",
          handleNativeButton,
        );
      };
    },
    [],
  );

  const toggleShop = () => {
    if (!shopOpen) {
      closeNativeExpandedPanels();
    }

    setShopOpen(
      (open) =>
        !open,
    );
  };

  return createElement(
    Fragment,
    null,
    createElement(
      CoreLevelSelectScreen,
      props,
    ),
    headerActions
      ? createPortal(
          createElement(
            Fragment,
            null,
            createElement(
              "button",
              {
                type: "button",
                className:
                  "first-page-myst-store-button",
                "aria-expanded":
                  shopOpen,
                onClick:
                  toggleShop,
              },
              "◈ MYST STORE",
            ),
            shopOpen
              ? createElement(
                  "section",
                  {
                    className:
                      "myst-store-panel",
                    "aria-label":
                      "Myst Store",
                  },
                  createElement(
                    MystStore,
                  ),
                )
              : null,
          ),
          headerActions,
        )
      : null,
  );
}
