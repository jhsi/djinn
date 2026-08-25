import type { LogEntry, LogKind, Message, SimulationEvent, Snapshot } from "../simulation/types";
import { CLIENT_ID } from "../simulation/types";
import { payloadLabel, edgeKey } from "../simulation/format";
import { timerLabel } from "./presentation";

export type Selection =
  | { kind: "node"; id: string }
  | { kind: "message"; id: string }
  | { kind: "event"; key: string }
  | { kind: "edge"; a: string; b: string }
  | null;

export function describeEvent(
  event: SimulationEvent,
  inFlight: Message[],
): string {
  const parts = eventParts(event, inFlight);
  return parts.actor ? `${parts.actor} ${parts.text}` : parts.text;
}

export function eventParts(
  event: SimulationEvent,
  inFlight: Message[],
): { actor: string; text: string } {
  if (event.type === "deliver") {
    const message = inFlight.find((m) => m.id === event.messageId);
    if (message) {
      return {
        actor: displayActor(message.to),
        text: `receives ${payloadLabel(message.payload)} from ${displayActor(message.from)}`,
      };
    }
    return { actor: "", text: `deliver ${event.messageId}` };
  }
  return { actor: displayActor(event.nodeId), text: `${timerLabel(event.name)} timeout` };
}

export function displayActor(id: string | undefined | null): string {
  if (!id) return "";
  if (id === CLIENT_ID || id === "client") return "Client";
  return id;
}

export function logActor(entry: LogEntry): string {
  return displayActor(logActorId(entry));
}

function logActorId(entry: LogEntry): string {
  const meta = entry.meta ?? {};
  if (typeof meta.nodeId === "string") return meta.nodeId;
  if (entry.kind === "send" && typeof meta.from === "string") return meta.from;
  if (typeof meta.to === "string") return meta.to;
  if (typeof meta.from === "string") return meta.from;
  return "";
}

export function formatLogRow(entry: LogEntry): { kind: string; actor: string; text: string } {
  const meta = entry.meta ?? {};
  const from = typeof meta.from === "string" ? meta.from : "";
  const to = typeof meta.to === "string" ? meta.to : "";
  const label = meta.payload !== undefined ? payloadLabel(meta.payload) : "";

  if (entry.kind === "send") {
    const client = from === CLIENT_ID;
    return {
      kind: client ? "CLIENT" : "SEND",
      actor: client ? "" : displayActor(from),
      text: `→ ${displayActor(to)} ${label}`.trim(),
    };
  }
  if (entry.kind === "deliver") {
    return {
      kind: "RECEIVE",
      actor: displayActor(to),
      text: `← ${displayActor(from)} ${label}`.trim(),
    };
  }

  const actor = logActor(entry);
  return {
    kind: kindLabel(entry.kind, meta),
    actor,
    text: stripActorPrefix(entry.text, [logActorId(entry), actor, from, to, "client", "Client"]),
  };
}

export function kindLabel(kind: LogKind, meta?: Record<string, unknown>): string {
  if (kind === "send" && meta?.from === CLIENT_ID) return "CLIENT";
  switch (kind) {
    case "timer":
      return "TIMER";
    case "send":
      return "SEND";
    case "deliver":
      return "RECEIVE";
    case "state":
      return "STATE";
    case "drop":
    case "crash":
      return "FAILURE";
    case "restart":
      return "STATE";
    case "partition":
    case "heal":
    case "delay":
      return "NETWORK";
    default:
      return "NOTE";
  }
}

function stripActorPrefix(text: string, names: string[]): string {
  let next = text.trim();
  for (const name of names) {
    if (!name) continue;
    if (next.startsWith(`${name} `) || next.startsWith(`${name}→`)) {
      next = next.slice(name.length).trim();
      break;
    }
  }
  return next;
}

export function eventKey(event: SimulationEvent): string {
  return `${event.type}:${event.id}:${event.seq}`;
}

