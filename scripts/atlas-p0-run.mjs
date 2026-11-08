import { _electron as electron } from "@playwright/test";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { cpus, release, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateAcceptance,
  evaluateSubmissionDiagnostics,
  evaluateColdSubmissionDiagnostics,
  extractEditSamples,
  checkBuildIdentity,
  P0_REQUIREMENTS,
} from "./atlas-p0-evaluate.mjs";
import { analyzeTrace } from "./atlas-p0-trace.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const runtimeExecutablePath = require("electron");
const executableIndex = argv.indexOf("--executable");
const packaged = executableIndex >= 0;
const executablePath = packaged
  ? resolve(argv[executableIndex + 1])
  : runtimeExecutablePath;
const lab = argv.includes("--lab"),
  native = argv.includes("--native");
const full = argv.includes("--full") || argv.includes("--acceptance");
const controls = argv.includes("--negative-controls");
const outIndex = argv.indexOf("--out");
const out = resolve(
  outIndex >= 0
    ? argv[outIndex + 1]
    : join(
        "artifacts/atlas-rebuild/runs",
        new Date().toISOString().replaceAll(":", "-") +
          "-" +
          randomUUID().slice(0, 8),
      ),
);
if (lab === native) {
  console.error(
    "Usage: node scripts/atlas-p0-run.mjs (--lab | --native) [--executable packaged-binary] [--negative-controls] [--full] [--out directory]",
  );
  process.exit(2);
}
await mkdir(out, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const log = (message) => console.log(`[atlas-p0] ${message}`);
if (native || full)
  log(
    "This command collects a functional pilot. Full three-release P0 measurement collection is not implemented; acceptance remains blocked without the full manifest and exact presentation mapping.",
  );
const report = {
  schemaVersion: 1,
  mode: lab ? "lab" : "native",
  scope:
    "P0 functional height pilot; diagnostic sample counts are not release acceptance",
  startedAt: new Date().toISOString(),
  manifest: P0_REQUIREMENTS,
  excluded: [
    "later P1-P9 tools and final scenario scope",
    "physical pixel timing",
    "Aaron's hardware performance",
    "cold operating-system page cache",
  ],
  reference: {
    qualified: false,
    softwareRendering: lab,
    displayHz: null,
    hardware: {
      cpu: cpus()[0]?.model,
      ramBytes: totalmem(),
      os: `${process.platform} ${release()}`,
    },
  },
  presentationMapping: {
    status: "unsupported",
    method: null,
    reason:
      "No proven join from Atlas semantic render generation to Chromium surface-frame/display-frame presentation. Submission and RAF remain proxies.",
    clock: { calibrated: false },
  },
  functional: { checks: [] },
  runs: [],
  negativeControls: [],
  errors: [],
};
const check = (id, passed, details = {}) => {
  report.functional.checks.push({ id, passed: Boolean(passed), ...details });
  if (!passed) throw new Error(`Functional check failed: ${id}`);
};
const closeEnough = (actual, expected) =>
  actual.length === expected.length &&
  actual.every(
    (value, index) =>
      Number.isFinite(value) && Math.abs(value - expected[index]) < 1e-7,
  );
const snapshot = (page, points = []) =>
  page.evaluate((points) => window.atlasObserve(points), points);

function fixtureCommand(...args) {
  const result = spawnSync(
    runtimeExecutablePath,
    [join(root, "scripts/atlas-p0-fixture.mjs"), ...args],
    {
      cwd: root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 8 * 1024 ** 2,
    },
  );
  if (result.status !== 0 || result.error)
    throw new Error(
      `Fixture process failed: ${result.error ?? result.stderr ?? result.status}`,
    );
  return JSON.parse(result.stdout.trim());
}

async function launch(project, label, fault = "none") {
  const sessionDirectory = join(out, label);
  await mkdir(sessionDirectory, { recursive: true });
  const env = {
    ...process.env,
    ATLAS_P0_PROJECT: project,
    ATLAS_P0_DIALOG_OPEN: project,
    ATLAS_P0_DIALOG_SAVE: project,
    ATLAS_P0_DIALOG_UNSAVED: "discard",
    ATLAS_P0_DIAGNOSTICS: "1",
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ATLAS_P0_FAULT;
  if (fault !== "none") env.ATLAS_P0_FAULT = fault;
  const args = lab
    ? [
        "--ozone-platform=headless",
        "--ozone-override-screen-size=1600,1200",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ]
    : [];
  if (!packaged) args.push(join(root, "desktop-dist/main.cjs"));
  const app = await electron.launch({
    executablePath,
    args,
    env,
    timeout: 30_000,
  });
  const output = [];
  app.process().stdout?.on("data", (data) => output.push(String(data)));
  app.process().stderr?.on("data", (data) => output.push(String(data)));
  const page = await app.firstWindow();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.setDefaultTimeout(20_000);
  try {
    await page.waitForFunction(
      () => {
        const error = document.querySelector('[role="alert"]')?.textContent;
        if (error) throw new Error(error);
        return typeof window.atlasObserve === "function";
      },
      null,
      { timeout: 30_000 },
    );
  } catch (error) {
    const details = {
      error: String(error),
      pageErrors,
      body: await page
        .locator("body")
        .innerText()
        .catch(() => "unavailable"),
    };
    await writeFile(
      join(sessionDirectory, "startup-failure.json"),
      JSON.stringify(details, null, 2),
    );
    await page
      .screenshot({ path: join(sessionDirectory, "startup-failure.png") })
      .catch(() => {});
    await app.close();
    await writeFile(join(sessionDirectory, "electron.log"), output.join(""));
    throw new Error(
      `Electron renderer startup failed: ${JSON.stringify(details)}`,
    );
  }
  const metadata = await app.evaluate(async () =>
    globalThis.__atlasHost.info(),
  );
  const buildIdentity = checkBuildIdentity(
    report.workspaceBuild,
    metadata.build,
    metadata.buildProvenance,
  );
  if (packaged && metadata.packaged !== true)
    buildIdentity.failures.push({
      code: "REQUESTED_EXECUTABLE_IS_NOT_PACKAGED",
    });
  buildIdentity.passed = buildIdentity.failures.length === 0;
  if (!buildIdentity.passed) {
    const evidence = {
      executablePath,
      requestedPackaged: packaged,
      observedPackaged: metadata.packaged,
      workspaceBuild: report.workspaceBuild,
      executedBuild: metadata.build,
      provenance: metadata.buildProvenance,
      identity: buildIdentity,
    };
    await writeFile(
      join(sessionDirectory, "build-identity-failure.json"),
      JSON.stringify(evidence, null, 2),
    );
    await app.close();
    await writeFile(join(sessionDirectory, "electron.log"), output.join(""));
    report.errors.push({
      code: "EXECUTED_BUILD_IDENTITY_FAILED",
      failures: buildIdentity.failures,
    });
    throw new Error(
      `Executed build identity rejected: ${JSON.stringify(buildIdentity.failures)}`,
    );
  }
  report.build = {
    ...metadata.build,
    sha256: packaged
      ? report.packagedBuild.sha256
      : report.workspaceBuild.sha256,
    provenance: metadata.buildProvenance,
    workspaceSourceAndLockVerified: true,
  };
  const view = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    dpr: devicePixelRatio,
    visible: document.visibilityState,
    focused: document.hasFocus(),
    timeOrigin: performance.timeOrigin,
  }));
  const gpu = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return { available: false };
    const extension = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      available: true,
      renderer: extension
        ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      vendor: extension
        ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL)
        : gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
    };
  });
  const instance = {
    id: label,
    instanceId: randomUUID(),
    pid: app.process().pid,
    executablePath,
    args,
    metadata,
    executedBuild: metadata.build,
    buildProvenance: metadata.buildProvenance,
    buildIdentity,
    view,
    gpu,
    scenarios: [],
  };
  report.runs.push(instance);
  if (!report.reference.viewport) {
    report.reference.viewport = {
      width: view.width,
      height: view.height,
      dpr: view.dpr,
    };
    report.reference.hardware.gpu = gpu.renderer ?? "unknown";
    report.reference.softwareRendering =
      lab || /swiftshader|llvmpipe|software/i.test(gpu.renderer ?? "");
    report.reference.displayHz =
      metadata.displays?.[0]?.displayFrequency ??
      metadata.display?.displayFrequency ??
      metadata.displayFrequency ??
      null;
    // A display existing is insufficient to silently nominate it as the reference.
    report.reference.qualified = false;
  }
  await writeFile(
    join(sessionDirectory, "environment.json"),
    JSON.stringify({ ...instance, scenarios: undefined }, null, 2),
  );
  log(
    `${label}: Electron ${metadata.versions.electron}; ${view.width}×${view.height} DPR ${view.dpr}; ${gpu.renderer}`,
  );
  return {
    app,
    page,
    instance,
    directory: sessionDirectory,
    async close() {
      try {
        const final = await snapshot(page);
        await writeFile(
          join(sessionDirectory, "observation.json"),
          JSON.stringify(final, null, 2),
        );
        instance.final = {
          document: final.document,
          state: final.state,
          renderer: final.renderer,
          droppedEvents: final.droppedEvents,
          background: final.background,
        };
        instance.storeMetrics = await app.evaluate(() =>
          globalThis.__atlasHost.metrics(),
        );
        instance.pageErrors = pageErrors;
      } finally {
        await app.close();
        await writeFile(
          join(sessionDirectory, "electron.log"),
          output.join(""),
        );
      }
    },
  };
}

