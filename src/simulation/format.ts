export function payloadLabel(payload: unknown): string {
  const glance = payloadGlance(payload);
  return glance.secondary ? `${glance.primary} ${glance.secondary}` : glance.primary;
}

export function payloadGlance(payload: unknown): { primary: string; secondary?: string } {
  if (payload == null) return { primary: "message" };
  if (typeof payload !== "object") return { primary: String(payload) };
  const p = payload as Record<string, unknown>;
  const type = typeof p.type === "string" ? p.type : null;
  const term =
    typeof p.term === "number" ? `T${p.term}` : typeof p.term === "string" ? `T${p.term}` : undefined;

  switch (type) {
    case "PING":
    case "PONG":
    case "HEARTBEAT":
    case "ELECTION":
    case "OK":
    case "COORDINATOR":
    case "GOSSIP":
    case "WRITE":
    case "ACK":
      return { primary: type };
    case "RequestVote":
      return { primary: "RequestVote", secondary: term };
    case "VoteResponse":
      return { primary: p.granted ? "Vote ✓" : "Vote ✕", secondary: term };
    case "AppendEntries": {
      const entries = Array.isArray(p.entries) ? p.entries : [];
      return {
        primary: entries.length === 0 ? "Heartbeat" : "AppendEntries",
        secondary: term,
      };
    }
    case "AppendEntriesResponse":
      return { primary: p.success ? "Append ✓" : "Append ✕", secondary: term };
    case "REPLICATE":
    case "SET":
      return { primary: `SET ${String(p.key)}=${String(p.value)}` };
    case "ClientCommand":
      return { primary: String(p.command ?? "SET"), secondary: "client" };
    default:
      if (type) return { primary: type, secondary: term };
      try {
        return { primary: JSON.stringify(payload) };
      } catch {
        return { primary: "message" };
      }
  }
}

export function formatTime(ms: number): string {
  return `${Math.round(ms).toString().padStart(4, "0")}ms`;
}

export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function parseEdgeKey(key: string): [string, string] {
  const [a, b] = key.split("|");
  return [a, b];
}

export function latencyFor(
  latencies: [string, string, number][],
  a: string,
  b: string,
  fallback: number,
): number {
  const found = latencies.find(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
  return found ? found[2] : fallback;
}
