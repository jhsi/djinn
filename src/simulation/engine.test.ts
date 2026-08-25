import { describe, expect, it } from "vitest";
import { Simulation } from "./Simulation";
import { EventQueue } from "./EventQueue";
import { pingPong } from "../scenarios/pingPong";
import { replication } from "../scenarios/replication";
import { raftScenario } from "../scenarios/raft";
import { gossip } from "../scenarios/gossip";
import type { Scenario } from "./types";
import { makeNodes } from "../scenarios/helpers";

function xOf(sim: Simulation, id: string): unknown {
  return sim.snapshot().nodes.find((n) => n.id === id)?.state.x;
}

function logTexts(sim: Simulation): string[] {
  return sim.snapshot().eventLog.map((e) => `${e.timestamp}:${e.kind}:${e.text}`);
}

const ordering: Scenario = {
  id: "ordering",
  name: "ordering",
  description: "",
  createInitialState: () => ({ nodes: makeNodes(["A", "B", "C"]) }),
  onStart(ctx) {
    ctx.sendMessage("A", "C", { type: "LATE" }, 1000);
    ctx.sendMessage("A", "B", { type: "EARLY" }, 500);
  },
  onMessage() {},
};

const ties: Scenario = {
  id: "ties",
  name: "ties",
  description: "",
  createInitialState: () => ({ nodes: makeNodes(["A", "B", "C"]) }),
  onStart(ctx) {
    ctx.sendMessage("A", "B", { type: "FIRST" }, 500);
    ctx.sendMessage("A", "C", { type: "SECOND" }, 500);
  },
  onMessage() {},
};

describe("EventQueue", () => {
  it("pops the lowest timestamp first", () => {
    const q = new EventQueue();
    q.schedule({ type: "timer", id: "b", timestamp: 1000, nodeId: "A", name: "x" });
    q.schedule({ type: "timer", id: "a", timestamp: 500, nodeId: "A", name: "y" });
    expect(q.pop()?.timestamp).toBe(500);
    expect(q.pop()?.timestamp).toBe(1000);
  });

  it("breaks timestamp ties by insertion order", () => {
    const q = new EventQueue();
    q.schedule({ type: "timer", id: "a", timestamp: 10, nodeId: "A", name: "first" });
    q.schedule({ type: "timer", id: "b", timestamp: 10, nodeId: "B", name: "second" });
    expect(q.pop()?.id).toBe("a");
    expect(q.pop()?.id).toBe("b");
  });
});

describe("Simulation engine", () => {
  it("steps the earlier event first", () => {
    const sim = new Simulation(ordering);
    const first = sim.step();
    expect(first?.type).toBe("deliver");
    expect(first?.timestamp).toBe(500);
    expect(sim.currentTime).toBe(500);
    const second = sim.step();
    expect(second?.timestamp).toBe(1000);
  });

  it("executes same-timestamp events in insertion order", () => {
    const sim = new Simulation(ties);
    const first = sim.step();
    expect(first && first.type === "deliver" && first.messageId).toBe("m1");
    const second = sim.step();
    expect(second && second.type === "deliver" && second.messageId).toBe("m2");
  });

  it("does not execute events while paused even if time is advanced", () => {
    const sim = new Simulation(ordering);
    expect(sim.status).toBe("paused");
    sim.advanceBy(10_000);
    expect(sim.currentTime).toBe(0);
    expect(sim.snapshot().inFlight).toHaveLength(2);
    sim.play();
    sim.advanceBy(600);
    expect(sim.currentTime).toBeGreaterThanOrEqual(500);
    expect(sim.snapshot().inFlight).toHaveLength(1);
  });

  it("step executes exactly one event", () => {
    const sim = new Simulation(ordering);
    const before = sim.snapshot().pendingCount;
    sim.step();
    expect(sim.snapshot().pendingCount).toBe(before - 1);
    expect(sim.snapshot().eventLog.filter((e) => e.kind === "deliver")).toHaveLength(1);
  });

  it("drops a message so it never arrives", () => {
    const sim = new Simulation(ordering);
    const early = sim.snapshot().inFlight.find((m) => m.to === "B");
    expect(early).toBeTruthy();
    sim.dropMessage(early!.id);
    while (sim.step()) {
      /* drain */
    }
    const delivered = sim
      .snapshot()
      .eventLog.filter((e) => e.kind === "deliver" && e.text.includes("B"));
    expect(delivered).toHaveLength(0);
    expect(sim.snapshot().eventLog.some((e) => e.kind === "drop")).toBe(true);
  });

  it("delaying a message changes event order", () => {
    const sim = new Simulation(ordering);
    const early = sim.snapshot().inFlight.find((m) => m.to === "B")!;
    const late = sim.snapshot().inFlight.find((m) => m.to === "C")!;
    sim.delayMessage(early.id, 2000);
    const first = sim.step();
    expect(first && first.type === "deliver" && first.messageId).toBe(late.id);
    const second = sim.step();
    expect(second && second.type === "deliver" && second.messageId).toBe(early.id);
    expect(sim.currentTime).toBe(2000);
  });

  it("drops messages that cross a partition", () => {
    const sim = new Simulation(ordering);
    sim.partition("A", "B");
    expect(sim.snapshot().inFlight.some((m) => m.to === "B")).toBe(false);
    while (sim.step()) {
      /* drain */
    }
    expect(
      sim.snapshot().eventLog.some((e) => e.kind === "deliver" && e.text.includes("B")),
    ).toBe(false);
  });

  it("drops new sends during a partition immediately", () => {
    const sim = new Simulation(ordering);
    sim.partition("A", "B");
    sim.injectMessage("A", "B", { type: "PING" }, 100);
    expect(sim.snapshot().inFlight.some((m) => m.to === "B")).toBe(false);
    expect(sim.snapshot().eventLog.some((e) => e.text.includes("partition"))).toBe(
      true,
    );
  });

  it("crashed nodes do not process messages or timers", () => {
    const sim = new Simulation(pingPong);
    sim.crashNode("B");
    sim.step();
    const b = sim.snapshot().nodes.find((n) => n.id === "B")!;
    expect(b.status).toBe("stopped");
    expect(b.state.pingsReceived).toBe(0);
    expect(sim.snapshot().eventLog.some((e) => e.kind === "drop")).toBe(true);
  });

  it("reset replays the same scenario identically", () => {
    function run() {
      const sim = new Simulation(pingPong);
      while (sim.step()) {
        /* drain */
      }
      return logTexts(sim);
    }
    expect(run()).toEqual(run());
  });
});

