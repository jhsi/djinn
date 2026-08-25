import { useEffect, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import type { Node, Scenario, Snapshot } from "../simulation/types";
import { glanceNode } from "../ui/glance";
import { nodeStyles } from "./NodeView";

type Props = {
  node: Node;
  x: number;
  y: number;
  selected: boolean;
  scenario: Scenario;
  snapshot: Snapshot;
  stale: boolean;
  onClick: () => void;
  onCrash: () => void;
  onRestart: () => void;
};

export function NodeCard({
  node,
  x,
  y,
  selected,
  scenario,
  snapshot,
  stale,
  onClick,
  onCrash,
  onRestart,
}: Props) {
  const glance = glanceNode(node, scenario, snapshot);
  const role = glance.role ?? "";
  const leader = role === "LEADER" || role === "PRIMARY" || role === "COORDINATOR";
  const candidate = role === "CANDIDATE";
  const known = node.state.knownValues as Record<string, unknown> | undefined;
  const informed = Boolean(known && Object.keys(known).length > 0);
  const flash = useTransitionFlash(node);
  const remaining = glance.timer ? Math.round(glance.timer.remaining) : 0;
  const ratio = glance.timer ? Math.min(1, glance.timer.remaining / glance.timer.total) : 0;
  const urgent = Boolean(glance.timer && ratio < 0.28 && node.status === "running");

  return (
    <div
      style={{ left: x, top: y }}
      {...stylex.props(nodeStyles.wrap, selected && nodeStyles.wrapSelected)}
    >
      {flash ? <div {...stylex.props(nodeStyles.flash)}>{flash}</div> : null}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        {...stylex.props(
          nodeStyles.card,
          selected && nodeStyles.selected,
          node.status === "stopped" && nodeStyles.stopped,
          leader && nodeStyles.leader,
          candidate && nodeStyles.candidate,
          informed && !leader && nodeStyles.informed,
          stale && nodeStyles.stale,
          Boolean(flash) && nodeStyles.flashing,
        )}
      >
        <div {...stylex.props(nodeStyles.header)}>
          <span {...stylex.props(nodeStyles.id)}>
            <span
              {...stylex.props(
                nodeStyles.dot,
                node.status === "stopped" && nodeStyles.dotStopped,
              )}
            />
            {node.id}
          </span>
          <span
            {...stylex.props(
              nodeStyles.status,
              node.status === "stopped" && nodeStyles.statusDown,
            )}
          >
            {node.status === "stopped" ? "crashed" : "running"}
          </span>
        </div>
        {role ? <div {...stylex.props(nodeStyles.role)}>{role}</div> : null}
        {glance.lines.map((line) => (
          <div key={line} {...stylex.props(nodeStyles.line)}>
            {line}
          </div>
        ))}
        {glance.timer && node.status === "running" ? (
          <div {...stylex.props(nodeStyles.timer)}>
            <div {...stylex.props(nodeStyles.timerMeta)}>
              <span>{glance.timer.name}</span>
              <span>{remaining}ms</span>
            </div>
            <div {...stylex.props(nodeStyles.timerTrack)}>
              <div
                {...stylex.props(nodeStyles.timerFill, urgent && nodeStyles.timerUrgent)}
                style={{ width: `${Math.max(4, ratio * 100)}%` }}
              />
            </div>
          </div>
        ) : null}
      </button>
      {selected ? (
        <div
          {...stylex.props(nodeStyles.actions)}
          onClick={(e) => e.stopPropagation()}
        >
          {node.status === "running" ? (
            <button type="button" onClick={onCrash} {...stylex.props(nodeStyles.danger)}>
              Crash
            </button>
          ) : (
            <button type="button" onClick={onRestart} {...stylex.props(nodeStyles.action)}>
              Restart
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function useTransitionFlash(node: Node): string | null {
  const prev = useRef<Record<string, unknown> | null>(null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const next = {
      status: node.status,
      role: node.state.role,
      term: node.state.term,
      leader: node.state.leader,
      commitIndex: node.state.commitIndex,
      suspectedFailed: node.state.suspectedFailed,
    };
    const last = prev.current;
    prev.current = next;
    if (!last) return;
    const parts: string[] = [];
    if (last.status !== next.status) {
      parts.push(next.status === "stopped" ? "crashed" : "restarted");
    }
    if (last.role !== next.role && typeof last.role === "string" && typeof next.role === "string") {
      parts.push(`${last.role} → ${next.role}`);
    }
    if (last.term !== next.term && typeof next.term === "number") {
      parts.push(`term ${String(last.term)} → ${next.term}`);
    }
    if (last.leader !== next.leader) {
      parts.push(`leader: ${fmt(last.leader)} → ${fmt(next.leader)}`);
    }
    if (last.commitIndex !== next.commitIndex && typeof next.commitIndex === "number") {
      parts.push(`commit ${String(last.commitIndex)} → ${next.commitIndex}`);
    }
    if (last.suspectedFailed !== next.suspectedFailed && next.suspectedFailed === true) {
      parts.push("suspects failure");
    }
    if (parts.length === 0) return;
    setText(parts.join(" · "));
    const id = window.setTimeout(() => setText(null), 1400);
    return () => window.clearTimeout(id);
  }, [
    node.status,
    node.state.role,
    node.state.term,
    node.state.leader,
    node.state.commitIndex,
    node.state.suspectedFailed,
  ]);

  return text;
}

function fmt(v: unknown): string {
  if (v == null) return "—";
  return String(v);
}
