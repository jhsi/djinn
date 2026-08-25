import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import type { Message, Node, Scenario, Snapshot } from "../simulation/types";
import { CLIENT_ID } from "../simulation/types";
import { edgeKey, latencyFor, payloadGlance } from "../simulation/format";
import { colors } from "../ui/theme.stylex";
import { useTheme } from "../ui/Theme";
import { layoutClient, layoutGraph, type Pos } from "../ui/layout";
import { nodeFeedback, usePrefersReducedMotion, useSimulationFeedback } from "../ui/feedback";
import { NodeCard } from "./NodeCard";
import { ClientDock, EdgeActions, MessageActions } from "./CanvasActions";
import { canvasEmphasis, displayActor, isPartitioned, type Selection } from "../ui/selection";

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
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const { palette } = useTheme();
  const hasClient = Boolean(scenario.actions && scenario.actions.length > 0);
  const idKey = snapshot.nodes.map((n) => n.id).join(",");
  const nodeIds = idKey ? idKey.split(",") : [];
  const emphasis = canvasEmphasis(selection, snapshot);
  const feedback = useSimulationFeedback(snapshot, scenario);
  const reducedMotion = usePrefersReducedMotion();

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

  const positions = useMemo(
    () =>
      size.width > 1 && size.height > 1
        ? layoutGraph(nodeIds, snapshot.nodes, scenario, size.width, size.height, hasClient)
        : [],
    [idKey, size.height, size.width, hasClient, scenario, snapshot.nodes],
  );
  const clientPos = useMemo(
    () => (hasClient ? layoutClient(positions, size.width, size.height) : null),
    [hasClient, positions, size.height, size.width],
  );
  const byId = new Map(positions.map((p) => [p.id, p]));
  if (clientPos) byId.set(CLIENT_ID, clientPos);
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
  const packets = packetLayout(snapshot.inFlight, snapshot.currentTime);
  const selectedLayout = selectedMessage ? packets.get(selectedMessage.id) : undefined;
  const selectedMessagePos = selectedMessage
    ? messagePoint(
        selectedMessage,
        byId.get(selectedMessage.from),
        byId.get(selectedMessage.to),
        snapshot.currentTime,
        selectedLayout?.offset ?? 0,
        reducedMotion,
      )
    : null;

  const clientBusy = snapshot.inFlight.some(
    (m) => m.from === CLIENT_ID || m.to === CLIENT_ID,
  );
  const leaderPos = leader ? byId.get(leader.id) : undefined;

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
          {clientPos && leader && leaderPos ? (
            <ClientLink
              from={clientPos}
              to={leaderPos}
              busy={clientBusy}
              edge={palette.edge}
              line={palette.line}
            />
          ) : null}
          {edges(nodeIds).map(([a, b]) => {
            const pa = byId.get(a);
            const pb = byId.get(b);
            if (!pa || !pb) return null;
            const key = edgeKey(a, b);
            const broken = isPartitioned(snapshot.partitions, a, b);
            const selected =
              selection?.kind === "edge" &&
              ((selection.a === a && selection.b === b) ||
                (selection.a === b && selection.b === a));
            const related = emphasis.edges.has(key);
            const traffic = snapshot.inFlight.filter(
              (m) =>
                (m.from === a && m.to === b) || (m.from === b && m.to === a),
            );
            const busy = traffic.length > 0;
            const latency = latencyFor(snapshot.linkLatencies, a, b, snapshot.defaultLatency);
            const perturbed = latency !== snapshot.defaultLatency;
            const hovered = hoverEdge === key;
            const showLabel = broken || selected || hovered || perturbed;
            const stroke = broken
              ? palette.coral
              : selected
                ? palette.lime
                : related || busy
                  ? palette.line
                  : palette.edge;
            const mx = (pa.x + pb.x) / 2;
            const my = (pa.y + pb.y) / 2;
            const dx = pb.x - pa.x;
            const dy = pb.y - pa.y;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const label = broken ? "PARTITIONED" : `${latency}ms`;
            const gap = showLabel ? (broken ? 52 : Math.max(28, label.length * 3.4)) + 8 : 0;
            const x1b = mx - ux * gap;
            const y1b = my - uy * gap;
            const x2a = mx + ux * gap;
            const y2a = my + uy * gap;
            const width = selected ? 2.2 : busy ? 1.9 : related ? 1.7 : perturbed ? 1.35 : 1;
            const opacity = selected ? 1 : busy ? 0.88 : related ? 0.8 : perturbed ? 0.72 : 0.38;
            const dirs = busy
              ? uniqueDirs(traffic)
              : [];
            return (
              <g key={key}>
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
                  onMouseEnter={() => setHoverEdge(key)}
                  onMouseLeave={() => setHoverEdge((cur) => (cur === key ? null : cur))}
                />
                {showLabel ? (
                  <>
                    <line
                      x1={pa.x}
                      y1={pa.y}
                      x2={x1b}
                      y2={y1b}
                      stroke={stroke}
                      strokeWidth={width}
                      strokeOpacity={opacity}
                      strokeDasharray={broken ? "6 5" : undefined}
                      pointerEvents="none"
                    />
                    <line
                      x1={x2a}
                      y1={y2a}
                      x2={pb.x}
                      y2={pb.y}
                      stroke={stroke}
                      strokeWidth={width}
                      strokeOpacity={opacity}
                      strokeDasharray={broken ? "6 5" : undefined}
                      pointerEvents="none"
                    />
                    <rect
                      x={mx - gap + 4}
                      y={my - 8}
                      width={gap * 2 - 8}
                      height={15}
                      fill={palette.bg}
                      pointerEvents="none"
                    />
                    <text
                      x={mx}
                      y={my + 4}
                      textAnchor="middle"
                      fill={broken ? palette.coral : selected ? palette.lime : palette.muted}
                      fontSize={11}
                      fontFamily="IBM Plex Mono, ui-monospace, monospace"
                      pointerEvents="none"
                    >
                      {label}
                    </text>
                  </>
                ) : (
                  <line
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke={stroke}
                    strokeWidth={width}
                    strokeOpacity={opacity}
                    pointerEvents="none"
                  />
                )}
                {dirs.map((dir) => (
                  <EdgeChevron
                    key={`${dir.from}:${dir.to}`}
                    from={byId.get(dir.from)!}
                    to={byId.get(dir.to)!}
                    color={selected ? palette.lime : palette.line}
                  />
                ))}
              </g>
            );
          })}
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
            key={`${scenario.id}:${node.id}`}
            node={node}
            x={pos.x}
            y={pos.y}
            selected={selection?.kind === "node" && selection.id === node.id}
            related={emphasis.nodes.has(node.id) && !(selection?.kind === "node" && selection.id === node.id)}
            scenario={scenario}
            snapshot={snapshot}
            stale={stale}
            feedback={nodeFeedback(feedback, node.id)}
            onClick={() => onSelect({ kind: "node", id: node.id })}
            onCrash={() => onCrash(node.id)}
            onRestart={() => onRestart(node.id)}
          />
        );
      })}
      {hasClient && clientPos && size.height > 1 ? (
        <ClientDock
          x={clientPos.x}
          y={clientPos.y}
          actionLabel={commandLabel(scenario.actions![0].label)}
          target={leader?.id ?? null}
          sending={nodeFeedback(feedback, CLIENT_ID).send}
          onSend={onClientSend}
        />
      ) : null}
      {size.width > 1 && size.height > 1 ? (
        <svg
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          {...stylex.props(styles.packets)}
        >
          {snapshot.inFlight.map((message) => {
            const layout = packets.get(message.id);
            if (!layout || layout.hidden) return null;
            return (
              <MessageMark
                key={message.id}
                message={message}
                from={byId.get(message.from)}
                to={byId.get(message.to)}
                now={snapshot.currentTime}
                offset={layout.offset}
                count={layout.count}
                selected={
                  (selection?.kind === "message" && selection.id === message.id) ||
                  emphasis.messages.has(message.id)
                }
                reducedMotion={reducedMotion}
                ink={palette.ink}
                lime={palette.lime}
                bg={palette.bg}
                muted={palette.muted}
                onClick={() => onSelect({ kind: "message", id: message.id })}
              />
            );
          })}
        </svg>
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

function ClientLink({
  from,
  to,
  busy,
  edge,
  line,
}: {
  from: Pos;
  to: Pos;
  busy: boolean;
  edge: string;
  line: string;
}) {
  const stroke = busy ? line : edge;
  return (
    <g pointerEvents="none">
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={stroke}
        strokeWidth={busy ? 1.6 : 1}
        strokeOpacity={busy ? 0.8 : 0.42}
        strokeDasharray={busy ? undefined : "3 5"}
      />
      {busy ? <EdgeChevron from={from} to={to} color={line} /> : null}
    </g>
  );
}

function EdgeChevron({ from, to, color }: { from: Pos; to: Pos; color: string }) {
  const t = 0.38;
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  return (
    <polygon
      points={`${x + 6},${y} ${x - 2},${y - 3.2} ${x - 2},${y + 3.2}`}
      fill={color}
      opacity={0.7}
      transform={`rotate(${(angle * 180) / Math.PI} ${x} ${y})`}
      pointerEvents="none"
    />
  );
}

function MessageMark({
  message,
  from,
  to,
  now,
  offset,
  count,
  selected,
  reducedMotion,
  ink,
  lime,
  bg,
  muted,
  onClick,
}: {
  message: Message;
  from?: Pos;
  to?: Pos;
  now: number;
  offset: number;
  count: number;
  selected: boolean;
  reducedMotion: boolean;
  ink: string;
  lime: string;
  bg: string;
  muted: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  if (!from || !to) return null;
  const point = messagePoint(message, from, to, now, offset, reducedMotion);
  const compact = payloadGlance(message.payload, true);
  const full = payloadGlance(message.payload);
  const active = selected || hover;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const label = count > 1 ? `${compact.primary} ×${count}` : compact.primary;
  const hoverTitle = full.secondary ? `${full.primary} ${full.secondary}` : full.primary;
  const shown = active ? hoverTitle : label;
  const labelW = Math.min(96, Math.max(28, shown.length * 6.6 + 8));
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${displayActor(message.from)} → ${displayActor(message.to)} ${full.primary} deliver ${message.deliverAt}ms`}
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
        r={active ? 7 : 5.5}
        fill={lime}
        stroke={selected ? ink : bg}
        strokeWidth={selected ? 2 : 1.2}
      />
      <polygon
        points={`${point.x + 8},${point.y} ${point.x + 2},${point.y - 3.5} ${point.x + 2},${point.y + 3.5}`}
        fill={lime}
        transform={`rotate(${(angle * 180) / Math.PI} ${point.x} ${point.y})`}
        pointerEvents="none"
      />
      {active || label.length <= 10 ? (
        <>
          <rect
            x={point.x - labelW / 2}
            y={point.y + 8}
            width={labelW}
            height={active && full.secondary ? 26 : 14}
            fill={bg}
            opacity={0.92}
            pointerEvents="none"
          />
          <text
            x={point.x}
            y={point.y + 18}
            textAnchor="middle"
            fill={ink}
            fontSize={10}
            fontFamily="IBM Plex Mono, monospace"
            fontWeight={600}
            pointerEvents="none"
          >
            {active ? full.primary : label}
          </text>
          {active && full.secondary ? (
            <text
              x={point.x}
              y={point.y + 30}
              textAnchor="middle"
              fill={muted}
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
              pointerEvents="none"
            >
              {full.secondary} · {displayActor(message.from)} → {displayActor(message.to)}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

type PacketLayout = { offset: number; count: number; hidden: boolean };

function packetLayout(messages: Message[], now: number): Map<string, PacketLayout> {
  const groups = new Map<string, Message[]>();
  for (const message of messages) {
    const key = edgeKey(message.from, message.to);
    const list = groups.get(key) ?? [];
    list.push(message);
    groups.set(key, list);
  }
  const out = new Map<string, PacketLayout>();
  for (const list of groups.values()) {
    const forward = list.filter((m) => m.from < m.to);
    const reverse = list.filter((m) => m.from >= m.to);
    layoutDirected(forward, 1, now, out);
    layoutDirected(reverse, -1, now, out);
  }
  return out;
}

function layoutDirected(
  messages: Message[],
  sign: number,
  now: number,
  out: Map<string, PacketLayout>,
) {
  if (messages.length === 0) return;
  const byType = new Map<string, Message[]>();
  for (const message of messages) {
    const type = payloadGlance(message.payload, true).primary;
    const list = byType.get(type) ?? [];
    list.push(message);
    byType.set(type, list);
  }
  let lane = 0;
  for (const group of byType.values()) {
    group.sort((a, b) => travelRaw(a, now) - travelRaw(b, now));
    const clusters: Message[][] = [];
    for (const message of group) {
      const last = clusters[clusters.length - 1];
      if (last && Math.abs(travelRaw(message, now) - travelRaw(last[0], now)) < 0.16) {
        last.push(message);
      } else {
        clusters.push([message]);
      }
    }
    for (const cluster of clusters) {
      const base = messages.length === 1 ? 0 : sign * (7 + lane * 9);
      if (cluster.length >= 3) {
        out.set(cluster[0].id, { offset: base, count: cluster.length, hidden: false });
        for (let i = 1; i < cluster.length; i += 1) {
          out.set(cluster[i].id, { offset: base, count: 1, hidden: true });
        }
      } else {
        cluster.forEach((message, i) => {
          const spread = cluster.length === 1 ? 0 : (i - (cluster.length - 1) / 2) * 9;
          out.set(message.id, { offset: base + spread, count: 1, hidden: false });
        });
      }
      lane += 1;
    }
  }
}

function travelRaw(message: Message, now: number): number {
  const span = Math.max(1, message.deliverAt - message.sentAt);
  return (now - message.sentAt) / span;
}

function uniqueDirs(messages: Message[]): { from: string; to: string }[] {
  const seen = new Set<string>();
  const out: { from: string; to: string }[] = [];
  for (const message of messages) {
    const key = `${message.from}>${message.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ from: message.from, to: message.to });
  }
  return out;
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

function messagePoint(
  message: Message,
  from?: Pos,
  to?: Pos,
  now = 0,
  offset = 0,
  reducedMotion = false,
): Pos {
  if (!from || !to) return { id: message.id, x: 0, y: 0 };
  const t = travelT(travelRaw(message, now), reducedMotion);
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    id: message.id,
    x: x + (-dy / len) * offset,
    y: y + (dx / len) * offset,
  };
}

function travelT(raw: number, reducedMotion: boolean): number {
  if (reducedMotion) {
    if (raw < 0.34) return 0.16;
    if (raw < 0.78) return 0.5;
    return 0.9;
  }
  return clamp(raw, 0.08, 0.93);
}

function commandLabel(label: string): string {
  return label.replace(/^Client\s+/i, "");
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
  packets: {
    display: "block",
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 6,
    pointerEvents: "none",
  },
});
