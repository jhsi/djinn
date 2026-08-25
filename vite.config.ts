import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import stylex from "@stylexjs/unplugin";

const isTest = process.env.VITEST === "true";
/** GitHub Pages serves this repo at jameshsi.com/djinn/ */
const base = process.env.GITHUB_ACTIONS ? "/djinn/" : "/";

export default defineConfig({
  base,
  plugins: [
    ...(!isTest
      ? [
          stylex.vite({
            useCSSLayers: true,
          }),
        ]
      : []),
    react(),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
