import type { Scenario } from "../simulation/types";
import { clusterIds, makeNodes, nodeIds } from "./helpers";

export const replication: Scenario = {
  id: "replication",
  name: "Replication",
  layout: "leader-centered",
  configurableNodeCount: true,
  defaultNodeCount: 3,
  description:
    "A primary replicates SET x=5 to replicas with different latencies. There is no instantaneous global state.",
  actions: [{ id: "set-x-5", label: "SET x = 5" }],
  createInitialState: (nodeCount = 3) => ({
    nodes: makeNodes(clusterIds(nodeCount), (id) => ({
      role: id === "A" ? "PRIMARY" : "REPLICA",
      x: 0,
    })),
  }),
  onStart() {
    // Wait for the user (or tests) to trigger SET x=5.
  },
  onAction(actionId, ctx) {
    if (actionId !== "set-x-5") return;
    if (ctx.getNode("A").state.x === 5) {
      ctx.log("SET x=5 already applied on primary");
      return;
    }
    ctx.log("client SET x = 5");
    ctx.updateNodeState("A", { x: 5 });
    for (const id of nodeIds(ctx)) {
      if (id === "A") continue;
      ctx.sendMessage("A", id, { type: "REPLICATE", key: "x", value: 5 }, replicaLatency(id));
    }
  },
  onMessage(nodeId, message, ctx) {
    const payload = message.payload as {
      type: string;
      key?: string;
      value?: unknown;
    };
    if (payload.type !== "REPLICATE" || payload.key !== "x") return;
    ctx.updateNodeState(nodeId, { x: payload.value });
  },
  summarizeNode(node) {
    return [String(node.state.role), `x = ${String(node.state.x)}`];
  },
  glanceNode(node) {
    return [String(node.state.role), `x = ${String(node.state.x)}`];
  },
  presentNode(node, snapshot) {
    const x = `x = ${String(node.state.x)}`;
    const xs = snapshot.nodes
      .map((n) => n.state.x)
      .filter((v): v is number => typeof v === "number");
    const max = xs.length ? Math.max(...xs) : null;
    const stale = typeof node.state.x === "number" && max != null && node.state.x < max;
    return {
      role: String(node.state.role),
      primary: x,
      secondary: stale ? "STALE" : "fresh",
    };
  },
};

function replicaLatency(id: string): number {
  if (id === "B") return 500;
  if (id === "C") return 2000;
  if (id === "D") return 800;
  if (id === "E") return 1200;
  return 1000;
}
