export function payloadLabel(payload: unknown): string {
  const glance = payloadGlance(payload);
  return glance.secondary ? `${glance.primary} ${glance.secondary}` : glance.primary;
}

export function payloadGlance(
  payload: unknown,
  compact = false,
): { primary: string; secondary?: string } {
  if (payload == null) return { primary: "message" };
  if (typeof payload !== "object") return { primary: String(payload) };
  const p = payload as Record<string, unknown>;
  const type = typeof p.type === "string" ? p.type : null;
  const term =
    typeof p.term === "number" ? `T${p.term}` : typeof p.term === "string" ? `T${p.term}` : undefined;

  switch (type) {
    case "PING":
    case "PONG":
    case "ELECTION":
    case "OK":
    case "COORDINATOR":
      return { primary: compact ? type.slice(0, 2) : type, secondary: term };
    case "HEARTBEAT":
      return { primary: compact ? "HB" : "Heartbeat", secondary: term };
    case "GOSSIP": {
      const values =
        p.values && typeof p.values === "object" && !Array.isArray(p.values)
          ? Object.keys(p.values as Record<string, unknown>)
          : [];
      if (values.length === 0) return { primary: compact ? "[ ]" : "GOSSIP" };
      const shown = values.length <= 2 ? `[${values.join(",")}]` : `[${values.length}]`;
      return { primary: compact ? shown : `GOSSIP ${shown}` };
    }
    case "WRITE":
      return { primary: compact ? "SET" : "WRITE" };
    case "ACK":
      return { primary: compact ? "ACK" : "ACK" };
    case "RequestVote":
      return { primary: compact ? "RV" : "RequestVote", secondary: term };
    case "VoteResponse":
      return {
        primary: p.granted ? (compact ? "VOTE" : "Vote granted") : compact ? "NO" : "Vote denied",
        secondary: term,
      };
    case "AppendEntries": {
      const entries = Array.isArray(p.entries) ? p.entries : [];
      return {
        primary: entries.length === 0 ? (compact ? "HB" : "Heartbeat") : compact ? "AE" : "AppendEntries",
        secondary: term,
      };
    }
    case "AppendEntriesResponse":
      return { primary: p.success ? (compact ? "ACK" : "Append ACK") : compact ? "NAK" : "Append NAK", secondary: term };
    case "REPLICATE":
    case "SET":
      return { primary: compact ? "SET" : `SET ${String(p.key)}=${String(p.value)}` };
    case "ClientCommand": {
      const command = String(p.command ?? "SET x+=1");
      return { primary: compact && command.length > 8 ? "SET" : command };
    }
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
