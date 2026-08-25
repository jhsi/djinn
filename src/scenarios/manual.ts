import type { Scenario } from "../simulation/types";
import { makeNodes } from "./helpers";

export const manual: Scenario = {
  id: "manual",
  name: "Manual",
  description:
    "Empty sandbox. Use the send form to inject messages onto the same deterministic event queue.",
  createInitialState: () => ({
    nodes: makeNodes(["A", "B", "C"], () => ({ inbox: [] as unknown[] })),
  }),
  onStart() {},
  onMessage(nodeId, message, ctx) {
    ctx.updateNodeState(nodeId, (s) => ({
      ...s,
      inbox: [...((s.inbox as unknown[]) ?? []), message.payload],
    }));
  },
  summarizeNode(node) {
    const inbox = (node.state.inbox as unknown[]) ?? [];
    return [`inbox: ${inbox.length}`];
  },
};
