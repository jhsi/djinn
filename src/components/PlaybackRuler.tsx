import { useRef, type PointerEvent } from "react";
import * as stylex from "@stylexjs/stylex";
import type { Snapshot } from "../simulation/types";
import { formatTime } from "../simulation/format";
import { colors, fonts } from "../ui/theme.stylex";

type Props = {
  snapshot: Snapshot;
  onSeek: (time: number) => void;
};

export function PlaybackRuler({ snapshot, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const duration = Math.max(snapshot.duration, 1);
  const playhead = Math.min(1, snapshot.currentTime / duration);
  const explored = Math.min(1, snapshot.exploredUntil / duration);

  function timeFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return (x / rect.width) * duration;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    onSeek(timeFromClientX(event.clientX));
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic or non-capturing pointers still seek */
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onSeek(timeFromClientX(event.clientX));
  }

  return (
    <div {...stylex.props(styles.wrap)}>
      <div {...stylex.props(styles.readout)}>
        <span>{formatTime(snapshot.currentTime)}</span>
        <span {...stylex.props(styles.muted)}>/ {formatTime(duration)}</span>
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Playback timeline"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={snapshot.currentTime}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        {...stylex.props(styles.track)}
      >
        <div {...stylex.props(styles.rail)} />
        <div {...stylex.props(styles.explored)} style={{ width: `${explored * 100}%` }} />
        {snapshot.tapeLog.map((entry) => (
          <span
            key={entry.seq}
            title={`${formatTime(entry.timestamp)} ${entry.kind}`}
            {...stylex.props(styles.tick, tickStyle(entry.kind))}
            style={{ left: `${(entry.timestamp / duration) * 100}%` }}
          />
        ))}
        <span
          {...stylex.props(styles.playhead)}
          style={{ left: `${playhead * 100}%` }}
        />
      </div>
    </div>
  );
}

function tickStyle(kind: string) {
  if (kind === "drop" || kind === "crash" || kind === "partition") return styles.tickAlert;
  if (kind === "deliver" || kind === "heal" || kind === "restart") return styles.tickOk;
  return styles.tickDefault;
}

const styles = stylex.create({
  wrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 14px 6px",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
  },
  readout: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
    color: colors.ink,
    minWidth: 118,
    flexShrink: 0,
  },
  muted: {
    color: colors.muted,
  },
  track: {
    position: "relative",
    flex: 1,
    height: 28,
    cursor: "ew-resize",
    outline: "none",
  },
  rail: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 6,
    marginTop: -3,
    backgroundColor: colors.faint,
  },
  explored: {
    position: "absolute",
    left: 0,
    top: "50%",
    height: 6,
    marginTop: -3,
    backgroundColor: colors.line,
    pointerEvents: "none",
  },
  tick: {
    position: "absolute",
    top: 4,
    width: 2,
    height: 20,
    marginLeft: -1,
    pointerEvents: "none",
  },
  tickDefault: { backgroundColor: colors.muted },
  tickOk: { backgroundColor: colors.lime },
  tickAlert: { backgroundColor: colors.coral },
  playhead: {
    position: "absolute",
    top: 0,
    width: 2,
    height: 28,
    marginLeft: -1,
    backgroundColor: colors.lime,
    pointerEvents: "none",
    zIndex: 1,
  },
});