describe("Replication scenario", () => {
  it("matches the first acceptance sequence", () => {
    const sim = new Simulation(replication);
    expect(xOf(sim, "A")).toBe(0);
    expect(xOf(sim, "B")).toBe(0);
    expect(xOf(sim, "C")).toBe(0);

    sim.invokeAction("set-x-5");
    expect(xOf(sim, "A")).toBe(5);
    expect(xOf(sim, "B")).toBe(0);
    expect(xOf(sim, "C")).toBe(0);

    const toB = sim.snapshot().inFlight.find((m) => m.to === "B")!;
    const toC = sim.snapshot().inFlight.find((m) => m.to === "C")!;
    expect(toB.deliverAt).toBe(500);
    expect(toC.deliverAt).toBe(2000);

    sim.step();
    expect(sim.currentTime).toBe(500);
    expect(xOf(sim, "A")).toBe(5);
    expect(xOf(sim, "B")).toBe(5);
    expect(xOf(sim, "C")).toBe(0);
    expect(sim.snapshot().inFlight).toHaveLength(1);
    expect(sim.snapshot().inFlight[0].to).toBe("C");
    expect(sim.snapshot().inFlight[0].deliverAt).toBe(2000);

    sim.delayMessage(toC.id, 4000);
    sim.step();
    expect(sim.currentTime).toBe(4000);
    expect(xOf(sim, "C")).toBe(5);

    sim.reset();
    sim.invokeAction("set-x-5");
    sim.step();
    expect(xOf(sim, "A")).toBe(5);
    expect(xOf(sim, "B")).toBe(5);
    expect(xOf(sim, "C")).toBe(0);
    expect(sim.snapshot().inFlight[0].deliverAt).toBe(2000);
  });
});

describe("Gossip", () => {
  it("spreads deterministically for a fixed seed", () => {
    function run() {
      const sim = new Simulation(gossip);
      for (let i = 0; i < 40; i += 1) sim.step();
      return sim.snapshot().nodes.map((n) => [
        n.id,
        JSON.stringify(n.state.knownValues),
      ]);
    }
    expect(run()).toEqual(run());
  });
});

describe("Raft", () => {
  it("elects exactly one leader under normal conditions", () => {
    const sim = new Simulation(raftScenario);
    let steps = 0;
    while (steps < 400) {
      const leaders = sim
        .snapshot()
        .nodes.filter((n) => n.state.role === "LEADER" && n.status === "running");
      if (leaders.length === 1) break;
      sim.step();
      steps += 1;
    }
    const leaders = sim
      .snapshot()
      .nodes.filter((n) => n.state.role === "LEADER" && n.status === "running");
    expect(leaders).toHaveLength(1);

    for (let i = 0; i < 80; i += 1) sim.step();
    const later = sim
      .snapshot()
      .nodes.filter((n) => n.state.role === "LEADER" && n.status === "running");
    expect(later).toHaveLength(1);
    expect(later[0].id).toBe(leaders[0].id);
  });
});

