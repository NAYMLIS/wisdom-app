import { Audio } from 'expo-av';

export class SeamlessLooper {
  private soundA: Audio.Sound;
  private soundB: Audio.Sound;
  private activeSound: 'A' | 'B' = 'A';
  private playing = false;
  private paused = false;
  private volume = 1;
  private duration = 0;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private asset: number;
  private loaded = false;

  constructor() {
    this.soundA = new Audio.Sound();
    this.soundB = new Audio.Sound();
    this.asset = 0;
  }

  async load(asset: number): Promise<void> {
    this.asset = asset;
    await this.soundA.loadAsync(asset);
    await this.soundB.loadAsync(asset);
    // Don't set looping - we manage it manually
    const status = await this.soundA.getStatusAsync();
    if (status.isLoaded) {
      this.duration = status.durationMillis || 0;
    }
    this.loaded = true;
  }

  async play(volume: number): Promise<void> {
    if (!this.loaded) return;
    this.volume = volume;
    this.playing = true;
    this.paused = false;

    const active = this.activeSound === 'A' ? this.soundA : this.soundB;
    await active.setVolumeAsync(volume);
    await active.setPositionAsync(0);
    await active.playAsync();

    this.startMonitoring();
  }

  private startMonitoring() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    // Check every 100ms if we need to crossfade
    const CROSSFADE_MS = 500; // Start crossfade 500ms before end

    this.checkInterval = setInterval(async () => {
      if (!this.playing || this.paused) return;

      try {
        const active = this.activeSound === 'A' ? this.soundA : this.soundB;
        const next = this.activeSound === 'A' ? this.soundB : this.soundA;
        const status = await active.getStatusAsync();

        if (!status.isLoaded || !status.isPlaying) return;

        const remaining = (status.durationMillis || 0) - (status.positionMillis || 0);

        if (remaining <= CROSSFADE_MS && remaining > 0) {
          // Start crossfade to next buffer
          await next.setPositionAsync(0);
          await next.setVolumeAsync(this.volume);
          await next.playAsync();

          // Fade out current over the remaining time
          const steps = 5;
          const stepTime = remaining / steps;
          for (let i = 1; i <= steps; i++) {
            setTimeout(async () => {
              try {
                const fadeVol = this.volume * (1 - i / steps);
                await active.setVolumeAsync(Math.max(0, fadeVol));
                if (i === steps) {
                  await active.stopAsync();
                  await active.setPositionAsync(0);
                }
              } catch {}
            }, stepTime * i);
          }

          // Switch active
          this.activeSound = this.activeSound === 'A' ? 'B' : 'A';
        }
      } catch {}
    }, 100);
  }

  async stop(): Promise<void> {
    this.playing = false;
    this.paused = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    try {
      await this.soundA.stopAsync();
    } catch {}
    try {
      await this.soundB.stopAsync();
    } catch {}
  }

  async pause(): Promise<void> {
    if (!this.playing) return;
    this.paused = true;
    try {
      await this.soundA.pauseAsync();
    } catch {}
    try {
      await this.soundB.pauseAsync();
    } catch {}
  }

  async resume(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;
    const active = this.activeSound === 'A' ? this.soundA : this.soundB;
    try {
      await active.playAsync();
    } catch {}
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = volume;
    const active = this.activeSound === 'A' ? this.soundA : this.soundB;
    try {
      await active.setVolumeAsync(volume);
    } catch {}
  }

  isPlaying(): boolean {
    return this.playing && !this.paused;
  }

  async unload(): Promise<void> {
    await this.stop();
    try {
      await this.soundA.unloadAsync();
    } catch {}
    try {
      await this.soundB.unloadAsync();
    } catch {}
  }
}
