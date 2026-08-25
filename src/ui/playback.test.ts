import { describe, expect, it } from "vitest";
import { playbackRate } from "./playback";
import type { Snapshot } from "../simulation/types";

function snap(partial: Partial<Snapshot>): Snapshot {
  return {
    currentTime: 0,
    status: "playing",
    speed: "auto",
    nodes: [],
    inFlight: [],
    pendingEvents: [],
    eventLog: [],
    tapeLog: [],
    playheadLogSeq: -1,
    atTip: true,
    duration: 1,
    exploredUntil: 0,
    partitions: [],
    linkLatencies: [],
    defaultLatency: 100,
    nextEvent: { type: "timer", id: "t1", timestamp: 1500, seq: 0, nodeId: "A", name: "election" },
    pendingCount: 1,
    timers: [],
    started: false,
    ...partial,
  };
}

describe("playbackRate", () => {
  it("uses the numeric speed when not auto", () => {
    expect(playbackRate(snap({ speed: 4 }))).toBe(4);
    expect(playbackRate(snap({ speed: 32 }))).toBe(32);
  });

  it("speeds through empty time far from the next event", () => {
    expect(playbackRate(snap({ currentTime: 0, nextEvent: { type: "timer", id: "t1", timestamp: 1500, seq: 0, nodeId: "A", name: "election" } }))).toBeGreaterThan(4);
  });

  it("slows as the next event approaches", () => {
    const far = playbackRate(snap({ currentTime: 0 }));
    const near = playbackRate(snap({ currentTime: 1400 }));
    expect(near).toBeLessThan(far);
  });

  it("slows while a message is in flight so it can be clicked", () => {
    const rate = playbackRate(
      snap({
        currentTime: 1000,
        inFlight: [
          { id: "m1", from: "A", to: "B", payload: { type: "GOSSIP" }, sentAt: 800, deliverAt: 1050 },
        ],
      }),
    );
    expect(rate).toBeLessThan(1);
  });
});
