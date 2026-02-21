/**
 * Procedural noise using AudioBufferSourceNode (looping).
 * Generates a buffer once, loops it seamlessly. 
 * Uses only well-supported Web Audio API nodes — no ScriptProcessorNode.
 * AudioContext MUST be created inside a user gesture (tap) on iOS.
 */

import { Platform } from 'react-native';

type NoiseType = 'brown' | 'rain' | 'ocean' | 'forest' | 'bowl';

let sharedCtx: AudioContext | null = null;

/** Call this synchronously inside a tap/click handler to unlock iOS audio */
export function unlockAudio(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  if (!sharedCtx) {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    sharedCtx = new C();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume();
  }
  return sharedCtx;
}

function getCtx(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  return sharedCtx;
}

// Buffer duration in seconds — longer = more natural variation
const BUFFER_SECS = 30;

function generateBrownBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = sr * BUFFER_SECS;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let v = 0;
  for (let i = 0; i < len; i++) {
    v += (Math.random() * 2 - 1) * 0.02;
    v *= 0.998;
    data[i] = v;
  }
  // Crossfade last 0.5s with first 0.5s for seamless loop
  const fade = Math.floor(sr * 0.5);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    data[len - fade + i] = data[len - fade + i] * (1 - t) + data[i] * t;
  }
  return buf;
}

function generateRainBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = sr * BUFFER_SECS;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let env = 0.5, target = 0.5, timer = 0;
  for (let i = 0; i < len; i++) {
    timer++;
    if (timer > sr * (2 + Math.random() * 3)) {
      target = 0.3 + Math.random() * 0.4;
      timer = 0;
    }
    env += (target - env) * 0.00001;
    data[i] = (Math.random() * 2 - 1) * env * 0.3;
  }
  // Low-pass by averaging
  for (let i = len - 1; i > 0; i--) {
    data[i] = data[i] * 0.7 + data[i - 1] * 0.3;
  }
  // Crossfade
  const fade = Math.floor(sr * 0.5);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    data[len - fade + i] = data[len - fade + i] * (1 - t) + data[i] * t;
  }
  return buf;
}

function generateOceanBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = sr * BUFFER_SECS;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    phase += 1 / sr;
    const wave = Math.sin(phase * Math.PI * 2 / 8) * 0.3 + 0.5;
    const wave2 = Math.sin(phase * Math.PI * 2 / 12 + 1.3) * 0.15 + 0.5;
    data[i] = (Math.random() * 2 - 1) * wave * wave2 * 0.25;
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = len - 1; i > 0; i--) {
      data[i] = data[i] * 0.6 + data[i - 1] * 0.4;
    }
  }
  const fade = Math.floor(sr * 0.5);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    data[len - fade + i] = data[len - fade + i] * (1 - t) + data[i] * t;
  }
  return buf;
}

function generateForestBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = sr * BUFFER_SECS;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let env = 0.3, target = 0.3, timer = 0;
  let birdTimer = 0, birdFreq = 0, birdPhase = 0, birdAmp = 0;
  for (let i = 0; i < len; i++) {
    timer++;
    if (timer > sr * (3 + Math.random() * 5)) {
      target = 0.15 + Math.random() * 0.25;
      timer = 0;
    }
    env += (target - env) * 0.000005;
    let s = (Math.random() * 2 - 1) * env * 0.15;
    birdTimer++;
    if (birdTimer > sr * (4 + Math.random() * 8) && birdAmp <= 0.001) {
      birdFreq = 2000 + Math.random() * 3000;
      birdAmp = 0.02 + Math.random() * 0.03;
      birdTimer = 0;
    }
    if (birdAmp > 0.001) {
      birdPhase += birdFreq / sr;
      s += Math.sin(birdPhase * Math.PI * 2 + Math.sin(birdPhase * 12) * 2) * birdAmp;
      birdAmp *= 0.9997;
    }
    data[i] = s;
  }
  for (let i = len - 1; i > 0; i--) {
    data[i] = data[i] * 0.8 + data[i - 1] * 0.2;
  }
  const fade = Math.floor(sr * 0.5);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    data[len - fade + i] = data[len - fade + i] * (1 - t) + data[i] * t;
  }
  return buf;
}

function generateBowlBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = sr * BUFFER_SECS;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const freqs = [220, 220.5, 440, 441.2, 660, 880.7];
  const amps = [0.3, 0.28, 0.15, 0.14, 0.08, 0.05];
  const phases = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let j = 0; j < freqs.length; j++) {
      phases[j] += freqs[j] / sr;
      s += Math.sin(phases[j] * Math.PI * 2) * amps[j];
    }
    const wobble = 0.9 + Math.sin(phases[0] * Math.PI * 2 * 0.1) * 0.1;
    data[i] = s * wobble * 0.15;
  }
  const fade = Math.floor(sr * 0.5);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    data[len - fade + i] = data[len - fade + i] * (1 - t) + data[i] * t;
  }
  return buf;
}

const generators: Record<NoiseType, (ctx: AudioContext) => AudioBuffer> = {
  brown: generateBrownBuffer,
  rain: generateRainBuffer,
  ocean: generateOceanBuffer,
  forest: generateForestBuffer,
  bowl: generateBowlBuffer,
};

export class WebNoise {
  private type: NoiseType;
  private gainNode: GainNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private _playing = false;

  constructor(type: NoiseType) {
    this.type = type;
  }

  /** Generate the buffer. Call after unlockAudio(). */
  async init(): Promise<void> {
    const ctx = getCtx();
    if (!ctx) return;
    this.buffer = generators[this.type](ctx);
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(ctx.destination);
  }

  play(volume: number): void {
    const ctx = getCtx();
    if (!ctx || !this.buffer || !this.gainNode) return;

    if (this._playing) {
      // Just update volume
      this.gainNode.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
      return;
    }

    // Create new source (they're one-shot, can't restart)
    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = this.buffer;
    this.sourceNode.loop = true;
    this.sourceNode.connect(this.gainNode);
    this.gainNode.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    this.sourceNode.start(0);
    this._playing = true;
  }

  stop(): void {
    const ctx = getCtx();
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch {}
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    if (this.gainNode && ctx) {
      this.gainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
    }
    this._playing = false;
  }

  pause(): void {
    const ctx = getCtx();
    if (!this._playing || !this.gainNode || !ctx) return;
    this.gainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  }

  resume(volume: number): void {
    const ctx = getCtx();
    if (!this._playing || !this.gainNode || !ctx) return;
    this.gainNode.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
  }

  setVolume(volume: number): void {
    const ctx = getCtx();
    if (this.gainNode && ctx) {
      this.gainNode.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    }
  }

  destroy(): void {
    this.stop();
    if (this.gainNode) {
      try { this.gainNode.disconnect(); } catch {}
      this.gainNode = null;
    }
    this.buffer = null;
  }

  isPlaying(): boolean {
    return this._playing;
  }
}