async function exact(page, timeout = 20_000) {
  await page.waitForFunction(
    () => {
      const o = window.atlasObserve();
      if (o.state.error) throw new Error(o.state.error);
      return (
        !o.state.loading &&
        o.events.some(
          (event) =>
            event.kind === "submit" &&
            event.sessionId === o.sessionId &&
            event.exactRevision === o.document.revision &&
            event.cameraGeneration === o.renderer.viewGeneration,
        )
      );
    },
    null,
    { timeout },
  );
}

async function values(page, points) {
  return (await snapshot(page, points)).samples;
}
async function button(page, name) {
  await page
    .getByRole("button", { name, exact: typeof name === "string" })
    .click();
}
async function brush(page, diameter, amountFeet) {
  await page.getByLabel("Pinselgröße", { exact: true }).fill(String(diameter));
  await page
    .getByLabel("Höhenänderung", { exact: true })
    .fill(String(amountFeet * 0.3048));
  await button(page, /Anheben/);
}
async function position(page, point = [0, 0]) {
  const o = await snapshot(page);
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Canvas has no bounding box");
  return {
    x: box.x + box.width / 2 + (point[0] - o.camera.x) * o.camera.scale,
    y: box.y + box.height / 2 + (point[1] - o.camera.y) * o.camera.scale,
  };
}
async function dab(session, point = [0, 0], timeout = 5000) {
  const before = await snapshot(session.page);
  const at = await position(session.page, point);
  await session.page.mouse.move(at.x, at.y);
  await session.page.mouse.down();
  await session.page.mouse.up();
  return observeDab(session, before, timeout);
}
async function observeDab(session, before, timeout = 5000) {
  const priorIds = new Set(
    before.events.filter((e) => e.kind === "input").map((e) => e.id),
  );
  const cutoff = Math.max(0, ...priorIds);
  await session.page.waitForFunction(
    (cutoff) => {
      const events = window.atlasObserve().events;
      return ["edit", "pointerup"].every((kind) =>
        events.some(
          (e) => e.kind === "input" && e.id > cutoff && e.inputKind === kind,
        ),
      );
    },
    cutoff,
    { timeout },
  );
  const early = await snapshot(session.page);
  const ids = early.events
    .filter(
      (e) =>
        e.kind === "input" &&
        !priorIds.has(e.id) &&
        ["edit", "pointerup"].includes(e.inputKind),
    )
    .map((e) => e.id);
  let timedOut = false;
  try {
    await session.page.waitForFunction(
      (ids) => {
        const o = window.atlasObserve();
        return ids.every((id) =>
          o.events.some(
            (e) =>
              e.kind === "edit-submit" &&
              e.input === id &&
              e.sessionId === o.sessionId,
          ),
        );
      },
      ids,
      { timeout },
    );
  } catch (error) {
    if (error.name !== "TimeoutError") throw error;
    timedOut = true;
  }
  const after = await snapshot(session.page);
  return {
    before,
    after,
    inputIds: ids,
    timedOut,
    samples: extractEditSamples(after.events, ids, after.sessionId),
  };
}

