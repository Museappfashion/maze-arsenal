// src/audio/MazeAudioEngine-enhanced.js
import {
  MazeAudioEngine as BaseMazeAudioEngine,
} from "./MazeAudioEngine.js?core";

export * from "./MazeAudioEngine.js?core";

export class MazeAudioEngine extends BaseMazeAudioEngine {
  playSfx(event, themeKey) {
    if (event?.type !== "labyrinthTick") {
      super.playSfx(event, themeKey);
      return;
    }

    const context = this.ensureContext();

    if (
      !context ||
      !this.sfxGain ||
      !this.enabled ||
      !this.canPlaySfx("labyrinthTick", 0.14)
    ) {
      return;
    }

    const now = context.currentTime + 0.004;
    const critical = Boolean(event.critical);
    const urgent = Boolean(event.urgent);
    const frequency = critical
      ? 1180
      : urgent
        ? 940
        : 720;
    const volume = critical
      ? 0.07
      : urgent
        ? 0.052
        : 0.036;

    this.tone(
      frequency,
      now,
      critical ? 0.055 : 0.04,
      volume,
      "square",
      this.sfxGain,
    );

    if (critical) {
      this.tone(
        frequency * 0.62,
        now + 0.048,
        0.055,
        0.038,
        "triangle",
        this.sfxGain,
      );
    }
  }
}
