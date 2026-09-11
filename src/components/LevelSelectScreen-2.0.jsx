// src/components/LevelSelectScreen-2.0.jsx

import {
  LevelSelectScreen as CoreLevelSelectScreen,
} from "./LevelSelectScreen.jsx?core";

export * from "./LevelSelectScreen.jsx?core";

/**
 * Runtime enhancements apply progression locks to the core level cards.
 * This wrapper intentionally avoids duplicating progression UI.
 */
export function LevelSelectScreen(props) {
  return (
    <CoreLevelSelectScreen
      {...props}
    />
  );
}
