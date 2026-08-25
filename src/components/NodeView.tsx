import * as stylex from "@stylexjs/stylex";
import { colors, fonts } from "../ui/theme.stylex";

export const nodeStyles = stylex.create({
  card: {
    position: "absolute",
    width: 168,
    transform: "translate(-50%, -50%)",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.ink,
    padding: "10px 12px 12px",
    cursor: "pointer",
    color: colors.ink,
    fontFamily: fonts.mono,
    boxSizing: "border-box",
    userSelect: "none",
  },
  selected: {
    outlineWidth: 2,
    outlineStyle: "solid",
    outlineColor: colors.lime,
    outlineOffset: 2,
  },
  stopped: {
    borderColor: colors.coral,
    opacity: 0.72,
  },
  leader: {
    backgroundColor: colors.paleLime,
  },
  stale: {
    backgroundColor: colors.paleCoral,
  },
  informed: {
    backgroundColor: colors.paleLime,
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  id: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.08em",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  status: {
    fontSize: 9,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: colors.muted,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    backgroundColor: colors.lime,
    flexShrink: 0,
  },
  dotStopped: {
    backgroundColor: colors.coral,
  },
  line: {
    fontSize: 11,
    lineHeight: 1.45,
    color: colors.ink,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  muted: {
    color: colors.muted,
  },
});
