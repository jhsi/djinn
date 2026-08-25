import * as stylex from "@stylexjs/stylex";
import { colors, fonts } from "../ui/theme.stylex";

export const nodeStyles = stylex.create({
  wrap: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  wrapSelected: {
    zIndex: 4,
  },
  card: {
    width: 172,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.faint,
    padding: "12px 14px 14px",
    cursor: "pointer",
    color: colors.ink,
    fontFamily: fonts.mono,
    boxSizing: "border-box",
    userSelect: "none",
    textAlign: "left",
  },
  cardCompact: {
    width: 128,
    padding: "8px 10px 10px",
  },
  selected: {
    borderColor: colors.lime,
    backgroundColor: colors.paleLime,
  },
  related: {
    borderColor: colors.line,
  },
  send: {
    borderColor: colors.line,
  },
  receive: {
    borderColor: colors.line,
    backgroundColor: colors.paleLime,
  },
  receiveSelected: {
    borderLeftWidth: 2,
    borderLeftStyle: "solid",
    borderLeftColor: colors.lime,
  },
  rolePulse: {
    backgroundColor: colors.faint,
    color: colors.ink,
    fontWeight: 700,
    paddingLeft: 4,
    paddingRight: 4,
    marginLeft: -4,
    marginRight: -4,
  },
  fieldPulse: {
    backgroundColor: colors.faint,
    color: colors.ink,
    paddingLeft: 4,
    paddingRight: 4,
    marginLeft: -4,
    marginRight: -4,
  },
  timerPulse: {
    color: colors.ink,
    fontWeight: 600,
  },
  timerFillPulse: {
    backgroundColor: colors.leaf,
  },
  stopped: {
    opacity: 0.58,
  },
  leader: {
    backgroundColor: colors.paleLime,
  },
  stale: {
    backgroundColor: colors.paleCoral,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  headerCompact: {
    marginBottom: 6,
  },
  id: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: "0.04em",
    lineHeight: 1.1,
  },
  idCompact: {
    fontSize: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    backgroundColor: colors.quiet,
    flexShrink: 0,
  },
  dotLeader: {
    backgroundColor: colors.leaf,
  },
  dotCandidate: {
    borderRadius: 1,
    backgroundColor: colors.ink,
  },
  dotStopped: {
    backgroundColor: colors.coral,
  },
  role: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    marginBottom: 6,
    lineHeight: 1.2,
  },
  roleCompact: {
    fontSize: 10,
    marginBottom: 4,
  },
  roleFollower: {
    color: colors.muted,
    fontWeight: 500,
  },
  roleCandidate: {
    color: colors.ink,
    fontWeight: 700,
  },
  roleLeader: {
    color: colors.leaf,
    fontWeight: 700,
  },
  roleCrashed: {
    color: colors.coral,
    fontWeight: 700,
  },
  line: {
    fontSize: 12,
    lineHeight: 1.45,
    color: colors.ink,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  lineMuted: {
    color: colors.muted,
  },
  lineAlert: {
    color: colors.coral,
  },
  placeholder: {
    fontSize: 16,
    color: colors.muted,
    lineHeight: 1.2,
    marginBottom: 2,
  },
  badges: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 2,
  },
  badge: {
    fontSize: 12,
    lineHeight: 1.3,
    color: colors.ink,
    fontWeight: 600,
  },
  changed: {
    color: colors.lime,
  },
  timer: {
    marginTop: 10,
  },
  timerCompact: {
    marginTop: 8,
  },
  timerLabel: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
    marginBottom: 5,
  },
  timerRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  timerTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.faint,
    overflow: "hidden",
    minWidth: 0,
  },
  timerTrackCompact: {
    height: 4,
  },
  timerFill: {
    height: "100%",
    backgroundColor: colors.quiet,
  },
  timerUrgent: {
    backgroundColor: colors.coral,
  },
  timerRemain: {
    fontSize: 11,
    color: colors.ink,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
    minWidth: 40,
    textAlign: "right",
  },
  flash: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: "0.02em",
    maxWidth: 172,
    textAlign: "center",
    lineHeight: 1.35,
  },
  actions: {
    display: "flex",
    gap: 6,
  },
  action: {
    backgroundColor: "transparent",
    color: colors.ink,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.line,
    fontFamily: fonts.ui,
    fontSize: 11,
    padding: "4px 9px",
    cursor: "pointer",
  },
  danger: {
    backgroundColor: "transparent",
    color: colors.coral,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.coral,
    fontFamily: fonts.ui,
    fontSize: 11,
    padding: "4px 9px",
    cursor: "pointer",
  },
});