async function editDuringActualSave(session, point) {
  const attempts = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await snapshot(session.page, [point]);
    const at = await position(session.page, point);
    const previous = await session.app.evaluate(
      () => globalThis.__atlasHost.storeActivity?.() ?? [],
    );
    const known = [...new Set(previous.map((e) => e.token))];
    // Observe real utility-process activity. Send ordinary native mouse events
    // only while a new real snapshot/publish interval is actually open.
    const monitor = session.app.evaluate(
      async ({ BrowserWindow }, { at, known }) => {
        const deadline = performance.now() + 800;
        while (performance.now() < deadline) {
          const events = globalThis.__atlasHost.storeActivity?.() ?? [];
          const active = events.find(
            (e) =>
              e.phase === "start" &&
              !known.includes(e.token) &&
              !events.some(
                (end) =>
                  end.token === e.token &&
                  end.kind === e.kind &&
                  end.phase === "end",
              ),
          );
          if (active) {
            const contents = BrowserWindow.getAllWindows()[0].webContents;
            const coordinates = { x: Math.round(at.x), y: Math.round(at.y) };
            contents.sendInputEvent({ type: "mouseMove", ...coordinates });
            contents.sendInputEvent({
              type: "mouseDown",
              button: "left",
              clickCount: 1,
              ...coordinates,
            });
            contents.sendInputEvent({
              type: "mouseUp",
              button: "left",
              clickCount: 1,
              ...coordinates,
            });
            return { dispatched: true, observedActive: active };
          }
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
        return { dispatched: false };
      },
      { at, known },
    );
    await button(session.page, "Speichern");
    const trigger = await monitor;
    if (!trigger.dispatched) {
      attempts.push({ attempt, trigger, overlapProven: false });
      continue;
    }
    const edit = await observeDab(session, before);
    const afterHeight = (await values(session.page, [point]))[0];
    const activity = await session.app.evaluate(() =>
      globalThis.__atlasHost.storeActivity(),
    );
    const intervals = activity
      .filter((e) => e.phase === "start" && !known.includes(e.token))
      .map((start) => ({
        start,
        end: activity.find(
          (end) =>
            end.token === start.token &&
            end.kind === start.kind &&
            end.phase === "end",
        ),
      }))
      .filter((pair) => pair.end?.success === true);
    const matches = edit.samples
      .filter((sample) => sample.inputKind === "edit")
      .flatMap((sample) =>
        intervals
          .filter(({ start, end }) => {
            const epoch = edit.after.timeOrigin + sample.createdAt;
            return (
              start.sessionId === edit.after.sessionId &&
              epoch >= start.epochMs &&
              epoch <= end.epochMs
            );
          })
          .map((interval) => ({
            inputId: sample.inputId,
            inputEpochMs: edit.after.timeOrigin + sample.createdAt,
            ...interval,
          })),
      );
    const overlapProven =
      matches.length > 0 &&
      before.background.active &&
      edit.after.background.active &&
      Number.isFinite(before.samples[0]) &&
      Number.isFinite(afterHeight) &&
      afterHeight > before.samples[0] &&
      !edit.timedOut &&
      edit.samples.length >= 2 &&
      edit.samples.every((s) => Number.isFinite(s.submissionAt));
    attempts.push({
      attempt,
      trigger,
      overlapProven,
      matches,
      activity,
      samples: edit.samples,
      beforeHeight: before.samples[0],
      afterHeight,
      backgroundBefore: before.background,
      backgroundAfter: edit.after.background,
    });
    if (overlapProven) return { passed: true, attempts, edit };
    // Preserve completed real edits before a bounded next attempt. No store delay,
    // synthetic workload, or fixture inflation is used to force an overlap.
    await session.page.waitForFunction(
      () => !window.atlasObserve().state.writing,
    );
  }
  return { passed: false, attempts };
}

