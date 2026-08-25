import type { Node, Scenario, Snapshot, TimerInfo } from "../simulation/types";

export type NodeGlance = {
  role?: string;
  lines: string[];
  timer?: { name: string; remaining: number; total: number };
};

export function glanceNode(
  node: Node,
  scenario: Scenario,
  snapshot: Snapshot,
): NodeGlance {
  const timer = primaryTimer(node.id, snapshot.timers, snapshot.currentTime);
  const lines = scenario.glanceNode?.(node) ?? inferGlance(node);
  const role = lines[0] && isRole(lines[0]) ? lines[0] : String(node.state.role ?? "");
  const rest = role && lines[0] === role ? lines.slice(1) : lines;
  return { role: role || undefined, lines: rest.slice(0, 3), timer };
}

function inferGlance(node: Node): string[] {
  const s = node.state;
  const lines: string[] = [];
  if (typeof s.role === "string") lines.push(s.role);
  if (typeof s.term === "number") lines.push(`Term ${s.term}`);
  if (typeof s.leader === "string") lines.push(`Leader: ${s.leader}`);
  else if (s.leader === null && s.role === "FOLLOWER") lines.push("Leader: —");
  if (typeof s.commitIndex === "number" && s.role === "LEADER") {
    lines.push(`Commit: ${s.commitIndex}`);
  }
  if (typeof s.x === "number") lines.push(`x = ${s.x}`);
  if (s.suspectedFailed === true) lines.push("suspects failure");
  if (lines.length > 0) return lines;
  return Object.entries(s)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${fmt(v)}`);
}

function isRole(line: string): boolean {
  return /^(FOLLOWER|CANDIDATE|LEADER|PRIMARY|REPLICA|COORDINATOR|MONITORED|WATCHER)$/.test(
    line,
  );
}

function primaryTimer(
  nodeId: string,
  timers: TimerInfo[],
  now: number,
): NodeGlance["timer"] {
  const mine = timers
    .filter((t) => t.nodeId === nodeId)
    .sort((a, b) => a.fireAt - b.fireAt);
  const timer = mine[0];
  if (!timer) return undefined;
  const total = Math.max(1, timer.fireAt - (timer.setAt ?? now));
  const remaining = Math.max(0, timer.fireAt - now);
  return { name: timer.name, remaining, total };
}

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "[object]";
    }
  }
  return String(v);
}
