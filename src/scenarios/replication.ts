import type { Scenario } from "../simulation/types";
import { makeNodes } from "./helpers";

export const replication: Scenario = {
  id: "replication",
  name: "Replication",
  description:
    "A primary replicates SET x=5 to two replicas with different latencies. There is no instantaneous global state.",
  actions: [{ id: "set-x-5", label: "SET x = 5" }],
  createInitialState: () => ({
    nodes: makeNodes(["A", "B", "C"], (id) => ({
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
    ctx.sendMessage("A", "B", { type: "REPLICATE", key: "x", value: 5 }, 500);
    ctx.sendMessage("A", "C", { type: "REPLICATE", key: "x", value: 5 }, 2000);
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
};
