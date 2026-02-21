/**
 * Real-time procedural noise generator using Web Audio API.
 * Generates audio on-the-fly — no files, no loops, no gaps.
 * Works on web. Falls back to expo-av file looping on native.
 */

import { Platform } from 'react-native';

type NoiseType = 'brown' | 'rain' | 'ocean' | 'forest' | 'bowl';

let sharedContext: AudioContext | null = null;

/** Must be called from a direct user-gesture handler (tap/click) for iOS Safari */
export function warmAudioContext(): void {
  if (Platform.OS !== 'web') return;
  if (!sharedContext) {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    sharedContext = new Ctx() as AudioContext;
  }
  if (sharedContext.state === 'suspended') {
    sharedContext.resume();
  }
  // Play a silent buffer to fully unlock audio on iOS
  try {
    const buf = sharedContext.createBuffer(1, 1, 22050);
    const src = sharedContext.createBufferSource();
    src.buffer = buf;
    src.connect(sharedContext.destination);
    src.start(0);
  } catch {}
}

function getContext(): AudioContext {
  if (!sharedContext) {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    sharedContext = new Ctx() as AudioContext;
  }
  return sharedContext!;
}

export class NoiseGenerator {
  private context: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  private _playing = false;
  private _paused = false;
  private type: NoiseType;

  // Brown noise state
  private brownValue = 0;

  // Ocean state
  private oceanPhase = 0;

  // Rain state  
  private rainEnvelope = 0.5;
  private rainTarget = 0.5;
  private rainTimer = 0;

  // Forest state
  private forestEnvelope = 0.3;
  private forestTarget = 0.3;
  private forestTimer = 0;
  private birdTimer = 0;
  private birdFreq = 0;
  private birdPhase = 0;
  private birdAmp = 0;

  // Bowl state
  private bowlPhases: number[] = [0, 0, 0, 0, 0, 0];

  constructor(type: NoiseType) {
    this.type = type;
  }

  async init(): Promise<void> {
    // No-op — context creation moved to play() for iOS gesture requirement
  }

  private ensureContext(): boolean {
    if (Platform.OS !== 'web') return false;
    if (!this.context) {
      this.context = getContext();
    }
    if (!this.gainNode) {
      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = 0;
      this.gainNode.connect(this.context.destination);
    }
    // Resume if suspended (iOS requires this inside a user gesture)
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
    return true;
  }

  play(volume: number): void {
    if (!this.ensureContext()) return;
    if (!this.context || !this.gainNode) return;

    if (this._playing && this._paused) {
      // Resume from pause
      this._paused = false;
      this.gainNode.gain.setTargetAtTime(volume, this.context.currentTime, 0.05);
      return;
    }

    if (this._playing) {
      // Just update volume
      this.gainNode.gain.setTargetAtTime(volume, this.context.currentTime, 0.05);
      return;
    }

    // Create processor
    const bufferSize = 4096;
    this.scriptNode = this.context.createScriptProcessor(bufferSize, 0, 1);
    this.scriptNode.onaudioprocess = (e) => this.generate(e);
    this.scriptNode.connect(this.gainNode);

    this.gainNode.gain.setTargetAtTime(volume, this.context.currentTime, 0.05);
    this._playing = true;
    this._paused = false;
  }

  private generate(e: AudioProcessingEvent): void {
    const output = e.outputBuffer.getChannelData(0);
    const len = output.length;

    switch (this.type) {
      case 'brown':
        this.generateBrown(output, len);
        break;
      case 'rain':
        this.generateRain(output, len);
        break;
      case 'ocean':
        this.generateOcean(output, len);
        break;
      case 'forest':
        this.generateForest(output, len);
        break;
      case 'bowl':
        this.generateBowl(output, len);
        break;
    }
  }

  private generateBrown(output: Float32Array, len: number): void {
    for (let i = 0; i < len; i++) {
      this.brownValue += (Math.random() * 2 - 1) * 0.02;
      this.brownValue *= 0.998; // Prevent drift
      output[i] = this.brownValue;
    }
  }

  private generateRain(output: Float32Array, len: number): void {
    // White noise with gentle amplitude modulation (gusts)
    for (let i = 0; i < len; i++) {
      this.rainTimer++;
      if (this.rainTimer > 44100 * (2 + Math.random() * 3)) {
        this.rainTarget = 0.3 + Math.random() * 0.4;
        this.rainTimer = 0;
      }
      // Smooth envelope
      this.rainEnvelope += (this.rainTarget - this.rainEnvelope) * 0.00001;
      
      // Shaped white noise (slight low-pass for rain texture)
      const white = Math.random() * 2 - 1;
      output[i] = white * this.rainEnvelope * 0.3;
    }
    // Simple low-pass by averaging adjacent samples
    for (let i = len - 1; i > 0; i--) {
      output[i] = output[i] * 0.7 + output[i - 1] * 0.3;
    }
  }

