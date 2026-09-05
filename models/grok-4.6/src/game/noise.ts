import { createRng } from './rng.ts'

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

export class Noise3 {
  private perm: Uint8Array

  constructor(seed: string) {
    const rng = createRng(`${seed}:noise`)
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i += 1) p[i] = i
    for (let i = 255; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = p[i]!
      p[i] = p[j]!
      p[j] = tmp
    }
    this.perm = new Uint8Array(512)
    for (let i = 0; i < 512; i += 1) this.perm[i] = p[i & 255]!
  }

  sample(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    const Z = Math.floor(z) & 255
    const xf = x - Math.floor(x)
    const yf = y - Math.floor(y)
    const zf = z - Math.floor(z)
    const u = fade(xf)
    const v = fade(yf)
    const w = fade(zf)
    const p = this.perm
    const A = p[X]! + Y
    const AA = p[A]! + Z
    const AB = p[A + 1]! + Z
    const B = p[X + 1]! + Y
    const BA = p[B]! + Z
    const BB = p[B + 1]! + Z
    return lerp(
      lerp(
        lerp(grad(p[AA]!, xf, yf, zf), grad(p[BA]!, xf - 1, yf, zf), u),
        lerp(grad(p[AB]!, xf, yf - 1, zf), grad(p[BB]!, xf - 1, yf - 1, zf), u),
        v,
      ),
      lerp(
        lerp(grad(p[AA + 1]!, xf, yf, zf - 1), grad(p[BA + 1]!, xf - 1, yf, zf - 1), u),
        lerp(grad(p[AB + 1]!, xf, yf - 1, zf - 1), grad(p[BB + 1]!, xf - 1, yf - 1, zf - 1), u),
        v,
      ),
      w,
    )
  }

  fbm(x: number, y: number, z: number, octaves: number, lac = 2, gain = 0.5): number {
    let sum = 0
    let amp = 0.5
    let freq = 1
    let norm = 0
    for (let i = 0; i < octaves; i += 1) {
      sum += amp * this.sample(x * freq, y * freq, z * freq)
      norm += amp
      freq *= lac
      amp *= gain
    }
    return sum / norm
  }

  ridged(x: number, y: number, z: number, octaves: number): number {
    let sum = 0
    let amp = 0.5
    let freq = 1
    let norm = 0
    for (let i = 0; i < octaves; i += 1) {
      const n = 1 - Math.abs(this.sample(x * freq, y * freq, z * freq))
      sum += n * n * amp
      norm += amp
      freq *= 2
      amp *= 0.5
    }
    return sum / norm
  }
}
