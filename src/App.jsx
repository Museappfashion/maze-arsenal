// src/App.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const CANVAS_WIDTH = 840;
const CANVAS_HEIGHT = 720;
const DRAW_TILE = 24;
const PASSAGE_WIDTH = 4;
const GRAPHICS_VERSION = "Themed Graphics v7";
const MAX_EFFECTS = 900;
const VIEW_3D_FOV = Math.PI * 0.38;
const VIEW_3D_RAY_WIDTH = 3;
const VIEW_3D_MAX_DISTANCE = 28;
const VIEW_3D_MOUSE_SENSITIVITY = 0.0025;
const VIEW_3D_TURN_SPEED = 2.15;

const FLOOR = 0;
const WALL = 1;

const LEVELS = {
  level1: {
    key: "level1",
    label: "Level 1",
    subtitle: "Orbital Ruins",
    themeKey: "space",
    themeLabel: "Space",
    description: "Drift through a cold orbital maze of metal decks, star-lit walls, and cosmic mist.",
    logicalCols: 17,
    logicalRows: 17,
    straightBias: 0.8,
    newestBias: 0.88,
    braidDeadEndChance: 0.08,
    extraLoopChance: 0.01,
    enemyHpMultiplier: 0.9,
    enemyDamageMultiplier: 0.9,
    enemySpeedMultiplier: 0.95,
    enemyBudgetMultiplier: 0.9,
  },
  level2: {
    key: "level2",
    label: "Level 2",
    subtitle: "Emerald Wilds",
    themeKey: "jungle",
    themeLabel: "Jungle",
    description: "Push through overgrown ruins with grass floors, vine-choked walls, and humid green mist.",
    logicalCols: 25,
    logicalRows: 25,
    straightBias: 0.68,
    newestBias: 0.74,
    braidDeadEndChance: 0.18,
    extraLoopChance: 0.035,
    enemyHpMultiplier: 1.15,
    enemyDamageMultiplier: 1.15,
    enemySpeedMultiplier: 1.05,
    enemyBudgetMultiplier: 1.2,
  },
  level3: {
    key: "level3",
    label: "Level 3",
    subtitle: "The Fallen Keep",
    themeKey: "medieval",
    themeLabel: "Medieval",
    description: "Fight through a sprawling ruined keep of stone corridors, torch smoke, and castle walls.",
    logicalCols: 33,
    logicalRows: 33,
    straightBias: 0.56,
    newestBias: 0.62,
    braidDeadEndChance: 0.32,
    extraLoopChance: 0.07,
    enemyHpMultiplier: 1.45,
    enemyDamageMultiplier: 1.35,
    enemySpeedMultiplier: 1.12,
    enemyBudgetMultiplier: 1.55,
  },
};


const LEVEL_THEMES = {
  space: {
    label: "Space",
    backdrop: "#020611",
    floorA: "#07111f",
    floorB: "#0b1728",
    floorLine: "rgba(96, 165, 250, 0.14)",
    wallA: "#31516c",
    wallB: "#142c43",
    wallC: "#050b14",
    wallEdge: "rgba(103, 232, 249, 0.42)",
    fog: [5, 8, 20],
    mist: [147, 197, 253],
    playerGlow: "#38bdf8",
    playerAccent: "#bae6fd",
  },
  jungle: {
    label: "Jungle",
    backdrop: "#031008",
    floorA: "#163b1f",
    floorB: "#1d4724",
    floorLine: "rgba(134, 239, 172, 0.1)",
    wallA: "#405f35",
    wallB: "#253f27",
    wallC: "#0b1d11",
    wallEdge: "rgba(163, 230, 53, 0.24)",
    fog: [5, 20, 11],
    mist: [134, 239, 172],
    playerGlow: "#4ade80",
    playerAccent: "#fef3c7",
  },
  medieval: {
    label: "Medieval",
    backdrop: "#0c0907",
    floorA: "#342f2b",
    floorB: "#3e3730",
    floorLine: "rgba(253, 186, 116, 0.08)",
    wallA: "#70675e",
    wallB: "#49423d",
    wallC: "#211d1a",
    wallEdge: "rgba(253, 186, 116, 0.2)",
    fog: [22, 18, 16],
    mist: [214, 211, 209],
    playerGlow: "#f59e0b",
    playerAccent: "#e7e5e4",
  },
};


const LEVEL_AUDIO_PROFILES = {
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
};

function noteFrequency(root, semitones) {
  return root * 2 ** (semitones / 12);
}

function queueSfx(world, type, detail = {}) {
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

class MazeAudioEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.musicFilter = null;
    this.musicDelay = null;
    this.musicDelayGain = null;
    this.musicFeedbackGain = null;
    this.sfxGain = null;
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

    this.masterGain.gain.value = this.enabled ? 0.72 : 0;
    this.musicGain.gain.value = 0.2;
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 3600;
    this.musicDelay.delayTime.value = 0.28;
    this.musicDelayGain.gain.value = 0.14;
    this.musicFeedbackGain.gain.value = 0.22;
    this.sfxGain.gain.value = 0.62;

    this.musicGain.connect(this.musicFilter);
    this.musicFilter.connect(this.masterGain);
    this.musicFilter.connect(this.musicDelay);
    this.musicDelay.connect(this.musicDelayGain);
    this.musicDelayGain.connect(this.masterGain);
    this.musicDelay.connect(this.musicFeedbackGain);
    this.musicFeedbackGain.connect(this.musicDelay);
    this.sfxGain.connect(this.masterGain);
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
    if (context?.state === "suspended") {
      context.resume().catch(() => {});
    }
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

  startMusic(themeKey) {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    this.resume();
    this.currentTheme = LEVEL_AUDIO_PROFILES[themeKey] ? themeKey : "space";
    this.step = 0;
    this.nextBeatTime = context.currentTime + 0.06;
    this.configureMusicEffects(LEVEL_AUDIO_PROFILES[this.currentTheme]);

    if (this.musicGain) {
      const now = context.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(0.2, now, 0.08);
    }

    if (this.scheduler) {
      window.clearInterval(this.scheduler);
    }

    this.scheduler = window.setInterval(() => this.scheduleMusic(), 50);
    this.scheduleMusic();
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
    if (!context || !this.enabled || !this.currentTheme) {
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

const LEVEL_WEAPON_PRESENTATIONS = {
  space: {
    fists: { label: "Gravity Grips", description: "Magnetic combat gloves that turn each punch into a crushing gravity burst." },
    crowbar: { label: "Hullbreaker", description: "A meteor-alloy impact tool made to split armored ship plating." },
    machete: { label: "Solaris Edge", description: "A broad ion blade burning with a miniature solar flare." },
    pistol: { label: "Starlight", description: "A compact sidearm that fires clean bolts of concentrated light." },
    revolver: { label: "Supernova Six", description: "Six heavy chambers built to strike with explosive force." },
    smg: { label: "Pulsar", description: "A rapid energy emitter that releases a relentless stream of pulses." },
    shotgun: { label: "Cometfall", description: "A close-range blaster that scatters a storm of burning fragments." },
    rifle: { label: "Orion's Lance", description: "A balanced long arm that drives bright shots through the dark." },
    dmr: { label: "Event Horizon", description: "A precision weapon whose scoped shots seem impossible to escape." },
  },
  jungle: {
    fists: { label: "Jaguar Claws", description: "Reinforced trail gloves made for fast, close strikes." },
    crowbar: { label: "Temple Crusher", description: "A stone-headed relic strong enough to crack ancient masonry." },
    machete: { label: "Emerald Fang", description: "A sweeping green blade made to cut through vines and enemies alike." },
    pistol: { label: "Pathfinder's Sting", description: "A mud-proof sidearm trusted by generations of expedition leaders." },
    revolver: { label: "Thunder Idol", description: "A recovered temple weapon whose heavy shots echo through the trees." },
    smg: { label: "Hornet Swarm", description: "A compact automatic weapon with a furious, stinging burst." },
    shotgun: { label: "Monsoon", description: "A close-range weapon that floods the path with a wide blast." },
    rifle: { label: "Canopy Spear", description: "A dependable long arm for threats hiding beyond the leaves." },
    dmr: { label: "Eagle Eye", description: "A relic scope and precise barrel built for impossible shots through the canopy." },
  },
  medieval: {
    fists: { label: "Oathbound", description: "Consecrated steel gauntlets carried by the keep's sworn champion." },
    crowbar: { label: "King's Justice", description: "An iron-banded war club made to crush armor and rebellion." },
    machete: { label: "Ashen Fang", description: "A fast single-edged sword blackened in the keep's final siege." },
    pistol: { label: "Squire's Shortbow", description: "A compact bow with a quick draw for close and mid-range fights." },
    revolver: { label: "Knight's Warbow", description: "A heavy bow that trades draw speed for punishing single-arrow hits." },
    smg: { label: "Swiftbow", description: "A light recurve bow built for rapid volleys of arrows." },
    shotgun: { label: "Volley Bow", description: "A rune-split bow that releases a fan of arrows at close range." },
    rifle: { label: "Watchman's Longbow", description: "A balanced longbow made for accurate shots along the castle walls." },
    dmr: { label: "Crownseeker Greatbow", description: "The royal marksman's greatbow, made for one decisive distant arrow." },
  },
};

function getTheme(world) {
  return LEVEL_THEMES[world.level.themeKey] ?? LEVEL_THEMES.space;
}

function getWeaponPresentation(world, weaponKey) {
  return (
    LEVEL_WEAPON_PRESENTATIONS[world.level.themeKey]?.[weaponKey] ?? {
      label: WEAPONS[weaponKey]?.label ?? "Weapon",
      description: "",
    }
  );
}

function getWeaponLabel(world, weaponKey) {
  return getWeaponPresentation(world, weaponKey).label;
}

function isMedievalTheme(world) {
  return world?.level?.themeKey === "medieval";
}

function getAmmoLabel(world) {
  return isMedievalTheme(world) ? "Arrows" : "Ammo";
}

function getAmmoPickupLabel(world) {
  return isMedievalTheme(world) ? "Arrow Bundle" : "Ammo";
}

function getAmmoMessageLabel(world) {
  return isMedievalTheme(world) ? "arrows" : "ammo";
}

function getPowerUpPresentation(world, key) {
  const base = POWER_UPS[key];

  if (!base || !isMedievalTheme(world)) {
    return base;
  }

  const medievalOverrides = {
    overcharge: { label: "Endless Quiver", short: "Free arrows +10% dmg" },
    pierce: { label: "Piercing Arrows", short: "Pierce 5 +12% dmg" },
    scattershot: { label: "Volley", short: "Wide x1.7 total dmg" },
    precision: { label: "True Fletching", short: "Aim +18% damage" },
    ammoSurge: { label: "Quiver Surge", short: "+10 arrows/s" },
    demolition: { label: "Siege Arrows", short: "10 wall breaks" },
  };

  return {
    ...base,
    ...(medievalOverrides[key] ?? {}),
  };
}

const DEFAULT_LEVEL_KEY = "level1";

const LEADERBOARD_STORAGE_KEY = "maze-arsenal-fastest-escapes-v2";
const LEGACY_LEADERBOARD_STORAGE_KEY = "maze-arsenal-fastest-escapes-v1";
const LEADERBOARD_LIMIT = 10;
const PLAYER_NAME_LIMIT = 20;
const GLOBAL_LEADERBOARD_TABLE = "leaderboard_scores";
const GLOBAL_LEADERBOARD_RPC = "get_global_leaderboard";
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
let detectedCountryCodePromise = null;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
const GLOBAL_LEADERBOARD_ENABLED = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
);

const supabase = GLOBAL_LEADERBOARD_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

function normalizeCountryCode(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return COUNTRY_CODE_PATTERN.test(normalized) ? normalized : "";
}

function countryCodeToFlag(value) {
  const countryCode = normalizeCountryCode(value);

  if (!countryCode) {
    return "🌐";
  }

  return String.fromCodePoint(
    ...countryCode.split("").map((character) => 127397 + character.charCodeAt(0)),
  );
}

function inferCountryCodeFromLocale() {
  if (typeof navigator === "undefined") {
    return "";
  }

  const locales = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ].filter(Boolean);

  for (const locale of locales) {
    try {
      const region = new Intl.Locale(locale).region;
      const normalized = normalizeCountryCode(region);

      if (normalized) {
        return normalized;
      }
    } catch {
      const match = String(locale).match(/[-_]([A-Za-z]{2})\b/);
      const normalized = normalizeCountryCode(match?.[1]);

      if (normalized) {
        return normalized;
      }
    }
  }

  return "";
}

async function detectCountryCode() {
  if (detectedCountryCodePromise) {
    return detectedCountryCodePromise;
  }

  detectedCountryCodePromise = (async () => {
    if (typeof window === "undefined") {
      return "";
    }

    try {
      const response = await fetch("/api/country", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const countryCode = normalizeCountryCode(data?.country);

        if (countryCode) {
          return countryCode;
        }
      }
    } catch {
      // Local Vite development has no Vercel geo endpoint, so locale is the fallback.
    }

    return inferCountryCodeFromLocale();
  })();

  return detectedCountryCodePromise;
}

function sanitizePlayerName(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PLAYER_NAME_LIMIT);
}

function getPlayerDisplayName(valueOrWorld) {
  const value =
    valueOrWorld && typeof valueOrWorld === "object"
      ? valueOrWorld.playerName
      : valueOrWorld;

  return sanitizePlayerName(value) || "You";
}

function createEmptyLeaderboards() {
  return Object.fromEntries(
    Object.keys(LEVELS).map((levelKey) => [
      levelKey,
      {
        "2d": [],
        "3d": [],
      },
    ]),
  );
}

function createEmptyUserRanks() {
  return Object.fromEntries(
    Object.keys(LEVELS).map((levelKey) => [
      levelKey,
      {
        "2d": null,
        "3d": null,
      },
    ]),
  );
}

function normalizeLeaderboardEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => ({
      time: Number(entry?.time),
      completedAt:
        typeof entry?.completedAt === "string" ? entry.completedAt : "",
      playerName: getPlayerDisplayName(entry?.playerName),
      countryCode: normalizeCountryCode(entry?.countryCode),
      globalRank: Number.isFinite(Number(entry?.globalRank))
        ? Number(entry.globalRank)
        : null,
      isCurrentUser: Boolean(entry?.isCurrentUser),
    }))
    .filter((entry) => Number.isFinite(entry.time) && entry.time > 0)
    .sort((a, b) => a.time - b.time)
    .slice(0, LEADERBOARD_LIMIT);
}

function normalizeLevelLeaderboards(levelBoards) {
  if (Array.isArray(levelBoards)) {
    return {
      "2d": normalizeLeaderboardEntries(levelBoards),
      "3d": [],
    };
  }

  return {
    "2d": normalizeLeaderboardEntries(levelBoards?.["2d"]),
    "3d": normalizeLeaderboardEntries(levelBoards?.["3d"]),
  };
}

function normalizeLeaderboards(stored) {
  return Object.fromEntries(
    Object.keys(LEVELS).map((levelKey) => [
      levelKey,
      normalizeLevelLeaderboards(stored?.[levelKey]),
    ]),
  );
}

function loadLeaderboards() {
  const empty = createEmptyLeaderboards();

  if (typeof window === "undefined") {
    return empty;
  }

  try {
    const currentRaw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (currentRaw) {
      return normalizeLeaderboards(JSON.parse(currentRaw));
    }

    const legacyRaw = window.localStorage.getItem(
      LEGACY_LEADERBOARD_STORAGE_KEY,
    );
    if (!legacyRaw) {
      return empty;
    }

    const migrated = normalizeLeaderboards(JSON.parse(legacyRaw));
    window.localStorage.setItem(
      LEADERBOARD_STORAGE_KEY,
      JSON.stringify(migrated),
    );
    return migrated;
  } catch {
    return empty;
  }
}

function saveLeaderboards(leaderboards) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LEADERBOARD_STORAGE_KEY,
      JSON.stringify(leaderboards),
    );
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
}

function addLeaderboardTime(
  leaderboards,
  levelKey,
  mode,
  time,
  playerName,
) {
  if (!LEVELS[levelKey] || !Number.isFinite(time) || time <= 0) {
    return leaderboards;
  }

  const normalizedMode = mode === "3d" ? "3d" : "2d";
  const levelBoards = normalizeLevelLeaderboards(leaderboards[levelKey]);
  const nextEntries = normalizeLeaderboardEntries([
    ...levelBoards[normalizedMode],
    {
      time,
      completedAt: new Date().toISOString(),
      playerName: getPlayerDisplayName(playerName),
    },
  ]);

  return {
    ...leaderboards,
    [levelKey]: {
      ...levelBoards,
      [normalizedMode]: nextEntries,
    },
  };
}