describe("Playback seek", () => {
  it("seeks back to a completed event and restores node state", () => {
    const sim = new Simulation(replication);
    sim.invokeAction("set-x-5");
    sim.step();
    sim.step();
    expect(xOf(sim, "B")).toBe(5);
    expect(xOf(sim, "C")).toBe(5);

    const deliverB = sim
      .snapshot()
      .tapeLog.find((e) => e.kind === "deliver" && e.text.includes("B ←"));
    expect(deliverB).toBeTruthy();
    sim.seekToLog(deliverB!.seq);
    expect(sim.currentTime).toBe(500);
    expect(xOf(sim, "A")).toBe(5);
    expect(xOf(sim, "B")).toBe(5);
    expect(xOf(sim, "C")).toBe(0);
    expect(sim.snapshot().inFlight.some((m) => m.to === "C")).toBe(true);
  });

  it("seeks between events without executing the next one", () => {
    const sim = new Simulation(replication);
    sim.invokeAction("set-x-5");
    sim.step();
    sim.step();
    sim.seekToTime(1000);
    expect(sim.currentTime).toBe(1000);
    expect(xOf(sim, "B")).toBe(5);
    expect(xOf(sim, "C")).toBe(0);
    expect(sim.snapshot().inFlight.some((m) => m.to === "C")).toBe(true);
  });

  it("fast-forwards through a future pending event", () => {
    const sim = new Simulation(replication);
    sim.invokeAction("set-x-5");
    expect(xOf(sim, "B")).toBe(0);
    sim.seekToTime(500);
    expect(sim.currentTime).toBe(500);
    expect(xOf(sim, "B")).toBe(5);
    expect(xOf(sim, "C")).toBe(0);
  });

  it("truncates recorded future after a mutation behind the playhead", () => {
    const sim = new Simulation(replication);
    sim.invokeAction("set-x-5");
    sim.step();
    sim.step();
    expect(sim.snapshot().tapeLog.some((e) => e.kind === "deliver" && e.text.includes("C ←"))).toBe(
      true,
    );

    const send = sim.snapshot().tapeLog.find((e) => e.kind === "send" && e.text.includes("→ B"));
    sim.seekToLog(send!.seq);
    const toC = sim.snapshot().inFlight.find((m) => m.to === "C");
    expect(toC).toBeTruthy();
    sim.dropMessage(toC!.id);

    expect(sim.snapshot().tapeLog.some((e) => e.kind === "deliver" && e.text.includes("C ←"))).toBe(
      false,
    );
    while (sim.step()) {
      /* drain */
    }
    expect(xOf(sim, "C")).toBe(0);
    expect(xOf(sim, "B")).toBe(5);
  });

  it("plays through recorded tape without rewriting history", () => {
    const sim = new Simulation(replication);
    sim.invokeAction("set-x-5");
    sim.step();
    sim.step();
    const recorded = sim.snapshot().tapeLog.map((e) => `${e.seq}:${e.kind}:${e.text}`);
    sim.seekToTime(0);
    sim.play();
    sim.advanceBy(5000);
    expect(sim.snapshot().tapeLog.map((e) => `${e.seq}:${e.kind}:${e.text}`)).toEqual(recorded);
    expect(xOf(sim, "C")).toBe(5);
  });
});

describe("Link physics", () => {
  const physics: Scenario = {
    id: "physics",
    name: "physics",
    description: "",
    createInitialState: () => ({
      nodes: makeNodes(["A", "B"]),
      defaultLatency: 100,
    }),
    onStart(ctx) {
      ctx.sendMessage("A", "B", { type: "PING" });
    },
    onMessage() {},
  };

  it("uses the link latency when send omits an override", () => {
    const sim = new Simulation(physics);
    expect(sim.snapshot().inFlight[0].deliverAt).toBe(100);
    expect(sim.getLinkLatency("A", "B")).toBe(100);
  });

  it("rescales in-flight remaining time when latency changes", () => {
    const sim = new Simulation(physics);
    sim.setLinkLatency("A", "B", 400);
    expect(sim.snapshot().inFlight[0].deliverAt).toBe(400);
  });

  it("applies updated latency to subsequent sends", () => {
    const sim = new Simulation(physics);
    sim.dropMessage(sim.snapshot().inFlight[0].id);
    sim.setLinkLatency("A", "B", 2500);
    sim.injectMessage("A", "B", { type: "PING" });
    expect(sim.snapshot().inFlight[0].deliverAt).toBe(2500);
  });

  it("dropNextOnLink drops the next message on that edge", () => {
    const sim = new Simulation(physics);
    expect(sim.dropNextOnLink("A", "B")).toBe(true);
    expect(sim.snapshot().inFlight).toHaveLength(0);
    expect(sim.snapshot().eventLog.some((e) => e.kind === "drop")).toBe(true);
  });
});
