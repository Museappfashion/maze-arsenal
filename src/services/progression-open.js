// src/services/progression-open.js
import {
  LEVEL_PROGRESS_STORAGE_KEY,
  recordLevelCompletion as recordCoreLevelCompletion,
} from "./progression.js?core";

export { LEVEL_PROGRESS_STORAGE_KEY };

export function getHighestUnlockedLevel() {
  return 3;
}

export function isLevelUnlocked() {
  return true;
}

export function recordLevelCompletion(levelKey) {
  recordCoreLevelCompletion(levelKey);
  return 3;
}
