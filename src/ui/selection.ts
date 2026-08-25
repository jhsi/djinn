import type { Message, SimulationEvent } from "../simulation/types";
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

export function isPartitioned(
  partitions: [string, string][],
  a: string,
  b: string,
): boolean {
  return partitions.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}
