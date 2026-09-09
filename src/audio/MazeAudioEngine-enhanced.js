// src/audio/MazeAudioEngine-enhanced.js
import {
  MazeAudioEngine as BaseMazeAudioEngine,
} from "./MazeAudioEngine.js?core";

export * from "./MazeAudioEngine.js?core";

const MASTER_GAIN = 0.86;
const MUSIC_BUS_GAIN = 0.82;
const SFX_BUS_GAIN = 0.48;

const MUSIC_TONE_BOOST = 2.2;
const MUSIC_PAD_BOOST = 1.8;
const MUSIC_KICK_BOOST = 1.7;
const MUSIC_NOISE_BOOST = 1.65;

export class MazeAudioEngine extends BaseMazeAudioEngine {
  constructor() {
    super();
    this.pendingMusicTheme = null;
    this.mixCompressor = null;
    this.mixConfigured = false;
  }

  ensureContext() {
    const context = super.ensureContext();

    if (
      !context ||
      !this.masterGain ||
      this.mixConfigured
    ) {
      return context;
    }

    this.mixConfigured = true;

    this.masterGain.gain.value =
      this.enabled ? MASTER_GAIN : 0;

    if (this.musicGain) {
      this.musicGain.gain.value = MUSIC_BUS_GAIN;
    }

    if (this.sfxGain) {
      this.sfxGain.gain.value = SFX_BUS_GAIN;
    }

    this.mixCompressor =
      context.createDynamicsCompressor();

    this.mixCompressor.threshold.value = -12;
    this.mixCompressor.knee.value = 18;
    this.mixCompressor.ratio.value = 5;
    this.mixCompressor.attack.value = 0.003;
    this.mixCompressor.release.value = 0.18;

    this.masterGain.disconnect();
    this.masterGain.connect(this.mixCompressor);
    this.mixCompressor.connect(context.destination);

    return context;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    const context = this.ensureContext();

    if (!context || !this.masterGain) {
      return;
    }

    if (this.enabled) {
      void this.resume();
    }

    const now = context.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(
      this.enabled ? MASTER_GAIN : 0,
      now,
      0.035,
    );

    if (this.enabled) {
      void this.unlock();
    }
  }

  setMusicVolume(volume) {
    const requested = Number(volume);

    this.musicVolume = Number.isFinite(requested)
      ? Math.max(0, Math.min(1, requested))
      : 0;

    if (!this.musicVolumeGain || !this.context) {
      return;
    }

    const now = this.context.currentTime;
    this.musicVolumeGain.gain.cancelScheduledValues(now);
    this.musicVolumeGain.gain.setTargetAtTime(
      this.musicVolume,
      now,
      0.025,
    );
  }

  setSfxVolume(volume) {
    const requested = Number(volume);

    this.sfxVolume = Number.isFinite(requested)
      ? Math.max(0, Math.min(1, requested))
      : 0;

    if (!this.sfxVolumeGain || !this.context) {
      return;
    }

    const now = this.context.currentTime;
    this.sfxVolumeGain.gain.cancelScheduledValues(now);
    this.sfxVolumeGain.gain.setTargetAtTime(
      this.sfxVolume,
      now,
      0.025,
    );
  }

  beginMusic(themeKey) {
    const started = super.beginMusic(themeKey);

    if (!started || !this.context || !this.musicGain) {
      return started;
    }

    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(
      MUSIC_BUS_GAIN,
      now,
      0.045,
    );

    return true;
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

    return this.beginMusic(this.pendingMusicTheme);
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

  stopMusic() {
    this.pendingMusicTheme = null;
    super.stopMusic();
  }

  tone(
    frequency,
    when,
    duration,
    volume,
    waveform,
    destination,
    detune = 0,
  ) {
    const adjustedVolume =
      destination === this.musicGain
        ? volume * MUSIC_TONE_BOOST
        : volume;

    super.tone(
      frequency,
      when,
      duration,
      adjustedVolume,
      waveform,
      destination,
      detune,
    );
  }

  padTone(
    frequency,
    when,
    duration,
    volume,
    waveform,
    detune = 0,
  ) {
    super.padTone(
      frequency,
      when,
      duration,
      volume * MUSIC_PAD_BOOST,
      waveform,
      detune,
    );
  }

  kick(when, volume = 0.06) {
    super.kick(
      when,
      volume * MUSIC_KICK_BOOST,
    );
  }

  noise(
    when,
    duration,
    volume,
    destination,
    filterFrequency = 1800,
  ) {
    const adjustedVolume =
      destination === this.musicGain
        ? volume * MUSIC_NOISE_BOOST
        : volume;

    super.noise(
      when,
      duration,
      adjustedVolume,
      destination,
      filterFrequency,
    );
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