async function ensureGlobalLeaderboardSession() {
  if (!supabase) {
    throw new Error("Global leaderboard is not configured.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (session) {
    return session;
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("Supabase did not create an anonymous session.");
  }

  return data.session;
}

async function fetchGlobalLeaderboards() {
  if (!supabase) {
    return null;
  }

  await ensureGlobalLeaderboardSession();

  const { data, error } = await supabase.rpc(GLOBAL_LEADERBOARD_RPC);

  if (error) {
    throw error;
  }

  const nextLeaderboards = createEmptyLeaderboards();
  const userRanks = createEmptyUserRanks();

  for (const row of data ?? []) {
    const levelKey = row.level_key;
    const mode = row.mode === "3d" ? "3d" : "2d";
    const globalRank = Number(row.global_rank);
    const time = Number(row.time_seconds);

    if (!LEVELS[levelKey] || !Number.isFinite(time) || time <= 0) {
      continue;
    }

    const entry = {
      time,
      completedAt: row.created_at ?? "",
      playerName: row.player_name,
      countryCode: normalizeCountryCode(row.country_code),
      globalRank: Number.isFinite(globalRank) ? globalRank : null,
      isCurrentUser: Boolean(row.is_current_user),
    };

    if (entry.isCurrentUser) {
      userRanks[levelKey][mode] = {
        rank: entry.globalRank,
        bestTime: entry.time,
      };
    }

    if (entry.globalRank && entry.globalRank <= LEADERBOARD_LIMIT) {
      nextLeaderboards[levelKey][mode].push(entry);
    }
  }

  for (const levelKey of Object.keys(LEVELS)) {
    nextLeaderboards[levelKey]["2d"] = normalizeLeaderboardEntries(
      nextLeaderboards[levelKey]["2d"],
    );
    nextLeaderboards[levelKey]["3d"] = normalizeLeaderboardEntries(
      nextLeaderboards[levelKey]["3d"],
    );
  }

  return {
    leaderboards: nextLeaderboards,
    userRanks,
  };
}

async function submitGlobalLeaderboardTime(
  levelKey,
  mode,
  time,
  playerName,
  countryCode,
) {
  if (!supabase || !LEVELS[levelKey] || !Number.isFinite(time) || time <= 0) {
    return false;
  }

  const session = await ensureGlobalLeaderboardSession();
  const normalizedMode = mode === "3d" ? "3d" : "2d";
  const roundedTime = Math.round(time * 1000) / 1000;

  const { error } = await supabase.from(GLOBAL_LEADERBOARD_TABLE).insert({
    user_id: session.user.id,
    player_name: getPlayerDisplayName(playerName),
    level_key: levelKey,
    mode: normalizedMode,
    time_seconds: roundedTime,
    country_code: normalizeCountryCode(countryCode) || null,
  });

  if (error) {
    throw error;
  }

  return true;
}

const MAX_AMMO = 200;
const POWER_UP_PICKUP_COUNT = 20;
const HUD_REFRESH_INTERVAL = 0.12;
const DISTANCE_FIELD_INTERVAL = 0.08;
const VISION_MARGIN = 9;

const POWER_UP_DURATIONS = {
  juggernaut: 16,
  breaker: 12,
  berserk: 16,
  haste: 20,
  rapidFire: 16,
  shield: 18,
  regen: 18,
  magnet: 24,
  overcharge: 16,
  pierce: 18,
  vampirism: 20,
  frost: 20,
  longArms: 20,
  scattershot: 16,
  precision: 18,
  ammoSurge: 18,
  sonar: 18,
  phaseWalk: 8,
  demolition: 12,
  bounty: 20,
};

const POWER_UP_WALL_BREAK_CHARGES = {
  breaker: 12,
  demolition: 10,
};

function getPowerUpDuration(key) {
  return POWER_UP_DURATIONS[key] ?? 14;
}

const WEAPON_ORDER = [ "fists", "crowbar", "machete", "pistol", "revolver", "smg", "shotgun", "rifle", "dmr", ]; const WEAPON_HOTKEY_MAP = Object.fromEntries( WEAPON_ORDER.slice(0, 9).map((weaponKey, index) => [ String(index + 1), weaponKey, ]), );

const WEAPON_HOTKEY_LABEL = WEAPON_ORDER.length <= 1 ? "1" : `1-${Math.min(WEAPON_ORDER.length, 9)}`;

const WEAPONS = { fists: { label: "Fists", type: "melee", reach: 1.05, arc: 1.2, damage: 14, cooldown: 0.42, }, crowbar: { label: "Crowbar", type: "melee", reach: 1.55, arc: 1.1, damage: 30, cooldown: 0.32, }, machete: { label: "Machete", type: "melee", reach: 1.7, arc: 1.45, damage: 24, cooldown: 0.2, }, pistol: { label: "Pistol", type: "ranged", damage: 22, cooldown: 0.28, bulletSpeed: 13, spread: 0.02, range: 12, ammoCost: 1, pellets: 1, }, revolver: { label: "Revolver", type: "ranged", damage: 42, cooldown: 0.5, bulletSpeed: 15.5, spread: 0.012, range: 13.5, ammoCost: 1, pellets: 1, }, smg: { label: "SMG", type: "ranged", damage: 10, cooldown: 0.08, bulletSpeed: 14, spread: 0.14, range: 10.5, ammoCost: 1, pellets: 1, }, shotgun: { label: "Shotgun", type: "ranged", damage: 11, cooldown: 0.9, bulletSpeed: 12, spread: 0.5, range: 6.2, ammoCost: 1, pellets: 6, }, rifle: { label: "Rifle", type: "ranged", damage: 19, cooldown: 0.12, bulletSpeed: 15, spread: 0.05, range: 13, ammoCost: 1, pellets: 1, }, dmr: { label: "DMR", type: "ranged", damage: 34, cooldown: 0.34, bulletSpeed: 17, spread: 0.015, range: 15, ammoCost: 1, pellets: 1, }, };

const WEAPON_SPAWN_PLAN = [ { weapon: "crowbar", percent: 0.1, spread: 8, supportDrops: 1 }, { weapon: "machete", percent: 0.18, spread: 8, supportDrops: 1 }, { weapon: "pistol", percent: 0.28, spread: 10, supportDrops: 2 }, { weapon: "revolver", percent: 0.4, spread: 10, supportDrops: 2 }, { weapon: "smg", percent: 0.52, spread: 12, supportDrops: 3 }, { weapon: "shotgun", percent: 0.64, spread: 12, supportDrops: 3 }, { weapon: "rifle", percent: 0.78, spread: 14, supportDrops: 3 }, { weapon: "dmr", percent: 0.9, spread: 14, supportDrops: 3 }, ];

const POWER_UPS = {
  juggernaut: { label: "Double Health", color: "#fb7185", short: "HP x2.2" },
  breaker: { label: "Wall Breaker", color: "#f97316", short: "12 wall breaks" },
  berserk: { label: "Berserk", color: "#ef4444", short: "Damage x2" },
  haste: { label: "Haste", color: "#22c55e", short: "Speed x1.75" },
  rapidFire: { label: "Rapid Fire", color: "#38bdf8", short: "Cooldown -55%" },
  shield: { label: "Shield", color: "#60a5fa", short: "Damage -50%" },
  regen: { label: "Regeneration", color: "#34d399", short: "Heal 7/s" },
  magnet: { label: "Magnet", color: "#a78bfa", short: "Vacuum 7 tiles" },
  overcharge: { label: "Overcharge", color: "#facc15", short: "Free ammo +10% dmg" },
  pierce: { label: "Piercing Rounds", color: "#e879f9", short: "Pierce 5 +12% dmg" },
  vampirism: { label: "Vampirism", color: "#dc2626", short: "Heal 22% hit" },
  frost: { label: "Frost Field", color: "#67e8f9", short: "Enemies x0.5" },
  longArms: { label: "Long Arms", color: "#c084fc", short: "Melee master" },
  scattershot: { label: "Scattershot", color: "#f59e0b", short: "Wide x1.7 total dmg" },
  precision: { label: "Precision", color: "#93c5fd", short: "Aim +18% damage" },
  ammoSurge: { label: "Ammo Surge", color: "#2563eb", short: "+10 ammo/s" },
  sonar: { label: "Sonar", color: "#14b8a6", short: "Track all enemies" },
  phaseWalk: { label: "Phase Walk", color: "#818cf8", short: "8s damage immune" },
  demolition: { label: "Demolition", color: "#fb923c", short: "10 wall breaks" },
  bounty: { label: "Bounty", color: "#f472b6", short: "+7 HP +10 ammo/kill" },
};

const POWER_UP_SPAWN_ORDER = [ "juggernaut", "breaker", "berserk", "haste", "rapidFire", "shield", "regen", "magnet", "overcharge", "pierce", "vampirism", "frost", "longArms", "scattershot", "precision", "ammoSurge", "sonar", "phaseWalk", "demolition", "bounty", ];

const ENEMY_TYPES = { skitter: { label: "Skitter", hp: 14, speed: 3.55, radius: 0.22, contactDamage: 5, contactCooldown: 0.52, color: "#facc15", palette: ["#facc15", "#fde047", "#f59e0b"], alertRadius: 13, }, scout: { label: "Scout", hp: 22, speed: 2.7, radius: 0.28, contactDamage: 8, contactCooldown: 0.72, color: "#fb923c", palette: ["#fb923c", "#f59e0b", "#fdba74"], alertRadius: 12, }, crawler: { label: "Crawler", hp: 40, speed: 1.9, radius: 0.34, contactDamage: 11, contactCooldown: 0.85, color: "#ef4444", palette: ["#ef4444", "#f87171", "#dc2626"], alertRadius: 12, }, charger: { label: "Charger", hp: 36, speed: 1.95, radius: 0.33, contactDamage: 14, contactCooldown: 0.9, chargeRange: 4.15, chargeSpeedMultiplier: 1.9, color: "#fb7185", palette: ["#fb7185", "#f43f5e", "#e11d48"], alertRadius: 13, }, brute: { label: "Brute", hp: 74, speed: 1.1, radius: 0.42, contactDamage: 17, contactCooldown: 1.08, color: "#a855f7", palette: ["#a855f7", "#9333ea", "#c084fc"], alertRadius: 12, }, warden: { label: "Warden", hp: 118, speed: 0.86, radius: 0.5, contactDamage: 22, contactCooldown: 1.22, color: "#8b5cf6", palette: ["#8b5cf6", "#7c3aed", "#6d28d9"], alertRadius: 13, }, spitter: { label: "Spitter", hp: 28, speed: 1.55, radius: 0.3, projectileDamage: 9, projectileSpeed: 8.8, attackCooldown: 1.5, attackRange: 8.4, preferredRange: 5.2, projectileSpread: 0.12, projectileCount: 1, projectileColor: "#86efac", color: "#34d399", palette: ["#34d399", "#10b981", "#6ee7b7"], alertRadius: 15, }, turret: { label: "Turret", hp: 32, speed: 0, radius: 0.32, projectileDamage: 12, projectileSpeed: 10.2, attackCooldown: 1.28, attackRange: 9.4, projectileSpread: 0.08, projectileCount: 1, projectileColor: "#34d399", color: "#10b981", palette: ["#10b981", "#22c55e", "#4ade80"], alertRadius: 999, }, };

const ENEMY_COSTS = { skitter: 0.8, scout: 1, crawler: 1.45, charger: 1.7, spitter: 1.95, turret: 2.2, brute: 2.5, warden: 4.1, };

const GUARANTEED_TURRETS = { level1: 4, level2: 7, level3: 11 };

const ENEMY_DIFFICULTY_STAGES = [ { key: "opening", start: 0.08, end: 0.18, encounters: [4, 5], budget: [1.8, 3.1], packCap: 2, clusterRadius: 3, spread: 7, weights: { skitter: 12, scout: 8, crawler: 2, }, }, { key: "early", start: 0.18, end: 0.34, encounters: [5, 6], budget: [2.6, 4.2], packCap: 3, clusterRadius: 4, spread: 8, weights: { skitter: 8, scout: 10, crawler: 6, charger: 2, }, }, { key: "mid", start: 0.34, end: 0.56, encounters: [5, 6], budget: [4.0, 5.8], packCap: 4, clusterRadius: 4, spread: 9, weights: { scout: 8, crawler: 9, charger: 5, spitter: 4, brute: 3, turret: 2, }, }, { key: "late", start: 0.56, end: 0.78, encounters: [6, 7], budget: [5.6, 8.0], packCap: 5, clusterRadius: 5, spread: 10, weights: { crawler: 7, charger: 6, spitter: 5, brute: 5, turret: 4, scout: 3, warden: 1, }, }, { key: "endgame", start: 0.78, end: 0.96, encounters: [6, 7], budget: [6.8, 9.8], packCap: 6, clusterRadius: 5, spread: 11, weights: { charger: 5, spitter: 6, brute: 6, turret: 5, crawler: 4, warden: 2, scout: 2, }, }, ];

const WORLD_LABEL_FONT = "11px system-ui, sans-serif"; const WORLD_LABEL_TEXT = "#f8fafc"; const WORLD_LABEL_BG = "rgba(2, 6, 23, 0.86)"; const WORLD_LABEL_BORDER = "rgba(148, 163, 184, 0.35)";

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function lerp(a, b, t) { return a + (b - a) * t; }

function rand(min = 0, max = 1) { return min + Math.random() * (max - min); }

function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

function chance(probability) { return Math.random() < probability; }

function shuffle(items) { const list = [...items]; for (let i = list.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; }

function weightedChoice(entries) { if (!entries.length) { return null; }

let total = 0; for (const [, weight] of entries) { total += weight; }

let roll = Math.random() * total; for (const [key, weight] of entries) { roll -= weight; if (roll <= 0) { return key; } }

return entries[entries.length - 1][0]; }

function indexOfTile(width, x, y) { return y * width + x; }

function tileCenter(tile) { return { x: tile.x + 0.5, y: tile.y + 0.5 }; }

function normalize(x, y) { const length = Math.hypot(x, y) || 1; return { x: x / length, y: y / length }; }

function angleDelta(a, b) { let delta = a - b; while (delta > Math.PI) delta -= Math.PI * 2; while (delta < -Math.PI) delta += Math.PI * 2; return delta; }

function formatTime(seconds) { const safe = Math.max(0, Math.floor(seconds)); const minutes = String(Math.floor(safe / 60)).padStart(2, "0"); const secs = String(safe % 60).padStart(2, "0");

return `${minutes}:${secs}`; }

function formatLeaderboardTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const wholeSeconds = Math.floor(safe);
  const minutes = String(Math.floor(wholeSeconds / 60)).padStart(2, "0");
  const secs = String(wholeSeconds % 60).padStart(2, "0");
  const centiseconds = String(Math.floor((safe - wholeSeconds) * 100)).padStart(2, "0");

  return `${minutes}:${secs}.${centiseconds}`;
}

function createOwnedWeapons() { return Object.fromEntries( WEAPON_ORDER.map((weaponKey) => [weaponKey, weaponKey === "fists"]), ); }

function createLogicalConnections(logicalCols, logicalRows, mazeConfig) { const visited = Array.from({ length: logicalRows }, () => Array(logicalCols).fill(false), );

const connections = Array.from({ length: logicalRows }, () => Array.from({ length: logicalCols }, () => ({ n: false, e: false, s: false, w: false, })), );

const active = [{ x: 0, y: 0, lastDir: null }]; visited[0][0] = true;

while (active.length) { const currentIndex = chance(mazeConfig.newestBias) ? active.length - 1 : Math.floor(Math.random() * active.length);

const current = active[currentIndex];

let directions = shuffle([
  { dx: 1, dy: 0, key: "e", opposite: "w" },
  { dx: -1, dy: 0, key: "w", opposite: "e" },
  { dx: 0, dy: 1, key: "s", opposite: "n" },
  { dx: 0, dy: -1, key: "n", opposite: "s" },
]);

if (current.lastDir && chance(mazeConfig.straightBias)) {
  directions = [
    current.lastDir,
    ...directions.filter(
      (direction) => direction.key !== current.lastDir.key,
    ),
  ];
}

let carved = false;

for (const direction of directions) {
  const nx = current.x + direction.dx;
  const ny = current.y + direction.dy;

  if (nx < 0 || ny < 0 || nx >= logicalCols || ny >= logicalRows) {
    continue;
  }

  if (visited[ny][nx]) {
    continue;
  }

  visited[ny][nx] = true;
  connections[current.y][current.x][direction.key] = true;
  connections[ny][nx][direction.opposite] = true;

  active.push({ x: nx, y: ny, lastDir: direction });
  carved = true;
  break;
}

if (!carved) {
  active.splice(currentIndex, 1);
}

}

return connections; }

function countLogicalOpenConnections(connections, x, y) { const cell = connections[y][x]; return Number(cell.n) + Number(cell.e) + Number(cell.s) + Number(cell.w); }

function connectLogicalCells(connections, x, y, direction) { const deltas = { n: { dx: 0, dy: -1, opposite: "s" }, e: { dx: 1, dy: 0, opposite: "w" }, s: { dx: 0, dy: 1, opposite: "n" }, w: { dx: -1, dy: 0, opposite: "e" }, };

const delta = deltas[direction]; const nx = x + delta.dx; const ny = y + delta.dy;

if (!connections[ny]?.[nx]) { return; }

connections[y][x][direction] = true; connections[ny][nx][delta.opposite] = true; }

function carveBraids(connections, logicalCols, logicalRows, braidChance) { const deadEnds = [];

for (let y = 0; y < logicalRows; y += 1) { for (let x = 0; x < logicalCols; x += 1) { if (countLogicalOpenConnections(connections, x, y) === 1) { deadEnds.push({ x, y }); } } }

for (const tile of shuffle(deadEnds)) { if (!chance(braidChance)) { continue; }

const closedDirections = [
  { key: "e", nx: tile.x + 1, ny: tile.y },
  { key: "w", nx: tile.x - 1, ny: tile.y },
  { key: "s", nx: tile.x, ny: tile.y + 1 },
  { key: "n", nx: tile.x, ny: tile.y - 1 },
].filter(
  (direction) =>
    connections[direction.ny]?.[direction.nx] &&
    !connections[tile.y][tile.x][direction.key],
);

if (!closedDirections.length) {
  continue;
}

const choice =
  closedDirections[Math.floor(Math.random() * closedDirections.length)];
connectLogicalCells(connections, tile.x, tile.y, choice.key);

} }

function carveExtraLoops(connections, logicalCols, logicalRows, loopChance) { for (let y = 0; y < logicalRows; y += 1) { for (let x = 0; x < logicalCols; x += 1) { if ( x + 1 < logicalCols && !connections[y][x].e && chance(loopChance) ) { connectLogicalCells(connections, x, y, "e"); }

  if (
    y + 1 < logicalRows &&
    !connections[y][x].s &&
    chance(loopChance)
  ) {
    connectLogicalCells(connections, x, y, "s");
  }
}

} }

function logicalCellOrigin(cellX, cellY) { return { x: 1 + cellX * (PASSAGE_WIDTH + 1), y: 1 + cellY * (PASSAGE_WIDTH + 1), }; }

function logicalCellSpawnPosition(cellX, cellY) { const origin = logicalCellOrigin(cellX, cellY); return { x: origin.x + PASSAGE_WIDTH / 2, y: origin.y + PASSAGE_WIDTH / 2, }; }

function carveLogicalCell(grid, cellX, cellY) { const origin = logicalCellOrigin(cellX, cellY);

for (let dy = 0; dy < PASSAGE_WIDTH; dy += 1) { for (let dx = 0; dx < PASSAGE_WIDTH; dx += 1) { grid[origin.y + dy][origin.x + dx] = FLOOR; } } }

function carveLogicalConnection(grid, cellX, cellY, direction) { const origin = logicalCellOrigin(cellX, cellY);

if (direction === "e") { const wallX = origin.x + PASSAGE_WIDTH; for (let dy = 0; dy < PASSAGE_WIDTH; dy += 1) { grid[origin.y + dy][wallX] = FLOOR; } }

if (direction === "s") { const wallY = origin.y + PASSAGE_WIDTH; for (let dx = 0; dx < PASSAGE_WIDTH; dx += 1) { grid[wallY][origin.x + dx] = FLOOR; } } }

function generateMaze(logicalCols, logicalRows, mazeConfig) { const width = logicalCols * (PASSAGE_WIDTH + 1) + 1; const height = logicalRows * (PASSAGE_WIDTH + 1) + 1; const grid = Array.from({ length: height }, () => Array(width).fill(WALL));

const connections = createLogicalConnections(logicalCols, logicalRows, mazeConfig);
carveBraids(connections, logicalCols, logicalRows, mazeConfig.braidDeadEndChance);
carveExtraLoops(connections, logicalCols, logicalRows, mazeConfig.extraLoopChance);

for (let y = 0; y < logicalRows; y += 1) { for (let x = 0; x < logicalCols; x += 1) { carveLogicalCell(grid, x, y);

  if (connections[y][x].e) {
    carveLogicalConnection(grid, x, y, "e");
  }

  if (connections[y][x].s) {
    carveLogicalConnection(grid, x, y, "s");
  }
}

}

return { grid, width, height }; }

function isWalkable(world, x, y) { return ( x >= 0 && y >= 0 && x < world.width && y < world.height && world.grid[y][x] === FLOOR ); }

function collectFloorTiles(world) { const floors = [];

for (let y = 0; y < world.height; y += 1) { for (let x = 0; x < world.width; x += 1) { if (world.grid[y][x] === FLOOR) { floors.push({ x, y }); } } }

return floors; }

function bfsDistances(world, startTile) { const distances = new Int32Array(world.width * world.height); distances.fill(-1);

const queue = new Int32Array(world.width * world.height); let head = 0; let tail = 0;

const startIndex = indexOfTile(world.width, startTile.x, startTile.y); distances[startIndex] = 0; queue[tail] = startIndex; tail += 1;

while (head < tail) { const currentIndex = queue[head]; head += 1;

const x = currentIndex % world.width;
const y = Math.floor(currentIndex / world.width);
const baseDistance = distances[currentIndex];

const neighbors = [
  [x + 1, y],
  [x - 1, y],
  [x, y + 1],
  [x, y - 1],
];

for (const [nx, ny] of neighbors) {
  if (!isWalkable(world, nx, ny)) {
    continue;
  }

  const nextIndex = indexOfTile(world.width, nx, ny);
  if (distances[nextIndex] !== -1) {
    continue;
  }

  distances[nextIndex] = baseDistance + 1;
  queue[tail] = nextIndex;
  tail += 1;
}

}

return distances; }

function farthestTile(world, distances) { let best = { x: 1, y: 1, distance: 0 };

for (let y = 0; y < world.height; y += 1) { for (let x = 0; x < world.width; x += 1) { const distance = distances[indexOfTile(world.width, x, y)]; if (distance > best.distance) { best = { x, y, distance }; } } }

return best; }

function circleHitsWall(world, x, y, radius) { const minX = Math.floor(x - radius); const maxX = Math.floor(x + radius); const minY = Math.floor(y - radius); const maxY = Math.floor(y + radius);

for (let tileY = minY; tileY <= maxY; tileY += 1) { for (let tileX = minX; tileX <= maxX; tileX += 1) { if ( tileX < 0 || tileY < 0 || tileX >= world.width || tileY >= world.height ) { return true; }

  if (world.grid[tileY][tileX] !== WALL) {
    continue;
  }

  const nearestX = clamp(x, tileX, tileX + 1);
  const nearestY = clamp(y, tileY, tileY + 1);
  const dx = x - nearestX;
  const dy = y - nearestY;

  if (dx * dx + dy * dy < radius * radius) {
    return true;
  }
}

}

return false; }

function moveWithCollisions(world, entity, dx, dy) { if (dx !== 0) { const nextX = entity.x + dx; if (!circleHitsWall(world, nextX, entity.y, entity.radius)) { entity.x = nextX; } }

if (dy !== 0) { const nextY = entity.y + dy; if (!circleHitsWall(world, entity.x, nextY, entity.radius)) { entity.y = nextY; } } }

function hasLineOfSight(world, x1, y1, x2, y2) { const dx = x2 - x1; const dy = y2 - y1; const steps = Math.ceil(Math.hypot(dx, dy) * 10);

for (let step = 1; step < steps; step += 1) { const t = step / steps; const x = x1 + dx * t; const y = y1 + dy * t; const tileX = Math.floor(x); const tileY = Math.floor(y);

if (!isWalkable(world, tileX, tileY)) {
  return false;
}

}

return true; }

function hashNoise(x, y) { const n = ((x * 374761393) ^ (y * 668265263)) >>> 0; return (n % 1000) / 1000; }

function getDiscoveredPercent(world) { return Math.round( (world.player.discoveredFloor / Math.max(1, world.floorCount)) * 100, ); }

function findSpawnTile(world, distances, minDistance, maxDistance, used) { const candidates = [];

for (const tile of world.floorTiles) { const key = indexOfTile(world.width, tile.x, tile.y); const distance = distances[key];

if (used.has(key)) {
  continue;
}

if (distance < minDistance || distance > maxDistance) {
  continue;
}

candidates.push(tile);

}

if (!candidates.length) { for (const tile of world.floorTiles) { const key = indexOfTile(world.width, tile.x, tile.y); if (!used.has(key)) { candidates.push(tile); } } }

if (!candidates.length) { return world.floorTiles[0] ?? world.start ?? { x: 1, y: 1 }; }

const chosen = candidates[Math.floor(Math.random() * candidates.length)]; used.add(indexOfTile(world.width, chosen.x, chosen.y)); return chosen; }

function findTileNearPercent(world, distances, percent, spread, used) { const maxDistance = world.exit.distance; const target = Math.floor(maxDistance * percent);

return findSpawnTile( world, distances, Math.max(4, target - spread), target + spread, used, ); }

function findNearbyOpenTiles(world, originTile, radius, used, minDistance = 1) { const candidates = [];

for (let dy = -radius; dy <= radius; dy += 1) { for (let dx = -radius; dx <= radius; dx += 1) { const x = originTile.x + dx; const y = originTile.y + dy; const distance = Math.abs(dx) + Math.abs(dy);

  if (distance < minDistance || distance > radius) {
    continue;
  }

  if (!isWalkable(world, x, y)) {
    continue;
  }

  const key = indexOfTile(world.width, x, y);
  if (used.has(key)) {
    continue;
  }

  candidates.push({ x, y });
}

}

if (!candidates.length) { return null; }

const tile = candidates[Math.floor(Math.random() * candidates.length)]; used.add(indexOfTile(world.width, tile.x, tile.y)); return tile; }

function addPickup(world, tile, pickup) { const position = tileCenter(tile);

world.pickups.push({ id: `pickup-${world.nextId++}`, x: position.x, y: position.y, radius: 0.22, ...pickup, }); }

function spawnProjectile(world, projectile) { world.projectiles.push({ id: `projectile-${world.nextId++}`, radius: 0.09, ttl: 1.25, piercesLeft: 0, hitIds: new Set(), ...projectile, }); }

function placeProgressionItems(world, distances, used) { const supportRequests = [];

for (const entry of WEAPON_SPAWN_PLAN) { const tile = findTileNearPercent( world, distances, entry.percent, entry.spread, used, );

addPickup(world, tile, {
  type: "weapon",
  weapon: entry.weapon,
  label: getWeaponLabel(world, entry.weapon),
});

for (let i = 0; i < entry.supportDrops; i += 1) {
  supportRequests.push({ tile, weapon: entry.weapon });
}

}

for (const request of supportRequests) { const nearby = findNearbyOpenTiles(world, request.tile, 4, used, 2); if (!nearby) { continue; }

const weapon = WEAPONS[request.weapon];
const shouldDropAmmo =
  weapon.type === "ranged" ? chance(0.82) : chance(0.38);

if (shouldDropAmmo) {
  addPickup(world, nearby, {
    type: "ammo",
    amount: randInt(8, 18),
    label: getAmmoPickupLabel(world),
  });
} else {
  addPickup(world, nearby, {
    type: "medkit",
    amount: randInt(12, 24),
    label: "Medkit",
  });
}

}

const extraAmmo = Math.floor(world.floorTiles.length * 0.055); const medkits = Math.floor(world.floorTiles.length * 0.02);

for (let i = 0; i < extraAmmo; i += 1) { const tile = findSpawnTile(world, distances, 8, world.exit.distance, used); addPickup(world, tile, { type: "ammo", amount: randInt(5, 16), label: getAmmoPickupLabel(world), }); }

for (let i = 0; i < medkits; i += 1) { const tile = findSpawnTile(world, distances, 8, world.exit.distance, used); addPickup(world, tile, { type: "medkit", amount: randInt(10, 22), label: "Medkit", }); } }

function placePowerUps(world, distances, used) { const spreadBase = 7;

for (let index = 0; index < POWER_UP_PICKUP_COUNT; index += 1) { const key = POWER_UP_SPAWN_ORDER[index % POWER_UP_SPAWN_ORDER.length]; const progress = index / Math.max(1, POWER_UP_PICKUP_COUNT - 1); const percent = clamp( 0.08 + progress * 0.84 + rand(-0.04, 0.04), 0.08, 0.94, );

const tile = findTileNearPercent(
  world,
  distances,
  percent,
  spreadBase + (index % 5) * 2,
  used,
);

addPickup(world, tile, {
  type: "powerup",
  powerUp: key,
  label: getPowerUpPresentation(world, key).label,
  color: POWER_UPS[key].color,
});

} }

function pickEnemyColor(config) { const palette = config.palette ?? [config.color]; return palette[Math.floor(Math.random() * palette.length)] ?? config.color; }

function chooseEnemyKindForStage(stage, remainingBudget) { const eligible = Object.entries(stage.weights).filter(([kind]) => { return ENEMY_COSTS[kind] <= remainingBudget + 0.45; });

if (!eligible.length) { const fallback = Object.entries(stage.weights).sort( (a, b) => ENEMY_COSTS[a[0]] - ENEMY_COSTS[b[0]], ); return fallback[0]?.[0] ?? "scout"; }

return weightedChoice(eligible); }

function getEncounterCount(world, stage) { const sizeBonus = Math.floor(world.exit.distance / 70); return randInt(stage.encounters[0], stage.encounters[1]) + sizeBonus; }

function getEncounterBudget(stage, encounterIndex, encounterCount) { const progress = encounterCount <= 1 ? 1 : encounterIndex / Math.max(1, encounterCount - 1);

return lerp(stage.budget[0], stage.budget[1], progress) + rand(-0.35, 0.35); }

function addEnemy(world, tile, kind) { const config = ENEMY_TYPES[kind]; const position = tileCenter(tile);
const level = world.level;

const hpScale = rand(0.9, 1.18) * level.enemyHpMultiplier;
const speedScale = rand(0.92, 1.12) * level.enemySpeedMultiplier;
const damageScale = rand(0.9, 1.14) * level.enemyDamageMultiplier;
const cooldownScale = rand(0.9, 1.08);

const maxHp = Math.max(1, Math.round(config.hp * hpScale));

world.enemies.push({ id: `enemy-${world.nextId++}`, kind, label: config.label, x: position.x, y: position.y, radius: config.radius * rand(0.96, 1.08), hp: maxHp, maxHp, speed: config.speed * speedScale, contactDamage: config.contactDamage ? Math.max(1, Math.round(config.contactDamage * damageScale)) : 0, projectileDamage: config.projectileDamage ? Math.max(1, Math.round(config.projectileDamage * damageScale)) : 0, attackCooldown: config.attackCooldown ? config.attackCooldown * cooldownScale : 0, awake: false, nextAttackAt: 0, nextContactAt: 0, lastAttackAt: -Infinity, attackStyle: null, lastHitAt: -Infinity, color: pickEnemyColor(config), orbitDir: chance(0.5) ? 1 : -1, }); }

function spawnEncounterPack(world, distances, used, stage, anchorPercent, budget) { const anchorTile = findTileNearPercent( world, distances, anchorPercent, stage.spread, used, );

let spent = 0; let spawned = 0;

while (spawned < stage.packCap && spent < budget) { const remainingBudget = budget - spent; const kind = chooseEnemyKindForStage(stage, remainingBudget);

const tile =
  spawned === 0
    ? anchorTile
    : findNearbyOpenTiles(
        world,
        anchorTile,
        stage.clusterRadius,
        used,
        1,
      ) ??
      findSpawnTile(
        world,
        distances,
        Math.max(8, Math.floor(world.exit.distance * stage.start)),
        Math.max(10, Math.floor(world.exit.distance * stage.end)),
        used,
      );

addEnemy(world, tile, kind);
spent += ENEMY_COSTS[kind];
spawned += 1;

if (spawned >= stage.packCap) {
  break;
}

if (remainingBudget < 0.95) {
  break;
}

if (chance(0.12) && spawned > 0) {
  break;
}

} }

function placeFinalGuardPack(world, distances, used) { const anchorTile = findTileNearPercent(world, distances, 0.94, 8, used); addEnemy(world, anchorTile, "warden");

const supportKinds = shuffle(["turret", "spitter", "brute", "charger"]).slice( 0, randInt(2, 3), );

for (const kind of supportKinds) { const nearby = findNearbyOpenTiles(world, anchorTile, 5, used, 2) ?? findSpawnTile( world, distances, Math.floor(world.exit.distance * 0.82), world.exit.distance, used, );

addEnemy(world, nearby, kind);

} }

function placeGuaranteedTurrets(world, distances, used) {
const turretCount = GUARANTEED_TURRETS[world.levelKey] ?? 4;

for (let index = 0; index < turretCount; index += 1) {
  const progress = turretCount <= 1 ? 0.5 : index / (turretCount - 1);
  const percent = lerp(0.28, 0.9, progress);
  const tile = findTileNearPercent(world, distances, percent, 7 + index, used);
  addEnemy(world, tile, "turret");
}
}

function placeEnemies(world, distances, used) { for (const stage of ENEMY_DIFFICULTY_STAGES) { const encounterCount = getEncounterCount(world, stage);

for (let i = 0; i < encounterCount; i += 1) {
  const laneProgress =
    encounterCount <= 1 ? 0.5 : i / Math.max(1, encounterCount - 1);

  const anchorPercent = clamp(
    lerp(stage.start, stage.end, laneProgress) + rand(-0.025, 0.025),
    stage.start,
    stage.end,
  );

  const budget = getEncounterBudget(stage, i, encounterCount) * world.level.enemyBudgetMultiplier;
  spawnEncounterPack(world, distances, used, stage, anchorPercent, budget);
}

}

placeGuaranteedTurrets(world, distances, used);
placeFinalGuardPack(world, distances, used); }

function hasPowerUp(world, key) { return (world.player.powerUps[key]?.endsAt ?? -Infinity) > world.time; }

function getActivePowerUps(world) { return Object.entries(world.player.powerUps) .filter(([, state]) => state.endsAt > world.time) .sort((a, b) => a[1].endsAt - b[1].endsAt) .map(([key, state]) => ({ key, label: getPowerUpPresentation(world, key).label, short: getPowerUpPresentation(world, key).short, color: POWER_UPS[key].color, remaining: Math.max(0, state.endsAt - world.time), })); }


function storePowerUp(world, key) {
  const slots = world.player.powerUpSlots;
  const emptySlot = slots.findIndex((slot) => slot === null);

  if (emptySlot === -1) {
    if (world.time >= (world.lastFullPowerUpNoticeAt ?? -Infinity) + 0.9) {
      setMessage(world, "Power-up holder full — use Z or X first", 1.2);
      world.lastFullPowerUpNoticeAt = world.time;
    }
    return false;
  }

  slots[emptySlot] = key;
  queueSfx(world, "pickupPowerUp", { powerUpKey: key });
  setMessage(world, `${getPowerUpPresentation(world, key).label} stored in slot ${emptySlot + 1}`, 1.5);
  return true;
}

function activateStoredPowerUp(world, slotIndex) {
  const key = world.player.powerUpSlots[slotIndex];

  if (!key) {
    setMessage(world, `Power-up slot ${slotIndex + 1} is empty`, 0.8);
    return false;
  }

  world.player.powerUpSlots[slotIndex] = null;
  activatePowerUp(world, key);
  return true;
}

function getStoredPowerUps(world) {
  return world.player.powerUpSlots.map((key, index) => {
    if (!key) {
      return null;
    }

    return {
      key,
      slotIndex: index,
      hotkey: index === 0 ? "Z" : "X",
      label: getPowerUpPresentation(world, key).label,
      short: getPowerUpPresentation(world, key).short,
      color: POWER_UPS[key].color,
    };
  });
}

function getPlayerSpeed(world) {
  return world.player.speed * (hasPowerUp(world, "haste") ? 1.75 : 1);
}

function getPlayerDamageMultiplier(world) {
  return hasPowerUp(world, "berserk") ? 2 : 1;
}

function getWeaponCooldown(world, weapon) {
  let multiplier = hasPowerUp(world, "rapidFire") ? 0.45 : 1;

  if (weapon.type === "melee" && hasPowerUp(world, "longArms")) {
    multiplier *= 0.75;
  }

  return weapon.cooldown * multiplier;
}

function getWeaponAmmoCost(world, weapon) { return hasPowerUp(world, "overcharge") ? 0 : (weapon.ammoCost ?? 0); }

function getProjectileSpeed(world, weapon) {
  let multiplier = 1;
  if (hasPowerUp(world, "overcharge")) multiplier *= 1.25;
  if (hasPowerUp(world, "precision")) multiplier *= 1.25;
  return weapon.bulletSpeed * multiplier;
}

function getWeaponSpread(world, weapon) {
  let spread = weapon.spread ?? 0;
  if (hasPowerUp(world, "precision")) spread *= 0.2;
  if (hasPowerUp(world, "scattershot")) {
    spread = Math.max(spread, 0.07) * 1.25;
  }
  return spread;
}

function getWeaponPellets(world, weapon) {
  if (!weapon.pellets) {
    return 1;
  }

  if (hasPowerUp(world, "scattershot")) {
    return weapon.pellets + (weapon.pellets === 1 ? 3 : 5);
  }

  return weapon.pellets;
}

function getMeleeReach(world, weapon) {
  return weapon.reach + (hasPowerUp(world, "longArms") ? 1.6 : 0);
}

function getMeleeArc(world, weapon) {
  return weapon.arc + (hasPowerUp(world, "longArms") ? 0.75 : 0);
}

function getPlayerPickupBonus(world) {
  return hasPowerUp(world, "magnet") ? 0.5 : 0;
}

function getDamageTakenMultiplier(world) {
  return hasPowerUp(world, "shield") ? 0.5 : 1;
}

function getProjectilePierce(world) {
  return hasPowerUp(world, "pierce") ? 5 : 0;
}

function applyPlayerHitEffects(world, dealtDamage) {
  if (hasPowerUp(world, "vampirism")) {
    const lifesteal = Math.max(1, Math.round(dealtDamage * 0.22));
    world.player.hp = clamp(
      world.player.hp + lifesteal,
      0,
      world.player.maxHp,
    );
  }
}

function smashWallTile(world, tileX, tileY, powerUpKey = null) {
  if (
    tileX <= 0 ||
    tileY <= 0 ||
    tileX >= world.width - 1 ||
    tileY >= world.height - 1
  ) {
    return false;
  }

  if (world.grid[tileY][tileX] !== WALL) {
    return false;
  }

  if (powerUpKey) {
    const state = world.player.powerUps[powerUpKey];

    if (!state || state.endsAt <= world.time || (state.charges ?? 0) <= 0) {
      return false;
    }
  }

  world.grid[tileY][tileX] = FLOOR;
  world.floorTiles.push({ x: tileX, y: tileY });
  world.floorCount += 1;
  world.distanceTimer = 0;
  world.distanceFieldDirty = true;
  world.minimapDirty = true;

  if (powerUpKey) {
    const state = world.player.powerUps[powerUpKey];
    state.charges = Math.max(0, (state.charges ?? 1) - 1);

    if (state.charges === 0) {
      state.endsAt = world.time;
      setMessage(
        world,
        powerUpKey === "breaker"
          ? "Wall Breaker depleted"
          : "Demolition charges depleted",
        0.9,
      );
    }
  }

  return true;
}

function trySmashWalls(world, entity, moveX, moveY) { if (!hasPowerUp(world, "breaker")) { return false; }

const smashed = []; const radius = entity.radius + 0.55;

if (moveX !== 0) { const tileX = Math.floor(entity.x + Math.sign(moveX) * radius); const baseY = Math.floor(entity.y); smashed.push(smashWallTile(world, tileX, baseY, "breaker")); smashed.push(smashWallTile(world, tileX, baseY + 1, "breaker")); smashed.push(smashWallTile(world, tileX, baseY - 1, "breaker")); }

if (moveY !== 0) { const tileY = Math.floor(entity.y + Math.sign(moveY) * radius); const baseX = Math.floor(entity.x); smashed.push(smashWallTile(world, baseX, tileY, "breaker")); smashed.push(smashWallTile(world, baseX + 1, tileY, "breaker")); smashed.push(smashWallTile(world, baseX - 1, tileY, "breaker")); }

if (smashed.some(Boolean)) { setMessage(world, "Wall smashed!", 0.45); return true; }

return false; }

function activatePowerUp(world, key) {
  const player = world.player;
  const powerUp = getPowerUpPresentation(world, key);
  const wasActive = hasPowerUp(world, key);
  const duration = getPowerUpDuration(key);

  if (key === "juggernaut" && !wasActive) {
    player.maxHp = Math.round(player.baseMaxHp * 2.2);
    player.hp = clamp(
      player.hp + Math.round(player.baseMaxHp),
      0,
      player.maxHp,
    );
  }

  if (key === "ammoSurge") {
    player.ammo = clamp(player.ammo + 50, 0, MAX_AMMO);
  }

  if (key === "regen") {
    player.hp = clamp(player.hp + 25, 0, player.maxHp);
  }

  const nextState = { endsAt: world.time + duration };

  if (POWER_UP_WALL_BREAK_CHARGES[key]) {
    nextState.charges = POWER_UP_WALL_BREAK_CHARGES[key];
  }

  player.powerUps[key] = nextState;
  queueSfx(world, "powerUpUse", { powerUpKey: key });

  setMessage(world, `${powerUp.label} for ${duration}s`, 1.4);
}

function expirePowerUp(world, key) {
  const player = world.player;
  delete player.powerUps[key];

  if (key === "juggernaut") {
    player.maxHp = player.baseMaxHp;
    player.hp = clamp(player.hp, 0, player.maxHp);
  }
}

function updatePowerUps(world, dt) {
  const player = world.player;

  if (hasPowerUp(world, "regen")) {
    player.hp = clamp(player.hp + 7 * dt, 0, player.maxHp);
  }

  if (hasPowerUp(world, "ammoSurge")) {
    player.ammo = clamp(player.ammo + 10 * dt, 0, MAX_AMMO);
  }

  for (const [key, state] of Object.entries(player.powerUps)) {
    if (state.endsAt <= world.time) {
      expirePowerUp(world, key);
    }
  }
}

function updateVisionCache(world) {
  world.vision = {
    sightBonus: hasPowerUp(world, "sonar") ? 3 : 0,
    facingX: Math.cos(world.player.facing),
    facingY: Math.sin(world.player.facing),
  };
}

function visibleStrengthAt(world, tileX, tileY) { const player = world.player; const centerX = tileX + 0.5; const centerY = tileY + 0.5; const dx = centerX - player.x; const dy = centerY - player.y; const distance = Math.hypot(dx, dy); const vision = world.vision ?? { sightBonus: hasPowerUp(world, "sonar") ? 3 : 0, facingX: Math.cos(player.facing), facingY: Math.sin(player.facing), }; const dot = distance > 0 ? (dx * vision.facingX + dy * vision.facingY) / distance : 1;

if (distance <= 5 + vision.sightBonus) { return 1; }

if (distance <= 7.25 + vision.sightBonus && dot > 0.82) { return 0.72; }

if (distance <= 6.25 + vision.sightBonus && dot > 0.55) { return 0.34; }

return 0; }

function revealAroundPlayer(world) { let discoveredCount = world.player.discoveredFloor; let minimapChanged = false; const sightBonus = world.vision?.sightBonus ?? 0; const revealRadius = Math.ceil(VISION_MARGIN + sightBonus); const minX = Math.max(0, Math.floor(world.player.x) - revealRadius); const maxX = Math.min(world.width - 1, Math.ceil(world.player.x) + revealRadius); const minY = Math.max(0, Math.floor(world.player.y) - revealRadius); const maxY = Math.min(world.height - 1, Math.ceil(world.player.y) + revealRadius);

for (let y = minY; y <= maxY; y += 1) { for (let x = minX; x <= maxX; x += 1) { const strength = visibleStrengthAt(world, x, y); if (strength <= 0.24) { continue; }

  const idx = indexOfTile(world.width, x, y);
  if (world.discovered[idx] === 1) {
    continue;
  }

  world.discovered[idx] = 1;
  minimapChanged = true;
  if (world.grid[y][x] === FLOOR) {
    discoveredCount += 1;
  }
}

}

world.player.discoveredFloor = discoveredCount; if (minimapChanged) { world.minimapDirty = true; } }

function setMessage(world, text, ttl = 2.5) { world.message = text; world.messageTtl = ttl; }

function toggleLabels(world) { world.labelsOn = !world.labelsOn; setMessage(world, world.labelsOn ? "Labels on" : "Labels off", 1); }

function getCamera(world) { const halfW = CANVAS_WIDTH / DRAW_TILE / 2; const halfH = CANVAS_HEIGHT / DRAW_TILE / 2; const maxX = Math.max(0, world.width - CANVAS_WIDTH / DRAW_TILE); const maxY = Math.max(0, world.height - CANVAS_HEIGHT / DRAW_TILE);

return { x: clamp(world.player.x - halfW, 0, maxX), y: clamp(world.player.y - halfH, 0, maxY), }; }

function screenToWorld(world, screenX, screenY) { const camera = getCamera(world); return { x: camera.x + screenX / DRAW_TILE, y: camera.y + screenY / DRAW_TILE, }; }

function getAimVector(world) {
  const player = world.player;

  if (world.viewMode === "3d") {
    return { x: Math.cos(player.facing), y: Math.sin(player.facing) };
  }

  const pointerWorld = screenToWorld(world, world.pointer.x, world.pointer.y);
  const dx = pointerWorld.x - player.x;
  const dy = pointerWorld.y - player.y;

  if (Math.hypot(dx, dy) > 0.01) {
    const direction = normalize(dx, dy);
    player.facing = Math.atan2(direction.y, direction.x);
    return direction;
  }

  return { x: Math.cos(player.facing), y: Math.sin(player.facing) };
}

function selectWeapon(world, weaponKey) {
  if (!world.player.ownedWeapons[weaponKey] || world.player.weapon === weaponKey) {
    return false;
  }

  world.player.weapon = weaponKey;
  queueSfx(world, "weaponSelect", { weaponKey });
  setMessage(world, `${getWeaponLabel(world, weaponKey)} equipped`, 1.3);
  return true;
}

function meleeAttack(world, weapon, direction) {
  const player = world.player;
  const meleeBoost = hasPowerUp(world, "longArms") ? 1.35 : 1;
  const damage = Math.round(
    weapon.damage * getPlayerDamageMultiplier(world) * meleeBoost,
  );
  const reach = getMeleeReach(world, weapon);
  const arc = getMeleeArc(world, weapon);
  let hitCount = 0;

player.meleeSwing = {
  startedAt: world.time,
  duration: clamp(weapon.cooldown * 0.72, 0.15, 0.26),
  weaponKey: player.weapon,
  directionAngle: Math.atan2(direction.y, direction.x),
};
queueSfx(world, "weaponAttack", { weaponKey: player.weapon });

for (const enemy of world.enemies) { const dx = enemy.x - player.x; const dy = enemy.y - player.y; const distance = Math.hypot(dx, dy); const overlapping = distance <= enemy.radius + player.radius + 0.08;

if (distance > reach + enemy.radius) {
  continue;
}

if (!overlapping) {
  const angleToEnemy = Math.atan2(dy, dx);
  const swingCenter = Math.atan2(direction.y, direction.x);

  if (Math.abs(angleDelta(angleToEnemy, swingCenter)) > arc / 2) {
    continue;
  }

  if (!hasLineOfSight(world, player.x, player.y, enemy.x, enemy.y)) {
    continue;
  }
}

enemy.hp -= damage;
enemy.awake = true;
enemy.lastHitAt = world.time;
queueSfx(world, "enemyHit", { enemyKind: enemy.kind });
applyPlayerHitEffects(world, damage);

const impactDirection = Math.atan2(enemy.y - player.y, enemy.x - player.x);
if (enemy.kind === "turret") {
  spawnSparks(world, enemy.x, enemy.y, impactDirection, 1.1);
  spawnImpact(world, enemy.x, enemy.y, "#5eead4", 1.05);
} else {
  spawnBlood(world, enemy.x, enemy.y, impactDirection, 1.05);
  spawnImpact(
    world,
    enemy.x,
    enemy.y,
    world.level.themeKey === "space" ? "#cbd5e1" : "#fca5a5",
    world.level.themeKey === "space" ? 1.05 : 0.9,
  );
}

hitCount += 1;

}

if (hitCount > 0) { setMessage(world, hitCount === 1 ? "Hit!" : `${hitCount} hits!`, 0.7); } }

function rangedAttack(world, weapon, direction) {
  const player = world.player;
  const ammoCost = getWeaponAmmoCost(world, weapon);
  const pelletCount = getWeaponPellets(world, weapon);
  const projectileSpeed = getProjectileSpeed(world, weapon);
  const precisionBoost = hasPowerUp(world, "precision") ? 1.18 : 1;
  const overchargeBoost = hasPowerUp(world, "overcharge") ? 1.1 : 1;
  const pierceBoost = hasPowerUp(world, "pierce") ? 1.12 : 1;
  const basePellets = Math.max(1, weapon.pellets ?? 1);
  const scatterTotalBoost = hasPowerUp(world, "scattershot") ? 1.7 : 1;
  const scatterPerProjectileScale = hasPowerUp(world, "scattershot")
    ? (basePellets * scatterTotalBoost) / pelletCount
    : 1;
  const damage = Math.max(
    1,
    Math.round(
      weapon.damage *
        getPlayerDamageMultiplier(world) *
        precisionBoost *
        overchargeBoost *
        pierceBoost *
        scatterPerProjectileScale,
    ),
  );

if (player.ammo < ammoCost) {
  queueSfx(world, "outOfAmmo");
  setMessage(world, `Out of ${getAmmoMessageLabel(world)}`, 0.8);
  return;
}

player.ammo -= ammoCost;
queueSfx(world, "weaponAttack", { weaponKey: player.weapon });

const medievalArchery = isMedievalTheme(world);
if (!medievalArchery) {
  const muzzleAngle = Math.atan2(direction.y, direction.x);
  const muzzleX = player.x + direction.x * 0.5;
  const muzzleY = player.y + direction.y * 0.5;
  spawnMuzzleFlash(
    world,
    muzzleX,
    muzzleY,
    muzzleAngle,
    hasPowerUp(world, "overcharge") ? "#facc15" : "#fde047",
    weapon === WEAPONS.shotgun ? 0.9 : weapon === WEAPONS.revolver ? 0.75 : 0.62,
  );
}

for (let i = 0; i < pelletCount; i += 1) { const baseAngle = Math.atan2(direction.y, direction.x); const spreadRange = getWeaponSpread(world, weapon); const spread = spreadRange ? rand(-spreadRange, spreadRange) : 0; const angle = baseAngle + spread;

spawnProjectile(world, {
  x: player.x + Math.cos(angle) * 0.42,
  y: player.y + Math.sin(angle) * 0.42,
  vx: Math.cos(angle) * projectileSpeed,
  vy: Math.sin(angle) * projectileSpeed,
  damage,
  owner: "player",
  ttl: weapon.range / projectileSpeed,
  piercesLeft: getProjectilePierce(world),
  breaksWalls: hasPowerUp(world, "demolition"),
  isArrow: medievalArchery,
  weaponKey: player.weapon,
  color: medievalArchery
    ? hasPowerUp(world, "overcharge")
      ? "#facc15"
      : "#d6a85f"
    : hasPowerUp(world, "overcharge")
      ? "#facc15"
      : "#fde047",
});

} }

function attack(world) { const player = world.player;

if (world.gameOver || world.victory || world.time < player.nextAttackAt) { return; }

const weapon = WEAPONS[player.weapon]; const direction = getAimVector(world); player.nextAttackAt = world.time + getWeaponCooldown(world, weapon);

if (weapon.type === "melee") { meleeAttack(world, weapon, direction); } else { rangedAttack(world, weapon, direction); } }

function updatePlayer3D(world, keys, dt) {
  const player = world.player;
  const forwardInput =
    Number(Boolean(keys.w || keys.ArrowUp)) -
    Number(Boolean(keys.s || keys.ArrowDown));
  const strafeInput = Number(Boolean(keys.d)) - Number(Boolean(keys.a));
  const turnInput =
    Number(Boolean(keys.ArrowRight)) - Number(Boolean(keys.ArrowLeft));

  if (turnInput !== 0) {
    player.facing += turnInput * VIEW_3D_TURN_SPEED * dt;
  }

  if (forwardInput !== 0 || strafeInput !== 0) {
    const forwardX = Math.cos(player.facing);
    const forwardY = Math.sin(player.facing);
    const rightX = -forwardY;
    const rightY = forwardX;
    const movement = normalize(
      forwardX * forwardInput + rightX * strafeInput,
      forwardY * forwardInput + rightY * strafeInput,
    );
    const speed = getPlayerSpeed(world);

    trySmashWalls(world, player, movement.x, movement.y);
    moveWithCollisions(
      world,
      player,
      movement.x * speed * dt,
      movement.y * speed * dt,
    );
  }

  if (keys[" "] || keys.Enter || world.pointer.down) {
    attack(world);
  }

  const playerTileX = Math.floor(player.x);
  const playerTileY = Math.floor(player.y);

  if (
    playerTileX !== world.lastPlayerTile.x ||
    playerTileY !== world.lastPlayerTile.y
  ) {
    world.lastPlayerTile = { x: playerTileX, y: playerTileY };
    world.distanceTimer = 0;
    world.distanceFieldDirty = true;
  }
}

function updatePlayer(world, keys, dt) {
  if (world.viewMode === "3d") {
    updatePlayer3D(world, keys, dt);
    return;
  }

  const player = world.player;
  let moveX = 0;
  let moveY = 0;

if (keys.ArrowUp || keys.w) moveY -= 1; if (keys.ArrowDown || keys.s) moveY += 1; if (keys.ArrowLeft || keys.a) moveX -= 1; if (keys.ArrowRight || keys.d) moveX += 1;

if (moveX !== 0 || moveY !== 0) { const direction = normalize(moveX, moveY); const speed = getPlayerSpeed(world); trySmashWalls(world, player, direction.x, direction.y); moveWithCollisions( world, player, direction.x * speed * dt, direction.y * speed * dt, );

if (!world.pointer.inside) {
  player.facing = Math.atan2(direction.y, direction.x);
}

}

if (world.pointer.inside) { getAimVector(world); }

if (keys[" "] || keys.Enter || world.pointer.down) { attack(world); }

const playerTileX = Math.floor(player.x); const playerTileY = Math.floor(player.y);

if ( playerTileX !== world.lastPlayerTile.x || playerTileY !== world.lastPlayerTile.y ) { world.lastPlayerTile = { x: playerTileX, y: playerTileY }; world.distanceTimer = 0; world.distanceFieldDirty = true; } }

function updatePickups(world, dt) {
  const player = world.player;
  const remaining = [];
  const pickupBonus = getPlayerPickupBonus(world);
  const magnetActive = hasPowerUp(world, "magnet");
  const magnetRadius = 7;
  const magnetPullSpeed = 11;

for (const pickup of world.pickups) {
  let dx = player.x - pickup.x;
  let dy = player.y - pickup.y;
  let distance = Math.hypot(dx, dy);
  const collectRadius = pickup.radius + player.radius + 0.1 + pickupBonus;

  if (
    magnetActive &&
    distance > collectRadius &&
    distance <= magnetRadius
  ) {
    const direction = normalize(dx, dy);
    const pullDistance = Math.min(
      distance - collectRadius,
      magnetPullSpeed * dt,
    );
    pickup.x += direction.x * pullDistance;
    pickup.y += direction.y * pullDistance;
    dx = player.x - pickup.x;
    dy = player.y - pickup.y;
    distance = Math.hypot(dx, dy);
  }

if (distance > collectRadius) {
  remaining.push(pickup);
  continue;
}

if (pickup.type === "weapon") {
  if (!player.ownedWeapons[pickup.weapon]) {
    player.ownedWeapons[pickup.weapon] = true;
    const hotkeyIndex = WEAPON_ORDER.indexOf(pickup.weapon);
    const hotkeyLabel = hotkeyIndex >= 0 && hotkeyIndex < 9 ? String(hotkeyIndex + 1) : "";
    queueSfx(world, "pickupWeapon", { weaponKey: pickup.weapon });
    setMessage(
      world,
      `${getWeaponLabel(world, pickup.weapon)} unlocked${hotkeyLabel ? ` — press ${hotkeyLabel} or click it` : ""}`,
      2,
    );
  }
  continue;
}

if (pickup.type === "ammo") {
  const before = player.ammo;
  player.ammo = clamp(player.ammo + pickup.amount, 0, MAX_AMMO);
  const gained = Math.max(0, Math.floor(player.ammo) - Math.floor(before));

  if (gained > 0) {
    queueSfx(world, "pickupAmmo");
    setMessage(world, `+${gained} ${getAmmoMessageLabel(world)}`, 1.2);
  } else {
    setMessage(world, `${getAmmoLabel(world)} full`, 1.2);
  }
  continue;
}

if (pickup.type === "medkit") {
  const before = player.hp;
  player.hp = clamp(player.hp + pickup.amount, 0, player.maxHp);
  const restored = Math.max(0, Math.round(player.hp - before));

  if (restored > 0) {
    queueSfx(world, "pickupHealth");
    setMessage(world, `+${restored} health`, 1.2);
  }
  continue;
}

if (pickup.type === "powerup") {
  if (storePowerUp(world, pickup.powerUp)) {
    continue;
  }

  remaining.push(pickup);
  continue;
}

remaining.push(pickup);

}

world.pickups = remaining; }

function computeDistanceField(world) { const playerTile = { x: clamp(Math.floor(world.player.x), 0, world.width - 1), y: clamp(Math.floor(world.player.y), 0, world.height - 1), };

world.distanceField = bfsDistances(world, playerTile); world.distanceFieldDirty = false; }

function enemyTargetTile(world, enemy) { const enemyTileX = clamp(Math.floor(enemy.x), 0, world.width - 1); const enemyTileY = clamp(Math.floor(enemy.y), 0, world.height - 1); const hereIndex = indexOfTile(world.width, enemyTileX, enemyTileY); const hereDistance = world.distanceField[hereIndex];

const options = [ { x: enemyTileX + 1, y: enemyTileY }, { x: enemyTileX - 1, y: enemyTileY }, { x: enemyTileX, y: enemyTileY + 1 }, { x: enemyTileX, y: enemyTileY - 1 }, ].filter((tile) => isWalkable(world, tile.x, tile.y));

let bestTile = null; let bestDistance = hereDistance;

for (const tile of options) { const nextDistance = world.distanceField[indexOfTile(world.width, tile.x, tile.y)];

if (nextDistance === -1) {
  continue;
}

if (hereDistance === -1 || nextDistance < bestDistance) {
  bestDistance = nextDistance;
  bestTile = tile;
}

}

return bestTile; }

function moveEnemyTowardTile(world, enemy, tile, speed, dt) { if (!tile) { return false; }

const startX = enemy.x; const startY = enemy.y; const center = tileCenter(tile); const move = normalize(center.x - enemy.x, center.y - enemy.y);

moveWithCollisions(world, enemy, move.x * speed * dt, move.y * speed * dt);

return Math.hypot(enemy.x - startX, enemy.y - startY) > 0.0001; }

function moveEnemyTowardPoint(world, enemy, targetX, targetY, speed, dt) { const startX = enemy.x; const startY = enemy.y; const step = speed * dt; const direction = normalize(targetX - enemy.x, targetY - enemy.y);

moveWithCollisions(world, enemy, direction.x * step, direction.y * step);

if (Math.hypot(enemy.x - startX, enemy.y - startY) > 0.0001) { return true; }

const deltaX = targetX - startX; const deltaY = targetY - startY;

const primaryMoves = Math.abs(deltaX) >= Math.abs(deltaY) ? [ { dx: Math.sign(deltaX) * step, dy: 0 }, { dx: 0, dy: Math.sign(deltaY) * step }, ] : [ { dx: 0, dy: Math.sign(deltaY) * step }, { dx: Math.sign(deltaX) * step, dy: 0 }, ];

const detours = Math.abs(deltaX) >= Math.abs(deltaY) ? [ { dx: 0, dy: step }, { dx: 0, dy: -step }, ] : [ { dx: step, dy: 0 }, { dx: -step, dy: 0 }, ];

for (const option of [...primaryMoves, ...detours]) { moveWithCollisions(world, enemy, option.dx, option.dy); if (Math.hypot(enemy.x - startX, enemy.y - startY) > 0.0001) { return true; } }

return false; }

function moveEnemyTowardPlayer(world, enemy, speed, dt) { const nextTile = enemyTargetTile(world, enemy);

if (nextTile && moveEnemyTowardTile(world, enemy, nextTile, speed, dt)) { return; }

moveEnemyTowardPoint(world, enemy, world.player.x, world.player.y, speed, dt); }

function moveEnemyAwayFromPlayer(world, enemy, speed, dt) { const dx = enemy.x - world.player.x; const dy = enemy.y - world.player.y;

return moveEnemyTowardPoint( world, enemy, enemy.x + dx, enemy.y + dy, speed, dt, ); }

function strafeEnemyAroundPlayer(world, enemy, speed, dt) { const dx = enemy.x - world.player.x; const dy = enemy.y - world.player.y; const length = Math.hypot(dx, dy) || 1;

return moveEnemyTowardPoint( world, enemy, enemy.x + (-dy / length) * enemy.orbitDir, enemy.y + (dx / length) * enemy.orbitDir, speed, dt, ); }

function fireEnemyProjectiles(world, enemy, config, aimX, aimY) { const projectileCount = config.projectileCount ?? 1; const spread = config.projectileSpread ?? 0; const baseAngle = Math.atan2(aimY, aimX);

spawnMuzzleFlash(
  world,
  enemy.x + Math.cos(baseAngle) * (enemy.radius + 0.14),
  enemy.y + Math.sin(baseAngle) * (enemy.radius + 0.14),
  baseAngle,
  config.projectileColor ?? enemy.color ?? "#34d399",
  enemy.kind === "turret" ? 0.72 : 0.55,
);

for (let i = 0; i < projectileCount; i += 1) { let offset = 0;

if (projectileCount === 1) {
  offset = spread ? rand(-spread, spread) : 0;
} else {
  offset = lerp(-spread, spread, i / Math.max(1, projectileCount - 1));
}

const angle = baseAngle + offset;
const speed = config.projectileSpeed;
const damage = enemy.projectileDamage || config.projectileDamage;

spawnProjectile(world, {
  x: enemy.x + Math.cos(angle) * (enemy.radius + 0.12),
  y: enemy.y + Math.sin(angle) * (enemy.radius + 0.12),
  vx: Math.cos(angle) * speed,
  vy: Math.sin(angle) * speed,
  damage,
  owner: "enemy",
  sourceX: enemy.x,
  sourceY: enemy.y,
  ttl: Math.max(1.05, (config.attackRange ?? 8) / speed),
  color: config.projectileColor ?? enemy.color ?? config.color,
});

} }

function damagePlayer(world, amount, sourceX = null, sourceY = null) {
  if (world.gameOver || world.victory) {
    return;
  }

  if (hasPowerUp(world, "phaseWalk")) {
    return;
  }

const actualDamage = Math.max( 1, Math.round(amount * getDamageTakenMultiplier(world)), );

world.player.hp = clamp(world.player.hp - actualDamage, 0, world.player.maxHp);
world.damageFlash = Math.min(0.92, (world.damageFlash ?? 0) + 0.46);
world.damageKick = Math.min(1, (world.damageKick ?? 0) + 0.58);
world.lastDamageAt = world.time;
queueSfx(world, "playerHit");

if (Number.isFinite(sourceX) && Number.isFinite(sourceY)) {
  const sourceAngle = Math.atan2(
    sourceY - world.player.y,
    sourceX - world.player.x,
  );
  world.damageDirection = angleDelta(sourceAngle, world.player.facing);
}
spawnBlood(world, world.player.x, world.player.y, null, 0.75);
spawnImpact(world, world.player.x, world.player.y, "#fb7185", 0.8);

if (world.player.hp <= 0) {
  spawnExplosion(world, world.player.x, world.player.y, {
    size: 1.15,
    colors: ["#ef4444", "#fb7185", "#f97316"],
  });
  world.gameOver = true;
  queueSfx(world, "gameOver");
  setMessage(world, `${getPlayerDisplayName(world)} was overwhelmed.`, 99);
} }

function updateEnemies(world, dt) { const player = world.player; const alive = [];

for (const enemy of world.enemies) { if (enemy.hp <= 0) { world.kills += 1; queueSfx(world, "enemyDeath", { enemyKind: enemy.kind });

  if (world.level.themeKey === "space") {
    const debrisIntensity =
      enemy.kind === "warden"
        ? 2.15
        : enemy.kind === "brute"
          ? 1.75
          : enemy.kind === "turret"
            ? 1.55
            : 1.35;

    spawnShipDebris(world, enemy.x, enemy.y, null, debrisIntensity);
    spawnImpact(world, enemy.x, enemy.y, "#cbd5e1", 1.15);

    if (enemy.kind === "turret" || enemy.kind === "brute" || enemy.kind === "warden") {
      spawnSparks(world, enemy.x, enemy.y, null, debrisIntensity * 0.9);
    }
  } else if (enemy.kind === "turret" || enemy.kind === "brute" || enemy.kind === "warden") {
    spawnExplosion(world, enemy.x, enemy.y, {
      size: enemy.kind === "warden" ? 1.3 : enemy.kind === "brute" ? 1.05 : 0.9,
      colors:
        enemy.kind === "turret"
          ? ["#14b8a6", "#5eead4", "#facc15"]
          : ["#ef4444", "#f97316", "#facc15"],
    });
  } else {
    spawnBlood(world, enemy.x, enemy.y, null, 1.35);
    spawnImpact(world, enemy.x, enemy.y, "#fecaca", 1.1);
  }

  if (hasPowerUp(world, "bounty")) {
    world.player.ammo = clamp(world.player.ammo + 10, 0, MAX_AMMO);
    world.player.hp = clamp(
      world.player.hp + 7,
      0,
      world.player.maxHp,
    );
  }

  continue;
}

const config = ENEMY_TYPES[enemy.kind];
const dxToPlayer = player.x - enemy.x;
const dyToPlayer = player.y - enemy.y;
const distanceToPlayer = Math.hypot(dxToPlayer, dyToPlayer);
const fieldDistance =
  world.distanceField[
    indexOfTile(world.width, Math.floor(enemy.x), Math.floor(enemy.y))
  ];

if (
  !enemy.awake &&
  (distanceToPlayer <= config.alertRadius ||
    (fieldDistance !== -1 && fieldDistance <= config.alertRadius))
) {
  enemy.awake = true;
}

if (enemy.awake) {
  const frostMultiplier = hasPowerUp(world, "frost") ? 0.5 : 1;
  const chargeMultiplier =
    enemy.kind === "charger" &&
    distanceToPlayer <= (config.chargeRange ?? 0)
      ? config.chargeSpeedMultiplier ?? 1
      : 1;

  const moveSpeed = enemy.speed * frostMultiplier * chargeMultiplier;
  const isRanged =
    Number.isFinite(config.attackRange) &&
    Number.isFinite(config.projectileSpeed) &&
    Number.isFinite(enemy.projectileDamage || config.projectileDamage);

  if (isRanged) {
    const canSeePlayer = hasLineOfSight(
      world,
      enemy.x,
      enemy.y,
      player.x,
      player.y,
    );
    const preferredRange = config.preferredRange ?? config.attackRange * 0.65;

    if (enemy.speed > 0) {
      if (!canSeePlayer || distanceToPlayer > preferredRange + 0.6) {
        moveEnemyTowardPlayer(world, enemy, moveSpeed, dt);
      } else if (distanceToPlayer < preferredRange * 0.58) {
        moveEnemyAwayFromPlayer(world, enemy, moveSpeed * 0.9, dt);
      } else {
        if (chance(0.015)) {
          enemy.orbitDir *= -1;
        }
        strafeEnemyAroundPlayer(world, enemy, moveSpeed * 0.72, dt);
      }
    }

    if (
      distanceToPlayer <= config.attackRange &&
      canSeePlayer &&
      world.time >= enemy.nextAttackAt
    ) {
      const aim = normalize(dxToPlayer, dyToPlayer);
      enemy.nextAttackAt =
        world.time + (enemy.attackCooldown || config.attackCooldown);
      enemy.lastAttackAt = world.time;
      enemy.attackStyle = "ranged";
      queueSfx(world, "enemyAttack", { enemyKind: enemy.kind, style: "ranged" });

      fireEnemyProjectiles(world, enemy, config, aim.x, aim.y);
    }
  } else {
    moveEnemyTowardPlayer(world, enemy, moveSpeed, dt);
  }
}

const touching =
  Math.hypot(enemy.x - player.x, enemy.y - player.y) <=
  enemy.radius + player.radius + 0.06;

const contactDamage = enemy.contactDamage || config.contactDamage || 0;

if (
  contactDamage > 0 &&
  touching &&
  world.time >= enemy.nextContactAt &&
  !hasPowerUp(world, "phaseWalk")
) {
  enemy.nextContactAt = world.time + config.contactCooldown;
  enemy.lastAttackAt = world.time;
  enemy.attackStyle = "contact";
  queueSfx(world, "enemyAttack", { enemyKind: enemy.kind, style: "contact" });
  damagePlayer(world, contactDamage, enemy.x, enemy.y);
}

alive.push(enemy);

}

world.enemies = alive; }

function updateProjectiles(world, dt) { const nextProjectiles = [];

for (const projectile of world.projectiles) { projectile.ttl -= dt;

if (projectile.ttl <= 0) {
  continue;
}

const distance = Math.hypot(projectile.vx * dt, projectile.vy * dt);
const steps = Math.max(1, Math.ceil(distance / 0.08));
let destroyed = false;

for (let step = 0; step < steps; step += 1) {
  projectile.x += (projectile.vx * dt) / steps;
  projectile.y += (projectile.vy * dt) / steps;

  if (circleHitsWall(world, projectile.x, projectile.y, projectile.radius)) {
    const impactAngle = Math.atan2(-projectile.vy, -projectile.vx);
    spawnSparks(world, projectile.x, projectile.y, impactAngle, 0.85);
    spawnImpact(world, projectile.x, projectile.y, projectile.color, 0.65);

    if (projectile.owner === "player" && projectile.breaksWalls) {
      const wallBroken = smashWallTile(
        world,
        Math.floor(projectile.x),
        Math.floor(projectile.y),
        "demolition",
      );

      if (wallBroken) {
        spawnExplosion(world, projectile.x, projectile.y, {
          size: 0.72,
          colors: ["#f97316", "#facc15", "#94a3b8"],
        });
      }
    }

    destroyed = true;
    break;
  }

  if (projectile.owner === "player") {
    for (const enemy of world.enemies) {
      const hit =
        Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) <=
        projectile.radius + enemy.radius;

      if (!hit || projectile.hitIds.has(enemy.id)) {
        continue;
      }

      projectile.hitIds.add(enemy.id);
      enemy.hp -= projectile.damage;
      enemy.awake = true;
      enemy.lastHitAt = world.time;
      queueSfx(world, "enemyHit", { enemyKind: enemy.kind });
      applyPlayerHitEffects(world, projectile.damage);

      const hitDirection = Math.atan2(projectile.vy, projectile.vx);
      if (enemy.kind === "turret") {
        spawnSparks(world, projectile.x, projectile.y, hitDirection, 1.2);
        spawnImpact(world, projectile.x, projectile.y, "#5eead4", 1);
      } else {
        spawnBlood(world, projectile.x, projectile.y, hitDirection, 1);
        spawnImpact(world, projectile.x, projectile.y, "#fecaca", 0.9);
      }

      if (projectile.piercesLeft > 0) {
        projectile.piercesLeft -= 1;
        continue;
      }

      destroyed = true;
      break;
    }
  } else {
    const hitPlayer =
      Math.hypot(projectile.x - world.player.x, projectile.y - world.player.y) <=
      projectile.radius + world.player.radius;

    if (hitPlayer) {
      damagePlayer(
        world,
        projectile.damage,
        projectile.sourceX ?? projectile.x - projectile.vx,
        projectile.sourceY ?? projectile.y - projectile.vy,
      );
      destroyed = true;
    }
  }

  if (destroyed) {
    break;
  }
}

if (!destroyed) {
  nextProjectiles.push(projectile);
}

}

world.projectiles = nextProjectiles; }


