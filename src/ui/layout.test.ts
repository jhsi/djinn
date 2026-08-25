import { describe, expect, it } from "vitest";
import { CLIENT_ID, type Node, type Scenario } from "../simulation/types";
import { CLIENT_NODE_GAP, layoutClient, layoutGraph } from "./layout";

const NODE_HALF = 86;
const CLIENT_HALF = 59;

const raft: Scenario = {
  id: "raft",
  name: "Raft",
  layout: "triangle",
  description: "",
  createInitialState: () => ({ nodes: [] }),
  onStart: () => {},
  onMessage: () => {},
};

function nodes(ids: string[]): Node[] {
  return ids.map((id) => ({ id, status: "running", state: {} }));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function layout(ids: string[], width: number, height = 520) {
  const graph = layoutGraph(ids, nodes(ids), raft, width, height, true);
  const client = layoutClient(graph, width, height);
  return { graph, client };
}

describe("layoutClient", () => {
  it("sits left of A on a 2-node line without overlapping A or B", () => {
    for (const width of [640, 800, 1100]) {
      const { graph, client } = layout(["A", "B"], width);
      const a = graph.find((p) => p.id === "A")!;
      const b = graph.find((p) => p.id === "B")!;
      expect(client.id).toBe(CLIENT_ID);
      expect(client.x).toBeLessThan(a.x);
      expect(a.x).toBeLessThan(b.x);
      expect(b.x - a.x).toBeLessThan(width * 0.55);
      expect(Math.abs(client.y - a.y)).toBeLessThan(1);
      expect(dist(client, a)).toBeGreaterThanOrEqual(NODE_HALF + CLIENT_HALF + 24);
      expect(dist(client, b)).toBeGreaterThanOrEqual(NODE_HALF + CLIENT_HALF + 24);
      expect(a.x - client.x).toBeGreaterThanOrEqual(CLIENT_NODE_GAP - 1);
    }
  });

  it("stays left of the top node on a 3-node triangle", () => {
    const { graph, client } = layout(["A", "B", "C"], 900);
    const a = graph.find((p) => p.id === "A")!;
    expect(client.x).toBeLessThan(a.x);
    expect(Math.abs(client.y - a.y)).toBeLessThan(1);
    expect(dist(client, a)).toBeGreaterThanOrEqual(NODE_HALF + CLIENT_HALF);
  });
});
