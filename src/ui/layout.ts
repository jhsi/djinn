import { CLIENT_ID, type GraphLayout, type Node, type Scenario } from "../simulation/types";

export type Pos = { id: string; x: number; y: number };

export function resolveLayout(scenario: Scenario, nodes: Node[]): GraphLayout {
  if (nodes.length <= 2) return "line";
  if (scenario.layout === "leader-centered" || scenario.layout === "cluster") {
    return scenario.layout;
  }
  if (nodes.length === 3 && (scenario.layout === "triangle" || !scenario.layout)) {
    return "triangle";
  }
  if (scenario.layout === "ring" || nodes.length >= 4) return "ring";
  if (scenario.layout) return scenario.layout;
  if (nodes.length === 3) return "triangle";
  return "ring";
}

export function layoutGraph(
  ids: string[],
  nodes: Node[],
  scenario: Scenario,
  width: number,
  height: number,
  client: boolean,
): Pos[] {
  const kind = resolveLayout(scenario, nodes);
  const padX = Math.min(168, Math.max(108, width * 0.15)) + (client ? 72 : 0);
  const padY = Math.min(140, Math.max(92, height * 0.17));
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);

  if (kind === "line" || ids.length <= 2) {
    return [
      { id: ids[0], x: padX + innerW * 0.22, y: padY + innerH * 0.5 },
      { id: ids[1], x: padX + innerW * 0.78, y: padY + innerH * 0.5 },
    ].filter((p) => p.id);
  }

  if (kind === "leader-centered" || kind === "cluster") {
    const lead =
      nodes.find(
        (n) =>
          n.state.role === "LEADER" ||
          n.state.role === "PRIMARY" ||
          n.state.role === "COORDINATOR" ||
          n.state.role === "MONITORED",
      )?.id ?? ids[0];
    const rest = ids.filter((id) => id !== lead);
    if (rest.length === 0) {
      return [{ id: lead, x: padX + innerW * 0.5, y: padY + innerH * 0.5 }];
    }
    const out: Pos[] = [{ id: lead, x: padX + innerW * 0.5, y: padY + innerH * 0.16 }];
    rest.forEach((id, i) => {
      const t = rest.length === 1 ? 0.5 : i / (rest.length - 1);
      out.push({
        id,
        x: padX + innerW * (0.18 + t * 0.64),
        y: padY + innerH * 0.78,
      });
    });
    return out;
  }

  if (kind === "triangle" && ids.length === 3) {
    return [
      { id: ids[0], x: padX + innerW * 0.5, y: padY + innerH * 0.18 },
      { id: ids[1], x: padX + innerW * 0.18, y: padY + innerH * 0.78 },
      { id: ids[2], x: padX + innerW * 0.82, y: padY + innerH * 0.78 },
    ];
  }

  const cx = padX + innerW * 0.5;
  const cy = padY + innerH * 0.5;
  const rx = innerW * (ids.length >= 5 ? 0.42 : 0.38);
  const ry = innerH * (ids.length >= 5 ? 0.42 : 0.36);
  return ids.map((id, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / ids.length;
    return { id, x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

export function layoutClient(positions: Pos[], width: number, height: number): Pos {
  if (positions.length === 0) {
    return { id: CLIENT_ID, x: Math.min(88, width * 0.12), y: height * 0.42 };
  }
  const top = positions.reduce((a, b) => (a.y < b.y ? a : b));
  const x = Math.max(72, top.x - 168);
  return { id: CLIENT_ID, x, y: top.y };
}