export function selectionFromLog(entry: LogEntry, snapshot: Snapshot): Selection {
  const meta = entry.meta ?? {};
  const messageId = typeof meta.messageId === "string" ? meta.messageId : null;
  if (messageId && snapshot.inFlight.some((message) => message.id === messageId)) {
    return { kind: "message", id: messageId };
  }
  if (typeof meta.nodeId === "string") {
    return { kind: "node", id: meta.nodeId };
  }
  if (typeof meta.to === "string" && (entry.kind === "deliver" || entry.kind === "send")) {
    if (entry.kind === "send" && typeof meta.from === "string") {
      if (meta.from === CLIENT_ID) return { kind: "node", id: meta.to };
      return { kind: "node", id: meta.from };
    }
    return { kind: "node", id: meta.to };
  }
  if (
    (entry.kind === "partition" || entry.kind === "heal") &&
    typeof meta.a === "string" &&
    typeof meta.b === "string"
  ) {
    return { kind: "edge", a: meta.a, b: meta.b };
  }
  if (typeof meta.from === "string" && typeof meta.to === "string") {
    return { kind: "edge", a: meta.from, b: meta.to };
  }
  return { kind: "event", key: `log:${entry.seq}` };
}

export function isPartitioned(
  partitions: [string, string][],
  a: string,
  b: string,
): boolean {
  return partitions.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

export type CanvasEmphasis = {
  nodes: Set<string>;
  edges: Set<string>;
  messages: Set<string>;
};

export function canvasEmphasis(selection: Selection, snapshot: Snapshot): CanvasEmphasis {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  const messages = new Set<string>();
  if (!selection) return { nodes, edges, messages };

  if (selection.kind === "node") {
    nodes.add(selection.id);
  } else if (selection.kind === "message") {
    const message = snapshot.inFlight.find((m) => m.id === selection.id);
    if (message) markMessage(message.from, message.to, message.id, nodes, edges, messages);
  } else if (selection.kind === "edge") {
    nodes.add(selection.a);
    nodes.add(selection.b);
    edges.add(edgeKey(selection.a, selection.b));
  } else if (selection.kind === "event") {
    const log = snapshot.tapeLog.find((e) => `log:${e.seq}` === selection.key);
    if (log) {
      applyMeta(log.meta, log.kind, snapshot, nodes, edges, messages);
    } else {
      const pending = snapshot.pendingEvents.find((e) => eventKey(e) === selection.key);
      if (pending?.type === "timer") nodes.add(pending.nodeId);
      if (pending?.type === "deliver") {
        const message = snapshot.inFlight.find((m) => m.id === pending.messageId);
        if (message) markMessage(message.from, message.to, message.id, nodes, edges, messages);
      }
    }
  }
  return { nodes, edges, messages };
}

function applyMeta(
  meta: Record<string, unknown> | undefined,
  kind: string,
  snapshot: Snapshot,
  nodes: Set<string>,
  edges: Set<string>,
  messages: Set<string>,
) {
  const from = typeof meta?.from === "string" ? meta.from : null;
  const to = typeof meta?.to === "string" ? meta.to : null;
  const nodeId = typeof meta?.nodeId === "string" ? meta.nodeId : null;
  const messageId = typeof meta?.messageId === "string" ? meta.messageId : null;
  const a = typeof meta?.a === "string" ? meta.a : null;
  const b = typeof meta?.b === "string" ? meta.b : null;
  if (nodeId) nodes.add(nodeId);
  if (from) nodes.add(from);
  if (to) nodes.add(to);
  if (from && to) edges.add(edgeKey(from, to));
  if (a && b) {
    nodes.add(a);
    nodes.add(b);
    edges.add(edgeKey(a, b));
  }
  if (messageId) {
    messages.add(messageId);
    const live = snapshot.inFlight.find((m) => m.id === messageId);
    if (live) markMessage(live.from, live.to, live.id, nodes, edges, messages);
  }
  void kind;
}

function markMessage(
  from: string,
  to: string,
  id: string,
  nodes: Set<string>,
  edges: Set<string>,
  messages: Set<string>,
) {
  nodes.add(from);
  nodes.add(to);
  edges.add(edgeKey(from, to));
  messages.add(id);
}
