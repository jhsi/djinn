import type { Scenario, ScenarioContext } from "../simulation/types";
import { clusterIds, majorityOf, makeNodes, nodeIds } from "./helpers";

const ACK_LATENCY = 400;

function writeQuorum(n: number): number {
  return majorityOf(n);
}

function replicaLatency(id: string): number {
  if (id === "B") return 400;
  if (id === "C") return 1500;
  if (id === "D") return 700;
  if (id === "E") return 2200;
  return 1000;
}

export const quorum: Scenario = {
  id: "quorum",
  name: "Quorum Write",
  layout: "cluster",
  configurableNodeCount: true,
  defaultNodeCount: 3,
  description:
    "A coordinator writes to replicas. The write succeeds once a quorum of acknowledgements is reached — even if some replicas are slow or partitioned.",
  actions: [{ id: "client-set", label: "Client SET x = 5" }],
  createInitialState: (nodeCount = 3) => {
    const ids = clusterIds(nodeCount);
    const w = writeQuorum(ids.length);
    return {
      nodes: makeNodes(ids, (id) => ({
        role: id === "A" ? "COORDINATOR" : "REPLICA",
        x: 0,
        acks: id === "A" ? `0 / ${w}` : null,
        write: id === "A" ? "idle" : null,
        writeQuorum: id === "A" ? w : null,
      })),
    };
  },
  onStart() {},
  onAction(actionId, ctx) {
    if (actionId !== "client-set") return;
    startWrite(ctx);
  },
  onMessage(nodeId, message, ctx) {
    const payload = message.payload as {
      type: string;
      key?: string;
      value?: unknown;
      from?: string;
    };

    if (payload.type === "WRITE") {
      ctx.updateNodeState(nodeId, { x: payload.value });
      ctx.sendMessage(
        nodeId,
        message.from,
        { type: "ACK", key: payload.key, value: payload.value },
        ACK_LATENCY,
      );
      return;
    }

    if (payload.type === "ACK" && nodeId === "A") {
      const state = ctx.getNode("A").state;
      if (state.write !== "pending") return;
      const w = Number(state.writeQuorum ?? writeQuorum(nodeIds(ctx).length));
      const acks = Number(state.ackCount ?? 1) + 1;
      const success = acks >= w;
      ctx.updateNodeState("A", {
        ackCount: acks,
        acks: `${Math.min(acks, w)} / ${w}`,
        write: success ? "success" : "pending",
      });
      if (success && acks === w) {
        ctx.log(`write succeeds (quorum W=${w} reached)`);
      }
    }
  },
  summarizeNode(node) {
    const lines = [String(node.state.role), `x = ${String(node.state.x)}`];
    if (node.state.acks) lines.push(`acks: ${String(node.state.acks)}`);
    if (node.state.write) lines.push(`write: ${String(node.state.write)}`);
    return lines;
  },
  presentNode(node) {
    if (node.state.role === "COORDINATOR") {
      return {
        role: "COORDINATOR",
        primary: node.state.write === "pending" || node.state.acks ? "ACK" : `x = ${String(node.state.x)}`,
        secondary: node.state.acks ? String(node.state.acks) : String(node.state.write ?? "idle"),
      };
    }
    return { role: "REPLICA", primary: `x = ${String(node.state.x)}` };
  },
};

function startWrite(ctx: ScenarioContext) {
  const ids = nodeIds(ctx);
  const w = writeQuorum(ids.length);
  ctx.log("client SET x = 5 → coordinator A");
  ctx.updateNodeState("A", {
    x: 5,
    ackCount: 1,
    acks: `1 / ${w}`,
    write: "pending",
    writeQuorum: w,
  });
  for (const id of ids) {
    if (id === "A") continue;
    ctx.sendMessage("A", id, { type: "WRITE", key: "x", value: 5 }, replicaLatency(id));
  }
}
