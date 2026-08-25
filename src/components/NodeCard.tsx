import * as stylex from "@stylexjs/stylex";
import type { Node, Scenario, Snapshot } from "../simulation/types";
import { presentNode, timerLabel } from "../ui/presentation";
import type { NodeFeedback } from "../ui/feedback";
import { nodeStyles } from "./NodeView";

type Props = {
  node: Node;
  x: number;
  y: number;
  selected: boolean;
  related: boolean;
  scenario: Scenario;
  snapshot: Snapshot;
  stale: boolean;
  feedback: NodeFeedback;
  onClick: () => void;
  onCrash: () => void;
  onRestart: () => void;
};

export function NodeCard({
  node,
  x,
  y,
  selected,
  related,
  scenario,
  snapshot,
  stale,
  feedback,
  onClick,
  onCrash,
  onRestart,
}: Props) {
  const view = presentNode(node, scenario, snapshot);
  const compact = view.density === "compact";
  const role = view.role ?? "";
  const leader = role === "LEADER" || role === "PRIMARY" || role === "COORDINATOR";
  const candidate = role === "CANDIDATE";
  const remaining = view.timer ? Math.round(view.timer.remaining) : 0;
  const ratio = view.timer ? Math.min(1, view.timer.remaining / view.timer.total) : 0;
  const urgent = Boolean(view.timer && ratio < 0.28 && node.status === "running");
  const showTimerLabel = Boolean(view.timer && (view.showTimerLabel || selected));
  const secondaryAlert = view.secondary === "STALE" || view.secondary === "SUSPECTED";
  const roleChanged = feedback.role || feedback.fields.has("role");
  const knownChanged = feedback.fields.has("known");
  const primaryChanged = feedback.fields.has("primary");
  const secondaryChanged = feedback.fields.has("secondary");

  return (
    <div
      style={{ left: x, top: y }}
      {...stylex.props(nodeStyles.wrap, selected && nodeStyles.wrapSelected)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        {...stylex.props(
          nodeStyles.card,
          compact && nodeStyles.cardCompact,
          selected && nodeStyles.selected,
          related && !selected && nodeStyles.related,
          feedback.send && !selected && nodeStyles.send,
          feedback.receive && !selected && nodeStyles.receive,
          feedback.receive && selected && nodeStyles.receiveSelected,
          node.status === "stopped" && nodeStyles.stopped,
          leader && nodeStyles.leader,
          stale && nodeStyles.stale,
        )}
      >
        <div {...stylex.props(nodeStyles.header, compact && nodeStyles.headerCompact)}>
          <span {...stylex.props(nodeStyles.id, compact && nodeStyles.idCompact)}>{node.id}</span>
          <span
            {...stylex.props(
              nodeStyles.dot,
              leader && nodeStyles.dotLeader,
              candidate && nodeStyles.dotCandidate,
              node.status === "stopped" && nodeStyles.dotStopped,
            )}
          />
        </div>
        {role ? (
          <div
            {...stylex.props(
              nodeStyles.role,
              compact && nodeStyles.roleCompact,
              role === "FOLLOWER" && nodeStyles.roleFollower,
              role === "CANDIDATE" && nodeStyles.roleCandidate,
              leader && nodeStyles.roleLeader,
              (role === "CRASHED" || node.status === "stopped") && nodeStyles.roleCrashed,
              roleChanged && nodeStyles.rolePulse,
            )}
          >
            {role}
          </div>
        ) : null}
        {view.placeholder ? (
          <div
            {...stylex.props(nodeStyles.placeholder, knownChanged && nodeStyles.fieldPulse)}
          >
            {view.placeholder}
          </div>
        ) : null}
        {view.badges && view.badges.length > 0 ? (
          <div {...stylex.props(nodeStyles.badges)}>
            {view.badges.map((badge) => (
              <span
                key={badge.label}
                {...stylex.props(nodeStyles.badge, knownChanged && nodeStyles.fieldPulse)}
              >
                [{badge.label}]
              </span>
            ))}
          </div>
        ) : null}
        {view.primary ? (
          <div {...stylex.props(nodeStyles.line, primaryChanged && nodeStyles.fieldPulse)}>
            {view.primary}
          </div>
        ) : null}
        {(view.secondary && (view.density === "expanded" || selected)) || secondaryAlert ? (
          <div
            {...stylex.props(
              nodeStyles.line,
              nodeStyles.lineMuted,
              secondaryAlert && nodeStyles.lineAlert,
              secondaryChanged && nodeStyles.fieldPulse,
            )}
          >
            {view.secondary}
          </div>
        ) : null}
        {view.timer && node.status === "running" ? (
          <div {...stylex.props(nodeStyles.timer, compact && nodeStyles.timerCompact)}>
            {showTimerLabel ? (
              <div {...stylex.props(nodeStyles.timerLabel)}>{timerLabel(view.timer.name)}</div>
            ) : null}
            <div {...stylex.props(nodeStyles.timerRow)}>
              <div {...stylex.props(nodeStyles.timerTrack, compact && nodeStyles.timerTrackCompact)}>
                <div
                  {...stylex.props(
                    nodeStyles.timerFill,
                    urgent && nodeStyles.timerUrgent,
                    feedback.timer && nodeStyles.timerFillPulse,
                  )}
                  style={{ width: `${Math.max(4, ratio * 100)}%` }}
                />
              </div>
              <span
                {...stylex.props(nodeStyles.timerRemain, feedback.timer && nodeStyles.timerPulse)}
              >
                {remaining}ms
              </span>
            </div>
          </div>
        ) : null}
      </button>
      {selected ? (
        <div {...stylex.props(nodeStyles.actions)} onClick={(e) => e.stopPropagation()}>
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
