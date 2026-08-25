import type { Scenario, ScenarioContext } from "../simulation/types";
import { makeNodes } from "./helpers";

const N = 3;
const W = 2;
const TO_B = 400;
const TO_C = 1500;
const ACK_LATENCY = 400;

export const quorum: Scenario = {
  id: "quorum",
  name: "Quorum Write",
  description: `N=${N} replicas, W=${W} acknowledgements. The write can succeed even if one replica is slow or partitioned.`,
  actions: [{ id: "client-set", label: "Client SET x = 5" }],
  createInitialState: () => ({
    nodes: makeNodes(["A", "B", "C"], (id) => ({
      role: id === "A" ? "COORDINATOR" : "REPLICA",
      x: 0,
      acks: id === "A" ? "0 / 2" : null,
      write: id === "A" ? "idle" : null,
    })),
  }),
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
      const acks = Number(state.ackCount ?? 1) + 1;
      const success = acks >= W;
      ctx.updateNodeState("A", {
        ackCount: acks,
        acks: `${Math.min(acks, W)} / ${W}`,
        write: success ? "success" : "pending",
      });
      if (success && acks === W) {
        ctx.log("write succeeds (quorum W=2 reached)");
      }
    }
  },
  summarizeNode(node) {
    const lines = [String(node.state.role), `x = ${String(node.state.x)}`];
    if (node.state.acks) lines.push(`acks: ${String(node.state.acks)}`);
    if (node.state.write) lines.push(`write: ${String(node.state.write)}`);
    return lines;
  },
};

function startWrite(ctx: ScenarioContext) {
  ctx.log("client SET x = 5 → coordinator A");
  ctx.updateNodeState("A", {
    x: 5,
    ackCount: 1,
    acks: "1 / 2",
    write: "pending",
  });
  ctx.sendMessage("A", "B", { type: "WRITE", key: "x", value: 5 }, TO_B);
  ctx.sendMessage("A", "C", { type: "WRITE", key: "x", value: 5 }, TO_C);
}
