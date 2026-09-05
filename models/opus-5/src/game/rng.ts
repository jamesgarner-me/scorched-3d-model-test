/** Deterministic, seedable PRNG. A logged seed must reproduce a planet exactly. */
export interface Rng {
  (): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  /** Symmetric jitter in [-amount, amount], triangular so small errors dominate. */
  jitter(amount: number): number;
  pick<T>(items: readonly T[]): T;
}

export function hashSeed(input: string | number): number {
  const s = String(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function makeRng(seed: string | number): Rng {
  let a = hashSeed(seed) || 1;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = next as Rng;
  rng.range = (min, max) => min + next() * (max - min);
  rng.int = (min, max) => Math.floor(min + next() * (max - min + 1));
  rng.jitter = (amount) => (next() + next() - 1) * amount;
  rng.pick = (items) => items[Math.floor(next() * items.length)];
  return rng;
}

/** A short human-typeable seed, e.g. "K7F2QX". */
export function randomSeed(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