async function capture(session, name, points) {
  const state = await snapshot(session.page);
  const box = await session.page.locator("canvas").boundingBox();
  if (!box) throw new Error("Canvas unavailable for image check");
  const rect = {
    x: Math.ceil(box.x),
    y: Math.ceil(box.y),
    width: Math.floor(box.width),
    height: Math.floor(box.height),
  };
  const samples = points.map(([x, y]) => ({
    x: Math.round(box.width / 2 + (x - state.camera.x) * state.camera.scale),
    y: Math.round(box.height / 2 + (y - state.camera.y) * state.camera.scale),
  }));
  const image = await session.app.evaluate(
    async ({ BrowserWindow }, { rect, samples }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const image = await win.webContents.capturePage(rect);
      const size = image.getSize(),
        bitmap = image.toBitmap();
      const pixels = samples.map(({ x, y }) => {
        if (x < 0 || y < 0 || x >= size.width || y >= size.height) return null;
        const index = (y * size.width + x) * 4;
        return [
          bitmap[index + 2],
          bitmap[index + 1],
          bitmap[index],
          bitmap[index + 3],
        ];
      });
      return { size, pixels, png: image.toPNG().toString("base64") };
    },
    { rect, samples },
  );
  await writeFile(
    join(session.directory, `${name}.png`),
    Buffer.from(image.png, "base64"),
  );
  return {
    file: `${session.instance.id}/${name}.png`,
    size: image.size,
    pixels: image.pixels,
    points,
    revision: state.document.revision,
    camera: state.camera,
    method:
      "Electron capturePage outside timed interval; content evidence only",
  };
}

