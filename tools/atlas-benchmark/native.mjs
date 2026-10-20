// Run after build:desktop, through tools/ui-session.py timeout --signal=TERM --kill-after=10s 300s.
// Native baseline only: rAF intervals are not compositor presentation timestamps.
import { _electron } from "playwright-core";
import {
  mkdir,
  mkdtemp,
  copyFile,
  readFile,
  writeFile,
} from "node:fs/promises";
import { homedir, cpus, totalmem } from "node:os";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
const fixture = process.argv[2];
if (!fixture || process.argv.length !== 3)
  throw Error(
    "Usage: node tools/atlas-benchmark/native.mjs <fixture-directory>",
  );
const manifest = JSON.parse(
  await readFile(resolve(fixture, "manifest.json"), "utf8"),
);
const parent = homedir() + "/.cache/saltmarcher/unified-atlas/native";
await mkdir(parent, { recursive: true });
const output = await mkdtemp(parent + "/baseline-"),
  profile = output + "/profile";
await mkdir(profile);
await copyFile(
  resolve(fixture, "workbench.sqlite"),
  profile + "/workbench.sqlite",
);
const result = {
  fixture: manifest,
  output,
  cpu: cpus()[0]?.model,
  memoryBytes: totalmem(),
  errors: [],
  steps: [],
  limits: [
    "Fresh process, uncontrolled OS cache and host load.",
    "rAF intervals and stable-region observation (including a 200 ms stability guard), not compositor presentation or first changed pixels.",
    "Small scene only; no P0/P1/P8 performance acceptance.",
  ],
};
let app, page, exitPromise;
const ready = () =>
  page.waitForFunction(
    () =>
      document.querySelector("#campaign-atlas")?.dataset.regionState ===
        "ready" &&
      document.querySelector("#campaign-map")?.dataset.canvasState === "loaded",
    null,
    { timeout: 45000 },
  );
const view = () =>
  page
    .locator("#campaign-map")
    .evaluate((n) => JSON.parse(n.dataset.atlasView));
const checkpoint = async () => {
  await writeFile(
    output + "/checkpoint.json",
    JSON.stringify(result, null, 2) + "\n",
  );
};
const stableReady = async () => {
  await page.evaluate(() => {
    window.benchmarkStable = null;
  });
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("#campaign-map"),
        now = performance.now();
      const signature = canvas?.dataset.atlasView;
      const ready =
        document.querySelector("#campaign-atlas")?.dataset.regionState ===
          "ready" && canvas?.dataset.canvasState === "loaded";
      const prior = window.benchmarkStable;
      if (!ready || !prior || prior.signature !== signature) {
        window.benchmarkStable = { signature, since: now };
        return false;
      }
      return now - prior.since >= 200;
    },
    null,
    { timeout: 45000 },
  );
};
await checkpoint();
try {
  const start = performance.now();
  app = await _electron.launch({
    executablePath: resolve("node_modules/electron/dist/electron"),
    args: [
      resolve(".build/desktop/main.cjs"),
      "--data-dir",
      profile,
      "--ozone-platform=x11",
    ],
    timeout: 45000,
  });
  exitPromise = new Promise((resolve) =>
    app.process().once("exit", (code, signal) => resolve({ code, signal })),
  );
  page = await app.firstWindow();
  page.on("pageerror", (error) => result.errors.push(error.stack));
  await page.waitForFunction(
    () => document.body.dataset.tutorialReady === "true",
  );
  await page
    .locator(`.campaign-card[data-campaign-id="${manifest.campaignId}"]`)
    .getByRole("button", { name: "Fortsetzen", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains("has-workspace") &&
      !document.querySelector("main").inert,
  );
  if (await page.locator("#campaign-atlas").isHidden()) {
    if (!(await page.locator("#atlas-tab").isVisible()))
      await page.locator("#workspace-nav-summary").click();
    await page.locator("#atlas-tab").click();
  }
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === "SaltMarcher")
      .setContentSize(1920, 1080),
  );
  await ready();
  result.processToReadyMs = performance.now() - start;
  await page.locator("#atlas-overview").click();
  await stableReady();
  result.overview = await view();
  await page.screenshot({ path: output + "/overview.png" });
  await checkpoint();
  await page.evaluate(() => {
    window.benchmarkFrames = { running: true, times: [] };
    const frame = (t) => {
      const s = window.benchmarkFrames;
      if (s.running) {
        s.times.push(t);
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
  });
  // Same actual wheel input at the village for every candidate. Keep the point
  // under the pointer; record each published viewport and settled response.
  for (let i = 0; i < 24; i++) {
    const before = await view();
    if (before.width < 80) break;
    const point = await page.locator("#campaign-map").evaluate((n, anchor) => {
      const v = JSON.parse(n.dataset.atlasView),
        r = n.getBoundingClientRect();
      return {
        x: r.x + ((anchor.x - v.x) / v.width) * r.width,
        y: r.y + ((anchor.y - v.y) / v.height) * r.height,
      };
    }, manifest.anchors.village);
    const bounds = await page.locator("#campaign-map").boundingBox();
    assert(
      point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height,
      "village must remain in view",
    );
    await page.mouse.move(point.x, point.y);
    const started = performance.now();
    await page.mouse.wheel(0, -400);
    await page.waitForFunction(
      (width) =>
        JSON.parse(document.querySelector("#campaign-map").dataset.atlasView)
          .width < width,
      before.width,
    );
    await stableReady();
    const after = await view();
    result.steps.push({
      before,
      after,
      inputToStableReadyObservedMs: performance.now() - started,
    });
    if (!result.region && after.width <= 65536) {
      result.region = after;
      await page.screenshot({ path: output + "/region.png" });
    }
    await checkpoint();
    console.log(JSON.stringify({ step: i + 1, width: after.width, output }));
  }
  const frames = await page.evaluate(() => {
    window.benchmarkFrames.running = false;
    return window.benchmarkFrames.times;
  });
  const gaps = frames
    .slice(1)
    .map((t, i) => t - frames[i])
    .sort((a, b) => a - b);
  const percentile = (p) =>
    gaps[Math.min(gaps.length - 1, Math.ceil(gaps.length * p) - 1)] ?? null;
  result.animationFrames = {
    count: frames.length,
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    maxMs: gaps.at(-1),
    timestamps: frames,
  };
  result.detail = await view();
  await page.screenshot({ path: output + "/village.png" });
  assert(
    result.detail.width < 80,
    "gesture must actually reach building scale",
  );
  assert.deepEqual(result.errors, []);
  result.navigationCompleted = true;
} catch (error) {
  result.failure = String(error.stack ?? error);
  await page?.screenshot({ path: output + "/failure.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (app) {
    await app
      .evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.getTitle() === "SaltMarcher")
          ?.close(),
      )
      .catch(() => {});
    result.exit = await Promise.race([
      exitPromise,
      new Promise((resolve) =>
        setTimeout(() => resolve({ timeout: true }), 10000),
      ),
    ]);
    if (result.exit?.timeout) {
      await app.close().catch(() => {});
      process.exitCode = 1;
    }
    if (result.exit?.code !== 0 || result.exit?.signal !== null)
      process.exitCode = 1;
  }
  await writeFile(
    output + "/result.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      output,
      navigationCompleted: result.navigationCompleted,
      exit: result.exit,
      failure: result.failure,
    }),
  );
}
