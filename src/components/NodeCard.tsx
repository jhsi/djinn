import * as stylex from "@stylexjs/stylex";
import type { Node, Scenario } from "../simulation/types";
import { nodeStyles } from "./NodeView";

type Props = {
  node: Node;
  x: number;
  y: number;
  selected: boolean;
  scenario: Scenario;
  stale: boolean;
  onClick: () => void;
};

export function NodeCard({
  node,
  x,
  y,
  selected,
  scenario,
  stale,
  onClick,
}: Props) {
  const role = String(node.state.role ?? "");
  const leader =
    role === "LEADER" || role === "PRIMARY" || role === "COORDINATOR";
  const known = node.state.knownValues as Record<string, unknown> | undefined;
  const informed = Boolean(known && Object.keys(known).length > 0);
  const lines = scenario.summarizeNode?.(node) ?? Object.entries(node.state).map(
    ([k, v]) => `${k}: ${fmt(v)}`,
  );

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ left: x, top: y }}
      {...stylex.props(
        nodeStyles.card,
        selected && nodeStyles.selected,
        node.status === "stopped" && nodeStyles.stopped,
        leader && nodeStyles.leader,
        informed && !leader && nodeStyles.informed,
        stale && nodeStyles.stale,
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
        <span {...stylex.props(nodeStyles.status)}>{node.status}</span>
      </div>
      {lines.map((line) => (
        <div
          key={line}
          {...stylex.props(
            nodeStyles.line,
            line.includes("false") || line.includes("{}") || line.includes("never")
              ? nodeStyles.muted
              : undefined,
          )}
        >
          {line}
        </div>
      ))}
    </button>
  );
}

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "[object]";
    }
  }
  return String(v);
}