async function navigateTo(page, point) {
  const details = page.locator("details");
  if ((await details.getAttribute("open")) === null)
    await page.getByText("Zu Koordinaten", { exact: true }).click();
  await page
    .getByLabel("Ziel X", { exact: true })
    .fill(String(point[0] * 0.3048));
  await page
    .getByLabel("Ziel Y", { exact: true })
    .fill(String(point[1] * 0.3048));
  const before = await snapshot(page);
  await button(page, "Zum Ziel");
  const after = await snapshot(page);
  const lastId = Math.max(
    0,
    ...before.events.filter((e) => e.kind === "input").map((e) => e.id),
  );
  const input = after.events.find(
    (e) => e.kind === "input" && e.inputKind === "navigation" && e.id > lastId,
  );
  if (!input) throw new Error("No genuine target-navigation input observed");
  return input;
}

async function emptyNavigation(fixture) {
  const file = join(out, "empty-working.saltatlas");
  await copyFile(fixture.files.empty, file);
  const session = await launch(file, "empty-navigation");
  try {
    await exact(session.page);
    for (const grid of [true, false]) {
      await session.page.getByLabel("Raster anzeigen").setChecked(grid);
      const before = await snapshot(session.page);
      const metricsBefore = await session.app.evaluate(() =>
        globalThis.__atlasHost.metrics(),
      );
      const start = performance.now();
      const p = await position(session.page);
      await session.page.mouse.move(p.x, p.y);
      for (let i = 0; i < 8; i++) {
        await session.page.mouse.wheel(0, i % 2 ? -80 : 80);
        await session.page.waitForTimeout(40);
      }
      await session.page.mouse.down({ button: "middle" });
      await session.page.mouse.move(p.x + 120, p.y + 70, { steps: 12 });
      await session.page.mouse.up({ button: "middle" });
      const after = await snapshot(session.page);
      const metricsAfter = await session.app.evaluate(() =>
        globalThis.__atlasHost.metrics(),
      );
      const cutoff = Math.max(
        0,
        ...before.events.filter((e) => e.kind === "input").map((e) => e.id),
      );
      const inputs = after.events.filter(
        (e) =>
          e.kind === "input" && e.id > cutoff && e.inputKind === "navigation",
      );
      const frames = after.events
        .slice(before.events.length)
        .filter((e) => e.kind === "frame");
      session.instance.scenarios.push({
        id: grid ? "M01-grid-on" : "M01-grid-off",
        kind: "navigation",
        durationMs: performance.now() - start,
        samples: inputs.map((e) => ({
          inputId: e.id,
          createdAt: e.createdAt,
          handlerAt: e.at,
          presentation: null,
        })),
        authorChanges: after.document.sequence - before.document.sequence,
        cameraBlockedOnStore: metricsAfter.reads !== metricsBefore.reads,
        cpuWorkMs: frames.map((e) => e.cpuMs),
        rafFrameIntervalsMs: frames.map((e) => e.interval),
        presentationFrameIntervalsMs: [],
        droppedEvents: after.droppedEvents,
      });
      check(
        grid ? "empty-navigation-grid-on" : "empty-navigation-grid-off",
        inputs.length > 0 &&
          before.document.sequence === after.document.sequence &&
          metricsAfter.commits === metricsBefore.commits &&
          metricsAfter.reads === metricsBefore.reads &&
          (after.camera.x !== before.camera.x ||
            after.camera.y !== before.camera.y),
        {
          inputs: inputs.length,
          authorChanges: 0,
          storeReads: metricsAfter.reads - metricsBefore.reads,
        },
      );
    }
  } finally {
    await session.close();
  }
}

async function traceSummary(file) {
  const bytes = await readFile(file);
  const analysis = analyzeTrace(bytes.toString());
  await writeFile(
    file.replace(/\.json$/, "-analysis.json"),
    JSON.stringify(analysis, null, 2),
  );
  return {
    file,
    sha256: hash(bytes),
    bytes: bytes.length,
    events: analysis.events,
    selectedEventCounts: analysis.selectedEventCounts,
    exactSemanticFrameMapping: analysis.mappingStatus,
    missingEdge: analysis.missingEdge,
  };
}

