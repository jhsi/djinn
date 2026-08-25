import type { LogEntry, Message, SimulationEvent, Snapshot } from "../simulation/types";
import { payloadLabel } from "../simulation/format";

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
  if (event.type === "deliver") {
    const message = inFlight.find((m) => m.id === event.messageId);
    if (message) {
      return `${message.to} receives ${payloadLabel(message.payload)} from ${message.from}`;
    }
    return `deliver ${event.messageId}`;
  }
  return `${event.nodeId} timer ${event.name}`;
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
