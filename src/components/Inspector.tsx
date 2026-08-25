import { useState, type ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import type { Node, Scenario, Snapshot } from "../simulation/types";
import { formatTime, latencyFor, payloadLabel } from "../simulation/format";
import { colors, fonts } from "../ui/theme.stylex";
import { describeEvent, displayActor, eventKey, type Selection } from "../ui/selection";
import { inspectSections } from "../ui/presentation";

type Props = {
  snapshot: Snapshot;
  scenario: Scenario;
  selection: Selection;
};

export function Inspector({ snapshot, scenario, selection }: Props) {
  return (
    <section {...stylex.props(styles.wrap)}>
      <header {...stylex.props(styles.head)}>Inspector</header>
      <div {...stylex.props(styles.body)}>{render(snapshot, scenario, selection)}</div>
    </section>
  );
}

function render(snapshot: Snapshot, scenario: Scenario, selection: Selection) {
  if (selection?.kind === "node") {
    const node = snapshot.nodes.find((n) => n.id === selection.id);
    if (!node) return <Empty />;
    return <NodeDetail node={node} snapshot={snapshot} scenario={scenario} />;
  }

  if (selection?.kind === "message") {
    const message = snapshot.inFlight.find((m) => m.id === selection.id);
    if (!message) return <Empty text="message no longer in flight" />;
    return (
      <Block title={`Message ${message.id}`}>
        <KV label="From" value={displayActor(message.from)} />
        <KV label="To" value={displayActor(message.to)} />
        <KV label="Payload" value={payloadLabel(message.payload)} />
        <KV label="Sent" value={formatTime(message.sentAt)} />
        <KV label="Deliver" value={formatTime(message.deliverAt)} />
        <KV
          label="Remaining"
          value={`${Math.max(0, Math.round(message.deliverAt - snapshot.currentTime))}ms`}
        />
        <RawState title="Payload" value={message.payload} />
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
      <Block title={`${selection.a} ↔ ${selection.b}`}>
        <KV
          label="Latency"
          value={`${latencyFor(snapshot.linkLatencies, selection.a, selection.b, snapshot.defaultLatency)}ms`}
        />
        <KV label="Partitioned" value={broken ? "true" : "false"} />
        <KV
          label="In flight"
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
    const log = snapshot.tapeLog.find((e) => `log:${e.seq}` === selection.key);
    if (log) {
      return (
        <Block title="Completed event">
          <KV label="Time" value={formatTime(log.timestamp)} />
          <KV label="Kind" value={log.kind} />
          <div {...stylex.props(styles.line)}>{log.text}</div>
          {log.meta ? <RawState title="Meta" value={log.meta} /> : null}
        </Block>
      );
    }
    const pending = snapshot.pendingEvents.find((e) => eventKey(e) === selection.key);
    if (pending) {
      return (
        <Block title={pending.seq === snapshot.nextEvent?.seq ? "Next event" : "Queued event"}>
          <KV label="Time" value={formatTime(pending.timestamp)} />
          <KV label="Type" value={pending.type} />
          <div {...stylex.props(styles.line)}>
            {describeEvent(pending, snapshot.inFlight)}
          </div>
          <RawState title="Raw" value={pending} />
        </Block>
      );
    }
  }

  return (
    <Block title="Simulation">
      <KV label="Time" value={formatTime(snapshot.currentTime)} />
      <KV label="Status" value={snapshot.status} />
      <KV
        label="Next"
        value={
          snapshot.nextEvent
            ? `${formatTime(snapshot.nextEvent.timestamp)} ${describeEvent(snapshot.nextEvent, snapshot.inFlight)}`
            : "—"
        }
      />
      <KV label="Pending" value={String(snapshot.pendingCount)} />
      <KV
        label="Partitions"
        value={
          snapshot.partitions.length === 0
            ? "none"
            : snapshot.partitions.map(([a, b]) => `${a}↔${b}`).join(", ")
        }
      />
      <div {...stylex.props(styles.hint)}>
        Select a node, link, or message on the canvas. This panel shows full state.
      </div>
    </Block>
  );
}

function NodeDetail({
  node,
  snapshot,
  scenario,
}: {
  node: Node;
  snapshot: Snapshot;
  scenario: Scenario;
}) {
  const status = node.status === "stopped" ? "Crashed" : "Running";
  const sections = inspectSections(node, scenario, snapshot);
  const role = typeof node.state.role === "string" ? node.state.role : "";
  const term = typeof node.state.term === "number" ? ` · Term ${node.state.term}` : "";

  return (
    <Block title={`Node ${node.id}`}>
      <div {...stylex.props(styles.lede)}>
        {status}
        {role ? ` · ${role}` : ""}
        {term}
      </div>
      {sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.rows.map((row, i) =>
            row.label ? (
              <KV key={`${row.label}-${i}`} label={row.label} value={row.value} />
            ) : (
              <div key={`${row.value}-${i}`} {...stylex.props(styles.line)}>
                {row.value}
              </div>
            ),
          )}
        </Section>
      ))}
      <RawState value={node.state} />
    </Block>
  );
}

function RawState({ title = "Local state", value }: { title?: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title={title}>
      <button type="button" onClick={() => setOpen((v) => !v)} {...stylex.props(styles.toggle)}>
        {open ? "▼ Raw state" : "▶ Raw state"}
      </button>
      {open ? <pre {...stylex.props(styles.pre)}>{JSON.stringify(value, null, 2)}</pre> : null}
    </Section>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.sub)}>{title}</div>
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
    flex: "1 1 auto",
  },
  head: {
    padding: "10px 16px 6px",
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
  },
  body: {
    padding: "4px 16px 16px",
    overflow: "auto",
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
  },
  title: {
    fontFamily: fonts.ui,
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    marginBottom: 8,
    color: colors.ink,
  },
  lede: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
    marginBottom: 14,
    lineHeight: 1.45,
  },
  kv: {
    display: "grid",
    gridTemplateColumns: "88px 1fr",
    gap: 8,
    marginBottom: 5,
  },
  k: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.muted,
  },
  v: {
    color: colors.ink,
    overflowWrap: "anywhere",
    fontVariantNumeric: "tabular-nums",
  },
  line: {
    marginBottom: 4,
    lineHeight: 1.45,
  },
  logLine: {
    fontSize: 12,
    lineHeight: 1.45,
    color: colors.ink,
    marginTop: 2,
  },
  section: {
    marginTop: 14,
  },
  sub: {
    fontFamily: fonts.ui,
    marginBottom: 6,
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  pre: {
    margin: 0,
    fontSize: 11,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: colors.muted,
  },
  muted: { color: colors.muted, fontSize: 12 },
  toggle: {
    backgroundColor: "transparent",
    color: colors.muted,
    borderWidth: 0,
    padding: 0,
    fontFamily: fonts.ui,
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
  },
  hint: {
    marginTop: 16,
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 1.5,
  },
});
