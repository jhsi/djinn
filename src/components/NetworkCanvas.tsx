import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import type { Message, Node, Scenario, Snapshot } from "../simulation/types";
import { CLIENT_ID } from "../simulation/types";
import { latencyFor, payloadGlance } from "../simulation/format";
import { colors } from "../ui/theme.stylex";
import { useTheme } from "../ui/Theme";
import { NodeCard } from "./NodeCard";
import { ClientDock, EdgeActions, MessageActions } from "./CanvasActions";
import { isPartitioned, type Selection } from "../ui/selection";

type Pos = { id: string; x: number; y: number };

type Props = {
  snapshot: Snapshot;
  scenario: Scenario;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onCrash: (id: string) => void;
  onRestart: (id: string) => void;
  onPartition: (a: string, b: string) => void;
  onHeal: (a: string, b: string) => void;
  onLinkLatency: (a: string, b: string, ms: number) => void;
  onDropNext: (a: string, b: string) => void;
  onDropMessage: (id: string) => void;
  onDelayMessage: (id: string, deliverAt: number) => void;
  onClientSend: () => void;
};

export function NetworkCanvas({
  snapshot,
  scenario,
  selection,
  onSelect,
  onCrash,
  onRestart,
  onPartition,
  onHeal,
  onLinkLatency,
  onDropNext,
  onDropMessage,
  onDelayMessage,
  onClientSend,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { palette } = useTheme();
  const hasClient = Boolean(scenario.actions && scenario.actions.length > 0);
  const idKey = snapshot.nodes.map((n) => n.id).join(",");
  const nodeIds = idKey ? idKey.split(",") : [];

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const clientPos: Pos = { id: CLIENT_ID, x: 78, y: size.height * 0.5 };
  const positions = useMemo(
    () =>
      size.width > 1 && size.height > 1
        ? layout(nodeIds, size.width, size.height, hasClient)
        : [],
    [idKey, size.height, size.width, hasClient],
  );
  const byId = new Map(positions.map((p) => [p.id, p]));
  if (hasClient) byId.set(CLIENT_ID, clientPos);
  const maxX = maxNumericX(snapshot.nodes);
  const leader = snapshot.nodes.find(
    (n) =>
      n.status === "running" &&
      (n.state.role === "LEADER" || n.state.role === "PRIMARY" || n.state.role === "COORDINATOR"),
  );

  const selectedEdge =
    selection?.kind === "edge"
      ? { a: selection.a, b: selection.b, pos: midpoint(byId.get(selection.a), byId.get(selection.b)) }
      : null;
  const selectedMessage =
    selection?.kind === "message"
      ? snapshot.inFlight.find((m) => m.id === selection.id)
      : undefined;
  const selectedMessagePos = selectedMessage
    ? messagePoint(selectedMessage, byId.get(selectedMessage.from), byId.get(selectedMessage.to), snapshot.currentTime)
    : null;

  return (
    <div
      ref={wrapRef}
      {...stylex.props(styles.wrap)}
      onClick={() => onSelect(null)}
    >
      {size.width > 1 && size.height > 1 ? (
        <svg
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          {...stylex.props(styles.svg)}
        >
          {hasClient && leader ? (
            <line
              x1={clientPos.x}
              y1={clientPos.y}
              x2={byId.get(leader.id)?.x ?? clientPos.x}
              y2={byId.get(leader.id)?.y ?? clientPos.y}
              stroke={palette.line}
              strokeWidth={1}
              strokeDasharray="3 5"
              pointerEvents="none"
            />
          ) : null}
          {edges(nodeIds).map(([a, b]) => {
            const pa = byId.get(a);
            const pb = byId.get(b);
            if (!pa || !pb) return null;
            const broken = isPartitioned(snapshot.partitions, a, b);
            const selected =
              selection?.kind === "edge" &&
              ((selection.a === a && selection.b === b) ||
                (selection.a === b && selection.b === a));
            const busy = snapshot.inFlight.some(
              (m) =>
                (m.from === a && m.to === b) || (m.from === b && m.to === a),
            );
            const latency = latencyFor(snapshot.linkLatencies, a, b, snapshot.defaultLatency);
            const stroke = broken
              ? palette.coral
              : selected || busy
                ? palette.lime
                : palette.line;
            const mx = (pa.x + pb.x) / 2;
            const my = (pa.y + pb.y) / 2;
            const label = broken ? "✕ PARTITIONED" : `${latency}ms`;
            return (
              <g key={`${a}-${b}`}>
                <line
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke="transparent"
                  strokeWidth={22}
                  style={{ cursor: "pointer", pointerEvents: "stroke" }}
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
                  stroke={stroke}
                  strokeWidth={selected ? 2.6 : busy ? 2 : 1.3}
                  strokeDasharray={broken ? "6 5" : undefined}
                  pointerEvents="none"
                />
                <rect
                  x={mx - 46}
                  y={my - 9}
                  width={92}
                  height={16}
                  rx={2}
                  fill={palette.bg}
                  pointerEvents="none"
                />
                <text
                  x={mx}
                  y={my + 4}
                  textAnchor="middle"
                  fill={broken ? palette.coral : selected || busy ? palette.lime : palette.muted}
                  fontSize={11}
                  fontFamily="IBM Plex Mono, monospace"
                  pointerEvents="none"
                >
                  {label}
                </text>
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
              ink={palette.ink}
              lime={palette.lime}
              bg={palette.bg}
              onClick={() => onSelect({ kind: "message", id: message.id })}
            />
          ))}
        </svg>
      ) : null}
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
            snapshot={snapshot}
            stale={stale}
            onClick={() => onSelect({ kind: "node", id: node.id })}
            onCrash={() => onCrash(node.id)}
            onRestart={() => onRestart(node.id)}
          />
        );
      })}
      {hasClient && size.height > 1 ? (
        <ClientDock
          x={clientPos.x}
          y={clientPos.y}
          actionLabel={scenario.actions![0].label}
          target={leader?.id ?? null}
          onSend={onClientSend}
        />
      ) : null}
      {selectedEdge?.pos ? (
        <EdgeActions
          x={selectedEdge.pos.x}
          y={selectedEdge.pos.y}
          a={selectedEdge.a}
          b={selectedEdge.b}
          latency={latencyFor(
            snapshot.linkLatencies,
            selectedEdge.a,
            selectedEdge.b,
            snapshot.defaultLatency,
          )}
          partitioned={isPartitioned(snapshot.partitions, selectedEdge.a, selectedEdge.b)}
          onLatency={(ms) => onLinkLatency(selectedEdge.a, selectedEdge.b, ms)}
          onDropNext={() => onDropNext(selectedEdge.a, selectedEdge.b)}
          onPartition={() => onPartition(selectedEdge.a, selectedEdge.b)}
          onHeal={() => onHeal(selectedEdge.a, selectedEdge.b)}
        />
      ) : null}
      {selectedMessage && selectedMessagePos ? (
        <MessageActions
          x={selectedMessagePos.x}
          y={selectedMessagePos.y}
          message={selectedMessage}
          now={snapshot.currentTime}
          onDelay={() => onDelayMessage(selectedMessage.id, selectedMessage.deliverAt + 500)}
          onDrop={() => onDropMessage(selectedMessage.id)}
        />
      ) : null}
    </div>
  );
}