function addEffect(world, effect) {
  if (!world.effects) {
    world.effects = [];
  }

  world.effects.push({
    age: 0,
    ttl: 0.35,
    size: 0.12,
    vx: 0,
    vy: 0,
    drag: 0.9,
    gravity: 0,
    alpha: 1,
    ...effect,
  });

  if (world.effects.length > MAX_EFFECTS) {
    world.effects.splice(0, world.effects.length - MAX_EFFECTS);
  }
}

function spawnParticleBurst(
  world,
  x,
  y,
  {
    count = 8,
    color = "#ffffff",
    colors = null,
    speed = 2.8,
    size = 0.12,
    ttl = 0.42,
    direction = null,
    spread = Math.PI * 2,
    gravity = 0,
    kind = "particle",
  } = {},
) {
  for (let index = 0; index < count; index += 1) {
    const baseAngle =
      direction === null ? rand(0, Math.PI * 2) : direction + rand(-spread / 2, spread / 2);
    const particleSpeed = speed * rand(0.45, 1.15);
    const palette = colors ?? [color];

    addEffect(world, {
      kind,
      x,
      y,
      vx: Math.cos(baseAngle) * particleSpeed,
      vy: Math.sin(baseAngle) * particleSpeed,
      size: size * rand(0.65, 1.3),
      ttl: ttl * rand(0.72, 1.2),
      color: palette[Math.floor(Math.random() * palette.length)] ?? color,
      gravity,
      drag: 0.9,
    });
  }
}

function spawnMuzzleFlash(world, x, y, angle, color = "#fde047", size = 0.62) {
  addEffect(world, {
    kind: "muzzle",
    x: x + Math.cos(angle) * 0.12,
    y: y + Math.sin(angle) * 0.12,
    angle,
    color,
    size,
    ttl: 0.13,
    drag: 1,
  });

  spawnParticleBurst(world, x, y, {
    count: 5,
    colors: [color, "#fff7ed", "#fb923c"],
    speed: 3.7,
    size: 0.07,
    ttl: 0.2,
    direction: angle,
    spread: 0.65,
    kind: "spark",
  });
}

function spawnShipDebris(world, x, y, direction = null, intensity = 1) {
  spawnParticleBurst(world, x, y, {
    count: Math.round(14 * intensity),
    colors: [
      "#dbeafe",
      "#cbd5e1",
      "#94a3b8",
      "#64748b",
      "#334155",
      "#38bdf8",
    ],
    speed: 3.7 * intensity,
    size: 0.14 * intensity,
    ttl: 0.82,
    direction,
    spread: direction === null ? Math.PI * 2 : 1.55,
    gravity: 1.05,
    kind: "shipDebris",
  });

  spawnParticleBurst(world, x, y, {
    count: Math.round(5 * intensity),
    colors: ["#67e8f9", "#bae6fd", "#f8fafc"],
    speed: 4.8 * intensity,
    size: 0.06 * intensity,
    ttl: 0.26,
    direction,
    spread: direction === null ? Math.PI * 2 : 1.15,
    kind: "spark",
  });
}

function spawnBlood(world, x, y, direction = null, intensity = 1) {
  if (world?.level?.themeKey === "space") {
    spawnShipDebris(world, x, y, direction, intensity);
    return;
  }

  spawnParticleBurst(world, x, y, {
    count: Math.round(10 * intensity),
    colors: ["#ef4444", "#b91c1c", "#7f1d1d"],
    speed: 2.8 * intensity,
    size: 0.11 * intensity,
    ttl: 0.55,
    direction,
    spread: direction === null ? Math.PI * 2 : 1.5,
    gravity: 1.5,
    kind: "blood",
  });
}

function spawnSparks(world, x, y, direction = null, intensity = 1) {
  spawnParticleBurst(world, x, y, {
    count: Math.round(9 * intensity),
    colors: ["#fef08a", "#facc15", "#fb923c", "#e0f2fe"],
    speed: 4.4 * intensity,
    size: 0.075 * intensity,
    ttl: 0.34,
    direction,
    spread: direction === null ? Math.PI * 2 : 1.2,
    kind: "spark",
  });
}

function spawnImpact(world, x, y, color = "#ffffff", intensity = 1) {
  addEffect(world, {
    kind: "ring",
    x,
    y,
    color,
    size: 0.16 * intensity,
    endSize: 0.55 * intensity,
    ttl: 0.22,
    drag: 1,
  });
}

function spawnExplosion(
  world,
  x,
  y,
  { size = 1, colors = ["#f97316", "#facc15", "#ef4444"] } = {},
) {
  addEffect(world, {
    kind: "explosion",
    x,
    y,
    color: colors[0],
    colors,
    size: 0.34 * size,
    endSize: 1.15 * size,
    ttl: 0.38,
    drag: 1,
  });

  spawnParticleBurst(world, x, y, {
    count: Math.round(18 * size),
    colors,
    speed: 5 * size,
    size: 0.1,
    ttl: 0.55,
    kind: "spark",
  });
}

function updateEffects(world, dt) {
  if (!world.effects) {
    return;
  }

  const remaining = [];

  for (const effect of world.effects) {
    effect.age += dt;
    effect.ttl -= dt;

    if (effect.ttl <= 0) {
      continue;
    }

    const drag = Math.pow(effect.drag ?? 1, dt * 60);
    effect.vx *= drag;
    effect.vy *= drag;
    effect.vy += (effect.gravity ?? 0) * dt;
    effect.x += effect.vx * dt;
    effect.y += effect.vy * dt;
    remaining.push(effect);
  }

  world.effects = remaining;
  world.damageFlash = Math.max(0, (world.damageFlash ?? 0) - dt * 2.8);
  world.damageKick = Math.max(0, (world.damageKick ?? 0) - dt * 3.7);
}

