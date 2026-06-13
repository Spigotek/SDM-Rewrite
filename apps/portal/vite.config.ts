import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const bff = env.VITE_BFF_ORIGIN || "http://localhost:5174";

  const plugins: PluginOption[] = [
    react(),
    // K.3.D — `vite-plugin-svgr` adoption. `icon: true` strips
    // width/height so the host controls sizing via CSS;
    // `convertColors` with `currentColor` lets the surrounding text
    // colour drive the accent (per K.1 brief §9 illustration strategy).
    svgr({
      svgrOptions: {
        icon: true,
        svgo: true,
        svgoConfig: {
          plugins: [
            { name: "preset-default", params: { overrides: { removeViewBox: false } } },
            { name: "convertColors", params: { currentColor: true } },
          ],
        },
      },
    }),
  ];
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

  // PWA — Workbox-generated service worker via `vite-plugin-pwa`.
  // `devOptions.enabled: false` prevents collision with MSW in `vite dev`.
  // Conditional registration in `main.tsx` keeps MSW as sole SW controller
  // when `VITE_USE_MOCKS=true` (dev + CI acceptance journeys).
  // theme_color = --color-brand-600 (#4f46e5); background_color = --color-neutral-50 (#f8fafc, light default).
  plugins.push(
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "fonts/*.woff2"],
      manifest: {
        name: "Service Desk Management",
        short_name: "SDM",
        description: "Self-service portal for incidents, requests, knowledge base, and tickets.",
        theme_color: "#4f46e5",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "sk",
        dir: "ltr",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          { src: "/icons/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // /api/* GET (excluding KB attachments) — stale-while-revalidate, 1-day TTL, 50 entries.
          {
            urlPattern: /^https?:\/\/[^/]+\/api\/(?!attachments\/kb\/)/,
            handler: "StaleWhileRevalidate" as const,
            options: {
              cacheName: "api-v1",
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
            },
          },
          // /me + /config — network-first with 5 s timeout; fall back to cache.
          {
            urlPattern: /^https?:\/\/[^/]+\/(me|config)(\/|$|\?|#)/,
            handler: "NetworkFirst" as const,
            options: {
              cacheName: "session-v1",
              networkTimeoutSeconds: 5,
            },
          },
          // /api/attachments/kb/* — cache-first (J.5 storage immutable contract), 30-day TTL, 200 entries.
          {
            urlPattern: /^https?:\/\/[^/]+\/api\/attachments\/kb\//,
            handler: "CacheFirst" as const,
            options: {
              cacheName: "kb-attachments-v1",
              expiration: { maxEntries: 200, maxAgeSeconds: 2592000 },
            },
          },
        ],
      },
      // SW disabled in `vite dev` to avoid MSW collision. Only build outputs get a SW.
      devOptions: { enabled: false },
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
      // Alias order matters — Vite resolves in order and applies the first
      // match. `@sdm/i18n-real` MUST come before `@sdm/i18n` so the barrel
      // file at `i18n-portal.ts` can import the underlying package without
      // looping back through its own alias.
      alias: [
        { find: "@", replacement: path.resolve(__dirname, "src") },
        // I.0 Resolution 4 — escape hatch used by `i18n-portal.ts` to import
        // the real package without recursion. Matches `tsconfig.json#paths`.
        {
          find: "@sdm/i18n-real",
          replacement: path.resolve(__dirname, "../../packages/i18n/src/index.ts"),
        },
        // I.0 Resolution 4 — every portal source's `@sdm/i18n` import is
        // rewritten to the portal-local barrel. The barrel replaces
        // `useTranslation` with the critical-path shim and re-exports
        // everything else from `@sdm/i18n-real`. Effect: `vendor-i18n` is
        // no longer in the entry chunk; `bootstrap/i18n-late.ts` lazy-loads
        // it after first paint.
        {
          find: /^@sdm\/i18n$/,
          replacement: path.resolve(__dirname, "src/lib/i18n-portal.ts"),
        },
      ],
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
            // Markdown stack — used only on `/kb/article/:id`. Grouping the
            // three packages keeps the route chunk slim and the rest of the
            // portal pays zero markdown cost up front. Per H.6 §Bundle
            // awareness this stays under a 30 KB gzip budget.
            if (
              /[\\/]node_modules[\\/](?:\.pnpm[\\/])?(?:react-markdown|remark-gfm|rehype-sanitize|micromark|mdast-util-|hast-util-|unist-util-|unified|vfile|bail|trough|is-plain-obj|space-separated-tokens|comma-separated-tokens|hastscript|property-information|html-url-attributes|character-entities|decode-named-character-reference|devlop|ccount|escape-string-regexp|html-void-elements|longest-streak|markdown-table|estree-util-|estree-walker|zwitch|trim-lines|stringify-entities|web-namespaces)[@\\/]/.test(
                id,
              )
            ) {
              return "vendor-markdown";
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
              /[\\/]node_modules[\\/](?:\.pnpm[\\/])?(?:react-router|react-router-dom|@remix-run[\\/])/.test(
                id,
              )
            ) {
              return "vendor-router";
            }
            if (/[\\/]node_modules[\\/](?:\.pnpm[\\/])?(?:@tanstack[\\/])/.test(id)) {
              return "vendor-state";
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
