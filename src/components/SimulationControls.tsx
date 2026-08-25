import * as stylex from "@stylexjs/stylex";
import type { PlaybackSpeed, SimStatus } from "../simulation/types";
import { colors, fonts } from "../ui/theme.stylex";

const SPEEDS: { value: PlaybackSpeed; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: 0.25, label: "0.25×" },
  { value: 1, label: "1×" },
  { value: 4, label: "4×" },
  { value: 32, label: "Instant" },
];

type Props = {
  status: SimStatus;
  speed: PlaybackSpeed;
  onReset: () => void;
  onPlayPause: () => void;
  onStep: () => void;
  onSpeed: (speed: PlaybackSpeed) => void;
};

export function SimulationControls({
  status,
  speed,
  onReset,
  onPlayPause,
  onStep,
  onSpeed,
}: Props) {
  const playing = status === "playing";
  return (
    <div {...stylex.props(styles.row)}>
      <div {...stylex.props(styles.playback)}>
        <button type="button" onClick={onReset} {...stylex.props(styles.ghost)}>
          Reset
        </button>
        <button
          type="button"
          onClick={onPlayPause}
          aria-label={playing ? "Pause" : "Play"}
          {...stylex.props(styles.play)}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={onStep} {...stylex.props(styles.step)}>
          <StepIcon />
          Step
        </button>
      </div>
      <div {...stylex.props(styles.speeds)}>
        {SPEEDS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSpeed(s.value)}
            {...stylex.props(styles.speed, speed === s.value && styles.speedOn)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 1.2v9.6L10.8 6 2.5 1.2Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="2.2" y="1.5" width="2.6" height="9" fill="currentColor" />
      <rect x="7.2" y="1.5" width="2.6" height="9" fill="currentColor" />
    </svg>
  );
}

function StepIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1.4" y="1.6" width="1.6" height="8.8" fill="currentColor" />
      <path d="M4.4 1.4v9.2L11 6 4.4 1.4Z" fill="currentColor" />
    </svg>
  );
}

const styles = stylex.create({
  row: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    flexShrink: 0,
    fontFamily: fonts.ui,
  },
  playback: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  ghost: {
    backgroundColor: "transparent",
    color: colors.muted,
    borderWidth: 0,
    padding: "6px 8px",
    fontFamily: fonts.ui,
    fontSize: 13,
    cursor: "pointer",
  },
  play: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.lime,
    color: colors.charcoal,
    borderWidth: 0,
    minWidth: 84,
    minHeight: 34,
    padding: "7px 16px",
    fontFamily: fonts.ui,
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 600,
  },
  step: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    backgroundColor: "transparent",
    color: colors.ink,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.lime,
    padding: "6px 12px",
    fontFamily: fonts.ui,
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 500,
  },
  speeds: {
    display: "flex",
    alignItems: "center",
    gap: 2,
  },
  speed: {
    backgroundColor: "transparent",
    color: colors.muted,
    borderWidth: 0,
    padding: "5px 8px",
    fontFamily: fonts.ui,
    fontSize: 12,
    cursor: "pointer",
  },
  speedOn: {
    color: colors.ink,
    fontWeight: 600,
  },
});
