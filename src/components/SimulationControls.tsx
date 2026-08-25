import * as stylex from "@stylexjs/stylex";
import type { PlaybackSpeed, SimStatus } from "../simulation/types";
import { colors, fonts } from "../ui/theme.stylex";

const SPEEDS: { value: PlaybackSpeed; label: string }[] = [
  { value: 0.25, label: "0.25×" },
  { value: 1, label: "1×" },
  { value: 4, label: "4×" },
  { value: 32, label: "instant" },
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
  return (
    <div {...stylex.props(styles.row)}>
      <button type="button" onClick={onReset} {...stylex.props(styles.ghost)}>
        Reset
      </button>
      <button
        type="button"
        onClick={onPlayPause}
        {...stylex.props(styles.solid)}
      >
        {status === "playing" ? "Pause" : "Play"}
      </button>
      <button type="button" onClick={onStep} {...stylex.props(styles.solid)}>
        Step
      </button>
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

const styles = stylex.create({
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: fonts.mono,
  },
  ghost: {
    backgroundColor: "transparent",
    color: colors.ink,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.faint,
    padding: "6px 10px",
    fontFamily: fonts.mono,
    fontSize: 12,
    cursor: "pointer",
  },
  solid: {
    backgroundColor: colors.lime,
    color: colors.charcoal,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.lime,
    padding: "6px 12px",
    fontFamily: fonts.mono,
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 600,
  },
  speeds: {
    display: "flex",
    marginLeft: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.faint,
  },
  speed: {
    backgroundColor: "transparent",
    color: colors.ink,
    borderWidth: 0,
    padding: "6px 8px",
    fontFamily: fonts.mono,
    fontSize: 11,
    cursor: "pointer",
  },
  speedOn: {
    backgroundColor: colors.lime,
    color: colors.charcoal,
    fontWeight: 600,
  },
});
