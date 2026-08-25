import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import type { Scenario, Snapshot } from "../simulation/types";
import { formatTime, payloadLabel } from "../simulation/format";
import { colors, fonts } from "../ui/theme.stylex";
import { describeEvent, eventKey, type Selection } from "../ui/selection";

type Props = {
  snapshot: Snapshot;
  scenario: Scenario;
  selection: Selection;
};

export function Inspector({ snapshot, scenario, selection }: Props) {
  return (
    <section {...stylex.props(styles.wrap)}>
      <header {...stylex.props(styles.head)}>INSPECTOR</header>
      <div {...stylex.props(styles.body)}>{render(snapshot, scenario, selection)}</div>
    </section>
  );
}

function render(snapshot: Snapshot, scenario: Scenario, selection: Selection) {
  if (selection?.kind === "node") {
    const node = snapshot.nodes.find((n) => n.id === selection.id);
    if (!node) return <Empty />;
    const timers = snapshot.timers.filter((t) => t.nodeId === node.id);
    return (
      <Block title={`NODE ${node.id}`}>
        <KV label="status" value={node.status} />
        {scenario.summarizeNode?.(node).map((line) => (
          <div key={line} {...stylex.props(styles.line)}>
            {line}
          </div>
        ))}
        <div {...stylex.props(styles.sub)}>timers</div>
        {timers.length === 0 ? (
          <div {...stylex.props(styles.muted)}>none</div>
        ) : (
          timers.map((t) => (
            <div key={t.id} {...stylex.props(styles.line)}>
              {t.name} @ {formatTime(t.fireAt)}
            </div>
          ))
        )}
        <div {...stylex.props(styles.sub)}>local state</div>
        <pre {...stylex.props(styles.pre)}>{JSON.stringify(node.state, null, 2)}</pre>
      </Block>
    );
  }

  if (selection?.kind === "message") {
    const message = snapshot.inFlight.find((m) => m.id === selection.id);
    if (!message) return <Empty text="message no longer in flight" />;
    return (
      <Block title={`MESSAGE ${message.id}`}>
        <KV label="from" value={message.from} />
        <KV label="to" value={message.to} />
        <KV label="payload" value={payloadLabel(message.payload)} />
        <KV label="sent at" value={formatTime(message.sentAt)} />
        <KV label="deliver at" value={formatTime(message.deliverAt)} />
        <KV
          label="remaining"
          value={`${Math.max(0, Math.round(message.deliverAt - snapshot.currentTime))}ms`}
        />
        <div {...stylex.props(styles.sub)}>payload</div>
        <pre {...stylex.props(styles.pre)}>{JSON.stringify(message.payload, null, 2)}</pre>
      </Block>
    );
  }

  if (selection?.kind === "edge") {
    const broken = snapshot.partitions.some(
      ([a, b]) =>
        (a === selection.a && b === selection.b) ||
        (a === selection.b && b === selection.a),
    );
    return (
      <Block title={`LINK ${selection.a} ↔ ${selection.b}`}>
        <KV label="status" value={broken ? "PARTITIONED" : "connected"} />
        <KV
          label="in flight"
          value={String(
            snapshot.inFlight.filter(
              (m) =>
                (m.from === selection.a && m.to === selection.b) ||
                (m.from === selection.b && m.to === selection.a),
            ).length,
          )}
        />
      </Block>
    );
  }

  if (selection?.kind === "event") {
    const log = snapshot.eventLog.find((e) => `log:${e.seq}` === selection.key);
    if (log) {
      return (
        <Block title="COMPLETED EVENT">
          <KV label="time" value={formatTime(log.timestamp)} />
          <KV label="kind" value={log.kind} />
          <div {...stylex.props(styles.line)}>{log.text}</div>
          {log.meta ? (
            <pre {...stylex.props(styles.pre)}>{JSON.stringify(log.meta, null, 2)}</pre>
          ) : null}
        </Block>
      );
    }
    const pending = snapshot.pendingEvents.find((e) => eventKey(e) === selection.key);
    if (pending) {
      return (
        <Block title={pending.seq === snapshot.nextEvent?.seq ? "NEXT EVENT" : "QUEUED EVENT"}>
          <KV label="time" value={formatTime(pending.timestamp)} />
          <KV label="type" value={pending.type} />
          <div {...stylex.props(styles.line)}>
            {describeEvent(pending, snapshot.inFlight)}
          </div>
          <pre {...stylex.props(styles.pre)}>{JSON.stringify(pending, null, 2)}</pre>
        </Block>
      );
    }
  }

  return (
    <Block title="SIMULATION">
      <KV label="time" value={formatTime(snapshot.currentTime)} />
      <KV label="status" value={snapshot.status} />
      <KV
        label="next"
        value={
          snapshot.nextEvent
            ? `${formatTime(snapshot.nextEvent.timestamp)} ${describeEvent(snapshot.nextEvent, snapshot.inFlight)}`
            : "—"
        }
      />
      <KV label="pending" value={String(snapshot.pendingCount)} />
      <KV
        label="partitions"
        value={
          snapshot.partitions.length === 0
            ? "none"
            : snapshot.partitions.map(([a, b]) => `${a}↔${b}`).join(", ")
        }
      />
      <div {...stylex.props(styles.hint)}>
        Select a node, in-flight message, link, or log row.
      </div>
    </Block>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div {...stylex.props(styles.title)}>{title}</div>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div {...stylex.props(styles.kv)}>
      <span {...stylex.props(styles.k)}>{label}</span>
      <span {...stylex.props(styles.v)}>{value}</span>
    </div>
  );
}

function Empty({ text = "nothing selected" }: { text?: string }) {
  return <div {...stylex.props(styles.muted)}>{text}</div>;
}

const styles = stylex.create({
  wrap: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    flex: "1 1 0",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.ink,
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
  body: {
    padding: 12,
    overflow: "auto",
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
  },
  title: {
    fontSize: 10,
    letterSpacing: "0.14em",
    marginBottom: 10,
    color: colors.muted,
  },
  kv: {
    display: "grid",
    gridTemplateColumns: "88px 1fr",
    gap: 8,
    marginBottom: 6,
  },
  k: { color: colors.muted },
  v: { color: colors.ink, overflowWrap: "anywhere" },
  line: { marginBottom: 4, lineHeight: 1.45 },
  sub: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 10,
    letterSpacing: "0.12em",
    color: colors.muted,
    textTransform: "uppercase",
  },
  pre: {
    margin: 0,
    fontSize: 11,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: colors.ink,
  },
  muted: { color: colors.muted },
  hint: {
    marginTop: 14,
    color: colors.muted,
    lineHeight: 1.5,
  },
});