async function coastJourney(fixture) {
  const file = join(out, "coast-working.saltatlas");
  await copyFile(fixture.files.coast, file);
  const session = await launch(file, "coast-journey");
  const points = fixture.expected.points;
  try {
    await exact(session.page);
    await session.page.getByLabel("Raster anzeigen").uncheck();
    check(
      "canonical-fixture",
      closeEnough(await values(session.page, points), fixture.expected.before),
    );
    const beforeImage = await capture(session, "coast-before", [[-800, 0]]);
    await button(session.page, "Regionsansicht");
    await exact(session.page);
    await brush(session.page, 64, 100);
    await session.app.evaluate(() => globalThis.__atlasHost.startTrace());
    const coarse = await dab(session);
    // Preserve presentation reporter completion after submission. This tail is
    // outside the measured input/model/submission intervals and adds no samples.
    await session.page.waitForTimeout(500);
    const tracePath = join(session.directory, "chromium-trace.json");
    const actualTracePath = await session.app.evaluate(
      (_electron, path) => globalThis.__atlasHost.stopTrace(path),
      tracePath,
    );
    try {
      report.trace = await traceSummary(actualTracePath);
    } catch (error) {
      report.trace = {
        requestedPath: tracePath,
        actualPath: actualTracePath,
        status: "unavailable",
        error: String(error),
      };
    }
    session.instance.scenarios.push({
      id: "M04-coarse-fine",
      kind: "edit",
      samples: coarse.samples,
      droppedEvents: coarse.after.droppedEvents,
    });
    report.submissionDiagnostics = evaluateSubmissionDiagnostics(
      coarse.samples,
    );
    check(
      "coarse-exact-values",
      !coarse.timedOut &&
        coarse.samples.length >= 2 &&
        coarse.samples.every((s) => Number.isFinite(s.submissionAt)) &&
        closeEnough(
          await values(session.page, points),
          fixture.expected.afterCoarseDab,
        ),
      {
        samples: await values(session.page, points),
        expected: fixture.expected.afterCoarseDab,
      },
    );
    await button(session.page, "Nahansicht");
    await exact(session.page);
    const afterImage = await capture(session, "coast-after", [[-800, 0]]);
    const water = beforeImage.pixels[0],
      land = afterImage.pixels[0];
    check(
      "terrain-pixels",
      water &&
        land &&
        water[2] > water[0] &&
        land[0] > land[2] &&
        JSON.stringify(water) !== JSON.stringify(land),
      { before: beforeImage, after: afterImage },
    );
    await button(session.page, /Rückgängig/);
    await exact(session.page);
    const undone = await values(session.page, points);
    await button(session.page, /Wiederholen/);
    await exact(session.page);
    const redone = await values(session.page, points);
    check(
      "undo-redo",
      closeEnough(undone, fixture.expected.before) &&
        closeEnough(redone, fixture.expected.afterCoarseDab),
      { undone, redone },
    );
    await button(session.page, "Speichern");
    await session.page.waitForFunction(() => window.atlasObserve().state.saved);
    const stored = fixtureCommand("inspect", file);
    check(
      "coarse-preserves-fine",
      stored.fineSha256 === fixture.coast.fineSha256 &&
        closeEnough(stored.samples, fixture.expected.afterCoarseDab),
      {
        beforeFineSha256: fixture.coast.fineSha256,
        afterFineSha256: stored.fineSha256,
        storedSamples: stored.samples,
      },
    );
    const previousSession = (await snapshot(session.page)).sessionId;
    await button(session.page, "Öffnen");
    await session.page.waitForFunction(
      (previous) => window.atlasObserve().sessionId !== previous,
      previousSession,
    );
    await exact(session.page);
    check(
      "save-reopen",
      closeEnough(
        await values(session.page, points),
        fixture.expected.afterCoarseDab,
      ),
    );

    // Cold source absence is observed before the real navigation. No preparatory
    // dataReady wait or direct camera/model invocation is permitted here.
    const target = [80_000, 0];
    const coldBefore = (await values(session.page, [target]))[0] === null;
    check("cold-before-navigation", coldBefore, {
      target,
      cache: "application cache; OS cache unchanged",
    });
    await brush(session.page, 16, 10);
    const navigation = await navigateTo(session.page, target);
    await session.page.waitForFunction(
      (id) =>
        window
          .atlasObserve()
          .events.some(
            (e) => ["ready", "input-ready"].includes(e.kind) && e.input === id,
          ),
      navigation.id,
      { timeout: 5000 },
    );
    const readyState = await snapshot(session.page);
    const ready = readyState.events.find(
      (e) =>
        ["ready", "input-ready"].includes(e.kind) && e.input === navigation.id,
    );
    const cold = await dab(session, target);
    const coldSamples = cold.samples
      .filter((sample) => sample.inputKind === "edit")
      .slice(0, 1)
      .map((sample) => ({
        ...sample,
        navigationId: navigation.id,
        navigationAt: navigation.createdAt,
        readyAt: ready.at,
        coldBeforeNavigation: coldBefore,
        timeout: cold.timedOut,
      }));
    session.instance.scenarios.push({
      id: "M10-height-cold",
      kind: "cold",
      samples: coldSamples,
      droppedEvents: cold.after.droppedEvents,
    });
    check(
      "cold-edit-after-navigation",
      !cold.timedOut &&
        cold.samples.length > 0 &&
        cold.samples.every((s) => Number.isFinite(s.submissionAt)) &&
        ready.at >= navigation.createdAt,
      {
        navigationCreatedAt: navigation.createdAt,
        readyAt: ready.at,
        readyDelayMs: ready.at - navigation.createdAt,
        submissionOnly: true,
      },
    );

    await button(session.page, "Hintergrundarbeit starten");
    await session.page.waitForFunction(
      () => window.atlasObserve().background.active === true,
    );
    const busyBefore = await snapshot(session.page);
    const metricsBefore = await session.app.evaluate(() =>
      globalThis.__atlasHost.metrics(),
    );
    const overlap = await editDuringActualSave(session, [target[0] + 180, 140]);
    await button(session.page, "Speichern");
    await session.page.waitForFunction(() => window.atlasObserve().state.saved);
    const metricsAfter = await session.app.evaluate(() =>
      globalThis.__atlasHost.metrics(),
    );
    const busyAfter = await snapshot(session.page);
    session.instance.scenarios.push({
      id: "M06-height-busy",
      kind: "edit",
      samples: overlap.edit?.samples ?? [],
      droppedEvents: busyAfter.droppedEvents,
    });
    check(
      "worker-and-save-executed",
      busyBefore.background.active &&
        metricsAfter.snapshots > metricsBefore.snapshots,
      {
        snapshots: metricsAfter.snapshots - metricsBefore.snapshots,
        backgroundBefore: busyBefore.background,
      },
    );
    report.functional.checks.push({
      id: "busy-worker-and-save",
      passed: overlap.passed,
      status: overlap.passed ? "PASS" : "OPEN",
      attempts: overlap.attempts,
      explanation:
        "Input creation epoch must lie inside an actual successful utility snapshot/publish interval while canonical worker activity is present. Button order alone is insufficient.",
    });
    await capture(session, "final-coast-lab", []);
  } finally {
    await session.close();
  }
  const restarted = await launch(file, "process-restart");
  try {
    await exact(restarted.page);
    check(
      "process-restart",
      closeEnough(
        await values(restarted.page, fixture.expected.points),
        fixture.expected.afterCoarseDab,
      ),
    );
  } finally {
    await restarted.close();
  }
}

