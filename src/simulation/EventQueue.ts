import type { SimulationEvent } from "./types";

function compare(a: SimulationEvent, b: SimulationEvent): number {
  if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
  return a.seq - b.seq;
}

export class EventQueue {
  private items: SimulationEvent[] = [];
  private nextSeq = 0;

  get sequence(): number {
    return this.nextSeq;
  }

  peek(): SimulationEvent | undefined {
    return this.items[0];
  }

  pop(): SimulationEvent | undefined {
    return this.items.shift();
  }

  schedule<T extends Omit<SimulationEvent, "seq">>(event: T): T & { seq: number } {
    const full = { ...event, seq: this.nextSeq++ } as T & { seq: number };
    this.items.push(full as unknown as SimulationEvent);
    this.items.sort(compare);
    return full;
  }

  remove(predicate: (event: SimulationEvent) => boolean): SimulationEvent[] {
    const kept: SimulationEvent[] = [];
    const removed: SimulationEvent[] = [];
    for (const event of this.items) {
      if (predicate(event)) removed.push(event);
      else kept.push(event);
    }
    this.items = kept;
    return removed;
  }

  toArray(): SimulationEvent[] {
    return this.items.slice();
  }

  get length(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
    this.nextSeq = 0;
  }

  restore(items: SimulationEvent[], nextSeq: number): void {
    this.items = items.map((event) => ({ ...event }));
    this.nextSeq = nextSeq;
  }
}
