import type { Scenario } from "../simulation/types";
import { clusterIds, makeNodes, nodeIds } from "./helpers";

const INTERVAL = 1000;
const TIMEOUT = 3000;
const LATENCY = 100;

export const heartbeat: Scenario = {
  id: "heartbeat",
  name: "Heartbeats / Failure Detection",
  layout: "leader-centered",
  configurableNodeCount: true,
  defaultNodeCount: 3,
  description:
    "A sends heartbeats to the other nodes. They infer failure from silence — they cannot see a crash directly.",
  createInitialState: (nodeCount = 3) => ({
    nodes: makeNodes(clusterIds(nodeCount), (id) =>
      id === "A"
        ? { role: "MONITORED", heartbeatsSent: 0 }
        : {
            role: "WATCHER",
            watching: "A",
            lastHeartbeat: null,
            suspectedFailed: false,
          },
    ),
  }),
  onStart(ctx) {
    sendHeartbeats(ctx);
    ctx.setTimer("A", INTERVAL, "heartbeat");
    for (const id of nodeIds(ctx)) {
      if (id === "A") continue;
      ctx.setTimer(id, TIMEOUT, "failure-detect");
    }
  },
  onMessage(nodeId, message, ctx) {
    const payload = message.payload as { type: string; sentAt?: number };
    if (payload.type !== "HEARTBEAT") return;
    ctx.updateNodeState(nodeId, {
      lastHeartbeat: payload.sentAt ?? ctx.now(),
      suspectedFailed: false,
    });
    ctx.cancelTimers(nodeId, "failure-detect");
    ctx.setTimer(nodeId, TIMEOUT, "failure-detect");
  },
  onTimer(nodeId, timer, ctx) {
    if (timer.name === "heartbeat" && nodeId === "A") {
      sendHeartbeats(ctx);
      ctx.setTimer("A", INTERVAL, "heartbeat");
    }
    if (timer.name === "failure-detect") {
      ctx.updateNodeState(nodeId, { suspectedFailed: true });
      ctx.log(`${nodeId} suspects A has failed`);
    }
  },
  onRestart(nodeId, ctx) {
    if (nodeId === "A") {
      sendHeartbeats(ctx);
      ctx.setTimer("A", INTERVAL, "heartbeat");
    } else {
      ctx.setTimer(nodeId, TIMEOUT, "failure-detect");
    }
  },
  summarizeNode(node) {
    if (node.id === "A") {
      return ["MONITORED", `heartbeatsSent: ${String(node.state.heartbeatsSent)}`];
    }
    const last = node.state.lastHeartbeat;
    return [
      "WATCHER",
      `last heartbeat: ${last == null ? "never" : `${String(last)}ms`}`,
      `suspected failed: ${String(node.state.suspectedFailed)}`,
    ];
  },
  presentNode(node, snapshot) {
    if (node.id === "A") {
      return { role: "MONITORED", primary: "LIVE" };
    }
    if (node.state.suspectedFailed === true) {
      return { role: "WATCHER", primary: "SUSPECTED" };
    }
    const last = node.state.lastHeartbeat;
    const ago =
      last == null ? "never" : `${Math.max(0, Math.round(snapshot.currentTime - Number(last)))}ms`;
    return { role: "WATCHER", primary: "HEALTHY", secondary: `last heartbeat ${ago}` };
  },
};

function sendHeartbeats(ctx: Parameters<Scenario["onStart"]>[0]) {
  if (!ctx.isRunning("A")) return;
  ctx.updateNodeState("A", (s) => ({
    ...s,
    heartbeatsSent: Number(s.heartbeatsSent ?? 0) + 1,
  }));
  const sentAt = ctx.now();
  for (const to of nodeIds(ctx)) {
    if (to === "A") continue;
    ctx.sendMessage("A", to, { type: "HEARTBEAT", sentAt }, LATENCY);
  }
}
