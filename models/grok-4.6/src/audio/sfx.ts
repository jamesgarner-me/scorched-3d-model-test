export type SfxName = 'fire' | 'flight' | 'impact' | 'explosion' | 'destruction' | 'splash'

let ctx: AudioContext | null = null
let flight: OscillatorNode | null = null
let flightGain: GainNode | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function unlockAudio(): void {
  audio()
}

function env(context: AudioContext, duration: number, peak: number, when = 0): GainNode {
  const g = context.createGain()
  g.gain.setValueAtTime(0.0001, context.currentTime + when)
  g.gain.exponentialRampToValueAtTime(peak, context.currentTime + when + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + when + duration)
  return g
}

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  return buffer
}

export function playSfx(name: SfxName, muted: boolean): void {
  if (muted) return
  const context = audio()
  if (!context) return

  if (name === 'fire') {
    const osc = context.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(140, context.currentTime)
    osc.frequency.exponentialRampToValueAtTime(48, context.currentTime + 0.22)
    const g = env(context, 0.28, 0.22)
    osc.connect(g)
    g.connect(context.destination)
    osc.start()
    osc.stop(context.currentTime + 0.3)
    const src = context.createBufferSource()
    src.buffer = noiseBuffer(context, 0.18)
    const ng = env(context, 0.16, 0.12)
    src.connect(ng)
    ng.connect(context.destination)
    src.start()
    return
  }

  if (name === 'flight') {
    stopFlight()
    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 420
    const g = context.createGain()
    g.gain.value = 0.03
    osc.connect(g)
    g.connect(context.destination)
    osc.start()
    flight = osc
    flightGain = g
    return
  }

  if (name === 'impact' || name === 'splash') {
    stopFlight()
    const src = context.createBufferSource()
    src.buffer = noiseBuffer(context, 0.3)
    const filter = context.createBiquadFilter()
    filter.type = name === 'splash' ? 'lowpass' : 'bandpass'
    filter.frequency.value = name === 'splash' ? 700 : 420
    const g = env(context, name === 'splash' ? 0.35 : 0.22, 0.2)
    src.connect(filter)
    filter.connect(g)
    g.connect(context.destination)
    src.start()
    return
  }

  if (name === 'explosion' || name === 'destruction') {
    stopFlight()
    const src = context.createBufferSource()
    src.buffer = noiseBuffer(context, name === 'destruction' ? 1.1 : 0.55)
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(180, context.currentTime)
    filter.frequency.exponentialRampToValueAtTime(40, context.currentTime + 0.5)
    const g = env(context, name === 'destruction' ? 1.2 : 0.55, name === 'destruction' ? 0.34 : 0.26)
    src.connect(filter)
    filter.connect(g)
    g.connect(context.destination)
    src.start()
    const osc = context.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(90, context.currentTime)
    osc.frequency.exponentialRampToValueAtTime(28, context.currentTime + 0.4)
    const og = env(context, 0.45, 0.1)
    osc.connect(og)
    og.connect(context.destination)
    osc.start()
    osc.stop(context.currentTime + 0.5)
  }
}

export function stopFlight(): void {
  if (flight) {
    try {
      flight.stop()
    } catch {
      /* already stopped */
    }
    flight.disconnect()
    flight = null
  }
  if (flightGain) {
    flightGain.disconnect()
    flightGain = null
  }
}