function drawEffects(ctx, world, camera) {
  for (const effect of world.effects ?? []) {
    const x = (effect.x - camera.x) * DRAW_TILE;
    const y = (effect.y - camera.y) * DRAW_TILE;

    if (
      x < -80 ||
      y < -80 ||
      x > CANVAS_WIDTH + 80 ||
      y > CANVAS_HEIGHT + 80
    ) {
      continue;
    }

    const initialTtl =
      effect.kind === "muzzle"
        ? 0.13
        : effect.kind === "ring"
          ? 0.22
          : effect.kind === "explosion"
            ? 0.38
            : 0.55;
    const progress = clamp(effect.age / Math.max(0.001, effect.age + effect.ttl), 0, 1);
    const alpha = clamp(effect.ttl / initialTtl, 0, 1) * (effect.alpha ?? 1);

    ctx.save();

    if (effect.kind === "blood") {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, effect.size * DRAW_TILE), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    if (effect.kind === "shipDebris") {
      const radius = Math.max(2.5, effect.size * DRAW_TILE * 0.9);
      const travelAngle = Math.atan2(effect.vy ?? 0, effect.vx ?? 0);
      const spin = (effect.age ?? 0) * 7.5;

      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(travelAngle + spin);
      ctx.fillStyle = effect.color;
      ctx.fillRect(-radius * 0.65, -radius * 0.3, radius * 1.3, radius * 0.6);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-radius * 0.65, -radius * 0.3, radius * 1.3, radius * 0.6);
      ctx.restore();
      continue;
    }

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 14;
    ctx.shadowColor = effect.color;

    if (effect.kind === "muzzle") {
      const radius = effect.size * DRAW_TILE * (0.7 + progress * 0.5);
      ctx.translate(x, y);
      ctx.rotate(effect.angle ?? 0);
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.2, -radius * 0.18);
      ctx.lineTo(radius * 1.35, 0);
      ctx.lineTo(-radius * 0.2, radius * 0.18);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.kind === "ring") {
      const radius = lerp(effect.size, effect.endSize ?? effect.size * 3, progress) * DRAW_TILE;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(2, 4 * (1 - progress));
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "explosion") {
      const radius = lerp(effect.size, effect.endSize ?? effect.size * 3, progress) * DRAW_TILE;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.25, effect.colors?.[1] ?? "#facc15");
      gradient.addColorStop(0.65, effect.colors?.[0] ?? "#f97316");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(1.5, effect.size * DRAW_TILE * 0.55);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x - effect.vx * DRAW_TILE * 0.045,
        y - effect.vy * DRAW_TILE * 0.045,
      );
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawMazeTile(ctx, world, tileX, tileY, screenX, screenY) {
  const theme = getTheme(world);
  const themeKey = world.level.themeKey;
  const noise = hashNoise(tileX * 7 + 3, tileY * 11 + 5);

  if (world.grid[tileY][tileX] === WALL) {
    const gradient = ctx.createLinearGradient(
      screenX,
      screenY,
      screenX + DRAW_TILE,
      screenY + DRAW_TILE,
    );
    gradient.addColorStop(0, theme.wallA);
    gradient.addColorStop(0.5, theme.wallB);
    gradient.addColorStop(1, theme.wallC);

    ctx.fillStyle = gradient;
    ctx.fillRect(screenX, screenY, DRAW_TILE, DRAW_TILE);

    ctx.strokeStyle = theme.wallEdge;
    ctx.lineWidth = 1.1;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, DRAW_TILE - 1, DRAW_TILE - 1);

    if (themeKey === "space") {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
      ctx.beginPath();
      ctx.moveTo(screenX + DRAW_TILE * 0.5, screenY + 2);
      ctx.lineTo(screenX + DRAW_TILE * 0.5, screenY + DRAW_TILE - 2);
      ctx.stroke();

      if (noise > 0.68) {
        ctx.fillStyle = noise > 0.86 ? "#f472b6" : "#22d3ee";
        ctx.fillRect(screenX + 4, screenY + 4, 3, 2);
      }
    } else if (themeKey === "jungle") {
      ctx.fillStyle = `rgba(74, 222, 128, ${0.1 + noise * 0.18})`;
      ctx.fillRect(screenX, screenY, DRAW_TILE, 4 + Math.floor(noise * 5));

      ctx.strokeStyle = "rgba(34, 197, 94, 0.38)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(screenX + DRAW_TILE * (0.2 + noise * 0.5), screenY);
      ctx.bezierCurveTo(
        screenX + DRAW_TILE * 0.8,
        screenY + DRAW_TILE * 0.3,
        screenX + DRAW_TILE * 0.15,
        screenY + DRAW_TILE * 0.65,
        screenX + DRAW_TILE * (0.35 + noise * 0.4),
        screenY + DRAW_TILE,
      );
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(28, 25, 23, 0.62)";
      ctx.lineWidth = 1;
      const mortarY = screenY + DRAW_TILE * 0.5;
      ctx.beginPath();
      ctx.moveTo(screenX, mortarY);
      ctx.lineTo(screenX + DRAW_TILE, mortarY);
      ctx.moveTo(screenX + DRAW_TILE * 0.5, screenY);
      ctx.lineTo(screenX + DRAW_TILE * 0.5, mortarY);
      ctx.moveTo(screenX + DRAW_TILE * 0.25, mortarY);
      ctx.lineTo(screenX + DRAW_TILE * 0.25, screenY + DRAW_TILE);
      ctx.stroke();

      if (noise > 0.78) {
        ctx.fillStyle = "rgba(245, 158, 11, 0.16)";
        ctx.fillRect(screenX + DRAW_TILE - 4, screenY + 4, 2, DRAW_TILE - 8);
      }
    }

    return;
  }

  const checker = (tileX + tileY) % 2 === 0;
  ctx.fillStyle = checker ? theme.floorA : theme.floorB;
  ctx.fillRect(screenX, screenY, DRAW_TILE, DRAW_TILE);

  if (themeKey === "space") {
    ctx.strokeStyle = theme.floorLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, DRAW_TILE - 1, DRAW_TILE - 1);

    ctx.fillStyle = `rgba(125, 211, 252, ${0.05 + noise * 0.08})`;
    ctx.fillRect(
      screenX + 5 + Math.floor(noise * 8),
      screenY + 6 + Math.floor(noise * 6),
      2,
      2,
    );
  } else if (themeKey === "jungle") {
    ctx.strokeStyle = theme.floorLine;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, DRAW_TILE - 1, DRAW_TILE - 1);

    const grassX = screenX + 3 + Math.floor(noise * 15);
    const grassY = screenY + DRAW_TILE - 3;
    ctx.strokeStyle = noise > 0.5 ? "#65a30d" : "#22c55e";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(grassX, grassY);
    ctx.lineTo(grassX - 2, grassY - 5 - noise * 4);
    ctx.moveTo(grassX, grassY);
    ctx.lineTo(grassX + 2, grassY - 4 - noise * 3);
    ctx.stroke();

    if (noise > 0.72) {
      ctx.fillStyle = "rgba(190, 242, 100, 0.22)";
      ctx.beginPath();
      ctx.arc(screenX + DRAW_TILE * 0.7, screenY + DRAW_TILE * 0.34, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = theme.floorLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY + DRAW_TILE * 0.5);
    ctx.lineTo(screenX + DRAW_TILE, screenY + DRAW_TILE * 0.5);
    ctx.moveTo(screenX + DRAW_TILE * 0.5, screenY);
    ctx.lineTo(screenX + DRAW_TILE * 0.5, screenY + DRAW_TILE * 0.5);
    ctx.moveTo(screenX + DRAW_TILE * 0.25, screenY + DRAW_TILE * 0.5);
    ctx.lineTo(screenX + DRAW_TILE * 0.25, screenY + DRAW_TILE);
    ctx.stroke();

    if (noise > 0.76) {
      ctx.fillStyle = "rgba(214, 211, 209, 0.08)";
      ctx.fillRect(screenX + 4, screenY + 5, 7, 2);
    }
  }
}

