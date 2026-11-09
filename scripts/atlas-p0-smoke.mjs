import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchAtlasDesktop, captureCanvas } from "./atlas-p0-desktop.mjs";
import {
  button,
  brush,
  exact,
  position,
  snapshot,
  stateSnapshot,
  capture,
  waterPixel,
  landPixel,
} from "./atlas-p0-interactions.mjs";
import { evaluateBrushTime } from "./atlas-p0-evaluate.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--"))
    throw new Error(`Missing value for ${name}`);
  return args[index + 1];
};
const executablePath = option("--executable", undefined);
const selection = option("--only", "all");
if (!["all", "normal", "stall", "lifecycle"].includes(selection))
  throw new Error("Unknown smoke selection");
const out = resolve(
  option(
    "--out",
    process.env.ATLAS_P0_SMOKE_OUTPUT ??
      `artifacts/atlas-rebuild/smoke-${new Date().toISOString().replaceAll(":", "-")}`,
  ),
);
await mkdir(out, { recursive: true });
const report = {
  purpose: "Short real Electron functional checks; no performance acceptance",
  selection,
  packaged: Boolean(executablePath),
  startedAt: new Date().toISOString(),
  build: JSON.parse(await readFile("desktop-dist/build.json", "utf8")),
  checks: [],
  cases: [],
  errors: [],
  passed: false,
};
const recordCheck = (name, passed, details) => {
  report.checks.push({
    name,
    passed: Boolean(passed),
    ...(details && { details }),
  });
  if (!passed) throw new Error(`Functional check failed: ${name}`);
};
const sessions = new Set();
async function launch({ label, diagnostics = false, project, env = {} }) {
  const directory = join(out, label);
  await mkdir(directory, { recursive: true });
  const desktop = await launchAtlasDesktop({
    executablePath,
    lab: true,
    diagnostics,
    project,
    env: { ATLAS_P0_DIALOG_UNSAVED: "discard", ...env },
  });
  const closeProcess = desktop.close;
  const session = {
    ...desktop,
    directory,
    instance: { id: label },
    close: async () => {
      try {
        // Scenario assertions use the real chosen answer. Only fixture teardown
        // changes that answer so a successfully tested Cancel cannot hang CI.
        if (!desktop.page.isClosed())
          await desktop.app.evaluate(() => {
            process.env.ATLAS_P0_DIALOG_UNSAVED = "discard";
          });
        await closeProcess();
      } finally {
        await writeFile(
          join(directory, "electron.log"),
          desktop.output.join(""),
        );
        sessions.delete(session);
      }
    },
  };
  sessions.add(session);
  try {
    await session.page.locator("canvas").waitFor({ state: "visible" });
    if (diagnostics)
      await session.page.waitForFunction(
        () => typeof window.atlasObserve === "function",
      );
    return session;
  } catch (error) {
    await session.close();
    throw error;
  }
}

async function waitForOrdinaryReady(page) {
  await page.waitForFunction(() => {
    const error = document.querySelector('[role="alert"]')?.textContent;
    if (error) throw new Error(error);
    return (
      document.querySelector("canvas")?.getAttribute("aria-busy") === "false"
    );
  });
}

async function waitForPixel(session, name, pixel, predicate) {
  const deadline = Date.now() + 10_000;
  let evidence;
  do {
    evidence = await captureCanvas(session, name, [pixel]);
    if (predicate(evidence.pixels[0])) return evidence;
    await session.page.waitForTimeout(80);
  } while (Date.now() < deadline);
  throw new Error(
    `${name}: expected terrain pixel was not visible (${evidence?.pixels})`,
  );
}