function MessageMark({
  message,
  from,
  to,
  now,
  selected,
  ink,
  lime,
  bg,
  onClick,
}: {
  message: Message;
  from?: Pos;
  to?: Pos;
  now: number;
  selected: boolean;
  ink: string;
  lime: string;
  bg: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  if (!from || !to) return null;
  const point = messagePoint(message, from, to, now);
  const glance = payloadGlance(message.payload);
  const active = selected || hover;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${message.from} → ${message.to} ${glance.primary} deliver ${message.deliverAt}ms`}
      style={{ cursor: "pointer", pointerEvents: "auto" }}
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
        cx={point.x}
        cy={point.y}
        r={active ? 8 : 6.5}
        fill={lime}
        stroke={ink}
        strokeWidth={selected ? 2.4 : 1.4}
      />
      <rect
        x={point.x + 10}
        y={point.y - (glance.secondary ? 22 : 12)}
        width={Math.max(72, glance.primary.length * 7.2)}
        height={glance.secondary ? 28 : 16}
        fill={bg}
        opacity={0.88}
        pointerEvents="none"
      />
      <text
        x={point.x + 14}
        y={point.y - (glance.secondary ? 8 : 0)}
        fill={ink}
        fontSize={11}
        fontFamily="IBM Plex Mono, monospace"
        fontWeight={600}
        pointerEvents="none"
      >
        {glance.primary}
      </text>
      {glance.secondary ? (
        <text
          x={point.x + 14}
          y={point.y + 5}
          fill={ink}
          fontSize={10}
          fontFamily="IBM Plex Mono, monospace"
          opacity={0.7}
          pointerEvents="none"
        >
          {glance.secondary}
        </text>
      ) : null}
    </g>
  );
}

function layout(ids: string[], width: number, height: number, client: boolean): Pos[] {
  const padX = Math.min(140, Math.max(96, width * 0.14)) + (client ? 36 : 0);
  const padY = Math.min(120, Math.max(80, height * 0.16));
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);
  const n = ids.length;
  if (n === 2) {
    return [
      { id: ids[0], x: padX + innerW * 0.22, y: padY + innerH * 0.5 },
      { id: ids[1], x: padX + innerW * 0.78, y: padY + innerH * 0.5 },
    ];
  }
  if (n === 3) {
    return [
      { id: ids[0], x: padX + innerW * 0.5, y: padY + innerH * 0.18 },
      { id: ids[1], x: padX + innerW * 0.18, y: padY + innerH * 0.78 },
      { id: ids[2], x: padX + innerW * 0.82, y: padY + innerH * 0.78 },
    ];
  }
  const cx = padX + innerW * 0.5;
  const cy = padY + innerH * 0.5;
  const rx = innerW * 0.38;
  const ry = innerH * 0.36;
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

function midpoint(a?: Pos, b?: Pos): Pos | null {
  if (!a || !b) return null;
  return { id: `${a.id}-${b.id}`, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function messagePoint(message: Message, from?: Pos, to?: Pos, now = 0): Pos {
  if (!from || !to) return { id: message.id, x: 0, y: 0 };
  const span = Math.max(1, message.deliverAt - message.sentAt);
  const t = clamp((now - message.sentAt) / span, 0.12, 0.88);
  return {
    id: message.id,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
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
    left: 0,
    top: 0,
  },
});
