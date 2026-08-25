import type { Scenario } from "../simulation/types";
import { makeNodes } from "./helpers";

export const pingPong: Scenario = {
  id: "ping-pong",
  name: "Ping / Pong",
  description: "Two nodes exchange a ping and a pong. Use this scenario to learn the Druid UI.",
  createInitialState: () => ({
    nodes: makeNodes(["A", "B"], (id) =>
      id === "A"
        ? { pingsSent: 0, pongsReceived: 0 }
        : { pingsReceived: 0, pongsSent: 0 },
    ),
  }),
  onStart(ctx) {
    ctx.updateNodeState("A", (s) => ({ ...s, pingsSent: 1 }));
    ctx.sendMessage("A", "B", { type: "PING" }, 500);
  },
  onMessage(nodeId, message, ctx) {
    const payload = message.payload as { type: string };
    if (payload.type === "PING" && nodeId === "B") {
      ctx.updateNodeState("B", (s) => ({
        ...s,
        pingsReceived: Number(s.pingsReceived ?? 0) + 1,
      }));
      ctx.updateNodeState("B", (s) => ({
        ...s,
        pongsSent: Number(s.pongsSent ?? 0) + 1,
      }));
      ctx.sendMessage("B", "A", { type: "PONG" }, 500);
    }
    if (payload.type === "PONG" && nodeId === "A") {
      ctx.updateNodeState("A", (s) => ({
        ...s,
        pongsReceived: Number(s.pongsReceived ?? 0) + 1,
      }));
    }
  },
  summarizeNode(node) {
    if (node.id === "A") {
      return [
        `pingsSent: ${String(node.state.pingsSent)}`,
        `pongsReceived: ${String(node.state.pongsReceived)}`,
      ];
    }
    return [
      `pingsReceived: ${String(node.state.pingsReceived)}`,
      `pongsSent: ${String(node.state.pongsSent)}`,
    ];
  },
};
