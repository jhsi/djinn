import * as stylex from "@stylexjs/stylex";

export const colors = stylex.defineVars({
  bg: "#10100E",
  ink: "#EDECE6",
  lime: "#C6FF00",
  coral: "#FF4B6A",
  muted: "#8A8A82",
  faint: "#2E2E28",
  white: "#1A1A16",
  paleLime: "#1A2410",
  paleCoral: "#2A1418",
  charcoal: "#111111",
  leaf: "#9BE36A",
  line: "#4A4A42",
});

export const fonts = stylex.defineVars({
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  display: '"Syne", "IBM Plex Mono", sans-serif',
});

export const lightTheme = stylex.createTheme(colors, {
  bg: "#F3F2EC",
  ink: "#111111",
  lime: "#C6FF00",
  coral: "#FF4B6A",
  muted: "#6B6B64",
  faint: "#D4D4CC",
  white: "#FFFEFA",
  paleLime: "#EEF6C4",
  paleCoral: "#FFE4E8",
  charcoal: "#111111",
  leaf: "#2F7A3C",
  line: "#C8C8BE",
});
