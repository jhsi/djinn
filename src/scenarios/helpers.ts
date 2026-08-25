import type { Node } from "../simulation/types";

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
