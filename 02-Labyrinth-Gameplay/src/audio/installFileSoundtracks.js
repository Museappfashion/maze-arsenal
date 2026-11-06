// src/audio/installFileSoundtracks.js
import { MazeAudioEngine } from "./MazeAudioEngine.js";

export const LEVEL_SOUNDTRACKS = Object.freeze({
  space: "/audio/music/orbital-ruins-cold-vector-v2.mp3",
  jungle: "/audio/music/emerald-wilds-canopy-pulse.mp3",
  medieval: "/audio/music/fallen-keep-ashen-battlements.mp3",
  labyrinth: "/audio/music/shifting-dark-scary-v4.mp3",
});

const FILE_MUSIC_SCHEDULER = Object.freeze({ type: "file-music" });
const INSTALL_FLAG = Symbol.for("mist-maze.file-soundtracks-installed");

function getTrackUrl(themeKey) {
  return LEVEL_SOUNDTRACKS[themeKey] ?? LEVEL_SOUNDTRACKS.space;
}

function stopFileMusic(engine, { reset = true, release = false } = {}) {
  const audio = engine.fileMusicElement;

  if (!audio) {
    return;
  }

  audio.pause();

  if (reset) {
    try {
      audio.currentTime = 0;
    } catch {
      // Some browsers reject seeking before metadata is available.
    }
  }

  if (release) {
    audio.removeAttribute("src");
    audio.load();
    engine.fileMusicElement = null;
    engine.fileMusicUrl = null;
  }
}

function prepareFileMusic(engine, themeKey) {
  if (typeof Audio === "undefined") {
    return null;
  }

  const url = getTrackUrl(themeKey);

  if (!engine.fileMusicElement || engine.fileMusicUrl !== url) {
    stopFileMusic(engine, { release: true });

    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = "auto";
    audio.playsInline = true;
    audio.volume = engine.musicVolume;
    audio.dataset.mistMazeTheme = themeKey;

    engine.fileMusicElement = audio;
    engine.fileMusicUrl = url;
  }

  engine.fileMusicElement.volume = engine.musicVolume;
  return engine.fileMusicElement;
}

export function installFileSoundtracks() {
  const prototype = MazeAudioEngine.prototype;

  if (prototype[INSTALL_FLAG]) {
    return;
  }

  Object.defineProperty(prototype, INSTALL_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  const originalStartMusic = prototype.startMusic;
  const originalStopMusic = prototype.stopMusic;
  const originalSetEnabled = prototype.setEnabled;
  const originalSetMusicVolume = prototype.setMusicVolume;
  const originalDestroy = prototype.destroy;

  prototype.startMusic = async function startMusic(themeKey) {
    const normalizedTheme = LEVEL_SOUNDTRACKS[themeKey] ? themeKey : "space";

    if (!this.enabled) {
      return false;
    }

    const unlocked = await this.unlock();

    if (!unlocked || !this.enabled) {
      return false;
    }

    const audio = prepareFileMusic(this, normalizedTheme);

    if (!audio) {
      return originalStartMusic.call(this, normalizedTheme);
    }

    if (this.scheduler && this.scheduler !== FILE_MUSIC_SCHEDULER) {
      originalStopMusic.call(this);
    }

    this.currentTheme = normalizedTheme;
    this.scheduler = FILE_MUSIC_SCHEDULER;

    try {
      if (audio.currentTime > 0.1) {
        audio.currentTime = 0;
      }

      await audio.play();
      return true;
    } catch (error) {
      console.warn(
        `Soundtrack file failed for "${normalizedTheme}"; using procedural fallback.`,
        error,
      );

      stopFileMusic(this);
      this.currentTheme = null;
      this.scheduler = null;
      return originalStartMusic.call(this, normalizedTheme);
    }
  };

  prototype.stopMusic = function stopMusic() {
    stopFileMusic(this);
    this.scheduler = null;
    this.currentTheme = null;
    originalStopMusic.call(this);
  };

  prototype.setMusicVolume = function setMusicVolume(volume) {
    originalSetMusicVolume.call(this, volume);

    if (this.fileMusicElement) {
      this.fileMusicElement.volume = this.musicVolume;
    }
  };

  prototype.setEnabled = function setEnabled(enabled) {
    originalSetEnabled.call(this, enabled);

    const audio = this.fileMusicElement;

    if (!audio) {
      return;
    }

    if (!this.enabled) {
      audio.pause();
      return;
    }

    if (
      this.currentTheme &&
      this.scheduler === FILE_MUSIC_SCHEDULER &&
      audio.paused
    ) {
      void audio.play().catch(() => {});
    }
  };

  prototype.destroy = function destroy() {
    stopFileMusic(this, { release: true });
    originalDestroy.call(this);
  };
}
