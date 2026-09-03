// src/audio/MazeAudioEngine-enhanced.js
import {
  MazeAudioEngine as BaseMazeAudioEngine,
} from "./MazeAudioEngine.js?core";

export * from "./MazeAudioEngine.js?core";

const MUSIC_VOLUME_BOOST = 1.3;

export class MazeAudioEngine extends BaseMazeAudioEngine {
  setMusicVolume(volume) {
    const requested = Number(volume);
    const boosted = Number.isFinite(requested)
      ? Math.max(0, Math.min(1, requested * MUSIC_VOLUME_BOOST))
      : 0;

    super.setMusicVolume(boosted);
  }

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
      !this.canPlaySfx("labyrinthTick", 0.12)
    ) {
      return;
    }

    const now = context.currentTime + 0.002;

    this.noise(
      now,
      0.018,
      0.021,
      this.sfxGain,
      4200,
    );
  }
}
