import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const bff = env.VITE_BFF_ORIGIN || "http://localhost:5174";

  const plugins: PluginOption[] = [react()];
  // Source maps are produced as `hidden` so the prod bundle has NO trailing
  // `//# sourceMappingURL=` comment — they only live in Sentry. The plugin
  // is gated on `SENTRY_AUTH_TOKEN` so local `pnpm build` stays offline.
  if (process.env.SENTRY_AUTH_TOKEN) {
    const releaseName = process.env.SENTRY_RELEASE ?? process.env.GITHUB_SHA;
    plugins.push(
      sentryVitePlugin({
        org: process.env.SENTRY_ORG ?? "sdm-rewrite",
        project: process.env.SENTRY_PROJECT_PORTAL ?? "sdm-portal",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: { assets: "./dist/**" },
        ...(releaseName ? { release: { name: releaseName } } : {}),
        telemetry: false,
      }),
    );
  }

  // `rollup-plugin-visualizer` emits `dist/stats.html` with per-chunk gzip +
  // brotli sizes so each PR carries an attachable bundle report. The plugin
  // runs in build mode only; dev server is unaffected.
  plugins.push(
    visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
      template: "treemap",
    }) as PluginOption,
  );

  return {
    plugins,
    server: {
      port: env.VITE_DEV_PORT ? Number(env.VITE_DEV_PORT) : 5173,
      strictPort: true,
      proxy: {
        "/api": { target: bff, changeOrigin: true, secure: false },
        "/auth": { target: bff, changeOrigin: true, secure: false },
        "/me": { target: bff, changeOrigin: true, secure: false },
      },
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    build: {
      target: "es2022",
      // `hidden` = maps generated but not referenced from JS bundles. Vite
      // strips the trailing `//# sourceMappingURL=` comment so prod users
      // can't fetch the maps; Sentry uses uploaded artifacts.
      sourcemap: "hidden",
      rollupOptions: {
        output: {
          // Vendor split per G.4 — predictable file names for HTTP cache
          // and per-vendor size-limit budgets. Groups follow
          // `performance.md §3 baseline` (React 44 KB, Radix 15-35 KB,
          // i18next 25 KB, Sentry 26 KB). The pattern matches paths inside
          // pnpm's `node_modules/.pnpm/<pkg>@<ver>/...` layout.
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (/[\\/]node_modules[\\/](?:\.pnpm[\\/])?(?:@sentry[\\/])/.test(id)) {
              return "vendor-observability";
            }
            if (/[\\/]node_modules[\\/](?:\.pnpm[\\/])?(?:@radix-ui[\\/]|lucide-react)/.test(id)) {
              return "vendor-ds";
            }
            if (
              /[\\/]node_modules[\\/](?:\.pnpm[\\/])?(?:i18next|react-i18next|intl-messageformat|@formatjs[\\/])/.test(
                id,
              )
            ) {
              return "vendor-i18n";
            }
            if (
              /[\\/]node_modules[\\/](?:\.pnpm[\\/])?(?:react|react-dom|scheduler)[@\\/]/.test(id)
            ) {
              return "vendor-react";
            }
            return undefined;
          },
        },
      },
    },
  };
});
