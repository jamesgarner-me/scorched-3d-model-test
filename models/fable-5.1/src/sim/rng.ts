/** Deterministic seeded PRNG (mulberry32). */
export type Rng = {
  next: () => number // [0, 1)
  range: (min: number, max: number) => number
  int: (min: number, max: number) => number // inclusive
  pick: <T>(arr: readonly T[]) => T
  gaussian: () => number // mean 0, sd 1
}

export function hashSeed(text: string): number {
  let h = 1779033703 ^ text.length
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^= h >>> 16) >>> 0
}

export function createRng(seed: number | string): Rng {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    gaussian: () => {
      const u = 1 - next()
      const v = next()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
  }
}

export function randomSeed(): string {
  const words = ['aurora', 'basalt', 'cinder', 'delta', 'ember', 'fjord', 'gale', 'halo', 'ion', 'jet', 'krater', 'lava', 'mesa', 'nova', 'orbit', 'pyre', 'quartz', 'ridge', 'storm', 'tundra', 'umbra', 'vale', 'wisp', 'xenon', 'yardang', 'zenith']
  const w = words[Math.floor(Math.random() * words.length)]
  return `${w}-${Math.floor(Math.random() * 9000 + 1000)}`
}
