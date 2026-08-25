import type {
  InspectorSection,
  Node,
  NodeDensity,
  NodePresentation,
  Scenario,
  Snapshot,
  TimerInfo,
} from "../simulation/types";

export type PresentedNode = NodePresentation & {
  density: NodeDensity;
  timer?: { name: string; remaining: number; total: number };
  showTimerLabel: boolean;
};

export function nodeDensity(count: number): NodeDensity {
  return count <= 3 ? "expanded" : "compact";
}

export function timerLabel(name: string): string {
  if (name === "election") return "Election";
  if (name === "heartbeat") return "Heartbeat";
  if (name === "failure-detect") return "Failure";
  if (name === "gossip") return "Gossip";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function presentNode(
  node: Node,
  scenario: Scenario,
  snapshot: Snapshot,
): PresentedNode {
  const density = nodeDensity(snapshot.nodes.length);
  const timer = primaryTimer(node.id, snapshot.timers, snapshot.currentTime);
  const custom = scenario.presentNode?.(node, snapshot);
  const showTimerLabel =
    custom?.showTimerLabel ??
    (density === "expanded" || timer?.name === "election" || timer?.name === "heartbeat");

  if (custom) {
    return {
      density,
      role: node.status === "stopped" ? "CRASHED" : custom.role,
      primary: custom.primary,
      secondary: custom.secondary,
      badges: custom.badges,
      placeholder: custom.placeholder,
      timer,
      showTimerLabel,
    };
  }

  const glance = scenario.glanceNode?.(node) ?? inferGlance(node);
  const role = pickRole(undefined, glance, node);
  const rest = role && glance[0] === role ? glance.slice(1) : glance;

  return {
    density,
    role: node.status === "stopped" ? "CRASHED" : role,
    primary: rest[0],
    secondary: rest[1],
    timer,
    showTimerLabel,
  };
}

export function inspectSections(
  node: Node,
  scenario: Scenario,
  snapshot: Snapshot,
): InspectorSection[] {
  if (scenario.inspectNode) return scenario.inspectNode(node, snapshot);
  const timers = snapshot.timers.filter((t) => t.nodeId === node.id);
  const s = node.state;
  if (typeof s.role === "string" && typeof s.term === "number") {
    const sections: InspectorSection[] = [
      {
        title: "Leadership",
        rows: [
          { label: "Role", value: String(s.role) },
          { label: "Term", value: String(s.term) },
          { label: "Leader", value: fmt(s.leader) },
          { label: "Voted for", value: fmt(s.votedFor) },
          {
            label: "Commit",
            value: typeof s.commitIndex === "number" && s.commitIndex < 0 ? "—" : fmt(s.commitIndex),
          },
        ],
      },
      {
        title: "Timers",
        rows:
          timers.length === 0
            ? [{ label: "—", value: "none" }]
            : timers.map((t) => ({
                label: timerLabel(t.name),
                value: `${Math.max(0, Math.round(t.fireAt - snapshot.currentTime))}ms`,
              })),
      },
    ];
    const log = Array.isArray(s.log) ? s.log : [];
    sections.push({
      title: "Log",
      rows:
        log.length === 0
          ? [{ label: "Entries", value: "empty" }]
          : [
              { label: "Entries", value: String(log.length) },
              ...log.map((entry, i) => ({ label: String(i), value: logLine(entry) })),
            ],
    });
    return sections;
  }

  const summary = scenario.summarizeNode?.(node) ?? [];
  return [
    {
      title: "State",
      rows: summary.map((line) => ({ label: "", value: line })),
    },
    {
      title: "Timers",
      rows:
        timers.length === 0
          ? [{ label: "—", value: "none" }]
          : timers.map((t) => ({
              label: timerLabel(t.name),
              value: `${Math.max(0, Math.round(t.fireAt - snapshot.currentTime))}ms`,
            })),
    },
  ];
}

function pickRole(custom: string | undefined, glance: string[], node: Node): string | undefined {
  if (custom) return custom;
  if (glance[0] && isRole(glance[0])) return glance[0];
  if (typeof node.state.role === "string") return node.state.role;
  return undefined;
}

function inferGlance(node: Node): string[] {
  const s = node.state;
  const lines: string[] = [];
  if (typeof s.role === "string") lines.push(s.role);
  if (typeof s.term === "number" && typeof s.leader === "string") {
    lines.push(`Term ${s.term} · Leader ${s.leader}`);
  } else if (typeof s.term === "number") {
    lines.push(`Term ${s.term}`);
  } else if (typeof s.leader === "string") {
    lines.push(`Leader ${s.leader}`);
  } else if (s.leader === null && s.role === "FOLLOWER") {
    lines.push("Term 0 · Leader —");
  }
  if (typeof s.commitIndex === "number" && s.role === "LEADER") {
    lines.push(`Commit ${s.commitIndex < 0 ? "—" : s.commitIndex}`);
  }
  if (typeof s.x === "number") lines.push(`x = ${s.x}`);
  if (s.suspectedFailed === true) lines.push("SUSPECTED");
  if (lines.length > 0) return lines;
  return Object.entries(s)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${fmt(v)}`);
}

function isRole(line: string): boolean {
  return /^(FOLLOWER|CANDIDATE|LEADER|PRIMARY|REPLICA|COORDINATOR|MONITORED|WATCHER|CRASHED)$/.test(
    line,
  );
}

function primaryTimer(
  nodeId: string,
  timers: TimerInfo[],
  now: number,
): PresentedNode["timer"] {
  const mine = timers
    .filter((t) => t.nodeId === nodeId)
    .sort((a, b) => a.fireAt - b.fireAt);
  const timer = mine[0];
  if (!timer) return undefined;
  const total = Math.max(1, timer.fireAt - (timer.setAt ?? now));
  const remaining = Math.max(0, timer.fireAt - now);
  return { name: timer.name, remaining, total };
}

function logLine(entry: unknown): string {
  if (!entry || typeof entry !== "object") return String(entry);
  const row = entry as Record<string, unknown>;
  const term = row.term != null ? `[${String(row.term)}]` : "";
  const command = row.command != null ? String(row.command) : JSON.stringify(entry);
  return `${term} ${command}`.trim();
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
