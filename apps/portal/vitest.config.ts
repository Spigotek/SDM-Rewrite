// Portal vitest config — minimal, added in I.0 Resolution 4 to cover the
// i18n critical-path shim. Existing portal coverage is Playwright + LHCI;
// this opens a tiny unit-test surface so the shim's hydration lifecycle has
// deterministic regression protection. Future portal tests drop in under
// `src/**/__tests__/**/*.test.{ts,tsx}`.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Tests run against the real `@sdm/i18n` package — the production
      // Vite alias to `i18n-portal` is irrelevant here because tests import
      // the shim directly.
      "@sdm/i18n": path.resolve(__dirname, "../../packages/i18n/src/index.ts"),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    passWithNoTests: true,
  },
});
