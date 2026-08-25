import { useMemo, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import type { Message, Node, Scenario, Snapshot } from "../simulation/types";
import { payloadLabel } from "../simulation/format";
import { colors, fonts } from "../ui/theme.stylex";
import { NodeCard } from "./NodeCard";
import { isPartitioned, type Selection } from "../ui/selection";

type Pos = { id: string; x: number; y: number };

type Props = {
  snapshot: Snapshot;
  scenario: Scenario;
  selection: Selection;
  onSelect: (selection: Selection) => void;
};

const WIDTH = 900;
const HEIGHT = 520;

export function NetworkCanvas({ snapshot, scenario, selection, onSelect }: Props) {
  const positions = useMemo(
    () => layout(snapshot.nodes.map((n) => n.id), WIDTH, HEIGHT),
    [snapshot.nodes],
  );
  const byId = new Map(positions.map((p) => [p.id, p]));
  const maxX = maxNumericX(snapshot.nodes);

  return (
    <div
      {...stylex.props(styles.wrap)}
      onClick={() => onSelect(null)}
    >
      <StatsOverlay snapshot={snapshot} />
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height="100%"
        {...stylex.props(styles.svg)}
      >
        <Decor />
        {edges(snapshot.nodes.map((n) => n.id)).map(([a, b]) => {
          const pa = byId.get(a);
          const pb = byId.get(b);
          if (!pa || !pb) return null;
          const broken = isPartitioned(snapshot.partitions, a, b);
          const selected =
            selection?.kind === "edge" &&
            ((selection.a === a && selection.b === b) ||
              (selection.a === b && selection.b === a));
          return (
            <g key={`${a}-${b}`}>
              <line
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="transparent"
                strokeWidth={18}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect({ kind: "edge", a, b });
                }}
              />
              <line
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke={broken ? "#FF4B6A" : selected ? "#111111" : "#C6FF00"}
                strokeWidth={selected ? 2.4 : 1.4}
                strokeDasharray={broken ? "6 5" : undefined}
                pointerEvents="none"
              />
              {broken ? (
                <circle
                  cx={(pa.x + pb.x) / 2}
                  cy={(pa.y + pb.y) / 2}
                  r={5}
                  fill="#FF4B6A"
                  pointerEvents="none"
                />
              ) : null}
            </g>
          );
        })}
        {snapshot.inFlight.map((message) => (
          <MessageMark
            key={message.id}
            message={message}
            from={byId.get(message.from)}
            to={byId.get(message.to)}
            now={snapshot.currentTime}
            selected={selection?.kind === "message" && selection.id === message.id}
            onClick={() => onSelect({ kind: "message", id: message.id })}
          />
        ))}
      </svg>
      {snapshot.nodes.map((node) => {
        const pos = byId.get(node.id);
        if (!pos) return null;
        const stale =
          typeof node.state.x === "number" &&
          maxX != null &&
          node.state.x < maxX;
        return (
          <NodeCard
            key={node.id}
            node={node}
            x={pos.x}
            y={pos.y}
            selected={selection?.kind === "node" && selection.id === node.id}
            scenario={scenario}
            stale={stale}
            onClick={() => onSelect({ kind: "node", id: node.id })}
          />
        );
      })}
    </div>
  );
}

