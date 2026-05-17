import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/handlers/__tests__/setup.ts"],
    passWithNoTests: false,
  },
});