async function normalStart() {
  const file = join(out, "normal.saltatlas");
  let session = await launch({
    label: "normal-start",
    // Deliberately stale: a normal product start must ignore render faults.
    env: {
      ATLAS_P0_FAULT: "drop-render",
      ATLAS_P0_DIALOG_SAVE: file,
      ATLAS_P0_DIALOG_OPEN: file,
    },
  });
  try {
    const { page } = session;
    await waitForOrdinaryReady(page);
    recordCheck(
      "normal: diagnostic renderer and host absent",
      (await page.evaluate(
        () =>
          typeof window.atlasObserve === "undefined" &&
          window.atlasDesktop.diagnostics === false,
      )) &&
        (await session.app.evaluate(
          () => typeof globalThis.__atlasHost === "undefined",
        )),
    );
    recordCheck(
      "normal: requested executable identity",
      (await session.app.evaluate(({ app }) => app.isPackaged)) ===
        Boolean(executablePath),
    );
    recordCheck(
      "normal: diagnostic controls absent",
      (await page
        .getByRole("button", { name: "Hintergrundarbeit starten" })
        .count()) === 0,
    );
    const diameter = page.getByLabel("Pinselgröße", { exact: true });
    const initialDiameter = await diameter.inputValue();
    await diameter.fill("");
    await diameter.press("Tab");
    recordCheck(
      "normal: empty numeric draft restores value",
      (await diameter.inputValue()) === initialDiameter,
    );
    await diameter.fill("128");
    await diameter.press("Enter");
    recordCheck(
      "normal: numeric Enter commits value",
      (await diameter.inputValue()) === "128",
    );
    await brush(page, 128, 4000);
    await page.getByLabel("Raster anzeigen").uncheck();
    const box = await page.locator("canvas").boundingBox();
    if (!box) throw new Error("Normal canvas has no bounds");
    const at = {
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
    };
    const pixel = {
      x: Math.round(box.width / 2 + 8),
      y: Math.round(box.height / 2 + 8),
    };
    await page.mouse.move(at.x, at.y);
    await waitForOrdinaryReady(page);
    const before = await waitForPixel(session, "before", pixel, waterPixel);
    await page.mouse.down();
    await page.waitForTimeout(350);
    await page.mouse.up();
    // Move the cursor clear of the pixel without changing any author data.
    await page.mouse.move(at.x + 200, at.y);
    const changed = await waitForPixel(session, "edited", pixel, landPixel);
    recordCheck(
      "normal: ordinary brush changes visible terrain",
      landPixel(changed.pixels[0]),
      { before, changed },
    );
    await button(page, /Rückgängig/);
    await waitForPixel(session, "undone", pixel, waterPixel);
    recordCheck("normal: Undo restores terrain", true);
    await button(page, /Wiederholen/);
    await waitForPixel(session, "redone", pixel, landPixel);
    recordCheck("normal: Redo restores terrain", true);
    await button(page, "Speichern");
    await page.getByText("Datei gespeichert", { exact: true }).waitFor();
    recordCheck(
      "normal: real project file saved",
      (await stat(file)).size > 4096,
    );
    await button(page, "Neu");
    await waitForOrdinaryReady(page);
    await waitForPixel(session, "new-world", pixel, waterPixel);
    await button(page, "Öffnen");
    await waitForOrdinaryReady(page);
    await waitForPixel(session, "reopened", pixel, landPixel);
    recordCheck("normal: UI open preserves saved terrain", true);
    recordCheck(
      "normal: no renderer exception",
      session.errors.length === 0,
      session.errors,
    );
    await session.close();
    session = await launch({ label: "normal-restart", project: file });
    await waitForOrdinaryReady(session.page);
    await session.page.getByLabel("Raster anzeigen").uncheck();
    await waitForPixel(session, "restarted", pixel, landPixel);
    recordCheck("normal: fresh process preserves saved terrain", true);
    recordCheck(
      "normal: restart has no renderer exception",
      session.errors.length === 0,
      session.errors,
    );
  } finally {
    await session.close();
  }
}

