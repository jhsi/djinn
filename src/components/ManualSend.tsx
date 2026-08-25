import { useEffect, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import type { Snapshot } from "../simulation/types";
import { colors, fonts } from "../ui/theme.stylex";

type Props = {
  snapshot: Snapshot;
  onSend: (from: string, to: string, payload: unknown, latency: number) => void;
};

export function ManualSend({ snapshot, onSend }: Props) {
  const ids = snapshot.nodes.map((n) => n.id);
  const [from, setFrom] = useState(ids[0] ?? "A");
  const [to, setTo] = useState(ids[1] ?? "B");
  const [payload, setPayload] = useState("hello");
  const [latency, setLatency] = useState("500");

  useEffect(() => {
    if (ids.length > 0 && !ids.includes(from)) setFrom(ids[0]);
    if (ids.length > 1 && !ids.includes(to)) setTo(ids[1] ?? ids[0]);
  }, [ids, from, to]);

  return (
    <section {...stylex.props(styles.wrap)}>
      <header {...stylex.props(styles.head)}>MANUAL SEND</header>
      <form
        {...stylex.props(styles.form)}
        onSubmit={(e) => {
          e.preventDefault();
          const body = parsePayload(payload);
          onSend(from, to, body, Number(latency) || 0);
        }}
      >
        <label {...stylex.props(styles.field)}>
          <span>From</span>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            {...stylex.props(styles.input)}
          >
            {ids.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label {...stylex.props(styles.field)}>
          <span>To</span>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            {...stylex.props(styles.input)}
          >
            {ids.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label {...stylex.props(styles.fieldWide)}>
          <span>Payload</span>
          <input
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            {...stylex.props(styles.input)}
          />
        </label>
        <label {...stylex.props(styles.field)}>
          <span>Latency</span>
          <input
            type="number"
            min={0}
            value={latency}
            onChange={(e) => setLatency(e.target.value)}
            {...stylex.props(styles.input)}
          />
        </label>
        <button type="submit" {...stylex.props(styles.send)}>
          Send
        </button>
      </form>
    </section>
  );
}

function parsePayload(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return { type: "MANUAL", value: "" };
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return { type: "MANUAL", value: trimmed };
    }
  }
  return { type: "MANUAL", value: trimmed };
}

const styles = stylex.create({
  wrap: { flex: "0 0 auto" },
  head: {
    padding: "8px 12px",
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: "0.16em",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
    color: colors.ink,
  },
  form: {
    padding: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.ink,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: colors.muted,
  },
  fieldWide: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: colors.muted,
    gridColumn: "1 / -1",
  },
  input: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.ink,
    backgroundColor: colors.white,
    fontFamily: fonts.mono,
    fontSize: 12,
    padding: "5px 8px",
    color: colors.ink,
  },
  send: {
    gridColumn: "1 / -1",
    backgroundColor: colors.lime,
    color: colors.ink,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 12,
    padding: "7px 10px",
    cursor: "pointer",
    fontWeight: 600,
  },
});
