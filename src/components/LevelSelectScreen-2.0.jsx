// src/components/LevelSelectScreen-2.0.jsx

import {
  createElement,
} from "react";
import {
  LevelSelectScreen as CoreLevelSelectScreen,
} from "./LevelSelectScreen.jsx?core";

export * from "./LevelSelectScreen.jsx?core";

/**
 * Progression locking is applied by runtimeEnhancements.
 * This wrapper intentionally adds no skip/unlock bypass.
 */
export function LevelSelectScreen(props) {
  return createElement(
    CoreLevelSelectScreen,
    props,
  );
}
