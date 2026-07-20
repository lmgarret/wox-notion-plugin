import { defineConfig } from "tsup"

export default defineConfig({
  entry: { index: "src/index.ts" },
  outDir: "dist",
  // The Wox nodejs host loads a single self-contained CommonJS file: the
  // installed plugin ships without node_modules, so bundle every dependency.
  format: ["cjs"],
  outExtension: () => ({ js: ".js" }),
  platform: "node",
  target: "node20",
  noExternal: [/.*/],
  sourcemap: false,
  minify: false,
  clean: true,
  // Keep dist/ a complete, loadable plugin directory for Wox dev mode.
  onSuccess: "node scripts/copy-assets.mjs",
})
