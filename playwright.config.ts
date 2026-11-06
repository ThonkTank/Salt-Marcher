import { defineConfig } from "@playwright/test";
import { testOrigin, testPort } from "./tests/support/browserServer";
// Playwright loads this config in workers too; inherit one run directory.
const diagnosticsRun =
  (process.env.PLAYWRIGHT_DIAGNOSTICS_RUN ??= `src-tauri/target/diagnostics/playwright-${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`);
export default defineConfig({
  globalSetup: "./tests/support/buildCore.ts",
  workers: 1,
  outputDir: `${diagnosticsRun}/results`,
  reporter: [
    ["list"],
    ["html", { outputFolder: `${diagnosticsRun}/report`, open: "never" }],
  ],
  testDir: "tests/product",
  use: { viewport: { width: 1440, height: 960 } },
  webServer: {
    command: `npm run dev -- --port ${testPort} --strictPort`,
    url: testOrigin,
    reuseExistingServer: false,
  },
});
