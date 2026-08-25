import type { InspectorSection, Node, NodePresentation, Scenario, Snapshot } from "../simulation/types";
import { clusterIds, makeNodes, nodeIds } from "./helpers";

const INTERVAL = 800;
const LATENCY = 250;

export const gossip: Scenario = {
  id: "gossip",
  name: "Gossip",
  layout: "ring",
  configurableNodeCount: true,
  defaultNodeCount: 5,
  description:
    "A starts with x=42. Informed nodes periodically tell one peer. Watch the value spread — and what happens if you cut the network.",
  createInitialState: (nodeCount = 5) => ({
    seed: 42,
    defaultLatency: LATENCY,
    nodes: makeNodes(clusterIds(nodeCount), (id) => ({
      knownValues: id === "A" ? { x: 42 } : {},
      lastGossipTo: null,
      lastGossipFrom: null,
    })),
  }),
  onStart(ctx) {
    for (const id of nodeIds(ctx)) {
      ctx.setTimer(id, INTERVAL, "gossip");
    }
  },
  onMessage(nodeId, message, ctx) {
    const payload = message.payload as {
      type: string;
      values?: Record<string, unknown>;
    };
    if (payload.type !== "GOSSIP" || !payload.values) return;
    const before = Object.keys(
      ((ctx.getNode(nodeId).state.knownValues as Record<string, unknown> | undefined) ?? {}),
    );
    ctx.updateNodeState(nodeId, (s) => ({
      ...s,
      lastGossipFrom: message.from,
      knownValues: {
        ...((s.knownValues as Record<string, unknown> | undefined) ?? {}),
        ...payload.values,
      },
    }));
    const after = Object.keys(
      ((ctx.getNode(nodeId).state.knownValues as Record<string, unknown> | undefined) ?? {}),
    );
    const learned = after.filter((k) => !before.includes(k));
    if (learned.length > 0) {
      ctx.log(`${nodeId} learned ${learned.join(", ")}`, { kind: "state", nodeId, from: message.from });
    }
  },
  onTimer(nodeId, timer, ctx) {
    if (timer.name !== "gossip") return;
    if (ctx.isRunning(nodeId)) {
      const known = (ctx.getNode(nodeId).state.knownValues ?? {}) as Record<string, unknown>;
      if (Object.keys(known).length > 0) {
        const peers = ctx
          .getNodes()
          .filter((n) => n.id !== nodeId)
          .sort((a, b) => a.id.localeCompare(b.id));
        if (peers.length > 0) {
          const peer = peers[Math.floor(ctx.random() * peers.length)];
          ctx.updateNodeState(nodeId, { lastGossipTo: peer.id });
          ctx.sendMessage(nodeId, peer.id, { type: "GOSSIP", values: known }, LATENCY);
        }
      }
    }
    ctx.setTimer(nodeId, INTERVAL, "gossip");
  },
  onRestart(nodeId, ctx) {
    ctx.setTimer(nodeId, INTERVAL, "gossip");
  },
  presentNode(node) {
    return gossipPresentation(node);
  },
  inspectNode(node, snapshot) {
    return gossipInspect(node, snapshot);
  },
  summarizeNode(node) {
    const known = knownOf(node);
    const keys = Object.keys(known);
    if (keys.length === 0) return ["knows —"];
    return keys.map((k) => `${k} = ${String(known[k])}`);
  },
};

function knownOf(node: Node): Record<string, unknown> {
  return (node.state.knownValues ?? {}) as Record<string, unknown>;
}

function gossipPresentation(node: Node): NodePresentation {
  const keys = Object.keys(knownOf(node)).sort();
  if (keys.length === 0) return { placeholder: "—", showTimerLabel: false };
  if (keys.length > 3) {
    return { primary: `${keys.length} known`, showTimerLabel: false };
  }
  return {
    badges: keys.map((label) => ({ label })),
    showTimerLabel: false,
  };
}

function gossipInspect(node: Node, snapshot: Snapshot): InspectorSection[] {
  const known = knownOf(node);
  const keys = Object.keys(known).sort();
  const timer = snapshot.timers
    .filter((t) => t.nodeId === node.id && t.name === "gossip")
    .sort((a, b) => a.fireAt - b.fireAt)[0];
  return [
    {
      title: "Knowledge",
      rows:
        keys.length === 0
          ? [{ label: "—", value: "none" }]
          : keys.map((k) => ({ label: k, value: String(known[k]) })),
    },
    {
      title: "Gossip",
      rows: [
        { label: "Interval", value: `${INTERVAL}ms` },
        {
          label: "Next gossip",
          value: timer ? `${Math.max(0, Math.round(timer.fireAt - snapshot.currentTime))}ms` : "—",
        },
        { label: "Last sent", value: String(node.state.lastGossipTo ?? "—") },
        { label: "Last received", value: String(node.state.lastGossipFrom ?? "—") },
      ],
    },
    {
      title: "Network",
      rows: [{ label: "Peers", value: String(Math.max(0, snapshot.nodes.length - 1)) }],
    },
  ];
}
