export class SeededRng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  random(): number {
    this.s += 0x6d2b79f5;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  getState(): number {
    return this.s;
  }

  setState(state: number): void {
    this.s = state >>> 0;
  }
}

export function createRng(seed: number): () => number {
  const rng = new SeededRng(seed);
  return () => rng.random();
}
