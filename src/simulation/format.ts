export function payloadLabel(payload: unknown): string {
  if (payload == null) return "message";
  if (typeof payload !== "object") return String(payload);
  const p = payload as Record<string, unknown>;
  const type = typeof p.type === "string" ? p.type : null;

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
    case "RequestVote":
      return type;
    case "VoteResponse":
      return p.granted ? "Vote yes" : "Vote no";
    case "AppendEntries": {
      const entries = Array.isArray(p.entries) ? p.entries : [];
      return entries.length === 0 ? "Heartbeat" : `AppendEntries[${entries.length}]`;
    }
    case "AppendEntriesResponse":
      return p.success ? "Append OK" : "Append reject";
    case "REPLICATE":
    case "SET":
      return `SET ${String(p.key)}=${String(p.value)}`;
    case "ClientCommand":
      return String(p.command ?? "ClientCommand");
    default:
      if (type) return type;
      try {
        return JSON.stringify(payload);
      } catch {
        return "message";
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