function drawExitPortal(ctx, world, camera) {
  const tileIndex = indexOfTile(world.width, world.exit.x, world.exit.y);
  const known =
    world.discovered[tileIndex] === 1 ||
    visibleStrengthAt(world, world.exit.x, world.exit.y) > 0.12;

  if (!known) {
    return;
  }

  const center = tileCenter(world.exit);
  const x = (center.x - camera.x) * DRAW_TILE;
  const y = (center.y - camera.y) * DRAW_TILE;
  const pulse = 0.5 + 0.5 * Math.sin(world.time * 4.2);
  const radius = DRAW_TILE * (0.42 + pulse * 0.08);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 22;
  ctx.shadowColor = "#22c55e";

  const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
  gradient.addColorStop(0, "#dcfce7");
  gradient.addColorStop(0.28, "#4ade80");
  gradient.addColorStop(0.72, "rgba(34, 197, 94, 0.55)");
  gradient.addColorStop(1, "rgba(34, 197, 94, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#86efac";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, DRAW_TILE * (0.28 + pulse * 0.05), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawEnemyEyes(ctx, radius, color = "#ffffff", separation = 0.3) {
  ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      radius * 0.42,
      side * radius * separation,
      Math.max(1.2, radius * 0.12),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawSpaceEnemy(ctx, enemy, radius, aimAngle) {
  const cyan = "#67e8f9";
  const purple = "#c084fc";
  const dark = "#111827";
  const metal = "#64748b";

  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = Math.max(1.2, radius * 0.12);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (enemy.kind === "turret") {
    ctx.save();
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#172554";
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.strokeStyle = cyan;
    ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.fillStyle = "#1e3a8a";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = cyan;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(aimAngle);
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = Math.max(3, radius * 0.34);
    ctx.beginPath();
    ctx.moveTo(radius * 0.25, 0);
    ctx.lineTo(radius * 1.72, 0);
    ctx.stroke();
    ctx.strokeStyle = cyan;
    ctx.lineWidth = Math.max(1, radius * 0.12);
    ctx.beginPath();
    ctx.moveTo(radius * 0.7, 0);
    ctx.lineTo(radius * 1.75, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (enemy.kind === "skitter") {
    ctx.strokeStyle = cyan;
    ctx.lineWidth = Math.max(1.5, radius * 0.14);
    for (const side of [-1, 1]) {
      for (const xDirection of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(xDirection * radius * 0.3, side * radius * 0.25);
        ctx.lineTo(xDirection * radius * 1.08, side * radius * 0.82);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#312e81";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.8, radius * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = purple;
    ctx.stroke();
    ctx.save();
    ctx.rotate(aimAngle);
    drawEnemyEyes(ctx, radius * 0.72, cyan, 0.28);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.rotate(aimAngle);

  if (enemy.kind === "charger") {
    ctx.fillStyle = "#7c3aed";
    ctx.beginPath();
    ctx.moveTo(radius * 1.3, 0);
    ctx.lineTo(-radius * 0.72, -radius * 0.72);
    ctx.lineTo(-radius * 0.42, 0);
    ctx.lineTo(-radius * 0.72, radius * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = cyan;
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(radius * 0.22, 0, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "spitter") {
    ctx.fillStyle = "#14532d";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.74, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#86efac";
    ctx.stroke();

    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(radius * 0.46, 0, radius * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dcfce7";
    ctx.beginPath();
    ctx.arc(radius * 0.55, 0, radius * 0.11, 0, Math.PI * 2);
    ctx.fill();

    for (const side of [-1, 1]) {
      ctx.strokeStyle = "#4ade80";
      ctx.beginPath();
      ctx.moveTo(-radius * 0.45, side * radius * 0.4);
      ctx.lineTo(-radius * 0.9, side * radius * 0.7);
      ctx.stroke();
    }
  } else if (enemy.kind === "brute") {
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.rect(
      -radius * 0.92,
      -radius * 0.78,
      radius * 1.84,
      radius * 1.56,
    );
    ctx.fill();
    ctx.strokeStyle = "#a78bfa";
    ctx.stroke();

    ctx.fillStyle = metal;
    ctx.fillRect(-radius * 0.25, -radius, radius * 0.5, radius * 2);
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath();
    ctx.arc(radius * 0.5, 0, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "warden") {
    ctx.fillStyle = dark;
    ctx.beginPath();
    for (let index = 0; index < 8; index += 1) {
      const angle = index * (Math.PI / 4);
      const pointRadius = index % 2 === 0 ? radius * 1.08 : radius * 0.78;
      const px = Math.cos(angle) * pointRadius;
      const py = Math.sin(angle) * pointRadius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = purple;
    ctx.lineWidth = Math.max(1.5, radius * 0.13);
    ctx.stroke();

    ctx.fillStyle = "#581c87";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0abfc";
    ctx.beginPath();
    ctx.arc(radius * 0.2, 0, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = enemy.kind === "crawler" ? "#4338ca" : "#1d4ed8";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.92, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = cyan;
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(-radius * 0.35, 0, radius * 0.38, 0, Math.PI * 2);
    ctx.fill();
    drawEnemyEyes(ctx, radius, "#f8fafc", 0.28);
  }

  ctx.restore();
}

function drawJungleEnemy(ctx, enemy, radius, aimAngle) {
  const leaf = "#4d7c0f";
  const brightLeaf = "#a3e635";
  const bark = "#713f12";
  const poison = "#86efac";
  const outline = "#ecfccb";

  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1.2, radius * 0.11);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (enemy.kind === "turret") {
    ctx.fillStyle = bark;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fde68a";
    ctx.stroke();

    for (let index = 0; index < 6; index += 1) {
      const angle = index * (Math.PI / 3);
      ctx.fillStyle = index % 2 ? "#65a30d" : leaf;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(angle) * radius * 0.85,
        Math.sin(angle) * radius * 0.85,
        radius * 0.42,
        radius * 0.18,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.save();
    ctx.rotate(aimAngle);
    ctx.fillStyle = "#a16207";
    ctx.fillRect(radius * 0.1, -radius * 0.17, radius * 1.55, radius * 0.34);
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.moveTo(radius * 1.72, 0);
    ctx.lineTo(radius * 1.44, -radius * 0.22);
    ctx.lineTo(radius * 1.44, radius * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  if (enemy.kind === "skitter") {
    ctx.strokeStyle = "#365314";
    ctx.lineWidth = Math.max(1.6, radius * 0.14);
    for (const side of [-1, 1]) {
      for (const xDirection of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(xDirection * radius * 0.2, side * radius * 0.25);
        ctx.lineTo(xDirection * radius * 1.02, side * radius * 0.82);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.78, radius * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#facc15";
    ctx.stroke();

    ctx.strokeStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.52);
    ctx.lineTo(0, radius * 0.52);
    ctx.stroke();
    return;
  }

  ctx.save();
  ctx.rotate(aimAngle);

  if (enemy.kind === "charger") {
    ctx.fillStyle = "#713f12";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fde68a";
    ctx.stroke();

    ctx.fillStyle = "#422006";
    ctx.beginPath();
    ctx.arc(radius * 0.66, 0, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#fafaf9";
    ctx.lineWidth = Math.max(1.5, radius * 0.13);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(radius * 0.82, side * radius * 0.28);
      ctx.lineTo(radius * 1.28, side * radius * 0.45);
      ctx.stroke();
    }
  } else if (enemy.kind === "spitter") {
    ctx.fillStyle = "#166534";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = brightLeaf;
    ctx.stroke();

    for (let index = 0; index < 5; index += 1) {
      const angle = index * ((Math.PI * 2) / 5);
      ctx.fillStyle = index % 2 ? "#4d7c0f" : "#65a30d";
      ctx.beginPath();
      ctx.ellipse(
        -Math.cos(angle) * radius * 0.72,
        -Math.sin(angle) * radius * 0.72,
        radius * 0.38,
        radius * 0.16,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.fillStyle = poison;
    ctx.beginPath();
    ctx.arc(radius * 0.4, 0, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#052e16";
    ctx.beginPath();
    ctx.arc(radius * 0.5, 0, radius * 0.13, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "brute") {
    ctx.fillStyle = "#3f6212";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.94, radius * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#bef264";
    ctx.stroke();

    ctx.fillStyle = "#713f12";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(-radius * 0.2, side * radius * 0.72, radius * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#d9f99d";
    ctx.beginPath();
    ctx.arc(radius * 0.44, 0, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "warden") {
    ctx.fillStyle = "#14532d";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = Math.max(1.5, radius * 0.13);
    ctx.stroke();

    for (let index = 0; index < 8; index += 1) {
      const angle = index * (Math.PI / 4);
      ctx.fillStyle = index % 2 ? "#65a30d" : "#84cc16";
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(angle) * radius * 0.92,
        Math.sin(angle) * radius * 0.92,
        radius * 0.42,
        radius * 0.16,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(radius * 0.25, 0, radius * 0.17, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "crawler") {
    ctx.fillStyle = "#365314";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.02, radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a3e635";
    ctx.stroke();

    ctx.fillStyle = "#1a2e05";
    for (const offset of [-0.45, 0, 0.45]) {
      ctx.beginPath();
      ctx.arc(offset * radius, 0, radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    drawEnemyEyes(ctx, radius * 0.9, "#fef08a", 0.28);
  } else {
    ctx.fillStyle = "#4d7c0f";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.88, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d9f99d";
    ctx.stroke();

    ctx.fillStyle = "#713f12";
    ctx.beginPath();
    ctx.arc(-radius * 0.2, 0, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    drawEnemyEyes(ctx, radius, "#fef9c3", 0.28);
  }

  ctx.restore();
}

function drawMedievalEnemy(ctx, enemy, radius, aimAngle) {
  const iron = "#78716c";
  const darkIron = "#292524";
  const leather = "#78350f";
  const bone = "#f5f5f4";
  const red = "#b91c1c";

  ctx.strokeStyle = "#e7e5e4";
  ctx.lineWidth = Math.max(1.2, radius * 0.11);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (enemy.kind === "turret") {
    ctx.fillStyle = "#44403c";
    ctx.fillRect(-radius * 0.92, -radius * 0.92, radius * 1.84, radius * 1.84);
    ctx.strokeStyle = "#d6d3d1";
    ctx.strokeRect(-radius * 0.92, -radius * 0.92, radius * 1.84, radius * 1.84);

    ctx.save();
    ctx.rotate(aimAngle);
    ctx.strokeStyle = leather;
    ctx.lineWidth = Math.max(3, radius * 0.24);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.8, -radius * 0.7);
    ctx.quadraticCurveTo(radius * 0.2, 0, -radius * 0.8, radius * 0.7);
    ctx.stroke();

    ctx.strokeStyle = bone;
    ctx.lineWidth = Math.max(1.3, radius * 0.1);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.6, 0);
    ctx.lineTo(radius * 1.65, 0);
    ctx.stroke();

    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.moveTo(radius * 1.72, 0);
    ctx.lineTo(radius * 1.42, -radius * 0.19);
    ctx.lineTo(radius * 1.42, radius * 0.19);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  if (enemy.kind === "skitter") {
    ctx.strokeStyle = "#57534e";
    ctx.lineWidth = Math.max(1.5, radius * 0.14);
    for (const side of [-1, 1]) {
      for (const xDirection of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(xDirection * radius * 0.2, side * radius * 0.2);
        ctx.lineTo(xDirection * radius * 1.05, side * radius * 0.82);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.72, radius * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = red;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(radius * 0.3, side * radius * 0.18, radius * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  ctx.save();
  ctx.rotate(aimAngle);

  if (enemy.kind === "charger") {
    ctx.fillStyle = darkIron;
    ctx.beginPath();
    ctx.moveTo(radius * 1.18, 0);
    ctx.lineTo(radius * 0.35, -radius * 0.72);
    ctx.lineTo(-radius * 0.78, -radius * 0.65);
    ctx.lineTo(-radius * 0.88, radius * 0.65);
    ctx.lineTo(radius * 0.35, radius * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#d6d3d1";
    ctx.stroke();

    ctx.fillStyle = red;
    ctx.fillRect(-radius * 0.55, -radius * 0.12, radius * 0.95, radius * 0.24);
    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.moveTo(radius * 1.35, 0);
    ctx.lineTo(radius * 0.92, -radius * 0.2);
    ctx.lineTo(radius * 0.92, radius * 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === "spitter") {
    ctx.fillStyle = "#3f3f46";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a3a3a3";
    ctx.stroke();

    ctx.fillStyle = "#365314";
    ctx.beginPath();
    ctx.arc(radius * 0.42, 0, radius * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#bef264";
    ctx.beginPath();
    ctx.arc(radius * 0.5, 0, radius * 0.13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#7f1d1d";
    ctx.beginPath();
    ctx.moveTo(-radius * 0.65, -radius * 0.65);
    ctx.lineTo(0, -radius * 1.18);
    ctx.lineTo(radius * 0.65, -radius * 0.65);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === "brute") {
    ctx.fillStyle = "#57534e";
    ctx.beginPath();
    ctx.rect(
      -radius * 0.9,
      -radius * 0.82,
      radius * 1.8,
      radius * 1.64,
    );
    ctx.fill();
    ctx.strokeStyle = "#d6d3d1";
    ctx.stroke();

    ctx.fillStyle = leather;
    ctx.fillRect(-radius * 0.16, -radius * 0.82, radius * 0.32, radius * 1.64);

    ctx.fillStyle = bone;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(radius * 0.35, side * radius * 0.45);
      ctx.lineTo(radius * 0.95, side * radius * 0.72);
      ctx.lineTo(radius * 0.72, side * radius * 0.22);
      ctx.closePath();
      ctx.fill();
    }
  } else if (enemy.kind === "warden") {
    ctx.fillStyle = "#292524";
    ctx.beginPath();
    for (let index = 0; index < 6; index += 1) {
      const angle = -Math.PI / 2 + index * (Math.PI / 3);
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = Math.max(1.5, radius * 0.13);
    ctx.stroke();

    ctx.fillStyle = "#7f1d1d";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(-radius * 0.42, -radius * 0.68);
    ctx.lineTo(-radius * 0.12, -radius * 1.06);
    ctx.lineTo(radius * 0.08, -radius * 0.68);
    ctx.lineTo(radius * 0.36, -radius * 1.02);
    ctx.lineTo(radius * 0.52, -radius * 0.56);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === "crawler") {
    ctx.fillStyle = "#44403c";
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a8a29e";
    ctx.stroke();

    ctx.strokeStyle = "#78716c";
    ctx.lineWidth = Math.max(1.2, radius * 0.11);
    for (const offset of [-0.42, 0, 0.42]) {
      ctx.beginPath();
      ctx.moveTo(offset * radius, -radius * 0.62);
      ctx.lineTo(offset * radius, radius * 0.62);
      ctx.stroke();
    }
    drawEnemyEyes(ctx, radius, red, 0.27);
  } else {
    ctx.fillStyle = "#3f6212";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.86, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d6d3d1";
    ctx.stroke();

    ctx.fillStyle = leather;
    ctx.beginPath();
    ctx.arc(-radius * 0.28, 0, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.3, -radius * 0.58);
    ctx.lineTo(-radius * 0.52, -radius * 0.98);
    ctx.lineTo(-radius * 0.06, -radius * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-radius * 0.3, radius * 0.58);
    ctx.lineTo(-radius * 0.52, radius * 0.98);
    ctx.lineTo(-radius * 0.06, radius * 0.66);
    ctx.closePath();
    ctx.fill();
    drawEnemyEyes(ctx, radius, "#fef08a", 0.28);
  }

  ctx.restore();
}

function drawEnemyBody(ctx, world, enemy, x, y) {
  const config = ENEMY_TYPES[enemy.kind];
  const radius = enemy.radius * DRAW_TILE;
  const aimAngle = Math.atan2(
    world.player.y - enemy.y,
    world.player.x - enemy.x,
  );
  const themeKey = world.level.themeKey;

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowBlur = enemy.awake ? 13 : 6;
  ctx.shadowColor =
    themeKey === "space"
      ? "#a78bfa"
      : themeKey === "jungle"
        ? "#84cc16"
        : "#ef4444";

  if (themeKey === "space") {
    drawSpaceEnemy(ctx, enemy, radius, aimAngle);
  } else if (themeKey === "jungle") {
    drawJungleEnemy(ctx, enemy, radius, aimAngle);
  } else {
    drawMedievalEnemy(ctx, enemy, radius, aimAngle);
  }

  ctx.restore();
}
function drawEnemyHealth(ctx, enemy, x, y) {
  const width = 30;
  const height = 5;
  const top = y - enemy.radius * DRAW_TILE - 11;
  const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);

  ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
  ctx.fillRect(x - width / 2 - 1, top - 1, width + 2, height + 2);

  ctx.fillStyle =
    ratio > 0.55 ? "#4ade80" : ratio > 0.25 ? "#facc15" : "#ef4444";
  ctx.fillRect(x - width / 2, top, width * ratio, height);
}

function drawProjectile(ctx, projectile, camera) {
  const x = (projectile.x - camera.x) * DRAW_TILE;
  const y = (projectile.y - camera.y) * DRAW_TILE;
  const velocity = normalize(projectile.vx, projectile.vy);
  const trailLength = projectile.owner === "player" ? 12 : 9;

  ctx.save();

  if (projectile.isArrow) {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    const arrowLength = 18;

    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowBlur = 6;
    ctx.shadowColor = projectile.color ?? "#d6a85f";
    ctx.strokeStyle = projectile.color ?? "#d6a85f";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(-arrowLength * 0.7, 0);
    ctx.lineTo(arrowLength * 0.45, 0);
    ctx.stroke();

    ctx.fillStyle = "#d1d5db";
    ctx.beginPath();
    ctx.moveTo(arrowLength * 0.62, 0);
    ctx.lineTo(arrowLength * 0.38, -3.2);
    ctx.lineTo(arrowLength * 0.38, 3.2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-arrowLength * 0.62, 0);
    ctx.lineTo(-arrowLength * 0.78, -4);
    ctx.moveTo(-arrowLength * 0.62, 0);
    ctx.lineTo(-arrowLength * 0.78, 4);
    ctx.stroke();

    ctx.restore();
    return;
  }

  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 14;
  ctx.shadowColor = projectile.color;

  ctx.strokeStyle = projectile.color;
  ctx.lineWidth = projectile.owner === "player" ? 3 : 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - velocity.x * trailLength, y - velocity.y * trailLength);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, projectile.owner === "player" ? 2.8 : 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMedievalBowShape(ctx, weaponKey, size, wood, metal, glow) {
  const profiles = {
    pistol: { limb: 0.58, depth: 0.34, arrow: 0.82, layers: 1 },
    revolver: { limb: 0.72, depth: 0.4, arrow: 0.9, layers: 1 },
    smg: { limb: 0.52, depth: 0.3, arrow: 0.78, layers: 2 },
    shotgun: { limb: 0.68, depth: 0.46, arrow: 0.86, layers: 3 },
    rifle: { limb: 0.82, depth: 0.38, arrow: 1.0, layers: 1 },
    dmr: { limb: 0.94, depth: 0.42, arrow: 1.08, layers: 1 },
  };
  const profile = profiles[weaponKey] ?? profiles.rifle;

  ctx.save();
  ctx.strokeStyle = wood;
  ctx.lineWidth = Math.max(2, size * 0.075);
  ctx.beginPath();
  ctx.moveTo(-size * 0.02, -size * profile.limb);
  ctx.quadraticCurveTo(
    size * profile.depth,
    -size * 0.26,
    size * 0.08,
    0,
  );
  ctx.quadraticCurveTo(
    size * profile.depth,
    size * 0.26,
    -size * 0.02,
    size * profile.limb,
  );
  ctx.stroke();

  ctx.strokeStyle = "#e7e5e4";
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(-size * 0.02, -size * profile.limb);
  ctx.lineTo(-size * 0.22, 0);
  ctx.lineTo(-size * 0.02, size * profile.limb);
  ctx.stroke();

  ctx.strokeStyle = metal;
  ctx.lineWidth = Math.max(1.5, size * 0.04);
  ctx.beginPath();
  ctx.moveTo(-size * 0.34, 0);
  ctx.lineTo(size * profile.arrow, 0);
  ctx.stroke();

  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(size * (profile.arrow + 0.12), 0);
  ctx.lineTo(size * profile.arrow, -size * 0.08);
  ctx.lineTo(size * profile.arrow, size * 0.08);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#fef3c7";
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(-size * 0.28, 0);
  ctx.lineTo(-size * 0.4, -size * 0.1);
  ctx.moveTo(-size * 0.28, 0);
  ctx.lineTo(-size * 0.4, size * 0.1);
  ctx.stroke();

  if (profile.layers > 1) {
    ctx.strokeStyle = glow;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = Math.max(1, size * 0.025);
    for (let layer = 1; layer < profile.layers; layer += 1) {
      const offset = (layer - (profile.layers - 1) / 2) * size * 0.1;
      ctx.beginPath();
      ctx.moveTo(-size * 0.2, offset);
      ctx.lineTo(size * profile.arrow * 0.92, offset);
      ctx.stroke();
    }
  }

  if (weaponKey === "dmr") {
    ctx.strokeStyle = glow;
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.beginPath();
    ctx.arc(size * 0.18, -size * 0.12, size * 0.09, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawWeaponShape(ctx, world, weaponKey, size) {
  const themeKey = world.level.themeKey;
  const metal =
    themeKey === "space"
      ? "#cbd5e1"
      : themeKey === "jungle"
        ? "#94a3b8"
        : "#a8a29e";
  const darkMetal =
    themeKey === "space"
      ? "#475569"
      : themeKey === "jungle"
        ? "#334155"
        : "#44403c";
  const wood =
    themeKey === "jungle"
      ? "#854d0e"
      : themeKey === "medieval"
        ? "#78350f"
        : "#64748b";
  const glow =
    themeKey === "space"
      ? "#22d3ee"
      : themeKey === "jungle"
        ? "#84cc16"
        : "#f59e0b";

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = themeKey === "space" ? size * 0.22 : 0;
  ctx.shadowColor = glow;

  if (weaponKey === "fists") {
    ctx.fillStyle = metal;
    ctx.strokeStyle = darkMetal;
    ctx.lineWidth = Math.max(1, size * 0.07);

    for (const y of [-size * 0.18, size * 0.18]) {
      ctx.beginPath();
      ctx.arc(size * 0.12, y, size * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      for (let index = 0; index < 3; index += 1) {
        ctx.beginPath();
        ctx.arc(
          size * (0.23 + index * 0.09),
          y - size * 0.04,
          size * 0.055,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  } else if (weaponKey === "crowbar") {
    ctx.strokeStyle = wood;
    ctx.lineWidth = size * 0.2;
    ctx.beginPath();
    ctx.moveTo(-size * 0.18, 0);
    ctx.lineTo(size * 0.58, 0);
    ctx.stroke();

    ctx.fillStyle = themeKey === "space" ? metal : "#92400e";
    ctx.beginPath();
    ctx.ellipse(size * 0.68, 0, size * 0.24, size * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = darkMetal;
    ctx.lineWidth = Math.max(1, size * 0.055);
    ctx.stroke();
  } else if (weaponKey === "machete") {
    ctx.fillStyle = wood;
    ctx.fillRect(-size * 0.28, -size * 0.08, size * 0.34, size * 0.16);

    ctx.fillStyle = metal;
    ctx.strokeStyle = darkMetal;
    ctx.lineWidth = Math.max(1, size * 0.055);
    ctx.beginPath();
    ctx.moveTo(size * 0.02, -size * 0.11);
    ctx.lineTo(size * 0.78, -size * 0.18);
    ctx.lineTo(size * 0.9, 0);
    ctx.lineTo(size * 0.72, size * 0.12);
    ctx.lineTo(size * 0.02, size * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (themeKey === "space") {
      ctx.strokeStyle = glow;
      ctx.lineWidth = Math.max(1, size * 0.045);
      ctx.beginPath();
      ctx.moveTo(size * 0.12, -size * 0.08);
      ctx.lineTo(size * 0.75, -size * 0.13);
      ctx.stroke();
    }
  } else if (
    themeKey === "medieval" &&
    WEAPONS[weaponKey]?.type === "ranged"
  ) {
    drawMedievalBowShape(ctx, weaponKey, size, wood, metal, glow);
  } else if (weaponKey === "pistol") {
    ctx.fillStyle = metal;
    ctx.fillRect(-size * 0.08, -size * 0.13, size * 0.66, size * 0.24);
    ctx.fillStyle = darkMetal;
    ctx.beginPath();
    ctx.moveTo(size * 0.1, size * 0.09);
    ctx.lineTo(size * 0.34, size * 0.09);
    ctx.lineTo(size * 0.22, size * 0.52);
    ctx.lineTo(size * 0.02, size * 0.46);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = glow;
    ctx.fillRect(size * 0.58, -size * 0.07, size * 0.13, size * 0.12);
  } else if (weaponKey === "revolver") {
    ctx.fillStyle = metal;
    ctx.fillRect(size * 0.08, -size * 0.1, size * 0.62, size * 0.18);

    ctx.fillStyle = darkMetal;
    ctx.beginPath();
    ctx.arc(size * 0.12, 0, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.stroke();

    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(-size * 0.02, size * 0.12);
    ctx.lineTo(size * 0.18, size * 0.12);
    ctx.lineTo(size * 0.04, size * 0.52);
    ctx.lineTo(-size * 0.15, size * 0.44);
    ctx.closePath();
    ctx.fill();
  } else if (weaponKey === "smg") {
    ctx.fillStyle = darkMetal;
    ctx.fillRect(-size * 0.18, -size * 0.2, size * 0.65, size * 0.38);
    ctx.fillStyle = metal;
    ctx.fillRect(size * 0.4, -size * 0.1, size * 0.46, size * 0.16);
    ctx.fillStyle = darkMetal;
    ctx.beginPath();
    ctx.moveTo(size * 0.04, size * 0.15);
    ctx.lineTo(size * 0.25, size * 0.15);
    ctx.lineTo(size * 0.16, size * 0.5);
    ctx.lineTo(-size * 0.03, size * 0.46);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(1, size * 0.09);
    ctx.beginPath();
    ctx.moveTo(-size * 0.17, 0);
    ctx.lineTo(-size * 0.48, size * 0.18);
    ctx.stroke();
  } else if (weaponKey === "shotgun") {
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(-size * 0.42, -size * 0.17);
    ctx.lineTo(size * 0.05, -size * 0.12);
    ctx.lineTo(size * 0.08, size * 0.12);
    ctx.lineTo(-size * 0.46, size * 0.24);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(2, size * 0.13);
    for (const y of [-size * 0.07, size * 0.07]) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.02, y);
      ctx.lineTo(size * 0.92, y);
      ctx.stroke();
    }

    ctx.fillStyle = darkMetal;
    ctx.fillRect(size * 0.16, -size * 0.17, size * 0.2, size * 0.34);
  } else if (weaponKey === "rifle" || weaponKey === "dmr") {
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(-size * 0.48, -size * 0.16);
    ctx.lineTo(size * 0.05, -size * 0.1);
    ctx.lineTo(size * 0.08, size * 0.12);
    ctx.lineTo(-size * 0.5, size * 0.24);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = darkMetal;
    ctx.fillRect(-size * 0.02, -size * 0.16, size * 0.48, size * 0.3);

    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(2, size * 0.11);
    ctx.beginPath();
    ctx.moveTo(size * 0.35, -size * 0.02);
    ctx.lineTo(size * 0.98, -size * 0.02);
    ctx.stroke();

    ctx.fillStyle = darkMetal;
    ctx.beginPath();
    ctx.moveTo(size * 0.08, size * 0.11);
    ctx.lineTo(size * 0.28, size * 0.11);
    ctx.lineTo(size * 0.18, size * 0.48);
    ctx.lineTo(size * 0.02, size * 0.42);
    ctx.closePath();
    ctx.fill();

    if (weaponKey === "dmr") {
      ctx.fillStyle = metal;
      ctx.fillRect(size * 0.02, -size * 0.32, size * 0.38, size * 0.1);
      ctx.beginPath();
      ctx.arc(size * 0.36, -size * 0.27, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawPlayerBody(ctx, world, x, y) {
  const player = world.player;
  const collisionRadius = player.radius * DRAW_TILE;
  const radius = collisionRadius * 1.55;
  const activePowerUps = getActivePowerUps(world);
  const theme = getTheme(world);
  const themeKey = world.level.themeKey;
  const pulse = 0.5 + Math.sin(world.time * 5) * 0.5;
  const beaconRadius = radius + 5 + pulse * 2;

  ctx.save();
  ctx.translate(x, y);

  ctx.shadowBlur = 22;
  ctx.shadowColor = activePowerUps[0]?.color ?? theme.playerGlow;

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = theme.playerGlow;
  ctx.beginPath();
  ctx.arc(0, 0, beaconRadius + 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, beaconRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = activePowerUps[0]?.color ?? theme.playerGlow;
  ctx.lineWidth = 4.5;
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.arc(0, 0, beaconRadius - 2.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.rotate(player.facing);

  if (activePowerUps.length > 0) {
    ctx.strokeStyle = activePowerUps[0].color;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  const outline = "#020617";
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(2.2, radius * 0.24);

  if (themeKey === "space") {
    // Twin animated engines make this read as a spaceship instead of an arrow.
    ctx.save();
    ctx.globalAlpha = 0.72 + pulse * 0.25;
    for (const engineY of [-radius * 0.34, radius * 0.34]) {
      const flame = ctx.createLinearGradient(-radius * 1.65, 0, -radius * 0.72, 0);
      flame.addColorStop(0, "rgba(34, 211, 238, 0)");
      flame.addColorStop(0.42, "#22d3ee");
      flame.addColorStop(1, "#f8fafc");
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(-radius * (1.42 + pulse * 0.2), engineY);
      ctx.lineTo(-radius * 0.7, engineY - radius * 0.13);
      ctx.lineTo(-radius * 0.7, engineY + radius * 0.13);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Swept wings.
    ctx.fillStyle = "#075985";
    ctx.beginPath();
    ctx.moveTo(radius * 0.42, -radius * 0.18);
    ctx.lineTo(-radius * 0.48, -radius * 1.05);
    ctx.lineTo(-radius * 0.82, -radius * 0.94);
    ctx.lineTo(-radius * 0.48, -radius * 0.25);
    ctx.lineTo(-radius * 0.48, radius * 0.25);
    ctx.lineTo(-radius * 0.82, radius * 0.94);
    ctx.lineTo(-radius * 0.48, radius * 1.05);
    ctx.lineTo(radius * 0.42, radius * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Armored central fuselage and pointed nose.
    const hull = ctx.createLinearGradient(-radius, -radius, radius, radius);
    hull.addColorStop(0, "#e2e8f0");
    hull.addColorStop(0.52, "#94a3b8");
    hull.addColorStop(1, "#475569");
    ctx.fillStyle = hull;
    ctx.strokeStyle = outline;
    ctx.beginPath();
    ctx.moveTo(radius * 1.5, 0);
    ctx.bezierCurveTo(
      radius * 0.72,
      -radius * 0.55,
      -radius * 0.65,
      -radius * 0.48,
      -radius * 0.92,
      -radius * 0.28,
    );
    ctx.lineTo(-radius * 0.92, radius * 0.28);
    ctx.bezierCurveTo(
      -radius * 0.65,
      radius * 0.48,
      radius * 0.72,
      radius * 0.55,
      radius * 1.5,
      0,
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Two engine pods at the rear.
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = Math.max(1.2, radius * 0.12);
    for (const engineY of [-radius * 0.34, radius * 0.34]) {
      ctx.beginPath();
      ctx.ellipse(-radius * 0.73, engineY, radius * 0.3, radius * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Glass cockpit.
    const glass = ctx.createRadialGradient(
      radius * 0.42,
      -radius * 0.14,
      0,
      radius * 0.34,
      0,
      radius * 0.62,
    );
    glass.addColorStop(0, "#ecfeff");
    glass.addColorStop(0.35, "#22d3ee");
    glass.addColorStop(1, "#164e63");
    ctx.fillStyle = glass;
    ctx.strokeStyle = "#cffafe";
    ctx.beginPath();
    ctx.ellipse(radius * 0.38, 0, radius * 0.52, radius * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hull panel lines and nose beacon.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = Math.max(1, radius * 0.08);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.24, -radius * 0.38);
    ctx.lineTo(-radius * 0.24, radius * 0.38);
    ctx.stroke();

    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(radius * 1.18, 0, radius * 0.11, 0, Math.PI * 2);
    ctx.fill();
  } else if (themeKey === "jungle") {
    // Boots and backpack establish the explorer silhouette from overhead.
    ctx.fillStyle = "#3f2a16";
    for (const legY of [-radius * 0.3, radius * 0.3]) {
      ctx.beginPath();
      ctx.ellipse(-radius * 0.72, legY, radius * 0.38, radius * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#78350f";
    ctx.strokeStyle = outline;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.52, 0, radius * 0.54, radius * 0.64, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = Math.max(1, radius * 0.1);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.72, -radius * 0.52);
    ctx.lineTo(-radius * 0.72, radius * 0.52);
    ctx.stroke();

    // Khaki shirt, arms, and satchel strap.
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, radius * 0.22);
    ctx.fillStyle = "#4d7c0f";
    for (const armY of [-radius * 0.58, radius * 0.58]) {
      ctx.beginPath();
      ctx.ellipse(0, armY, radius * 0.62, radius * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const shirt = ctx.createLinearGradient(-radius, 0, radius, 0);
    shirt.addColorStop(0, "#365314");
    shirt.addColorStop(1, "#65a30d");
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.05, 0, radius * 0.78, radius * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#d6b06f";
    ctx.lineWidth = Math.max(1.2, radius * 0.13);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.42, -radius * 0.5);
    ctx.lineTo(radius * 0.28, radius * 0.5);
    ctx.stroke();

    // Face and unmistakable wide-brimmed expedition hat.
    ctx.fillStyle = "#c68642";
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(1.6, radius * 0.15);
    ctx.beginPath();
    ctx.arc(radius * 0.52, 0, radius * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#d6b06f";
    ctx.beginPath();
    ctx.ellipse(radius * 0.5, 0, radius * 0.58, radius * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#a16207";
    ctx.beginPath();
    ctx.ellipse(radius * 0.5, 0, radius * 0.36, radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#713f12";
    ctx.lineWidth = Math.max(1.2, radius * 0.11);
    ctx.beginPath();
    ctx.moveTo(radius * 0.5, -radius * 0.43);
    ctx.lineTo(radius * 0.5, radius * 0.43);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(radius * 0.86, 0, radius * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // A red cape and steel boots create a readable knight silhouette.
    ctx.fillStyle = "#991b1b";
    ctx.strokeStyle = outline;
    ctx.beginPath();
    ctx.moveTo(radius * 0.2, -radius * 0.48);
    ctx.lineTo(-radius * 1.05, -radius * 0.72);
    ctx.lineTo(-radius * 0.82, 0);
    ctx.lineTo(-radius * 1.05, radius * 0.72);
    ctx.lineTo(radius * 0.2, radius * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#57534e";
    for (const legY of [-radius * 0.3, radius * 0.3]) {
      ctx.beginPath();
      ctx.ellipse(-radius * 0.68, legY, radius * 0.38, radius * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const armor = ctx.createLinearGradient(-radius, -radius, radius, radius);
    armor.addColorStop(0, "#f5f5f4");
    armor.addColorStop(0.5, "#a8a29e");
    armor.addColorStop(1, "#57534e");
    ctx.fillStyle = armor;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.05, 0, radius * 0.76, radius * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rounded pauldrons.
    ctx.fillStyle = "#d6d3d1";
    ctx.strokeStyle = outline;
    for (const shoulderY of [-radius * 0.62, radius * 0.62]) {
      ctx.beginPath();
      ctx.arc(-radius * 0.02, shoulderY, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Helmet, visor, and red plume.
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.moveTo(radius * 0.1, -radius * 0.18);
    ctx.quadraticCurveTo(-radius * 0.58, -radius * 0.46, -radius * 0.9, -radius * 0.08);
    ctx.quadraticCurveTo(-radius * 0.38, radius * 0.05, radius * 0.22, radius * 0.08);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#d6d3d1";
    ctx.strokeStyle = outline;
    ctx.beginPath();
    ctx.ellipse(radius * 0.48, 0, radius * 0.5, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#44403c";
    ctx.beginPath();
    ctx.roundRect?.(
      radius * 0.34,
      -radius * 0.38,
      radius * 0.36,
      radius * 0.76,
      radius * 0.08,
    );
    if (typeof ctx.roundRect === "function") {
      ctx.fill();
    } else {
      ctx.fillRect(radius * 0.34, -radius * 0.38, radius * 0.36, radius * 0.76);
    }

    ctx.strokeStyle = "#e7e5e4";
    ctx.lineWidth = Math.max(1.2, radius * 0.1);
    for (const offset of [-0.2, 0, 0.2]) {
      ctx.beginPath();
      ctx.moveTo(radius * 0.38, radius * offset);
      ctx.lineTo(radius * 0.67, radius * offset);
      ctx.stroke();
    }

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(radius * 0.98, 0);
    ctx.lineTo(radius * 0.72, -radius * 0.12);
    ctx.lineTo(radius * 0.72, radius * 0.12);
    ctx.closePath();
    ctx.fill();

    // Heraldic shield on the off hand.
    ctx.fillStyle = "#b91c1c";
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = Math.max(1.4, radius * 0.13);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.1, radius * 0.5);
    ctx.quadraticCurveTo(radius * 0.35, radius * 0.66, radius * 0.18, radius * 1.04);
    ctx.quadraticCurveTo(-radius * 0.18, radius * 0.9, -radius * 0.35, radius * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#fef3c7";
    ctx.lineWidth = Math.max(1, radius * 0.09);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.08, radius * 0.57);
    ctx.lineTo(-radius * 0.08, radius * 0.88);
    ctx.moveTo(-radius * 0.23, radius * 0.7);
    ctx.lineTo(radius * 0.08, radius * 0.7);
    ctx.stroke();
  }

  const swing = player.meleeSwing;
  const swingElapsed = swing ? world.time - swing.startedAt : Infinity;
  const swingActive = Boolean(
    swing && swingElapsed >= 0 && swingElapsed < swing.duration,
  );
  const swingWeaponKey = swingActive ? swing.weaponKey : player.weapon;
  const swingWeapon = WEAPONS[swingWeaponKey];

  if (swingActive && swingWeapon?.type === "melee") {
    const progress = clamp(swingElapsed / swing.duration, 0, 1);
    const eased = 0.5 - Math.cos(progress * Math.PI) * 0.5;
    const directionOffset = angleDelta(swing.directionAngle, player.facing);

    if (swingWeaponKey === "fists") {
      const thrust = Math.sin(progress * Math.PI);
      ctx.save();
      ctx.rotate(directionOffset);
      ctx.globalAlpha = 0.5 * (1 - progress);
      ctx.strokeStyle = theme.playerGlow;
      ctx.lineWidth = Math.max(2, radius * 0.22);
      ctx.lineCap = "round";
      for (const streakY of [-radius * 0.2, radius * 0.2]) {
        ctx.beginPath();
        ctx.moveTo(radius * 0.32, streakY);
        ctx.lineTo(radius * (0.82 + thrust * 0.52), streakY);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.translate(radius * (0.42 + thrust * 0.72), 0);
      drawWeaponShape(ctx, world, swingWeaponKey, radius * 1.35);
      ctx.restore();
    } else {
      const startAngle = -1.12;
      const currentAngle = lerp(startAngle, 0.98, eased);

      // The bright curved trail makes the direction and reach of the swing visible.
      ctx.save();
      ctx.rotate(directionOffset);
      ctx.globalAlpha = 0.58 * (1 - progress * 0.45);
      ctx.strokeStyle = theme.playerGlow;
      ctx.lineWidth = Math.max(3, radius * 0.36);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.25, startAngle, currentAngle);
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, radius * 0.09);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.rotate(directionOffset + currentAngle);
      ctx.translate(radius * 0.42, 0);
      drawWeaponShape(ctx, world, swingWeaponKey, radius * 1.4);
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.translate(radius * 0.5, radius * 0.5);
    drawWeaponShape(ctx, world, player.weapon, radius * 1.2);
    ctx.restore();
  }

  ctx.restore();
}
function drawVignette(ctx) {
  const gradient = ctx.createRadialGradient(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    CANVAS_HEIGHT * 0.18,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    CANVAS_HEIGHT * 0.72,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.72, "rgba(0,0,0,0.08)");
  gradient.addColorStop(1, "rgba(0,0,0,0.52)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawTile(ctx, x, y, size, fill, stroke = null) { ctx.fillStyle = fill; ctx.fillRect(x, y, size, size);

if (stroke) { ctx.strokeStyle = stroke; ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1); } }

function drawWorldLabel( ctx, text, x, y, { textColor = WORLD_LABEL_TEXT, bgColor = WORLD_LABEL_BG, borderColor = WORLD_LABEL_BORDER, } = {}, ) { if (!text) { return; }

ctx.save(); ctx.font = WORLD_LABEL_FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";

const paddingX = 6; const height = 18; const width = Math.ceil(ctx.measureText(text).width) + paddingX * 2; const left = Math.round(x - width / 2); const top = Math.round(y - height / 2);

ctx.fillStyle = bgColor; ctx.fillRect(left, top, width, height);

ctx.strokeStyle = borderColor; ctx.lineWidth = 1; ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);

ctx.fillStyle = textColor; ctx.fillText(text, Math.round(x), Math.round(y) + 0.5); ctx.restore(); }

function drawFog(ctx, world, camera, startX, endX, startY, endY) {
  const theme = getTheme(world);
  const [fogR, fogG, fogB] = theme.fog;
  const [mistR, mistG, mistB] = theme.mist;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const screenX = Math.floor((x - camera.x) * DRAW_TILE);
      const screenY = Math.floor((y - camera.y) * DRAW_TILE);
      const visible = visibleStrengthAt(world, x, y);
      const discovered = world.discovered[indexOfTile(world.width, x, y)] === 1;

      let alpha = 0.92;
      if (discovered) {
        alpha = lerp(0.34, 0.02, visible);
      } else if (visible > 0) {
        alpha = lerp(0.72, 0.08, visible);
      }

      ctx.fillStyle = `rgba(${fogR}, ${fogG}, ${fogB}, ${alpha})`;
      ctx.fillRect(screenX, screenY, DRAW_TILE + 1, DRAW_TILE + 1);

      if (!discovered && alpha > 0.35) {
        const puff = hashNoise(x, y);
        const pulse =
          0.18 + 0.08 * Math.sin(world.fogPulse * 1.1 + puff * Math.PI * 2);
        const mistAlpha =
          pulse * alpha * (world.level.themeKey === "jungle" ? 0.28 : 0.2);

        ctx.fillStyle = `rgba(${mistR}, ${mistG}, ${mistB}, ${mistAlpha})`;
        ctx.beginPath();

        if (world.level.themeKey === "jungle") {
          ctx.ellipse(
            screenX + DRAW_TILE * (0.3 + puff * 0.4),
            screenY + DRAW_TILE * (0.45 + puff * 0.15),
            DRAW_TILE * 0.42,
            DRAW_TILE * 0.2,
            puff * 0.6,
            0,
            Math.PI * 2,
          );
        } else if (world.level.themeKey === "medieval") {
          ctx.arc(
            screenX + DRAW_TILE * (0.3 + puff * 0.4),
            screenY + DRAW_TILE * (0.35 + puff * 0.25),
            DRAW_TILE * (0.26 + puff * 0.12),
            0,
            Math.PI * 2,
          );
        } else {
          ctx.arc(
            screenX + DRAW_TILE * (0.3 + puff * 0.4),
            screenY + DRAW_TILE * (0.4 + puff * 0.2),
            DRAW_TILE * 0.34,
            0,
            Math.PI * 2,
          );
        }

        ctx.fill();
      }
    }
  }
}

function getPickupLabel(pickup) { if (pickup.type === "weapon") { return pickup.label ?? WEAPONS[pickup.weapon]?.label ?? "Weapon"; }

if (pickup.type === "ammo") { return `${pickup.label ?? "Ammo"} +${pickup.amount}`; }

if (pickup.type === "medkit") { return `${pickup.label ?? "Medkit"} +${pickup.amount}`; }

if (pickup.type === "powerup") { return pickup.label ?? POWER_UPS[pickup.powerUp]?.label ?? "Power-up"; }

return pickup.label ?? "Pickup"; }

function drawEntityLabels(ctx, world, camera) { if (!world.labelsOn) { return; }

const exitIndex = indexOfTile(world.width, world.exit.x, world.exit.y); const exitVisible = visibleStrengthAt(world, world.exit.x, world.exit.y); const exitDiscovered = world.discovered[exitIndex] === 1;

if (exitDiscovered || exitVisible > 0.12) { const exitCenter = tileCenter(world.exit); const exitX = (exitCenter.x - camera.x) * DRAW_TILE; const exitY = (exitCenter.y - camera.y) * DRAW_TILE;

drawWorldLabel(ctx, "EXIT", exitX, exitY - DRAW_TILE * 0.65, {
  textColor: "#bbf7d0",
  bgColor: "rgba(20, 83, 45, 0.88)",
  borderColor: "rgba(134, 239, 172, 0.45)",
});

}

for (const enemy of world.enemies) { if ( enemy.x < camera.x - 1 || enemy.x > camera.x + CANVAS_WIDTH / DRAW_TILE + 1 || enemy.y < camera.y - 1 || enemy.y > camera.y + CANVAS_HEIGHT / DRAW_TILE + 1 ) { continue; }

const visibility = visibleStrengthAt(
  world,
  Math.floor(enemy.x),
  Math.floor(enemy.y),
);

if (visibility <= 0.12) {
  continue;
}

const x = (enemy.x - camera.x) * DRAW_TILE;
const y = (enemy.y - camera.y) * DRAW_TILE;
const label = `${enemy.label ?? ENEMY_TYPES[enemy.kind].label} ${enemy.hp}/${enemy.maxHp}`;

drawWorldLabel(ctx, label, x, y - enemy.radius * DRAW_TILE - 22, {
  textColor: "#fee2e2",
  bgColor: "rgba(69, 10, 10, 0.84)",
  borderColor: "rgba(248, 113, 113, 0.35)",
});

}

const playerX = (world.player.x - camera.x) * DRAW_TILE; const playerY = (world.player.y - camera.y) * DRAW_TILE;

drawWorldLabel( ctx, `${getPlayerDisplayName(world).toUpperCase()} • ${getWeaponLabel(world, world.player.weapon)}`, playerX, playerY - world.player.radius * DRAW_TILE - 22, { textColor: "#e0f2fe", bgColor: "rgba(8, 47, 73, 0.88)", borderColor: "rgba(56, 189, 248, 0.4)", }, ); }

function drawPickups(ctx, world, camera) {
  for (const pickup of world.pickups) {
    if (
      pickup.x < camera.x - 1 ||
      pickup.x > camera.x + CANVAS_WIDTH / DRAW_TILE + 1 ||
      pickup.y < camera.y - 1 ||
      pickup.y > camera.y + CANVAS_HEIGHT / DRAW_TILE + 1
    ) {
      continue;
    }

    const tileX = Math.floor(pickup.x);
    const tileY = Math.floor(pickup.y);
    const visibility = visibleStrengthAt(world, tileX, tileY);
    const discovered =
      world.discovered[indexOfTile(world.width, tileX, tileY)] === 1;

    if (!discovered && visibility <= 0.12) {
      continue;
    }

    const x = (pickup.x - camera.x) * DRAW_TILE;
    const baseY = (pickup.y - camera.y) * DRAW_TILE;
    const bob = Math.sin(world.time * 4 + pickup.x * 1.7 + pickup.y) * 2.2;
    const y = baseY + bob;
    const color =
      pickup.type === "weapon"
        ? "#fbbf24"
        : pickup.type === "ammo"
          ? "#60a5fa"
          : pickup.type === "medkit"
            ? "#f43f5e"
            : pickup.color ?? "#a78bfa";

    ctx.save();
    ctx.globalAlpha = visibility > 0.12 ? 1 : 0.62;
    ctx.shadowBlur = pickup.type === "powerup" ? 24 : 14;
    ctx.shadowColor = color;

    if (pickup.type === "powerup") {
      const radius = DRAW_TILE * 0.28;
      ctx.translate(x, y);
      ctx.rotate(world.time * 1.25 + pickup.x);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(radius, 0);
      ctx.lineTo(0, radius);
      ctx.lineTo(-radius, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.globalAlpha *= 0.58;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (1.45 + 0.14 * Math.sin(world.time * 5)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.translate(-x, -y);
      ctx.rotate(-(world.time * 1.25 + pickup.x));
    } else if (pickup.type === "medkit") {
      const size = DRAW_TILE * 0.48;
      ctx.fillStyle = "#fff1f2";
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.fillStyle = color;
      ctx.fillRect(x - 2, y - size * 0.34, 4, size * 0.68);
      ctx.fillRect(x - size * 0.34, y - 2, size * 0.68, 4);
    } else if (pickup.type === "ammo") {
      if (isMedievalTheme(world)) {
        ctx.strokeStyle = "#d6a85f";
        ctx.fillStyle = "#d1d5db";
        ctx.lineWidth = 1.7;
        for (let offset = -1; offset <= 1; offset += 1) {
          const arrowX = x + offset * 4;
          ctx.beginPath();
          ctx.moveTo(arrowX, y + 7);
          ctx.lineTo(arrowX, y - 6);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(arrowX, y - 9);
          ctx.lineTo(arrowX - 2.5, y - 5);
          ctx.lineTo(arrowX + 2.5, y - 5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = "#92400e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 7, y + 1);
        ctx.lineTo(x + 7, y + 1);
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        for (let offset = -1; offset <= 1; offset += 1) {
          ctx.fillRect(x + offset * 4 - 1.5, y - 6, 3, 12);
          ctx.fillStyle = offset === 0 ? "#dbeafe" : color;
        }
      }
    } else {
      ctx.translate(x, y);
      ctx.rotate(-0.45);
      drawWeaponShape(ctx, world, pickup.weapon, DRAW_TILE * 0.62);
      ctx.rotate(0.45);
      ctx.translate(-x, -y);
    }

    ctx.restore();

    if (world.labelsOn) {
      drawWorldLabel(ctx, getPickupLabel(pickup), x, y - DRAW_TILE * 0.66, {
        textColor: "#f8fafc",
        bgColor:
          pickup.type === "powerup"
            ? "rgba(76, 29, 149, 0.88)"
            : "rgba(15, 23, 42, 0.88)",
        borderColor: `${color}88`,
      });
    }
  }
}

function ensureMinimapCache(world) { const maxPanel = 170; const scale = Math.max( 1, Math.floor(maxPanel / Math.max(world.width, world.height)), ); const mapWidth = world.width * scale; const mapHeight = world.height * scale;

if (typeof document === "undefined") { return { canvas: null, scale, mapWidth, mapHeight }; }

if (!world.minimapCanvas) { world.minimapCanvas = document.createElement("canvas"); world.minimapDirty = true; }

const canvas = world.minimapCanvas; if (canvas.width !== mapWidth || canvas.height !== mapHeight) { canvas.width = mapWidth; canvas.height = mapHeight; world.minimapDirty = true; }

if (world.minimapDirty) { const mapCtx = canvas.getContext("2d"); mapCtx.clearRect(0, 0, mapWidth, mapHeight);

for (let y = 0; y < world.height; y += 1) {
  for (let x = 0; x < world.width; x += 1) {
    const discovered = world.discovered[indexOfTile(world.width, x, y)] === 1;

    const theme = getTheme(world);
    if (!discovered) {
      mapCtx.fillStyle = theme.backdrop;
    } else if (world.grid[y][x] === WALL) {
      mapCtx.fillStyle = theme.wallB;
    } else {
      mapCtx.fillStyle = theme.floorB;
    }

    mapCtx.fillRect(x * scale, y * scale, scale, scale);
  }
}

world.minimapDirty = false;

}

return { canvas, scale, mapWidth, mapHeight }; }

function drawMinimap(ctx, world) { if (!world.minimapOn) { return; }

const { canvas, scale, mapWidth, mapHeight } = ensureMinimapCache(world); const panelX = CANVAS_WIDTH - mapWidth - 16; const panelY = 16;

ctx.fillStyle = "rgba(6, 10, 18, 0.78)"; ctx.fillRect(panelX - 10, panelY - 10, mapWidth + 20, mapHeight + 52);

if (canvas) { ctx.drawImage(canvas, panelX, panelY); }

const exitMapX = panelX + world.exit.x * scale; const exitMapY = panelY + world.exit.y * scale; const playerMapX = panelX + Math.floor(world.player.x) * scale; const playerMapY = panelY + Math.floor(world.player.y) * scale;

ctx.fillStyle = "#22c55e";
ctx.fillRect(exitMapX, exitMapY, scale, scale);

if (hasPowerUp(world, "sonar")) {
  const markerSize = Math.max(2, scale + 1);

  for (const enemy of world.enemies) {
    const enemyMapX = panelX + Math.floor(enemy.x) * scale;
    const enemyMapY = panelY + Math.floor(enemy.y) * scale;

    ctx.fillStyle =
      enemy.kind === "warden"
        ? "#f472b6"
        : enemy.kind === "turret"
          ? "#facc15"
          : "#ef4444";
    ctx.fillRect(enemyMapX, enemyMapY, markerSize, markerSize);
  }
}

ctx.fillStyle = "#38bdf8";
ctx.fillRect(playerMapX, playerMapY, scale + 1, scale + 1);

if (world.labelsOn) { ctx.font = "10px sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#bbf7d0"; ctx.fillText("EXIT", exitMapX + 4, exitMapY - 2);

ctx.fillStyle = "#bae6fd";
ctx.fillText(getPlayerDisplayName(world).toUpperCase(), playerMapX + 4, playerMapY + 10);

}

ctx.fillStyle = "#e5eefb";
ctx.font = "12px sans-serif";
const discoveredPercent = getDiscoveredPercent(world);
ctx.fillText(
  `Map ${world.width}×${world.height} ${discoveredPercent}%`,
  panelX - 1,
  panelY + mapHeight + 18,
);
ctx.fillText(
  hasPowerUp(world, "sonar")
    ? `Blue = ${getPlayerDisplayName(world)} Red = Enemies`
    : `Blue = ${getPlayerDisplayName(world)} Green = Exit`,
  panelX - 1,
  panelY + mapHeight + 36,
);
}

function drawHud(ctx, world, hud) { ctx.fillStyle = "rgba(8, 12, 22, 0.8)"; ctx.fillRect(0, 0, CANVAS_WIDTH, 84); ctx.fillStyle = "rgba(8, 12, 22, 0.7)"; ctx.fillRect(0, CANVAS_HEIGHT - 74, CANVAS_WIDTH, 74);

ctx.fillStyle = "#f8fafc"; ctx.font = "16px sans-serif"; ctx.fillText(`Health ${Math.round(hud.hp)} / ${Math.round(hud.maxHp)}`, 18, 28); ctx.fillText(`${getAmmoLabel(world)} ${Math.floor(hud.ammo)} / ${MAX_AMMO}`, 18, 52); ctx.fillText(`Weapon ${hud.weapon}`, 220, 28); ctx.fillText(`Kills ${hud.kills}`, 220, 52); ctx.fillText(`Time ${formatTime(hud.time)}`, 350, 28); ctx.fillText(`Discovered ${hud.discovered}%`, 350, 52);

if (hud.powerUps.length > 0) { let x = 520; for (const powerUp of hud.powerUps) { ctx.fillStyle = powerUp.color; ctx.fillRect(x, 18, 120, 22); ctx.fillStyle = "#0f172a"; ctx.font = "12px sans-serif"; ctx.fillText(`${powerUp.short} ${powerUp.remaining.toFixed(1)}s`, x + 8, 33, ); x += 126; if (x > CANVAS_WIDTH - 120) { break; } } }

ctx.fillStyle = "#cbd5e1"; ctx.font = "13px sans-serif"; const controlsText = hud.controls.join(" • "); ctx.fillText(controlsText, 18, CANVAS_HEIGHT - 32);

if (hud.victory) { ctx.fillStyle = "#22c55e"; ctx.font = "bold 18px sans-serif"; ctx.fillText("Exit reached. Press N for a new maze.", 18, CANVAS_HEIGHT - 52); } else if (hud.gameOver) { ctx.fillStyle = "#f87171"; ctx.font = "bold 18px sans-serif"; ctx.fillText(`${getPlayerDisplayName(world)} fell in the maze. Press N to retry.`, 18, CANVAS_HEIGHT - 52); } }

function drawWorld2D(ctx, world) {
  const camera = getCamera(world);
  const startX = Math.max(0, Math.floor(camera.x) - 1);
  const endX = Math.min(
    world.width - 1,
    Math.ceil(camera.x + CANVAS_WIDTH / DRAW_TILE) + 1,
  );
  const startY = Math.max(0, Math.floor(camera.y) - 1);
  const endY = Math.min(
    world.height - 1,
    Math.ceil(camera.y + CANVAS_HEIGHT / DRAW_TILE) + 1,
  );

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = getTheme(world).backdrop;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const screenX = Math.floor((x - camera.x) * DRAW_TILE);
      const screenY = Math.floor((y - camera.y) * DRAW_TILE);
      drawMazeTile(ctx, world, x, y, screenX, screenY);
    }
  }

  drawFog(ctx, world, camera, startX, endX, startY, endY);
  drawExitPortal(ctx, world, camera);
  drawPickups(ctx, world, camera);

  for (const enemy of world.enemies) {
    if (
      enemy.x < camera.x - 1 ||
      enemy.x > camera.x + CANVAS_WIDTH / DRAW_TILE + 1 ||
      enemy.y < camera.y - 1 ||
      enemy.y > camera.y + CANVAS_HEIGHT / DRAW_TILE + 1
    ) {
      continue;
    }

    const visibility = visibleStrengthAt(
      world,
      Math.floor(enemy.x),
      Math.floor(enemy.y),
    );

    if (visibility <= 0.12) {
      continue;
    }

    const x = (enemy.x - camera.x) * DRAW_TILE;
    const y = (enemy.y - camera.y) * DRAW_TILE;
    drawEnemyBody(ctx, world, enemy, x, y);
    drawEnemyHealth(ctx, enemy, x, y);
  }

  for (const projectile of world.projectiles) {
    if (
      projectile.x < camera.x - 1 ||
      projectile.x > camera.x + CANVAS_WIDTH / DRAW_TILE + 1 ||
      projectile.y < camera.y - 1 ||
      projectile.y > camera.y + CANVAS_HEIGHT / DRAW_TILE + 1
    ) {
      continue;
    }

    drawProjectile(ctx, projectile, camera);
  }

  drawEffects(ctx, world, camera);

  const playerX = (world.player.x - camera.x) * DRAW_TILE;
  const playerY = (world.player.y - camera.y) * DRAW_TILE;
  drawPlayerBody(ctx, world, playerX, playerY);
  drawEntityLabels(ctx, world, camera);

  if (world.damageFlash > 0) {
    ctx.fillStyle = `rgba(239, 68, 68, ${world.damageFlash * 0.28})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  drawVignette(ctx);

  if (world.messageTtl > 0 && world.message) {
    const width = Math.min(560, Math.max(200, world.message.length * 9.5));
    ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
    ctx.fillRect((CANVAS_WIDTH - width) / 2, CANVAS_HEIGHT - 60, width, 40);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.38)";
    ctx.strokeRect((CANVAS_WIDTH - width) / 2 + 0.5, CANVAS_HEIGHT - 59.5, width - 1, 39);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "600 17px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(world.message, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 34);
    ctx.textAlign = "left";
  }

  if (world.gameOver || world.victory) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.shadowBlur = 24;
    ctx.shadowColor = world.victory ? "#22c55e" : "#ef4444";
    ctx.fillStyle = world.victory ? "#4ade80" : "#fb7185";
    ctx.font = "800 46px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      world.victory ? "MAZE ESCAPED" : "GAME OVER",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 32,
    );
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText(
      world.victory
        ? `Finished in ${formatTime(world.time)}`
        : `${getPlayerDisplayName(world)} survived ${formatTime(world.time)}`,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 10,
    );
    ctx.fillText(
      "Press N for a new maze",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 42,
    );
    ctx.textAlign = "left";
  }
}


function cast3DRay(world, angle) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  let mapX = Math.floor(world.player.x);
  let mapY = Math.floor(world.player.y);

  const deltaDistX =
    Math.abs(dirX) < 0.000001 ? Infinity : Math.abs(1 / dirX);
  const deltaDistY =
    Math.abs(dirY) < 0.000001 ? Infinity : Math.abs(1 / dirY);
  const stepX = dirX < 0 ? -1 : 1;
  const stepY = dirY < 0 ? -1 : 1;
  let sideDistX =
    dirX < 0
      ? (world.player.x - mapX) * deltaDistX
      : (mapX + 1 - world.player.x) * deltaDistX;
  let sideDistY =
    dirY < 0
      ? (world.player.y - mapY) * deltaDistY
      : (mapY + 1 - world.player.y) * deltaDistY;
  let side = 0;
  let distance = 0;

  for (let step = 0; step < 96; step += 1) {
    if (sideDistX < sideDistY) {
      mapX += stepX;
      distance = sideDistX;
      sideDistX += deltaDistX;
      side = 0;
    } else {
      mapY += stepY;
      distance = sideDistY;
      sideDistY += deltaDistY;
      side = 1;
    }

    if (
      distance > VIEW_3D_MAX_DISTANCE ||
      mapX < 0 ||
      mapY < 0 ||
      mapX >= world.width ||
      mapY >= world.height
    ) {
      break;
    }

    if (world.grid[mapY][mapX] === WALL) {
      const hitX = world.player.x + dirX * distance;
      const hitY = world.player.y + dirY * distance;
      const wallOffset =
        side === 0 ? hitY - Math.floor(hitY) : hitX - Math.floor(hitX);

      return {
        distance,
        mapX,
        mapY,
        side,
        wallOffset,
      };
    }
  }

  return {
    distance: VIEW_3D_MAX_DISTANCE,
    mapX,
    mapY,
    side,
    wallOffset: 0,
  };
}

function draw3DEnvironment(ctx, world, zBuffer) {
  const theme = getTheme(world);
  const horizon = CANVAS_HEIGHT * 0.46;
  const ceiling = ctx.createLinearGradient(0, 0, 0, horizon);
  ceiling.addColorStop(0, theme.backdrop);
  ceiling.addColorStop(1, theme.wallC);
  ctx.fillStyle = ceiling;
  ctx.fillRect(0, 0, CANVAS_WIDTH, horizon);

  const floor = ctx.createLinearGradient(0, horizon, 0, CANVAS_HEIGHT);
  floor.addColorStop(0, theme.floorB);
  floor.addColorStop(1, theme.backdrop);
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizon, CANVAS_WIDTH, CANVAS_HEIGHT - horizon);

  ctx.strokeStyle = theme.floorLine;
  ctx.lineWidth = 1;

  for (let row = 0; row < 9; row += 1) {
    const t = row / 8;
    const y =
      horizon + 14 + t * t * (CANVAS_HEIGHT - horizon - 20);
    ctx.globalAlpha = 0.16 + t * 0.16;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.12;
  for (let x = -CANVAS_WIDTH; x <= CANVAS_WIDTH * 2; x += 96) {
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, horizon);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const projectionPlane =
    CANVAS_WIDTH / 2 / Math.tan(VIEW_3D_FOV / 2);
  const rayCount = Math.ceil(CANVAS_WIDTH / VIEW_3D_RAY_WIDTH);

  for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
    const screenX =
      rayIndex * VIEW_3D_RAY_WIDTH + VIEW_3D_RAY_WIDTH / 2;
    const cameraX =
      (screenX - CANVAS_WIDTH / 2) / projectionPlane;
    const angleOffset = Math.atan(cameraX);
    const rayAngle = world.player.facing + angleOffset;
    const hit = cast3DRay(world, rayAngle);
    const perpendicularDistance = Math.max(
      0.08,
      hit.distance * Math.cos(angleOffset),
    );
    zBuffer[rayIndex] = perpendicularDistance;

    const wallHeight = Math.min(
      CANVAS_HEIGHT * 2.4,
      projectionPlane / perpendicularDistance,
    );
    const wallTop = horizon - wallHeight / 2;
    const wallBottom = horizon + wallHeight / 2;
    const distanceFade = clamp(
      1 - perpendicularDistance / VIEW_3D_MAX_DISTANCE,
      0.12,
      1,
    );
    const sideShade = hit.side === 1 ? 0.76 : 1;
    const cellNoise =
      0.82 + hashNoise(hit.mapX, hit.mapY) * 0.18;

    ctx.globalAlpha = distanceFade * sideShade * cellNoise;
    ctx.fillStyle = hit.side === 1 ? theme.wallB : theme.wallA;
    ctx.fillRect(
      rayIndex * VIEW_3D_RAY_WIDTH,
      wallTop,
      VIEW_3D_RAY_WIDTH + 1,
      wallBottom - wallTop,
    );

    if (
      perpendicularDistance < 10 &&
      hit.wallOffset < 0.055
    ) {
      ctx.globalAlpha = distanceFade * 0.32;
      ctx.fillStyle = theme.wallEdge;
      ctx.fillRect(
        rayIndex * VIEW_3D_RAY_WIDTH,
        wallTop,
        1,
        wallBottom - wallTop,
      );
    }

    if (
      world.level.themeKey === "jungle" &&
      hashNoise(hit.mapX * 5 + rayIndex, hit.mapY * 7) > 0.92
    ) {
      ctx.globalAlpha = distanceFade * 0.18;
      ctx.fillStyle = "#84cc16";
      ctx.fillRect(
        rayIndex * VIEW_3D_RAY_WIDTH,
        wallTop,
        1,
        Math.min(70, wallBottom - wallTop),
      );
    } else if (
      world.level.themeKey === "space" &&
      hit.wallOffset > 0.46 &&
      hit.wallOffset < 0.52
    ) {
      ctx.globalAlpha = distanceFade * 0.28;
      ctx.fillStyle = "#67e8f9";
      ctx.fillRect(
        rayIndex * VIEW_3D_RAY_WIDTH,
        wallTop,
        1,
        wallBottom - wallTop,
      );
    } else if (
      world.level.themeKey === "medieval" &&
      hit.wallOffset > 0.47 &&
      hit.wallOffset < 0.53
    ) {
      ctx.globalAlpha = distanceFade * 0.15;
      ctx.fillStyle = "#d6d3d1";
      ctx.fillRect(
        rayIndex * VIEW_3D_RAY_WIDTH,
        wallTop,
        1,
        wallBottom - wallTop,
      );
    }
  }

  ctx.globalAlpha = 1;
  return projectionPlane;
}

function project3DSprite(world, x, y, projectionPlane) {
  const dx = x - world.player.x;
  const dy = y - world.player.y;
  const distance = Math.hypot(dx, dy);
  const angleToSprite = Math.atan2(dy, dx);
  const relativeAngle = angleDelta(
    angleToSprite,
    world.player.facing,
  );
  const depth = distance * Math.cos(relativeAngle);

  if (
    distance < 0.08 ||
    distance > VIEW_3D_MAX_DISTANCE + 1 ||
    depth <= 0.05 ||
    Math.abs(relativeAngle) > VIEW_3D_FOV * 0.62
  ) {
    return null;
  }

  return {
    distance,
    depth,
    relativeAngle,
    screenX:
      CANVAS_WIDTH / 2 +
      Math.tan(relativeAngle) * projectionPlane,
    scale: projectionPlane / depth,
  };
}

function is3DSpriteVisible(projection, zBuffer) {
  const centerRay = clamp(
    Math.floor(projection.screenX / VIEW_3D_RAY_WIDTH),
    0,
    zBuffer.length - 1,
  );
  const sampleRadius = 2;
  let farthestVisibleDepth = 0;

  for (
    let rayIndex = Math.max(0, centerRay - sampleRadius);
    rayIndex <= Math.min(zBuffer.length - 1, centerRay + sampleRadius);
    rayIndex += 1
  ) {
    farthestVisibleDepth = Math.max(
      farthestVisibleDepth,
      zBuffer[rayIndex] ?? VIEW_3D_MAX_DISTANCE,
    );
  }

  return projection.depth < farthestVisibleDepth + 0.28;
}

function draw3DExit(ctx, projection) {
  const height = clamp(
    projection.scale * 0.9,
    28,
    CANVAS_HEIGHT * 1.25,
  );
  const width = height * 0.48;
  const baseY =
    CANVAS_HEIGHT * 0.46 + height * 0.5;

  ctx.save();
  ctx.translate(
    projection.screenX,
    baseY - height * 0.5,
  );
  ctx.shadowBlur = clamp(
    34 - projection.distance,
    8,
    34,
  );
  ctx.shadowColor = "#22c55e";
  ctx.globalAlpha = clamp(
    1 - projection.distance / VIEW_3D_MAX_DISTANCE,
    0.35,
    1,
  );
  ctx.strokeStyle = "#86efac";
  ctx.lineWidth = clamp(height * 0.045, 2, 8);
  ctx.beginPath();
  ctx.ellipse(
    0,
    0,
    width * 0.46,
    height * 0.45,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.fillStyle = "rgba(34, 197, 94, 0.22)";
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#dcfce7";
  ctx.font = `800 ${clamp(
    height * 0.1,
    11,
    20,
  )}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("EXIT", 0, -height * 0.57);
  ctx.restore();
}


function get3DEnemyAttackState(world, enemy) {
  const elapsed = world.time - (enemy.lastAttackAt ?? -Infinity);
  const duration = enemy.attackStyle === "contact" ? 0.46 : 0.34;

  if (elapsed < 0 || elapsed > duration) {
    return { active: false, pulse: 0, style: enemy.attackStyle };
  }

  const progress = clamp(elapsed / duration, 0, 1);
  return {
    active: true,
    pulse: Math.sin(progress * Math.PI),
    style: enemy.attackStyle,
  };
}

function draw3DEnemyAttackEffect(ctx, world, enemy, width, height, attack) {
  if (!attack.active) {
    return;
  }

  const themeKey = world.level.themeKey;
  const effectColor =
    themeKey === "space"
      ? "#67e8f9"
      : themeKey === "jungle"
        ? "#bef264"
        : "#fbbf24";

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.45 + attack.pulse * 0.5;
  ctx.shadowBlur = 20;
  ctx.shadowColor = effectColor;

  if (attack.style === "contact") {
    ctx.strokeStyle = effectColor;
    ctx.lineWidth = clamp(width * 0.055, 2, 8);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(
        side * width * 0.06,
        0,
        width * (0.5 + attack.pulse * 0.15),
        -1.05 + side * 0.18,
        0.72 + side * 0.18,
      );
      ctx.stroke();
    }
  } else {
    const muzzleX = enemy.kind === "turret" ? 0 : width * 0.3;
    const muzzleY = -height * 0.25;
    ctx.translate(muzzleX, muzzleY);
    ctx.fillStyle = "#fff7ed";

    for (let spike = 0; spike < 8; spike += 1) {
      const angle = (Math.PI * 2 * spike) / 8;
      const inner = width * 0.045;
      const outer = width * (0.14 + attack.pulse * 0.08);
      ctx.beginPath();
      ctx.moveTo(
        Math.cos(angle - 0.18) * inner,
        Math.sin(angle - 0.18) * inner,
      );
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.lineTo(
        Math.cos(angle + 0.18) * inner,
        Math.sin(angle + 0.18) * inner,
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = effectColor;
    ctx.beginPath();
    ctx.arc(0, 0, width * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function draw3DThemedEnemy(ctx, world, enemy, width, height, attack) {
  const theme = getTheme(world);
  const radius = Math.min(width * 0.43, height * 0.3);

  ctx.save();
  ctx.save();
  ctx.translate(0, -height * 0.1);
  ctx.scale(1.08, 1.08);

  const facingTowardCamera = -Math.PI / 2;
  if (world.level.themeKey === "space") {
    drawSpaceEnemy(ctx, enemy, radius, facingTowardCamera);
  } else if (world.level.themeKey === "jungle") {
    drawJungleEnemy(ctx, enemy, radius, facingTowardCamera);
  } else {
    drawMedievalEnemy(ctx, enemy, radius, facingTowardCamera);
  }

  ctx.restore();

  if (enemy.kind === "warden") {
    ctx.strokeStyle = theme.playerAccent;
    ctx.lineWidth = clamp(width * 0.025, 1, 4);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(0, -height * 0.1, radius * 1.18, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function draw3DEnemy(ctx, world, enemy, projection) {
  const enemyType = ENEMY_TYPES[enemy.kind];
  const bodyHeight = clamp(
    projection.scale * (enemy.radius * 2.35 + 0.42),
    26,
    CANVAS_HEIGHT * 0.95,
  );
  const bodyWidth =
    bodyHeight *
    (enemy.kind === "warden"
      ? 0.72
      : enemy.kind === "brute"
        ? 0.66
        : 0.56);
  const baseY = CANVAS_HEIGHT * 0.46 + bodyHeight * 0.43;
  const bobPhase = enemy.x * 1.7 + enemy.y * 2.3;
  const bob =
    Math.sin(world.time * 4 + bobPhase) *
    Math.min(4, bodyHeight * 0.025);
  const attack = get3DEnemyAttackState(world, enemy);
  const hitAge = world.time - (enemy.lastHitAt ?? -Infinity);
  const hitPulse =
    hitAge >= 0 && hitAge < 0.18
      ? 1 - hitAge / 0.18
      : 0;
  const color =
    enemy.color ?? enemyType.color ?? "#ef4444";

  ctx.save();
  ctx.translate(
    projection.screenX,
    baseY - bodyHeight * 0.48 + bob,
  );

  const attackScale =
    attack.style === "contact"
      ? 1 + attack.pulse * 0.14
      : 1 + attack.pulse * 0.045;
  ctx.translate(
    0,
    attack.style === "ranged"
      ? attack.pulse * bodyHeight * 0.025
      : 0,
  );
  ctx.scale(attackScale, attackScale);

  ctx.globalAlpha = clamp(
    1 - projection.distance / VIEW_3D_MAX_DISTANCE,
    0.38,
    1,
  );

  ctx.fillStyle = "rgba(2, 6, 23, 0.55)";
  ctx.beginPath();
  ctx.ellipse(
    0,
    bodyHeight * 0.45,
    bodyWidth * 0.5,
    bodyHeight * 0.075,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.shadowBlur = clamp(24 - projection.distance, 4, 24);
  ctx.shadowColor = hitPulse > 0 ? "#ffffff" : color;

  draw3DThemedEnemy(
    ctx,
    world,
    enemy,
    bodyWidth,
    bodyHeight,
    attack,
  );

  if (hitPulse > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = hitPulse * 0.38;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(
      0,
      -bodyHeight * 0.08,
      bodyWidth * 0.5,
      bodyHeight * 0.34,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  draw3DEnemyAttackEffect(
    ctx,
    world,
    enemy,
    bodyWidth,
    bodyHeight,
    attack,
  );

  ctx.shadowBlur = 0;
  ctx.globalAlpha = clamp(
    1 - projection.distance / VIEW_3D_MAX_DISTANCE,
    0.48,
    1,
  );

  const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
  const barWidth = bodyWidth * 0.96;
  const barY = -bodyHeight * 0.61;
  ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
  ctx.fillRect(-barWidth / 2, barY, barWidth, 6);
  ctx.fillStyle =
    hpRatio > 0.45
      ? "#4ade80"
      : hpRatio > 0.2
        ? "#facc15"
        : "#fb7185";
  ctx.fillRect(-barWidth / 2, barY, barWidth * hpRatio, 6);

  if (world.labelsOn && bodyHeight > 34) {
    ctx.fillStyle = "#f8fafc";
    ctx.font = `800 ${clamp(
      bodyHeight * 0.075,
      10,
      15,
    )}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.shadowBlur = 4;
    ctx.shadowColor = "#020617";
    ctx.fillText(
      enemy.label ?? enemyType.label,
      0,
      -bodyHeight * 0.69,
    );
  }

  ctx.restore();
}

function get3DPickupColor(pickup) {
  if (pickup.type === "weapon") return "#fbbf24";
  if (pickup.type === "ammo") return "#60a5fa";
  if (pickup.type === "medkit") return "#f43f5e";
  return pickup.color ?? "#a78bfa";
}

function draw3DPickup(ctx, world, pickup, projection) {
  const size = clamp(
    projection.scale * 0.24,
    8,
    92,
  );
  const y =
    CANVAS_HEIGHT * 0.46 +
    size * 1.2 +
    Math.sin(world.time * 4 + pickup.x) * 4;
  const color = get3DPickupColor(pickup);

  ctx.save();
  ctx.translate(projection.screenX, y);
  ctx.globalAlpha = clamp(
    1 - projection.distance / VIEW_3D_MAX_DISTANCE,
    0.38,
    1,
  );
  ctx.shadowBlur = clamp(size * 0.5, 6, 24);
  ctx.shadowColor = color;
  ctx.fillStyle = color;

  if (pickup.type === "medkit") {
    ctx.fillStyle = "#fff1f2";
    ctx.fillRect(
      -size * 0.42,
      -size * 0.42,
      size * 0.84,
      size * 0.84,
    );
    ctx.fillStyle = color;
    ctx.fillRect(
      -size * 0.08,
      -size * 0.31,
      size * 0.16,
      size * 0.62,
    );
    ctx.fillRect(
      -size * 0.31,
      -size * 0.08,
      size * 0.62,
      size * 0.16,
    );
  } else if (pickup.type === "ammo") {
    if (isMedievalTheme(world)) {
      ctx.strokeStyle = "#d6a85f";
      ctx.fillStyle = "#d1d5db";
      ctx.lineWidth = Math.max(1.5, size * 0.06);

      for (let offset = -1; offset <= 1; offset += 1) {
        const arrowX = offset * size * 0.18;
        ctx.beginPath();
        ctx.moveTo(arrowX, size * 0.42);
        ctx.lineTo(arrowX, -size * 0.32);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(arrowX, -size * 0.48);
        ctx.lineTo(arrowX - size * 0.08, -size * 0.3);
        ctx.lineTo(arrowX + size * 0.08, -size * 0.3);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = "#92400e";
      ctx.lineWidth = Math.max(2, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(-size * 0.34, size * 0.08);
      ctx.lineTo(size * 0.34, size * 0.08);
      ctx.stroke();
    } else {
      for (let offset = -1; offset <= 1; offset += 1) {
        ctx.fillRect(
          offset * size * 0.19 - size * 0.06,
          -size * 0.42,
          size * 0.12,
          size * 0.84,
        );
      }
    }
  } else {
    ctx.rotate(world.time * 0.7);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.5);
    ctx.lineTo(size * 0.42, 0);
    ctx.lineTo(0, size * 0.5);
    ctx.lineTo(-size * 0.42, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.shadowBlur = 0;

  if (world.labelsOn && size > 13) {
    if (
      pickup.type !== "medkit" &&
      pickup.type !== "ammo"
    ) {
      ctx.rotate(-world.time * 0.7);
    }
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 ${clamp(
      size * 0.28,
      9,
      13,
    )}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(
      getPickupLabel(pickup),
      0,
      -size * 0.72,
    );
  }

  ctx.restore();
}

function draw3DProjectile(ctx, projectile, projection) {
  const size = clamp(
    projection.scale * 0.055,
    3,
    20,
  );

  ctx.save();
  ctx.globalAlpha = clamp(
    1 - projection.distance / VIEW_3D_MAX_DISTANCE,
    0.35,
    1,
  );

  if (projectile.isArrow) {
    const centerY = CANVAS_HEIGHT * 0.46;
    const arrowLength = clamp(size * 3.8, 12, 54);

    ctx.shadowBlur = size * 0.8;
    ctx.shadowColor = projectile.color ?? "#d6a85f";
    ctx.strokeStyle = projectile.color ?? "#d6a85f";
    ctx.lineWidth = Math.max(1.5, size * 0.35);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(projection.screenX - arrowLength * 0.45, centerY);
    ctx.lineTo(projection.screenX + arrowLength * 0.4, centerY);
    ctx.stroke();

    ctx.fillStyle = "#d1d5db";
    ctx.beginPath();
    ctx.moveTo(projection.screenX + arrowLength * 0.58, centerY);
    ctx.lineTo(projection.screenX + arrowLength * 0.34, centerY - size * 0.6);
    ctx.lineTo(projection.screenX + arrowLength * 0.34, centerY + size * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    return;
  }

  ctx.shadowBlur = size * 1.8;
  ctx.shadowColor =
    projectile.color ?? "#fde047";
  ctx.fillStyle =
    projectile.color ?? "#fde047";
  ctx.beginPath();
  ctx.arc(
    projection.screenX,
    CANVAS_HEIGHT * 0.46,
    size,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

function draw3DEffect(ctx, effect, projection) {
  const initialTtl =
    effect.kind === "ring"
      ? 0.22
      : effect.kind === "explosion"
        ? 0.38
        : effect.kind === "spark"
          ? 0.34
          : effect.kind === "shipDebris"
            ? 0.82
            : 0.55;
  const progress = clamp(
    effect.age / Math.max(0.001, effect.age + effect.ttl),
    0,
    1,
  );
  const alpha =
    clamp(effect.ttl / initialTtl, 0, 1) *
    (effect.alpha ?? 1) *
    clamp(1 - projection.distance / VIEW_3D_MAX_DISTANCE, 0.35, 1);
  const baseY =
    CANVAS_HEIGHT * 0.46 +
    clamp(projection.scale * 0.18, 2, CANVAS_HEIGHT * 0.28);
  const size = clamp(
    projection.scale * Math.max(0.035, effect.size ?? 0.1),
    2,
    72,
  );

  ctx.save();
  ctx.translate(projection.screenX, baseY);
  ctx.globalAlpha = alpha;

  if (effect.kind === "shipDebris") {
    const travelAngle = Math.atan2(effect.vy ?? 0, effect.vx ?? 0);
    const spin = (effect.age ?? 0) * 8.5;
    const width = Math.max(5, size * 2.4);
    const height = Math.max(2.5, size * 0.72);

    ctx.rotate(travelAngle + spin);
    ctx.fillStyle = effect.color;
    ctx.fillRect(-width / 2, -height / 2, width, height);

    ctx.strokeStyle = "rgba(226, 232, 240, 0.8)";
    ctx.lineWidth = Math.max(1, size * 0.12);
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    ctx.fillStyle = "rgba(56, 189, 248, 0.55)";
    ctx.fillRect(-width * 0.18, -height * 0.38, width * 0.36, height * 0.76);
  } else if (effect.kind === "spark") {
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = effect.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = effect.color;
    ctx.lineWidth = Math.max(1.5, size * 0.3);
    ctx.beginPath();
    ctx.moveTo(-size * 1.2, size * 0.35);
    ctx.lineTo(size * 1.2, -size * 0.35);
    ctx.stroke();
  } else if (effect.kind === "ring") {
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = Math.max(1.5, 4 * (1 - progress));
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      clamp(
        projection.scale *
          lerp(effect.size, effect.endSize ?? effect.size * 3, progress),
        3,
        90,
      ),
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  } else if (effect.kind === "explosion") {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = effect.color;
    ctx.shadowBlur = 18;
    ctx.shadowColor = effect.color;
    ctx.beginPath();
    ctx.arc(0, 0, size * (1.5 + progress * 2.4), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function draw3DSprites(
  ctx,
  world,
  zBuffer,
  projectionPlane,
) {
  const sprites = [];
  const exitProjection = project3DSprite(
    world,
    world.exit.x + 0.5,
    world.exit.y + 0.5,
    projectionPlane,
  );

  if (exitProjection) {
    sprites.push({
      type: "exit",
      projection: exitProjection,
    });
  }

  for (const enemy of world.enemies) {
    const projection = project3DSprite(
      world,
      enemy.x,
      enemy.y,
      projectionPlane,
    );

    if (projection) {
      sprites.push({
        type: "enemy",
        entity: enemy,
        projection,
      });
    }
  }

  for (const pickup of world.pickups) {
    const projection = project3DSprite(
      world,
      pickup.x,
      pickup.y,
      projectionPlane,
    );

    if (projection) {
      sprites.push({
        type: "pickup",
        entity: pickup,
        projection,
      });
    }
  }

  for (const projectile of world.projectiles) {
    const projection = project3DSprite(
      world,
      projectile.x,
      projectile.y,
      projectionPlane,
    );

    if (projection) {
      sprites.push({
        type: "projectile",
        entity: projectile,
        projection,
      });
    }
  }

  for (const effect of world.effects ?? []) {
    if (
      !["shipDebris", "spark", "ring", "explosion"].includes(effect.kind)
    ) {
      continue;
    }

    const projection = project3DSprite(
      world,
      effect.x,
      effect.y,
      projectionPlane,
    );

    if (projection) {
      sprites.push({
        type: "effect",
        entity: effect,
        projection,
      });
    }
  }

  sprites.sort(
    (a, b) =>
      b.projection.distance -
      a.projection.distance,
  );

  for (const sprite of sprites) {
    if (
      !is3DSpriteVisible(
        sprite.projection,
        zBuffer,
      )
    ) {
      continue;
    }

    if (sprite.type === "exit") {
      draw3DExit(ctx, sprite.projection);
    } else if (sprite.type === "enemy") {
      draw3DEnemy(
        ctx,
        world,
        sprite.entity,
        sprite.projection,
      );
    } else if (sprite.type === "pickup") {
      draw3DPickup(
        ctx,
        world,
        sprite.entity,
        sprite.projection,
      );
    } else if (sprite.type === "effect") {
      draw3DEffect(
        ctx,
        sprite.entity,
        sprite.projection,
      );
    } else {
      draw3DProjectile(
        ctx,
        sprite.entity,
        sprite.projection,
      );
    }
  }
}

function draw3DMedievalBow(ctx, world, recoil, theme) {
  const profiles = {
    pistol: { width: 190, height: 150, thickness: 10 },
    revolver: { width: 218, height: 170, thickness: 12 },
    smg: { width: 176, height: 138, thickness: 9 },
    shotgun: { width: 236, height: 162, thickness: 13 },
    rifle: { width: 250, height: 188, thickness: 12 },
    dmr: { width: 272, height: 202, thickness: 13 },
  };
  const profile = profiles[world.player.weapon] ?? profiles.rifle;
  const stringPull = 22 + recoil * 26;
  const centerY = -96;

  ctx.save();
  ctx.translate(0, centerY);

  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = profile.thickness;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-profile.width / 2, 20);
  ctx.quadraticCurveTo(
    -profile.width * 0.28,
    -profile.height,
    0,
    -profile.height * 0.72,
  );
  ctx.quadraticCurveTo(
    profile.width * 0.28,
    -profile.height,
    profile.width / 2,
    20,
  );
  ctx.stroke();

  ctx.strokeStyle = theme.playerAccent;
  ctx.lineWidth = 2.4;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(-profile.width / 2, 20);
  ctx.lineTo(0, -stringPull);
  ctx.lineTo(profile.width / 2, 20);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#d6a85f";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -stringPull + 12);
  ctx.lineTo(0, -profile.height - 62);
  ctx.stroke();

  ctx.fillStyle = "#d1d5db";
  ctx.beginPath();
  ctx.moveTo(0, -profile.height - 82);
  ctx.lineTo(-9, -profile.height - 58);
  ctx.lineTo(9, -profile.height - 58);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#fef3c7";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -stringPull + 8);
  ctx.lineTo(-11, -stringPull + 22);
  ctx.moveTo(0, -stringPull + 8);
  ctx.lineTo(11, -stringPull + 22);
  ctx.stroke();

  if (world.player.weapon === "shotgun") {
    ctx.strokeStyle = theme.playerGlow;
    ctx.globalAlpha = 0.58;
    ctx.lineWidth = 2;
    for (const offset of [-8, 8]) {
      ctx.beginPath();
      ctx.moveTo(offset, -stringPull + 8);
      ctx.lineTo(offset, -profile.height - 48);
      ctx.stroke();
    }
  }

  if (world.player.weapon === "dmr") {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = theme.playerGlow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(30, -profile.height * 0.72, 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function draw3DWeapon(ctx, world) {
  const theme = getTheme(world);
  const weapon = WEAPONS[world.player.weapon];
  const recoil = clamp(
    (world.player.nextAttackAt - world.time) /
      Math.max(
        0.08,
        getWeaponCooldown(world, weapon),
      ),
    0,
    1,
  );
  const bob =
    Math.sin(world.time * 7) *
    (world.gameOver || world.victory ? 0 : 3);
  const centerX = CANVAS_WIDTH / 2;
  const baseY =
    CANVAS_HEIGHT + recoil * 24 + bob;

  ctx.save();
  ctx.translate(centerX, baseY);

  if (weapon.type === "melee") {
    const isFists =
      world.player.weapon === "fists";

    if (isFists) {
      ctx.fillStyle = theme.playerGlow;
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.ellipse(
        -92,
        -46,
        52,
        72,
        -0.28,
        0,
        Math.PI * 2,
      );
      ctx.ellipse(
        92,
        -46,
        52,
        72,
        0.28,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      ctx.fillStyle = theme.playerAccent;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(
        -86,
        -58,
        26,
        34,
        -0.28,
        0,
        Math.PI * 2,
      );
      ctx.ellipse(
        86,
        -58,
        26,
        34,
        0.28,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else {
      ctx.rotate(-0.18 - recoil * 0.22);
      ctx.fillStyle = theme.wallA;
      ctx.fillRect(-20, -230, 40, 210);
      ctx.fillStyle = theme.playerGlow;
      ctx.fillRect(-10, -245, 20, 180);
      ctx.fillStyle = theme.playerAccent;
      ctx.fillRect(-52, -78, 104, 18);
    }
  } else if (isMedievalTheme(world)) {
    draw3DMedievalBow(ctx, world, recoil, theme);
  } else {
    const gunWidth =
      world.player.weapon === "shotgun" ||
      world.player.weapon === "rifle" ||
      world.player.weapon === "dmr"
        ? 190
        : world.player.weapon === "smg"
          ? 150
          : 118;
    const gunHeight = gunWidth * 0.36;

    ctx.fillStyle = theme.wallB;
    ctx.beginPath();
    ctx.roundRect(
      -gunWidth / 2,
      -gunHeight - 50,
      gunWidth,
      gunHeight,
      16,
    );
    ctx.fill();

    ctx.fillStyle = theme.wallA;
    ctx.fillRect(
      -gunWidth * 0.34,
      -gunHeight - 36,
      gunWidth * 0.68,
      gunHeight * 0.42,
    );
    ctx.fillStyle = theme.playerGlow;
    ctx.fillRect(
      -gunWidth * 0.08,
      -gunHeight - 58,
      gunWidth * 0.16,
      14,
    );
    ctx.fillStyle = theme.playerAccent;
    ctx.globalAlpha = 0.82;
    ctx.fillRect(
      -gunWidth * 0.28,
      -gunHeight - 29,
      gunWidth * 0.56,
      5,
    );

    if (world.player.weapon === "dmr") {
      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.arc(
        0,
        -gunHeight - 62,
        24,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.strokeStyle = theme.playerGlow;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  ctx.restore();
}

function draw3DOverlay(ctx, world) {
  const theme = getTheme(world);
  const weaponLabel = getWeaponLabel(
    world,
    world.player.weapon,
  );

  ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
  ctx.fillRect(14, 14, 286, 78);
  ctx.strokeStyle =
    "rgba(148, 163, 184, 0.24)";
  ctx.strokeRect(14.5, 14.5, 285, 77);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 17px system-ui, sans-serif";
  ctx.fillText(
    `${Math.round(world.player.hp)} HP`,
    28,
    39,
  );
  ctx.fillText(
    `${Math.floor(world.player.ammo)} ${getAmmoLabel(world).toUpperCase()}`,
    126,
    39,
  );
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.fillText(weaponLabel, 28, 64);
  ctx.fillText(formatTime(world.time), 216, 64);

  ctx.fillStyle = "rgba(76, 29, 149, 0.72)";
  ctx.fillRect(
    CANVAS_WIDTH - 118,
    14,
    104,
    30,
  );
  ctx.fillStyle = "#ede9fe";
  ctx.font = "900 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "3D BETA",
    CANVAS_WIDTH - 66,
    34,
  );

  const crosshairSize = 8;
  const crosshairGap = 5;
  const crosshairY = CANVAS_HEIGHT * 0.46;

  ctx.strokeStyle = theme.playerAccent;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(
    CANVAS_WIDTH / 2 -
      crosshairGap -
      crosshairSize,
    crosshairY,
  );
  ctx.lineTo(
    CANVAS_WIDTH / 2 - crosshairGap,
    crosshairY,
  );
  ctx.moveTo(
    CANVAS_WIDTH / 2 + crosshairGap,
    crosshairY,
  );
  ctx.lineTo(
    CANVAS_WIDTH / 2 +
      crosshairGap +
      crosshairSize,
    crosshairY,
  );
  ctx.moveTo(
    CANVAS_WIDTH / 2,
    crosshairY -
      crosshairGap -
      crosshairSize,
  );
  ctx.lineTo(
    CANVAS_WIDTH / 2,
    crosshairY - crosshairGap,
  );
  ctx.moveTo(
    CANVAS_WIDTH / 2,
    crosshairY + crosshairGap,
  );
  ctx.lineTo(
    CANVAS_WIDTH / 2,
    crosshairY +
      crosshairGap +
      crosshairSize,
  );
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  if (world.messageTtl > 0 && world.message) {
    const width = Math.min(
      560,
      Math.max(
        210,
        world.message.length * 9.5,
      ),
    );
    ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
    ctx.fillRect(
      (CANVAS_WIDTH - width) / 2,
      CANVAS_HEIGHT - 68,
      width,
      40,
    );
    ctx.strokeStyle =
      "rgba(167, 139, 250, 0.46)";
    ctx.strokeRect(
      (CANVAS_WIDTH - width) / 2 + 0.5,
      CANVAS_HEIGHT - 67.5,
      width - 1,
      39,
    );
    ctx.fillStyle = "#f8fafc";
    ctx.font =
      "700 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      world.message,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT - 42,
    );
    ctx.textAlign = "left";
  }

  if (world.damageFlash > 0) {
    const flash = clamp(world.damageFlash, 0, 1);
    const damageAge = world.time - (world.lastDamageAt ?? -Infinity);
    const edgeGradient = ctx.createRadialGradient(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT * 0.46,
      90,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT * 0.46,
      CANVAS_WIDTH * 0.72,
    );

    edgeGradient.addColorStop(0, "rgba(239, 68, 68, 0)");
    edgeGradient.addColorStop(
      1,
      `rgba(127, 29, 29, ${flash * 0.76})`,
    );
    ctx.fillStyle = edgeGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (damageAge >= 0 && damageAge < 0.75) {
      const alpha = (1 - damageAge / 0.75) * flash;
      const direction = world.damageDirection ?? 0;
      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT * 0.46;
      const radius = 92;

      ctx.save();
      ctx.translate(
        centerX + Math.sin(direction) * radius,
        centerY - Math.cos(direction) * radius * 0.62,
      );
      ctx.rotate(-direction);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fecaca";
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(-10, 5);
      ctx.lineTo(0, 0);
      ctx.lineTo(10, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = flash * 0.3;
    ctx.fillStyle = "#fb7185";
    for (let drop = 0; drop < 6; drop += 1) {
      const seed = hashNoise(
        Math.floor((world.lastDamageAt ?? 0) * 100) + drop * 9,
        drop * 13,
      );
      const x = drop % 2 === 0 ? seed * 40 : CANVAS_WIDTH - seed * 40;
      const y = seed * CANVAS_HEIGHT;
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + seed * 6, 8 + seed * 11, seed, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawVignette(ctx);

  if (world.gameOver || world.victory) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
    ctx.fillRect(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    ctx.shadowBlur = 24;
    ctx.shadowColor = world.victory
      ? "#22c55e"
      : "#ef4444";
    ctx.fillStyle = world.victory
      ? "#4ade80"
      : "#fb7185";
    ctx.font =
      "800 46px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      world.victory
        ? "MAZE ESCAPED"
        : "GAME OVER",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 32,
    );
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e2e8f0";
    ctx.font =
      "18px system-ui, sans-serif";
    ctx.fillText(
      world.victory
        ? `Finished in ${formatTime(world.time)}`
        : `${getPlayerDisplayName(world)} survived ${formatTime(world.time)}`,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 10,
    );
    ctx.fillText(
      "Press N for a new maze",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 42,
    );
    ctx.textAlign = "left";
  }
}

function drawWorld3D(ctx, world) {
  ctx.clearRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );

  const rayCount = Math.ceil(
    CANVAS_WIDTH / VIEW_3D_RAY_WIDTH,
  );
  const zBuffer = new Float32Array(rayCount);
  zBuffer.fill(VIEW_3D_MAX_DISTANCE);

  const shake = clamp(world.damageKick ?? 0, 0, 1);
  const shakeX = Math.sin(world.time * 97) * shake * 9;
  const shakeY = Math.cos(world.time * 83) * shake * 6;

  ctx.save();
  ctx.translate(shakeX, shakeY);
  const projectionPlane = draw3DEnvironment(
    ctx,
    world,
    zBuffer,
  );
  draw3DSprites(
    ctx,
    world,
    zBuffer,
    projectionPlane,
  );
  draw3DWeapon(ctx, world);
  ctx.restore();

  draw3DOverlay(ctx, world);
}

function drawWorld(ctx, world) {
  if (world.viewMode === "3d") {
    drawWorld3D(ctx, world);
    return;
  }

  drawWorld2D(ctx, world);
}

function getControlsForViewMode(viewMode) {
  if (viewMode === "3d") {
    return [
      "Move: W / S",
      "Strafe: A / D",
      "Turn: mouse or ← / →",
      "Attack: left mouse, Space, or Enter",
      `Switch weapon: ${WEAPON_HOTKEY_LABEL} or click the sidebar`,
      "Use stored power-up: Z / X",
      "Power-up holder: maximum 2",
      "Toggle labels: L",
      "Minimap: M",
      "New run: N",
      "Esc: unlock mouse / choose level",
    ];
  }

  return [
    "Move: WASD or arrow keys",
    "Attack: Space, Enter, or left mouse",
    `Switch weapon: ${WEAPON_HOTKEY_LABEL} or click the sidebar`,
    "Use stored power-up: Z / X",
    "Power-up holder: maximum 2",
    "Toggle labels: L",
    "Minimap: M",
    "New run: N",
  ];
}

function setWorldViewMode(world, viewMode) {
  const normalizedViewMode =
    viewMode === "3d" ? "3d" : "2d";

  world.viewMode = normalizedViewMode;
  world.controls = getControlsForViewMode(
    normalizedViewMode,
  );
  world.pointer.down = false;
  world.pointer.inside = false;

  setMessage(
    world,
    normalizedViewMode === "3d"
      ? "3D Beta enabled"
      : "2D view enabled",
    1.4,
  );
}

function createWorld(levelKey = DEFAULT_LEVEL_KEY, viewMode = "2d", playerName = "") {
const level = LEVELS[levelKey] ?? LEVELS[DEFAULT_LEVEL_KEY];
const maze = generateMaze(level.logicalCols, level.logicalRows, level);
const world = { ...maze, levelKey: level.key, level, playerName: sanitizePlayerName(playerName), floorTiles: [], floorCount: 0, pickups: [], projectiles: [], enemies: [], effects: [], nextId: 1, time: 0, fogPulse: 0, message: "", messageTtl: 0, victory: false, gameOver: false, kills: 0, minimapOn: true, labelsOn: true, viewMode: viewMode === "3d" ? "3d" : "2d", runMode: viewMode === "3d" ? "3d" : "2d", controls: getControlsForViewMode(viewMode), pointer: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, down: false, inside: false, }, discovered: new Uint8Array(maze.width * maze.height), distanceField: new Int32Array(maze.width * maze.height), distanceTimer: 0, distanceFieldDirty: true, minimapCanvas: null, minimapDirty: true, damageFlash: 0, damageKick: 0, damageDirection: 0, lastDamageAt: -Infinity, lastFullPowerUpNoticeAt: -Infinity, audioEvents: [], vision: { sightBonus: 0, facingX: 1, facingY: 0, }, player: { x: 1.5, y: 1.5, radius: 0.24, speed: 4.1, baseMaxHp: 100, maxHp: 100, hp: 100, ammo: 26, weapon: "fists", ownedWeapons: createOwnedWeapons(), facing: 0, nextAttackAt: 0, meleeSwing: null, powerUps: {}, powerUpSlots: [null, null], discoveredFloor: 0, }, lastPlayerTile: { x: 1, y: 1 }, };

world.floorTiles = collectFloorTiles(world); world.floorCount = world.floorTiles.length;

const startTile = { x: 1, y: 1 }; const firstDistances = bfsDistances(world, startTile); const exit = farthestTile(world, firstDistances);

world.start = startTile; world.exit = exit; world.player.x = startTile.x + 0.5; world.player.y = startTile.y + 0.5; world.lastPlayerTile = { x: startTile.x, y: startTile.y };

const distancesFromStart = bfsDistances(world, startTile); const used = new Set(); used.add(indexOfTile(world.width, startTile.x, startTile.y)); used.add(indexOfTile(world.width, exit.x, exit.y));

placeProgressionItems(world, distancesFromStart, used); placePowerUps(world, distancesFromStart, used); placeEnemies(world, distancesFromStart, used); updateVisionCache(world); revealAroundPlayer(world); computeDistanceField(world);

return world; }

function MinimapPanel({ world }) {
const canvasRef = useRef(null);

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas || !world.minimapOn) {
    return;
  }

  const maxSize = 320;
  const scale = Math.max(1, Math.floor(maxSize / Math.max(world.width, world.height)));
  const mapWidth = world.width * scale;
  const mapHeight = world.height * scale;
  const ctx = canvas.getContext("2d");

  canvas.width = mapWidth;
  canvas.height = mapHeight;
  ctx.clearRect(0, 0, mapWidth, mapHeight);

  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const discovered = world.discovered[indexOfTile(world.width, x, y)] === 1;

      const theme = getTheme(world);
      if (!discovered) {
        ctx.fillStyle = theme.backdrop;
      } else if (world.grid[y][x] === WALL) {
        ctx.fillStyle = theme.wallB;
      } else {
        ctx.fillStyle = theme.floorB;
      }

      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  ctx.fillStyle = "#22c55e";
  ctx.fillRect(world.exit.x * scale, world.exit.y * scale, Math.max(2, scale), Math.max(2, scale));

  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(
    Math.floor(world.player.x) * scale,
    Math.floor(world.player.y) * scale,
    Math.max(2, scale + 1),
    Math.max(2, scale + 1),
  );
});

if (!world.minimapOn) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        background: "rgba(15, 23, 42, 0.9)",
        border: "1px solid rgba(148, 163, 184, 0.14)",
        color: "#94a3b8",
        fontSize: 13,
      }}
    >
      Minimap hidden. Press M to show it.
    </div>
  );
}

return (
  <section
    style={{
      padding: 14,
      borderRadius: 16,
      background: "rgba(15, 23, 42, 0.92)",
      border: "1px solid rgba(148, 163, 184, 0.14)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "baseline",
        marginBottom: 10,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16 }}>Minimap</h2>
      <span style={{ color: "#94a3b8", fontSize: 12 }}>
        {getDiscoveredPercent(world)}% discovered
      </span>
    </div>
    <div
      style={{
        display: "grid",
        placeItems: "center",
        width: "100%",
        overflow: "hidden",
        borderRadius: 12,
        background: "#020617",
        border: "1px solid rgba(148, 163, 184, 0.12)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          maxHeight: 320,
          objectFit: "contain",
          imageRendering: "pixelated",
        }}
      />
    </div>
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 12px",
        marginTop: 10,
        color: "#cbd5e1",
        fontSize: 12,
      }}
    >
      <span>Blue = {getPlayerDisplayName(world)}</span>
      <span>Green = Exit</span>
    </div>
  </section>
);
}

export default function App() {
const canvasRef = useRef(null);
const worldRef = useRef(createWorld(DEFAULT_LEVEL_KEY));
const keysRef = useRef({});
const frameRef = useRef(0);
const lastTimeRef = useRef(0);
const hudAccumulatorRef = useRef(0);
const recordedVictoryRef = useRef(false);
const audioRef = useRef(null);
const [audioEnabled, setAudioEnabled] = useState(true);
const [selectedLevel, setSelectedLevel] = useState(null);
const [selectionMode, setSelectionMode] = useState("2d");
const [gameMode, setGameMode] = useState("2d");
const [playerName, setPlayerName] = useState("");
const [leaderboards, setLeaderboards] = useState(() => loadLeaderboards());
const [userRanks, setUserRanks] = useState(() => createEmptyUserRanks());
const [leaderboardStatus, setLeaderboardStatus] = useState(
  GLOBAL_LEADERBOARD_ENABLED ? "connecting" : "local",
);
const [, setRevision] = useState(0);

const forceRefresh = useCallback(() => { setRevision((value) => value + 1); }, []);

const refreshGlobalLeaderboards = useCallback(async ({ silent = false } = {}) => {
  if (!GLOBAL_LEADERBOARD_ENABLED) {
    setLeaderboardStatus("local");
    return false;
  }

  if (!silent) {
    setLeaderboardStatus("connecting");
  }

  try {
    const globalState = await fetchGlobalLeaderboards();

    if (globalState) {
      setLeaderboards(globalState.leaderboards);
      setUserRanks(globalState.userRanks);
      saveLeaderboards(globalState.leaderboards);
    }

    setLeaderboardStatus("online");
    return true;
  } catch (error) {
    console.warn("Global leaderboard sync failed:", error);
    setLeaderboardStatus("offline");
    return false;
  }
}, []);

const recordLeaderboardScore = useCallback(
  (world) => {
    const completedTime = world.time;
    const levelKey = world.level.key;
    const mode = world.runMode;
    const runPlayerName = world.playerName;

    setLeaderboards((currentLeaderboards) => {
      const nextLeaderboards = addLeaderboardTime(
        currentLeaderboards,
        levelKey,
        mode,
        completedTime,
        runPlayerName,
      );
      saveLeaderboards(nextLeaderboards);
      return nextLeaderboards;
    });

    if (!GLOBAL_LEADERBOARD_ENABLED) {
      return;
    }

    void (async () => {
      try {
        const countryCode = await detectCountryCode();

        await submitGlobalLeaderboardTime(
          levelKey,
          mode,
          completedTime,
          runPlayerName,
          countryCode,
        );
        await refreshGlobalLeaderboards({ silent: true });
      } catch (error) {
        console.warn("Global leaderboard submission failed:", error);
        setLeaderboardStatus("offline");
      }
    })();
  },
  [refreshGlobalLeaderboards],
);

const getAudioEngine = useCallback(() => {
  if (!audioRef.current) {
    audioRef.current = new MazeAudioEngine();
  }

  return audioRef.current;
}, []);

const startLevelAudio = useCallback((world) => {
  const audio = getAudioEngine();
  audio.setEnabled(audioEnabled);
  audio.startMusic(world.level.themeKey);
}, [audioEnabled, getAudioEngine]);

const toggleAudio = useCallback(() => {
  const nextEnabled = !audioEnabled;
  setAudioEnabled(nextEnabled);

  const audio = getAudioEngine();
  audio.setEnabled(nextEnabled);

  if (nextEnabled && selectedLevel) {
    audio.startMusic(worldRef.current.level.themeKey);
  }
}, [audioEnabled, getAudioEngine, selectedLevel]);

const returnToLevelSelect = useCallback(() => {
  if (
    typeof document !== "undefined" &&
    document.pointerLockElement
  ) {
    document.exitPointerLock?.();
  }

  audioRef.current?.stopMusic();
  keysRef.current = {};
  setSelectedLevel(null);
}, []);

useEffect(() => {
  return () => {
    audioRef.current?.destroy();
  };
}, []);

useEffect(() => {
  if (!GLOBAL_LEADERBOARD_ENABLED) {
    return undefined;
  }

  void refreshGlobalLeaderboards();

  if (selectedLevel) {
    return undefined;
  }

  const intervalId = window.setInterval(() => {
    void refreshGlobalLeaderboards({ silent: true });
  }, 15000);

  return () => {
    window.clearInterval(intervalId);
  };
}, [refreshGlobalLeaderboards, selectedLevel]);

const startLevel = useCallback((levelKey, requestedViewMode = selectionMode, requestedPlayerName = "") => {
  const nextViewMode = requestedViewMode === "3d" ? "3d" : "2d";
  const nextPlayerName = sanitizePlayerName(requestedPlayerName);
  const nextWorld = createWorld(levelKey, nextViewMode, nextPlayerName);
  worldRef.current = nextWorld;
  startLevelAudio(nextWorld);
  keysRef.current = {};
  lastTimeRef.current = 0;
  hudAccumulatorRef.current = 0;
  recordedVictoryRef.current = false;
  setGameMode(nextViewMode);
  setSelectionMode(nextViewMode);
  setPlayerName(nextPlayerName);
  setSelectedLevel(levelKey);
  forceRefresh();
}, [forceRefresh, selectionMode, startLevelAudio]);

const resetWorld = useCallback(() => {
  if (!selectedLevel) {
    return;
  }

  const nextWorld = createWorld(selectedLevel, gameMode, playerName);
  worldRef.current = nextWorld;
  startLevelAudio(nextWorld);
  keysRef.current = {};
  lastTimeRef.current = 0;
  hudAccumulatorRef.current = 0;
  recordedVictoryRef.current = false;
  forceRefresh();
}, [forceRefresh, gameMode, playerName, selectedLevel, startLevelAudio]);

const switchGameMode = useCallback(() => {
  const nextViewMode = gameMode === "3d" ? "2d" : "3d";

  if (
    typeof document !== "undefined" &&
    document.pointerLockElement
  ) {
    document.exitPointerLock?.();
  }

  setWorldViewMode(worldRef.current, nextViewMode);
  keysRef.current = {};
  setGameMode(nextViewMode);
  setSelectionMode(nextViewMode);
  forceRefresh();
}, [forceRefresh, gameMode]);

useEffect(() => {
if (!selectedLevel) {
  return undefined;
}

const handleKeyDown = (event) => { const world = worldRef.current; const key = event.key;

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(key)) {
    event.preventDefault();
  }

  keysRef.current[key] = true;
  keysRef.current[key.toLowerCase()] = true;

  if (key === " " || key === "Enter") {
    attack(world);
  }

  if (key === "z" || key === "Z") {
    activateStoredPowerUp(world, 0);
  }

  if (key === "x" || key === "X") {
    activateStoredPowerUp(world, 1);
  }

  const directWeapon = WEAPON_HOTKEY_MAP[key];
  if (directWeapon) {
    selectWeapon(world, directWeapon);
  }

  if (key === "m" || key === "M") {
    world.minimapOn = !world.minimapOn;
    setMessage(world, world.minimapOn ? "Minimap on" : "Minimap off", 1);
  }

  if (key === "l" || key === "L") {
    toggleLabels(world);
  }

  if (key === "n" || key === "N") {
    resetWorld();
  }

  if (key === "Escape") {
    if (
      typeof document !== "undefined" &&
      document.pointerLockElement
    ) {
      return;
    }

    returnToLevelSelect();
  }
};

const handleKeyUp = (event) => {
  const key = event.key;
  keysRef.current[key] = false;
  keysRef.current[key.toLowerCase()] = false;
};

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);

return () => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
};

}, [resetWorld, returnToLevelSelect, selectedLevel]);

useEffect(() => {
if (!selectedLevel) {
  return undefined;
}

const canvas = canvasRef.current;
if (!canvas) { return undefined; }

let rect = canvas.getBoundingClientRect();

const refreshRect = () => {
  rect = canvas.getBoundingClientRect();
};

const handlePointerMove = (event) => {
  const world = worldRef.current;

  if (world.viewMode === "3d") {
    if (document.pointerLockElement === canvas) {
      world.player.facing +=
        event.movementX *
        VIEW_3D_MOUSE_SENSITIVITY;
      world.pointer.inside = false;
    }
    return;
  }

  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  world.pointer.x =
    (event.clientX - rect.left) * scaleX;
  world.pointer.y =
    (event.clientY - rect.top) * scaleY;
  world.pointer.inside = true;
};

const handlePointerDown = (event) => {
  const world = worldRef.current;

  if (world.viewMode === "3d") {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
      setMessage(
        world,
        "Mouse locked — move to look, Esc to release",
        1.8,
      );
      forceRefresh();
      return;
    }

    world.pointer.down = true;
    attack(world);
    return;
  }

  handlePointerMove(event);
  world.pointer.down = true;
  world.pointer.inside = true;
  attack(world);
};

const handlePointerUp = () => {
  worldRef.current.pointer.down = false;
};

const handlePointerLeave = () => {
  if (worldRef.current.viewMode === "2d") {
    worldRef.current.pointer.inside = false;
    worldRef.current.pointer.down = false;
  }
};

const handlePointerLockChange = () => {
  const world = worldRef.current;
  world.pointer.down = false;
  world.pointer.inside = false;

  if (world.viewMode === "3d") {
    setMessage(
      world,
      document.pointerLockElement === canvas
        ? "Mouse look active"
        : "Mouse released — click the maze to look",
      1.2,
    );
    forceRefresh();
  }
};

refreshRect();
window.addEventListener("resize", refreshRect);
document.addEventListener(
  "mousemove",
  handlePointerMove,
);
canvas.addEventListener(
  "mousedown",
  handlePointerDown,
);
window.addEventListener(
  "mouseup",
  handlePointerUp,
);
canvas.addEventListener(
  "mouseleave",
  handlePointerLeave,
);
document.addEventListener(
  "pointerlockchange",
  handlePointerLockChange,
);

return () => {
  document.removeEventListener(
    "mousemove",
    handlePointerMove,
  );
  canvas.removeEventListener(
    "mousedown",
    handlePointerDown,
  );
  window.removeEventListener(
    "mouseup",
    handlePointerUp,
  );
  window.removeEventListener(
    "resize",
    refreshRect,
  );
  canvas.removeEventListener(
    "mouseleave",
    handlePointerLeave,
  );
  document.removeEventListener(
    "pointerlockchange",
    handlePointerLockChange,
  );
};

}, [forceRefresh, gameMode, selectedLevel]);

useEffect(() => {
if (!selectedLevel) {
  return undefined;
}

const ctx = canvasRef.current?.getContext("2d");
if (!ctx) { return undefined; }

const loop = (timestamp) => {
  if (!lastTimeRef.current) {
    lastTimeRef.current = timestamp;
  }

  const dt = Math.min(0.033, (timestamp - lastTimeRef.current) / 1000);
  lastTimeRef.current = timestamp;

  const world = worldRef.current;

  if (!world.gameOver && !world.victory) {
    world.time += dt;
    world.fogPulse += dt;

    updatePowerUps(world, dt);
    updatePlayer(world, keysRef.current, dt);
    updateVisionCache(world);
    updatePickups(world, dt);

    if (world.distanceFieldDirty) {
      world.distanceTimer += dt;
      if (world.distanceTimer >= DISTANCE_FIELD_INTERVAL) {
        computeDistanceField(world);
        world.distanceTimer = 0;
      }
    }

    updateEnemies(world, dt);
    updateProjectiles(world, dt);
    revealAroundPlayer(world);

    const exitDistance = Math.hypot(
      world.player.x - (world.exit.x + 0.5),
      world.player.y - (world.exit.y + 0.5),
    );

    if (exitDistance <= world.player.radius + 0.33) {
      world.victory = true;
      queueSfx(world, "victory");
      setMessage(world, "Escape complete!", 99);

      if (!recordedVictoryRef.current) {
        recordedVictoryRef.current = true;
        recordLeaderboardScore(world);
      }
    }
  }

  if (world.audioEvents?.length) {
    const audioEvents = world.audioEvents.splice(0, world.audioEvents.length);
    audioRef.current?.playEvents(audioEvents, world.level.themeKey);
  }

  updateEffects(world, dt);

  if (world.messageTtl > 0) {
    world.messageTtl = Math.max(0, world.messageTtl - dt);
    if (world.messageTtl === 0) {
      world.message = "";
    }
  }

  drawWorld(ctx, world);

  hudAccumulatorRef.current += dt;
  if (hudAccumulatorRef.current >= HUD_REFRESH_INTERVAL) {
    hudAccumulatorRef.current = 0;
    forceRefresh();
  }

  frameRef.current = requestAnimationFrame(loop);
};

frameRef.current = requestAnimationFrame(loop);

return () => {
  cancelAnimationFrame(frameRef.current);
};

}, [forceRefresh, recordLeaderboardScore, selectedLevel]);

const legend = useMemo( () => [ { label: getPlayerDisplayName(playerName), color: "#38bdf8" }, { label: "Exit", color: "#22c55e" }, { label: "Weapon", color: "#fbbf24" }, { label: LEVELS[selectedLevel]?.themeKey === "medieval" ? "Arrows" : "Ammo", color: "#60a5fa" }, { label: "Medkit", color: "#f43f5e" }, { label: "Power-up", color: "#a78bfa" }, ], [playerName, selectedLevel], );

if (!selectedLevel) {
  return (
    <LevelSelectScreen
      onSelectLevel={startLevel}
      leaderboards={leaderboards}
      leaderboardStatus={leaderboardStatus}
      userRanks={userRanks}
      viewMode={selectionMode}
      onViewModeChange={setSelectionMode}
      initialPlayerName={playerName}
    />
  );
}

const world = worldRef.current;
const activePowerUps = getActivePowerUps(world);
const storedPowerUps = getStoredPowerUps(world);

return (
<div
  style={{
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "radial-gradient(circle at top, #0f172a 0%, #020617 50%, #000000 100%)",
    color: "#e2e8f0",
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }}
>
  <style>{`
    html, body, #root {
      margin: 0;
      width: 100%;
      min-width: 0;
      height: 100%;
      overflow: hidden;
    }

    * {
      box-sizing: border-box;
    }

    .maze-game-shell {
      width: 100vw;
      height: 100vh;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
      background: #020617;
    }

    .maze-stage {
      min-width: 0;
      min-height: 0;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #08111f;
    }

    .maze-frame {
      width: min(100%, calc(100vh * ${CANVAS_WIDTH / CANVAS_HEIGHT}));
      aspect-ratio: ${CANVAS_WIDTH} / ${CANVAS_HEIGHT};
      max-height: 100vh;
      overflow: hidden;
      background: #08111f;
      border-right: 1px solid rgba(148, 163, 184, 0.16);
    }

    .maze-frame canvas {
      width: 100%;
      height: 100%;
    }

    .maze-sidebar {
      min-width: 0;
      height: 100vh;
      overflow-y: auto;
      padding: 14px;
      display: grid;
      align-content: start;
      gap: 14px;
      background: rgba(2, 6, 23, 0.98);
      border-left: 1px solid rgba(148, 163, 184, 0.12);
      scrollbar-gutter: stable;
    }

    @media (max-width: 900px) {
      html, body, #root {
        overflow: auto;
      }

      .maze-game-shell {
        height: auto;
        min-height: 100vh;
        grid-template-columns: 1fr;
      }

      .maze-stage {
        min-height: 58vh;
      }

      .maze-frame {
        width: min(100%, calc(58vh * ${CANVAS_WIDTH / CANVAS_HEIGHT}));
        max-height: 58vh;
        border-right: 0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.16);
      }

      .maze-sidebar {
        height: auto;
        overflow: visible;
        border-left: 0;
      }
    }
  `}</style>

  <div className="maze-game-shell">
    <main className="maze-stage">
      <div className="maze-frame">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            display: "block",
            cursor: gameMode === "3d" ? "none" : "crosshair",
            imageRendering: "auto",
          }}
        />
      </div>
    </main>

    <aside className="maze-sidebar">
      <MinimapPanel world={world} />
      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
          boxShadow: "0 18px 45px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Maze Arsenal
        </h1>
        <div
          style={{
            marginTop: 8,
            color: "#38bdf8",
            fontSize: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {world.level.label} · {world.level.themeLabel} · {world.level.subtitle}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            marginTop: 10,
            padding: "6px 9px",
            borderRadius: 999,
            background: "rgba(8, 145, 178, 0.13)",
            border: "1px solid rgba(103, 232, 249, 0.42)",
            color: "#a5f3fc",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow: "0 0 24px rgba(34, 211, 238, 0.12)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: "#22d3ee",
              boxShadow: "0 0 12px #22d3ee",
            }}
          />
          {gameMode === "3d" ? "3D Raycast Beta" : GRAPHICS_VERSION}
        </div>
        <p
          style={{
            margin: "10px 0 0",
            color: "#94a3b8",
            lineHeight: 1.55,
            fontSize: 14,
          }}
        >
          Fight through a braided maze, collect weapons and power-ups, and
          reach the exit before the maze overwhelms you.
        </p>
      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Status
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 14,
          }}
        >
          <StatCard label="Health" value={`${Math.round(world.player.hp)} / ${Math.round(world.player.maxHp)}`} />
          <StatCard label={getAmmoLabel(world)} value={`${Math.floor(world.player.ammo)} / ${MAX_AMMO}`} />
          <StatCard label="Weapon" value={getWeaponLabel(world, world.player.weapon)} />
          <StatCard label="Kills" value={String(world.kills)} />
          <StatCard label="Time" value={formatTime(world.time)} />
          <StatCard label="Map" value={`${getDiscoveredPercent(world)}%`} />
          <StatCard label="Maze" value={`${world.level.logicalCols} × ${world.level.logicalRows}`} />
          <StatCard label="Theme" value={world.level.themeLabel} />
          <StatCard label="Corridor" value={`${PASSAGE_WIDTH} tiles`} />
        </div>
        <button
          type="button"
          onClick={returnToLevelSelect}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(148, 163, 184, 0.22)",
            background: "rgba(30, 41, 59, 0.82)",
            color: "#e2e8f0",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Choose another level
        </button>
        <button
          type="button"
          onClick={switchGameMode}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 12,
            border:
              gameMode === "3d"
                ? "1px solid rgba(167, 139, 250, 0.46)"
                : "1px solid rgba(56, 189, 248, 0.34)",
            background:
              gameMode === "3d"
                ? "rgba(76, 29, 149, 0.28)"
                : "rgba(8, 145, 178, 0.14)",
            color:
              gameMode === "3d"
                ? "#e9d5ff"
                : "#bae6fd",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Switch to {gameMode === "3d" ? "2D Classic" : "3D Beta"}
        </button>
        <button
          type="button"
          onClick={toggleAudio}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 12,
            border: audioEnabled
              ? "1px solid rgba(74, 222, 128, 0.35)"
              : "1px solid rgba(148, 163, 184, 0.22)",
            background: audioEnabled
              ? "rgba(22, 101, 52, 0.18)"
              : "rgba(30, 41, 59, 0.72)",
            color: audioEnabled ? "#bbf7d0" : "#94a3b8",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {audioEnabled ? "🔊" : "🔇"} {LEVEL_AUDIO_PROFILES[world.level.themeKey].title} · {audioEnabled ? "Music + SFX On" : "Muted"}
        </button>
      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Weapons
        </h2>

        <div
          style={{
            display: "grid",
            gap: 10,
            marginTop: 14,
          }}
        >
          {WEAPON_ORDER.map((weaponKey, index) => {
            const weapon = WEAPONS[weaponKey];
            const presentation = getWeaponPresentation(world, weaponKey);
            const owned = world.player.ownedWeapons[weaponKey];
            const active = world.player.weapon === weaponKey;

            return (
              <button
                key={weaponKey}
                type="button"
                disabled={!owned}
                aria-pressed={active}
                onClick={() => {
                  if (selectWeapon(worldRef.current, weaponKey)) {
                    forceRefresh();
                  }
                }}
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "36px 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: active
                    ? "rgba(30, 41, 59, 0.95)"
                    : "rgba(15, 23, 42, 0.72)",
                  border: active
                    ? "1px solid rgba(56, 189, 248, 0.45)"
                    : "1px solid rgba(148, 163, 184, 0.12)",
                  color: "inherit",
                  font: "inherit",
                  textAlign: "left",
                  cursor: owned ? "pointer" : "not-allowed",
                  opacity: owned ? 1 : 0.55,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    background:
                      weapon.type === "melee"
                        ? "rgba(249, 115, 22, 0.2)"
                        : "rgba(56, 189, 248, 0.2)",
                    color:
                      weapon.type === "melee" ? "#fdba74" : "#7dd3fc",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {index < 9 ? index + 1 : "•"}
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {presentation.label}
                  </div>
                  {owned && (
                    <>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#cbd5e1",
                          lineHeight: 1.4,
                          marginTop: 4,
                        }}
                      >
                        {presentation.description}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#94a3b8",
                          marginTop: 5,
                        }}
                      >
                        {weapon.type === "melee"
                          ? `Damage ${weapon.damage} • Cooldown ${weapon.cooldown.toFixed(2)}`
                          : `Damage ${weapon.damage} • Range ${weapon.range} • Cooldown ${weapon.cooldown.toFixed(2)}`}
                      </div>
                    </>
                  )}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: active ? "#38bdf8" : owned ? "#cbd5e1" : "#64748b",
                  }}
                >
                  {active ? "Equipped" : owned ? "Click to equip" : "Locked"}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "linear-gradient(145deg, rgba(30, 27, 75, 0.88), rgba(15, 23, 42, 0.9))",
          border: "1px solid rgba(167, 139, 250, 0.28)",
          boxShadow: "0 12px 34px rgba(76, 29, 149, 0.14)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            Power-up Holder
          </h2>
          <span style={{ color: "#c4b5fd", fontSize: 11, fontWeight: 800 }}>
            MAX 2
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 14,
          }}
        >
          {storedPowerUps.map((powerUp, index) => {
            const hotkey = index === 0 ? "Z" : "X";
            const color = powerUp?.color ?? "#64748b";

            return (
              <button
                key={hotkey}
                type="button"
                onClick={() => {
                  activateStoredPowerUp(worldRef.current, index);
                  forceRefresh();
                }}
                style={{
                  minHeight: 86,
                  padding: 12,
                  borderRadius: 14,
                  border: `1px solid ${powerUp ? `${color}88` : "rgba(148, 163, 184, 0.16)"}`,
                  background: powerUp
                    ? `linear-gradient(145deg, ${color}22, rgba(15, 23, 42, 0.92))`
                    : "rgba(15, 23, 42, 0.66)",
                  color: "#f8fafc",
                  textAlign: "left",
                  cursor: powerUp ? "pointer" : "default",
                  boxShadow: powerUp ? `0 0 22px ${color}18` : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 25,
                      height: 25,
                      borderRadius: 8,
                      background: powerUp ? `${color}33` : "rgba(100,116,139,0.14)",
                      border: `1px solid ${powerUp ? `${color}66` : "rgba(148,163,184,0.14)"}`,
                      color: powerUp ? color : "#94a3b8",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {hotkey}
                  </span>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      background: powerUp ? color : "#334155",
                      boxShadow: powerUp ? `0 0 12px ${color}` : "none",
                    }}
                  />
                </div>
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800 }}>
                  {powerUp?.label ?? "Empty slot"}
                </div>
                <div style={{ marginTop: 3, color: "#94a3b8", fontSize: 11 }}>
                  {powerUp?.short ?? `Press ${hotkey} after storing one`}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12, lineHeight: 1.45 }}>
          When both slots are full, other power-ups remain on the maze until you use one.
        </div>
      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Active Power-ups
        </h2>

        <div
          style={{
            display: "grid",
            gap: 10,
            marginTop: 14,
          }}
        >
          {activePowerUps.length > 0 ? (
            activePowerUps.map((powerUp) => (
              <div
                key={powerUp.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "rgba(15, 23, 42, 0.72)",
                  border: `1px solid ${powerUp.color}55`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: powerUp.color,
                      boxShadow: `0 0 14px ${powerUp.color}`,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {powerUp.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                      }}
                    >
                      {powerUp.short}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#e2e8f0",
                  }}
                >
                  {powerUp.remaining.toFixed(1)}s
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(15, 23, 42, 0.72)",
                border: "1px solid rgba(148, 163, 184, 0.12)",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              None active.
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Controls
        </h2>

        <ul
          style={{
            margin: "14px 0 0",
            paddingLeft: 18,
            color: "#cbd5e1",
            display: "grid",
            gap: 8,
            fontSize: 14,
            lineHeight: 1.45,
          }}
        >
          {world.controls.map((control) => (
            <li key={control}>{control}</li>
          ))}
        </ul>
      </section>

      <section
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Legend
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 14,
          }}
        >
          {legend.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 14,
                background: "rgba(15, 23, 42, 0.72)",
                border: "1px solid rgba(148, 163, 184, 0.12)",
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: item.color,
                }}
              />
              {item.label}
            </div>
          ))}
        </div>
      </section>
    </aside>
  </div>
</div>
); }


const LEVEL_PREVIEW_THEMES = {
  space: {
    background: "#020611",
    floor: "#07111f",
    floorAlt: "#0b1728",
    wall: "#31516c",
    wallDark: "#142c43",
    edge: "#67e8f9",
    glow: "#38bdf8",
  },
  jungle: {
    background: "#031008",
    floor: "#163b1f",
    floorAlt: "#1d4724",
    wall: "#405f35",
    wallDark: "#253f27",
    edge: "#a3e635",
    glow: "#4ade80",
  },
  medieval: {
    background: "#0c0907",
    floor: "#342f2b",
    floorAlt: "#3e3730",
    wall: "#70675e",
    wallDark: "#49423d",
    edge: "#fdba74",
    glow: "#f59e0b",
  },
};

function ThemedPlayerPreview({ themeKey }) {
  if (themeKey === "space") {
    return (
      <g transform="translate(57 165)">
        <path
          d="M-9 -16 L14 -6 L24 0 L14 6 L-9 16 L-5 7 L-18 11 L-14 0 L-18 -11 L-5 -7 Z"
          fill="#94a3b8"
          stroke="#e2e8f0"
          strokeWidth="2"
        />
        <ellipse cx="6" cy="0" rx="7" ry="5" fill="#22d3ee" stroke="#cffafe" strokeWidth="1.5" />
        <path d="M-15 -5 L-25 -9 L-19 -2 Z" fill="#22d3ee" opacity="0.9" />
        <path d="M-15 5 L-25 9 L-19 2 Z" fill="#22d3ee" opacity="0.9" />
        <circle cx="19" cy="0" r="2" fill="#fde047" />
      </g>
    );
  }

  if (themeKey === "jungle") {
    return (
      <g transform="translate(57 165)">
        <ellipse cx="-5" cy="0" rx="12" ry="14" fill="#78350f" stroke="#1c1917" strokeWidth="2" />
        <ellipse cx="1" cy="0" rx="13" ry="11" fill="#4d7c0f" stroke="#1c1917" strokeWidth="2" />
        <circle cx="10" cy="0" r="7" fill="#c68642" stroke="#1c1917" strokeWidth="2" />
        <ellipse cx="10" cy="0" rx="13" ry="5" fill="#a16207" stroke="#1c1917" strokeWidth="2" />
        <ellipse cx="10" cy="-1" rx="7" ry="5" fill="#ca8a04" />
        <path d="M-2 -9 L13 8" stroke="#d6b06f" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }

  return (
    <g transform="translate(57 165)">
      <ellipse cx="-3" cy="0" rx="12" ry="14" fill="#57534e" stroke="#1c1917" strokeWidth="2" />
      <path
        d="M2 -12 L14 -8 L18 0 L14 8 L2 12 L-3 0 Z"
        fill="#78716c"
        stroke="#e7e5e4"
        strokeWidth="2"
      />
      <circle cx="10" cy="0" r="8" fill="#a8a29e" stroke="#1c1917" strokeWidth="2" />
      <path d="M10 -8 L10 8" stroke="#e7e5e4" strokeWidth="2" />
      <path d="M5 -3 L15 -3" stroke="#292524" strokeWidth="2" />
      <path d="M-1 -12 L-10 0 L-1 12" fill="#7f1d1d" stroke="#fecaca" strokeWidth="1.5" />
    </g>
  );
}

function LevelPreview({ level }) {
  const theme = LEVEL_PREVIEW_THEMES[level.themeKey] ?? LEVEL_PREVIEW_THEMES.space;
  const gridLines = Array.from({ length: 9 }, (_, index) => 24 + index * 44);

  return (
    <svg
      viewBox="0 0 420 220"
      role="img"
      aria-label={`${level.label} ${level.subtitle} themed maze preview`}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        minHeight: 0,
        borderRadius: 16,
      }}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="420" height="220" fill={theme.background} />
      <rect x="16" y="16" width="388" height="188" rx="18" fill={theme.floor} />

      {gridLines.map((position) => (
        <g key={position} opacity="0.18">
          <line x1={position} y1="16" x2={position} y2="204" stroke={theme.edge} strokeWidth="1" />
          <line x1="16" y1={position / 2} x2="404" y2={position / 2} stroke={theme.edge} strokeWidth="1" />
        </g>
      ))}

      <g fill={theme.wall} stroke={theme.edge} strokeWidth="1.5">
        <rect x="16" y="16" width="388" height="22" rx="4" />
        <rect x="16" y="182" width="388" height="22" rx="4" />
        <rect x="16" y="16" width="22" height="188" rx="4" />
        <rect x="382" y="16" width="22" height="188" rx="4" />
        <rect x="92" y="38" width="22" height="103" rx="4" />
        <rect x="92" y="119" width="102" height="22" rx="4" />
        <rect x="172" y="38" width="22" height="62" rx="4" />
        <rect x="172" y="78" width="126" height="22" rx="4" />
        <rect x="276" y="78" width="22" height="84" rx="4" />
        <rect x="276" y="140" width="89" height="22" rx="4" />
        <rect x="343" y="38" width="22" height="102" rx="4" />
      </g>

      <g opacity="0.32" fill={theme.wallDark}>
        <rect x="23" y="23" width="374" height="8" rx="3" />
        <rect x="99" y="45" width="8" height="88" rx="3" />
        <rect x="179" y="45" width="8" height="47" rx="3" />
        <rect x="283" y="85" width="8" height="69" rx="3" />
        <rect x="350" y="45" width="8" height="87" rx="3" />
      </g>

      <circle cx="57" cy="165" r="27" fill={theme.glow} opacity="0.12" />
      <circle cx="57" cy="165" r="21" fill="none" stroke={theme.glow} strokeWidth="2" opacity="0.85" />
      <ThemedPlayerPreview themeKey={level.themeKey} />

      {level.themeKey === "space" && (
        <>
          <circle cx="322" cy="52" r="1.7" fill="#ffffff" opacity="0.9" />
          <circle cx="248" cy="174" r="1.2" fill="#bae6fd" opacity="0.8" />
          <circle cx="145" cy="58" r="1.3" fill="#ffffff" opacity="0.8" />
        </>
      )}

      {level.themeKey === "jungle" && (
        <>
          <circle cx="141" cy="161" r="8" fill="#166534" opacity="0.8" />
          <circle cx="154" cy="168" r="6" fill="#15803d" opacity="0.75" />
          <circle cx="322" cy="116" r="7" fill="#166534" opacity="0.8" />
        </>
      )}

      {level.themeKey === "medieval" && (
        <>
          <circle cx="145" cy="162" r="5" fill="#f59e0b" opacity="0.85" />
          <circle cx="145" cy="162" r="10" fill="#f59e0b" opacity="0.12" />
          <circle cx="326" cy="53" r="5" fill="#f59e0b" opacity="0.85" />
          <circle cx="326" cy="53" r="10" fill="#f59e0b" opacity="0.12" />
        </>
      )}
    </svg>
  );
}

function LeaderboardModeList({
  entries,
  levelKey,
  mode,
  userRank = null,
  status = "local",
}) {
  const getRankDisplay = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return String(index + 1).padStart(2, "0");
  };

  return (
    <div className="leaderboard-mode-column">
      <div className="leaderboard-mode-title">
        <span className={`leaderboard-mode-badge mode-${mode}`}>
          {mode === "3d" ? "3D" : "2D"}
        </span>
        <span>Top {LEADERBOARD_LIMIT}</span>
      </div>

      <ol className="leaderboard-list">
        {Array.from({ length: LEADERBOARD_LIMIT }, (_, index) => {
          const entry = entries[index];

          return (
            <li
              className={entry?.isCurrentUser ? "leaderboard-current-user" : ""}
              key={`${levelKey}-${mode}-${entry?.completedAt ?? index}-${index}`}
            >
              <span
                className={`leaderboard-rank ${
                  index < 3 ? "leaderboard-rank-medal" : ""
                }`}
                aria-label={`Rank ${index + 1}`}
              >
                {getRankDisplay(index)}
              </span>
              <span
                className={
                  entry
                    ? "leaderboard-name"
                    : "leaderboard-name leaderboard-empty"
                }
                title={entry?.playerName ?? ""}
              >
                {entry ? (
                  <>
                    <span
                      className="leaderboard-flag"
                      title={entry.countryCode || "Country unavailable"}
                    >
                      {countryCodeToFlag(entry.countryCode)}
                    </span>
                    <span className="leaderboard-player-name">
                      {getPlayerDisplayName(entry.playerName)}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span
                className={
                  entry
                    ? "leaderboard-time"
                    : "leaderboard-time leaderboard-empty"
                }
              >
                {entry ? formatLeaderboardTime(entry.time) : "--:--.--"}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className={`leaderboard-your-rank ${
          userRank ? "leaderboard-your-rank-active" : ""
        }`}
      >
        <span>Your global rank</span>
        <strong>
          {status === "online" && userRank?.rank
            ? `#${userRank.rank}`
            : status === "connecting"
              ? "…"
              : "—"}
        </strong>
        {status === "online" && userRank?.bestTime ? (
          <small>Best {formatLeaderboardTime(userRank.bestTime)}</small>
        ) : (
          <small>{status === "online" ? "Finish a run to rank" : "Online only"}</small>
        )}
      </div>
    </div>
  );
}

function LeaderboardPanel({
  leaderboards,
  userRanks,
  status = "local",
}) {
  const levels = Object.values(LEVELS);

  return (
    <section className="level-leaderboards" aria-labelledby="leaderboard-title">
      <div className="leaderboard-heading-row">
        <div>
          <div className="selector-kicker">
            {status === "online"
              ? "Global records"
              : status === "connecting"
                ? "Connecting to global records"
                : status === "offline"
                  ? "Cached global records"
                  : "Local records"}
          </div>
          <h2 id="leaderboard-title">Fastest escapes</h2>
        </div>
        <div className="leaderboard-limit">
          {status === "online"
            ? `Worldwide top ${LEADERBOARD_LIMIT} — separate 2D and 3D lists`
            : status === "connecting"
              ? "Loading worldwide scores…"
              : status === "offline"
                ? "Offline — showing the last cached scores"
                : `Separate top ${LEADERBOARD_LIMIT} lists for 2D and 3D`}
        </div>
      </div>

      <div className="leaderboard-grid">
        {levels.map((level) => {
          const levelBoards = normalizeLevelLeaderboards(
            leaderboards[level.key],
          );

          return (
            <article className="leaderboard-card" key={level.key}>
              <div className="leaderboard-level-title">
                <span>{level.label}</span>
                <strong>{level.subtitle}</strong>
              </div>

              <div className="leaderboard-mode-grid">
                <LeaderboardModeList
                  entries={levelBoards["2d"]}
                  levelKey={level.key}
                  mode="2d"
                  userRank={userRanks?.[level.key]?.["2d"] ?? null}
                  status={status}
                />
                <LeaderboardModeList
                  entries={levelBoards["3d"]}
                  levelKey={level.key}
                  mode="3d"
                  userRank={userRanks?.[level.key]?.["3d"] ?? null}
                  status={status}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LevelSelectScreen({
  onSelectLevel,
  leaderboards,
  leaderboardStatus = "local",
  userRanks,
  viewMode,
  onViewModeChange,
  initialPlayerName = "",
}) {
  const levels = Object.values(LEVELS);
  const [pendingLevelKey, setPendingLevelKey] = useState(null);
  const [draftPlayerName, setDraftPlayerName] = useState(
    sanitizePlayerName(initialPlayerName),
  );
  const pendingLevel = pendingLevelKey
    ? LEVELS[pendingLevelKey]
    : null;

  const openStartPrompt = (levelKey) => {
    setDraftPlayerName(sanitizePlayerName(initialPlayerName));
    setPendingLevelKey(levelKey);
  };

  const cancelStartPrompt = () => {
    setPendingLevelKey(null);
  };

  const confirmStart = (event) => {
    event?.preventDefault();

    if (!pendingLevelKey) {
      return;
    }

    onSelectLevel(
      pendingLevelKey,
      viewMode,
      sanitizePlayerName(draftPlayerName),
    );
    setPendingLevelKey(null);
  };

  return (
    <div className="level-select-screen">
      <style>{`
        html, body, #root {
          margin: 0;
          width: 100%;
          min-width: 0;
          min-height: 100%;
          background: #020617;
        }

        * {
          box-sizing: border-box;
        }

        button,
        input {
          font: inherit;
        }

        .level-select-screen {
          position: fixed;
          inset: 0;
          overflow-y: auto;
          background:
            radial-gradient(circle at 18% 0%, rgba(14, 116, 144, 0.24), transparent 34%),
            radial-gradient(circle at 82% 8%, rgba(124, 58, 237, 0.2), transparent 30%),
            linear-gradient(180deg, #07111f 0%, #020617 55%, #000 100%);
          color: #e2e8f0;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .level-select-content {
          width: 100%;
          min-height: 100vh;
          padding: clamp(22px, 4vw, 54px);
          display: grid;
          align-content: start;
          gap: clamp(24px, 4vh, 42px);
        }

        .selector-header {
          width: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
        }

        .selector-kicker {
          color: #67e8f9;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .selector-header h1,
        .leaderboard-heading-row h2 {
          margin: 7px 0 0;
          letter-spacing: -0.045em;
          color: #f8fafc;
        }

        .selector-header h1 {
          font-size: clamp(38px, 5vw, 72px);
          line-height: 0.96;
        }

        .version-beta-button {
          flex: 0 0 auto;
          min-width: 176px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(167, 139, 250, 0.35);
          background: rgba(76, 29, 149, 0.2);
          color: #e9d5ff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-weight: 850;
          cursor: pointer;
          opacity: 0.94;
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            background 160ms ease,
            box-shadow 160ms ease;
        }

        .version-beta-button:hover {
          transform: translateY(-2px);
          border-color: rgba(196, 181, 253, 0.72);
        }

        .version-beta-button.active {
          background: rgba(109, 40, 217, 0.34);
          border-color: rgba(196, 181, 253, 0.78);
          box-shadow: 0 0 30px rgba(124, 58, 237, 0.24);
          color: #f5f3ff;
        }

        .version-beta-button:focus-visible {
          outline: 3px solid #a78bfa;
          outline-offset: 4px;
        }

        .version-beta-button .beta-badge {
          padding: 4px 7px;
          border-radius: 999px;
          background: rgba(167, 139, 250, 0.18);
          border: 1px solid rgba(196, 181, 253, 0.35);
          color: #ddd6fe;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .level-choice-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: clamp(14px, 2vw, 24px);
        }

        .level-choice {
          min-width: 0;
          min-height: clamp(300px, 38vh, 410px);
          padding: 0;
          overflow: hidden;
          border-radius: 22px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.76);
          color: #f8fafc;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.24);
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease;
          display: grid;
          grid-template-rows: minmax(0, 1fr) auto;
        }

        .level-choice:hover {
          transform: translateY(-4px);
          border-color: rgba(125, 211, 252, 0.56);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.34);
        }

        .level-choice:focus-visible {
          outline: 3px solid #38bdf8;
          outline-offset: 4px;
        }

        .level-preview-wrap {
          min-height: 0;
          padding: 12px 12px 0;
        }

        .level-choice-copy {
          padding: 18px 20px 21px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.72), rgba(2, 6, 23, 0.98));
        }

        .level-choice-number {
          color: #7dd3fc;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .level-choice-name {
          margin-top: 6px;
          font-size: clamp(22px, 2.4vw, 31px);
          font-weight: 900;
          letter-spacing: -0.035em;
        }

        .level-leaderboards {
          width: 100%;
          padding: clamp(18px, 2.6vw, 28px);
          border-radius: 24px;
          background: rgba(2, 6, 23, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.16);
          box-shadow: 0 24px 72px rgba(0, 0, 0, 0.28);
        }

        .leaderboard-heading-row {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .leaderboard-heading-row h2 {
          font-size: clamp(25px, 3vw, 38px);
        }

        .leaderboard-limit {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          text-align: right;
        }

        .leaderboard-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .leaderboard-card {
          min-width: 0;
          padding: 16px;
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.13);
        }

        .leaderboard-level-title {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 7px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }

        .leaderboard-level-title span {
          color: #7dd3fc;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .leaderboard-level-title strong {
          color: #f8fafc;
          font-size: 14px;
        }

        .leaderboard-mode-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .leaderboard-mode-column {
          min-width: 0;
          padding: 10px;
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.5);
          border: 1px solid rgba(148, 163, 184, 0.09);
        }

        .leaderboard-mode-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: #64748b;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .leaderboard-mode-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 34px;
          padding: 4px 7px;
          border-radius: 999px;
          color: #e0f2fe;
          background: rgba(14, 116, 144, 0.24);
          border: 1px solid rgba(56, 189, 248, 0.28);
        }

        .leaderboard-mode-badge.mode-3d {
          color: #ede9fe;
          background: rgba(109, 40, 217, 0.24);
          border-color: rgba(167, 139, 250, 0.34);
        }

        .leaderboard-rank-medal {
          font-size: 15px;
          letter-spacing: 0;
        }

        .leaderboard-current-user {
          background: rgba(14, 165, 233, 0.12);
          border-radius: 7px;
          box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.18);
        }

        .leaderboard-name {
          display: flex;
          align-items: center;
          min-width: 0;
          gap: 5px;
        }

        .leaderboard-flag {
          flex: 0 0 auto;
          width: 18px;
          font-size: 13px;
          line-height: 1;
          text-align: center;
        }

        .leaderboard-player-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .leaderboard-your-rank {
          margin-top: 10px;
          padding: 8px 9px;
          border-radius: 9px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          background: rgba(15, 23, 42, 0.48);
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          column-gap: 8px;
          row-gap: 2px;
        }

        .leaderboard-your-rank > span {
          color: #94a3b8;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .leaderboard-your-rank > strong {
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 950;
        }

        .leaderboard-your-rank > small {
          grid-column: 1 / -1;
          color: #64748b;
          font-size: 9px;
          font-weight: 700;
        }

        .leaderboard-your-rank-active {
          border-color: rgba(56, 189, 248, 0.25);
          background: rgba(14, 116, 144, 0.12);
        }

        .leaderboard-your-rank-active > strong {
          color: #67e8f9;
        }

        .leaderboard-list {
          list-style: none;
          margin: 8px 0 0;
          padding: 0;
          display: grid;
        }

        .leaderboard-list li {
          min-width: 0;
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          gap: 6px;
          align-items: center;
          min-height: 28px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.08);
          font-variant-numeric: tabular-nums;
        }

        .leaderboard-list li:last-child {
          border-bottom: 0;
        }

        .leaderboard-rank {
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .leaderboard-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 750;
        }

        .leaderboard-time {
          justify-self: end;
          color: #f8fafc;
          font-size: 11px;
          font-weight: 850;
        }

        .leaderboard-empty {
          color: #475569;
        }

        .name-prompt-backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(2, 6, 23, 0.82);
          backdrop-filter: blur(10px);
        }

        .name-prompt-card {
          width: min(100%, 480px);
          padding: clamp(22px, 4vw, 30px);
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(124, 58, 237, 0.2), transparent 38%),
            #08111f;
          border: 1px solid rgba(148, 163, 184, 0.2);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
        }

        .name-prompt-card h2 {
          margin: 8px 0 8px;
          color: #f8fafc;
          font-size: clamp(27px, 4vw, 38px);
          letter-spacing: -0.04em;
        }

        .name-prompt-description {
          margin: 0 0 20px;
          color: #94a3b8;
          font-size: 14px;
          line-height: 1.55;
        }

        .name-prompt-mode {
          display: inline-flex;
          margin-bottom: 14px;
          padding: 5px 9px;
          border-radius: 999px;
          background: rgba(14, 116, 144, 0.18);
          border: 1px solid rgba(56, 189, 248, 0.22);
          color: #bae6fd;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .name-prompt-mode.mode-3d {
          background: rgba(109, 40, 217, 0.2);
          border-color: rgba(167, 139, 250, 0.28);
          color: #ddd6fe;
        }

        .name-prompt-label {
          display: grid;
          gap: 8px;
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .name-prompt-input {
          width: 100%;
          padding: 14px 15px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background: rgba(2, 6, 23, 0.82);
          color: #f8fafc;
          outline: none;
          text-transform: none;
          letter-spacing: normal;
          font-size: 16px;
          font-weight: 700;
        }

        .name-prompt-input::placeholder {
          color: #475569;
          font-weight: 600;
        }

        .name-prompt-input:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.12);
        }

        .name-prompt-helper {
          margin-top: 8px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.45;
        }

        .name-prompt-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }

        .name-prompt-button {
          padding: 11px 16px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          font-weight: 850;
          cursor: pointer;
        }

        .name-prompt-button.secondary {
          background: rgba(15, 23, 42, 0.72);
          color: #cbd5e1;
        }

        .name-prompt-button.primary {
          border-color: rgba(56, 189, 248, 0.35);
          background: linear-gradient(135deg, #0e7490, #2563eb);
          color: white;
          box-shadow: 0 12px 28px rgba(14, 116, 144, 0.2);
        }

        .name-prompt-button:hover {
          filter: brightness(1.08);
        }

        .name-prompt-button:focus-visible {
          outline: 3px solid #38bdf8;
          outline-offset: 3px;
        }

        @media (max-width: 1180px) {
          .leaderboard-grid {
            grid-template-columns: 1fr;
          }

          .leaderboard-mode-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .selector-header {
            align-items: flex-start;
          }

          .level-choice-grid {
            grid-template-columns: 1fr;
          }

          .level-choice {
            min-height: 340px;
          }
        }

        @media (max-width: 620px) {
          .level-select-content {
            padding: 18px;
          }

          .selector-header {
            display: grid;
          }

          .version-beta-button {
            width: 100%;
          }

          .level-choice {
            min-height: 300px;
          }

          .leaderboard-heading-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .leaderboard-limit {
            text-align: left;
          }

          .leaderboard-mode-grid {
            grid-template-columns: 1fr;
          }

          .name-prompt-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      <main className="level-select-content">
        <header className="selector-header">
          <div>
            <div className="selector-kicker">Maze Arsenal</div>
            <h1>Choose your level</h1>
          </div>

          <button
            type="button"
            className={`version-beta-button${viewMode === "3d" ? " active" : ""}`}
            aria-pressed={viewMode === "3d"}
            title={
              viewMode === "3d"
                ? "3D Beta selected. Click to return to 2D."
                : "Select the playable 3D Beta, then choose a level."
            }
            onClick={() =>
              onViewModeChange(
                viewMode === "3d" ? "2d" : "3d",
              )
            }
          >
            <span>
              {viewMode === "3d"
                ? "3D Version On"
                : "3D Version"}
            </span>
            <span className="beta-badge">Beta</span>
          </button>
        </header>

        <section className="level-choice-grid" aria-label="Level selection">
          {levels.map((level) => (
            <button
              key={level.key}
              type="button"
              className="level-choice"
              onClick={() => openStartPrompt(level.key)}
            >
              <div className="level-preview-wrap">
                <LevelPreview level={level} />
              </div>
              <div className="level-choice-copy">
                <div className="level-choice-number">{level.label}</div>
                <div className="level-choice-name">{level.subtitle}</div>
              </div>
            </button>
          ))}
        </section>

        <LeaderboardPanel
          leaderboards={leaderboards}
          userRanks={userRanks}
          status={leaderboardStatus}
        />
      </main>

      {pendingLevel && (
        <div
          className="name-prompt-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelStartPrompt();
            }
          }}
        >
          <form
            className="name-prompt-card"
            onSubmit={confirmStart}
            role="dialog"
            aria-modal="true"
            aria-labelledby="name-prompt-title"
          >
            <div className="selector-kicker">Ready to escape?</div>
            <h2 id="name-prompt-title">
              {pendingLevel.label}: {pendingLevel.subtitle}
            </h2>
            <div
              className={`name-prompt-mode${
                viewMode === "3d" ? " mode-3d" : ""
              }`}
            >
              {viewMode === "3d" ? "3D leaderboard" : "2D leaderboard"}
            </div>
            <p className="name-prompt-description">
              Enter a name for the leaderboard, or leave it blank to play as
              “You”.
            </p>

            <label className="name-prompt-label">
              Player name — optional
              <input
                className="name-prompt-input"
                type="text"
                value={draftPlayerName}
                maxLength={PLAYER_NAME_LIMIT}
                autoFocus
                autoComplete="nickname"
                placeholder="Leave blank to use You"
                onChange={(event) =>
                  setDraftPlayerName(event.target.value)
                }
              />
            </label>
            <div className="name-prompt-helper">
              Your result will be saved to this level’s separate{" "}
              {viewMode === "3d" ? "3D" : "2D"} top-ten leaderboard.
            </div>

            <div className="name-prompt-actions">
              <button
                type="button"
                className="name-prompt-button secondary"
                onClick={cancelStartPrompt}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="name-prompt-button primary"
              >
                Start as {getPlayerDisplayName(draftPlayerName)}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) { return ( <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(15, 23, 42, 0.72)", border: "1px solid rgba(148, 163, 184, 0.12)", }} > <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 6, }} > {label} </div> <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", }} > {value}</div> </div> ); }
