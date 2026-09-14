// src/components/LevelSelectScreen-2.0.jsx

import {
  createElement,
} from "react";
import {
  LevelSelectScreen as CoreLevelSelectScreen,
} from "./LevelSelectScreen.jsx?core";

export * from "./LevelSelectScreen.jsx?core";

/**
 * Level locking is handled by runtimeEnhancements.
 * This wrapper intentionally exposes no progression-skip button.
 */
export function LevelSelectScreen(props) {
  return createElement(
    CoreLevelSelectScreen,
    props,
  );
}
