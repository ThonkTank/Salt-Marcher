import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Production-mode application and browser bridge, isolated from normal builds.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir:
      process.env.ATLAS_PERF_WEB ??
      "src-tauri/target/cleanup/atlas-simplify/performance-web",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve("index.html"),
        harness: resolve("tests/support/atlas.html"),
      },
    },
  },
});
