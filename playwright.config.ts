import { defineConfig } from "@playwright/test";
// Playwright loads this config in workers too; inherit one run directory.
const diagnosticsRun =
  (process.env.PLAYWRIGHT_DIAGNOSTICS_RUN ??= `src-tauri/target/diagnostics/playwright-${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`);
export default defineConfig({
  outputDir: `${diagnosticsRun}/results`,
  reporter: [
    ["list"],
    ["html", { outputFolder: `${diagnosticsRun}/report`, open: "never" }],
  ],
  projects: [{ name: "product", testDir: "tests/product" }],
  use: { viewport: { width: 1440, height: 960 } },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: true,
  },
});
