import { defineConfig } from "@playwright/test";

const output =
  (process.env.ATLAS_PERF_OUTPUT ??= `src-tauri/target/cleanup/atlas-simplify/performance-${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`);
export default defineConfig({
  testDir: "tests/performance",
  timeout: 900_000,
  workers: 1,
  retries: 0,
  expect: { timeout: 120_000 },
  outputDir: `${output}/results`,
  reporter: [["list"]],
  use: { viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 },
  webServer: {
    command:
      "npx vite preview --config vite.performance.config.ts --host 127.0.0.1 --port 1422 --strictPort",
    url: "http://127.0.0.1:1422/tests/support/atlas.html",
    reuseExistingServer: false,
  },
});
