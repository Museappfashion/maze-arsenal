// src/audio/MazeAudioEngine.js
import { clamp } from "../utils/math.js";

export const LEVEL_AUDIO_PROFILES = {
  space: {
    title: "Orbital Drift Redux",
    bpm: 108,
    root: 110,
    chordRoots: [0, -5, 3, -2],
    chordShape: [0, 3, 7, 10],
    melody: [
      12, null, 19, null, 15, null, 17, 19,
      null, 15, null, 12, 10, null, 7, null,
      12, null, 22, null, 19, 17, null, 15,
      null, 12, 10, null, 7, null, 3, null,
    ],
    bassPattern: [0, null, null, 7, null, null, 0, null, 12, null, 7, null, 0, null, 3, null],
    leadWave: "sine",
    bassWave: "triangle",
    padWave: "sine",
    pitch: 1.12,
    swing: 0.08,
    delayTime: 0.31,
    delayMix: 0.18,
    delayFeedback: 0.24,
    filterFrequency: 4200,
  },
  jungle: {
    title: "Emerald Pulse Redux",
    bpm: 102,
    root: 130.81,
    chordRoots: [0, 3, -2, 5],
    chordShape: [0, 3, 7, 10],
    melody: [
      12, null, 15, 19, null, 22, 19, null,
      17, null, 15, null, 12, 10, null, 7,
      12, null, 19, null, 22, 24, 22, null,
      19, 17, null, 15, 12, null, 10, null,
    ],
    bassPattern: [0, null, 0, null, 7, null, 10, null, 0, null, 12, null, 7, null, 3, null],
    leadWave: "triangle",
    bassWave: "sine",
    padWave: "triangle",
    pitch: 0.94,
    swing: 0.16,
    delayTime: 0.23,
    delayMix: 0.12,
    delayFeedback: 0.18,
    filterFrequency: 3200,
  },
  medieval: {
    title: "Fallen Keep Requiem",
    bpm: 90,
    root: 110,
    chordRoots: [0, -2, -5, -7],
    chordShape: [0, 3, 7, 10],
    melody: [
      12, null, null, 15, null, 19, null, 17,
      15, null, 12, null, 10, null, 7, null,
      12, null, 15, null, 19, 20, 19, null,
      17, null, 15, 12, null, 10, 7, null,
    ],
    bassPattern: [0, null, null, null, 7, null, null, null, 0, null, 3, null, 7, null, null, null],
    leadWave: "triangle",
    bassWave: "sawtooth",
    padWave: "sine",
    pitch: 0.84,
    swing: 0.04,
    delayTime: 0.38,
    delayMix: 0.15,
    delayFeedback: 0.28,
    filterFrequency: 2600,
  },
  labyrinth: {
    title: "The Walls Remember",
    bpm: 58,
    root: 55,
    chordRoots: [0, 1, -6, -1],
    chordShape: [0, 1, 6, 10],
    melody: [
      12, null, null, null, 13, null, null, 18,
      null, null, 11, null, null, null, 6, null,
      12, null, 19, null, null, 13, null, null,
      7, null, null, 6, null, null, 1, null,
    ],
    bassPattern: [0, null, null, null, null, null, 1, null, 0, null, null, null, -6, null, null, null],
    leadWave: "sine",
    bassWave: "triangle",
    padWave: "sawtooth",
    pitch: 0.62,
    swing: 0.02,
    delayTime: 0.61,
    delayMix: 0.32,
    delayFeedback: 0.48,
    filterFrequency: 1150,
  },
};

export function noteFrequency(root, semitones) {
  return root * 2 ** (semitones / 12);
}

export function queueSfx(world, type, detail = {}) {
  if (!world) {
    return;
  }

  if (!Array.isArray(world.audioEvents)) {
    world.audioEvents = [];
  }

  if (world.audioEvents.length < 48) {
    world.audioEvents.push({ type, ...detail });
  }
}

