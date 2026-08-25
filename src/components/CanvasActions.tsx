import * as stylex from "@stylexjs/stylex";
import { colors, fonts } from "../ui/theme.stylex";
import { formatTime, payloadGlance, payloadLabel } from "../simulation/format";
import { displayActor } from "../ui/selection";
import type { Message } from "../simulation/types";

export function EdgeActions({
  x,
  y,
  a,
  b,
  latency,
  partitioned,
  onLatency,
  onDropNext,
  onPartition,
  onHeal,
}: {
  x: number;
  y: number;
  a: string;
  b: string;
  latency: number;
  partitioned: boolean;
  onLatency: (ms: number) => void;
  onDropNext: () => void;
  onPartition: () => void;
  onHeal: () => void;
}) {
  return (
    <div
      style={{ left: x, top: y }}
      {...stylex.props(styles.popover)}
      onClick={(e) => e.stopPropagation()}
    >
      <div {...stylex.props(styles.kicker)}>
        {a} ↔ {b}
      </div>
      {partitioned ? (
        <>
          <div {...stylex.props(styles.warn)}>PARTITIONED</div>
          <button type="button" onClick={onHeal} {...stylex.props(styles.action)}>
            Heal
          </button>
        </>
      ) : (
        <>
          <div {...stylex.props(styles.row)}>
            <span>Latency</span>
            <span {...stylex.props(styles.value)}>{latency}ms</span>
          </div>
          <input
            type="range"
            min={50}
            max={5000}
            step={50}
            value={Math.min(5000, Math.max(50, latency))}
            onChange={(e) => onLatency(Number(e.target.value))}
            {...stylex.props(styles.slider)}
          />
          <div {...stylex.props(styles.actions)}>
            <button type="button" onClick={onDropNext} {...stylex.props(styles.danger)}>
              Drop next
            </button>
            <button type="button" onClick={onPartition} {...stylex.props(styles.danger)}>
              Partition
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function MessageActions({
  x,
  y,
  message,
  now,
  onDelay,
  onDrop,
}: {
  x: number;
  y: number;
  message: Message;
  now: number;
  onDelay: () => void;
  onDrop: () => void;
}) {
  const glance = payloadGlance(message.payload);
  return (
    <div
      style={{ left: x, top: y }}
      {...stylex.props(styles.popover)}
      onClick={(e) => e.stopPropagation()}
    >
      <div {...stylex.props(styles.kicker)}>
        {displayActor(message.from)} → {displayActor(message.to)}
      </div>
      <div {...stylex.props(styles.title)}>{glance.primary}</div>
      {glance.secondary ? <div {...stylex.props(styles.sub)}>{glance.secondary}</div> : null}
      <div {...stylex.props(styles.meta)}>
        sent {formatTime(message.sentAt)} · deliver {formatTime(message.deliverAt)} ·{" "}
        {Math.max(0, Math.round(message.deliverAt - now))}ms left
      </div>
      <div {...stylex.props(styles.hint)}>{payloadLabel(message.payload)}</div>
      <div {...stylex.props(styles.actions)}>
        <button type="button" onClick={onDelay} {...stylex.props(styles.action)}>
          Delay +500ms
        </button>
        <button type="button" onClick={onDrop} {...stylex.props(styles.danger)}>
          Drop
        </button>
      </div>
    </div>
  );
}

export function ClientDock({
  x,
  y,
  actionLabel,
  target,
  sending,
  onSend,
}: {
  x: number;
  y: number;
  actionLabel: string;
  target: string | null;
  sending?: boolean;
  onSend: () => void;
}) {
  return (
    <div style={{ left: x, top: y }} {...stylex.props(styles.client, sending && styles.clientSend)}>
      <div {...stylex.props(styles.clientHead)}>
        <span {...stylex.props(styles.clientMark)} />
        <div {...stylex.props(styles.clientKicker)}>CLIENT</div>
      </div>
      <div {...stylex.props(styles.command)}>{actionLabel}</div>
      <div {...stylex.props(styles.target)}>{target ? `Target: ${target}` : "No leader"}</div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSend();
        }}
        disabled={!target}
        {...stylex.props(styles.send, !target && styles.disabled)}
      >
        Send
      </button>
    </div>
  );
}

const styles = stylex.create({
  popover: {
    position: "absolute",
    transform: "translate(-50%, 12px)",
    zIndex: 6,
    minWidth: 196,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.faint,
    padding: "10px 12px",
    fontFamily: fonts.ui,
    color: colors.ink,
  },
  client: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    zIndex: 3,
    width: 118,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    padding: "10px 12px 12px",
    fontFamily: fonts.ui,
    color: colors.ink,
    boxSizing: "border-box",
  },
  clientSend: {
    borderStyle: "solid",
    borderColor: colors.quiet,
  },
  clientHead: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  clientMark: {
    width: 7,
    height: 7,
    backgroundColor: colors.quiet,
    flexShrink: 0,
  },
  clientKicker: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: colors.quiet,
  },
  kicker: {
    fontFamily: fonts.ui,
    fontSize: 10,
    letterSpacing: "0.08em",
    color: colors.muted,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: 600,
  },
  sub: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  command: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 4,
    lineHeight: 1.35,
  },
  target: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.muted,
    marginBottom: 8,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    fontFamily: fonts.mono,
    fontSize: 12,
    marginBottom: 6,
  },
  value: {
    fontVariantNumeric: "tabular-nums",
  },
  slider: {
    width: "100%",
    marginBottom: 10,
    accentColor: colors.lime,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 1.4,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  warn: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 8,
    letterSpacing: "0.06em",
  },
  actions: {
    display: "flex",
    gap: 6,
    marginTop: 10,
    flexWrap: "wrap",
  },
  action: {
    backgroundColor: "transparent",
    color: colors.ink,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.line,
    fontFamily: fonts.ui,
    fontSize: 11,
    padding: "4px 8px",
    cursor: "pointer",
  },
  send: {
    backgroundColor: "transparent",
    color: colors.ink,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.line,
    fontFamily: fonts.ui,
    fontSize: 11,
    padding: "2px 8px",
    cursor: "pointer",
  },
  danger: {
    backgroundColor: "transparent",
    color: colors.coral,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.coral,
    fontFamily: fonts.ui,
    fontSize: 11,
    padding: "4px 8px",
    cursor: "pointer",
  },
  disabled: {
    opacity: 0.45,
    cursor: "default",
  },
});
