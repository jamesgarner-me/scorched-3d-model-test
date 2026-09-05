import type { ImpactKind } from '../game/physics';

/**
 * Tiny synthesised sound bank. Everything is generated with Web Audio at runtime, so
 * the build stays asset-free and the first sound is instant.
 */
class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private whistle: { osc: OscillatorNode; gain: GainNode } | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
    }
  }

  /** Unlock audio on the first user gesture. */
  unlock(): void {
    this.ensure();
  }

  private noise(): AudioBuffer | null {
    const ctx = this.ensure();
    if (!ctx) return null;
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * 2);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02; // gentle brown-noise tilt
        data[i] = white * 0.6 + last * 3;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  private burst(duration: number, startGain: number, filterFrom: number, filterTo: number): void {
    const ctx = this.ensure();
    const buffer = this.noise();
    if (!ctx || !buffer || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFrom, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(filterTo, 40), ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(startGain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    src.stop(ctx.currentTime + duration + 0.05);
  }

  private tone(from: number, to: number, duration: number, gainValue: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 20), ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  /** Rising pitch while the power meter fills. */
  charge(on: boolean): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (on) {
      if (this.chargeOsc) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(520, ctx.currentTime + 1.6);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.1);
      osc.connect(gain).connect(this.master);
      osc.start();
      this.chargeOsc = osc;
      this.chargeGain = gain;
    } else if (this.chargeOsc && this.chargeGain) {
      this.chargeGain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      this.chargeOsc.stop(ctx.currentTime + 0.2);
      this.chargeOsc = null;
      this.chargeGain = null;
    }
  }

  fire(): void {
    this.burst(0.5, 0.9, 2200, 120);
    this.tone(180, 42, 0.5, 0.5, 'sawtooth');
    this.startWhistle();
  }

  private startWhistle(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.stopWhistle();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 5);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.35);
    osc.connect(gain).connect(this.master);
    osc.start();
    this.whistle = { osc, gain };
  }

  private stopWhistle(): void {
    const ctx = this.ctx;
    if (!ctx || !this.whistle) return;
    this.whistle.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    this.whistle.osc.stop(ctx.currentTime + 0.3);
    this.whistle = null;
  }

  impact(kind: ImpactKind, fatal: boolean): void {
    this.stopWhistle();
    if (kind === 'water') {
      this.burst(0.7, 0.55, 1400, 300);
      this.tone(420, 90, 0.35, 0.18, 'sine');
      return;
    }
    this.burst(fatal ? 1.9 : 0.9, fatal ? 1 : 0.75, 1800, 60);
    this.tone(fatal ? 90 : 130, 28, fatal ? 1.6 : 0.7, fatal ? 0.75 : 0.45, 'sawtooth');
    if (fatal) {
      // Secondary detonations for the destruction sequence.
      setTimeout(() => this.burst(1.2, 0.6, 900, 50), 220);
      setTimeout(() => this.burst(1.6, 0.45, 600, 40), 620);
    }
  }

  victory(playerWon: boolean): void {
    const notes = playerWon ? [392, 523, 659, 784] : [392, 330, 262, 196];
    notes.forEach((f, i) => setTimeout(() => this.tone(f, f * 0.99, 0.55, 0.18, 'triangle'), i * 150));
  }
}

export const audio = new Audio();