export class MazeAudioEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.musicFilter = null;
    this.musicDelay = null;
    this.musicDelayGain = null;
    this.musicFeedbackGain = null;
    this.sfxGain = null;
    this.musicVolumeGain = null;
    this.sfxVolumeGain = null;
    this.musicVolume = 0.75;
    this.sfxVolume = 0.85;
    this.noiseBuffer = null;
    this.currentTheme = null;
    this.enabled = true;
    this.step = 0;
    this.nextBeatTime = 0;
    this.scheduler = null;
    this.lastSfxAt = new Map();
  }

  ensureContext() {
    if (this.context || typeof window === "undefined") {
      return this.context;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    this.context = new AudioContextClass();
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.musicFilter = this.context.createBiquadFilter();
    this.musicDelay = this.context.createDelay(1);
    this.musicDelayGain = this.context.createGain();
    this.musicFeedbackGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.musicVolumeGain = this.context.createGain();
    this.sfxVolumeGain = this.context.createGain();

    this.masterGain.gain.value = this.enabled ? 0.72 : 0;
    this.musicGain.gain.value = 0.2;
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 3600;
    this.musicDelay.delayTime.value = 0.28;
    this.musicDelayGain.gain.value = 0.14;
    this.musicFeedbackGain.gain.value = 0.22;
    this.sfxGain.gain.value = 0.62;
    this.musicVolumeGain.gain.value = this.musicVolume;
    this.sfxVolumeGain.gain.value = this.sfxVolume;

    this.musicGain.connect(this.musicFilter);
    this.musicFilter.connect(this.musicVolumeGain);
    this.musicFilter.connect(this.musicDelay);
    this.musicDelay.connect(this.musicDelayGain);
    this.musicDelayGain.connect(this.musicVolumeGain);
    this.musicDelay.connect(this.musicFeedbackGain);
    this.musicFeedbackGain.connect(this.musicDelay);
    this.musicVolumeGain.connect(this.masterGain);
    this.sfxGain.connect(this.sfxVolumeGain);
    this.sfxVolumeGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);

    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * 0.8));
    this.noiseBuffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const channel = this.noiseBuffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }

    return this.context;
  }

  resume() {
    const context = this.ensureContext();

    if (!context) {
      return Promise.resolve(false);
    }

    if (context.state === "running") {
      return Promise.resolve(true);
    }

    return context
      .resume()
      .then(() => context.state === "running")
      .catch(() => false);
  }

  unlock() {
    const context = this.ensureContext();

    if (!context) {
      return Promise.resolve(false);
    }

    const playSilentUnlockPulse = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      gain.gain.setValueAtTime(0.00001, now);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.01);
    };

    if (context.state === "running") {
      playSilentUnlockPulse();
      return Promise.resolve(true);
    }

    return context
      .resume()
      .then(() => {
        if (context.state === "running") {
          playSilentUnlockPulse();
          return true;
        }

        return false;
      })
      .catch(() => false);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    const context = this.ensureContext();

    if (!context || !this.masterGain) {
      return;
    }

    if (this.enabled) {
      this.resume();
    }

    const now = context.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.enabled ? 0.72 : 0, now, 0.035);
  }

  setMusicVolume(volume) {
    this.musicVolume = clamp(Number(volume) || 0, 0, 1);

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
    this.sfxVolume = clamp(Number(volume) || 0, 0, 1);

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
    const context = this.context;

    if (!context || context.state !== "running" || !this.enabled) {
      return false;
    }

    this.currentTheme = LEVEL_AUDIO_PROFILES[themeKey] ? themeKey : "space";
    this.step = 0;
    this.nextBeatTime = context.currentTime + 0.06;
    this.configureMusicEffects(LEVEL_AUDIO_PROFILES[this.currentTheme]);

    if (this.musicGain) {
      const now = context.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(0.28, now, 0.06);
    }

    if (this.scheduler && typeof window !== "undefined") {
      window.clearInterval(this.scheduler);
    }

    this.scheduler =
      typeof window !== "undefined"
        ? window.setInterval(() => this.scheduleMusic(), 50)
        : null;

    this.scheduleMusic();
    return true;
  }

  startMusic(themeKey) {
    const context = this.ensureContext();

    if (!context || !this.enabled) {
      return Promise.resolve(false);
    }

    if (context.state === "running") {
      return Promise.resolve(this.beginMusic(themeKey));
    }

    return this.unlock().then((running) => {
      if (!running) {
        return false;
      }

      return this.beginMusic(themeKey);
    });
  }

  playTestSound() {
    const context = this.ensureContext();

    if (!context || !this.enabled) {
      return Promise.resolve(false);
    }

    return this.unlock().then((running) => {
      if (!running || !this.sfxGain) {
        return false;
      }

      const now = context.currentTime + 0.01;
      this.tone(523.25, now, 0.14, 0.16, "sine", this.sfxGain);
      this.tone(659.25, now + 0.1, 0.16, 0.14, "triangle", this.sfxGain);
      this.tone(783.99, now + 0.2, 0.2, 0.12, "sine", this.sfxGain);
      return true;
    });
  }

  stopMusic() {
    if (this.scheduler && typeof window !== "undefined") {
      window.clearInterval(this.scheduler);
    }

    this.scheduler = null;
    this.currentTheme = null;

    if (this.context && this.musicGain) {
      const now = this.context.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(0.0001, now, 0.08);
    }
  }

  configureMusicEffects(profile) {
    const context = this.context;
    if (!context || !profile) {
      return;
    }

    const now = context.currentTime;

    if (this.musicFilter) {
      this.musicFilter.frequency.cancelScheduledValues(now);
      this.musicFilter.frequency.setTargetAtTime(
        profile.filterFrequency ?? 3600,
        now,
        0.08,
      );
    }

    if (this.musicDelay) {
      this.musicDelay.delayTime.cancelScheduledValues(now);
      this.musicDelay.delayTime.setTargetAtTime(
        profile.delayTime ?? 0.28,
        now,
        0.08,
      );
    }

    if (this.musicDelayGain) {
      this.musicDelayGain.gain.cancelScheduledValues(now);
      this.musicDelayGain.gain.setTargetAtTime(
        profile.delayMix ?? 0.14,
        now,
        0.08,
      );
    }

    if (this.musicFeedbackGain) {
      this.musicFeedbackGain.gain.cancelScheduledValues(now);
      this.musicFeedbackGain.gain.setTargetAtTime(
        profile.delayFeedback ?? 0.22,
        now,
        0.08,
      );
    }
  }

  scheduleMusic() {
    const context = this.context;
    if (
      !context ||
      context.state !== "running" ||
      !this.enabled ||
      !this.currentTheme
    ) {
      return;
    }

    const profile = LEVEL_AUDIO_PROFILES[this.currentTheme];
    const sixteenthNote = 60 / profile.bpm / 4;
    const scheduleAhead = 0.28;

    while (this.nextBeatTime < context.currentTime + scheduleAhead) {
      this.scheduleMusicStep(
        profile,
        this.step,
        this.nextBeatTime,
        sixteenthNote,
      );
      this.step += 1;
      this.nextBeatTime += sixteenthNote;
    }
  }

  scheduleMusicStep(profile, step, when, sixteenthNote) {
    const stepInBar = step % 16;
    const bar = Math.floor(step / 16);
    const phrase = Math.floor(bar / 4) % 4;
    const chordRoot = profile.chordRoots[bar % profile.chordRoots.length] ?? 0;
    const swingOffset =
      stepInBar % 2 === 1 ? sixteenthNote * (profile.swing ?? 0) : 0;
    const musicalWhen = when + swingOffset;

    if (stepInBar === 0) {
      this.schedulePadChord(
        profile,
        chordRoot,
        musicalWhen,
        sixteenthNote * 15.5,
      );
    }

    const bassStep = profile.bassPattern[stepInBar];
    if (Number.isFinite(bassStep)) {
      const bassFrequency = noteFrequency(
        profile.root / 2,
        chordRoot + bassStep,
      );
      this.tone(
        bassFrequency,
        musicalWhen,
        sixteenthNote * 2.8,
        phrase >= 2 ? 0.048 : 0.042,
        profile.bassWave,
        this.musicGain,
      );
    }

    const melodySemitone = profile.melody[step % profile.melody.length];
    if (Number.isFinite(melodySemitone)) {
      const melodyFrequency = noteFrequency(profile.root, melodySemitone);
      const leadVolume = phrase === 3 ? 0.034 : 0.029;

      this.tone(
        melodyFrequency,
        musicalWhen,
        sixteenthNote * 1.7,
        leadVolume,
        profile.leadWave,
        this.musicGain,
        -4,
      );
      this.tone(
        melodyFrequency,
        musicalWhen + 0.006,
        sixteenthNote * 1.55,
        leadVolume * 0.72,
        profile.leadWave,
        this.musicGain,
        4,
      );

      if (phrase >= 2 && stepInBar % 8 === 6) {
        this.tone(
          melodyFrequency * 2,
          musicalWhen,
          sixteenthNote * 1.2,
          0.012,
          "sine",
          this.musicGain,
        );
      }
    }

    this.scheduleThemePercussion(
      this.currentTheme,
      stepInBar,
      phrase,
      musicalWhen,
      sixteenthNote,
    );

    if (stepInBar === 12 && phrase === 3) {
      this.scheduleAtmosphere(profile, chordRoot, musicalWhen, sixteenthNote);
    }
  }

  schedulePadChord(profile, chordRoot, when, duration) {
    profile.chordShape.forEach((interval, index) => {
      const frequency = noteFrequency(profile.root, chordRoot + interval);
      const volume = index === 0 ? 0.013 : 0.009;

      this.padTone(
        frequency,
        when,
        duration,
        volume,
        profile.padWave,
        index % 2 === 0 ? -5 : 5,
      );
    });
  }

  scheduleThemePercussion(themeKey, stepInBar, phrase, when, sixteenthNote) {
    if (themeKey === "space") {
      if ([0, 8].includes(stepInBar)) {
        this.kick(when, phrase >= 2 ? 0.075 : 0.06);
      }
      if ([4, 12].includes(stepInBar)) {
        this.snare(when, 0.035, 1800);
      }
      if (stepInBar % 2 === 0) {
        this.hat(when, stepInBar % 4 === 2 ? 0.012 : 0.008, 5200);
      }
      return;
    }

    if (themeKey === "jungle") {
      if ([0, 3, 7, 10, 14].includes(stepInBar)) {
        this.tom(
          when,
          stepInBar % 7 === 0 ? 118 : 155,
          phrase >= 2 ? 0.055 : 0.045,
        );
      }
      if ([4, 12].includes(stepInBar)) {
        this.snare(when, 0.03, 1450);
      }
      if ([2, 6, 9, 11, 15].includes(stepInBar)) {
        this.hat(when, 0.009, 3900);
      }
      return;
    }

    if ([0, 8].includes(stepInBar)) {
      this.kick(when, 0.048);
    }
    if ([4, 12].includes(stepInBar)) {
      this.snare(when, 0.022, 950);
    }
    if (phrase >= 2 && [6, 14].includes(stepInBar)) {
      this.tone(
        880,
        when,
        sixteenthNote * 0.8,
        0.008,
        "sine",
        this.musicGain,
      );
    }
  }

  scheduleAtmosphere(profile, chordRoot, when, sixteenthNote) {
    const shimmerFrequency = noteFrequency(profile.root, chordRoot + 24);

    this.tone(
      shimmerFrequency,
      when,
      sixteenthNote * 3.5,
      0.01,
      "sine",
      this.musicGain,
      7,
    );
  }

  padTone(frequency, when, duration, volume, waveform, detune = 0) {
    const context = this.context;
    if (!context || !this.musicGain || !Number.isFinite(frequency)) {
      return;
    }

    const oscillatorA = context.createOscillator();
    const oscillatorB = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const safeDuration = Math.max(0.4, duration);
    const attack = Math.min(0.42, safeDuration * 0.28);
    const releaseStart = Math.max(attack + 0.08, safeDuration * 0.72);

    oscillatorA.type = waveform;
    oscillatorB.type = waveform;
    oscillatorA.frequency.setValueAtTime(Math.max(25, frequency), when);
    oscillatorB.frequency.setValueAtTime(Math.max(25, frequency), when);
    oscillatorA.detune.setValueAtTime(detune - 6, when);
    oscillatorB.detune.setValueAtTime(detune + 6, when);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(
      this.currentTheme === "space"
        ? 2200
        : this.currentTheme === "jungle"
          ? 1700
          : 1350,
      when,
    );
    filter.Q.setValueAtTime(0.45, when);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume),
      when + attack,
    );
    gain.gain.setValueAtTime(
      Math.max(0.0002, volume * 0.82),
      when + releaseStart,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, when + safeDuration);

    oscillatorA.connect(filter);
    oscillatorB.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    oscillatorA.start(when);
    oscillatorB.start(when);
    oscillatorA.stop(when + safeDuration + 0.05);
    oscillatorB.stop(when + safeDuration + 0.05);
  }

  kick(when, volume = 0.06) {
    const context = this.context;
    if (!context || !this.musicGain) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(135, when);
    oscillator.frequency.exponentialRampToValueAtTime(46, when + 0.13);

    gain.gain.setValueAtTime(Math.max(0.0002, volume), when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);

    oscillator.connect(gain);
    gain.connect(this.musicGain);
    oscillator.start(when);
    oscillator.stop(when + 0.18);
  }

  snare(when, volume = 0.03, filterFrequency = 1500) {
    if (!this.musicGain) {
      return;
    }

    this.noise(when, 0.09, volume, this.musicGain, filterFrequency);
    this.tone(185, when, 0.07, volume * 0.45, "triangle", this.musicGain);
  }

  hat(when, volume = 0.009, filterFrequency = 4800) {
    if (!this.musicGain) {
      return;
    }

    this.noise(when, 0.035, volume, this.musicGain, filterFrequency);
  }

  tom(when, frequency, volume = 0.045) {
    if (!this.musicGain) {
      return;
    }

    this.tone(
      frequency,
      when,
      0.12,
      volume,
      "triangle",
      this.musicGain,
    );
    this.noise(when, 0.055, volume * 0.32, this.musicGain, 900);
  }

  tone(frequency, when, duration, volume, waveform, destination, detune = 0) {
    const context = this.context;
    if (!context || !destination || !Number.isFinite(frequency)) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(Math.max(25, frequency), when);
    oscillator.detune.setValueAtTime(detune, when);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), when + 0.012);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      when + Math.max(0.025, duration),
    );

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(when);
    oscillator.stop(when + Math.max(0.04, duration) + 0.03);
  }

  noise(when, duration, volume, destination, filterFrequency = 1800) {
    const context = this.context;
    if (!context || !destination || !this.noiseBuffer) {
      return;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFrequency, when);
    filter.Q.setValueAtTime(0.8, when);

    gain.gain.setValueAtTime(Math.max(0.0002, volume), when);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      when + Math.max(0.02, duration),
    );

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(when);
    source.stop(when + Math.max(0.03, duration) + 0.02);
  }

  canPlaySfx(type, cooldown = 0.025) {
    const context = this.context;
    if (!context) {
      return false;
    }

    const previous = this.lastSfxAt.get(type) ?? -Infinity;
    if (context.currentTime - previous < cooldown) {
      return false;
    }

    this.lastSfxAt.set(type, context.currentTime);
    return true;
  }

  playEvents(events, themeKey) {
    if (!events?.length || !this.enabled) {
      return;
    }

    this.resume();

    for (const event of events) {
      this.playSfx(event, themeKey);
    }
  }

  playSfx(event, themeKey) {
    const context = this.ensureContext();
    if (!context || !this.sfxGain || !this.enabled) {
      return;
    }

    const profile = LEVEL_AUDIO_PROFILES[themeKey] ?? LEVEL_AUDIO_PROFILES.space;
    const pitch = profile.pitch;
    const waveform =
      themeKey === "space"
        ? "sine"
        : themeKey === "jungle"
          ? "triangle"
          : "sawtooth";
    const now = context.currentTime + 0.004;

    switch (event.type) {
      case "weaponAttack": {
        if (!this.canPlaySfx("weaponAttack", 0.035)) {
          break;
        }

        const melee = ["fists", "crowbar", "machete"].includes(event.weaponKey);
        if (melee) {
          this.noise(now, 0.075, 0.08, this.sfxGain, themeKey === "medieval" ? 1100 : 1750);
          this.tone(150 * pitch, now, 0.09, 0.07, waveform, this.sfxGain);
        } else if (themeKey === "medieval") {
          const bowPitch = {
            pistol: 480,
            revolver: 330,
            smg: 620,
            shotgun: 280,
            rifle: 420,
            dmr: 350,
          }[event.weaponKey] ?? 420;
          this.tone(bowPitch * pitch, now, 0.055, 0.075, "triangle", this.sfxGain);
          this.tone(bowPitch * 0.52 * pitch, now + 0.018, 0.095, 0.045, "sine", this.sfxGain);
          this.noise(now + 0.012, 0.035, 0.028, this.sfxGain, 2200);
        } else {
          const weaponPitch = {
            pistol: 520,
            revolver: 360,
            smg: 620,
            shotgun: 230,
            rifle: 470,
            dmr: 410,
          }[event.weaponKey] ?? 480;
          this.tone(weaponPitch * pitch, now, 0.07, 0.11, waveform, this.sfxGain);
          this.noise(
            now,
            event.weaponKey === "shotgun" ? 0.14 : 0.07,
            event.weaponKey === "shotgun" ? 0.13 : 0.07,
            this.sfxGain,
            themeKey === "space" ? 2600 : 1500,
          );
        }
        break;
      }
      case "weaponSelect":
        this.tone(560 * pitch, now, 0.055, 0.06, waveform, this.sfxGain);
        this.tone(760 * pitch, now + 0.045, 0.07, 0.045, profile.leadWave, this.sfxGain);
        break;
      case "pickupWeapon":
        this.tone(440 * pitch, now, 0.08, 0.06, profile.leadWave, this.sfxGain);
        this.tone(660 * pitch, now + 0.07, 0.11, 0.06, profile.leadWave, this.sfxGain);
        this.tone(880 * pitch, now + 0.14, 0.14, 0.05, profile.leadWave, this.sfxGain);
        break;
      case "pickupAmmo":
        if (this.canPlaySfx("pickupAmmo", 0.08)) {
          this.tone(420 * pitch, now, 0.05, 0.045, waveform, this.sfxGain);
          this.tone(620 * pitch, now + 0.035, 0.06, 0.04, waveform, this.sfxGain);
        }
        break;
      case "pickupHealth":
        this.tone(330 * pitch, now, 0.08, 0.05, "sine", this.sfxGain);
        this.tone(495 * pitch, now + 0.06, 0.1, 0.05, "sine", this.sfxGain);
        this.tone(660 * pitch, now + 0.12, 0.14, 0.045, "sine", this.sfxGain);
        break;
      case "pickupPowerUp":
        this.tone(620 * pitch, now, 0.06, 0.045, "sine", this.sfxGain);
        this.tone(930 * pitch, now + 0.045, 0.08, 0.045, "sine", this.sfxGain);
        break;
      case "powerUpUse":
        [0, 4, 7, 12].forEach((semitone, index) => {
          this.tone(
            noteFrequency(440 * pitch, semitone),
            now + index * 0.045,
            0.12,
            0.045,
            profile.leadWave,
            this.sfxGain,
          );
        });
        break;
      case "enemyAttack":
        if (this.canPlaySfx("enemyAttack", 0.055)) {
          if (event.style === "ranged") {
            this.tone(260 * pitch, now, 0.11, 0.065, waveform, this.sfxGain);
            this.noise(now, 0.05, 0.04, this.sfxGain, 1200);
          } else {
            this.tone(105 * pitch, now, 0.1, 0.065, "triangle", this.sfxGain);
            this.noise(now, 0.08, 0.055, this.sfxGain, 700);
          }
        }
        break;
      case "enemyHit":
        if (this.canPlaySfx("enemyHit", 0.035)) {
          this.noise(now, 0.045, 0.055, this.sfxGain, themeKey === "space" ? 2400 : 1200);
          this.tone(190 * pitch, now, 0.05, 0.035, waveform, this.sfxGain);
        }
        break;
      case "enemyDeath":
        if (this.canPlaySfx("enemyDeath", 0.07)) {
          this.tone(135 * pitch, now, 0.16, 0.075, "sawtooth", this.sfxGain);
          this.tone(82 * pitch, now + 0.07, 0.2, 0.055, "triangle", this.sfxGain);
          this.noise(now, 0.12, 0.07, this.sfxGain, 650);
        }
        break;
      case "playerHit":
        if (this.canPlaySfx("playerHit", 0.09)) {
          this.noise(now, 0.11, 0.12, this.sfxGain, 850);
          this.tone(82 * pitch, now, 0.18, 0.1, "sawtooth", this.sfxGain);
        }
        break;
      case "outOfAmmo":
        if (this.canPlaySfx("outOfAmmo", 0.22)) {
          this.tone(160 * pitch, now, 0.035, 0.045, "square", this.sfxGain);
          this.tone(120 * pitch, now + 0.05, 0.035, 0.04, "square", this.sfxGain);
        }
        break;
      case "victory": {
        if (this.musicGain) {
          this.musicGain.gain.setTargetAtTime(0.055, now, 0.08);
        }

        [0, 4, 7, 12, 16].forEach((semitone, index) => {
          this.tone(
            noteFrequency(330 * pitch, semitone),
            now + index * 0.11,
            0.28,
            0.085,
            profile.leadWave,
            this.sfxGain,
          );
        });
        break;
      }
      case "gameOver":
        if (this.musicGain) {
          this.musicGain.gain.setTargetAtTime(0.035, now, 0.08);
        }
        [0, -3, -7, -12].forEach((semitone, index) => {
          this.tone(
            noteFrequency(220 * pitch, semitone),
            now + index * 0.12,
            0.24,
            0.08,
            "sawtooth",
            this.sfxGain,
          );
        });
        break;
      default:
        break;
    }
  }

  destroy() {
    this.stopMusic();

    if (this.context && this.context.state !== "closed") {
      this.context.close().catch(() => {});
    }

    this.context = null;
  }
}
