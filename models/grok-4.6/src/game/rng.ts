export function hashString(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function createRng(seed: string | number): () => number {
  let s = typeof seed === 'number' ? seed >>> 0 : hashString(seed)
  if (s === 0) s = 0x9e3779b9
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

export function randomSeed(): string {
  const bytes = new Uint8Array(6)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = (Math.random() * 256) | 0
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function pickRange(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo)
}

export function randomUnit(rng: () => number): [number, number, number] {
  const u = rng() * 2 - 1
  const t = rng() * Math.PI * 2
  const r = Math.sqrt(Math.max(0, 1 - u * u))
  return [r * Math.cos(t), u, r * Math.sin(t)]
}
