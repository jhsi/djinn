import * as stylex from "@stylexjs/stylex";
import type { Snapshot } from "../simulation/types";
import { formatTime } from "../simulation/format";
import { colors, fonts } from "../ui/theme.stylex";
import { describeEvent, eventKey, type Selection } from "../ui/selection";

type Props = {
  snapshot: Snapshot;
  selection: Selection;
  onSelect: (selection: Selection) => void;
};

export function EventTimeline({ snapshot, selection, onSelect }: Props) {
  return (
    <section {...stylex.props(styles.wrap)}>
      <header {...stylex.props(styles.head)}>
        <span>SYSTEM TRACE</span>
        <span {...stylex.props(styles.meta)}>
          next {snapshot.nextEvent ? formatTime(snapshot.nextEvent.timestamp) : "—"}
          {"  "}·{"  "}
          {snapshot.pendingCount} pending
        </span>
      </header>
      <div {...stylex.props(styles.list)}>
        {snapshot.eventLog.map((entry) => {
          const key = `log:${entry.seq}`;
          const selected = selection?.kind === "event" && selection.key === key;
          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelect({ kind: "event", key })}
              {...stylex.props(
                styles.row,
                styles.done,
                selected && styles.selected,
              )}
            >
              <span {...stylex.props(styles.time)}>{formatTime(entry.timestamp)}</span>
              <span {...stylex.props(styles.kind, kindStyle(entry.kind))}>
                {entry.kind}
              </span>
              <span {...stylex.props(styles.text)}>{entry.text}</span>
            </button>
          );
        })}
        {snapshot.pendingEvents.map((event, i) => {
          const key = eventKey(event);
          const isNext = i === 0;
          const selected = selection?.kind === "event" && selection.key === key;
          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelect({ kind: "event", key })}
              {...stylex.props(
                styles.row,
                isNext ? styles.next : styles.future,
                selected && styles.selected,
              )}
            >
              <span {...stylex.props(styles.time)}>{formatTime(event.timestamp)}</span>
              <span {...stylex.props(styles.kind, isNext ? styles.kindNext : styles.kindFuture)}>
                {isNext ? "next" : "queued"}
              </span>
              <span {...stylex.props(styles.text)}>
                {describeEvent(event, snapshot.inFlight)}
              </span>
            </button>
          );
        })}
        {snapshot.eventLog.length === 0 && snapshot.pendingEvents.length === 0 ? (
          <div {...stylex.props(styles.empty)}>no events yet</div>
        ) : null}
      </div>
      <div {...stylex.props(styles.bar)}>
        <span {...stylex.props(styles.barInk)} />
        <span {...stylex.props(styles.barCoral)} />
        <span {...stylex.props(styles.barLime)} />
      </div>
    </section>
  );
}

function kindStyle(kind: string) {
  if (kind === "drop" || kind === "crash" || kind === "partition") return styles.kindAlert;
  if (kind === "deliver" || kind === "heal" || kind === "restart") return styles.kindOk;
  return styles.kindDefault;
}

const styles = stylex.create({
  wrap: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: colors.faint,
    backgroundColor: colors.white,
    minHeight: 168,
    maxHeight: 220,
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 14px",
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: "0.16em",
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
  },
  meta: {
    letterSpacing: "0.04em",
    color: colors.muted,
    textTransform: "none",
    fontSize: 11,
  },
  list: {
    flex: 1,
    overflow: "auto",
    fontFamily: fonts.mono,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "72px 88px 1fr",
    gap: 10,
    width: "100%",
    textAlign: "left",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: "transparent",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
    padding: "5px 14px",
    cursor: "pointer",
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
  },
  done: {
    color: colors.muted,
  },
  next: {
    backgroundColor: colors.paleLime,
    color: colors.ink,
    fontWeight: 500,
    borderLeftColor: colors.lime,
  },
  future: {
    color: colors.ink,
    opacity: 0.72,
  },
  selected: {
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: colors.lime,
  },
  time: {
    fontVariantNumeric: "tabular-nums",
  },
  kind: {
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: 10,
    paddingTop: 2,
  },
  kindDefault: { color: colors.muted },
  kindOk: { color: colors.leaf },
  kindAlert: { color: colors.coral },
  kindNext: { color: colors.lime, fontWeight: 600 },
  kindFuture: { color: colors.muted },
  text: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  empty: {
    padding: 14,
    color: colors.muted,
    fontSize: 12,
  },
  bar: {
    display: "flex",
    height: 4,
    flexShrink: 0,
  },
  barInk: { flex: 3, backgroundColor: colors.ink },
  barCoral: { flex: 1, backgroundColor: colors.coral },
  barLime: { flex: 2, backgroundColor: colors.lime },
});
