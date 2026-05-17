import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  bundle: true,
  treeshake: true,
  outDir: "dist",
  outExtension: () => ({ js: ".js" }),
  noExternal: [/^@sdm\//],
});
