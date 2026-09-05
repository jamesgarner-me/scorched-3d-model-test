/** Tiny procedural sound bank on the Web Audio API — no asset files needed. */
let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
let flightNode: { stop: () => void } | null = null

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.gain.value = muted ? 0 : 0.6
      master.connect(ctx.destination)
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Call from a user gesture so the browser allows audio. */
export function unlockAudio() {
  ensure()
}

export function setMuted(m: boolean) {
  muted = m
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.02)
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function burst(c: AudioContext, opts: { seconds: number; gain: number; filterFrom: number; filterTo: number; q?: number }) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, opts.seconds)
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = opts.q ?? 0.7
  filter.frequency.setValueAtTime(opts.filterFrom, c.currentTime)
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, opts.filterTo), c.currentTime + opts.seconds)
  const g = c.createGain()
  g.gain.setValueAtTime(opts.gain, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + opts.seconds)
  src.connect(filter).connect(g).connect(master!)
  src.start()
  src.stop(c.currentTime + opts.seconds)
}

function thump(c: AudioContext, opts: { from: number; to: number; seconds: number; gain: number; type?: OscillatorType }) {
  const o = c.createOscillator()
  o.type = opts.type ?? 'sine'
  o.frequency.setValueAtTime(opts.from, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), c.currentTime + opts.seconds)
  const g = c.createGain()
  g.gain.setValueAtTime(opts.gain, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + opts.seconds)
  o.connect(g).connect(master!)
  o.start()
  o.stop(c.currentTime + opts.seconds)
}

export const sfx = {
  fire() {
    const c = ensure()
    if (!c) return
    burst(c, { seconds: 0.35, gain: 0.9, filterFrom: 3000, filterTo: 200 })
    thump(c, { from: 160, to: 40, seconds: 0.4, gain: 0.8 })
  },
  chargeTick(level: number) {
    const c = ensure()
    if (!c) return
    thump(c, { from: 300 + level * 500, to: 300 + level * 500, seconds: 0.05, gain: 0.05, type: 'square' })
  },
  flightStart() {
    const c = ensure()
    if (!c) return
    this.flightStop()
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c, 2)
    src.loop = true
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 6
    filter.frequency.setValueAtTime(900, c.currentTime)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.3)
    src.connect(filter).connect(g).connect(master!)
    src.start()
    flightNode = {
      stop: () => {
        g.gain.setTargetAtTime(0.0001, c.currentTime, 0.05)
        src.stop(c.currentTime + 0.3)
      },
    }
  },
  flightStop() {
    flightNode?.stop()
    flightNode = null
  },
  impact() {
    const c = ensure()
    if (!c) return
    burst(c, { seconds: 0.7, gain: 1, filterFrom: 1800, filterTo: 80 })
    thump(c, { from: 90, to: 30, seconds: 0.7, gain: 0.9 })
  },
  splash() {
    const c = ensure()
    if (!c) return
    burst(c, { seconds: 0.9, gain: 0.6, filterFrom: 4000, filterTo: 600, q: 0.4 })
  },
  destruction() {
    const c = ensure()
    if (!c) return
    burst(c, { seconds: 2.2, gain: 1.2, filterFrom: 2500, filterTo: 40 })
    thump(c, { from: 70, to: 20, seconds: 2.5, gain: 1.1 })
    setTimeout(() => burst(c, { seconds: 1.5, gain: 0.5, filterFrom: 900, filterTo: 60 }), 350)
  },
  ui() {
    const c = ensure()
    if (!c) return
    thump(c, { from: 700, to: 900, seconds: 0.08, gain: 0.08, type: 'triangle' })
  },
}
