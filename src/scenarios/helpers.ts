import type { Node, ScenarioContext } from "../simulation/types";

export const CLUSTER_IDS = ["A", "B", "C", "D", "E"] as const;
export const MIN_CLUSTER_SIZE = 2;
export const MAX_CLUSTER_SIZE = 5;

export function clusterIds(count = 3): string[] {
  const n = Math.min(MAX_CLUSTER_SIZE, Math.max(MIN_CLUSTER_SIZE, Math.round(count)));
  return CLUSTER_IDS.slice(0, n);
}

export function makeNodes(
  ids: string[],
  state: (id: string) => Record<string, unknown> = () => ({}),
): Node[] {
  return ids.map((id) => ({
    id,
    status: "running" as const,
    state: state(id),
  }));
}

export function nodeIds(ctx: ScenarioContext): string[] {
  return ctx.getNodes().map((n) => n.id);
}

export function majorityOf(count: number): number {
  return Math.floor(count / 2) + 1;
}

export function electionTimeoutFor(id: string): number {
  const i = CLUSTER_IDS.indexOf(id as (typeof CLUSTER_IDS)[number]);
  return 1500 + Math.max(0, i) * 500;
}
