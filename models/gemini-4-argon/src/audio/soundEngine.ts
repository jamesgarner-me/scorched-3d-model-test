/**
 * Self-contained Web Audio API procedural sound synthesiser.
 * Generates artillery firing, shell flight whistle, water splash, land crater explosion,
 * and match-ending tank destruction sounds with zero external asset dependencies.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private volume = 0.65;
  private flightOsc: OscillatorNode | null = null;
  private flightGain: GainNode | null = null;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') {
      return null;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopFlightWhistle();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  getVolume(): number {
    return this.volume;
  }

  playFire(power: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.45 * this.volume, now);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    master.connect(ctx.destination);

    // Cannon punch oscillator
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const startFreq = 130 + (power / 100) * 65;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.35);
    osc.connect(master);
    osc.start(now);
    osc.stop(now + 0.42);

    // Short burst of white noise for muzzle blast
    this.playNoiseBurst(ctx, 0.24, 900, 0.32 * this.volume);
  }

  startFlightWhistle(): void {
    this.stopFlightWhistle();
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.linearRampToValueAtTime(280, now + 3.5);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.08 * this.volume, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);

      this.flightOsc = osc;
      this.flightGain = gain;
    } catch {
      // Ignore audio errors
    }
  }

  stopFlightWhistle(): void {
    if (this.flightOsc) {
      try {
        this.flightOsc.stop();
        this.flightOsc.disconnect();
      } catch {
        // Ignore if already stopped
      }
      this.flightOsc = null;
    }
    if (this.flightGain) {
      try {
        this.flightGain.disconnect();
      } catch {
        // Ignore
      }
      this.flightGain = null;
    }
  }

  playImpact(isWater: boolean, directHit: boolean): void {
    this.stopFlightWhistle();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (isWater) {
      // Water splash: higher-band filtered noise + bubble pitch drop
      this.playNoiseBurst(ctx, 0.55, 1400, 0.35 * this.volume);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);
      gain.gain.setValueAtTime(0.2 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
      return;
    }

    // Ground crater explosion
    const duration = directHit ? 0.85 : 0.6;
    this.playNoiseBurst(ctx, duration, 550, (directHit ? 0.55 : 0.4) * this.volume);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(directHit ? 95 : 75, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + duration);
    subGain.gain.setValueAtTime(0.45 * this.volume, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + duration);
  }

  playDestructionSequence(): void {
    this.stopFlightWhistle();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Multi-stage catastrophic explosion rumble
    this.playNoiseBurst(ctx, 1.6, 420, 0.65 * this.volume);

    const freqs = [110, 68, 45];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const offset = idx * 0.18;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + offset);
      osc.frequency.exponentialRampToValueAtTime(18, now + offset + 1.2);
      gain.gain.setValueAtTime(0.35 * this.volume, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 1.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 1.3);
    });
  }

  private playNoiseBurst(
    ctx: AudioContext,
    duration: number,
    cutoffHz: number,
    peakGain: number,
  ): void {
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }
}

export const soundEngine = new SoundEngine();