  private generateOcean(output: Float32Array, len: number): void {
    // Pink-ish noise with slow wave-like amplitude modulation
    for (let i = 0; i < len; i++) {
      this.oceanPhase += 1 / 44100;
      // Slow wave envelope (8-second cycle)
      const wave = Math.sin(this.oceanPhase * Math.PI * 2 / 8) * 0.3 + 0.5;
      // Layered wave (12-second cycle)
      const wave2 = Math.sin(this.oceanPhase * Math.PI * 2 / 12 + 1.3) * 0.15 + 0.5;
      const envelope = wave * wave2;

      const white = Math.random() * 2 - 1;
      output[i] = white * envelope * 0.25;
    }
    // Heavier low-pass for ocean depth
    for (let pass = 0; pass < 3; pass++) {
      for (let i = len - 1; i > 0; i--) {
        output[i] = output[i] * 0.6 + output[i - 1] * 0.4;
      }
    }
  }

  private generateForest(output: Float32Array, len: number): void {
    for (let i = 0; i < len; i++) {
      this.forestTimer++;
      if (this.forestTimer > 44100 * (3 + Math.random() * 5)) {
        this.forestTarget = 0.15 + Math.random() * 0.25;
        this.forestTimer = 0;
      }
      this.forestEnvelope += (this.forestTarget - this.forestEnvelope) * 0.000005;

      // Very gentle wind noise
      let sample = (Math.random() * 2 - 1) * this.forestEnvelope * 0.15;

      // Occasional bird-like chirps
      this.birdTimer++;
      if (this.birdTimer > 44100 * (4 + Math.random() * 8) && this.birdAmp <= 0.001) {
        this.birdFreq = 2000 + Math.random() * 3000;
        this.birdAmp = 0.02 + Math.random() * 0.03;
        this.birdTimer = 0;
      }
      if (this.birdAmp > 0.001) {
        this.birdPhase += this.birdFreq / 44100;
        // Frequency warble
        const warble = Math.sin(this.birdPhase * Math.PI * 2 + Math.sin(this.birdPhase * 12) * 2);
        sample += warble * this.birdAmp;
        this.birdAmp *= 0.9997; // Decay
      }

      output[i] = sample;
    }
    // Gentle low-pass
    for (let i = len - 1; i > 0; i--) {
      output[i] = output[i] * 0.8 + output[i - 1] * 0.2;
    }
  }

  private generateBowl(output: Float32Array, len: number): void {
    // Singing bowl: layered detuned sine waves with slow beating
    const freqs = [220, 220.5, 440, 441.2, 660, 880.7];
    const amps = [0.3, 0.28, 0.15, 0.14, 0.08, 0.05];

    for (let i = 0; i < len; i++) {
      let sample = 0;
      for (let j = 0; j < freqs.length; j++) {
        this.bowlPhases[j] += freqs[j] / 44100;
        sample += Math.sin(this.bowlPhases[j] * Math.PI * 2) * amps[j];
      }
      // Gentle amplitude wobble
      const wobble = 0.9 + Math.sin(this.bowlPhases[0] * Math.PI * 2 * 0.1) * 0.1;
      output[i] = sample * wobble * 0.15;
    }
  }

  stop(): void {
    if (this.scriptNode) {
      try { this.scriptNode.disconnect(); } catch {}
      this.scriptNode = null;
    }
    if (this.gainNode && this.context) {
      this.gainNode.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
    }
    this._playing = false;
    this._paused = false;
    // Reset state
    this.brownValue = 0;
    this.oceanPhase = 0;
  }

  pause(): void {
    if (!this._playing || this._paused) return;
    this._paused = true;
    if (this.gainNode && this.context) {
      this.gainNode.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
    }
  }

  resume(): void {
    // Handled in play()
  }

  setVolume(volume: number): void {
    if (this.gainNode && this.context) {
      this.gainNode.gain.setTargetAtTime(volume, this.context.currentTime, 0.05);
    }
  }

  isPlaying(): boolean {
    return this._playing && !this._paused;
  }

  destroy(): void {
    this.stop();
    this.gainNode?.disconnect();
    this.gainNode = null;
  }
}
