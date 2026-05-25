import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

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
        project: process.env.SENTRY_PROJECT_WORKSPACE ?? "sdm-workspace",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: { assets: "./dist/**" },
        ...(releaseName ? { release: { name: releaseName } } : {}),
        telemetry: false,
      }),
    );
  }

  return {
    plugins,
    server: {
      port: env.VITE_DEV_PORT ? Number(env.VITE_DEV_PORT) : 5175,
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
          manualChunks: { react: ["react", "react-dom"] },
        },
      },
    },
  };
});
