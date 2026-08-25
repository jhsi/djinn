import type { Scenario } from "../simulation/types";
import { makeNodes } from "./helpers";

const INTERVAL = 1000;
const TIMEOUT = 3000;
const LATENCY = 100;

export const heartbeat: Scenario = {
  id: "heartbeat",
  name: "Heartbeats / Failure Detection",
  description:
    "A sends heartbeats to B and C. They infer failure from silence — they cannot see a crash directly.",
  createInitialState: () => ({
    nodes: makeNodes(["A", "B", "C"], (id) =>
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
    for (const id of ["B", "C"]) {
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
};

function sendHeartbeats(ctx: Parameters<Scenario["onStart"]>[0]) {
  if (!ctx.isRunning("A")) return;
  ctx.updateNodeState("A", (s) => ({
    ...s,
    heartbeatsSent: Number(s.heartbeatsSent ?? 0) + 1,
  }));
  const sentAt = ctx.now();
  for (const to of ["B", "C"]) {
    ctx.sendMessage("A", to, { type: "HEARTBEAT", sentAt }, LATENCY);
  }
}
