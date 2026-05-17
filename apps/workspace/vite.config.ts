import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const bff = env.VITE_BFF_ORIGIN || "http://localhost:5174";
  return {
    plugins: [react()],
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
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: { react: ["react", "react-dom"] },
        },
      },
    },
  };
});
