import { useEffect, useRef } from "react";
import * as stylex from "@stylexjs/stylex";
import type { LogEntry, LogKind, SimulationEvent, Snapshot } from "../simulation/types";
import { formatTime } from "../simulation/format";
import { colors, fonts } from "../ui/theme.stylex";
import { describeEvent, eventKey, type Selection } from "../ui/selection";
import { PlaybackRuler } from "./PlaybackRuler";

type Props = {
  snapshot: Snapshot;
  selection: Selection;
  onSeekTime: (time: number) => void;
  onSeekLog: (entry: LogEntry) => void;
  onSeekPending: (event: SimulationEvent) => void;
};

export function EventTimeline({
  snapshot,
  selection,
  onSeekTime,
  onSeekLog,
  onSeekPending,
}: Props) {
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [snapshot.playheadLogSeq, snapshot.currentTime]);

  const pending = snapshot.atTip ? snapshot.pendingEvents : [];
  const groups = groupByTime(snapshot.tapeLog);

  return (
    <section {...stylex.props(styles.wrap)}>
      <header {...stylex.props(styles.head)}>
        <span>SYSTEM TRACE</span>
        <span {...stylex.props(styles.meta)}>
          {snapshot.atTip
            ? `next ${snapshot.nextEvent ? formatTime(snapshot.nextEvent.timestamp) : "—"}  ·  ${snapshot.pendingCount} pending`
            : `playhead ${formatTime(snapshot.currentTime)}  ·  recorded to ${formatTime(snapshot.exploredUntil)}`}
        </span>
      </header>
      <PlaybackRuler snapshot={snapshot} onSeek={onSeekTime} />
      <div {...stylex.props(styles.list)}>
        {groups.map((group) => (
          <div key={group[0].seq} {...stylex.props(styles.cluster)}>
            <div {...stylex.props(styles.stamp)}>{formatTime(group[0].timestamp)}</div>
            <div {...stylex.props(styles.events)}>
              {group.map((entry, i) => {
                const key = `log:${entry.seq}`;
                const selected = selection?.kind === "event" && selection.key === key;
                const current = entry.seq === snapshot.playheadLogSeq;
                const ahead = entry.seq > snapshot.playheadLogSeq;
                const child = i > 0 && isChildKind(entry.kind, group[0].kind);
                return (
                  <button
                    type="button"
                    key={key}
                    ref={current ? currentRef : undefined}
                    onClick={() => onSeekLog(entry)}
                    {...stylex.props(
                      styles.row,
                      ahead ? styles.ahead : styles.done,
                      current && styles.current,
                      selected && styles.selected,
                      child && styles.child,
                    )}
                  >
                    <span {...stylex.props(styles.kind, kindStyle(entry.kind))}>
                      {kindLabel(entry.kind)}
                    </span>
                    <span {...stylex.props(styles.text)}>{entry.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {pending.map((event, i) => {
          const key = eventKey(event);
          const isNext = i === 0;
          const selected = selection?.kind === "event" && selection.key === key;
          return (
            <button
              type="button"
              key={key}
              ref={isNext && snapshot.tapeLog.length === 0 ? currentRef : undefined}
              onClick={() => onSeekPending(event)}
              {...stylex.props(
                styles.row,
                styles.pendingRow,
                isNext ? styles.next : styles.future,
                selected && styles.selected,
              )}
            >
              <span {...stylex.props(styles.stampInline)}>{formatTime(event.timestamp)}</span>
              <span {...stylex.props(styles.kind, isNext ? styles.kindNext : styles.kindFuture)}>
                {isNext ? "next" : "queued"}
              </span>
              <span {...stylex.props(styles.text)}>
                {describeEvent(event, snapshot.inFlight)}
              </span>
            </button>
          );
        })}
        {snapshot.tapeLog.length === 0 && pending.length === 0 ? (
          <div {...stylex.props(styles.empty)}>no events yet</div>
        ) : null}
      </div>
    </section>
  );
}

function groupByTime(entries: LogEntry[]): LogEntry[][] {
  const groups: LogEntry[][] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last[0].timestamp === entry.timestamp) last.push(entry);
    else groups.push([entry]);
  }
  return groups;
}

function isChildKind(kind: LogKind, head: LogKind): boolean {
  if (head === "timer" || head === "state" || head === "info") {
    return kind === "send" || kind === "deliver";
  }
  return kind === "send" && head !== "send";
}

function kindLabel(kind: LogKind): string {
  switch (kind) {
    case "timer":
      return "timeout";
    case "send":
      return "send";
    case "deliver":
      return "recv";
    case "state":
      return "state";
    case "drop":
      return "drop";
    case "crash":
      return "crash";
    case "restart":
      return "restart";
    case "partition":
      return "part";
    case "heal":
      return "heal";
    case "delay":
      return "delay";
    default:
      return "note";
  }
}

function kindStyle(kind: string) {
  if (kind === "drop" || kind === "crash" || kind === "partition") return styles.kindAlert;
  if (kind === "deliver" || kind === "heal" || kind === "restart" || kind === "state") {
    return styles.kindOk;
  }
  if (kind === "timer") return styles.kindTimer;
  if (kind === "send") return styles.kindSend;
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
    minHeight: 200,
    maxHeight: 260,
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
  cluster: {
    display: "grid",
    gridTemplateColumns: "72px 1fr",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
  },
  stamp: {
    padding: "6px 10px 6px 14px",
    fontSize: 11,
    color: colors.muted,
    fontVariantNumeric: "tabular-nums",
  },
  stampInline: {
    fontVariantNumeric: "tabular-nums",
    color: colors.muted,
    fontSize: 11,
  },
  events: {
    display: "flex",
    flexDirection: "column",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "72px 1fr",
    gap: 10,
    width: "100%",
    textAlign: "left",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: "transparent",
    padding: "4px 14px 4px 8px",
    cursor: "pointer",
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
  },
  pendingRow: {
    gridTemplateColumns: "72px 72px 1fr",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
    padding: "5px 14px",
  },
  child: {
    paddingLeft: 18,
  },
  done: {
    color: colors.muted,
  },
  ahead: {
    color: colors.ink,
    opacity: 0.55,
  },
  current: {
    backgroundColor: colors.paleLime,
    color: colors.ink,
    fontWeight: 500,
    borderLeftColor: colors.lime,
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
    borderLeftColor: colors.lime,
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
  kindTimer: { color: colors.ink },
  kindSend: { color: colors.lime },
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
});
