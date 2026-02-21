/**
 * Gapless audio looper using two expo-av Sound instances.
 * Crossfades between them near the end of each loop.
 */
import { Audio } from 'expo-av';

const CROSSFADE_MS = 2000; // Start crossfade 2s before end
const CHECK_INTERVAL_MS = 500;

export class LoopPlayer {
  private players: [Audio.Sound | null, Audio.Sound | null] = [null, null];
  private active = 0; // Which player is currently active (0 or 1)
  private asset: any;
  private volume = 0;
  private playing = false;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private durationMs = 0;

  constructor(asset: any) {
    this.asset = asset;
  }

  async init(): Promise<void> {
    for (let i = 0; i < 2; i++) {
      const { sound } = await Audio.Sound.createAsync(this.asset, {
        isLooping: false, // We manage looping ourselves
        volume: 0,
        shouldPlay: false,
      });
      this.players[i] = sound;
    }
    // Get duration from first player
    const status = await this.players[0]?.getStatusAsync();
    if (status?.isLoaded && status.durationMillis) {
      this.durationMs = status.durationMillis;
    }
  }

  async play(volume: number): Promise<void> {
    this.volume = volume;
    if (this.playing) {
      // Just update volume
      await this.players[this.active]?.setVolumeAsync(volume);
      return;
    }
    this.playing = true;
    const player = this.players[this.active];
    if (!player) return;
    await player.setPositionAsync(0);
    await player.setVolumeAsync(volume);
    await player.playAsync();

    // Start monitoring for crossfade
    this.startMonitor();
  }

  private startMonitor(): void {
    if (this.checkTimer) return;
    this.checkTimer = setInterval(() => this.checkCrossfade(), CHECK_INTERVAL_MS);
  }

  private stopMonitor(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  private async checkCrossfade(): Promise<void> {
    if (!this.playing) return;
    const current = this.players[this.active];
    if (!current) return;

    try {
      const status = await current.getStatusAsync();
      if (!status.isLoaded) return;

      const pos = status.positionMillis;
      const dur = status.durationMillis || this.durationMs;
      if (!dur) return;

      const remaining = dur - pos;

      if (remaining <= CROSSFADE_MS && remaining > 0) {
        // Start the next player
        const nextIdx = this.active === 0 ? 1 : 0;
        const next = this.players[nextIdx];
        if (!next) return;

        const nextStatus = await next.getStatusAsync();
        if (!nextStatus.isLoaded) return;
        if (nextStatus.isPlaying) return; // Already crossfading

        await next.setPositionAsync(0);
        await next.setVolumeAsync(0);
        await next.playAsync();

        // Fade over remaining time
        const steps = 10;
        const stepMs = remaining / steps;
        for (let i = 1; i <= steps; i++) {
          setTimeout(async () => {
            try {
              const frac = i / steps;
              await next.setVolumeAsync(this.volume * frac);
              await current.setVolumeAsync(this.volume * (1 - frac));
              if (i === steps) {
                await current.stopAsync();
                await current.setPositionAsync(0);
                this.active = nextIdx;
              }
            } catch {}
          }, stepMs * i);
        }
      }
    } catch {}
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = volume;
    if (this.playing) {
      await this.players[this.active]?.setVolumeAsync(volume);
    }
  }

  async pause(): Promise<void> {
    if (!this.playing) return;
    this.stopMonitor();
    for (const p of this.players) {
      try {
        const s = await p?.getStatusAsync();
        if (s?.isLoaded && s.isPlaying) await p?.pauseAsync();
      } catch {}
    }
  }

  async resume(): Promise<void> {
    if (!this.playing) return;
    await this.players[this.active]?.playAsync();
    this.startMonitor();
  }

  async stop(): Promise<void> {
    this.playing = false;
    this.stopMonitor();
    for (const p of this.players) {
      try {
        await p?.stopAsync();
        await p?.setPositionAsync(0);
      } catch {}
    }
  }

  async destroy(): Promise<void> {
    await this.stop();
    for (const p of this.players) {
      try { await p?.unloadAsync(); } catch {}
    }
    this.players = [null, null];
  }

  isPlaying(): boolean {
    return this.playing;
  }
}