function MessageMark({
  message,
  from,
  to,
  now,
  selected,
  onClick,
}: {
  message: Message;
  from?: Pos;
  to?: Pos;
  now: number;
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  if (!from || !to) return null;
  const span = Math.max(1, message.deliverAt - message.sentAt);
  const t = clamp((now - message.sentAt) / span, 0.12, 0.88);
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  const label = payloadLabel(message.payload);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${message.from} → ${message.to} ${label} deliver ${message.deliverAt}ms`}
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <circle
        cx={x}
        cy={y}
        r={selected || hover ? 7 : 5.5}
        fill="#111111"
        stroke="#C6FF00"
        strokeWidth={selected ? 3 : 2}
      />
      <text
        x={x + 10}
        y={y - 10}
        fill="#111111"
        fontSize={10}
        fontFamily="IBM Plex Mono, monospace"
      >
        {label}
      </text>
    </g>
  );
}

function StatsOverlay({ snapshot }: { snapshot: Snapshot }) {
  const running = snapshot.nodes.filter((n) => n.status === "running").length;
  const health =
    snapshot.partitions.length > 0 || running < snapshot.nodes.length
      ? "DEGRADED"
      : "OK";
  return (
    <div {...stylex.props(styles.stats)}>
      <Stat label="TIME" value={`${Math.round(snapshot.currentTime)}ms`} />
      <Stat label="NODES" value={`${running}/${snapshot.nodes.length}`} />
      <Stat
        label="HEALTH"
        value={health}
        alert={health !== "OK"}
      />
      <Stat label="IN FLIGHT" value={String(snapshot.inFlight.length)} />
      <Stat label="PENDING" value={String(snapshot.pendingCount)} />
      <Stat
        label="PARTITIONS"
        value={String(snapshot.partitions.length)}
        alert={snapshot.partitions.length > 0}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div {...stylex.props(styles.stat)}>
      <span {...stylex.props(styles.statLabel)}>{label}</span>
      <span {...stylex.props(styles.statValue)}>
        <span
          {...stylex.props(styles.statDot, alert && styles.statDotAlert)}
        />
        {value}
      </span>
    </div>
  );
}

function Decor() {
  return (
    <g opacity={0.12} pointerEvents="none">
      {Array.from({ length: 18 }, (_, i) => (
        <g key={i}>
          {Array.from({ length: 10 }, (_, j) => (
            <circle
              key={j}
              cx={40 + i * 18}
              cy={HEIGHT - 28 - j * 10}
              r={1.1}
              fill="#111"
            />
          ))}
        </g>
      ))}
    </g>
  );
}

function layout(ids: string[], width: number, height: number): Pos[] {
  const n = ids.length;
  if (n === 2) {
    return [
      { id: ids[0], x: width * 0.28, y: height * 0.5 },
      { id: ids[1], x: width * 0.72, y: height * 0.5 },
    ];
  }
  if (n === 3) {
    return [
      { id: ids[0], x: width * 0.5, y: height * 0.28 },
      { id: ids[1], x: width * 0.26, y: height * 0.68 },
      { id: ids[2], x: width * 0.74, y: height * 0.68 },
    ];
  }
  const cx = width * 0.5;
  const cy = height * 0.52;
  const rx = Math.min(width, height) * 0.34;
  const ry = Math.min(width, height) * 0.3;
  return ids.map((id, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { id, x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

function edges(ids: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      out.push([ids[i], ids[j]]);
    }
  }
  return out;
}

function maxNumericX(nodes: Node[]): number | null {
  const xs = nodes
    .map((n) => n.state.x)
    .filter((x): x is number => typeof x === "number");
  if (xs.length === 0) return null;
  return Math.max(...xs);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const styles = stylex.create({
  wrap: {
    position: "relative",
    flex: "1 1 auto",
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: colors.bg,
  },
  svg: {
    display: "block",
    position: "absolute",
    inset: 0,
  },
  stats: {
    position: "absolute",
    top: 16,
    left: 18,
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    pointerEvents: "none",
    fontFamily: fonts.mono,
  },
  stat: {
    display: "flex",
    gap: 12,
    alignItems: "baseline",
  },
  statLabel: {
    width: 86,
    fontSize: 10,
    letterSpacing: "0.14em",
    color: colors.muted,
  },
  statValue: {
    fontSize: 12,
    color: colors.ink,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 500,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: colors.lime,
    display: "inline-block",
  },
  statDotAlert: {
    backgroundColor: colors.coral,
  },
});
