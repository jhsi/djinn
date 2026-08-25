import { describe, expect, it } from "vitest";
import { payloadGlance, payloadLabel } from "../simulation/format";
import { formatLogRow } from "./selection";
import type { LogEntry } from "../simulation/types";

describe("payloadGlance compact labels", () => {
  it("uses short Raft identities on the canvas", () => {
    expect(payloadGlance({ type: "AppendEntries", term: 1, entries: [] }, true).primary).toBe("HB");
    expect(payloadGlance({ type: "AppendEntries", term: 2, entries: [{}] }, true).primary).toBe("AE");
    expect(payloadGlance({ type: "AppendEntriesResponse", success: true, term: 2 }, true).primary).toBe("ACK");
    expect(payloadGlance({ type: "RequestVote", term: 1 }, true).primary).toBe("RV");
    expect(payloadGlance({ type: "VoteResponse", granted: true, term: 1 }, true).primary).toBe("VOTE");
    expect(payloadGlance({ type: "ClientCommand", command: "SET x+=1" }, true).primary).toBe("SET x+=1");
    expect(payloadGlance({ type: "GOSSIP", values: { x: 42 } }, true).primary).toBe("[x]");
  });

  it("keeps readable names for the trace and inspector", () => {
    expect(payloadLabel({ type: "AppendEntries", term: 1, entries: [] })).toBe("Heartbeat T1");
    expect(payloadLabel({ type: "ClientCommand", command: "SET x+=1" })).toBe("SET x+=1");
  });
});

describe("formatLogRow", () => {
  it("does not repeat Client in the actor and text columns", () => {
    const send: LogEntry = {
      seq: 1,
      timestamp: 3000,
      kind: "send",
      text: "client → A  SET x+=1",
      meta: {
        from: "client",
        to: "A",
        payload: { type: "ClientCommand", command: "SET x+=1" },
      },
    };
    expect(formatLogRow(send)).toEqual({
      kind: "CLIENT",
      actor: "",
      text: "→ A SET x+=1",
    });

    const receive: LogEntry = {
      seq: 2,
      timestamp: 3100,
      kind: "deliver",
      text: "A ← SET x+=1  (client)",
      meta: {
        from: "client",
        to: "A",
        payload: { type: "ClientCommand", command: "SET x+=1" },
      },
    };
    expect(formatLogRow(receive)).toEqual({
      kind: "RECEIVE",
      actor: "A",
      text: "← Client SET x+=1",
    });
  });
});
