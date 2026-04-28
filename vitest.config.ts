import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["lib/**/*.ts", "components/**/*.tsx"],
      exclude: ["**/*.test.*", "**/index.ts"],
      thresholds: {
        "lib/**": { lines: 90, functions: 90, branches: 85 },
        "components/**": { lines: 75, functions: 75, branches: 70 },
      },
    },
  },
});