async function negativeControl(fixture, fault) {
  const file = join(out, `${fault}-working.saltatlas`);
  await copyFile(fixture.files.coast, file);
  const session = await launch(
    file,
    `control-${fault}`,
    fault === "recovery" ? "none" : fault,
  );
  try {
    await exact(session.page);
    await brush(session.page, 16, 10);
    const result = await dab(
      session,
      [0, 0],
      fault === "drop-render" ? 5000 : 10_000,
    );
    const evaluation = evaluateSubmissionDiagnostics(result.samples);
    const code =
      fault === "delay-render"
        ? "SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT"
        : "MISSING_SUBMISSION";
    const valid =
      fault === "recovery"
        ? result.samples.length > 0 &&
          result.samples.every((s) => Number.isFinite(s.submissionAt)) &&
          result.after.renderer.fault === "none"
        : result.after.renderer.fault === fault &&
          evaluation.status === "FAIL" &&
          evaluation.issues.some((e) => e.code === code);
    report.negativeControls.push({
      fault,
      passed: valid,
      actualFault: result.after.renderer.fault,
      evaluation,
      samples: result.samples,
    });
    if (!valid)
      throw new Error(
        `Negative control did not fail/recover for its intended reason: ${fault}`,
      );
  } finally {
    await session.close();
  }
}

