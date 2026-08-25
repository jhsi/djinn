import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import stylex from "@stylexjs/unplugin";

const isTest = process.env.VITEST === "true";

export default defineConfig({
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