const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
async function rendererStall(continueHolding) {
  const label = continueHolding ? "stall-held" : "stall-release";
  const session = await launch({ label, diagnostics: true });
  try {
    const { page } = session;
    await brush(page, 128, 4000);
    await page.getByLabel("Raster anzeigen").uncheck();
    await exact(page);
    const at = await position(page, [0, 0]);
    await page.mouse.move(at.x, at.y);
    await page.waitForFunction(
      () => window.atlasObserve([], { events: false }).readiness.ready,
    );
    const before = await snapshot(page, [[0, 0]]);
    await capture(session, "before", [[0, 0]]);
    await page.mouse.down();
    await page.waitForFunction(
      (sinceEvent) =>
        window
          .atlasObserve([], { sinceEvent })
          .events.some((e) => e.kind === "brush-submit"),
      before.eventCount,
    );
    const stall = await session.app.evaluate(
      async ({ BrowserWindow }, { at, continueHolding }) => {
        const contents = BrowserWindow.getAllWindows()[0].webContents;
        const block = contents.executeJavaScript(`(() => {
          const start = performance.now();
          while (performance.now() - start < 500) {}
          return { start, end: performance.now(), timeOrigin: performance.timeOrigin };
        })()`);
        let times;
        let resumed = false;
        if (continueHolding) {
          times = await block;
          // This is a functional recovery wait, not part of a latency sample.
          // A permanently stopped brush must not pass merely by adding no dose.
          const deadline = Date.now() + 5000;
          while (!resumed && Date.now() < deadline) {
            resumed =
              await contents.executeJavaScript(`window.atlasObserve().events.some(
              (event) => event.kind === "brush-accepted" && event.cause === "hold" && event.fromAt >= ${times.end}
            )`);
            if (!resumed)
              await new Promise((resolve) => setTimeout(resolve, 10));
          }
        } else await new Promise((resolve) => setTimeout(resolve, 100));
        const releasedEpochMs = Date.now();
        contents.sendInputEvent({
          type: "mouseUp",
          x: at.x,
          y: at.y,
          button: "left",
          clickCount: 1,
        });
        times ??= await block;
        return { ...times, releasedEpochMs, resumed };
      },
      { at, continueHolding },
    );
    await page.waitForFunction(() => {
      const o = window.atlasObserve([], { events: false });
      if (o.state.error) throw new Error(o.state.error);
      return !o.gesture && !o.state.writing;
    });
    await exact(page);
    const after = await snapshot(page, [[0, 0]], {
      sinceEvent: before.eventCount,
    });
    const ids = after.events
      .filter(
        (e) =>
          e.kind === "input" && ["edit", "pointerup"].includes(e.inputKind),
      )
      .map((e) => e.id);
    const time = evaluateBrushTime(after.events, ids, after.sessionId);
    const acceptedDuringStall = after.events
      .filter((e) => e.kind === "brush-accepted" && e.cause !== "press")
      .reduce(
        (sum, e) =>
          sum +
          overlap(e.fromAt, e.toAt, stall.start, stall.end) *
            (e.rawElapsedMs > 0 ? e.offeredElapsedMs / e.rawElapsedMs : 0),
        0,
      );
    const discardedDuringStall = after.events
      .filter((e) => e.kind === "brush-accepted")
      .reduce(
        (sum, e) =>
          sum +
          overlap(e.fromAt, e.toAt, stall.start, stall.end) *
            (e.rawElapsedMs > 0 ? 1 - e.offeredElapsedMs / e.rawElapsedMs : 0),
        0,
      );
    recordCheck(
      `${label}: renderer actually blocked for 500 ms`,
      stall.end - stall.start >= 500,
      stall,
    );
    recordCheck(
      `${label}: release dispatched in requested phase`,
      continueHolding
        ? stall.releasedEpochMs >= stall.timeOrigin + stall.end
        : stall.releasedEpochMs > stall.timeOrigin + stall.start &&
            stall.releasedEpochMs < stall.timeOrigin + stall.end,
    );
    recordCheck(
      `${label}: time accounting and publication valid`,
      time.passed,
      time,
    );
    recordCheck(
      `${label}: no accumulated stall dose`,
      acceptedDuringStall <= 50.01,
      { acceptedDuringStall, discardedDuringStall },
    );
    if (continueHolding)
      recordCheck(
        `${label}: continued hold resumes after the stall`,
        stall.resumed,
      );
    recordCheck(
      `${label}: one history action`,
      after.document.historyActions === before.document.historyActions + 1,
    );
    recordCheck(
      `${label}: terrain was edited`,
      after.samples[0] > before.samples[0],
    );
    await capture(session, "edited", [[0, 0]]);
    await page.waitForTimeout(180);
    const settled = await stateSnapshot(page, [[0, 0]]);
    recordCheck(
      `${label}: no late dose after completed action`,
      settled.samples[0] === after.samples[0],
    );
    await button(page, /Rückgängig/);
    await exact(page);
    const undone = await stateSnapshot(page, [[0, 0]]);
    recordCheck(
      `${label}: Undo restores original value`,
      Math.abs(undone.samples[0] - before.samples[0]) < 1e-7,
    );
    await capture(session, "undone", [[0, 0]]);
    recordCheck(
      `${label}: no renderer exception`,
      session.errors.length === 0,
      session.errors,
    );
    await writeFile(
      join(session.directory, "observation.json"),
      JSON.stringify(after, null, 2),
    );
  } finally {
    await session.close();
  }
}

async function scenario(name, action) {
  const result = { name, state: "running" };
  report.cases.push(result);
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  try {
    await action();
    result.state = "passed";
  } catch (error) {
    result.state = "failed";
    report.errors.push({
      scenario: name,
      error: String(error),
      stack: error.stack,
    });
    throw error;
  } finally {
    await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  }
}

try {
  if (selection === "all" || selection === "normal")
    await scenario("normal", normalStart);
  if (selection === "all" || selection === "stall") {
    await scenario("stall-release", () => rendererStall(false));
    await scenario("stall-held", () => rendererStall(true));
  }
  if (selection === "all" || selection === "lifecycle") {
    const { runLifecycleScenarios } = await import("./atlas-p0-lifecycle.mjs");
    await scenario("lifecycle", () =>
      runLifecycleScenarios({ launch, out, recordCheck }),
    );
  }
  report.passed =
    report.checks.length > 0 && report.checks.every((check) => check.passed);
} catch (error) {
  console.error(error);
} finally {
  const closed = await Promise.allSettled(
    [...sessions].map((session) => session.close()),
  );
  for (const result of closed)
    if (result.status === "rejected") {
      report.errors.push({ scenario: "cleanup", error: String(result.reason) });
      report.passed = false;
    }
  report.finishedAt = new Date().toISOString();
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        output: out,
        passed: report.passed,
        checks: report.checks.length,
        selection,
        errors: report.errors,
      },
      null,
      2,
    ),
  );
  process.exitCode = report.passed ? 0 : 1;
}
