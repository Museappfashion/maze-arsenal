// src/audio/MazeAudioEngine-enhanced.js
import {
  MazeAudioEngine as BaseMazeAudioEngine,
} from "./MazeAudioEngine.js?core";

export * from "./MazeAudioEngine.js?core";

const MUSIC_VOLUME_BOOST = 1.3;

export class MazeAudioEngine extends BaseMazeAudioEngine {
  constructor() {
    super();
    this.pendingMusicTheme = null;
  }

  setMusicVolume(volume) {
    const requested = Number(volume);
    const boosted = Number.isFinite(requested)
      ? Math.max(
          0,
          Math.min(1, requested * MUSIC_VOLUME_BOOST),
        )
      : 0;

    super.setMusicVolume(boosted);
  }

  startPendingMusic() {
    if (
      !this.enabled ||
      !this.pendingMusicTheme ||
      !this.context ||
      this.context.state !== "running"
    ) {
      return false;
    }

    if (
      this.currentTheme === this.pendingMusicTheme &&
      this.scheduler
    ) {
      return true;
    }

    return super.beginMusic(this.pendingMusicTheme);
  }

  async startMusic(themeKey) {
    this.pendingMusicTheme =
      typeof themeKey === "string" && themeKey
        ? themeKey
        : "space";

    const context = this.ensureContext();

    if (!context || !this.enabled) {
      return false;
    }

    if (context.state !== "running") {
      const running = await super.unlock();

      if (!running) {
        return false;
      }
    }

    return this.startPendingMusic();
  }

  async unlock() {
    const running = await super.unlock();

    if (!running) {
      return false;
    }

    if (
      this.enabled &&
      this.pendingMusicTheme &&
      (
        !this.currentTheme ||
        !this.scheduler
      )
    ) {
      this.startPendingMusic();
    }

    return true;
  }

  async resume() {
    const running = await super.resume();

    if (!running) {
      return false;
    }

    if (
      this.enabled &&
      this.pendingMusicTheme &&
      (
        !this.currentTheme ||
        !this.scheduler
      )
    ) {
      this.startPendingMusic();
    }

    return true;
  }

  setEnabled(enabled) {
    super.setEnabled(enabled);

    if (!enabled) {
      return;
    }

    void this.unlock();
  }

  stopMusic() {
    this.pendingMusicTheme = null;
    super.stopMusic();
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

    this.noise(
      context.currentTime + 0.002,
      0.018,
      0.021,
      this.sfxGain,
      4200,
    );
  }
}
