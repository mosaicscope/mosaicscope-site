/** Deterministic seeded PRNG (sfc32). State is four 32-bit ints so it can be saved and restored. */
export class Rng {
  private a: number; private b: number; private c: number; private d: number;

  constructor(seed: number | string = 1) {
    const s = typeof seed === "string" ? hashString(seed) : seed >>> 0;
    this.a = 0x9e3779b9; this.b = 0x243f6a88; this.c = 0xb7e15162; this.d = s ^ 0xdeadbeef;
    for (let i = 0; i < 15; i++) this.next();
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  range(min: number, max: number): number { return min + (max - min) * this.next(); }
  int(min: number, maxInclusive: number): number { return min + Math.floor(this.next() * (maxInclusive - min + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  /** Weighted pick; weights must be >= 0. Returns -1 when all weights are 0. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return weights.length - 1;
  }
  /** Approximately normal (mean 0, sd ~1). */
  gauss(): number { return (this.next() + this.next() + this.next() + this.next() - 2) * 1.7320508; }

  getState(): [number, number, number, number] { return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0]; }
  setState(s: readonly number[]): void { [this.a, this.b, this.c, this.d] = s as [number, number, number, number]; }
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
