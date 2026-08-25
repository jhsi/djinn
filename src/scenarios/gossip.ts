import type { Scenario } from "../simulation/types";
import { makeNodes } from "./helpers";

const IDS = ["A", "B", "C", "D", "E"] as const;
const INTERVAL = 800;
const LATENCY = 250;

export const gossip: Scenario = {
  id: "gossip",
  name: "Gossip",
  description:
    "A starts with x=42. Informed nodes periodically tell one peer. Watch the value spread — and what happens if you cut the network.",
  createInitialState: () => ({
    seed: 42,
    nodes: makeNodes([...IDS], (id) => ({
      knownValues: id === "A" ? { x: 42 } : {},
    })),
  }),
  onStart(ctx) {
    for (const id of IDS) {
      ctx.setTimer(id, INTERVAL, "gossip");
    }
  },
  onMessage(nodeId, message, ctx) {
    const payload = message.payload as {
      type: string;
      values?: Record<string, unknown>;
    };
    if (payload.type !== "GOSSIP" || !payload.values) return;
    ctx.updateNodeState(nodeId, (s) => ({
      ...s,
      knownValues: {
        ...((s.knownValues as Record<string, unknown> | undefined) ?? {}),
        ...payload.values,
      },
    }));
  },
  onTimer(nodeId, timer, ctx) {
    if (timer.name !== "gossip") return;
    if (ctx.isRunning(nodeId)) {
      const known = (ctx.getNode(nodeId).state.knownValues ?? {}) as Record<
        string,
        unknown
      >;
      if (Object.keys(known).length > 0) {
        const peers = ctx
          .getNodes()
          .filter((n) => n.id !== nodeId)
          .sort((a, b) => a.id.localeCompare(b.id));
        if (peers.length > 0) {
          const peer = peers[Math.floor(ctx.random() * peers.length)];
          ctx.sendMessage(nodeId, peer.id, { type: "GOSSIP", values: known }, LATENCY);
        }
      }
    }
    ctx.setTimer(nodeId, INTERVAL, "gossip");
  },
  onRestart(nodeId, ctx) {
    ctx.setTimer(nodeId, INTERVAL, "gossip");
  },
  summarizeNode(node) {
    const known = (node.state.knownValues ?? {}) as Record<string, unknown>;
    const keys = Object.keys(known);
    if (keys.length === 0) return ["knownValues: {}"];
    return keys.map((k) => `${k}: ${String(known[k])}`);
  },
};
