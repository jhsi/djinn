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
};

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    bg: "#10100E",
    ink: "#EDECE6",
    lime: "#C6FF00",
    coral: "#FF4B6A",
    muted: "#8A8A82",
    faint: "#2E2E28",
    white: "#1A1A16",
    line: "#4A4A42",
  },
  light: {
    bg: "#F3F2EC",
    ink: "#111111",
    lime: "#C6FF00",
    coral: "#FF4B6A",
    muted: "#6B6B64",
    faint: "#D4D4CC",
    white: "#FFFEFA",
    line: "#C8C8BE",
  },
};