try {
  const buildMetadata = JSON.parse(
    await readFile(join(root, "desktop-dist/build.json"), "utf8"),
  );
  const buildHash = createHash("sha256"),
    buildFiles = [];
  async function collectBuiltFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) await collectBuiltFiles(file);
      else if (
        entry.isFile() &&
        !entry.name.endsWith(".map") &&
        entry.name !== "build.json"
      ) {
        const bytes = await readFile(file);
        buildHash.update(file);
        buildHash.update("\0");
        buildHash.update(bytes);
        buildFiles.push({ file, sha256: hash(bytes), bytes: bytes.length });
      }
    }
  }
  await collectBuiltFiles("desktop-dist");
  await collectBuiltFiles("dist-editor");
  report.workspaceBuild = {
    ...buildMetadata,
    sha256: buildHash.digest("hex"),
    files: buildFiles,
  };
  if (packaged) {
    const packageHash = createHash("sha256"),
      packageFiles = [];
    async function collectPackage(directory) {
      for (const entry of (
        await readdir(directory, { withFileTypes: true })
      ).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) await collectPackage(file);
        else if (entry.isFile()) {
          const bytes = await readFile(file);
          const identity = file.slice(dirname(executablePath).length + 1);
          packageHash.update(identity);
          packageHash.update("\0");
          packageHash.update(bytes);
          packageFiles.push({
            file: identity,
            bytes: bytes.length,
            sha256: hash(bytes),
          });
        }
      }
    }
    await collectPackage(dirname(executablePath));
    report.packagedBuild = {
      executablePath,
      sha256: packageHash.digest("hex"),
      files: packageFiles,
    };
  }
  if (native && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    report.errors.push({
      code: "NO_NATIVE_DISPLAY",
      message:
        "Native mode requires the regular reference display. Use --lab only for software headless functional evidence.",
    });
  } else {
    const fixture = fixtureCommand("create", join(out, "fixtures"));
    report.fixture = fixture.coast;
    report.fixtureManifest = fixture;
    log("real .saltatlas fixtures created; starting built Electron app");
    await emptyNavigation(fixture);
    await coastJourney(fixture);
    if (controls)
      for (const fault of ["delay-render", "drop-render", "recovery"])
        await negativeControl(fixture, fault);
  }
} catch (error) {
  report.errors.push({
    code: "RUNNER_OR_PRODUCT_FAILURE",
    message: String(error),
    stack: error.stack,
  });
  console.error(error);
} finally {
  report.finishedAt = new Date().toISOString();
  report.acceptance = evaluateAcceptance(report);
  const requiredFunctional = [
    ...P0_REQUIREMENTS.requiredChecks,
    "empty-navigation-grid-on",
    "empty-navigation-grid-off",
    "coarse-exact-values",
    "cold-edit-after-navigation",
  ];
  report.functional.passed =
    report.errors.length === 0 &&
    requiredFunctional.every((id) =>
      report.functional.checks.some((c) => c.id === id && c.passed),
    );
  report.nativeGate = {
    status: "BLOCKED",
    passed: false,
    reason: lab
      ? "Software headless laboratory: no qualified native reference; exact presentation mapping and full release collection remain unavailable."
      : report.errors.some((error) => error.code === "NO_NATIVE_DISPLAY")
        ? "No native display is available; exact presentation mapping and full release collection remain unavailable."
        : "Native functional pilot only: this display is not yet qualified, exact presentation mapping and full three-release collection remain unavailable.",
    fullEvaluation: report.acceptance.status,
  };
  report.proxySummary = report.runs.flatMap((r) =>
    r.scenarios
      .filter((s) => s.kind !== "navigation")
      .map((s) => ({
        run: r.id,
        scenario: s.id,
        diagnosticOnly: true,
        samples: s.samples.length,
        submission:
          s.kind === "cold"
            ? evaluateColdSubmissionDiagnostics(s.samples)
            : evaluateSubmissionDiagnostics(s.samples),
      })),
  );
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        output: out,
        functional: report.functional.passed ? "PASS" : "FAIL",
        nativeGate: report.nativeGate,
        negativeControls: report.negativeControls.map(({ fault, passed }) => ({
          fault,
          passed,
        })),
        errors: report.errors,
      },
      null,
      2,
    ),
  );
  process.exitCode = report.errors.some(
    (error) => error.code === "NO_NATIVE_DISPLAY",
  )
    ? 2
    : !report.functional.passed
      ? 1
      : native || full
        ? report.acceptance.passed
          ? 0
          : 2
        : 0;
}
