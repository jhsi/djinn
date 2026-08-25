export type ThemeName = "dark" | "light";

export type Palette = {
  bg: string;
  ink: string;
  lime: string;
  coral: string;
  muted: string;
  faint: string;
  white: string;
  line: string;
  quiet: string;
  edge: string;
};

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    bg: "#10100E",
    ink: "#EDECE6",
    lime: "#C6FF00",
    coral: "#FF4B6A",
    muted: "#8A8A82",
    faint: "#2E2E28",
    white: "#161612",
    line: "#6A6A60",
    quiet: "#5C7340",
    edge: "#3A3A34",
  },
  light: {
    bg: "#F3F2EC",
    ink: "#111111",
    lime: "#C6FF00",
    coral: "#FF4B6A",
    muted: "#6B6B64",
    faint: "#D4D4CC",
    white: "#FFFEFA",
    line: "#A8A89E",
    quiet: "#5A7344",
    edge: "#C4C4BA",
  },
};
