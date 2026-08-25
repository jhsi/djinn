import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import type { Snapshot } from "../simulation/types";
import { colors, fonts } from "../ui/theme.stylex";
import { isPartitioned, type Selection } from "../ui/selection";

type Props = {
  snapshot: Snapshot;
  selection: Selection;
  onDelay: (messageId: string, timestamp: number) => void;
  onDrop: (messageId: string) => void;
  onPartition: (a: string, b: string) => void;
  onHeal: (a: string, b: string) => void;
  onCrash: (nodeId: string) => void;
  onRestart: (nodeId: string) => void;
};

export function PerturbationControls({
  snapshot,
  selection,
  onDelay,
  onDrop,
  onPartition,
  onHeal,
  onCrash,
  onRestart,
}: Props) {
  const message =
    selection?.kind === "message"
      ? snapshot.inFlight.find((m) => m.id === selection.id)
      : undefined;
  const node =
    selection?.kind === "node"
      ? snapshot.nodes.find((n) => n.id === selection.id)
      : undefined;
  const edge = selection?.kind === "edge" ? selection : null;
  const partitioned = edge
    ? isPartitioned(snapshot.partitions, edge.a, edge.b)
    : false;

  const [delayTo, setDelayTo] = useState("");
  const delayValue = delayTo || (message ? String(message.deliverAt) : "");

  return (
    <section {...stylex.props(styles.wrap)}>
      <header {...stylex.props(styles.head)}>PERTURB</header>
      <div {...stylex.props(styles.body)}>
        {message ? (
          <div {...stylex.props(styles.group)}>
            <div {...stylex.props(styles.label)}>
              delay {message.from} → {message.to}
            </div>
            <div {...stylex.props(styles.row)}>
              <input
                type="number"
                min={snapshot.currentTime}
                value={delayValue}
                onChange={(e) => setDelayTo(e.target.value)}
                {...stylex.props(styles.input)}
              />
              <button
                type="button"
                onClick={() => onDelay(message.id, Number(delayValue))}
                {...stylex.props(styles.btn)}
              >
                Delay
              </button>
              <button
                type="button"
                onClick={() => onDrop(message.id)}
                {...stylex.props(styles.danger)}
              >
                Drop
              </button>
            </div>
          </div>
        ) : null}

        {node ? (
          <div {...stylex.props(styles.group)}>
            <div {...stylex.props(styles.label)}>node {node.id}</div>
            <div {...stylex.props(styles.row)}>
              {node.status === "running" ? (
                <button
                  type="button"
                  onClick={() => onCrash(node.id)}
                  {...stylex.props(styles.danger)}
                >
                  Crash
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onRestart(node.id)}
                  {...stylex.props(styles.btn)}
                >
                  Restart
                </button>
              )}
            </div>
          </div>
        ) : null}

        {edge ? (
          <div {...stylex.props(styles.group)}>
            <div {...stylex.props(styles.label)}>
              {edge.a} ↔ {edge.b}
            </div>
            <div {...stylex.props(styles.row)}>
              {partitioned ? (
                <button
                  type="button"
                  onClick={() => onHeal(edge.a, edge.b)}
                  {...stylex.props(styles.btn)}
                >
                  Heal partition
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onPartition(edge.a, edge.b)}
                  {...stylex.props(styles.danger)}
                >
                  Partition
                </button>
              )}
            </div>
          </div>
        ) : null}

        {!message && !node && !edge ? (
          <div {...stylex.props(styles.hint)}>
            Select a message to delay or drop, a node to crash, or a link to
            partition.
          </div>
        ) : null}
      </div>
    </section>
  );
}

const styles = stylex.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
    flex: "0 0 auto",
  },
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
  body: { padding: 12, fontFamily: fonts.mono },
  group: { marginBottom: 8 },
  label: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 6,
  },
  row: { display: "flex", gap: 6, flexWrap: "wrap" },
  input: {
    width: 88,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.faint,
    backgroundColor: colors.bg,
    fontFamily: fonts.mono,
    fontSize: 12,
    padding: "5px 8px",
    color: colors.ink,
  },
  btn: {
    backgroundColor: colors.lime,
    color: colors.charcoal,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.lime,
    fontFamily: fonts.mono,
    fontSize: 12,
    padding: "5px 10px",
    cursor: "pointer",
  },
  danger: {
    backgroundColor: "transparent",
    color: colors.coral,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.coral,
    fontFamily: fonts.mono,
    fontSize: 12,
    padding: "5px 10px",
    cursor: "pointer",
  },
  hint: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 1.5,
  },
});
