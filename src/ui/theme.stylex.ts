import * as stylex from "@stylexjs/stylex";

export const colors = stylex.defineVars({
  bg: "#10100E",
  ink: "#EDECE6",
  lime: "#C6FF00",
  coral: "#FF4B6A",
  muted: "#8A8A82",
  faint: "#2E2E28",
  white: "#161612",
  paleLime: "#161A12",
  paleCoral: "#221416",
  charcoal: "#111111",
  leaf: "#7A9A4A",
  quiet: "#5C7340",
  line: "#6A6A60",
  edge: "#3A3A34",
});

export const fonts = stylex.defineVars({
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  display: '"Syne", ui-sans-serif, system-ui, sans-serif',
  ui: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
});

export const lightTheme = stylex.createTheme(colors, {
  bg: "#F3F2EC",
  ink: "#111111",
  lime: "#C6FF00",
  coral: "#FF4B6A",
  muted: "#6B6B64",
  faint: "#D4D4CC",
  white: "#FFFEFA",
  paleLime: "#F2F4E8",
  paleCoral: "#F7ECEC",
  charcoal: "#111111",
  leaf: "#4A7A32",
  quiet: "#5A7344",
  line: "#A8A89E",
  edge: "#C4C4BA",
});
